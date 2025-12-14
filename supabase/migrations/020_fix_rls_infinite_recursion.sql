-- ============================================================================
-- FIX: Infinite Recursion in RLS Policies for bands/band_members
-- 
-- Problem: bands policy references band_members, band_members policy references
-- bands, causing PostgreSQL error 42P17.
--
-- Solution: Break the cycle by ensuring band_members policy does NOT reference
-- bands table. Only bands policy references band_members.
-- ============================================================================

-- Step 1: Enable RLS on both tables (idempotent)
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_members ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on bands (safe)
DROP POLICY IF EXISTS "Users can view bands they belong to" ON public.bands;
DROP POLICY IF EXISTS "Users can view their bands" ON public.bands;
DROP POLICY IF EXISTS "bands_select_policy" ON public.bands;
DROP POLICY IF EXISTS "Enable read access for band members" ON public.bands;
DROP POLICY IF EXISTS "select_bands" ON public.bands;
DROP POLICY IF EXISTS "Bands are viewable by members" ON public.bands;
DROP POLICY IF EXISTS "Allow band members to view bands" ON public.bands;

-- Step 3: Drop ALL existing policies on band_members (safe)
DROP POLICY IF EXISTS "Users can view band members" ON public.band_members;
DROP POLICY IF EXISTS "Users can view their band memberships" ON public.band_members;
DROP POLICY IF EXISTS "band_members_select_policy" ON public.band_members;
DROP POLICY IF EXISTS "Enable read access for users" ON public.band_members;
DROP POLICY IF EXISTS "select_band_members" ON public.band_members;
DROP POLICY IF EXISTS "Band members are viewable by band members" ON public.band_members;
DROP POLICY IF EXISTS "Allow users to view band members" ON public.band_members;

-- ============================================================================
-- NEW POLICIES (non-recursive)
-- ============================================================================

-- BAND_MEMBERS: User can see their own memberships only.
-- NO reference to bands table - this breaks the recursion cycle.
CREATE POLICY "band_members_select_own"
ON public.band_members
FOR SELECT
USING (user_id = auth.uid());

-- BANDS: User can see a band if they are a member of it.
-- References band_members, but band_members does NOT reference bands.
CREATE POLICY "bands_select_as_member"
ON public.bands
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.band_members
    WHERE band_members.band_id = bands.id
      AND band_members.user_id = auth.uid()
  )
);

-- ============================================================================
-- INSERT/UPDATE/DELETE policies (basic - adjust as needed)
-- ============================================================================

-- BAND_MEMBERS: User can insert their own membership (for accepting invites)
DROP POLICY IF EXISTS "band_members_insert_own" ON public.band_members;
CREATE POLICY "band_members_insert_own"
ON public.band_members
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- BAND_MEMBERS: User can update their own membership
DROP POLICY IF EXISTS "band_members_update_own" ON public.band_members;
CREATE POLICY "band_members_update_own"
ON public.band_members
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- BAND_MEMBERS: User can delete their own membership (leave band)
DROP POLICY IF EXISTS "band_members_delete_own" ON public.band_members;
CREATE POLICY "band_members_delete_own"
ON public.band_members
FOR DELETE
USING (user_id = auth.uid());

-- BANDS: Any authenticated user can create a band
DROP POLICY IF EXISTS "bands_insert_authenticated" ON public.bands;
CREATE POLICY "bands_insert_authenticated"
ON public.bands
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- BANDS: Only band members can update a band
DROP POLICY IF EXISTS "bands_update_as_member" ON public.bands;
CREATE POLICY "bands_update_as_member"
ON public.bands
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.band_members
    WHERE band_members.band_id = bands.id
      AND band_members.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.band_members
    WHERE band_members.band_id = bands.id
      AND band_members.user_id = auth.uid()
  )
);

-- ============================================================================
-- Verify policies are applied
-- ============================================================================
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('bands', 'band_members')
ORDER BY tablename, policyname;
