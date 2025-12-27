-- ============================================================================
-- MIGRATION 054: Catalog Enforcement + Safe Delete RPC
-- 
-- This migration is IDEMPOTENT - safe to run multiple times.
--
-- Purpose:
-- 1. Create ensure_catalog_setlist RPC with deduplication
-- 2. Create delete_setlist RPC with proper permission checks
-- 3. Add unique partial index on Catalog per band
-- 4. Clean up existing duplicates
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
-- STEP 2: CREATE/UPDATE ensure_catalog_setlist RPC
-- This function:
--   1. Checks if user is a member of the band
--   2. Renames "All Songs" → "Catalog" 
--   3. Deduplicates if multiple exist (keeps oldest, merges songs, deletes rest)
--   4. Creates Catalog if none exists
--   5. Returns the Catalog setlist ID
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
  v_rec RECORD;
  v_max_position INTEGER;
  v_canonical_id UUID;
  v_duplicate_ids UUID[];
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Check band membership
  IF NOT EXISTS (
    SELECT 1 FROM public.band_members 
    WHERE band_id = p_band_id 
      AND user_id = v_user_id 
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied: Not a member of this band';
  END IF;

  -- ==== STEP A: Rename all "All Songs" to "Catalog" and mark is_catalog=true ====
  UPDATE public.setlists
  SET name = 'Catalog', is_catalog = true
  WHERE band_id = p_band_id 
    AND (LOWER(TRIM(name)) = 'all songs' OR LOWER(TRIM(name)) = 'catalog');

  -- ==== STEP B: Find all Catalogs for this band ====
  SELECT ARRAY_AGG(id ORDER BY created_at ASC) INTO v_duplicate_ids
  FROM public.setlists
  WHERE band_id = p_band_id AND is_catalog = true;

  -- ==== STEP C: Handle based on count ====
  IF v_duplicate_ids IS NULL OR ARRAY_LENGTH(v_duplicate_ids, 1) = 0 THEN
    -- No Catalog exists - create one
    INSERT INTO public.setlists (band_id, name, is_catalog, total_duration, created_by, created_at, updated_at)
    VALUES (p_band_id, 'Catalog', true, 0, v_user_id, NOW(), NOW())
    RETURNING id INTO v_catalog_id;
    
    RAISE NOTICE 'Created new Catalog % for band %', v_catalog_id, p_band_id;
    RETURN v_catalog_id;
  END IF;

  -- Get the canonical (oldest) Catalog
  v_canonical_id := v_duplicate_ids[1];

  IF ARRAY_LENGTH(v_duplicate_ids, 1) = 1 THEN
    -- Only one Catalog - just return it
    RETURN v_canonical_id;
  END IF;

  -- ==== STEP D: Merge songs from duplicates into canonical ====
  RAISE NOTICE 'Found % Catalogs for band % - merging into %', 
    ARRAY_LENGTH(v_duplicate_ids, 1), p_band_id, v_canonical_id;

  FOR i IN 2..ARRAY_LENGTH(v_duplicate_ids, 1) LOOP
    -- Get max position in canonical
    SELECT COALESCE(MAX(position), 0) INTO v_max_position
    FROM public.setlist_songs WHERE setlist_id = v_canonical_id;
    
    -- Merge songs that don't exist in canonical
    INSERT INTO public.setlist_songs (setlist_id, song_id, position, bpm, tuning, duration_seconds)
    SELECT v_canonical_id, ss.song_id, v_max_position + ROW_NUMBER() OVER (ORDER BY ss.position),
           ss.bpm, ss.tuning, ss.duration_seconds
    FROM public.setlist_songs ss
    WHERE ss.setlist_id = v_duplicate_ids[i]
      AND ss.song_id NOT IN (SELECT song_id FROM public.setlist_songs WHERE setlist_id = v_canonical_id);
    
    -- Delete songs from duplicate
    DELETE FROM public.setlist_songs WHERE setlist_id = v_duplicate_ids[i];
    
    -- Delete the duplicate setlist
    DELETE FROM public.setlists WHERE id = v_duplicate_ids[i];
    
    RAISE NOTICE 'Merged and deleted duplicate Catalog %', v_duplicate_ids[i];
  END LOOP;

  RETURN v_canonical_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_catalog_setlist IS 
'Ensures a band has exactly one Catalog setlist.
Renames "All Songs" to "Catalog", deduplicates if multiple exist, creates if none.
Requires authenticated user who is a member of the band.
Returns the Catalog setlist ID.';

REVOKE ALL ON FUNCTION public.ensure_catalog_setlist(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_catalog_setlist(UUID) TO authenticated;

-- ============================================================================
-- STEP 3: CREATE delete_setlist RPC
-- This function safely deletes a setlist with proper permission checks.
-- CANNOT delete Catalog. Handles dependent rows first.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_setlist(p_band_id UUID, p_setlist_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_setlist_name TEXT;
  v_setlist_creator UUID;
  v_is_catalog BOOLEAN;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Check band membership
  IF NOT EXISTS (
    SELECT 1 FROM public.band_members 
    WHERE band_id = p_band_id 
      AND user_id = v_user_id 
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied: Not a member of this band';
  END IF;

  -- Get setlist info
  SELECT name, created_by, is_catalog
  INTO v_setlist_name, v_setlist_creator, v_is_catalog
  FROM public.setlists
  WHERE id = p_setlist_id AND band_id = p_band_id;

  IF v_setlist_name IS NULL THEN
    RAISE EXCEPTION 'Setlist not found or does not belong to this band';
  END IF;

  -- Block deletion of Catalog (by is_catalog flag OR by name)
  IF v_is_catalog = true OR LOWER(TRIM(v_setlist_name)) IN ('catalog', 'all songs') THEN
    RAISE EXCEPTION 'Cannot delete the Catalog setlist';
  END IF;

  -- Permission check: must be admin OR creator
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.band_members
      WHERE band_id = p_band_id AND user_id = v_user_id AND role IN ('owner', 'admin')
    )
    OR v_setlist_creator = v_user_id
  ) THEN
    RAISE EXCEPTION 'Permission denied: Only admins or the creator can delete this setlist';
  END IF;

  -- ==== Delete dependent rows first ====
  
  -- 1. Delete setlist_songs
  DELETE FROM public.setlist_songs WHERE setlist_id = p_setlist_id;
  
  -- 2. Clear any rehearsals.setlist_id references (set to NULL)
  UPDATE public.rehearsals SET setlist_id = NULL WHERE setlist_id = p_setlist_id;
  
  -- 3. Clear any gigs.setlist_id references (set to NULL) if column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gigs' AND column_name = 'setlist_id'
  ) THEN
    UPDATE public.gigs SET setlist_id = NULL WHERE setlist_id = p_setlist_id;
  END IF;

  -- ==== Delete the setlist ====
  DELETE FROM public.setlists WHERE id = p_setlist_id AND band_id = p_band_id;

  RAISE NOTICE 'Deleted setlist % ("%") for band %', p_setlist_id, v_setlist_name, p_band_id;
END;
$$;

COMMENT ON FUNCTION public.delete_setlist IS 
'Safely deletes a setlist and all dependent rows.
Cannot delete Catalog. Requires authentication and band membership.
Only admins or the setlist creator can delete.';

REVOKE ALL ON FUNCTION public.delete_setlist(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_setlist(UUID, UUID) TO authenticated;

-- ============================================================================
-- STEP 4: CREATE UNIQUE PARTIAL INDEX FOR CATALOG
-- Ensures only one Catalog per band at the database level (by name, not flag)
-- ============================================================================
DROP INDEX IF EXISTS idx_unique_catalog_per_band;
DROP INDEX IF EXISTS idx_unique_catalog_name_per_band;

CREATE UNIQUE INDEX idx_unique_catalog_name_per_band 
ON public.setlists(band_id) 
WHERE LOWER(TRIM(name)) = 'catalog';

-- ============================================================================
-- STEP 5: CLEAN UP EXISTING DATA
-- Run ensure_catalog_setlist for all bands to fix duplicates
-- ============================================================================
DO $$
DECLARE
  band_record RECORD;
  v_catalog_id UUID;
BEGIN
  RAISE NOTICE '=== Cleaning up Catalog duplicates for all bands ===';
  
  FOR band_record IN 
    SELECT DISTINCT band_id FROM public.setlists 
    WHERE LOWER(TRIM(name)) IN ('catalog', 'all songs')
  LOOP
    -- Temporarily become a superuser context to bypass RLS
    -- Just do the cleanup directly here
    
    -- Rename All Songs to Catalog
    UPDATE public.setlists
    SET name = 'Catalog', is_catalog = true
    WHERE band_id = band_record.band_id 
      AND LOWER(TRIM(name)) IN ('all songs', 'catalog');
    
    -- Find duplicates and keep only the oldest
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY band_id ORDER BY created_at ASC) as rn
      FROM public.setlists
      WHERE band_id = band_record.band_id AND is_catalog = true
    ),
    canonical AS (
      SELECT id FROM ranked WHERE rn = 1
    ),
    duplicates AS (
      SELECT id FROM ranked WHERE rn > 1
    )
    -- First merge songs
    INSERT INTO public.setlist_songs (setlist_id, song_id, position, bpm, tuning, duration_seconds)
    SELECT 
      (SELECT id FROM canonical),
      ss.song_id,
      (SELECT COALESCE(MAX(position), 0) FROM public.setlist_songs WHERE setlist_id = (SELECT id FROM canonical)) 
        + ROW_NUMBER() OVER (ORDER BY ss.position),
      ss.bpm, ss.tuning, ss.duration_seconds
    FROM public.setlist_songs ss
    WHERE ss.setlist_id IN (SELECT id FROM duplicates)
      AND ss.song_id NOT IN (
        SELECT song_id FROM public.setlist_songs WHERE setlist_id = (SELECT id FROM canonical)
      );
    
    -- Delete songs from duplicates
    DELETE FROM public.setlist_songs 
    WHERE setlist_id IN (
      SELECT id FROM public.setlists 
      WHERE band_id = band_record.band_id AND is_catalog = true
      AND id != (
        SELECT id FROM public.setlists 
        WHERE band_id = band_record.band_id AND is_catalog = true
        ORDER BY created_at ASC LIMIT 1
      )
    );
    
    -- Delete duplicate setlists
    DELETE FROM public.setlists 
    WHERE band_id = band_record.band_id 
      AND is_catalog = true
      AND id != (
        SELECT id FROM public.setlists 
        WHERE band_id = band_record.band_id AND is_catalog = true
        ORDER BY created_at ASC LIMIT 1
      );
    
    RAISE NOTICE 'Cleaned up Catalogs for band %', band_record.band_id;
  END LOOP;
  
  RAISE NOTICE '=== Catalog cleanup complete ===';
