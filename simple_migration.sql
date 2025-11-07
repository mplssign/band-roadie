-- Simplified migration for testing - just add the setlist_type column
ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS setlist_type TEXT DEFAULT 'regular' CHECK (setlist_type IN ('regular', 'all_songs'));
CREATE INDEX IF NOT EXISTS idx_setlists_type_band ON public.setlists(band_id, setlist_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_all_songs_per_band ON public.setlists(band_id) WHERE setlist_type = 'all_songs';