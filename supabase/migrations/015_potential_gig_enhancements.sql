-- Migration: Potential gig enhancements
-- Adds optional member tracking and response table for gigs

ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS optional_member_ids UUID[] DEFAULT '{}'::uuid[];

CREATE TABLE IF NOT EXISTS public.gig_member_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  band_member_id UUID NOT NULL REFERENCES public.band_members(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('yes', 'no')),
  responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (gig_id, band_member_id)
);

CREATE INDEX IF NOT EXISTS idx_gig_member_responses_gig_id ON public.gig_member_responses(gig_id);
CREATE INDEX IF NOT EXISTS idx_gig_member_responses_band_member_id ON public.gig_member_responses(band_member_id);

ALTER TABLE public.gig_member_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can view gig responses" ON public.gig_member_responses;
DROP POLICY IF EXISTS "Band members can manage their gig responses" ON public.gig_member_responses;
DROP POLICY IF EXISTS "Band admins can manage gig responses" ON public.gig_member_responses;

CREATE POLICY "Band members can view gig responses" ON public.gig_member_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.gigs g
      JOIN public.band_members bm ON bm.band_id = g.band_id
      WHERE g.id = gig_member_responses.gig_id
        AND bm.user_id = auth.uid()
        AND bm.is_active = true
    )
  );

CREATE POLICY "Band members can manage their gig responses" ON public.gig_member_responses
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.band_members bm
      JOIN public.gigs g ON g.band_id = bm.band_id
      WHERE g.id = gig_member_responses.gig_id
        AND bm.user_id = auth.uid()
        AND bm.id = gig_member_responses.band_member_id
        AND bm.is_active = true
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.band_members bm
      JOIN public.gigs g ON g.band_id = bm.band_id
      WHERE g.id = gig_member_responses.gig_id
        AND bm.user_id = auth.uid()
        AND bm.id = gig_member_responses.band_member_id
        AND bm.is_active = true
    )
  );
