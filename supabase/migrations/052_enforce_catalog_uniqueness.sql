-- ============================================================================
-- MIGRATION 032: Enforce Catalog uniqueness with is_catalog boolean
-- 
-- Purpose: Replace setlist_type with is_catalog boolean for cleaner logic
-- and ensure exactly one Catalog per band (no duplicates).
--
-- This migration:
-- 1. Adds is_catalog boolean column
-- 2. Renames "All Songs" to "Catalog" 
-- 3. Merges duplicate Catalogs (keeps oldest, moves songs, deletes extras)
-- 4. Creates unique partial index on is_catalog=true
-- 5. Updates create_band RPC to auto-create Catalog
-- 6. Cleans up old setlist_type column and functions
--
-- Safe to re-run (idempotent)
-- ============================================================================

-- ============================================================================
-- STEP 1: ADD is_catalog COLUMN
-- ============================================================================
ALTER TABLE public.setlists 
ADD COLUMN IF NOT EXISTS is_catalog BOOLEAN NOT NULL DEFAULT false;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_setlists_is_catalog 
ON public.setlists(band_id, is_catalog) 
WHERE is_catalog = true;

-- ============================================================================
-- STEP 2: MIGRATE EXISTING DATA
-- Mark all "All Songs" or setlist_type='all_songs'/'catalog' as is_catalog=true
-- Also rename to "Catalog"
-- ============================================================================
UPDATE public.setlists
SET is_catalog = true, name = 'Catalog'
WHERE (
  LOWER(name) = 'all songs' 
  OR LOWER(name) = 'catalog'
  OR setlist_type = 'all_songs'
  OR setlist_type = 'catalog'
);

-- ============================================================================
-- STEP 3: MERGE DUPLICATE CATALOGS
-- For each band with multiple is_catalog=true, keep the oldest and merge songs
-- ============================================================================
DO $$
DECLARE
  band_record RECORD;
  catalog_record RECORD;
  canonical_catalog_id UUID;
  duplicate_catalog_id UUID;
  max_position INTEGER;
  song_record RECORD;
BEGIN
  -- Find bands with multiple Catalogs
  FOR band_record IN 
    SELECT band_id, COUNT(*) as catalog_count
    FROM public.setlists 
    WHERE is_catalog = true
    GROUP BY band_id
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Band % has % Catalogs - merging...', band_record.band_id, band_record.catalog_count;
    
    -- Get the canonical Catalog (oldest by created_at, or lowest id as tiebreaker)
    SELECT id INTO canonical_catalog_id
    FROM public.setlists
    WHERE band_id = band_record.band_id AND is_catalog = true
    ORDER BY created_at ASC NULLS LAST, id ASC
    LIMIT 1;
    
    -- Process each duplicate Catalog
    FOR catalog_record IN 
      SELECT id FROM public.setlists
      WHERE band_id = band_record.band_id 
        AND is_catalog = true 
        AND id != canonical_catalog_id
    LOOP
      duplicate_catalog_id := catalog_record.id;
      
      -- Get current max position in canonical Catalog
      SELECT COALESCE(MAX(position), 0) INTO max_position
      FROM public.setlist_songs
      WHERE setlist_id = canonical_catalog_id;
      
      -- Move songs from duplicate to canonical (skip if already exists)
      FOR song_record IN
        SELECT song_id, bpm, tuning, duration_seconds
        FROM public.setlist_songs
        WHERE setlist_id = duplicate_catalog_id
          AND song_id NOT IN (
            SELECT song_id FROM public.setlist_songs WHERE setlist_id = canonical_catalog_id
          )
      LOOP
        max_position := max_position + 1;
        INSERT INTO public.setlist_songs (setlist_id, song_id, position, bpm, tuning, duration_seconds)
        VALUES (canonical_catalog_id, song_record.song_id, max_position, 
                song_record.bpm, song_record.tuning, song_record.duration_seconds);
      END LOOP;
      
      -- Delete songs from duplicate Catalog
      DELETE FROM public.setlist_songs WHERE setlist_id = duplicate_catalog_id;
      
      -- Delete the duplicate Catalog (temporarily disable trigger)
      DELETE FROM public.setlists WHERE id = duplicate_catalog_id;
      
      RAISE NOTICE 'Merged and deleted duplicate Catalog %', duplicate_catalog_id;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 4: CREATE UNIQUE PARTIAL INDEX
-- Ensures only one is_catalog=true per band
-- ============================================================================
DROP INDEX IF EXISTS idx_unique_catalog_per_band;
DROP INDEX IF EXISTS idx_unique_all_songs_per_band;
CREATE UNIQUE INDEX idx_unique_catalog_per_band 
ON public.setlists(band_id) 
WHERE is_catalog = true;

-- ============================================================================
-- STEP 5: CREATE/UPDATE CATALOG HELPER FUNCTIONS
-- ============================================================================

