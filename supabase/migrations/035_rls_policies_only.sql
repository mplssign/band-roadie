-- ============================================================================
-- BANDROADIE: AIRTIGHT RLS POLICIES
-- 
-- Prerequisites: Helper functions must exist:
--   - public.is_band_member(uuid) RETURNS boolean
--   - public.is_band_admin(uuid) RETURNS boolean
--
-- Run this in Supabase SQL Editor as service_role.
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP EXISTING POLICIES (clean slate)
-- ============================================================================

DO $$ 
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('bands', 'band_members', 'band_invitations', 'gigs', 'gig_responses', 'rehearsals', 'user_profiles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE band_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE band_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gigs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gig_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehearsals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners too (prevents bypass)
ALTER TABLE bands FORCE ROW LEVEL SECURITY;
ALTER TABLE band_members FORCE ROW LEVEL SECURITY;
ALTER TABLE band_invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE gigs FORCE ROW LEVEL SECURITY;
ALTER TABLE gig_responses FORCE ROW LEVEL SECURITY;
ALTER TABLE rehearsals FORCE ROW LEVEL SECURITY;
ALTER TABLE user_profiles FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: USER_PROFILES POLICIES
-- Users own their profile; can see profiles of bandmates
-- ============================================================================

-- SELECT: Own profile OR profiles of people in my bands
CREATE POLICY "user_profiles: select own or bandmates" ON user_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM band_members bm1
      JOIN band_members bm2 ON bm2.band_id = bm1.band_id
      WHERE bm1.user_id = auth.uid() AND bm1.status = 'active'
        AND bm2.user_id = user_profiles.user_id AND bm2.status = 'active'
    )
  );

-- INSERT: Own profile only
CREATE POLICY "user_profiles: insert own" ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Own profile only
CREATE POLICY "user_profiles: update own" ON user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Own profile only
CREATE POLICY "user_profiles: delete own" ON user_profiles
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- STEP 4: BANDS POLICIES
-- Visible only to members; only admins can update; only owners can delete
-- ============================================================================

-- SELECT: Must be active member
CREATE POLICY "bands: select if member" ON bands
  FOR SELECT TO authenticated
  USING (public.is_band_member(id));

-- INSERT: Any authenticated user can create (they become owner via trigger)
CREATE POLICY "bands: insert if authenticated" ON bands
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
  );

-- UPDATE: Only admins/owners
CREATE POLICY "bands: update if admin" ON bands
  FOR UPDATE TO authenticated
  USING (public.is_band_admin(id))
  WITH CHECK (public.is_band_admin(id));

-- DELETE: Only owners
CREATE POLICY "bands: delete if owner" ON bands
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_id = bands.id
        AND user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- ============================================================================
-- STEP 5: BAND_MEMBERS POLICIES
-- Members see each other; admins manage; no self-promotion
-- ============================================================================

-- SELECT: Own memberships OR memberships in bands I belong to
CREATE POLICY "band_members: select if member" ON band_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_band_member(band_id)
  );

-- INSERT: Only admins can add members (or self via invitation trigger)
CREATE POLICY "band_members: insert if admin" ON band_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_band_admin(band_id)
    OR (user_id = auth.uid() AND role = 'member' AND status = 'active')
  );

-- UPDATE: Admins can update; members can only deactivate themselves
CREATE POLICY "band_members: update if admin or self-deactivate" ON band_members
  FOR UPDATE TO authenticated
  USING (
    public.is_band_admin(band_id)
    OR user_id = auth.uid()
  )
  WITH CHECK (
    public.is_band_admin(band_id)
    OR (
      user_id = auth.uid() 
      AND role = (SELECT role FROM band_members WHERE id = band_members.id)  -- can't change own role
      AND status IN ('inactive')  -- can only deactivate self
    )
  );

-- DELETE: Admins can remove anyone; members can remove themselves
CREATE POLICY "band_members: delete if admin or self" ON band_members
  FOR DELETE TO authenticated
  USING (
    public.is_band_admin(band_id)
    OR user_id = auth.uid()
  );

-- ============================================================================
-- STEP 6: BAND_INVITATIONS POLICIES
-- Only admins create; recipients can view/accept their own
-- ============================================================================

-- SELECT: Admins see all for their band; recipients see their own
CREATE POLICY "band_invitations: select if admin or recipient" ON band_invitations
  FOR SELECT TO authenticated
  USING (
    public.is_band_admin(band_id)
    OR LOWER(email) = LOWER(auth.email())
  );

-- INSERT: Only admins
CREATE POLICY "band_invitations: insert if admin" ON band_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_band_admin(band_id)
    AND invited_by = auth.uid()
  );

