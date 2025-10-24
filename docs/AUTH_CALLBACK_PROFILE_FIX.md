# Auth Callback Profile Check Fix

## Issue Summary

**Problem**: Existing users with completed profiles were being incorrectly redirected to `/profile?welcome=true` instead of `/dashboard` after clicking magic links.

**Root Cause**: The auth callback route handler was querying for a `name` field that doesn't exist in the database schema, causing the profile check to always fail.

## Technical Details

### Database Schema (users table)

The actual fields in the `users` table are:

```sql
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,           -- ✅ EXISTS
  last_name TEXT,            -- ✅ EXISTS
  phone TEXT,
  address TEXT,
  city TEXT,
  zip TEXT,
  birthday DATE,
  roles TEXT[],
  profile_completed BOOLEAN DEFAULT FALSE,  -- ✅ EXISTS
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Note**: There is NO `name` field in the schema.

### The Bug

**File**: `app/auth/callback/route.ts` (line 114)

**Before (INCORRECT)**:

```typescript
const { data: profile, error: profileError } = await supabase
  .from('users')
  .select('name') // ❌ This field doesn't exist!
  .eq('id', user.id)
  .single();

const hasCompletedProfile = !profileError && profile?.name; // Always false
```

**Result**:

- The query either fails or returns a row with no `name` field
- `profile?.name` is always `null` or `undefined`
- `hasCompletedProfile` is always `false`
- ALL users (including existing ones) get redirected to `/profile?welcome=true`

## The Fix

**File**: `app/auth/callback/route.ts`

**After (CORRECT)**:

```typescript
const { data: profile, error: profileError } = await supabase
  .from('users')
  .select('first_name, last_name, profile_completed') // ✅ Actual fields
  .eq('id', user.id)
  .single();

// Profile is complete if profile_completed flag is true OR they have a first_name
const hasCompletedProfile = !profileError && (profile?.profile_completed || profile?.first_name);
```

### Logic Breakdown

A user is considered to have a "completed profile" if:

1. **Primary check**: `profile_completed === true` (explicitly set when user completes profile form)
2. **Fallback check**: `first_name` is populated (for existing users who may not have the flag set)

This dual-check approach ensures:

- ✅ New users without profiles go to `/profile?welcome=true`
- ✅ Existing users with profiles go to `/dashboard`
- ✅ Users who completed the profile form (flag set) always recognized as complete
- ✅ Legacy users with data but no flag still recognized as complete

## Verification

### Expected Behavior After Fix

| User Type                 | Database State                             | Redirect Destination           | Log Reason                  |
| ------------------------- | ------------------------------------------ | ------------------------------ | --------------------------- |
| New user (just signed up) | No `first_name`, `profile_completed=false` | `/profile?welcome=true`        | `new_user_profile_required` |
| Existing user (has name)  | Has `first_name`, any `profile_completed`  | `/dashboard`                   | `existing_user_default`     |
| Profile just completed    | Has `first_name`, `profile_completed=true` | `/dashboard`                   | `existing_user_default`     |
| With invitation           | Any state + `?invitation=xxx`              | `/api/invitations/{id}/accept` | `invitation`                |
| With custom next          | Complete profile + `?next=/gigs`           | `/gigs`                        | `existing_user_with_next`   |

### Testing Steps

1. **Test Existing User**:

   ```bash
   # Check your user record has first_name populated
   # Click magic link
   # Expected: Redirect to /dashboard
   # Expected log: [Auth Callback] User {id} → .../dashboard (reason: existing_user_default, hasProfile: true)
   ```

2. **Test New User**:

   ```bash
   # Create new account or clear first_name/profile_completed
   # Click magic link
   # Expected: Redirect to /profile?welcome=true
   # Expected log: [Auth Callback] User {id} → .../profile?welcome=true (reason: new_user_profile_required)
   ```

3. **Test Invitation Flow**:
   ```bash
   # Use magic link with ?invitation=xxx parameter
   # Expected: Redirect to /api/invitations/{id}/accept (regardless of profile state)
   # Expected log: [Auth Callback] User {id} → .../api/invitations/... (reason: invitation)
   ```

## Related Code

### Profile Completion Logic (Other Files)

**`app/(protected)/layout.tsx`**: Checks for complete profile before allowing access

```typescript
const isProfileComplete = (profile: {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  address?: string | null;
  zip?: string | null;
}) => {
  return profile.first_name && profile.last_name && profile.phone && profile.address && profile.zip;
};
```

**`app/api/profile/route.ts`**: Sets `profile_completed` flag when user updates profile

```typescript
const { error: updateError } = await supabase
  .from('users')
  .update({
    first_name,
    last_name,
    phone,
    address,
    zip,
    birthday,
    roles: roleNames.length > 0 ? roleNames : null,
    profile_completed: true, // ✅ Sets the flag
    updated_at: new Date().toISOString(),
  })
  .eq('id', user.id);
```

## Deployment

### Local Testing

```bash
# Dev server should auto-reload with the change
# If not, restart:
pnpm run dev
```

### Production Deployment

```bash
# Verify fix works locally first
# Then commit and push:
git add app/auth/callback/route.ts docs/AUTH_CALLBACK_PROFILE_FIX.md
git commit -m "fix(auth): correct profile completion check in auth callback

- Query actual database fields (first_name, profile_completed) instead of non-existent 'name' field
- Check profile_completed flag OR first_name presence for backward compatibility
- Fixes existing users being incorrectly routed to /profile instead of /dashboard

Resolves: Existing user redirect issue after magic link authentication"

git push origin main
```

## Risk Assessment

**Risk Level**: 🟢 **Very Low**

- ✅ Only changes field selection in database query
- ✅ More accurate check based on actual schema
- ✅ Backward compatible (checks multiple fields)
- ✅ No breaking changes
- ✅ Proper fallback logic

## Rollback Plan

If issues occur (unlikely):

```bash
# Revert the commit
git revert HEAD
git push origin main
```

Or manually change back to check only `profile_completed`:

```typescript
const { data: profile, error: profileError } = await supabase
  .from('users')
  .select('profile_completed')
  .eq('id', user.id)
  .single();

const hasCompletedProfile = !profileError && profile?.profile_completed;
```

## Files Modified

- ✅ `app/auth/callback/route.ts` (lines 111-119)
- ✅ `docs/AUTH_CALLBACK_PROFILE_FIX.md` (this file)

## Status

- ✅ Fix implemented
- ✅ Code updated
- ⏳ Awaiting user testing
- ⏳ Deployment pending

---

**Last Updated**: 2025-10-21  
**Author**: GitHub Copilot  
**Related Docs**:

- `SERVER_SIDE_PKCE_MIGRATION.md` - Overall auth migration
- `docs/AUTH_ROUTING_FIX.md` - Previous routing fix (had wrong field)
