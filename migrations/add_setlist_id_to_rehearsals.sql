-- Add setlist_id column to rehearsals table
ALTER TABLE rehearsals
ADD COLUMN IF NOT EXISTS setlist_id UUID REFERENCES setlists(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_rehearsals_setlist_id ON rehearsals(setlist_id);

-- Add comment for documentation
COMMENT ON COLUMN rehearsals.setlist_id IS 'Optional reference to the setlist for this rehearsal';