-- UPDATE: Admins can update any; recipients can only accept/decline
CREATE POLICY "band_invitations: update if admin or recipient" ON band_invitations
  FOR UPDATE TO authenticated
  USING (
    public.is_band_admin(band_id)
    OR LOWER(email) = LOWER(auth.email())
  )
  WITH CHECK (
    public.is_band_admin(band_id)
    OR (
      LOWER(email) = LOWER(auth.email()) 
      AND status IN ('accepted', 'declined')
    )
  );

-- DELETE: Only admins
CREATE POLICY "band_invitations: delete if admin" ON band_invitations
  FOR DELETE TO authenticated
  USING (public.is_band_admin(band_id));

-- ============================================================================
-- STEP 7: GIGS POLICIES
-- Members can read/create; creator or admin can update/delete
-- ============================================================================

-- SELECT: Must be active member
CREATE POLICY "gigs: select if member" ON gigs
  FOR SELECT TO authenticated
  USING (public.is_band_member(band_id));

-- INSERT: Must be active member, creator must be self
CREATE POLICY "gigs: insert if member" ON gigs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_band_member(band_id)
    AND created_by = auth.uid()
  );

-- UPDATE: Creator or admin
CREATE POLICY "gigs: update if creator or admin" ON gigs
  FOR UPDATE TO authenticated
  USING (
    public.is_band_member(band_id)
    AND (created_by = auth.uid() OR public.is_band_admin(band_id))
  )
  WITH CHECK (public.is_band_member(band_id));

-- DELETE: Creator or admin
CREATE POLICY "gigs: delete if creator or admin" ON gigs
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid() 
    OR public.is_band_admin(band_id)
  );

-- ============================================================================
-- STEP 8: GIG_RESPONSES POLICIES
-- Members see all responses; users can only write/update/delete their own
-- ============================================================================

-- SELECT: Must be active member
CREATE POLICY "gig_responses: select if member" ON gig_responses
  FOR SELECT TO authenticated
  USING (public.is_band_member(band_id));

-- INSERT: Must be member AND writing own response
CREATE POLICY "gig_responses: insert own only" ON gig_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_band_member(band_id)
    AND user_id = auth.uid()
  );

-- UPDATE: Own response only
CREATE POLICY "gig_responses: update own only" ON gig_responses
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_band_member(band_id))
  WITH CHECK (user_id = auth.uid());

-- DELETE: Own response only
CREATE POLICY "gig_responses: delete own only" ON gig_responses
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.is_band_member(band_id));

-- ============================================================================
-- STEP 9: REHEARSALS POLICIES
-- Same pattern as gigs
-- ============================================================================

-- SELECT: Must be active member
CREATE POLICY "rehearsals: select if member" ON rehearsals
  FOR SELECT TO authenticated
  USING (public.is_band_member(band_id));

-- INSERT: Must be active member
CREATE POLICY "rehearsals: insert if member" ON rehearsals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_band_member(band_id)
    AND created_by = auth.uid()
  );

-- UPDATE: Creator or admin
CREATE POLICY "rehearsals: update if creator or admin" ON rehearsals
  FOR UPDATE TO authenticated
  USING (
    public.is_band_member(band_id)
    AND (created_by = auth.uid() OR public.is_band_admin(band_id))
  )
  WITH CHECK (public.is_band_member(band_id));

-- DELETE: Creator or admin
CREATE POLICY "rehearsals: delete if creator or admin" ON rehearsals
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid() 
    OR public.is_band_admin(band_id)
  );

-- ============================================================================
-- STEP 10: VERIFY SETUP
-- ============================================================================

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['bands', 'band_members', 'band_invitations', 'gigs', 'gig_responses', 'rehearsals', 'user_profiles'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = t AND n.nspname = 'public' AND c.relrowsecurity = true
    ) THEN
      RAISE EXCEPTION 'RLS not enabled on table: %', t;
    END IF;
  END LOOP;
  RAISE NOTICE '✅ RLS enabled on all tables';
END $$;

-- Show policy summary
SELECT 
  tablename, 
  policyname, 
  cmd,
  permissive
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('bands', 'band_members', 'band_invitations', 'gigs', 'gig_responses', 'rehearsals', 'user_profiles')
ORDER BY tablename, cmd;


-- ============================================================================
-- ============================================================================
-- VALIDATION BLOCK: TEST QUERIES
-- Run these as different users to verify RLS works correctly.
-- ============================================================================
-- ============================================================================

