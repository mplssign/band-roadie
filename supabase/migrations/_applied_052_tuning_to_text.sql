-- ============================================================================
-- BANDROADIE: TUNING ENUM TO TEXT MIGRATION
-- 
-- Changes tuning columns from tuning_type enum to TEXT to support
-- all guitar tunings (Open G, Drop C, B Standard, etc.).
-- 
-- Run in Supabase SQL Editor as service_role.
-- ============================================================================

-- ============================================================================
-- STEP 1: ALTER songs.tuning FROM ENUM TO TEXT
-- ============================================================================

-- First, add a temp column
ALTER TABLE songs ADD COLUMN IF NOT EXISTS tuning_temp TEXT;

-- Copy existing values (enum casts to text)
UPDATE songs SET tuning_temp = tuning::TEXT WHERE tuning IS NOT NULL;

-- Drop old column
ALTER TABLE songs DROP COLUMN IF EXISTS tuning;

-- Rename temp to tuning
ALTER TABLE songs RENAME COLUMN tuning_temp TO tuning;

-- Set default
ALTER TABLE songs ALTER COLUMN tuning SET DEFAULT 'standard';

RAISE NOTICE '✅ songs.tuning converted to TEXT';

-- ============================================================================
-- STEP 2: ALTER setlist_songs.tuning FROM ENUM TO TEXT
-- ============================================================================

-- First, add a temp column
ALTER TABLE setlist_songs ADD COLUMN IF NOT EXISTS tuning_temp TEXT;

-- Copy existing values (enum casts to text)
UPDATE setlist_songs SET tuning_temp = tuning::TEXT WHERE tuning IS NOT NULL;

-- Drop old column
ALTER TABLE setlist_songs DROP COLUMN IF EXISTS tuning;

-- Rename temp to tuning
ALTER TABLE setlist_songs RENAME COLUMN tuning_temp TO tuning;

-- Set default
ALTER TABLE setlist_songs ALTER COLUMN tuning SET DEFAULT 'standard';

RAISE NOTICE '✅ setlist_songs.tuning converted to TEXT';

-- ============================================================================
-- STEP 3: DROP THE ENUM TYPE (after columns are converted)
-- ============================================================================

DROP TYPE IF EXISTS tuning_type;

RAISE NOTICE '✅ tuning_type enum dropped - tuning is now TEXT';

-- ============================================================================
-- STEP 4: NORMALIZE EXISTING VALUES TO NEW IDs
-- Map old enum values to new ID format for consistency.
-- ============================================================================

-- Map 'standard' -> 'standard_e'
UPDATE songs SET tuning = 'standard_e' WHERE tuning = 'standard';
UPDATE setlist_songs SET tuning = 'standard_e' WHERE tuning = 'standard';

-- Map 'half_step' -> 'half_step_down'
UPDATE songs SET tuning = 'half_step_down' WHERE tuning = 'half_step';
UPDATE setlist_songs SET tuning = 'half_step_down' WHERE tuning = 'half_step';

-- Map 'full_step' -> 'whole_step_down'
UPDATE songs SET tuning = 'whole_step_down' WHERE tuning = 'full_step';
UPDATE setlist_songs SET tuning = 'whole_step_down' WHERE tuning = 'full_step';

-- 'drop_d' stays as 'drop_d' - no change needed

RAISE NOTICE '✅ Existing tuning values normalized to new ID format';
