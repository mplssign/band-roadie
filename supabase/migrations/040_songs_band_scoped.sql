-- ============================================================================
-- BANDROADIE: BAND-SCOPED SONGS MIGRATION
-- 
-- Makes songs band-private with zero cross-band leakage.
-- Run in Supabase SQL Editor as service_role.
-- ============================================================================

-- ============================================================================
-- STEP 1: SCHEMA CHANGES - Add band_id to songs
-- ============================================================================

-- Add band_id column (nullable initially for migration)
ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS band_id UUID;

-- Add foreign key constraint
ALTER TABLE songs
DROP CONSTRAINT IF EXISTS songs_band_id_fkey;

ALTER TABLE songs
ADD CONSTRAINT songs_band_id_fkey 
FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_songs_band_id ON songs(band_id);

-- ============================================================================
-- STEP 2: DATA MIGRATION
-- Choose ONE option below. Option A recommended for early-stage dev.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- OPTION A: TRUNCATE (Recommended for early dev - no real user data yet)
-- Uncomment this block if safe to delete all song data.
-- ----------------------------------------------------------------------------

/*
-- WARNING: This deletes ALL song-related data permanently!
TRUNCATE TABLE song_notes CASCADE;
TRUNCATE TABLE setlist_songs CASCADE;
TRUNCATE TABLE songs CASCADE;

-- Now safe to enforce NOT NULL
ALTER TABLE songs ALTER COLUMN band_id SET NOT NULL;

RAISE NOTICE '✅ Option A complete: Truncated song tables and enforced NOT NULL';
*/

-- ----------------------------------------------------------------------------
-- OPTION B: CLONE & REWIRE (Preserve existing data)
-- IDEMPOTENT: Safe to run multiple times.
-- Use this if you have real user data to preserve.
-- Uncomment this block to run.
-- ----------------------------------------------------------------------------

