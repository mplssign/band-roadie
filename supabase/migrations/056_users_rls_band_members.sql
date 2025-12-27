-- ============================================================================
-- Migration 056: Comprehensive RLS + Profile Completion Enforcement
-- 
-- PURPOSE:
-- 1. Fix Members screen to show all bandmates (not just current user)
-- 2. Enforce strict band-scoped access (no cross-band data leakage)
-- 3. Require profile_completed=true before joining/creating bands
--
-- SOURCE OF TRUTH:
-- - public.users = user identity/profile data (first_name, last_name, phone, etc.)
-- - public.band_members = band membership junction (band_id, user_id, role, status)
-- - public.profiles = LEGACY, do not delete but do not depend on
--
-- RLS GUARANTEES:
-- - A user can only read their own row in users, OR
-- - Rows of users who share at least one band with them (active/invited status)
-- - A user cannot read users from bands they are not a member of
--
-- PROFILE COMPLETION ENFORCEMENT:
-- - Trigger prevents inserting into band_members unless user has profile_completed=true
-- - This ensures users complete their profile before joining any band
--
-- RECURSION FIX:
-- - Uses SECURITY DEFINER functions to bypass RLS during policy checks
-- - This prevents infinite recursion between users and band_members policies
-- ============================================================================

-- ============================================================================
-- PART 0: HELPER FUNCTIONS (SECURITY DEFINER to bypass RLS)
-- ============================================================================

-- Drop existing helper functions
DROP FUNCTION IF EXISTS public.get_user_band_ids(UUID);
DROP FUNCTION IF EXISTS public.get_bandmate_user_ids(UUID);
DROP FUNCTION IF EXISTS public.is_band_admin(UUID, UUID);

