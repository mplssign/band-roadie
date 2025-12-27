-- Migration: Add required_member_ids to gigs table
-- Purpose: Store which band members are required for potential gigs
-- This allows persisting the member selection when editing potential gigs

-- Add the column as a text array (stores UUIDs as strings)
ALTER TABLE gigs
ADD COLUMN IF NOT EXISTS required_member_ids TEXT[] DEFAULT '{}';

-- Add a comment explaining the column
COMMENT ON COLUMN gigs.required_member_ids IS 'Array of user IDs for band members required for this potential gig. Empty means all members are required.';