/*
BEGIN;

-- ============================================================
-- Step B.1: Create mapping table to track cloned songs
-- This table persists across runs to make migration idempotent.
-- ============================================================
CREATE TABLE IF NOT EXISTS song_clone_map (
  old_song_id UUID NOT NULL,        -- Original global song
  band_id UUID NOT NULL,            -- Target band
  new_song_id UUID NOT NULL,        -- Cloned band-specific song
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (old_song_id, band_id)
);

-- ============================================================
-- Step B.2: Clone songs for each band that references them
-- Uses ON CONFLICT to skip already-cloned combinations.
-- ============================================================
DO $$
DECLARE
  legacy_song RECORD;
  band_rec RECORD;
  new_id UUID;
  clone_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting idempotent song cloning...';
  
  -- Find all songs without band_id that are referenced by setlists
  FOR legacy_song IN 
    SELECT DISTINCT s.* 
    FROM songs s
    WHERE s.band_id IS NULL
      AND EXISTS (SELECT 1 FROM setlist_songs WHERE song_id = s.id)
  LOOP
    -- Find all bands that reference this song via setlists
    FOR band_rec IN
      SELECT DISTINCT sl.band_id
      FROM setlist_songs ss_inner
      JOIN setlists sl ON sl.id = ss_inner.setlist_id
      WHERE ss_inner.song_id = legacy_song.id
    LOOP
      -- Skip if we already cloned this song for this band
      IF EXISTS (
        SELECT 1 FROM song_clone_map 
        WHERE old_song_id = legacy_song.id AND band_id = band_rec.band_id
      ) THEN
        CONTINUE;
      END IF;
      
      -- Generate new ID for the cloned song
      new_id := gen_random_uuid();
      
      -- Create a band-specific copy of the song
      INSERT INTO songs (id, title, artist, bpm, tuning, duration_seconds, key_signature, tempo, notes, band_id)
      VALUES (
        new_id,
        legacy_song.title,
        legacy_song.artist,
        legacy_song.bpm,
        legacy_song.tuning,
        legacy_song.duration_seconds,
        legacy_song.key_signature,
        legacy_song.tempo,
        legacy_song.notes,
        band_rec.band_id
      );
      
      -- Record the mapping (ON CONFLICT for extra safety)
      INSERT INTO song_clone_map (old_song_id, band_id, new_song_id)
      VALUES (legacy_song.id, band_rec.band_id, new_id)
      ON CONFLICT (old_song_id, band_id) DO NOTHING;
      
      clone_count := clone_count + 1;
      RAISE NOTICE 'Cloned song "%" (%) for band %', legacy_song.title, legacy_song.id, band_rec.band_id;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Cloned % song(s) total.', clone_count;
END $$;

-- ============================================================
-- Step B.3: Rewire setlist_songs to point to cloned songs
-- Only updates rows that still point to old (global) songs.
-- ============================================================
UPDATE setlist_songs ss
SET song_id = m.new_song_id
FROM (
  -- Subquery: find setlist_songs that need rewiring
  SELECT 
    ss2.id AS setlist_song_id,
    ss2.song_id AS current_song_id,
    sl.band_id AS setlist_band_id
  FROM setlist_songs ss2
  JOIN setlists sl ON sl.id = ss2.setlist_id
  -- Only rows pointing to global songs (NULL band_id)
  JOIN songs s ON s.id = ss2.song_id AND s.band_id IS NULL
) x
JOIN song_clone_map m 
  ON m.old_song_id = x.current_song_id
  AND m.band_id = x.setlist_band_id
WHERE ss.id = x.setlist_song_id
  -- Only update if song_id differs (idempotent)
  AND ss.song_id <> m.new_song_id;

-- ============================================================
-- Step B.4: Rewire song_notes to point to cloned songs
-- Only updates rows that still point to old (global) songs.
-- ============================================================
UPDATE song_notes sn
SET song_id = m.new_song_id
FROM (
  -- Subquery: find song_notes that need rewiring
  SELECT 
    sn2.id AS note_id,
    sn2.song_id AS current_song_id,
    sn2.band_id AS note_band_id
  FROM song_notes sn2
  -- Only rows pointing to global songs (NULL band_id)
  JOIN songs s ON s.id = sn2.song_id AND s.band_id IS NULL
) y
JOIN song_clone_map m
  ON m.old_song_id = y.current_song_id
  AND m.band_id = y.note_band_id
WHERE sn.id = y.note_id
  -- Only update if song_id differs (idempotent)
  AND sn.song_id <> m.new_song_id;

-- ============================================================
-- Step B.5: Delete orphaned global songs
-- Only deletes songs with NULL band_id that are no longer
-- referenced by ANY setlist_songs or song_notes.
-- ============================================================
DELETE FROM songs s
WHERE s.band_id IS NULL 
  -- Not referenced by any setlist_song
  AND NOT EXISTS (
    SELECT 1 FROM setlist_songs ss WHERE ss.song_id = s.id
  )
  -- Not referenced by any song_note
  AND NOT EXISTS (
    SELECT 1 FROM song_notes sn WHERE sn.song_id = s.id
  );

-- ============================================================
-- Step B.6: Verify no NULL band_id songs remain
-- ============================================================
DO $$
DECLARE
  remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining FROM songs WHERE band_id IS NULL;
  
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Migration incomplete: % songs still have NULL band_id. Check song_clone_map for details.', remaining;
  END IF;
  
  RAISE NOTICE '✅ All songs now have band_id assigned.';
END $$;

-- ============================================================
-- Step B.7: Enforce NOT NULL constraint
-- ============================================================
ALTER TABLE songs ALTER COLUMN band_id SET NOT NULL;

-- ============================================================
-- Step B.8: Optionally clean up mapping table
-- Uncomment if you want to remove the tracking table after success.
-- ============================================================
-- DROP TABLE IF EXISTS song_clone_map;

COMMIT;

RAISE NOTICE '✅ Option B complete: Cloned songs per-band and enforced NOT NULL';
*/

