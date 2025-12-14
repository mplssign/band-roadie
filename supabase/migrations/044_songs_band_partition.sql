-- ============================================================================
-- BANDROADIE: BULLETPROOF BAND PARTITIONING FOR SONGS
-- 
-- Migrates songs to be band-private. Handles multi-band shared songs by
-- cloning them so each band owns its own copy.
-- 
-- Safe to run once. Idempotent where possible.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: ADD band_id COLUMN IF NOT EXISTS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'songs' 
      AND column_name = 'band_id'
  ) THEN
    ALTER TABLE public.songs ADD COLUMN band_id UUID REFERENCES public.bands(id);
    RAISE NOTICE '[1] ✅ Added band_id column to songs';
  ELSE
    RAISE NOTICE '[1] ⏭️  band_id column already exists';
  END IF;
END $$;

-- ============================================================================
-- SECTION 2: CREATE INDEXES (IDEMPOTENT)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_songs_band_id ON public.songs(band_id);
CREATE INDEX IF NOT EXISTS idx_songs_band_id_id ON public.songs(band_id, id);

DO $$ BEGIN RAISE NOTICE '[2] ✅ Indexes created/verified'; END $$;

-- ============================================================================
-- SECTION 3: CREATE CLONE MAPPING TABLE (IDEMPOTENT)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public._song_clone_map (
  id SERIAL PRIMARY KEY,
  original_song_id UUID NOT NULL,
  band_id UUID NOT NULL,
  new_song_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (original_song_id, band_id)
);

CREATE INDEX IF NOT EXISTS idx_song_clone_map_orig ON public._song_clone_map(original_song_id);
CREATE INDEX IF NOT EXISTS idx_song_clone_map_new ON public._song_clone_map(new_song_id);

DO $$ BEGIN RAISE NOTICE '[3] ✅ Clone mapping table created/verified'; END $$;

-- ============================================================================
-- SECTION 4: IDENTIFY SONG CATEGORIES
-- ============================================================================

-- Temp table: songs referenced by exactly ONE band (via setlists)
CREATE TEMP TABLE _single_band_songs AS
SELECT 
  s.id AS song_id,
  (ARRAY_AGG(DISTINCT sl.band_id))[1] AS band_id
FROM public.songs s
JOIN public.setlist_songs ss ON ss.song_id = s.id
JOIN public.setlists sl ON sl.id = ss.setlist_id
WHERE s.band_id IS NULL
GROUP BY s.id
HAVING COUNT(DISTINCT sl.band_id) = 1;

-- Temp table: songs referenced by MULTIPLE bands (the problem songs)
CREATE TEMP TABLE _multi_band_songs AS
SELECT 
  s.id AS song_id,
  sl.band_id
FROM public.songs s
JOIN public.setlist_songs ss ON ss.song_id = s.id
JOIN public.setlists sl ON sl.id = ss.setlist_id
WHERE s.band_id IS NULL
GROUP BY s.id, sl.band_id
HAVING (
  SELECT COUNT(DISTINCT sl2.band_id) 
  FROM public.setlist_songs ss2 
  JOIN public.setlists sl2 ON sl2.id = ss2.setlist_id 
  WHERE ss2.song_id = s.id
) > 1;

DO $$
DECLARE
  single_count INTEGER;
  multi_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO single_count FROM _single_band_songs;
  SELECT COUNT(DISTINCT song_id) INTO multi_count FROM _multi_band_songs;
  RAISE NOTICE '[4] Found % single-band songs, % multi-band songs', single_count, multi_count;
END $$;

-- ============================================================================
-- SECTION 5: BACKFILL SINGLE-BAND SONGS
-- ============================================================================
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.songs s
  SET band_id = sbs.band_id
  FROM _single_band_songs sbs
  WHERE s.id = sbs.song_id
    AND s.band_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '[5] ✅ Backfilled % single-band songs', updated_count;
END $$;

-- ============================================================================
-- SECTION 6: CLONE MULTI-BAND SONGS
-- For each (song_id, band_id) pair, we create a clone. The FIRST band
-- encountered (deterministic via ORDER BY) gets the original song;
-- subsequent bands get clones.
-- ============================================================================
DO $$
DECLARE
  rec RECORD;
  new_id UUID;
  is_first BOOLEAN;
  clone_count INTEGER := 0;
  assign_count INTEGER := 0;
