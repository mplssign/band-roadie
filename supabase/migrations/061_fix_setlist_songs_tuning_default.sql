-- ============================================================================
-- FIX setlist_songs.tuning DEFAULT
-- ============================================================================
-- The previous migration (052) set DEFAULT 'standard' on setlist_songs.tuning.
-- This causes newly added songs to always have tuning='standard' override,
-- instead of NULL (which would fall back to the song's actual tuning).
--
-- The setlist_songs.tuning column is meant to be an OVERRIDE:
-- - NULL = use the song's tuning from songs.tuning
-- - non-NULL = override with this specific tuning
--
-- This migration removes the default so new inserts without explicit tuning
-- will have NULL, properly falling back to the song's base tuning.
-- ============================================================================

-- Remove the default from setlist_songs.tuning
ALTER TABLE public.setlist_songs ALTER COLUMN tuning DROP DEFAULT;

-- Fix existing rows that have 'standard' tuning that matches their song's tuning
-- (these should be NULL to indicate "no override")
UPDATE public.setlist_songs ss
SET tuning = NULL
WHERE ss.tuning = 'standard'
  AND EXISTS (
    SELECT 1 FROM public.songs s
    WHERE s.id = ss.song_id
      AND (s.tuning = 'standard' OR s.tuning = 'standard_e' OR s.tuning IS NULL)
  );

-- Also fix any 'standard_e' that matches
UPDATE public.setlist_songs ss
SET tuning = NULL
WHERE ss.tuning = 'standard_e'
  AND EXISTS (
    SELECT 1 FROM public.songs s
    WHERE s.id = ss.song_id
      AND (s.tuning = 'standard' OR s.tuning = 'standard_e' OR s.tuning IS NULL)
  );

-- Log the change
DO $$
BEGIN
  RAISE NOTICE '✅ Removed DEFAULT from setlist_songs.tuning - NULL now means "use song tuning"';
END $$;