-- ----------------------------------------------------------------------------
-- FOR DEVELOPMENT: Quick enforcement (if songs table is empty or all have band_id)
-- ----------------------------------------------------------------------------

-- Check current state
DO $$
DECLARE
  null_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM songs;
  SELECT COUNT(*) INTO null_count FROM songs WHERE band_id IS NULL;
  
  IF total_count = 0 THEN
    RAISE NOTICE 'Songs table is empty - safe to enforce NOT NULL';
    ALTER TABLE songs ALTER COLUMN band_id SET NOT NULL;
  ELSIF null_count = 0 THEN
    RAISE NOTICE 'All songs have band_id - safe to enforce NOT NULL';
    ALTER TABLE songs ALTER COLUMN band_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'Found % songs with NULL band_id out of % total. Choose Option A or B above.', null_count, total_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: INTEGRITY TRIGGERS - Prevent cross-band linking
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Trigger: setlist_songs must reference song with matching band_id
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_setlist_song_band_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  setlist_band_id UUID;
  song_band_id UUID;
BEGIN
  -- Get the band_id of the setlist
  SELECT band_id INTO setlist_band_id
  FROM setlists
  WHERE id = NEW.setlist_id;
  
  IF setlist_band_id IS NULL THEN
    RAISE EXCEPTION 'Setlist % not found', NEW.setlist_id;
  END IF;
  
  -- Get the band_id of the song
  SELECT band_id INTO song_band_id
  FROM songs
  WHERE id = NEW.song_id;
  
  IF song_band_id IS NULL THEN
    RAISE EXCEPTION 'Song % not found or has no band_id', NEW.song_id;
  END IF;
  
  -- Enforce match
  IF setlist_band_id <> song_band_id THEN
    RAISE EXCEPTION 'Cross-band violation: Song (band %) cannot be added to setlist (band %)', 
      song_band_id, setlist_band_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_setlist_songs_band_match ON setlist_songs;
CREATE TRIGGER trg_setlist_songs_band_match
  BEFORE INSERT OR UPDATE ON setlist_songs
  FOR EACH ROW
  EXECUTE FUNCTION enforce_setlist_song_band_match();

-- ----------------------------------------------------------------------------
-- Trigger: song_notes.band_id must match songs.band_id
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_song_notes_band_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  song_band_id UUID;
BEGIN
  -- Get the band_id of the song
  SELECT band_id INTO song_band_id
  FROM songs
  WHERE id = NEW.song_id;
  
  IF song_band_id IS NULL THEN
    RAISE EXCEPTION 'Song % not found or has no band_id', NEW.song_id;
  END IF;
  
  -- Enforce match
  IF NEW.band_id <> song_band_id THEN
    RAISE EXCEPTION 'Cross-band violation: Note band_id (%) must match song band_id (%)', 
      NEW.band_id, song_band_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_song_notes_band_match ON song_notes;
CREATE TRIGGER trg_song_notes_band_match
  BEFORE INSERT OR UPDATE ON song_notes
  FOR EACH ROW
  EXECUTE FUNCTION enforce_song_notes_band_match();

-- ============================================================================
-- STEP 4: RLS FOR SONGS
-- ============================================================================

-- Enable RLS
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs FORCE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$ 
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'songs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON songs', pol.policyname);
  END LOOP;
END $$;

-- SELECT: Must be active band member
CREATE POLICY "songs: select if member" ON songs
  FOR SELECT TO authenticated
  USING (public.is_band_member(band_id));

-- INSERT: Must be active band member, band_id required
CREATE POLICY "songs: insert if member" ON songs
  FOR INSERT TO authenticated
  WITH CHECK (
    band_id IS NOT NULL
    AND public.is_band_member(band_id)
  );

-- UPDATE: Must be band admin (songs has no created_by)
CREATE POLICY "songs: update if admin" ON songs
  FOR UPDATE TO authenticated
  USING (public.is_band_admin(band_id))
  WITH CHECK (public.is_band_admin(band_id));

