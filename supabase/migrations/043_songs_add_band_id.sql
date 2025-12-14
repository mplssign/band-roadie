-- ============================================================================
-- BANDROADIE: ADD band_id TO songs (Idempotent Migration)
-- 
-- Safely adds band_id column, backfills from relationships, and enforces NOT NULL.
-- Can be run multiple times without breaking.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Add band_id column if not exists
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'songs' 
    AND column_name = 'band_id'
  ) THEN
    ALTER TABLE songs ADD COLUMN band_id UUID;
    RAISE NOTICE '✅ Added band_id column to songs';
  ELSE
    RAISE NOTICE '⏭️  band_id column already exists on songs';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Create tracking table for multi-band songs (idempotent)
-- ============================================================================
CREATE TABLE IF NOT EXISTS _songs_migration_log (
  id SERIAL PRIMARY KEY,
  original_song_id UUID NOT NULL,
  band_id UUID NOT NULL,
  new_song_id UUID,
  action TEXT NOT NULL, -- 'assigned', 'cloned', 'unresolved'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (original_song_id, band_id)
);

-- ============================================================================
-- STEP 3: Backfill songs that are referenced by exactly ONE band
-- ============================================================================
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Update songs where band_id IS NULL and only ONE band references them
  WITH single_band_songs AS (
    SELECT 
      s.id AS song_id,
      MIN(sl.band_id) AS band_id,
      COUNT(DISTINCT sl.band_id) AS band_count
    FROM songs s
    JOIN setlist_songs ss ON ss.song_id = s.id
    JOIN setlists sl ON sl.id = ss.setlist_id
    WHERE s.band_id IS NULL
    GROUP BY s.id
    HAVING COUNT(DISTINCT sl.band_id) = 1
  )
  UPDATE songs s
  SET band_id = sbs.band_id
  FROM single_band_songs sbs
  WHERE s.id = sbs.song_id
    AND s.band_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Backfilled % songs with single-band references', updated_count;
  
  -- Log these assignments
  INSERT INTO _songs_migration_log (original_song_id, band_id, new_song_id, action)
  SELECT s.id, s.band_id, s.id, 'assigned'
  FROM songs s
  WHERE s.band_id IS NOT NULL
  ON CONFLICT (original_song_id, band_id) DO NOTHING;
END $$;

-- ============================================================================
-- STEP 4: Backfill songs from song_notes if still NULL
-- ============================================================================
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Check if song_notes table exists and has band_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'song_notes' 
    AND column_name = 'band_id'
  ) THEN
    -- Update songs where band_id IS NULL using song_notes
    WITH notes_bands AS (
      SELECT 
        sn.song_id,
        MIN(sn.band_id) AS band_id,
        COUNT(DISTINCT sn.band_id) AS band_count
      FROM song_notes sn
      JOIN songs s ON s.id = sn.song_id
      WHERE s.band_id IS NULL
      GROUP BY sn.song_id
      HAVING COUNT(DISTINCT sn.band_id) = 1
    )
    UPDATE songs s
    SET band_id = nb.band_id
    FROM notes_bands nb
    WHERE s.id = nb.song_id
      AND s.band_id IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✅ Backfilled % songs from song_notes', updated_count;
  ELSE
    RAISE NOTICE '⏭️  song_notes.band_id not found, skipping';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Clone songs referenced by MULTIPLE bands
-- ============================================================================
DO $$
DECLARE
  multi_band_song RECORD;
  band_rec RECORD;
  new_id UUID;
  first_band BOOLEAN;
  clone_count INTEGER := 0;
