-- ============================================================================
-- FIX SONGS RLS INSERT POLICY
-- 
-- The is_band_member() function is required for RLS policies but may not
-- be deployed. This migration ensures:
-- 1. The is_band_member() function exists
-- 2. The songs insert policy works correctly
-- ============================================================================

-- Create or replace the is_band_member function
CREATE OR REPLACE FUNCTION public.is_band_member(band_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM band_members 
    WHERE band_id = band_uuid 
      AND user_id = auth.uid() 
      AND status = 'active'
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_band_member(UUID) TO authenticated;

-- Drop and recreate the songs insert policy
DROP POLICY IF EXISTS "songs: insert if member" ON songs;

CREATE POLICY "songs: insert if member" ON songs
  FOR INSERT TO authenticated
  WITH CHECK (
    band_id IS NOT NULL
    AND public.is_band_member(band_id)
  );

-- Also ensure RLS is enabled
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

-- Add a comment
COMMENT ON FUNCTION public.is_band_member IS 'Returns true if the authenticated user is an active member of the specified band. SECURITY DEFINER to avoid RLS recursion.';
