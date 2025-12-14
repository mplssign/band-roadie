-- ============================================================================
-- BANDROADIE: BAND-SCOPED SONGS SCHEMA
-- 
-- Makes songs band-private with proper constraints and RLS.
-- Run in Supabase SQL Editor as service_role.
-- ============================================================================

-- ============================================================================
-- STEP 1: ADD band_id COLUMN TO SONGS
-- ============================================================================

-- Add band_id column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'songs' 
    AND column_name = 'band_id'
  ) THEN
    ALTER TABLE songs ADD COLUMN band_id UUID;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: TRUNCATE FOR FRESH START (early dev - no real data)
-- Remove this section if you have data to preserve!
-- ============================================================================

-- Clear dependent tables first
TRUNCATE TABLE song_notes CASCADE;
TRUNCATE TABLE setlist_songs CASCADE;
TRUNCATE TABLE songs CASCADE;

-- ============================================================================
-- STEP 3: ENFORCE NOT NULL AND ADD FOREIGN KEY
-- ============================================================================

-- Now safe to set NOT NULL
ALTER TABLE songs ALTER COLUMN band_id SET NOT NULL;

-- Drop existing FK if present, then add
ALTER TABLE songs DROP CONSTRAINT IF EXISTS songs_band_id_fkey;

ALTER TABLE songs
ADD CONSTRAINT songs_band_id_fkey 
FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 4: ADD INDEXES
-- ============================================================================

-- Index for band_id lookups
CREATE INDEX IF NOT EXISTS idx_songs_band_id ON songs(band_id);

-- Composite index for search within a band
CREATE INDEX IF NOT EXISTS idx_songs_band_title ON songs(band_id, title);

-- ============================================================================
-- STEP 5: ADD UNIQUE CONSTRAINT (no duplicates per band)
-- ============================================================================

-- Drop if exists (for reruns)
ALTER TABLE songs DROP CONSTRAINT IF EXISTS songs_unique_per_band;

-- Unique constraint: same title+artist within a band is a duplicate
-- Using expression index approach for case-insensitive matching
CREATE UNIQUE INDEX IF NOT EXISTS songs_unique_per_band_idx 
ON songs (band_id, LOWER(title), LOWER(COALESCE(artist, '')));

-- ============================================================================
-- STEP 6: VERIFY FOREIGN KEYS ON DEPENDENT TABLES
-- ============================================================================

-- setlist_songs.song_id -> songs.id (should already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'setlist_songs_song_id_fkey'
    AND table_name = 'setlist_songs'
  ) THEN
    ALTER TABLE setlist_songs
    ADD CONSTRAINT setlist_songs_song_id_fkey 
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- song_notes.song_id -> songs.id (should already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'song_notes_song_id_fkey'
    AND table_name = 'song_notes'
  ) THEN
    ALTER TABLE song_notes
    ADD CONSTRAINT song_notes_song_id_fkey 
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- STEP 7: ENABLE RLS ON SONGS
-- ============================================================================

ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 8: DROP EXISTING POLICIES ON SONGS
-- ============================================================================

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

-- ============================================================================
-- STEP 9: CREATE RLS POLICIES FOR SONGS
-- Uses is_band_member() helper to avoid recursion
-- ============================================================================

-- SELECT: Must be active band member
CREATE POLICY "songs: select if member" ON songs
  FOR SELECT TO authenticated
  USING (public.is_band_member(band_id));

-- INSERT: Must be active band member, auth.uid() must exist
CREATE POLICY "songs: insert if member" ON songs
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_band_member(band_id)
  );

-- UPDATE: Must be active band member
CREATE POLICY "songs: update if member" ON songs
  FOR UPDATE TO authenticated
  USING (public.is_band_member(band_id))
  WITH CHECK (public.is_band_member(band_id));

-- DELETE: Must be active band member
CREATE POLICY "songs: delete if member" ON songs
  FOR DELETE TO authenticated
  USING (public.is_band_member(band_id));

-- ============================================================================
-- STEP 10: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON songs TO authenticated;

-- ============================================================================
-- STEP 11: VERIFICATION
-- ============================================================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  -- Verify RLS enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'songs' AND n.nspname = 'public' 
    AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS not enabled on songs table';
  END IF;
  
  -- Verify policies exist
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public' AND tablename = 'songs';
  
  IF policy_count < 4 THEN
    RAISE EXCEPTION 'Expected 4 policies on songs, found %', policy_count;
  END IF;
  
  -- Verify band_id is NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'songs' 
    AND column_name = 'band_id'
    AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'songs.band_id should be NOT NULL';
  END IF;
  
  RAISE NOTICE '✅ Songs band-scoping complete!';
  RAISE NOTICE '   - band_id NOT NULL with FK to bands';
  RAISE NOTICE '   - Indexes on band_id and (band_id, title)';
  RAISE NOTICE '   - Unique constraint on (band_id, title, artist)';
  RAISE NOTICE '   - RLS policies active (4 total)';
END $$;

-- Show summary
SELECT 
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'songs') AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'songs' AND n.nspname = 'public';
