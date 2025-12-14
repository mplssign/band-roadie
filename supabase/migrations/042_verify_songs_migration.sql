-- ============================================================================
-- BANDROADIE: POST-MIGRATION VERIFICATION
-- 
-- Run this AFTER the songs band-scoping migration to verify data integrity.
-- All checks should pass (return 0 violations or TRUE).
-- ============================================================================

-- ============================================================================
-- CHECK 1: No songs with NULL band_id
-- ============================================================================
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM songs WHERE band_id IS NULL;
  
  IF null_count > 0 THEN
    RAISE WARNING '❌ CHECK 1 FAILED: % songs have NULL band_id', null_count;
  ELSE
    RAISE NOTICE '✅ CHECK 1 PASSED: No songs with NULL band_id';
  END IF;
END $$;

-- Show any offenders
SELECT 'Songs with NULL band_id' AS check_name, id, title, artist
FROM songs 
WHERE band_id IS NULL
LIMIT 10;

-- ============================================================================
-- CHECK 2: Every setlist_songs row points to a song with matching band_id
-- ============================================================================
DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM setlist_songs ss
  JOIN setlists sl ON sl.id = ss.setlist_id
  JOIN songs s ON s.id = ss.song_id
  WHERE sl.band_id <> s.band_id;
  
  IF mismatch_count > 0 THEN
    RAISE WARNING '❌ CHECK 2 FAILED: % setlist_songs have band_id mismatch', mismatch_count;
  ELSE
    RAISE NOTICE '✅ CHECK 2 PASSED: All setlist_songs have matching band_ids';
  END IF;
END $$;

-- Show any offenders
SELECT 
  'setlist_songs band mismatch' AS check_name,
  ss.id AS setlist_song_id,
  ss.song_id,
  sl.band_id AS setlist_band_id,
  s.band_id AS song_band_id,
  s.title AS song_title
FROM setlist_songs ss
JOIN setlists sl ON sl.id = ss.setlist_id
JOIN songs s ON s.id = ss.song_id
WHERE sl.band_id <> s.band_id
LIMIT 10;

-- ============================================================================
-- CHECK 3: Every song_notes row points to a song with matching band_id
-- ============================================================================
DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM song_notes sn
  JOIN songs s ON s.id = sn.song_id
  WHERE sn.band_id <> s.band_id;
  
  IF mismatch_count > 0 THEN
    RAISE WARNING '❌ CHECK 3 FAILED: % song_notes have band_id mismatch', mismatch_count;
  ELSE
    RAISE NOTICE '✅ CHECK 3 PASSED: All song_notes have matching band_ids';
  END IF;
END $$;

-- Show any offenders
SELECT 
  'song_notes band mismatch' AS check_name,
  sn.id AS note_id,
  sn.song_id,
  sn.band_id AS note_band_id,
  s.band_id AS song_band_id,
  s.title AS song_title
FROM song_notes sn
JOIN songs s ON s.id = sn.song_id
WHERE sn.band_id <> s.band_id
LIMIT 10;

-- ============================================================================
-- CHECK 4: No "global" songs still referenced
-- (songs with NULL band_id referenced by setlist_songs or song_notes)
-- ============================================================================
DO $$
DECLARE
  orphan_refs INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_refs
  FROM (
    -- setlist_songs pointing to global songs
    SELECT ss.song_id
    FROM setlist_songs ss
    JOIN songs s ON s.id = ss.song_id
    WHERE s.band_id IS NULL
    UNION
    -- song_notes pointing to global songs
    SELECT sn.song_id
    FROM song_notes sn
    JOIN songs s ON s.id = sn.song_id
    WHERE s.band_id IS NULL
  ) orphans;
  
  IF orphan_refs > 0 THEN
    RAISE WARNING '❌ CHECK 4 FAILED: % references to global (NULL band_id) songs', orphan_refs;
  ELSE
    RAISE NOTICE '✅ CHECK 4 PASSED: No references to global songs';
  END IF;
END $$;

-- Show any offenders
SELECT 
  'Reference to global song' AS check_name,
  'setlist_songs' AS source_table,
  ss.id AS source_id,
  ss.song_id,
  s.title AS song_title
FROM setlist_songs ss
JOIN songs s ON s.id = ss.song_id
WHERE s.band_id IS NULL
LIMIT 5;

SELECT 
  'Reference to global song' AS check_name,
  'song_notes' AS source_table,
  sn.id AS source_id,
  sn.song_id,
  s.title AS song_title
FROM song_notes sn
JOIN songs s ON s.id = sn.song_id
WHERE s.band_id IS NULL
LIMIT 5;