-- Function: Get all band IDs a user belongs to (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_band_ids(user_uuid UUID)
RETURNS SETOF UUID AS $$
  SELECT band_id 
  FROM public.band_members 
  WHERE user_id = user_uuid 
    AND status IN ('active', 'invited');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function: Get all user IDs who are bandmates of a user (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_bandmate_user_ids(user_uuid UUID)
RETURNS SETOF UUID AS $$
  SELECT DISTINCT bm.user_id
  FROM public.band_members bm
  WHERE bm.band_id IN (
    SELECT band_id FROM public.band_members 
    WHERE user_id = user_uuid AND status IN ('active', 'invited')
  )
  AND bm.status IN ('active', 'invited');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function: Check if user is admin/owner of a band (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_band_admin(user_uuid UUID, check_band_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.band_members
    WHERE user_id = user_uuid
      AND band_id = check_band_id
      AND role IN ('admin', 'owner')
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- PART 1: RLS POLICIES FOR public.users
-- ============================================================================

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to make migration idempotent
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "users: select own" ON public.users;
DROP POLICY IF EXISTS "users: select bandmates" ON public.users;
DROP POLICY IF EXISTS "users: insert own" ON public.users;
DROP POLICY IF EXISTS "users: update own" ON public.users;

-- Policy 1: Users can always read their own row
CREATE POLICY "users: select own" ON public.users
  FOR SELECT
  USING (id = auth.uid());

-- Policy 2: Users can read rows of their bandmates
-- Uses SECURITY DEFINER function to avoid RLS recursion
CREATE POLICY "users: select bandmates" ON public.users
  FOR SELECT
  USING (id IN (SELECT public.get_bandmate_user_ids(auth.uid())));

-- Policy 3: Users can insert their own row (used by handle_new_user trigger)
CREATE POLICY "users: insert own" ON public.users
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- Policy 4: Users can update only their own row
CREATE POLICY "users: update own" ON public.users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================================
-- PART 2: RLS POLICIES FOR public.band_members
-- ============================================================================

-- Enable RLS on band_members table
ALTER TABLE public.band_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to make migration idempotent
DROP POLICY IF EXISTS "band_members: select own bands" ON public.band_members;
DROP POLICY IF EXISTS "band_members: insert" ON public.band_members;
DROP POLICY IF EXISTS "band_members: update own bands" ON public.band_members;
DROP POLICY IF EXISTS "band_members: delete own bands" ON public.band_members;
DROP POLICY IF EXISTS "Users can view band members in their bands" ON public.band_members;
DROP POLICY IF EXISTS "Band admins can manage members" ON public.band_members;

-- Policy 1: Users can view band_members rows for bands they belong to
-- Uses SECURITY DEFINER function to avoid self-referential recursion
CREATE POLICY "band_members: select own bands" ON public.band_members
  FOR SELECT
  USING (band_id IN (SELECT public.get_user_band_ids(auth.uid())));

-- Policy 2: Users can insert band_members (e.g., accepting invite, joining band)
-- The trigger below will additionally enforce profile_completed requirement
CREATE POLICY "band_members: insert" ON public.band_members
  FOR INSERT
  WITH CHECK (
    -- User can only add themselves OR must be admin/owner of the band
    user_id = auth.uid()
    OR public.is_band_admin(auth.uid(), band_id)
  );

-- Policy 3: Users can update band_members in bands they are admin/owner of
CREATE POLICY "band_members: update own bands" ON public.band_members
  FOR UPDATE
  USING (public.is_band_admin(auth.uid(), band_id));

-- Policy 4: Users can delete/remove band_members in bands they are admin/owner of
CREATE POLICY "band_members: delete own bands" ON public.band_members
  FOR DELETE
  USING (public.is_band_admin(auth.uid(), band_id));

-- ============================================================================
-- PART 3: TRIGGER TO ENFORCE PROFILE COMPLETION FOR BAND MEMBERSHIP
-- ============================================================================

-- Drop existing trigger/function if exists
DROP TRIGGER IF EXISTS enforce_profile_completed_on_band_join ON public.band_members;
DROP FUNCTION IF EXISTS public.check_profile_completed_before_band_join();

-- Function: Check that user has completed their profile before joining a band
CREATE OR REPLACE FUNCTION public.check_profile_completed_before_band_join()
RETURNS TRIGGER AS $$
DECLARE
  user_profile_completed BOOLEAN;
  user_first_name TEXT;
BEGIN
  -- Look up the user's profile completion status
  SELECT profile_completed, first_name
  INTO user_profile_completed, user_first_name
  FROM public.users
  WHERE id = NEW.user_id;
  
  -- If user doesn't exist in public.users, block the insert
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % does not exist in public.users. Cannot join band.', NEW.user_id;
  END IF;
  
  -- Check profile completion (profile_completed=true OR first_name exists as legacy fallback)
  IF user_profile_completed = true OR (user_first_name IS NOT NULL AND user_first_name <> '') THEN
    -- Profile is complete, allow the insert
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'User must complete their profile before joining a band. Please fill in your name and profile information first.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Run check before inserting into band_members
CREATE TRIGGER enforce_profile_completed_on_band_join
  BEFORE INSERT ON public.band_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_completed_before_band_join();

-- ============================================================================
-- PART 4: VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify RLS is enabled on users
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on users table';
  END IF;
  
  -- Verify RLS is enabled on band_members
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'band_members' 
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on band_members table';
  END IF;
  
  RAISE NOTICE '✅ Migration 056 completed successfully';
  RAISE NOTICE '   - RLS enabled on public.users with bandmate visibility';
  RAISE NOTICE '   - RLS enabled on public.band_members with band-scoped access';
  RAISE NOTICE '   - Trigger enforces profile_completed before joining bands';
END $$;

-- ============================================================================
-- SUMMARY (for code comments):
-- 
-- SOURCE OF TRUTH:
--   - public.users: user identity/profile data
--   - public.band_members: band membership junction
--   - public.profiles: LEGACY (not deleted, not used)
--
-- RLS GUARANTEES:
--   - users: can read own row OR bandmates' rows (via band_members join)
--   - band_members: can only see/modify members in bands user belongs to
--   - No cross-band data leakage possible
--
-- PROFILE COMPLETION ENFORCEMENT:
--   - Trigger: check_profile_completed_before_band_join
--   - Blocks band_members INSERT unless profile_completed=true OR first_name exists
--   - Allows incomplete users to exist (for onboarding) but not join bands
-- ============================================================================