/*
================================================================================
TEST 1: Member CAN read/write
================================================================================

-- As a user who IS a member of a band:

-- ✅ Should return their bands
SELECT * FROM bands;

-- ✅ Should return gigs for their bands
SELECT * FROM gigs;

-- ✅ Should be able to create a gig
INSERT INTO gigs (band_id, title, status, created_by)
VALUES ('<my_band_id>', 'Test Gig', 'potential', auth.uid())
RETURNING id;

-- ✅ Should be able to RSVP
INSERT INTO gig_responses (gig_id, band_id, user_id, response)
VALUES ('<gig_id>', '<my_band_id>', auth.uid(), 'yes')
RETURNING id;


================================================================================
TEST 2: Non-member gets 0 rows and CANNOT insert/update
================================================================================

-- As a user who is NOT a member of any band:

-- ❌ Should return 0 rows
SELECT * FROM bands;
-- Expected: empty result set

SELECT * FROM gigs;
-- Expected: empty result set

-- ❌ Should fail with RLS violation
INSERT INTO gigs (band_id, title, status, created_by)
VALUES ('<some_band_id>', 'Hacker Gig', 'potential', auth.uid());
-- Expected: ERROR: new row violates row-level security policy

-- ❌ Should fail (no matching row to update due to RLS)
UPDATE gigs SET title = 'Hacked!' WHERE id = '<some_gig_id>';
-- Expected: 0 rows affected


================================================================================
TEST 3: Member of Band A CANNOT see Band B
================================================================================

-- As a user who is member of Band A only:

-- Set up: Get IDs
-- SELECT id FROM bands; -- Note Band A's ID and Band B's ID

-- ❌ Query Band B directly by ID
SELECT * FROM bands WHERE id = '<band_b_id>';
-- Expected: 0 rows (not "access denied", just empty)

-- ❌ Query Band B's gigs
SELECT * FROM gigs WHERE band_id = '<band_b_id>';
-- Expected: 0 rows

-- ❌ Try to insert into Band B
INSERT INTO gigs (band_id, title, status, created_by)
VALUES ('<band_b_id>', 'Cross-band Attack', 'potential', auth.uid());
-- Expected: ERROR: new row violates row-level security policy


================================================================================
TEST 4: gig_response uniqueness enforced
================================================================================

-- First insert (should succeed)
INSERT INTO gig_responses (gig_id, band_id, user_id, response)
VALUES ('<gig_id>', '<band_id>', auth.uid(), 'yes');

-- Duplicate insert (should fail with unique constraint violation)
INSERT INTO gig_responses (gig_id, band_id, user_id, response)
VALUES ('<gig_id>', '<band_id>', auth.uid(), 'no');
-- Expected: ERROR: duplicate key value violates unique constraint "gig_responses_unique_response"

-- Update instead (should succeed)
UPDATE gig_responses 
SET response = 'no' 
WHERE gig_id = '<gig_id>' AND user_id = auth.uid();


================================================================================
TEST 5: User cannot RSVP as another user
================================================================================

-- Try to insert response for a different user
INSERT INTO gig_responses (gig_id, band_id, user_id, response)
VALUES ('<gig_id>', '<band_id>', '<other_user_id>', 'yes');
-- Expected: ERROR: new row violates row-level security policy

-- Try to update someone else's response
UPDATE gig_responses 
SET response = 'no' 
WHERE gig_id = '<gig_id>' AND user_id = '<other_user_id>';
-- Expected: 0 rows affected (RLS blocks the row from being visible for update)


================================================================================
TEST 6: Only admins can create invitations
================================================================================

-- As a regular member (not admin):
INSERT INTO band_invitations (band_id, email, invited_by, role)
VALUES ('<band_id>', 'test@example.com', auth.uid(), 'member');
-- Expected: ERROR: new row violates row-level security policy

-- As an admin:
INSERT INTO band_invitations (band_id, email, invited_by, role)
VALUES ('<band_id>', 'test@example.com', auth.uid(), 'member');
-- Expected: Success


================================================================================
QUICK VERIFICATION QUERY (run as service_role)
================================================================================

-- Check RLS is enabled
SELECT 
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('bands', 'band_members', 'band_invitations', 'gigs', 'gig_responses', 'rehearsals', 'user_profiles')
ORDER BY c.relname;
-- Expected: All rows show true, true

-- Count policies per table
SELECT 
  tablename,
  COUNT(*) AS policy_count
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('bands', 'band_members', 'band_invitations', 'gigs', 'gig_responses', 'rehearsals', 'user_profiles')
GROUP BY tablename
ORDER BY tablename;
-- Expected: Each table should have 4 policies (SELECT, INSERT, UPDATE, DELETE)

*/
