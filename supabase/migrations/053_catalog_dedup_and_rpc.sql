-- ============================================================================
-- MIGRATION 053: Catalog Deduplication + Unique Constraint + RPC
-- 
-- This migration is IDEMPOTENT - safe to run multiple times.
--
-- Purpose:
-- 1. Add is_catalog column if not exists
-- 2. Rename all "All Songs" setlists to "Catalog"
-- 3. Merge and delete duplicate Catalogs per band (keep oldest with most songs)
-- 4. Create unique partial index on is_catalog=true per band
-- 5. Create ensure_catalog_setlist RPC with band-member RLS check
-- 6. Ensure all bands have exactly one Catalog
--
-- Created: 2024-12-19
-- ============================================================================

-- ============================================================================
-- STEP 1: ADD is_catalog COLUMN IF NOT EXISTS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'setlists' 
      AND column_name = 'is_catalog'
  ) THEN
    ALTER TABLE public.setlists ADD COLUMN is_catalog BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Added is_catalog column to setlists table';
  ELSE
    RAISE NOTICE 'is_catalog column already exists';
  END IF;
END $$;

-- Index for faster Catalog lookups
CREATE INDEX IF NOT EXISTS idx_setlists_is_catalog 
ON public.setlists(band_id, is_catalog) 
WHERE is_catalog = true;

-- ============================================================================
-- STEP 2: MARK ALL CATALOG CANDIDATES
-- Mark "All Songs", "Catalog", or setlist_type='all_songs'/'catalog' as is_catalog=true
-- Also rename to "Catalog"
-- ============================================================================
UPDATE public.setlists
SET is_catalog = true, name = 'Catalog'
WHERE (
  LOWER(name) = 'all songs' 
  OR LOWER(name) = 'catalog'
  OR (setlist_type IS NOT NULL AND setlist_type IN ('all_songs', 'catalog'))
);

-- ============================================================================
-- STEP 3: DEDUPLICATE CATALOGS PER BAND
-- For each band with multiple is_catalog=true:
--   - Keep the one with most songs (tie-breaker: oldest created_at)
--   - Merge songs from duplicates into the canonical one
--   - Delete the duplicates
-- ============================================================================
DO $$
DECLARE
  band_record RECORD;
  catalog_record RECORD;
  canonical_id UUID;
  duplicate_id UUID;
  max_position INTEGER;
  song_record RECORD;
  merged_count INTEGER;
  deleted_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=== Starting Catalog Deduplication ===';
  
  -- Find bands with multiple Catalogs
  FOR band_record IN 
    SELECT band_id, COUNT(*) as catalog_count
    FROM public.setlists 
    WHERE is_catalog = true
    GROUP BY band_id
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Band % has % Catalogs - deduplicating...', 
      band_record.band_id, band_record.catalog_count;
    
    -- Find the canonical Catalog (most songs, then oldest)
    SELECT s.id INTO canonical_id
    FROM public.setlists s
    LEFT JOIN (
      SELECT setlist_id, COUNT(*) as song_count
      FROM public.setlist_songs
      GROUP BY setlist_id
    ) sc ON sc.setlist_id = s.id
    WHERE s.band_id = band_record.band_id AND s.is_catalog = true
    ORDER BY COALESCE(sc.song_count, 0) DESC, s.created_at ASC NULLS LAST, s.id ASC
    LIMIT 1;
    
    RAISE NOTICE '  Canonical Catalog: %', canonical_id;
    
    -- Process each duplicate
    FOR catalog_record IN 
      SELECT id FROM public.setlists
      WHERE band_id = band_record.band_id 
        AND is_catalog = true 
        AND id != canonical_id
    LOOP
      duplicate_id := catalog_record.id;
      merged_count := 0;
      
      -- Get current max position in canonical
      SELECT COALESCE(MAX(position), 0) INTO max_position
      FROM public.setlist_songs
      WHERE setlist_id = canonical_id;
      
      -- Merge songs from duplicate into canonical (skip existing)
      FOR song_record IN
        SELECT song_id, bpm, tuning, duration_seconds
        FROM public.setlist_songs
        WHERE setlist_id = duplicate_id
          AND song_id NOT IN (
            SELECT song_id FROM public.setlist_songs WHERE setlist_id = canonical_id
          )
      LOOP
        max_position := max_position + 1;
        INSERT INTO public.setlist_songs (setlist_id, song_id, position, bpm, tuning, duration_seconds)
        VALUES (canonical_id, song_record.song_id, max_position, 
                song_record.bpm, song_record.tuning, song_record.duration_seconds);
        merged_count := merged_count + 1;
      END LOOP;
      
      IF merged_count > 0 THEN
        RAISE NOTICE '  Merged % songs from % into canonical', merged_count, duplicate_id;
      END IF;
      
      -- Delete songs from duplicate
      DELETE FROM public.setlist_songs WHERE setlist_id = duplicate_id;
      
      -- Delete the duplicate setlist
      DELETE FROM public.setlists WHERE id = duplicate_id;
      
      deleted_count := deleted_count + 1;
      RAISE NOTICE '  Deleted duplicate Catalog: %', duplicate_id;
    END LOOP;
  END LOOP;
  
  IF deleted_count > 0 THEN
    RAISE NOTICE '=== Deduplication complete: Deleted % duplicate Catalogs ===', deleted_count;
  ELSE
    RAISE NOTICE '=== No duplicate Catalogs found ===';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: CREATE UNIQUE PARTIAL INDEX
