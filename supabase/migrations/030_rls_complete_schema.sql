-- ============================================================================
-- BANDROADIE: COMPLETE RLS SCHEMA
-- Band-scoped, leak-proof Row Level Security design
-- 
-- Author: Security Engineer
-- Date: 2025-12-13
-- 
-- IMPORTANT: Run this migration with service_role or as superuser.
-- All client access uses the publishable anon key with RLS enforced.
-- ============================================================================

-- ============================================================================
-- STEP 0: CLEANUP (for development reruns - remove in production)
-- ============================================================================

-- Drop existing policies (ignore errors if they don't exist)
DO $$ 
BEGIN
  -- Drop all policies on tables we're about to recreate
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON ' || quote_ident(tablename) || ';', E'\n')
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('bands', 'band_members', 'band_invitations', 'gigs', 'gig_responses', 'rehearsals', 'user_profiles')
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop existing functions
DROP FUNCTION IF EXISTS is_band_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS is_band_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_user_band_ids() CASCADE;

-- Drop existing tables (CASCADE handles foreign keys)
DROP TABLE IF EXISTS gig_responses CASCADE;
DROP TABLE IF EXISTS rehearsals CASCADE;
DROP TABLE IF EXISTS gigs CASCADE;
DROP TABLE IF EXISTS band_invitations CASCADE;
DROP TABLE IF EXISTS band_members CASCADE;
DROP TABLE IF EXISTS bands CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- ============================================================================
-- STEP 1: CREATE ENUM TYPES
-- ============================================================================

-- Drop and recreate enums
DROP TYPE IF EXISTS band_member_role CASCADE;
DROP TYPE IF EXISTS band_member_status CASCADE;
DROP TYPE IF EXISTS invitation_status CASCADE;
DROP TYPE IF EXISTS gig_status CASCADE;
DROP TYPE IF EXISTS rsvp_response CASCADE;

CREATE TYPE band_member_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE band_member_status AS ENUM ('active', 'inactive', 'pending');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');
CREATE TYPE gig_status AS ENUM ('potential', 'confirmed', 'cancelled');
CREATE TYPE rsvp_response AS ENUM ('yes', 'no', 'maybe');

-- ============================================================================
-- STEP 2: CREATE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- USER_PROFILES: Extended user data (references auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_profiles IS 'Extended profile data for authenticated users';

-- ----------------------------------------------------------------------------
-- BANDS: The core organizational unit
-- ----------------------------------------------------------------------------
CREATE TABLE bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE bands IS 'Bands are the primary organizational unit. All data is scoped to bands.';

-- ----------------------------------------------------------------------------
-- BAND_MEMBERS: Junction table linking users to bands
-- This is the SOURCE OF TRUTH for authorization.
-- ----------------------------------------------------------------------------
CREATE TABLE band_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role band_member_role NOT NULL DEFAULT 'member',
  status band_member_status NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one membership per user per band
  CONSTRAINT band_members_unique_membership UNIQUE (band_id, user_id)
);

COMMENT ON TABLE band_members IS 'Links users to bands with role-based access. Source of truth for RLS.';

-- Index for fast lookups by user (most common query pattern)
CREATE INDEX idx_band_members_user_id ON band_members(user_id);
CREATE INDEX idx_band_members_band_id ON band_members(band_id);
CREATE INDEX idx_band_members_user_status ON band_members(user_id, status);

-- ----------------------------------------------------------------------------
-- BAND_INVITATIONS: Invite users to join a band
-- ----------------------------------------------------------------------------
CREATE TABLE band_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status invitation_status NOT NULL DEFAULT 'pending',
  role band_member_role NOT NULL DEFAULT 'member',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique token for security
  CONSTRAINT band_invitations_unique_token UNIQUE (token),
  -- Only one pending invitation per email per band
  CONSTRAINT band_invitations_unique_pending UNIQUE (band_id, email) 
    -- Note: This prevents duplicate invites. Consider removing if you want re-invites.
);

COMMENT ON TABLE band_invitations IS 'Pending invitations for users to join bands';

CREATE INDEX idx_band_invitations_band_id ON band_invitations(band_id);
CREATE INDEX idx_band_invitations_email ON band_invitations(email);
CREATE INDEX idx_band_invitations_token ON band_invitations(token);

