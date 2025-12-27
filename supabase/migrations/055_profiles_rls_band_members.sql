-- ============================================================================
-- Migration 055: Add RLS policies for profiles table
-- Allows band members to view each other's profile information
-- ============================================================================

-- Enable RLS on profiles table (if not already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to make migration idempotent)
DROP POLICY IF EXISTS "profiles: select own" ON public.profiles;
DROP POLICY IF EXISTS "profiles: select bandmates" ON public.profiles;
DROP POLICY IF EXISTS "profiles: insert own" ON public.profiles;
DROP POLICY IF EXISTS "profiles: update own" ON public.profiles;

-- Policy 1: Users can always read their own profile
CREATE POLICY "profiles: select own" ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- Policy 2: Users can read profiles of their bandmates
-- Uses a non-recursive approach to avoid infinite loops
CREATE POLICY "profiles: select bandmates" ON public.profiles
  FOR SELECT
  USING (
    id IN (
      SELECT bm2.user_id
      FROM public.band_members bm1
      INNER JOIN public.band_members bm2 ON bm1.band_id = bm2.band_id
      WHERE bm1.user_id = auth.uid()
        AND bm1.status IN ('active', 'invited')
        AND bm2.status IN ('active', 'invited')
    )
  );

-- Policy 3: Users can insert their own profile
CREATE POLICY "profiles: insert own" ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- Policy 4: Users can update their own profile
CREATE POLICY "profiles: update own" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Verify RLS is enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on profiles table';
  END IF;
  
  RAISE NOTICE 'Successfully added RLS policies for profiles table';
END $$;
