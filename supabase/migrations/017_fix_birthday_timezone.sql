-- Migration: Fix birthday timezone issues by updating dummy year
-- Description: Change birthday dummy year from 2000 to 1970 to avoid timezone edge cases

-- Update any birthdays that use 2000 as dummy year to use 1970 instead
-- This prevents timezone-related off-by-one errors when displaying birthdays
UPDATE public.users 
SET birthday = REPLACE(birthday::text, '2000-', '1970-')::date
WHERE birthday IS NOT NULL 
  AND EXTRACT(YEAR FROM birthday) = 2000;

-- Add a comment to document this change
COMMENT ON COLUMN public.users.birthday IS 'Date-only field for birthdays (MM-DD), uses 1970 as dummy year to avoid timezone issues';