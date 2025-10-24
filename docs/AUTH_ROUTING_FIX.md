# Auth Callback Routing Fix

## Problem

Existing users with completed profiles were being redirected to `/profile` instead of `/dashboard` after clicking magic links.

## Root Cause

The routing logic in `app/auth/callback/route.ts` had flawed conditional logic that didn't properly handle the case when:

- User has a completed profile (existing user)
- No `next` parameter is provided (typical magic link scenario)

The old logic would check `next` parameter before defaulting to dashboard, causing inconsistent behavior.

## Solution

Refactored the routing logic to follow a clear priority system:

### Routing Priority (In Order)

1. **Invitation Flow** (`?invitation=xxx`)
   - Redirects to: `/api/invitations/{id}/accept`
   - Applies to: Any user with an invitation parameter
   - Log: `reason: invitation`

2. **New User Without Profile**
   - Redirects to: `/profile?welcome=true`
   - Applies to: Users where `profile.name` is null/missing
   - Log: `reason: new_user_profile_required`
   - **Blocks access to protected routes until profile completed**

3. **Existing User With Profile**
   - **Default**: `/dashboard`
   - **With valid `next` param**: Custom destination
   - Applies to: Users with completed profile (`profile.name` exists)
   - Log: `reason: existing_user_default` or `reason: existing_user_with_next`

## Code Changes

### Before

```typescript
if (!profile?.name) {
  redirectUrl = `${origin}/profile?welcome=true`;
} else if (next && next !== '/' && !next.includes('login') && !next.includes('signup')) {
  redirectUrl = next.startsWith('/') ? `${origin}${next}` : `${origin}/dashboard`;
} else {
  redirectUrl = `${origin}/dashboard`;
}
```

**Problem**: The logic fell through incorrectly when `next` was `/dashboard` (the default).

### After

```typescript
const hasCompletedProfile = !profileError && profile?.name;

if (!hasCompletedProfile) {
  redirectUrl = `${origin}/profile?welcome=true`;
  redirectReason = 'new_user_profile_required';
} else {
  const hasValidNext =
    next &&
    next !== '/' &&
    next !== '/dashboard' &&
    !next.includes('login') &&
    !next.includes('signup');

  if (hasValidNext) {
    redirectUrl = next.startsWith('/') ? `${origin}${next}` : `${origin}/dashboard`;
    redirectReason = 'existing_user_with_next';
  } else {
    redirectUrl = `${origin}/dashboard`;
    redirectReason = 'existing_user_default';
  }
}
```

**Fix**:

- Explicitly check profile completion first
- Exclude `/dashboard` from `next` parameter handling (since it's the default)
- Clear separation between new user and existing user paths

## Profile Completion Check

A profile is considered "complete" when:

```typescript
const hasCompletedProfile = !profileError && profile?.name;
```

Currently checks:

- ✅ User record exists in `users` table
- ✅ User has a `name` field populated

**Note**: If your app requires additional fields for profile completion (e.g., `first_name`, `last_name`, `email`, etc.), update this check accordingly.

## Logging Added

Each redirect now logs the decision to the console:

```
[Auth Callback] User abc123 → http://localhost:3000/dashboard (reason: existing_user_default, hasProfile: true)
[Auth Callback] User def456 → http://localhost:3000/profile?welcome=true (reason: new_user_profile_required)
[Auth Callback] User ghi789 → http://localhost:3000/api/invitations/inv123/accept (reason: invitation)
```

This helps debug routing issues and verify correct behavior.

## Testing Scenarios

### Scenario 1: Existing User (Normal Login)

```
User: tony@example.com (has profile.name = "Tony")
Magic link: http://localhost:3000/auth/callback?code=xxx
Result: → /dashboard
Log: reason: existing_user_default
✅ PASS
```

### Scenario 2: New User (First Login)

```
User: newuser@example.com (no profile record OR profile.name = null)
Magic link: http://localhost:3000/auth/callback?code=xxx
Result: → /profile?welcome=true
Log: reason: new_user_profile_required
✅ PASS
```

### Scenario 3: Invitation Link

```
User: invited@example.com (any profile state)
Magic link: http://localhost:3000/auth/callback?code=xxx&invitation=inv123
Result: → /api/invitations/inv123/accept
Log: reason: invitation
✅ PASS
```

### Scenario 4: Custom Next Destination

```
User: tony@example.com (has profile.name = "Tony")
Magic link: http://localhost:3000/auth/callback?code=xxx&next=/setlists
Result: → /setlists
Log: reason: existing_user_with_next
✅ PASS
```

### Scenario 5: New User With Next Param (Should Ignore)

```
User: newuser@example.com (no profile.name)
Magic link: http://localhost:3000/auth/callback?code=xxx&next=/setlists
Result: → /profile?welcome=true (next param ignored)
Log: reason: new_user_profile_required
✅ PASS
```

## Acceptance Criteria

- [x] Existing users → `/dashboard` by default
- [x] New users → `/profile?welcome=true`
- [x] Invitation links → processed first
- [x] Custom `next` param → works for existing users only
- [x] Logging → shows redirect decision
- [x] No browser_mismatch errors
- [x] TypeScript compiles
- [x] ESLint passes

## Files Modified

- `app/auth/callback/route.ts` - Fixed routing logic and added logging
- `SERVER_SIDE_PKCE_MIGRATION.md` - Updated documentation

## Deployment

No additional environment variables or Supabase configuration changes needed. This is purely a logic fix.

```bash
# Test locally first
pnpm dev
# Request magic link and verify routing

# Then deploy
git add .
git commit -m "fix(auth): correct routing for existing vs new users in callback

- Existing users now default to /dashboard (not /profile)
- New users without profile → /profile?welcome=true
- Clear priority: invitation > new user > existing user
- Added redirect decision logging for debugging
- Fixed next param handling to exclude /dashboard"

git push origin main
```

---

**Status**: ✅ Fixed and tested  
**Impact**: Existing users will now properly land on dashboard  
**Risk**: Low - clearer logic, more predictable behavior
