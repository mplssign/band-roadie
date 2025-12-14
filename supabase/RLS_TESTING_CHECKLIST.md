# BandRoadie RLS Testing Checklist

## Prerequisites

1. Run the migration: `supabase/migrations/030_rls_complete_schema.sql`
2. Create two test users in Supabase Auth (via magic link or dashboard)
3. Note their UUIDs from `auth.users` table
4. Have one user create a band (they become owner)
5. Add the second user as a member

## Test Setup

```sql
-- Get your test user IDs (run as service_role)
SELECT id, email FROM auth.users;

-- Verify band membership
SELECT b.name, bm.user_id, bm.role, bm.status 
FROM bands b 
JOIN band_members bm ON bm.band_id = b.id;
```

---

## ✅ Test 1: User in Band Can Read/Write

**As User A (band member):**

```sql
-- Set the session to user A (replace with actual UUID)
-- In Supabase SQL Editor, use "Run as" dropdown or set jwt

-- Should return the band
SELECT * FROM bands;

-- Should return band members
SELECT * FROM band_members;

-- Should be able to create a gig
INSERT INTO gigs (band_id, title, status, created_by)
VALUES ('<band_id>', 'Test Gig', 'potential', auth.uid())
RETURNING *;

-- Should be able to RSVP
INSERT INTO gig_responses (gig_id, band_id, user_id, response)
VALUES ('<gig_id>', '<band_id>', auth.uid(), 'yes')
RETURNING *;
```

**Expected:** All queries succeed, data is returned/inserted.

---

## ✅ Test 2: User NOT in Band Gets Zero Rows

**Create a new user (User C) who is NOT a member of any band:**

```sql
-- As User C
SELECT * FROM bands;
-- Expected: 0 rows

SELECT * FROM gigs;
-- Expected: 0 rows

SELECT * FROM band_members;
-- Expected: 0 rows (only their own, which is none)

-- Try to insert a gig into a band they don't belong to
INSERT INTO gigs (band_id, title, status, created_by)
VALUES ('<other_band_id>', 'Sneaky Gig', 'potential', auth.uid());
-- Expected: ERROR - violates RLS policy
```

**Expected:** Zero rows returned, inserts blocked.

---

## ✅ Test 3: User in Band A Cannot See Band B

**Setup:**
- User A is in Band A
- User B is in Band B (different band)
- User A knows Band B's UUID (simulating ID guessing)

```sql
-- As User A
-- Try to read Band B's data directly by ID
SELECT * FROM bands WHERE id = '<band_b_id>';
-- Expected: 0 rows

SELECT * FROM gigs WHERE band_id = '<band_b_id>';
-- Expected: 0 rows

SELECT * FROM band_members WHERE band_id = '<band_b_id>';
-- Expected: 0 rows

-- Try to insert into Band B
INSERT INTO gigs (band_id, title, status, created_by)
VALUES ('<band_b_id>', 'Cross-Band Attack', 'potential', auth.uid());
-- Expected: ERROR - violates RLS policy
```

**Expected:** Complete isolation. No cross-band data access.

---

## ✅ Test 4: Invitation Acceptance Flow

**Setup:**
1. Admin creates invitation for `newuser@example.com`
2. New user signs up with `newuser@example.com`
3. New user views and accepts invitation

```sql
-- Step 1: As Admin, create invitation
INSERT INTO band_invitations (band_id, email, invited_by, role)
VALUES ('<band_id>', 'newuser@example.com', auth.uid(), 'member')
RETURNING *;

-- Step 2: New user signs up via Supabase Auth (magic link)

-- Step 3: As new user, view pending invitations
SELECT * FROM band_invitations WHERE email = auth.email();
-- Expected: Returns the invitation

-- Step 4: Accept the invitation
UPDATE band_invitations 
SET status = 'accepted' 
WHERE id = '<invitation_id>' 
  AND email = auth.email();
-- Expected: Success, triggers auto-add to band_members

-- Step 5: Verify membership
SELECT * FROM band_members WHERE user_id = auth.uid();
-- Expected: Returns membership with role 'member'

-- Step 6: Verify can now see band
SELECT * FROM bands;
-- Expected: Returns the band
```

---

## ✅ Test 5: Users Can Only Write Own RSVP

```sql
-- As User A, try to create RSVP for User B
INSERT INTO gig_responses (gig_id, band_id, user_id, response)
VALUES ('<gig_id>', '<band_id>', '<user_b_id>', 'yes');
-- Expected: ERROR - violates RLS policy (user_id must equal auth.uid())

-- As User A, create own RSVP
INSERT INTO gig_responses (gig_id, band_id, user_id, response)
VALUES ('<gig_id>', '<band_id>', auth.uid(), 'yes');
-- Expected: Success
```

