-- =============================================================================
-- Migration: 059_setlist_stats_trigger.sql
-- Description: Adds database triggers to automatically recompute setlist stats
--              (total_duration) whenever songs are added, updated, or removed.
-- =============================================================================

-- =============================================================================
-- STEP 1: Create the recompute function
-- =============================================================================

-- Function to recompute setlist total_duration based on setlist_songs
-- Uses COALESCE to handle songs with null duration_seconds
CREATE OR REPLACE FUNCTION recompute_setlist_stats(p_setlist_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.setlists
  SET 
    total_duration = (
      SELECT COALESCE(SUM(
        COALESCE(ss.duration_seconds, s.duration_seconds, 0)
      ), 0)
      FROM public.setlist_songs ss
      LEFT JOIN public.songs s ON ss.song_id = s.id
      WHERE ss.setlist_id = p_setlist_id
    ),
    updated_at = NOW()
  WHERE id = p_setlist_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION recompute_setlist_stats(UUID) TO authenticated;

COMMENT ON FUNCTION recompute_setlist_stats(UUID) IS 
  'Recomputes and updates the total_duration for a setlist based on its songs. 
   Uses setlist_songs.duration_seconds if set, otherwise falls back to songs.duration_seconds.';

-- =============================================================================
-- STEP 2: Create trigger function that calls recompute
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_recompute_setlist_stats()
RETURNS TRIGGER AS $$
DECLARE
  affected_setlist_id UUID;
BEGIN
  -- Determine which setlist_id was affected
  -- On INSERT/UPDATE: use NEW.setlist_id
  -- On DELETE: use OLD.setlist_id
  IF TG_OP = 'DELETE' THEN
    affected_setlist_id := OLD.setlist_id;
  ELSE
    affected_setlist_id := NEW.setlist_id;
  END IF;
  
  -- Recompute stats for the affected setlist
  PERFORM recompute_setlist_stats(affected_setlist_id);
  
  -- For UPDATE, if setlist_id changed, also recompute old setlist
  IF TG_OP = 'UPDATE' AND OLD.setlist_id IS DISTINCT FROM NEW.setlist_id THEN
    PERFORM recompute_setlist_stats(OLD.setlist_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_recompute_setlist_stats() IS 
  'Trigger function that recomputes setlist stats after INSERT/UPDATE/DELETE on setlist_songs';

-- =============================================================================
-- STEP 3: Create triggers on setlist_songs table
-- =============================================================================

-- Drop existing triggers if they exist (from old migrations in lib/supabase)
DROP TRIGGER IF EXISTS update_setlist_duration_on_insert ON public.setlist_songs;
DROP TRIGGER IF EXISTS update_setlist_duration_on_update ON public.setlist_songs;
DROP TRIGGER IF EXISTS update_setlist_duration_on_delete ON public.setlist_songs;
DROP TRIGGER IF EXISTS trigger_setlist_stats_on_insert ON public.setlist_songs;
DROP TRIGGER IF EXISTS trigger_setlist_stats_on_update ON public.setlist_songs;
DROP TRIGGER IF EXISTS trigger_setlist_stats_on_delete ON public.setlist_songs;

-- Create new triggers
CREATE TRIGGER trigger_setlist_stats_on_insert
  AFTER INSERT ON public.setlist_songs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recompute_setlist_stats();

CREATE TRIGGER trigger_setlist_stats_on_update
  AFTER UPDATE ON public.setlist_songs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recompute_setlist_stats();

CREATE TRIGGER trigger_setlist_stats_on_delete
  AFTER DELETE ON public.setlist_songs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recompute_setlist_stats();

-- =============================================================================
-- STEP 4: Backfill existing setlists with correct total_duration
-- =============================================================================

-- Update all setlists to have accurate total_duration based on current songs
UPDATE public.setlists s
SET 
  total_duration = (
    SELECT COALESCE(SUM(
      COALESCE(ss.duration_seconds, songs.duration_seconds, 0)
    ), 0)
    FROM public.setlist_songs ss
    LEFT JOIN public.songs songs ON ss.song_id = songs.id
    WHERE ss.setlist_id = s.id
  ),
  updated_at = NOW();

-- Log the migration result
DO $$
DECLARE
  setlist_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO setlist_count FROM public.setlists;
  RAISE NOTICE 'Migration 059: Updated total_duration for % setlists', setlist_count;
END $$;
