# Testing Delete Band Functionality

## Prerequisites

1. The `delete_band` function must exist in your database
2. You must be an admin of the band you're trying to delete

## Check if Migration was Applied

### Via Supabase Dashboard:

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Database** → **Functions** in sidebar
4. Look for `delete_band` function
5. If it doesn't exist, apply the migration (see below)

### Apply Migration:

1. Go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `supabase/migrations/013_delete_band_function.sql`
4. Click **Run**
5. Should see "Success. No rows returned"

## Test Delete Band

### Via Browser Console:

```javascript
// Replace with your actual band ID
const bandId = 'your-band-id-here';

// Test the DELETE endpoint
fetch(`/api/bands/${bandId}`, {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
  },
})
  .then((res) => res.json())
  .then((data) => console.log('Delete response:', data))
  .catch((err) => console.error('Delete error:', err));
```

### Expected Response:

- **Success**: `{ ok: true }`
- **Failure**: `{ error: "..." }` with error message

## Common Errors

### Error: "Failed to delete band (db)"

- **Cause**: The `delete_band` function doesn't exist in database
- **Solution**: Apply the migration via SQL Editor

### Error: "Admin role required"

- **Cause**: You're not an admin of the band
- **Solution**: You must be a band admin to delete it

### Error: "Unauthorized"

- **Cause**: Not logged in
- **Solution**: Log in first

### Error: "Forbidden"

- **Cause**: Not a member of the band
- **Solution**: You must be a band member

## Manual Verification

After applying the migration, verify the function exists:

```sql
-- Run this in SQL Editor to check
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'delete_band';
```

Should return one row showing the function exists.

## Testing the Function Directly

```sql
-- Create a test band first
INSERT INTO public.bands (id, name, avatar_color, created_by)
VALUES (
  gen_random_uuid(),
  'Test Band to Delete',
  '#ff0000',
  'your-user-id-here'
)
RETURNING id;

-- Then test deleting it (use the returned ID)
SELECT delete_band('paste-band-id-here');
```

## What Gets Deleted

When you delete a band, these related records are removed:

1. All band members
2. All band invitations
3. All gigs
4. All rehearsals
5. All setlists
6. The band itself
7. Band images from storage (handled by API, not function)

All deletions happen in a single transaction - either all succeed or all fail.