-- Function to ensure a band has exactly one Catalog setlist
CREATE OR REPLACE FUNCTION public.ensure_catalog_setlist(p_band_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_catalog_id UUID;
BEGIN
  -- Check if Catalog already exists for this band
  SELECT id INTO v_catalog_id 
  FROM public.setlists 
  WHERE band_id = p_band_id AND is_catalog = true
  LIMIT 1;
  
  IF v_catalog_id IS NOT NULL THEN
    RETURN v_catalog_id;
  END IF;
  
  -- Create the Catalog setlist
  INSERT INTO public.setlists (band_id, name, is_catalog, total_duration, created_at, updated_at)
  VALUES (p_band_id, 'Catalog', true, 0, NOW(), NOW())
  RETURNING id INTO v_catalog_id;
  
  RETURN v_catalog_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_catalog_setlist IS 
'Ensures a band has exactly one Catalog setlist. Returns existing or creates new.';

-- Grant execute to authenticated users
REVOKE ALL ON FUNCTION public.ensure_catalog_setlist(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_catalog_setlist(UUID) TO authenticated;

-- ============================================================================
-- STEP 6: UPDATE CREATE_BAND RPC TO AUTO-CREATE CATALOG
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
    'active',
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
-- STEP 7: UPDATE TRIGGERS FOR CATALOG PROTECTION
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

-- Prevent renaming or un-cataloging the Catalog
CREATE OR REPLACE FUNCTION public.prevent_catalog_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent changing is_catalog from true to false
  IF OLD.is_catalog = true AND NEW.is_catalog = false THEN
    RAISE EXCEPTION 'Cannot remove Catalog status from a setlist.';
  END IF;
  
  -- Prevent renaming Catalog to something else
  IF OLD.is_catalog = true AND NEW.name != 'Catalog' THEN
    RAISE EXCEPTION 'Cannot rename the Catalog setlist.';
  END IF;
  
  -- Prevent creating a second Catalog
  IF OLD.is_catalog = false AND NEW.is_catalog = true THEN
    IF EXISTS (SELECT 1 FROM public.setlists WHERE band_id = NEW.band_id AND is_catalog = true AND id != NEW.id) THEN
      RAISE EXCEPTION 'A Catalog setlist already exists for this band.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_catalog_modification_trigger ON public.setlists;
DROP TRIGGER IF EXISTS prevent_catalog_rename_trigger ON public.setlists;
CREATE TRIGGER prevent_catalog_modification_trigger
  BEFORE UPDATE ON public.setlists
  FOR EACH ROW EXECUTE FUNCTION public.prevent_catalog_modification();

-- Prevent creating multiple Catalogs on INSERT
CREATE OR REPLACE FUNCTION public.prevent_duplicate_catalog_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_catalog = true THEN
    IF EXISTS (SELECT 1 FROM public.setlists WHERE band_id = NEW.band_id AND is_catalog = true) THEN
      RAISE EXCEPTION 'A Catalog setlist already exists for this band. Cannot create another.';
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
-- STEP 8: AUTO-ADD SONGS TO CATALOG WHEN ADDED TO OTHER SETLISTS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_add_to_catalog()
RETURNS TRIGGER AS $$
DECLARE
  v_band_id UUID;
  v_catalog_id UUID;
  v_max_position INTEGER;
BEGIN
  -- Get the band_id for this setlist
  SELECT band_id, is_catalog INTO v_band_id, v_catalog_id
  FROM public.setlists 
  WHERE id = NEW.setlist_id;
  
  -- Skip if this IS the Catalog setlist
  IF v_catalog_id IS NOT NULL THEN
    SELECT id INTO v_catalog_id FROM public.setlists WHERE id = NEW.setlist_id AND is_catalog = true;
    IF v_catalog_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;
  
  -- Get the Catalog for this band
  SELECT id INTO v_catalog_id 
  FROM public.setlists 
  WHERE band_id = v_band_id AND is_catalog = true;
  
  -- If no Catalog exists, skip (shouldn't happen after migration)
  IF v_catalog_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if song already exists in Catalog
  IF NOT EXISTS (SELECT 1 FROM public.setlist_songs WHERE setlist_id = v_catalog_id AND song_id = NEW.song_id) THEN
    -- Get the next position
    SELECT COALESCE(MAX(position), 0) + 1 INTO v_max_position
    FROM public.setlist_songs 
    WHERE setlist_id = v_catalog_id;
    
    -- Add the song to Catalog
    INSERT INTO public.setlist_songs (setlist_id, song_id, position, duration_seconds, bpm, tuning)
    VALUES (v_catalog_id, NEW.song_id, v_max_position, NEW.duration_seconds, NEW.bpm, NEW.tuning);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_add_to_catalog ON public.setlist_songs;
DROP TRIGGER IF EXISTS trigger_auto_add_to_all_songs ON public.setlist_songs;
CREATE TRIGGER trigger_auto_add_to_catalog
  AFTER INSERT ON public.setlist_songs
  FOR EACH ROW EXECUTE FUNCTION public.auto_add_to_catalog();

-- ============================================================================
-- STEP 9: ENSURE ALL EXISTING BANDS HAVE A CATALOG
-- ============================================================================
DO $$
DECLARE
  band_record RECORD;
BEGIN
  FOR band_record IN 
    SELECT b.id 
    FROM public.bands b
    WHERE NOT EXISTS (
      SELECT 1 FROM public.setlists s WHERE s.band_id = b.id AND s.is_catalog = true
    )
  LOOP
    INSERT INTO public.setlists (band_id, name, is_catalog, total_duration, created_at, updated_at)
    VALUES (band_record.id, 'Catalog', true, 0, NOW(), NOW());
    RAISE NOTICE 'Created Catalog for band %', band_record.id;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 10: CLEANUP OLD setlist_type COLUMN (optional - keep for now for safety)
-- ============================================================================
-- We'll leave setlist_type in place for now to allow rollback if needed.
-- It can be dropped in a future migration after confirming is_catalog works.

-- Update setlist_type to match is_catalog for consistency
UPDATE public.setlists SET setlist_type = 'catalog' WHERE is_catalog = true;
UPDATE public.setlists SET setlist_type = 'regular' WHERE is_catalog = false;

-- Drop old functions that used setlist_type
DROP FUNCTION IF EXISTS public.create_catalog_setlist(UUID);
DROP FUNCTION IF EXISTS public.create_all_songs_setlist(UUID);

-- ============================================================================
-- VERIFICATION QUERIES (run these after migration)
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