BEGIN
  -- Process each multi-band song, ordered deterministically
  FOR rec IN 
    SELECT DISTINCT ON (mbs.song_id) 
      mbs.song_id,
      mbs.band_id AS first_band_id
    FROM _multi_band_songs mbs
    ORDER BY mbs.song_id, mbs.band_id
  LOOP
    -- First band gets the original song (no clone needed)
    IF NOT EXISTS (
      SELECT 1 FROM public._song_clone_map 
      WHERE original_song_id = rec.song_id AND band_id = rec.first_band_id
    ) THEN
      UPDATE public.songs SET band_id = rec.first_band_id WHERE id = rec.song_id;
      
      INSERT INTO public._song_clone_map (original_song_id, band_id, new_song_id)
      VALUES (rec.song_id, rec.first_band_id, rec.song_id)
      ON CONFLICT (original_song_id, band_id) DO NOTHING;
      
      assign_count := assign_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE '[6a] ✅ Assigned % original songs to first band', assign_count;
  
  -- Now create clones for remaining bands
  FOR rec IN
    SELECT 
      mbs.song_id,
      mbs.band_id,
      s.title,
      s.artist,
      s.bpm,
      s.tuning,
      s.duration_seconds,
      s.lyrics,
      s.album_artwork,
      s.musicbrainz_id,
      s.spotify_id,
      s.deezer_id,
      s.is_live,
      s.created_at,
      s.updated_at
    FROM _multi_band_songs mbs
    JOIN public.songs s ON s.id = mbs.song_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public._song_clone_map m
      WHERE m.original_song_id = mbs.song_id AND m.band_id = mbs.band_id
    )
    ORDER BY mbs.song_id, mbs.band_id
  LOOP
    new_id := gen_random_uuid();
    
    INSERT INTO public.songs (
      id, title, artist, bpm, tuning, duration_seconds,
      lyrics, album_artwork, musicbrainz_id, spotify_id, deezer_id,
      is_live, band_id, created_at, updated_at
    ) VALUES (
      new_id, rec.title, rec.artist, rec.bpm, rec.tuning, rec.duration_seconds,
      rec.lyrics, rec.album_artwork, rec.musicbrainz_id, rec.spotify_id, rec.deezer_id,
      rec.is_live, rec.band_id, rec.created_at, COALESCE(rec.updated_at, NOW())
    );
    
    INSERT INTO public._song_clone_map (original_song_id, band_id, new_song_id)
    VALUES (rec.song_id, rec.band_id, new_id)
    ON CONFLICT (original_song_id, band_id) DO NOTHING;
    
    clone_count := clone_count + 1;
  END LOOP;
  
  RAISE NOTICE '[6b] ✅ Created % song clones for additional bands', clone_count;
END $$;

-- ============================================================================
-- SECTION 7: REWIRE setlist_songs TO USE CLONES
-- ============================================================================
DO $$
DECLARE
  rewired_count INTEGER;
BEGIN
  -- Find setlist_songs that point to original multi-band songs
  -- and need to be rewired to the clone for their band
  UPDATE public.setlist_songs ss_target
  SET song_id = m.new_song_id
  FROM (
    SELECT 
      ss.id AS setlist_song_id,
      scm.new_song_id
    FROM public.setlist_songs ss
    JOIN public.setlists sl ON sl.id = ss.setlist_id
    JOIN public._song_clone_map scm ON scm.original_song_id = ss.song_id 
                                    AND scm.band_id = sl.band_id
    WHERE ss.song_id <> scm.new_song_id
  ) m
  WHERE ss_target.id = m.setlist_song_id;
  
  GET DIAGNOSTICS rewired_count = ROW_COUNT;
  RAISE NOTICE '[7] ✅ Rewired % setlist_songs to use correct clones', rewired_count;
END $$;

-- ============================================================================
-- SECTION 8: REWIRE song_notes TO USE CLONES
-- ============================================================================
DO $$
DECLARE
  rewired_count INTEGER;
