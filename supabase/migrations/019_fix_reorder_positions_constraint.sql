-- Migration: Fix reorder_setlist_positions function constraint violation
-- Description: Fix the database constraint violation when deleting songs from setlists

-- Drop the existing trigger to prevent interference during the function update
DROP TRIGGER IF EXISTS reorder_setlist_positions_on_delete ON public.setlist_songs;

-- Create a transaction-safe reorder function that avoids constraint violations
CREATE OR REPLACE FUNCTION reorder_setlist_positions()
RETURNS TRIGGER AS $$
BEGIN
  -- Use a transaction-safe approach: first set all positions to negative values, 
  -- then update to correct positive values to avoid unique constraint violations
  
  -- Step 1: Set all positions to negative values (temporary)
  UPDATE public.setlist_songs
  SET position = -(ROW_NUMBER() OVER (ORDER BY position))
  WHERE setlist_id = COALESCE(NEW.setlist_id, OLD.setlist_id);
  
  -- Step 2: Set positions to correct positive sequential values
  WITH ordered_songs AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY -position) as new_position
    FROM public.setlist_songs
    WHERE setlist_id = COALESCE(NEW.setlist_id, OLD.setlist_id)
  )
  UPDATE public.setlist_songs
  SET position = ordered_songs.new_position
  FROM ordered_songs
  WHERE public.setlist_songs.id = ordered_songs.id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger
CREATE TRIGGER reorder_setlist_positions_on_delete
  AFTER DELETE ON public.setlist_songs
  FOR EACH ROW EXECUTE FUNCTION reorder_setlist_positions();