END $$;

-- ============================================================================
-- STEP 6: ENSURE ALL BANDS HAVE A CATALOG
-- ============================================================================
DO $$
DECLARE
  band_record RECORD;
BEGIN
  FOR band_record IN 
    SELECT b.id, b.name
    FROM public.bands b
    WHERE NOT EXISTS (
      SELECT 1 FROM public.setlists s 
      WHERE s.band_id = b.id AND s.is_catalog = true
    )
  LOOP
    INSERT INTO public.setlists (band_id, name, is_catalog, total_duration, created_at, updated_at)
    VALUES (band_record.id, 'Catalog', true, 0, NOW(), NOW());
    RAISE NOTICE 'Created Catalog for band % (%)', band_record.id, band_record.name;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 7: CATALOG PROTECTION TRIGGERS
-- ============================================================================

-- Prevent deletion of Catalog setlists (backup protection)
CREATE OR REPLACE FUNCTION public.prevent_catalog_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_catalog = true OR LOWER(TRIM(OLD.name)) IN ('catalog', 'all songs') THEN
    RAISE EXCEPTION 'Cannot delete Catalog setlist. It is the master song list for this band.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_catalog_deletion_trigger ON public.setlists;
CREATE TRIGGER prevent_catalog_deletion_trigger
  BEFORE DELETE ON public.setlists
  FOR EACH ROW EXECUTE FUNCTION public.prevent_catalog_deletion();