BEGIN
  -- Check if song_notes exists and has band_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'song_notes' 
      AND column_name = 'band_id'
  ) THEN
    UPDATE public.song_notes sn_target
    SET song_id = m.new_song_id
    FROM (
      SELECT 
        sn.id AS note_id,
        scm.new_song_id
      FROM public.song_notes sn
      JOIN public._song_clone_map scm ON scm.original_song_id = sn.song_id 
                                      AND scm.band_id = sn.band_id
      WHERE sn.song_id <> scm.new_song_id
    ) m
    WHERE sn_target.id = m.note_id;
    
    GET DIAGNOSTICS rewired_count = ROW_COUNT;
    RAISE NOTICE '[8] ✅ Rewired % song_notes to use correct clones', rewired_count;
  ELSE
    RAISE NOTICE '[8] ⏭️  song_notes.band_id not found, skipping rewire';
  END IF;
END $$;

-- ============================================================================
-- SECTION 9: HANDLE ORPHANED SONGS (NO BAND REFERENCES)
-- Songs with NULL band_id that aren't referenced by any setlist
-- ============================================================================
DO $$
DECLARE
  orphan_count INTEGER;
  deleted_count INTEGER;
BEGIN
  -- Count orphans
  SELECT COUNT(*) INTO orphan_count
  FROM public.songs s
  WHERE s.band_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.setlist_songs ss WHERE ss.song_id = s.id);
  
  IF orphan_count > 0 THEN
    -- Delete orphaned songs (they have no band context and no setlist usage)
    DELETE FROM public.songs s
    WHERE s.band_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.setlist_songs ss WHERE ss.song_id = s.id);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '[9] 🗑️  Deleted % orphaned songs with no band references', deleted_count;
  ELSE
    RAISE NOTICE '[9] ⏭️  No orphaned songs to delete';
  END IF;
END $$;

-- ============================================================================
-- SECTION 10: VERIFY NO NULL band_id REMAINS
-- ============================================================================
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM public.songs WHERE band_id IS NULL;
  
  IF null_count > 0 THEN
    RAISE EXCEPTION '[10] ❌ BLOCKING: % songs still have NULL band_id. Cannot proceed.', null_count;
  ELSE
    RAISE NOTICE '[10] ✅ All songs have band_id assigned';
  END IF;
END $$;

-- ============================================================================
-- SECTION 11: ENFORCE NOT NULL CONSTRAINT
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'songs' 
      AND column_name = 'band_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.songs ALTER COLUMN band_id SET NOT NULL;
    RAISE NOTICE '[11] ✅ Enforced NOT NULL on songs.band_id';
  ELSE
    RAISE NOTICE '[11] ⏭️  songs.band_id is already NOT NULL';
  END IF;
END $$;

-- ============================================================================
-- SECTION 12: ADD FOREIGN KEY IF NOT EXISTS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'songs_band_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'songs'
  ) THEN
    ALTER TABLE public.songs
    ADD CONSTRAINT songs_band_id_fkey 
    FOREIGN KEY (band_id) REFERENCES public.bands(id) ON DELETE CASCADE;
    RAISE NOTICE '[12] ✅ Added FK songs.band_id -> bands.id ON DELETE CASCADE';
  ELSE
    RAISE NOTICE '[12] ⏭️  FK songs_band_id_fkey already exists';
  END IF;
END $$;

-- ============================================================================
-- SECTION 13: OPTIONAL - ADD UNIQUE CONSTRAINT (band_id, lower(title), lower(artist))
-- Uses a partial unique index to avoid breaking existing data with duplicates
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'songs'
      AND indexname = 'idx_songs_band_title_artist_unique'
  ) THEN
    -- Create unique index (not constraint) - allows easier management
    CREATE UNIQUE INDEX idx_songs_band_title_artist_unique 
    ON public.songs (band_id, LOWER(title), LOWER(artist))
    WHERE title IS NOT NULL AND artist IS NOT NULL;
    RAISE NOTICE '[13] ✅ Added unique index on (band_id, lower(title), lower(artist))';
  ELSE
    RAISE NOTICE '[13] ⏭️  Unique index already exists';
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    RAISE WARNING '[13] ⚠️  Duplicate (band_id, title, artist) exists - skipping unique index';
END $$;

