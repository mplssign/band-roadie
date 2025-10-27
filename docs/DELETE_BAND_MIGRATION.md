# Applying the Delete Band Function Migration

The delete band functionality requires a database function to be created. You have two options:

## Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the entire contents of `supabase/migrations/013_delete_band_function.sql`
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. You should see "Success. No rows returned"

## Option 2: Command Line (requires psql)

If you have the database connection string:

```bash
psql "your-connection-string-here" -f supabase/migrations/013_delete_band_function.sql
```

## Option 3: Node.js Script (Limited Support)

Note: Supabase's REST API doesn't directly support `CREATE FUNCTION` statements. Use Option 1 instead.

## Verification

After applying the migration, test the delete functionality:

1. Go to any band's Edit Band screen
2. Scroll to the bottom
3. Click "Delete Band"
4. Confirm the deletion
5. The band and all related data (members, gigs, rehearsals, setlists) should be deleted

## What This Migration Does

Creates a PostgreSQL function `delete_band(band_uuid UUID)` that:
- Deletes all band members
- Deletes all band invitations
- Deletes all gigs
- Deletes all rehearsals  
- Deletes all setlists
- Deletes the band itself

All in a single atomic transaction with `SECURITY DEFINER` permissions.