BEGIN
  -- Find songs still NULL that are referenced by multiple bands
  FOR multi_band_song IN
    SELECT 
      s.id,
      s.title,
      s.artist,
      s.bpm,
      s.tuning,
      s.duration_seconds,
      s.key_signature,
      s.tempo,
      s.notes
    FROM songs s
    WHERE s.band_id IS NULL
      AND EXISTS (SELECT 1 FROM setlist_songs WHERE song_id = s.id)
  LOOP
    first_band := TRUE;
    
    -- Get all bands that reference this song
    FOR band_rec IN
      SELECT DISTINCT sl.band_id
      FROM setlist_songs ss
      JOIN setlists sl ON sl.id = ss.setlist_id
      WHERE ss.song_id = multi_band_song.id
      ORDER BY sl.band_id
    LOOP
      -- Skip if already processed
      IF EXISTS (
        SELECT 1 FROM _songs_migration_log 
        WHERE original_song_id = multi_band_song.id 
        AND band_id = band_rec.band_id
      ) THEN
        CONTINUE;
      END IF;
      
      IF first_band THEN
        -- First band: assign original song to this band (no clone needed)
        UPDATE songs SET band_id = band_rec.band_id WHERE id = multi_band_song.id;
        
        INSERT INTO _songs_migration_log (original_song_id, band_id, new_song_id, action)
        VALUES (multi_band_song.id, band_rec.band_id, multi_band_song.id, 'assigned')
        ON CONFLICT (original_song_id, band_id) DO NOTHING;
        
        first_band := FALSE;
        RAISE NOTICE 'Assigned song "%" to first band %', multi_band_song.title, band_rec.band_id;
      ELSE
        -- Subsequent bands: create a clone
        new_id := gen_random_uuid();
        
        INSERT INTO songs (id, title, artist, bpm, tuning, duration_seconds, key_signature, tempo, notes, band_id)
        VALUES (
          new_id,
          multi_band_song.title,
          multi_band_song.artist,
          multi_band_song.bpm,
          multi_band_song.tuning,
          multi_band_song.duration_seconds,
          multi_band_song.key_signature,
          multi_band_song.tempo,
          multi_band_song.notes,
          band_rec.band_id
        );
        
        -- Rewire setlist_songs for this band
        UPDATE setlist_songs ss
        SET song_id = new_id
        FROM (
          SELECT ss2.id AS setlist_song_id
          FROM setlist_songs ss2
          JOIN setlists sl ON sl.id = ss2.setlist_id
          WHERE ss2.song_id = multi_band_song.id
            AND sl.band_id = band_rec.band_id
        ) x
        WHERE ss.id = x.setlist_song_id;
        
        -- Rewire song_notes for this band (if table exists with band_id)
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'song_notes' 
          AND column_name = 'band_id'
        ) THEN
          UPDATE song_notes sn
          SET song_id = new_id
          FROM (
            SELECT sn2.id AS note_id
            FROM song_notes sn2
            WHERE sn2.song_id = multi_band_song.id
              AND sn2.band_id = band_rec.band_id
          ) y
          WHERE sn.id = y.note_id;
        END IF;
        
        INSERT INTO _songs_migration_log (original_song_id, band_id, new_song_id, action)
        VALUES (multi_band_song.id, band_rec.band_id, new_id, 'cloned')
        ON CONFLICT (original_song_id, band_id) DO NOTHING;
        
        clone_count := clone_count + 1;
        RAISE NOTICE 'Cloned song "%" for band %', multi_band_song.title, band_rec.band_id;
      END IF;
    END LOOP;
  END LOOP;
  
  IF clone_count > 0 THEN
    RAISE NOTICE '✅ Created % song clones for multi-band references', clone_count;
  ELSE
    RAISE NOTICE '⏭️  No multi-band songs needed cloning';
  END IF;
END $$;

-- ============================================================================
-- STEP 6: Report unresolved songs (NULL band_id, not referenced anywhere)
-- ============================================================================
DO $$
DECLARE
  unresolved_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unresolved_count
  FROM songs s
  WHERE s.band_id IS NULL;
  
  IF unresolved_count > 0 THEN
    -- Log unresolved songs
    INSERT INTO _songs_migration_log (original_song_id, band_id, action)
    SELECT s.id, '00000000-0000-0000-0000-000000000000'::uuid, 'unresolved'
    FROM songs s
    WHERE s.band_id IS NULL
    ON CONFLICT (original_song_id, band_id) DO NOTHING;
    
    RAISE WARNING '⚠️  % songs have NULL band_id and no band references. See _songs_migration_log.', unresolved_count;
    RAISE WARNING 'These songs will be DELETED before enforcing NOT NULL.';
  ELSE
    RAISE NOTICE '✅ All songs have band_id assigned';
  END IF;