-- Ensures only one is_catalog=true per band at the database level
-- ============================================================================
DROP INDEX IF EXISTS idx_unique_catalog_per_band;
DROP INDEX IF EXISTS idx_unique_all_songs_per_band;

CREATE UNIQUE INDEX idx_unique_catalog_per_band 
ON public.setlists(band_id) 
WHERE is_catalog = true;

-- ============================================================================
-- STEP 5: CREATE/UPDATE ensure_catalog_setlist RPC
-- This function:
--   1. Checks if user is a member of the band (RLS)
--   2. Finds existing Catalog for the band
--   3. If found, returns it
--   4. If not found, creates it and returns it
--   5. Handles deduplication if somehow multiple exist
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_catalog_setlist(p_band_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_catalog_id UUID;
  v_catalog_count INTEGER;
  v_canonical_id UUID;
  v_duplicate_id UUID;
  v_max_position INTEGER;
  v_rec RECORD;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Check band membership (RLS equivalent)
  IF NOT EXISTS (
    SELECT 1 FROM public.band_members 
    WHERE band_id = p_band_id 
      AND user_id = v_user_id 
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied: Not a member of this band';
  END IF;
  
  -- Count existing Catalogs for this band
  SELECT COUNT(*), MIN(id) INTO v_catalog_count, v_catalog_id
  FROM public.setlists 
  WHERE band_id = p_band_id AND is_catalog = true;
  
  -- Case 1: No Catalog exists - create one
  IF v_catalog_count = 0 THEN
    INSERT INTO public.setlists (band_id, name, is_catalog, total_duration, created_at, updated_at)
    VALUES (p_band_id, 'Catalog', true, 0, NOW(), NOW())
    RETURNING id INTO v_catalog_id;
    
    RETURN v_catalog_id;
  END IF;
  
  -- Case 2: Exactly one Catalog exists - return it
  IF v_catalog_count = 1 THEN
    -- Ensure it's named "Catalog"
    UPDATE public.setlists SET name = 'Catalog' WHERE id = v_catalog_id AND name != 'Catalog';
    RETURN v_catalog_id;
  END IF;
  
  -- Case 3: Multiple Catalogs exist - deduplicate and return canonical
  -- Find canonical (most songs, then oldest)
  SELECT s.id INTO v_canonical_id
  FROM public.setlists s
  LEFT JOIN (
    SELECT setlist_id, COUNT(*) as song_count
    FROM public.setlist_songs
    GROUP BY setlist_id
  ) sc ON sc.setlist_id = s.id
  WHERE s.band_id = p_band_id AND s.is_catalog = true
  ORDER BY COALESCE(sc.song_count, 0) DESC, s.created_at ASC NULLS LAST
  LIMIT 1;
  
  -- Merge and delete duplicates
  FOR v_rec IN 
    SELECT id FROM public.setlists 
    WHERE band_id = p_band_id AND is_catalog = true AND id != v_canonical_id
  LOOP
    v_duplicate_id := v_rec.id;
    
    -- Get max position in canonical
    SELECT COALESCE(MAX(position), 0) INTO v_max_position
    FROM public.setlist_songs WHERE setlist_id = v_canonical_id;
    
    -- Merge songs
    INSERT INTO public.setlist_songs (setlist_id, song_id, position, bpm, tuning, duration_seconds)
    SELECT v_canonical_id, song_id, v_max_position + ROW_NUMBER() OVER (ORDER BY position), 
           bpm, tuning, duration_seconds
    FROM public.setlist_songs
    WHERE setlist_id = v_duplicate_id
      AND song_id NOT IN (SELECT song_id FROM public.setlist_songs WHERE setlist_id = v_canonical_id);
    
    -- Delete duplicate's songs and setlist
    DELETE FROM public.setlist_songs WHERE setlist_id = v_duplicate_id;
    DELETE FROM public.setlists WHERE id = v_duplicate_id;
  END LOOP;
  
  -- Ensure canonical is named "Catalog"
  UPDATE public.setlists SET name = 'Catalog' WHERE id = v_canonical_id AND name != 'Catalog';
  
  RETURN v_canonical_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_catalog_setlist IS 
'Ensures a band has exactly one Catalog setlist. 
Deduplicates if multiple exist, creates if none exist.
Requires authenticated user who is a member of the band.
Returns the Catalog setlist ID.';

-- Grant to authenticated users (RLS check is inside function)
REVOKE ALL ON FUNCTION public.ensure_catalog_setlist(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_catalog_setlist(UUID) TO authenticated;

-- ============================================================================
-- STEP 6: CREATE CATALOG PROTECTION TRIGGERS
-- Prevent deletion, renaming, or duplicate creation of Catalogs
-- ============================================================================

-- Prevent deletion of Catalog setlists
CREATE OR REPLACE FUNCTION public.prevent_catalog_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_catalog = true THEN
    RAISE EXCEPTION 'Cannot delete Catalog setlist. It is the master song list for this band.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_catalog_deletion_trigger ON public.setlists;
CREATE TRIGGER prevent_catalog_deletion_trigger
  BEFORE DELETE ON public.setlists
  FOR EACH ROW EXECUTE FUNCTION public.prevent_catalog_deletion();

-- Prevent modifications to Catalog (renaming, un-cataloging)
CREATE OR REPLACE FUNCTION public.prevent_catalog_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent changing is_catalog from true to false
  IF OLD.is_catalog = true AND NEW.is_catalog = false THEN
    RAISE EXCEPTION 'Cannot remove Catalog status from a setlist.';
  END IF;
  
  -- Prevent renaming Catalog
  IF OLD.is_catalog = true AND NEW.name != 'Catalog' THEN
    RAISE EXCEPTION 'Cannot rename the Catalog setlist.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_catalog_modification_trigger ON public.setlists;
CREATE TRIGGER prevent_catalog_modification_trigger
  BEFORE UPDATE ON public.setlists
  FOR EACH ROW EXECUTE FUNCTION public.prevent_catalog_modification();

-- Prevent creating multiple Catalogs on INSERT
CREATE OR REPLACE FUNCTION public.prevent_duplicate_catalog_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_catalog = true THEN
    IF EXISTS (SELECT 1 FROM public.setlists WHERE band_id = NEW.band_id AND is_catalog = true) THEN
      -- Don't raise error - just set is_catalog to false for the duplicate
      NEW.is_catalog := false;
      NEW.name := NEW.name || ' (copy)';
      RAISE NOTICE 'Prevented duplicate Catalog creation for band %, set to regular setlist', NEW.band_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_duplicate_catalog_insert_trigger ON public.setlists;
CREATE TRIGGER prevent_duplicate_catalog_insert_trigger
  BEFORE INSERT ON public.setlists
  FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_catalog_insert();

-- ============================================================================
-- STEP 7: ENSURE ALL EXISTING BANDS HAVE A CATALOG
-- ============================================================================
DO $$
DECLARE
  band_record RECORD;
  created_count INTEGER := 0;
BEGIN
  FOR band_record IN 
    SELECT b.id, b.name
    FROM public.bands b
    WHERE NOT EXISTS (
      SELECT 1 FROM public.setlists s WHERE s.band_id = b.id AND s.is_catalog = true
    )
  LOOP
    INSERT INTO public.setlists (band_id, name, is_catalog, total_duration, created_at, updated_at)
    VALUES (band_record.id, 'Catalog', true, 0, NOW(), NOW());
    created_count := created_count + 1;
    RAISE NOTICE 'Created Catalog for band % (%)', band_record.id, band_record.name;
  END LOOP;
  
  IF created_count > 0 THEN
    RAISE NOTICE 'Created Catalogs for % bands', created_count;
  ELSE
    RAISE NOTICE 'All bands already have a Catalog';
  END IF;
END $$;

-- ============================================================================
-- STEP 8: UPDATE create_band RPC TO AUTO-CREATE CATALOG
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_band(
  p_name TEXT,
  p_avatar_color TEXT DEFAULT 'bg-rose-500',
  p_image_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_band_id UUID;
  v_catalog_id UUID;
BEGIN
  -- Require authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required. Please sign in.';
  END IF;

  -- Validate inputs
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Band name is required.';
  END IF;

  IF char_length(trim(p_name)) > 100 THEN
    RAISE EXCEPTION 'Band name must be 100 characters or less.';
  END IF;

  -- Create the band
  INSERT INTO public.bands (
    name,
    avatar_color,
    image_url,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    trim(p_name),
    COALESCE(p_avatar_color, 'bg-rose-500'),
    p_image_url,
    v_user_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_band_id;

  -- Add the creator as owner in band_members
  INSERT INTO public.band_members (
    band_id,
    user_id,
    role,
    status,
    joined_at,
    updated_at
  ) VALUES (
    v_band_id,
    v_user_id,
    'owner',
    NOW(),
    NOW()
  );

  -- Auto-create the Catalog setlist for this band
  INSERT INTO public.setlists (band_id, name, is_catalog, total_duration, created_at, updated_at)
  VALUES (v_band_id, 'Catalog', true, 0, NOW(), NOW())
  RETURNING id INTO v_catalog_id;

  RETURN v_band_id;
END;
$$;

COMMENT ON FUNCTION public.create_band IS 
'Creates a new band with owner membership and Catalog setlist. SECURITY DEFINER to bypass RLS.

Parameters:
  p_name - Required. Band name (max 100 chars)
  p_avatar_color - Optional. Tailwind color class (default: bg-rose-500)
  p_image_url - Optional. URL to band avatar image

Returns: UUID of the newly created band

Security: Requires authentication. Creator becomes band owner automatically.
The band''s Catalog setlist is created atomically with the band.';

-- ============================================================================
-- STEP 9: CLEANUP LEGACY FUNCTIONS AND COLUMNS
-- ============================================================================

-- Drop old functions that reference "All Songs"
DROP FUNCTION IF EXISTS public.create_all_songs_setlist(UUID);
DROP FUNCTION IF EXISTS public.create_catalog_setlist(UUID);
DROP FUNCTION IF EXISTS public.auto_add_to_all_songs();
DROP FUNCTION IF EXISTS public.prevent_all_songs_deletion();
DROP FUNCTION IF EXISTS public.prevent_all_songs_rename();

-- Drop old triggers
DROP TRIGGER IF EXISTS trigger_auto_add_to_all_songs ON public.setlist_songs;
DROP TRIGGER IF EXISTS prevent_all_songs_deletion_trigger ON public.setlists;
DROP TRIGGER IF EXISTS prevent_all_songs_rename_trigger ON public.setlists;

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================
-- 
-- Check no band has multiple Catalogs:
-- SELECT band_id, COUNT(*) FROM public.setlists WHERE is_catalog = true GROUP BY band_id HAVING COUNT(*) > 1;
-- (Should return 0 rows)
--
-- Check all bands have exactly one Catalog:
-- SELECT b.id, b.name, s.id as catalog_id 
-- FROM public.bands b
-- LEFT JOIN public.setlists s ON s.band_id = b.id AND s.is_catalog = true
-- WHERE s.id IS NULL;
-- (Should return 0 rows)
--
-- Check no "All Songs" setlists remain:
-- SELECT * FROM public.setlists WHERE LOWER(name) = 'all songs';
-- (Should return 0 rows)
--
-- Count total Catalogs:
-- SELECT COUNT(*) as catalog_count FROM public.setlists WHERE is_catalog = true;
-- (Should equal number of bands)
