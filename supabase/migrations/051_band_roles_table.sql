-- ============================================================================
-- Migration: 051_band_roles_table.sql
-- Purpose: Create band_roles table for band-scoped custom role labels
-- 
-- BAND SCOPING: Custom roles are visible ONLY within a specific band.
-- RLS enforces band partitioning - no cross-band leakage.
-- ============================================================================

-- Drop existing policies if re-running migration
DROP POLICY IF EXISTS "band_roles_select_policy" ON public.band_roles;
DROP POLICY IF EXISTS "band_roles_insert_policy" ON public.band_roles;
DROP POLICY IF EXISTS "band_roles_delete_policy" ON public.band_roles;
DROP POLICY IF EXISTS "band_roles_update_policy" ON public.band_roles;

-- Create the band_roles table
CREATE TABLE IF NOT EXISTS public.band_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add case-insensitive unique constraint on (band_id, name)
-- Prevents duplicate role names within the same band
CREATE UNIQUE INDEX IF NOT EXISTS band_roles_band_id_lower_name_unique
  ON public.band_roles (band_id, lower(name));

-- Create index for faster lookups by band_id
CREATE INDEX IF NOT EXISTS band_roles_band_id_idx
  ON public.band_roles (band_id);

-- Create index for faster lookups by created_by
CREATE INDEX IF NOT EXISTS band_roles_created_by_idx
  ON public.band_roles (created_by);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- Bulletproof band partitioning - uses direct EXISTS checks to avoid recursion
-- ============================================================================

-- Enable RLS
ALTER TABLE public.band_roles ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT - Only active band members can view roles for their bands
CREATE POLICY "band_roles_select_policy"
  ON public.band_roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.band_members
      WHERE band_members.band_id = band_roles.band_id
        AND band_members.user_id = auth.uid()
    )
  );

-- Policy: INSERT - Only active band members can add roles to their bands
-- created_by must equal the authenticated user
CREATE POLICY "band_roles_insert_policy"
  ON public.band_roles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.band_members
      WHERE band_members.band_id = band_roles.band_id
        AND band_members.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Policy: UPDATE - Only the creator or band admin/owner can update roles
CREATE POLICY "band_roles_update_policy"
  ON public.band_roles
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.band_members
      WHERE band_members.band_id = band_roles.band_id
        AND band_members.user_id = auth.uid()
        AND band_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.band_members
      WHERE band_members.band_id = band_roles.band_id
        AND band_members.user_id = auth.uid()
        AND band_members.role IN ('owner', 'admin')
    )
  );

-- Policy: DELETE - Only the creator or band admin/owner can delete roles
CREATE POLICY "band_roles_delete_policy"
  ON public.band_roles
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.band_members
      WHERE band_members.band_id = band_roles.band_id
        AND band_members.user_id = auth.uid()
        AND band_members.role IN ('owner', 'admin')
    )
  );

-- Grant permissions to authenticated users (RLS will restrict access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.band_roles TO authenticated;
