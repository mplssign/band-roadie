-- Add missing RLS policies for band_members table
-- This table has RLS enabled but no policies, causing access issues

-- Allow users to view band memberships they are part of
CREATE POLICY "Users can view their own band memberships" ON public.band_members
  FOR SELECT USING (user_id = auth.uid());

-- Allow users to view other members in the same bands they are in
CREATE POLICY "Band members can view other band members" ON public.band_members
  FOR SELECT USING (
    band_id IN (
      SELECT band_id FROM public.band_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Allow band creators and admins to insert new members
CREATE POLICY "Band creators can add members" ON public.band_members
  FOR INSERT WITH CHECK (
    -- Check if user is the band creator
    band_id IN (
      SELECT id FROM public.bands 
      WHERE created_by = auth.uid()
    )
    OR
    -- Check if user is an admin member of the band
    band_id IN (
      SELECT band_id FROM public.band_members 
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- Allow users to update their own membership status
CREATE POLICY "Users can update their own membership" ON public.band_members
  FOR UPDATE USING (user_id = auth.uid());

-- Allow band creators and admins to update member statuses
CREATE POLICY "Band admins can update members" ON public.band_members
  FOR UPDATE USING (
    -- Check if user is the band creator
    band_id IN (
      SELECT id FROM public.bands 
      WHERE created_by = auth.uid()
    )
    OR
    -- Check if user is an admin member of the band
    band_id IN (
      SELECT band_id FROM public.band_members 
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- Allow band creators and admins to delete members
CREATE POLICY "Band admins can remove members" ON public.band_members
  FOR DELETE USING (
    -- Check if user is the band creator
    band_id IN (
      SELECT id FROM public.bands 
      WHERE created_by = auth.uid()
    )
    OR
    -- Check if user is an admin member of the band
    band_id IN (
      SELECT band_id FROM public.band_members 
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- Comment on the table
COMMENT ON TABLE public.band_members IS 'Junction table for band memberships with RLS policies for secure access';