-- DELETE: Must be band admin
CREATE POLICY "songs: delete if admin" ON songs
  FOR DELETE TO authenticated
  USING (public.is_band_admin(band_id));

-- ============================================================================
-- STEP 5: RLS HARDENING FOR SETLIST_SONGS
-- ============================================================================

-- Enable RLS
ALTER TABLE setlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlist_songs FORCE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$ 
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'setlist_songs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON setlist_songs', pol.policyname);
  END LOOP;
END $$;

-- Helper: Get band_id for a setlist (avoids recursion)
CREATE OR REPLACE FUNCTION get_setlist_band_id(setlist_uuid UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT band_id FROM setlists WHERE id = setlist_uuid;
$$;

-- Helper: Get band_id for a song (avoids recursion)
CREATE OR REPLACE FUNCTION get_song_band_id(song_uuid UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT band_id FROM songs WHERE id = song_uuid;
$$;

-- SELECT: User is member of setlist's band AND song's band matches setlist's band
CREATE POLICY "setlist_songs: select if member and bands match" ON setlist_songs
  FOR SELECT TO authenticated
  USING (
    -- User must be member of the setlist's band
    public.is_band_member(get_setlist_band_id(setlist_id))
    -- Song's band must match setlist's band
    AND get_setlist_band_id(setlist_id) = get_song_band_id(song_id)
  );

-- INSERT: Same checks
CREATE POLICY "setlist_songs: insert if member and bands match" ON setlist_songs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_band_member(get_setlist_band_id(setlist_id))
    AND get_setlist_band_id(setlist_id) = get_song_band_id(song_id)
  );

-- UPDATE: Same checks (position changes, etc.)
CREATE POLICY "setlist_songs: update if member and bands match" ON setlist_songs
  FOR UPDATE TO authenticated
  USING (
    public.is_band_member(get_setlist_band_id(setlist_id))
    AND get_setlist_band_id(setlist_id) = get_song_band_id(song_id)
  )
  WITH CHECK (
    public.is_band_member(get_setlist_band_id(setlist_id))
    AND get_setlist_band_id(setlist_id) = get_song_band_id(song_id)
  );

-- DELETE: Member can remove songs from setlist
CREATE POLICY "setlist_songs: delete if member and bands match" ON setlist_songs
  FOR DELETE TO authenticated
  USING (
    public.is_band_member(get_setlist_band_id(setlist_id))
    AND get_setlist_band_id(setlist_id) = get_song_band_id(song_id)
  );

-- ============================================================================
-- STEP 6: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON songs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON setlist_songs TO authenticated;
GRANT EXECUTE ON FUNCTION get_setlist_band_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_song_band_id(UUID) TO authenticated;

-- ============================================================================
-- STEP 7: VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify RLS enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'songs' AND n.nspname = 'public' AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS not enabled on songs table';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'setlist_songs' AND n.nspname = 'public' AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS not enabled on setlist_songs table';
  END IF;
  
  -- Verify triggers exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_setlist_songs_band_match'
  ) THEN
    RAISE EXCEPTION 'Trigger trg_setlist_songs_band_match not found';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_song_notes_band_match'
  ) THEN
    RAISE EXCEPTION 'Trigger trg_song_notes_band_match not found';
  END IF;
  
  RAISE NOTICE '✅ Band-scoped songs migration complete!';
  RAISE NOTICE '   - songs.band_id column added with FK to bands';
  RAISE NOTICE '   - Cross-band triggers active on setlist_songs and song_notes';
  RAISE NOTICE '   - RLS policies active on songs and setlist_songs';
END $$;

-- Show summary
SELECT 
  'songs' as table_name,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'songs') as policy_count,
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'songs') as rls_enabled
UNION ALL
SELECT 
  'setlist_songs',
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'setlist_songs'),
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'setlist_songs');
