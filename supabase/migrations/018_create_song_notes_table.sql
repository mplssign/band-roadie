-- Migration: Create song_notes table and add missing fields to songs table
-- Description: Allow band members to add notes/comments for songs within their band context
-- Also adds lyrics and album_artwork fields to songs table

-- Add missing fields to songs table
ALTER TABLE public.songs 
ADD COLUMN IF NOT EXISTS lyrics TEXT,
ADD COLUMN IF NOT EXISTS album_artwork TEXT;

-- Create indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_songs_album_artwork ON public.songs(album_artwork) WHERE album_artwork IS NOT NULL;

-- Song notes table
CREATE TABLE public.song_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE NOT NULL,
  band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_song_notes_song_band ON public.song_notes(song_id, band_id);
CREATE INDEX idx_song_notes_band_id ON public.song_notes(band_id);
CREATE INDEX idx_song_notes_created_by ON public.song_notes(created_by);
CREATE INDEX idx_song_notes_created_at ON public.song_notes(created_at DESC);

-- Enable RLS
ALTER TABLE public.song_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies - only band members can access notes for their band
CREATE POLICY "Band members can view song notes for their band" ON public.song_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.band_members 
      WHERE band_id = song_notes.band_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Band members can create song notes for their band" ON public.song_notes
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.band_members 
      WHERE band_id = song_notes.band_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own song notes" ON public.song_notes
  FOR UPDATE USING (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.band_members 
      WHERE band_id = song_notes.band_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own song notes" ON public.song_notes
  FOR DELETE USING (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.band_members 
      WHERE band_id = song_notes.band_id 
      AND user_id = auth.uid()
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_song_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at on song_notes updates
CREATE TRIGGER update_song_notes_updated_at_trigger
  BEFORE UPDATE ON public.song_notes
  FOR EACH ROW EXECUTE FUNCTION update_song_notes_updated_at();