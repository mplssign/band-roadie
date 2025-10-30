-- Migration: Add multi-band scoping and indexes
-- Description: Ensure all band-scoped tables have proper indexes and RLS policies

-- 1. Add band_id to block_dates if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'block_dates' 
        AND column_name = 'band_id'
    ) THEN
        ALTER TABLE public.block_dates ADD COLUMN band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE;
        
        -- Backfill: For existing block_dates, try to infer band from user's membership
        -- This is a best-effort migration - you may need to clean up manually
        UPDATE public.block_dates bd
        SET band_id = (
            SELECT bm.band_id 
            FROM public.band_members bm 
            WHERE bm.user_id = bd.user_id 
            LIMIT 1
        )
        WHERE bd.band_id IS NULL AND bd.user_id IS NOT NULL;
        
        -- Make band_id NOT NULL after backfill
        ALTER TABLE public.block_dates ALTER COLUMN band_id SET NOT NULL;
    END IF;
END $$;

-- 2. Create indexes for band_id on all relevant tables
CREATE INDEX IF NOT EXISTS idx_block_dates_band_id ON public.block_dates(band_id);
CREATE INDEX IF NOT EXISTS idx_block_dates_band_date ON public.block_dates(band_id, date);
CREATE INDEX IF NOT EXISTS idx_rehearsals_band_id ON public.rehearsals(band_id);
CREATE INDEX IF NOT EXISTS idx_rehearsals_band_date ON public.rehearsals(band_id, date);
CREATE INDEX IF NOT EXISTS idx_gigs_band_id ON public.gigs(band_id);
CREATE INDEX IF NOT EXISTS idx_gigs_band_date ON public.gigs(band_id, date);
CREATE INDEX IF NOT EXISTS idx_gigs_band_potential ON public.gigs(band_id, is_potential);
CREATE INDEX IF NOT EXISTS idx_band_invitations_band_id ON public.band_invitations(band_id);
CREATE INDEX IF NOT EXISTS idx_band_invitations_status ON public.band_invitations(band_id, status);

-- 3. Add/update RLS policies for block_dates
ALTER TABLE public.block_dates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Band members can view block dates" ON public.block_dates;
DROP POLICY IF EXISTS "Band members can create block dates" ON public.block_dates;
DROP POLICY IF EXISTS "Band members can update their own block dates" ON public.block_dates;
DROP POLICY IF EXISTS "Band members can delete their own block dates" ON public.block_dates;

-- Create new band-scoped policies
CREATE POLICY "Band members can view block dates" ON public.block_dates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.band_members 
      WHERE band_id = block_dates.band_id 
      AND user_id = auth.uid() 
      AND is_active = true
    )
  );

CREATE POLICY "Band members can create block dates" ON public.block_dates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.band_members 
      WHERE band_id = block_dates.band_id 
      AND user_id = auth.uid() 
      AND is_active = true
    )
  );

CREATE POLICY "Band members can update their own block dates" ON public.block_dates
  FOR UPDATE USING (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.band_members 
      WHERE band_id = block_dates.band_id 
      AND user_id = auth.uid() 
      AND is_active = true
    )
  );

CREATE POLICY "Band members can delete their own block dates" ON public.block_dates
  FOR DELETE USING (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.band_members 
      WHERE band_id = block_dates.band_id 
      AND user_id = auth.uid() 
      AND is_active = true
    )
  );

-- 4. Ensure gigs table has proper RLS policies
ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can view gigs" ON public.gigs;
DROP POLICY IF EXISTS "Band members can create gigs" ON public.gigs;
DROP POLICY IF EXISTS "Band members can update gigs" ON public.gigs;
DROP POLICY IF EXISTS "Band members can delete gigs" ON public.gigs;

CREATE POLICY "Band members can view gigs" ON public.gigs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.band_members 
      WHERE band_id = gigs.band_id 
      AND user_id = auth.uid() 
      AND is_active = true
    )
  );

CREATE POLICY "Band members can create gigs" ON public.gigs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.band_members 
      WHERE band_id = gigs.band_id 
      AND user_id = auth.uid() 
      AND is_active = true
    )
  );

CREATE POLICY "Band members can update gigs" ON public.gigs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.band_members 
      WHERE band_id = gigs.band_id 
      AND user_id = auth.uid() 
      AND is_active = true
    )
  );

CREATE POLICY "Band members can delete gigs" ON public.gigs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.band_members 
      WHERE band_id = gigs.band_id 
      AND user_id = auth.uid() 
      AND is_active = true
    )
  );

-- 5. Ensure rehearsals table has proper RLS policies
ALTER TABLE public.rehearsals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can view rehearsals" ON public.rehearsals;
DROP POLICY IF EXISTS "Band members can create rehearsals" ON public.rehearsals;
DROP POLICY IF EXISTS "Band members can update rehearsals" ON public.rehearsals;
DROP POLICY IF EXISTS "Band members can delete rehearsals" ON public.rehearsals;

CREATE POLICY "Band members can view rehearsals" ON public.rehearsals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.band_members 
      WHERE band_id = rehearsals.band_id 
      AND user_id = auth.uid() 
      AND is_active = true
    )
  );

CREATE POLICY "Band members can create rehearsals" ON public.rehearsals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.band_members 
      WHERE band_id = rehearsals.band_id 
      AND user_id = auth.uid() 
      AND is_active = true
    )
  );

CREATE POLICY "Band members can update rehearsals" ON public.rehearsals
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.band_members 
      WHERE band_id = rehearsals.band_id 
      AND user_id = auth.uid() 
      AND is_active = true
    )
  );

CREATE POLICY "Band members can delete rehearsals" ON public.rehearsals
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.band_members 
      WHERE band_id = rehearsals.band_id 
      AND user_id = auth.uid() 
      AND is_active = true
    )
  );

-- 6. Add comment for documentation
COMMENT ON INDEX idx_rehearsals_band_date IS 'Optimizes queries for band-specific rehearsals by date';
COMMENT ON INDEX idx_gigs_band_date IS 'Optimizes queries for band-specific gigs by date';
COMMENT ON INDEX idx_block_dates_band_date IS 'Optimizes queries for band-specific block dates';