-- ============================================================================
-- CHECK 5: Song counts per band + orphan detection
-- ============================================================================

-- Songs per band summary
SELECT 
  'Songs per band' AS report,
  b.id AS band_id,
  b.name AS band_name,
  COUNT(s.id) AS song_count
FROM bands b
LEFT JOIN songs s ON s.band_id = b.id
GROUP BY b.id, b.name
ORDER BY song_count DESC;

-- Orphan songs (have band_id but band doesn't exist - should be 0 due to FK)
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM songs s
  WHERE NOT EXISTS (SELECT 1 FROM bands b WHERE b.id = s.band_id);
  
  IF orphan_count > 0 THEN
    RAISE WARNING '❌ CHECK 5a FAILED: % songs reference non-existent bands', orphan_count;
  ELSE
    RAISE NOTICE '✅ CHECK 5a PASSED: No orphan songs (FK intact)';
  END IF;
END $$;

-- Songs not in any setlist (informational, not a failure)
SELECT 
  'Songs not in any setlist (informational)' AS report,
  b.name AS band_name,
  COUNT(s.id) AS unused_song_count
FROM songs s
JOIN bands b ON b.id = s.band_id
WHERE NOT EXISTS (SELECT 1 FROM setlist_songs ss WHERE ss.song_id = s.id)
GROUP BY b.id, b.name
HAVING COUNT(s.id) > 0;

-- ============================================================================
-- CHECK 6: Verify clone map integrity (if Option B was used)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'song_clone_map') THEN
    -- Verify all mapped new_song_ids still exist
    PERFORM 1
    FROM song_clone_map m
    WHERE NOT EXISTS (SELECT 1 FROM songs s WHERE s.id = m.new_song_id);
    
    IF FOUND THEN
      RAISE WARNING '❌ CHECK 6 FAILED: Some cloned songs in song_clone_map no longer exist';
    ELSE
      RAISE NOTICE '✅ CHECK 6 PASSED: All cloned songs in song_clone_map exist';
    END IF;
    
    -- Show clone map summary
    RAISE NOTICE 'Clone map contains % entries', (SELECT COUNT(*) FROM song_clone_map);
  ELSE
    RAISE NOTICE '⏭️  CHECK 6 SKIPPED: song_clone_map table does not exist (Option A was used)';
  END IF;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================
SELECT 
  '=== VERIFICATION SUMMARY ===' AS status,
  (SELECT COUNT(*) FROM songs) AS total_songs,
  (SELECT COUNT(*) FROM songs WHERE band_id IS NULL) AS null_band_id_songs,
  (SELECT COUNT(*) FROM setlist_songs) AS total_setlist_songs,
  (SELECT COUNT(*) FROM song_notes) AS total_song_notes,
  (SELECT COUNT(DISTINCT band_id) FROM songs) AS bands_with_songs;

-- Final pass/fail
DO $$
DECLARE
  failures INTEGER := 0;
BEGIN
  -- Check 1: NULL band_id
  IF EXISTS (SELECT 1 FROM songs WHERE band_id IS NULL) THEN
    failures := failures + 1;
  END IF;
  
  -- Check 2: setlist_songs mismatch
  IF EXISTS (
    SELECT 1 FROM setlist_songs ss
    JOIN setlists sl ON sl.id = ss.setlist_id
    JOIN songs s ON s.id = ss.song_id
    WHERE sl.band_id <> s.band_id
  ) THEN
    failures := failures + 1;
  END IF;
  
  -- Check 3: song_notes mismatch
  IF EXISTS (
    SELECT 1 FROM song_notes sn
    JOIN songs s ON s.id = sn.song_id
    WHERE sn.band_id <> s.band_id
  ) THEN
    failures := failures + 1;
  END IF;
  
  -- Check 4: References to global songs
  IF EXISTS (
    SELECT 1 FROM setlist_songs ss
    JOIN songs s ON s.id = ss.song_id WHERE s.band_id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM song_notes sn
    JOIN songs s ON s.id = sn.song_id WHERE s.band_id IS NULL
  ) THEN
    failures := failures + 1;
  END IF;
  
  IF failures = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '══════════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ ALL CHECKS PASSED - Migration verified successfully!';
    RAISE NOTICE '══════════════════════════════════════════════════════════════';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '══════════════════════════════════════════════════════════════';
    RAISE WARNING '❌ % CHECK(S) FAILED - Review output above for details', failures;
    RAISE NOTICE '══════════════════════════════════════════════════════════════';
  END IF;
END $$;