-- ============================================================================
-- SECTION 14: CLEANUP TEMP TABLES
-- ============================================================================
DROP TABLE IF EXISTS _single_band_songs;
DROP TABLE IF EXISTS _multi_band_songs;

DO $$ BEGIN RAISE NOTICE '[14] ✅ Cleaned up temp tables'; END $$;

COMMIT;

-- ============================================================================
-- SECTION 15: VERIFICATION QUERIES
-- ============================================================================

-- Verification 1: Songs with NULL band_id (MUST BE 0)
SELECT 
  'V1: Songs with NULL band_id' AS check_name,
  COUNT(*) AS count,
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END AS status
FROM public.songs 
WHERE band_id IS NULL;

-- Verification 2: Songs referenced by multiple bands (MUST BE 0)
SELECT 
  'V2: Songs referenced by multiple bands' AS check_name,
  COUNT(DISTINCT sub.song_id) AS count,
  CASE WHEN COUNT(DISTINCT sub.song_id) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END AS status
FROM (
  SELECT 
    ss.song_id,
    COUNT(DISTINCT sl.band_id) AS band_count
  FROM public.setlist_songs ss
  JOIN public.setlists sl ON sl.id = ss.setlist_id
  GROUP BY ss.song_id
  HAVING COUNT(DISTINCT sl.band_id) > 1
) sub;

-- Verification 3: Dangling references in setlist_songs (MUST BE 0)
SELECT 
  'V3: Dangling setlist_songs references' AS check_name,
  COUNT(*) AS count,
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END AS status
FROM public.setlist_songs ss
WHERE NOT EXISTS (SELECT 1 FROM public.songs s WHERE s.id = ss.song_id);

-- Verification 4: setlist_songs with band mismatch (MUST BE 0)
SELECT 
  'V4: setlist_songs with band mismatch' AS check_name,
  COUNT(*) AS count,
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END AS status
FROM public.setlist_songs ss
JOIN public.setlists sl ON sl.id = ss.setlist_id
JOIN public.songs s ON s.id = ss.song_id
WHERE sl.band_id <> s.band_id;

-- Verification 5: Clone map summary
SELECT 
  'V5: Clone map summary' AS report,
  COUNT(*) AS total_mappings,
  COUNT(*) FILTER (WHERE original_song_id = new_song_id) AS originals_kept,
  COUNT(*) FILTER (WHERE original_song_id <> new_song_id) AS clones_created
FROM public._song_clone_map;

-- Verification 6: Songs per band
SELECT 
  'V6: Songs per band' AS report,
  b.name AS band_name,
  COUNT(s.id) AS song_count
FROM public.bands b
LEFT JOIN public.songs s ON s.band_id = b.id
GROUP BY b.id, b.name
ORDER BY song_count DESC;

-- ============================================================================
-- FINAL STATUS
-- ============================================================================
DO $$
DECLARE
  v1 INTEGER;
  v2 INTEGER;
  v3 INTEGER;
  v4 INTEGER;
BEGIN
  SELECT COUNT(*) INTO v1 FROM public.songs WHERE band_id IS NULL;
  
  SELECT COUNT(*) INTO v2 FROM (
    SELECT ss.song_id FROM public.setlist_songs ss
    JOIN public.setlists sl ON sl.id = ss.setlist_id
    GROUP BY ss.song_id HAVING COUNT(DISTINCT sl.band_id) > 1
  ) x;
  
  SELECT COUNT(*) INTO v3 FROM public.setlist_songs ss
  WHERE NOT EXISTS (SELECT 1 FROM public.songs s WHERE s.id = ss.song_id);
  
  SELECT COUNT(*) INTO v4 FROM public.setlist_songs ss
  JOIN public.setlists sl ON sl.id = ss.setlist_id
  JOIN public.songs s ON s.id = ss.song_id
  WHERE sl.band_id <> s.band_id;
  
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  IF v1 = 0 AND v2 = 0 AND v3 = 0 AND v4 = 0 THEN
    RAISE NOTICE '✅ ALL VERIFICATIONS PASSED - Band partitioning complete!';
  ELSE
    RAISE WARNING '❌ VERIFICATION FAILED - V1:% V2:% V3:% V4:%', v1, v2, v3, v4;
  END IF;
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
END $$;