END $$;

-- Show unresolved songs before deletion
SELECT 
  'UNRESOLVED (will be deleted)' AS status,
  s.id,
  s.title,
  s.artist
FROM songs s
WHERE s.band_id IS NULL
LIMIT 20;

-- ============================================================================
-- STEP 7: Delete unreferenced songs with NULL band_id
-- ============================================================================
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM songs s
  WHERE s.band_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM setlist_songs ss WHERE ss.song_id = s.id)
    AND NOT EXISTS (
      SELECT 1 FROM song_notes sn WHERE sn.song_id = s.id
      -- Only check if song_notes exists
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'song_notes')
    );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  IF deleted_count > 0 THEN
    RAISE NOTICE '🗑️  Deleted % orphaned songs with no band references', deleted_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 8: Final check before enforcing NOT NULL
-- ============================================================================
DO $$
DECLARE
  remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining FROM songs WHERE band_id IS NULL;
  
  IF remaining > 0 THEN
    RAISE EXCEPTION '❌ Cannot enforce NOT NULL: % songs still have NULL band_id. Manual intervention required.', remaining;
  END IF;
  
  RAISE NOTICE '✅ All songs have band_id - safe to enforce NOT NULL';
END $$;

-- ============================================================================
-- STEP 9: Enforce NOT NULL constraint
-- ============================================================================
DO $$
BEGIN
  -- Check if already NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'songs' 
    AND column_name = 'band_id'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE songs ALTER COLUMN band_id SET NOT NULL;
    RAISE NOTICE '✅ Enforced NOT NULL on songs.band_id';
  ELSE
    RAISE NOTICE '⏭️  songs.band_id is already NOT NULL';
  END IF;
END $$;

-- ============================================================================
-- STEP 10: Add foreign key constraint (idempotent)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'songs_band_id_fkey'
    AND table_name = 'songs'
  ) THEN
    ALTER TABLE songs
    ADD CONSTRAINT songs_band_id_fkey 
    FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added FK songs.band_id -> bands.id';
  ELSE
    RAISE NOTICE '⏭️  FK songs_band_id_fkey already exists';
  END IF;
END $$;

-- ============================================================================
-- STEP 11: Add index (idempotent)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_songs_band_id ON songs(band_id);

-- ============================================================================
-- STEP 12: Summary report
-- ============================================================================
SELECT 
  '=== MIGRATION SUMMARY ===' AS report,
  (SELECT COUNT(*) FROM songs) AS total_songs,
  (SELECT COUNT(*) FROM songs WHERE band_id IS NOT NULL) AS songs_with_band_id,
  (SELECT COUNT(*) FROM songs WHERE band_id IS NULL) AS songs_without_band_id,
  (SELECT COUNT(*) FROM _songs_migration_log WHERE action = 'assigned') AS assigned,
  (SELECT COUNT(*) FROM _songs_migration_log WHERE action = 'cloned') AS cloned,
  (SELECT COUNT(*) FROM _songs_migration_log WHERE action = 'unresolved') AS unresolved;

-- Show clone mapping for debugging
SELECT 
  'Clone map' AS info,
  original_song_id,
  band_id,
  new_song_id,
  action
FROM _songs_migration_log
WHERE action IN ('cloned', 'assigned')
ORDER BY original_song_id, action
LIMIT 50;

COMMIT;

RAISE NOTICE '';
RAISE NOTICE '══════════════════════════════════════════════════════════════';
RAISE NOTICE '✅ songs.band_id migration complete!';
RAISE NOTICE '══════════════════════════════════════════════════════════════';
