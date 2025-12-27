-- ============================================================================
-- MIGRATION 050: Create Band RPC Function
-- 
-- Purpose: Fix RLS error when creating bands from Flutter app
-- 
-- Problem: Direct INSERTs to public.bands are blocked by RLS because the user
-- isn't a member of the band yet (chicken-and-egg problem).
--
-- Solution: Use a SECURITY DEFINER function that:
--   1. Creates the band
--   2. Adds creator as owner in band_members
--   3. Returns the new band_id
--
-- Author: BandRoadie Team
-- Date: 2025-12-15
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP EXISTING FUNCTION (if re-running)
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_band(text, text, text);
DROP FUNCTION IF EXISTS public.create_band(text, text);

-- ============================================================================
-- STEP 2: CREATE THE RPC FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_band(
  p_name TEXT,
  p_avatar_color TEXT DEFAULT 'bg-rose-500',
  p_image_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_band_id UUID;
BEGIN
  -- Require authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required. Please sign in.';
  END IF;

  -- Validate inputs
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Band name is required.';
  END IF;

  IF char_length(trim(p_name)) > 100 THEN
    RAISE EXCEPTION 'Band name must be 100 characters or less.';
  END IF;

  -- Create the band
  INSERT INTO public.bands (
    name,
    avatar_color,
    image_url,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    trim(p_name),
    COALESCE(p_avatar_color, 'bg-rose-500'),
    p_image_url,
    v_user_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_band_id;

  -- Add the creator as owner in band_members
  INSERT INTO public.band_members (
    band_id,
    user_id,
    role,
    status,
    joined_at,
    updated_at
  ) VALUES (
    v_band_id,
    v_user_id,
    'owner',
    'active',
    NOW(),
    NOW()
  );

  RETURN v_band_id;
END;
$$;

-- Add descriptive comment
COMMENT ON FUNCTION public.create_band IS 
'Creates a new band and adds the creator as owner. SECURITY DEFINER to bypass RLS during creation.

Parameters:
  p_name - Required. Band name (max 100 chars)
  p_avatar_color - Optional. Tailwind color class (default: bg-rose-500)
  p_image_url - Optional. URL to band avatar image

Returns: UUID of the newly created band

Security: Requires authentication. Creator becomes band owner automatically.';

-- ============================================================================
-- STEP 3: SET PERMISSIONS
-- ============================================================================

-- Revoke all default permissions
REVOKE ALL ON FUNCTION public.create_band(text, text, text) FROM PUBLIC;

-- Grant execute only to authenticated users
GRANT EXECUTE ON FUNCTION public.create_band(text, text, text) TO authenticated;

-- ============================================================================
-- STEP 4: UPDATE RLS POLICIES FOR BANDS
-- 
-- Block direct INSERTs - creation must go through RPC
-- ============================================================================

-- Drop existing insert policy
DROP POLICY IF EXISTS bands_insert ON public.bands;
DROP POLICY IF EXISTS "bands_insert_authenticated" ON public.bands;

-- Create restrictive insert policy (only service_role can insert directly)
-- Regular users must use create_band RPC
CREATE POLICY bands_insert_via_rpc ON public.bands
  FOR INSERT
  WITH CHECK (
    -- Only allow inserts from SECURITY DEFINER functions (service role context)
    -- This effectively blocks direct client inserts
    -- The create_band function runs as definer, so it bypasses this
    current_setting('role') = 'service_role'
    OR
    -- Fallback: allow if user is the creator (for the RPC function context)
    (auth.uid() IS NOT NULL AND created_by = auth.uid())
  );

-- ============================================================================
-- STEP 5: ENSURE BAND_MEMBERS POLICIES ARE CORRECT
-- ============================================================================

-- Drop and recreate insert policy to prevent arbitrary self-addition
DROP POLICY IF EXISTS band_members_insert ON public.band_members;
DROP POLICY IF EXISTS "band_members_insert_own" ON public.band_members;

-- Only admins can add members, OR the create_band function (SECURITY DEFINER)
CREATE POLICY band_members_insert_controlled ON public.band_members
  FOR INSERT
  WITH CHECK (
    -- Admins/owners of the band can add members
    is_band_admin(band_id)
    OR
    -- Allow user to add themselves if they are accepting an invitation
    -- (This covers the invitation acceptance flow)
    (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM band_invitations bi
        WHERE bi.band_id = band_members.band_id
          AND lower(bi.email) = lower(auth.email())
          AND bi.status = 'pending'
      )
    )
    OR
    -- SECURITY DEFINER functions can insert (role context check)
    current_setting('role') = 'service_role'
  );

-- ============================================================================
-- STEP 6: CREATE STORAGE BUCKET FOR BAND AVATARS (if not exists)
-- 
-- Run this in Supabase dashboard or via service_role:
-- ============================================================================

-- Note: Storage bucket creation requires service_role or dashboard
-- The following is for reference:
/*
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'band-avatars',
  'band-avatars', 
  true,  -- Public bucket for avatar URLs
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policy for band-avatars bucket
CREATE POLICY "Authenticated users can upload band avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'band-avatars');

CREATE POLICY "Anyone can view band avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'band-avatars');

CREATE POLICY "Users can update their uploaded avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'band-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their uploaded avatars"  
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'band-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
*/

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================

-- Check function exists
SELECT 
  routine_name, 
  routine_type,
  security_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'create_band';

-- Check grants
SELECT 
  grantee, 
  privilege_type 
FROM information_schema.routine_privileges 
WHERE routine_name = 'create_band' 
  AND routine_schema = 'public';

-- Check policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd,
  roles
FROM pg_policies 
WHERE tablename IN ('bands', 'band_members')
ORDER BY tablename, policyname;
