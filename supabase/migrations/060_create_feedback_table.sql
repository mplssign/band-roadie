-- ============================================================================
-- FEEDBACK TABLE
-- Stores bug reports and feature requests from users.
-- RLS: Users can insert their own feedback, admins can read all.
-- ============================================================================

-- Create the feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    type TEXT NOT NULL CHECK (type IN ('bug', 'feature')),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved', 'wontfix')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    notes TEXT -- Internal notes from admin review
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
    ON public.feedback
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
    );

-- Policy: Users can read their own feedback
CREATE POLICY "Users can read own feedback"
    ON public.feedback
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
    );

-- Grant permissions
GRANT SELECT, INSERT ON public.feedback TO authenticated;

-- Add comment
COMMENT ON TABLE public.feedback IS 'Bug reports and feature requests from users';
