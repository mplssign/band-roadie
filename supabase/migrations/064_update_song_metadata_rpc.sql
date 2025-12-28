-- Migration: Create update_song_metadata RPC
-- Description: Provides a way to update song BPM, duration, and tuning
--              that works with songs regardless of band_id value
-- Date: 2025-12-28

-- Drop existing function if it exists (idempotent)
DROP FUNCTION IF EXISTS public.update_song_metadata(UUID, UUID, INT, INT, TEXT);

-- Create the update function
-- Uses SECURITY DEFINER to bypass RLS for legacy songs with NULL band_id
CREATE OR REPLACE FUNCTION public.update_song_metadata(
  p_song_id UUID,
  p_band_id UUID,
  p_bpm INT DEFAULT NULL,
  p_duration_seconds INT DEFAULT NULL,
  p_tuning TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_song_band_id UUID;
  v_updated_count INT;
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
  IF p_song_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'song_id is required'
    );
  END IF;

  IF p_band_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'band_id is required'
    );
  END IF;

  -- Verify user is a member of this band
  IF NOT EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = p_band_id
    AND bm.user_id = v_user_id
    AND bm.status = 'active'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied: not an active band member'
    );
  END IF;

  -- Get the song's band_id (may be NULL for legacy songs)
  SELECT s.band_id INTO v_song_band_id
  FROM public.songs s
  WHERE s.id = p_song_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Song not found'
    );
  END IF;

  -- Verify the song belongs to this band (or is a legacy song with NULL band_id)
  -- For legacy songs, we verify via setlist_songs join
  IF v_song_band_id IS NOT NULL AND v_song_band_id != p_band_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Song does not belong to this band'
    );
  END IF;

  -- For legacy songs (NULL band_id), verify via setlist membership
  IF v_song_band_id IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.setlist_songs ss
      JOIN public.setlists sl ON sl.id = ss.setlist_id
      WHERE ss.song_id = p_song_id
      AND sl.band_id = p_band_id
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Song not accessible to this band'
      );
    END IF;
  END IF;

  -- Validate BPM range if provided
  IF p_bpm IS NOT NULL AND (p_bpm < 20 OR p_bpm > 300) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'BPM must be between 20 and 300'
    );
  END IF;

  -- Validate duration range if provided (30 seconds to 20 minutes)
  IF p_duration_seconds IS NOT NULL AND (p_duration_seconds < 30 OR p_duration_seconds > 1200) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Duration must be between 30 seconds and 20 minutes'
    );
  END IF;

  -- Build and execute the update dynamically based on what's provided
  -- This allows updating only the fields that are passed
  UPDATE public.songs
  SET
    bpm = COALESCE(p_bpm, bpm),
    duration_seconds = COALESCE(p_duration_seconds, duration_seconds),
    tuning = COALESCE(p_tuning, tuning),
    updated_at = NOW()
  WHERE id = p_song_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No song was updated'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Song metadata updated successfully',
    'song_id', p_song_id,
    'bpm', p_bpm,
    'duration_seconds', p_duration_seconds,
    'tuning', p_tuning
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_song_metadata(UUID, UUID, INT, INT, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.update_song_metadata IS 
  'Updates song metadata (BPM, duration, tuning) with proper authorization. '
  'Works with legacy songs that have NULL band_id by verifying access via setlist membership.';

-- Also create a function to clear song metadata fields
DROP FUNCTION IF EXISTS public.clear_song_metadata(UUID, UUID, BOOLEAN, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION public.clear_song_metadata(
  p_song_id UUID,
  p_band_id UUID,
  p_clear_bpm BOOLEAN DEFAULT FALSE,
  p_clear_duration BOOLEAN DEFAULT FALSE,
  p_clear_tuning BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_song_band_id UUID;
  v_updated_count INT;
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
  IF p_song_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'song_id is required'
    );
  END IF;

  IF p_band_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'band_id is required'
    );
  END IF;

  -- Verify user is a member of this band
  IF NOT EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = p_band_id
    AND bm.user_id = v_user_id
    AND bm.status = 'active'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied: not an active band member'
    );
  END IF;

  -- Get the song's band_id (may be NULL for legacy songs)
  SELECT s.band_id INTO v_song_band_id
  FROM public.songs s
  WHERE s.id = p_song_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Song not found'
    );
  END IF;

  -- Verify the song belongs to this band (or is a legacy song with NULL band_id)
  IF v_song_band_id IS NOT NULL AND v_song_band_id != p_band_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Song does not belong to this band'
    );
  END IF;

  -- For legacy songs (NULL band_id), verify via setlist membership
  IF v_song_band_id IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.setlist_songs ss
      JOIN public.setlists sl ON sl.id = ss.setlist_id
      WHERE ss.song_id = p_song_id
      AND sl.band_id = p_band_id
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Song not accessible to this band'
      );
    END IF;
  END IF;

  -- Update the song, setting requested fields to NULL
  UPDATE public.songs
  SET
    bpm = CASE WHEN p_clear_bpm THEN NULL ELSE bpm END,
    duration_seconds = CASE WHEN p_clear_duration THEN NULL ELSE duration_seconds END,
    tuning = CASE WHEN p_clear_tuning THEN NULL ELSE tuning END,
    updated_at = NOW()
  WHERE id = p_song_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No song was updated'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Song metadata cleared successfully',
    'song_id', p_song_id,
    'cleared_bpm', p_clear_bpm,
    'cleared_duration', p_clear_duration,
    'cleared_tuning', p_clear_tuning
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.clear_song_metadata(UUID, UUID, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.clear_song_metadata IS 
  'Clears song metadata fields (BPM, duration, tuning) with proper authorization. '
  'Works with legacy songs that have NULL band_id.';
