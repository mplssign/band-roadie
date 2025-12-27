-- ============================================================================
-- BANDROADIE: CONVERT TUNING COLUMNS FROM ENUM TO TEXT
-- 
-- This migration converts the tuning columns in songs and setlist_songs from
-- the limited tuning_type enum to TEXT to support all guitar tunings.
--
-- The enum only supports: 'standard', 'drop_d', 'half_step', 'full_step'
-- After migration, TEXT supports: Drop C, Open G, B Standard, DADGAD, etc.
--
-- Run in Supabase SQL Editor as service_role.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Convert songs.tuning from ENUM to TEXT
-- ============================================================================

DO $$
DECLARE
  col_type TEXT;
BEGIN
  -- Check current column type
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'songs'
    AND column_name = 'tuning';
  
  IF col_type = 'USER-DEFINED' THEN
    RAISE NOTICE 'songs.tuning is an enum, converting to TEXT...';
    
    -- Add temp column
    ALTER TABLE songs ADD COLUMN IF NOT EXISTS tuning_temp TEXT;
    
    -- Copy values (enum casts to text)
    UPDATE songs SET tuning_temp = tuning::TEXT WHERE tuning IS NOT NULL;
    
    -- Drop old column
    ALTER TABLE songs DROP COLUMN tuning;
    
    -- Rename temp to tuning
    ALTER TABLE songs RENAME COLUMN tuning_temp TO tuning;
    
    -- Set default
    ALTER TABLE songs ALTER COLUMN tuning SET DEFAULT 'standard';
    
    RAISE NOTICE '✅ songs.tuning converted to TEXT';
  ELSIF col_type = 'text' THEN
    RAISE NOTICE 'songs.tuning is already TEXT, skipping...';
  ELSE
    RAISE NOTICE 'songs.tuning has unexpected type: %, skipping...', col_type;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Convert setlist_songs.tuning from ENUM to TEXT
-- ============================================================================

DO $$
DECLARE
  col_type TEXT;
BEGIN
  -- Check current column type
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'setlist_songs'
    AND column_name = 'tuning';
  
  IF col_type = 'USER-DEFINED' THEN
    RAISE NOTICE 'setlist_songs.tuning is an enum, converting to TEXT...';
    
    -- Add temp column
    ALTER TABLE setlist_songs ADD COLUMN IF NOT EXISTS tuning_temp TEXT;
    
    -- Copy values (enum casts to text)
    UPDATE setlist_songs SET tuning_temp = tuning::TEXT WHERE tuning IS NOT NULL;
    
    -- Drop old column
    ALTER TABLE setlist_songs DROP COLUMN tuning;
    
    -- Rename temp to tuning
    ALTER TABLE setlist_songs RENAME COLUMN tuning_temp TO tuning;
    
    -- Do NOT set a default - NULL means "use song's tuning"
    -- (This was incorrectly set to 'standard' before, causing issues)
    
    RAISE NOTICE '✅ setlist_songs.tuning converted to TEXT';
  ELSIF col_type = 'text' THEN
    RAISE NOTICE 'setlist_songs.tuning is already TEXT, skipping...';
  ELSE
    RAISE NOTICE 'setlist_songs.tuning has unexpected type: %, skipping...', col_type;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Normalize existing values to consistent format
-- Map old enum values to cleaner IDs for consistency
-- ============================================================================

-- Normalize 'standard' to 'standard' (keep as-is for compatibility)
-- The app will display these correctly via tuningShortLabel()

-- Normalize 'half_step' to 'half_step' (keep as-is for compatibility)
UPDATE songs SET tuning = 'half_step' WHERE tuning = 'half_step_down';
UPDATE setlist_songs SET tuning = 'half_step' WHERE tuning = 'half_step_down';

-- Normalize 'full_step' to 'full_step' (keep as-is for compatibility)  
UPDATE songs SET tuning = 'full_step' WHERE tuning = 'whole_step_down';
UPDATE setlist_songs SET tuning = 'full_step' WHERE tuning = 'whole_step_down';

DO $$ BEGIN RAISE NOTICE '✅ Tuning values normalized'; END $$;

-- ============================================================================
-- STEP 4: Drop the enum type (if no longer in use)
-- ============================================================================

DO $$
BEGIN
  DROP TYPE IF EXISTS tuning_type;
  RAISE NOTICE '✅ tuning_type enum dropped';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not drop tuning_type enum (may still be in use elsewhere)';
END $$;

-- ============================================================================
-- STEP 5: Verify the changes
-- ============================================================================

DO $$
DECLARE
  songs_type TEXT;
  setlist_songs_type TEXT;
BEGIN
  SELECT data_type INTO songs_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'songs'
    AND column_name = 'tuning';
    
  SELECT data_type INTO setlist_songs_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'setlist_songs'
    AND column_name = 'tuning';
    
  IF songs_type = 'text' AND setlist_songs_type = 'text' THEN
    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ MIGRATION COMPLETE';
    RAISE NOTICE '   songs.tuning: %', songs_type;
    RAISE NOTICE '   setlist_songs.tuning: %', setlist_songs_type;
    RAISE NOTICE '   All guitar tunings are now supported!';
    RAISE NOTICE '════════════════════════════════════════════════════════════';
  ELSE
    RAISE WARNING '❌ MIGRATION INCOMPLETE';
    RAISE WARNING '   songs.tuning: %', songs_type;
    RAISE WARNING '   setlist_songs.tuning: %', setlist_songs_type;
  END IF;
END $$;

COMMIT;
