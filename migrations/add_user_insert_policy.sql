-- Add INSERT policy for users table
-- This allows users to create their own profile record if it doesn't exist

CREATE POLICY "Users can insert their own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);