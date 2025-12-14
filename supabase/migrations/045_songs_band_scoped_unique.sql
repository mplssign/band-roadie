-- ============================================================================
-- BANDROADIE: REPLACE GLOBAL UNIQUE WITH BAND-SCOPED UNIQUE
-- 
-- Drops: songs_title_artist_key (global uniqueness on title, artist)
-- Adds:  songs_band_title_artist_key (band-scoped uniqueness)
-- 
-- SAFE: Relaxing constraint (same song can exist in multiple bands)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DROP GLOBAL UNIQUE CONSTRAINT
-- ============================================================================
DO $$
BEGIN
  -- Try dropping as constraint first
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'songs'
      AND constraint_name = 'songs_title_artist_key'
  ) THEN
    ALTER TABLE public.songs DROP CONSTRAINT songs_title_artist_key;
    RAISE NOTICE '✅ Dropped constraint songs_title_artist_key';
  -- Try dropping as index if not a constraint
  ELSIF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'songs'
      AND indexname = 'songs_title_artist_key'
  ) THEN
    DROP INDEX public.songs_title_artist_key;
    RAISE NOTICE '✅ Dropped index songs_title_artist_key';
  ELSE
    RAISE NOTICE '⏭️  songs_title_artist_key does not exist (already dropped)';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: ADD BAND-SCOPED UNIQUE CONSTRAINT
-- Using (band_id, LOWER(title), LOWER(artist)) for case-insensitive matching
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'songs'
      AND indexname = 'songs_band_title_artist_key'
  ) THEN
    -- Use unique index (allows expressions like LOWER())
    CREATE UNIQUE INDEX songs_band_title_artist_key 
    ON public.songs (band_id, LOWER(title), LOWER(artist));
    RAISE NOTICE '✅ Created unique index songs_band_title_artist_key';
  ELSE
    RAISE NOTICE '⏭️  songs_band_title_artist_key already exists';
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION '❌ Duplicate (band_id, title, artist) exists in songs table. Clean up duplicates first.';
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check constraint is gone
SELECT 
  'Global constraint check' AS check_name,
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'songs' 
      AND constraint_name = 'songs_title_artist_key'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'songs' 
      AND indexname = 'songs_title_artist_key'
    )
    THEN '✅ PASS - Global unique removed'
    ELSE '❌ FAIL - Global unique still exists'
  END AS status;

-- Check new constraint exists
SELECT 
  'Band-scoped constraint check' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'songs' 
      AND indexname = 'songs_band_title_artist_key'
    )
    THEN '✅ PASS - Band-scoped unique exists'
    ELSE '❌ FAIL - Band-scoped unique missing'
  END AS status;

-- List all constraints/indexes on songs for confirmation
SELECT 
  'songs constraints' AS info,
  conname AS constraint_name,
  contype AS type
FROM pg_constraint
WHERE conrelid = 'public.songs'::regclass
UNION ALL
SELECT 
  'songs indexes' AS info,
  indexname,
  'index' AS type
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'songs';