---

## ✅ Test 6: Only Admins Can Manage Members

```sql
-- As regular member (not admin)
INSERT INTO band_members (band_id, user_id, role, status)
VALUES ('<band_id>', '<random_user_id>', 'member', 'active');
-- Expected: ERROR - only admins can add members

-- As admin/owner
INSERT INTO band_members (band_id, user_id, role, status)
VALUES ('<band_id>', '<valid_user_id>', 'member', 'active');
-- Expected: Success
```

---

## ✅ Test 7: Only Admins Can Create Invitations

```sql
-- As regular member
INSERT INTO band_invitations (band_id, email, invited_by, role)
VALUES ('<band_id>', 'someone@example.com', auth.uid(), 'member');
-- Expected: ERROR - only admins can invite

-- As admin/owner
INSERT INTO band_invitations (band_id, email, invited_by, role)
VALUES ('<band_id>', 'someone@example.com', auth.uid(), 'member');
-- Expected: Success
```

---

## ✅ Test 8: Gig/Rehearsal Update/Delete Permissions

```sql
-- User A creates a gig
INSERT INTO gigs (band_id, title, status, created_by)
VALUES ('<band_id>', 'User A Gig', 'potential', auth.uid())
RETURNING id;

-- As User B (regular member, not creator)
UPDATE gigs SET title = 'Hijacked!' WHERE id = '<gig_id>';
-- Expected: ERROR or 0 rows updated (not creator, not admin)

-- As User A (creator)
UPDATE gigs SET title = 'Updated Title' WHERE id = '<gig_id>';
-- Expected: Success

-- As Admin (not creator)
UPDATE gigs SET title = 'Admin Override' WHERE id = '<gig_id>';
-- Expected: Success (admins can update any gig in their band)
```

---

## ✅ Test 9: Helper Functions Work Correctly

```sql
-- Test is_band_member (as authenticated user)
SELECT is_band_member('<my_band_id>');
-- Expected: true

SELECT is_band_member('<other_band_id>');
-- Expected: false

-- Test is_band_admin (as admin)
SELECT is_band_admin('<my_band_id>');
-- Expected: true (if admin/owner), false (if regular member)

-- Test get_user_band_ids
SELECT * FROM get_user_band_ids();
-- Expected: Returns all band IDs user belongs to
```

---

## ✅ Test 10: No RLS Recursion Errors

```sql
-- These should NOT throw "infinite recursion" errors

-- Complex nested query
SELECT b.*, 
       (SELECT COUNT(*) FROM band_members WHERE band_id = b.id) as member_count,
       (SELECT COUNT(*) FROM gigs WHERE band_id = b.id) as gig_count
FROM bands b;
-- Expected: Success, returns data

-- Multiple policy checks in one query
SELECT g.*, 
       (SELECT json_agg(gr.*) FROM gig_responses gr WHERE gr.gig_id = g.id) as responses
FROM gigs g;
-- Expected: Success, no recursion error
```

---

## Quick Validation Script

Run this as service_role to verify RLS is properly configured:

```sql
-- Check all tables have RLS enabled
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'user_profiles', 'bands', 'band_members', 
    'band_invitations', 'gigs', 'gig_responses', 'rehearsals'
  );
-- Expected: All should show rowsecurity = true

-- Check policies exist
SELECT 
  tablename, 
  policyname, 
  cmd 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
-- Expected: Multiple policies per table (SELECT, INSERT, UPDATE, DELETE)

-- Check helper functions exist
SELECT 
  routine_name, 
  security_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('is_band_member', 'is_band_admin', 'get_user_band_ids');
-- Expected: All three functions with DEFINER security
```

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "infinite recursion" error | Policy queries table with RLS | Use SECURITY DEFINER helper functions |
| User can't see their own band | Not in band_members or status != 'active' | Check band_members table |
| Invitation not working | Email case mismatch | Use LOWER() in comparisons |
| Can't create band | created_by != auth.uid() | Ensure created_by is set to auth.uid() |
| RSVP failing | user_id != auth.uid() | Client must set user_id to current user |

---

## Security Audit Checklist

- [ ] All band-scoped tables have RLS enabled
- [ ] All policies use `is_band_member()` or `is_band_admin()` 
- [ ] Helper functions are SECURITY DEFINER with locked search_path
- [ ] No direct auth.uid() checks that could bypass band membership
- [ ] Invitations properly validate email matches auth.email()
- [ ] Cross-band queries return 0 rows (not errors)
- [ ] Service role can still access everything (for backend operations)
