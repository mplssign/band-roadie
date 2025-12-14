-- Create song_tuning_confirmations table for user-verified tunings
CREATE TABLE IF NOT EXISTS song_tuning_confirmations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  confirmed_tuning TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one confirmation per song per user per band
  UNIQUE(song_id, user_id, band_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_song_tuning_confirmations_song_id ON song_tuning_confirmations(song_id);
CREATE INDEX IF NOT EXISTS idx_song_tuning_confirmations_title_artist ON song_tuning_confirmations(title, artist);
CREATE INDEX IF NOT EXISTS idx_song_tuning_confirmations_user_id ON song_tuning_confirmations(user_id);
CREATE INDEX IF NOT EXISTS idx_song_tuning_confirmations_band_id ON song_tuning_confirmations(band_id);

-- Enable RLS
ALTER TABLE song_tuning_confirmations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own tuning confirmations" ON song_tuning_confirmations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Band members can view band tuning confirmations" ON song_tuning_confirmations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM band_members 
      WHERE band_members.band_id = song_tuning_confirmations.band_id 
      AND band_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own tuning confirmations" ON song_tuning_confirmations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tuning confirmations" ON song_tuning_confirmations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tuning confirmations" ON song_tuning_confirmations
  FOR DELETE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_song_tuning_confirmations_updated_at
  BEFORE UPDATE ON song_tuning_confirmations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();