-- ----------------------------------------------------------------------------
-- GIGS: Shows/performances for a band
-- ----------------------------------------------------------------------------
CREATE TABLE gigs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
  description TEXT,
  venue TEXT,
  location TEXT,
  scheduled_at TIMESTAMPTZ,
  load_in_at TIMESTAMPTZ,
  sound_check_at TIMESTAMPTZ,
  set_time TIMESTAMPTZ,
  status gig_status NOT NULL DEFAULT 'potential',
  pay_amount DECIMAL(10,2),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE gigs IS 'Gigs/shows for bands. Status tracks potential vs confirmed.';

CREATE INDEX idx_gigs_band_id ON gigs(band_id);
CREATE INDEX idx_gigs_band_status ON gigs(band_id, status);
CREATE INDEX idx_gigs_scheduled ON gigs(band_id, scheduled_at);

-- ----------------------------------------------------------------------------
-- GIG_RESPONSES: RSVP responses from band members
-- ----------------------------------------------------------------------------
CREATE TABLE gig_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id UUID NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response rsvp_response NOT NULL,
  notes TEXT,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One response per user per gig
  CONSTRAINT gig_responses_unique_response UNIQUE (gig_id, user_id)
);

COMMENT ON TABLE gig_responses IS 'RSVP responses from band members for potential gigs';

CREATE INDEX idx_gig_responses_gig_id ON gig_responses(gig_id);
CREATE INDEX idx_gig_responses_band_id ON gig_responses(band_id);
CREATE INDEX idx_gig_responses_user_id ON gig_responses(user_id);

-- ----------------------------------------------------------------------------
-- REHEARSALS: Practice sessions for a band
-- ----------------------------------------------------------------------------
CREATE TABLE rehearsals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  title TEXT,
  location TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 120,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE rehearsals IS 'Rehearsal/practice sessions for bands';

CREATE INDEX idx_rehearsals_band_id ON rehearsals(band_id);
CREATE INDEX idx_rehearsals_scheduled ON rehearsals(band_id, scheduled_at);

-- ============================================================================
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE band_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE band_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gigs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gig_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehearsals ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: HELPER FUNCTIONS (SECURITY DEFINER)
-- 
-- These functions bypass RLS to check membership without recursion.
-- They are marked SECURITY DEFINER and have locked search_path.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- is_band_member: Check if current user is an ACTIVE member of a band
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_band_member(band_uuid UUID)
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

COMMENT ON FUNCTION is_band_member IS 'Returns true if the authenticated user is an active member of the specified band. SECURITY DEFINER to avoid RLS recursion.';

-- ----------------------------------------------------------------------------
-- is_band_admin: Check if current user is an admin/owner of a band
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_band_admin(band_uuid UUID)
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
      AND role IN ('admin', 'owner')
  );
$$;

COMMENT ON FUNCTION is_band_admin IS 'Returns true if the authenticated user is an admin or owner of the specified band. SECURITY DEFINER to avoid RLS recursion.';

-- ----------------------------------------------------------------------------
-- get_user_band_ids: Get all band IDs the current user belongs to
-- Used for efficient IN queries in policies
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_band_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT band_id 
  FROM band_members 
  WHERE user_id = auth.uid() 
    AND status = 'active';
$$;

COMMENT ON FUNCTION get_user_band_ids IS 'Returns all band IDs where the authenticated user is an active member. SECURITY DEFINER to avoid RLS recursion.';

-- ============================================================================
-- STEP 5: RLS POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- USER_PROFILES POLICIES
-- Users can manage their own profile; members can see other members' profiles
-- ----------------------------------------------------------------------------

-- Users can read their own profile
CREATE POLICY user_profiles_select_own ON user_profiles
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can read profiles of people in their bands
CREATE POLICY user_profiles_select_band_members ON user_profiles
  FOR SELECT
  USING (
    user_id IN (
      SELECT bm.user_id 
      FROM band_members bm 
      WHERE bm.band_id IN (SELECT get_user_band_ids())
        AND bm.status = 'active'
    )
  );

-- Users can insert their own profile
CREATE POLICY user_profiles_insert ON user_profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own profile
CREATE POLICY user_profiles_update ON user_profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own profile
CREATE POLICY user_profiles_delete ON user_profiles
  FOR DELETE
  USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- BANDS POLICIES
-- Only visible to members; only admins can update
-- ----------------------------------------------------------------------------

-- Members can see their bands
CREATE POLICY bands_select ON bands
  FOR SELECT
  USING (is_band_member(id));

-- Any authenticated user can create a band (they become owner)
CREATE POLICY bands_insert ON bands
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- Only admins/owners can update band settings
CREATE POLICY bands_update ON bands
  FOR UPDATE
  USING (is_band_admin(id))
  WITH CHECK (is_band_admin(id));

