-- Add token field to band_invitations table for secure invite links
-- This enables token-based invites: /invite?token=<token>&email=<email>

ALTER TABLE public.band_invitations
ADD COLUMN IF NOT EXISTS token TEXT UNIQUE;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_band_invitations_token ON public.band_invitations(token);

-- Function to generate secure random tokens
CREATE OR REPLACE FUNCTION public.generate_invite_token()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  -- Generate 32-character random token
  FOR i IN 1..32 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Backfill tokens for existing invitations that don't have them
UPDATE public.band_invitations
SET token = public.generate_invite_token()
WHERE token IS NULL;

-- Make token NOT NULL after backfill
ALTER TABLE public.band_invitations
ALTER COLUMN token SET NOT NULL;

-- Add default for new rows
ALTER TABLE public.band_invitations
ALTER COLUMN token SET DEFAULT public.generate_invite_token();

-- Comment on column
COMMENT ON COLUMN public.band_invitations.token IS 'Secure random token for invite links. Used in /invite?token=<token>&email=<email> URLs';
