-- ============================================================================
-- BANDROADIE: SEED DATA FOR TESTING
-- 
-- Run this AFTER the main migration.
-- Uses a test user UUID - replace with actual auth.users ID in production.
-- ============================================================================

-- For testing, we'll create seed data using a specific user ID
-- In real testing, replace these with actual user IDs from auth.users

DO $$
DECLARE
  -- Replace these with actual user IDs from your Supabase auth.users table
  test_user_1 UUID := '00000000-0000-0000-0000-000000000001';
  test_user_2 UUID := '00000000-0000-0000-0000-000000000002';
  
  test_band_id UUID;
  test_gig_id UUID;
BEGIN
  -- ========================================================================
  -- NOTE: This seed script is for DEVELOPMENT ONLY
  -- In production, users and data are created through the app.
  -- ========================================================================
  
  RAISE NOTICE 'Creating seed data...';
  
  -- Create a test band
  INSERT INTO bands (id, name, description, created_by)
  VALUES (
    gen_random_uuid(),
    'The Test Band',
    'A band for testing RLS policies',
    test_user_1
  )
  RETURNING id INTO test_band_id;
  
  RAISE NOTICE 'Created band: %', test_band_id;
  
  -- Note: The trigger will auto-add test_user_1 as owner
  
  -- Add second user as member
  INSERT INTO band_members (band_id, user_id, role, status)
  VALUES (test_band_id, test_user_2, 'member', 'active');
  
  RAISE NOTICE 'Added test_user_2 as member';
  
  -- Create a potential gig
  INSERT INTO gigs (id, band_id, title, venue, scheduled_at, status, created_by)
  VALUES (
    gen_random_uuid(),
    test_band_id,
    'New Year''s Eve Show',
    'The Venue',
    '2025-12-31 21:00:00+00',
    'potential',
    test_user_1
  )
  RETURNING id INTO test_gig_id;
  
  RAISE NOTICE 'Created potential gig: %', test_gig_id;
  
  -- Add RSVP response from user 1
  INSERT INTO gig_responses (gig_id, band_id, user_id, response, notes)
  VALUES (
    test_gig_id,
    test_band_id,
    test_user_1,
    'yes',
    'I can make it!'
  );
  
  RAISE NOTICE 'Added RSVP from test_user_1';
  
  -- Add RSVP response from user 2
  INSERT INTO gig_responses (gig_id, band_id, user_id, response, notes)
  VALUES (
    test_gig_id,
    test_band_id,
    test_user_2,
    'maybe',
    'Need to check my schedule'
  );
  
  RAISE NOTICE 'Added RSVP from test_user_2';
  
  -- Create a rehearsal
  INSERT INTO rehearsals (band_id, title, location, scheduled_at, created_by)
  VALUES (
    test_band_id,
    'Pre-show rehearsal',
    'Practice Space',
    '2025-12-30 18:00:00+00',
    test_user_1
  );
  
  RAISE NOTICE 'Created rehearsal';
  
  -- Create a pending invitation
  INSERT INTO band_invitations (band_id, email, invited_by, role)
  VALUES (
    test_band_id,
    'newmember@example.com',
    test_user_1,
    'member'
  );
  
  RAISE NOTICE 'Created invitation for newmember@example.com';
  
  RAISE NOTICE '✅ Seed data created successfully!';
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Seed data error (may already exist or test users not in auth.users): %', SQLERRM;
END $$;
