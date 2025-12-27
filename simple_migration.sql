-- Simplified migration for testing - add is_catalog column and ensure uniqueness
-- Run this to add the is_catalog column to an existing database

-- Add the is_catalog column (boolean, default false)
ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS is_catalog BOOLEAN NOT NULL DEFAULT false;

-- Legacy: also add setlist_type for backwards compatibility
ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS setlist_type TEXT DEFAULT 'regular' CHECK (setlist_type IN ('regular', 'catalog'));

-- Create index for faster catalog lookups
CREATE INDEX IF NOT EXISTS idx_setlists_is_catalog ON public.setlists(band_id, is_catalog) WHERE is_catalog = true;

-- Legacy index
CREATE INDEX IF NOT EXISTS idx_setlists_type_band ON public.setlists(band_id, setlist_type);

-- Migrate existing data: mark "All Songs" or "Catalog" setlists
UPDATE public.setlists
SET is_catalog = true, name = 'Catalog', setlist_type = 'catalog'
WHERE LOWER(name) IN ('all songs', 'catalog') OR setlist_type = 'catalog';

-- Create unique partial index to enforce one catalog per band
DROP INDEX IF EXISTS idx_unique_catalog_per_band;
CREATE UNIQUE INDEX idx_unique_catalog_per_band ON public.setlists(band_id) WHERE is_catalog = true;