-- Prevent renaming Catalog
CREATE OR REPLACE FUNCTION public.prevent_catalog_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent changing is_catalog from true to false
  IF OLD.is_catalog = true AND NEW.is_catalog = false THEN
    RAISE EXCEPTION 'Cannot remove Catalog status from a setlist.';
  END IF;
  
  -- Prevent renaming Catalog to something else
  IF OLD.is_catalog = true AND LOWER(TRIM(NEW.name)) != 'catalog' THEN
    RAISE EXCEPTION 'Cannot rename the Catalog setlist.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_catalog_modification_trigger ON public.setlists;
CREATE TRIGGER prevent_catalog_modification_trigger
  BEFORE UPDATE ON public.setlists
  FOR EACH ROW EXECUTE FUNCTION public.prevent_catalog_modification();

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================
-- 
-- Check no band has multiple Catalogs:
-- SELECT band_id, COUNT(*) FROM public.setlists WHERE is_catalog = true GROUP BY band_id HAVING COUNT(*) > 1;
-- (Should return 0 rows)
--
-- Check all bands have exactly one Catalog:
-- SELECT b.id, b.name FROM public.bands b
-- WHERE NOT EXISTS (SELECT 1 FROM public.setlists s WHERE s.band_id = b.id AND s.is_catalog = true);
-- (Should return 0 rows)
--
-- Check no "All Songs" setlists remain:
-- SELECT * FROM public.setlists WHERE LOWER(TRIM(name)) = 'all songs';
-- (Should return 0 rows)
--
-- Test delete_setlist RPC:
-- SELECT public.delete_setlist('band-uuid', 'setlist-uuid');