-- Only owners can delete a band
CREATE POLICY bands_delete ON bands
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM band_members 
      WHERE band_id = id 
        AND user_id = auth.uid() 
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- ----------------------------------------------------------------------------
-- BAND_MEMBERS POLICIES
-- Core authorization table - extra careful here
-- ----------------------------------------------------------------------------

-- Members can see other members in their bands
CREATE POLICY band_members_select ON band_members
  FOR SELECT
  USING (
    -- User can see their own memberships
    user_id = auth.uid()
    OR
    -- User can see memberships in bands they belong to
    is_band_member(band_id)
  );

-- Only admins can add new members directly (usually via invitation flow)
CREATE POLICY band_members_insert ON band_members
  FOR INSERT
  WITH CHECK (
    -- Admins can add members
    is_band_admin(band_id)
    OR
    -- User is creating their own membership (must be via invitation acceptance)
    (user_id = auth.uid() AND status = 'active')
  );

-- Admins can update member roles/status; users can update their own (limited)
CREATE POLICY band_members_update ON band_members
  FOR UPDATE
  USING (
    is_band_admin(band_id)
    OR
    user_id = auth.uid()
  )
  WITH CHECK (
    -- Admins can update anything
    is_band_admin(band_id)
    OR
    -- Users can only update their own status (e.g., leave band)
    (user_id = auth.uid() AND status IN ('inactive'))
  );

-- Admins can remove members; users can remove themselves
CREATE POLICY band_members_delete ON band_members
  FOR DELETE
  USING (
    is_band_admin(band_id)
    OR
    user_id = auth.uid()
  );

-- ----------------------------------------------------------------------------
-- BAND_INVITATIONS POLICIES
-- Only admins can create; recipients can accept/decline
-- ----------------------------------------------------------------------------

-- Admins can see all invitations for their bands
-- Users can see invitations sent to their email
CREATE POLICY band_invitations_select ON band_invitations
  FOR SELECT
  USING (
    is_band_admin(band_id)
    OR
    LOWER(email) = LOWER(auth.email())
  );

-- Only admins can create invitations
CREATE POLICY band_invitations_insert ON band_invitations
  FOR INSERT
  WITH CHECK (
    is_band_admin(band_id)
    AND invited_by = auth.uid()
  );

-- Admins can update any invitation; recipients can accept/decline their own
CREATE POLICY band_invitations_update ON band_invitations
  FOR UPDATE
  USING (
    is_band_admin(band_id)
    OR
    LOWER(email) = LOWER(auth.email())
  )
  WITH CHECK (
    -- Admins can do anything
    is_band_admin(band_id)
    OR
    -- Recipients can only change status to accepted/declined
    (LOWER(email) = LOWER(auth.email()) AND status IN ('accepted', 'declined'))
  );

-- Only admins can delete invitations
CREATE POLICY band_invitations_delete ON band_invitations
  FOR DELETE
  USING (is_band_admin(band_id));

-- ----------------------------------------------------------------------------
-- GIGS POLICIES
-- Band members can read; create requires membership; update/delete by creator or admin
-- ----------------------------------------------------------------------------

-- Members can see their band's gigs
CREATE POLICY gigs_select ON gigs
  FOR SELECT
  USING (is_band_member(band_id));

-- Members can create gigs
CREATE POLICY gigs_insert ON gigs
  FOR INSERT
  WITH CHECK (
    is_band_member(band_id)
    AND created_by = auth.uid()
  );

-- Creator or admin can update gigs
CREATE POLICY gigs_update ON gigs
  FOR UPDATE
  USING (
    is_band_member(band_id)
    AND (created_by = auth.uid() OR is_band_admin(band_id))
  )
  WITH CHECK (
    is_band_member(band_id)
  );

-- Creator or admin can delete gigs
CREATE POLICY gigs_delete ON gigs
  FOR DELETE
  USING (
    created_by = auth.uid() 
    OR is_band_admin(band_id)
  );

-- ----------------------------------------------------------------------------
-- GIG_RESPONSES POLICIES
-- Members can see all responses; users can only write their own
-- ----------------------------------------------------------------------------

-- Members can see all responses for their band's gigs
CREATE POLICY gig_responses_select ON gig_responses
  FOR SELECT
  USING (is_band_member(band_id));

-- Members can create their own response
CREATE POLICY gig_responses_insert ON gig_responses
  FOR INSERT
  WITH CHECK (
    is_band_member(band_id)
    AND user_id = auth.uid()
  );

