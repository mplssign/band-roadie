-- Migration: Create atomic reorder_setlist_songs RPC
-- Description: Provides a transaction-safe way to reorder songs in a setlist
--              by avoiding the unique position constraint violation
-- Date: 2025-12-25

-- Drop existing function if it exists (idempotent)
DROP FUNCTION IF EXISTS public.reorder_setlist_songs(UUID, UUID[]);

-- Create the atomic reorder function
-- Uses a two-phase approach to avoid unique constraint violations:
-- 1. Set all affected positions to negative values (temporary)
-- 2. Set positions to the correct positive values based on array order
CREATE OR REPLACE FUNCTION public.reorder_setlist_songs(
  p_setlist_id UUID,
  p_song_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band_id UUID;
  v_user_id UUID;
  v_count INT;
  v_expected_count INT;
BEGIN
  -- Get the current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  -- Validate inputs
  IF p_setlist_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'setlist_id is required'
    );
  END IF;

  IF p_song_ids IS NULL OR array_length(p_song_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'song_ids array is required and cannot be empty'
    );
  END IF;

  v_expected_count := array_length(p_song_ids, 1);

  -- Get the band_id for this setlist and verify user has access
  SELECT s.band_id INTO v_band_id
  FROM public.setlists s
  WHERE s.id = p_setlist_id;

  IF v_band_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Setlist not found'
    );
  END IF;

  -- Verify user is a member of this band (RLS check)
  IF NOT EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = v_band_id
    AND bm.user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied: not a band member'
    );
  END IF;

  -- Verify all song_ids exist in this setlist
  SELECT COUNT(*) INTO v_count
  FROM public.setlist_songs ss
  WHERE ss.setlist_id = p_setlist_id
  AND ss.song_id = ANY(p_song_ids);

  IF v_count <> v_expected_count THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Song count mismatch: expected %s, found %s in setlist', v_expected_count, v_count),
      'expected', v_expected_count,
      'found', v_count
    );
  END IF;

  -- Phase 1: Set all positions to negative values (based on their new index, negated)
  -- This ensures no constraint violations during the transition
  UPDATE public.setlist_songs ss
  SET 
    position = -(array_position(p_song_ids, ss.song_id)),
    updated_at = NOW()
  WHERE ss.setlist_id = p_setlist_id
  AND ss.song_id = ANY(p_song_ids);

  -- Phase 2: Convert negative positions to correct positive values (0-indexed)
  UPDATE public.setlist_songs ss
  SET 
    position = ABS(ss.position) - 1,
    updated_at = NOW()
  WHERE ss.setlist_id = p_setlist_id
  AND ss.song_id = ANY(p_song_ids);

  RETURN jsonb_build_object(
    'success', true,
    'reordered_count', v_expected_count,
    'setlist_id', p_setlist_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'code', SQLSTATE
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.reorder_setlist_songs(UUID, UUID[]) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.reorder_setlist_songs IS 
  'Atomically reorder songs in a setlist. Takes the setlist_id and an array of song_ids in the desired order. Uses a two-phase update to avoid unique constraint violations on the position column.';