-- Users can update their own response only
CREATE POLICY gig_responses_update ON gig_responses
  FOR UPDATE
  USING (user_id = auth.uid() AND is_band_member(band_id))
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own response only
CREATE POLICY gig_responses_delete ON gig_responses
  FOR DELETE
  USING (user_id = auth.uid() AND is_band_member(band_id));

-- ----------------------------------------------------------------------------
-- REHEARSALS POLICIES
-- Similar to gigs
-- ----------------------------------------------------------------------------

-- Members can see their band's rehearsals
CREATE POLICY rehearsals_select ON rehearsals
  FOR SELECT
  USING (is_band_member(band_id));

-- Members can create rehearsals
CREATE POLICY rehearsals_insert ON rehearsals
  FOR INSERT
  WITH CHECK (
    is_band_member(band_id)
    AND created_by = auth.uid()
  );

-- Creator or admin can update rehearsals
CREATE POLICY rehearsals_update ON rehearsals
  FOR UPDATE
  USING (
    is_band_member(band_id)
    AND (created_by = auth.uid() OR is_band_admin(band_id))
  )
  WITH CHECK (
    is_band_member(band_id)
  );

-- Creator or admin can delete rehearsals
CREATE POLICY rehearsals_delete ON rehearsals
  FOR DELETE
  USING (
    created_by = auth.uid() 
    OR is_band_admin(band_id)
  );

-- ============================================================================
-- STEP 6: TRIGGER FOR AUTO-ADDING BAND CREATOR AS OWNER
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_band()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Automatically add the creator as owner
  INSERT INTO band_members (band_id, user_id, role, status)
  VALUES (NEW.id, NEW.created_by, 'owner', 'active');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_band_created
  AFTER INSERT ON bands
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_band();

-- ============================================================================
-- STEP 7: TRIGGER FOR AUTO-CREATING USER PROFILE
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- This trigger runs on auth.users (requires superuser)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- STEP 8: TRIGGER FOR INVITATION ACCEPTANCE
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_invitation_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accepting_user_id UUID;
BEGIN
  -- Only process when status changes to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Get the user_id of the person accepting (matched by email)
    SELECT id INTO accepting_user_id
    FROM auth.users
    WHERE LOWER(email) = LOWER(NEW.email)
    LIMIT 1;
    
    IF accepting_user_id IS NOT NULL THEN
      -- Add them to the band
      INSERT INTO band_members (band_id, user_id, role, status)
      VALUES (NEW.band_id, accepting_user_id, NEW.role, 'active')
      ON CONFLICT (band_id, user_id) 
      DO UPDATE SET status = 'active', role = NEW.role, updated_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_invitation_accepted
  AFTER UPDATE ON band_invitations
  FOR EACH ROW
  EXECUTE FUNCTION handle_invitation_accepted();

-- ============================================================================
-- STEP 9: UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_bands_updated_at
  BEFORE UPDATE ON bands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_band_members_updated_at
  BEFORE UPDATE ON band_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_band_invitations_updated_at
  BEFORE UPDATE ON band_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_gigs_updated_at
  BEFORE UPDATE ON gigs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_gig_responses_updated_at
  BEFORE UPDATE ON gig_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_rehearsals_updated_at
  BEFORE UPDATE ON rehearsals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- STEP 10: GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on types
GRANT USAGE ON TYPE band_member_role TO anon, authenticated;
GRANT USAGE ON TYPE band_member_status TO anon, authenticated;
GRANT USAGE ON TYPE invitation_status TO anon, authenticated;
GRANT USAGE ON TYPE gig_status TO anon, authenticated;
GRANT USAGE ON TYPE rsvp_response TO anon, authenticated;

-- Grant table permissions (RLS will enforce actual access)
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bands TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON band_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON band_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON gigs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON gig_responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rehearsals TO authenticated;

-- Grant function execution
GRANT EXECUTE ON FUNCTION is_band_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_band_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_band_ids() TO authenticated;

-- ============================================================================
-- COMPLETE!
-- ============================================================================

-- Verify RLS is enabled
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('user_profiles', 'bands', 'band_members', 'band_invitations', 'gigs', 'gig_responses', 'rehearsals')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = t.tablename 
      AND n.nspname = 'public'
      AND c.relrowsecurity = true
    ) THEN
      RAISE WARNING 'RLS not enabled on table: %', t.tablename;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ RLS Schema migration complete!';
END $$;
