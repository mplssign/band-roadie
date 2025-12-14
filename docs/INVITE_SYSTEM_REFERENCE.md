# Invite System Quick Reference

## URL Formats

### New Token-Based Invites

```
https://bandroadie.com/invite?token=abc123xyz&email=user@example.com
```

### Legacy ID-Based Invites (Still Supported)

```
https://bandroadie.com/invite/550e8400-e29b-41d4-a716-446655440000
```

### Magic Link Callbacks

```
# New: With invite token
https://bandroadie.com/auth/callback?code=xxx&inviteToken=abc123&email=user@example.com

# Legacy: With invitation ID
https://bandroadie.com/auth/callback?code=xxx&invitation=550e8400-e29b-41d4-a716-446655440000
```

---

## Flow Diagrams

### New User Invite Flow

```
Admin sends invite
  ↓
Email with magic link (Supabase generated)
  ↓
User clicks → /invite?token=xxx&email=xxx
  ↓
Page calls /api/invites/accept (no auth yet)
  ↓
API returns: { requiresAuth: true, ... }
  ↓
Page sends magic link via Supabase
  ↓
User clicks email verification link
  ↓
/auth/callback?code=xxx&inviteToken=xxx&email=xxx
  ↓
Exchange code for session, clear br_logged_out
  ↓
Redirect to /api/invites/accept?token=xxx&email=xxx
  ↓
Add user to band_members, mark invite accepted
  ↓
Return: { redirectTo: '/profile?onboarding=1' }
  ↓
User completes profile
  ↓
Redirect to /dashboard
```

### Existing User Invite Flow (Logged In)

```
Admin sends invite
  ↓
User clicks magic link
  ↓
/invite?token=xxx&email=xxx
  ↓
Page calls /api/invites/accept (authenticated)
  ↓
API adds user to band immediately
  ↓
Return: { redirectTo: '/dashboard', success: true }
  ↓
Redirect to /dashboard
  ↓
User sees new band
```

### Logged Out Existing User

```
Similar to new user flow, but:
- br_logged_out cookie is set (from explicit logout)
- After auth: redirectTo = '/dashboard' (not /profile)
- Profile already completed, skip onboarding
```

---

## API Reference

### GET /api/invites/accept

**Query Parameters:**

- `token` (required): Secure invite token
- `email` (required): Email address being invited

**Responses:**

**200 OK - Requires Auth:**

```json
{
  "requiresAuth": true,
  "email": "user@example.com",
  "bandName": "The Rockers",
  "bandId": "xxx",
  "invitationId": "xxx",
  "redirectTo": "/invite?token=xxx&email=xxx"
}
```

**200 OK - Success:**

```json
{
  "success": true,
  "bandId": "xxx",
  "bandName": "The Rockers",
  "redirectTo": "/dashboard",
  "message": "Welcome to The Rockers!"
}
```

**200 OK - Already Member:**

```json
{
  "success": true,
  "message": "You are already a member of this band",
  "bandId": "xxx",
  "bandName": "The Rockers",
  "redirectTo": "/dashboard"
}
```

**400 Bad Request:**

```json
{
  "error": "Missing token or email",
  "redirectTo": "/login?error=Invalid invitation link"
}
```

**403 Forbidden:**

```json
{
  "error": "This invitation is for a different email address",
  "redirectTo": "/dashboard?error=Invitation email mismatch"
}
```

**404 Not Found:**

```json
{
  "error": "Invitation not found or invalid",
  "redirectTo": "/login?error=Invalid or expired invitation"
}
```

**410 Gone:**

```json
{
  "error": "Invitation has expired",
  "redirectTo": "/invite?token=xxx&email=xxx&expired=1",
  "bandName": "The Rockers"
}
```

---

## Database Schema

### band_invitations Table

```sql
CREATE TABLE band_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'accepted', 'expired', 'error')),
  token TEXT NOT NULL UNIQUE,  -- NEW: Secure random token
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(band_id, email)
);

CREATE INDEX idx_band_invitations_token ON band_invitations(token);
```

**Token Generation:**

- 32 random characters (A-Z, a-z, 0-9)
- Unique across all invitations
- Auto-generated via PostgreSQL function
- Used in invite URLs

---

## Cookies

### br_logged_out

- **Purpose:** Track explicit logout to show login page
- **Set:** When user clicks "Log Out"
- **Cleared:** On successful login via auth callback
- **Expiry:** 5 minutes
- **Domain:** Same as app domain
- **Path:** `/`
- **HttpOnly:** `true`
- **Secure:** `true` (production only)
- **SameSite:** `lax`

**Usage in Middleware:**

```typescript
const hasLoggedOut = request.cookies.get('br_logged_out')?.value === 'true';

if (!user && hasLoggedOut) {
  // Redirect to /login
}
```

---

## PWA Configuration

### Manifest.json Features

```json
{
  "launch_handler": {
    "client_mode": "focus-existing"
  },
  "capture_links": "existing-client-navigate",
  "handle_links": "preferred"
}
```

**What they do:**

- `focus-existing`: Clicking a link focuses existing PWA window instead of opening new one
- `capture_links`: Routes links to existing PWA client when possible
- `handle_links`: Tells OS to prefer opening links in PWA over browser

### Service Worker Events

**Message Handling:**

```javascript
self.addEventListener('message', (event) => {
  if (event.data.type === 'NAVIGATE_URL') {
    // Focus existing window and navigate
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        client.focus();
        client.navigate(event.data.url);
        return;
      }
    });
  }
});
```

**Fetch Interception:**

```javascript
// Never cache these routes
const noCachePatterns = ['/auth/', '/api/auth/', '/api/invites/', '/login', '/signup', '/invite'];

// Check URL params
if (
  url.searchParams.has('token') ||
  url.searchParams.has('inviteToken') ||
  url.searchParams.has('code')
) {
  // Always fetch fresh
  return fetch(request, { cache: 'no-store' });
}
```

---

## Middleware Routes

### Public Routes (No Auth Required)

- `/`
- `/login`
- `/signup`
- `/auth/callback`
- `/invite` ← NEW
- `/api/*`
- `/_next/*`
- `/icons/*`
- `/manifest.json`
- `/.well-known/*` ← NEW

### Protected Routes (Auth Required)

- `/dashboard`
- `/profile`
- `/calendar`
- `/setlists`
- `/members`
- `/settings`
- `/bands`
- `/gigs`
- `/rehearsals`

### Redirect Logic

```typescript
if (protectedRoute && !user) {
  if (hasLoggedOut) {
    // Explicit logout: always redirect to login
    return redirect('/login?redirectedFrom=' + pathname);
  } else {
    // Invite flow: still redirect to login
    // (Auth callback will handle invite token)
    return redirect('/login?redirectedFrom=' + pathname);
  }
}
```

---

## Environment Variables

All required variables (no changes):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Email
RESEND_API_KEY=re_xxx...

# App
NEXT_PUBLIC_APP_URL=https://bandroadie.com
```

---

## Code Examples

### Send an Invite (Server-side)

```typescript
import { sendBandInvites } from '@/lib/server/send-band-invites';
import { createClient } from '@/lib/supabase/server';

const supabase = createClient();

const result = await sendBandInvites({
  supabase,
  bandId: 'xxx',
  bandName: 'The Rockers',
  inviterId: 'yyy',
  inviterName: 'John Doe',
  emails: ['newmember@example.com'],
});

// result.sentCount: number of successful sends
// result.failedInvites: { email, error }[]
```

### Check if User Has Pending Invites

```typescript
const { data: invites } = await supabase
  .from('band_invitations')
  .select('*, bands(name)')
  .eq('email', user.email)
  .in('status', ['pending', 'sent'])
  .order('created_at', { ascending: false });

if (invites && invites.length > 0) {
  console.log(`User has ${invites.length} pending invites`);
}
```

### Accept Invite Programmatically

```typescript
// Client-side
const response = await fetch(`/api/invites/accept?token=${token}&email=${email}`);
const data = await response.json();

if (data.success) {
  router.push(data.redirectTo);
} else if (data.requiresAuth) {
  // Send magic link
  const { error } = await supabase.auth.signInWithOtp({
    email: data.email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback?inviteToken=${token}&email=${email}`,
    },
  });
}
```

### Detect PWA Mode

```typescript
'use client';

import { useEffect, useState } from 'react';

export function usePWA() {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsPWA(isStandalone);
  }, []);

  return isPWA;
}
```

### Manual Logout

```typescript
// Client-side button click
async function handleLogout() {
  const response = await fetch('/logout', { method: 'POST' });

  if (response.ok) {
    // br_logged_out cookie is now set
    window.location.href = '/login';
  }
}
```

---

## Testing Utilities

### Generate Test Token

```sql
-- In Supabase SQL editor
SELECT public.generate_invite_token();
-- Returns: random 32-char string
```

### Create Test Invitation

```sql
INSERT INTO band_invitations (
  band_id,
  email,
  invited_by,
  status,
  token,
  expires_at
) VALUES (
  'your-band-id',
  'test@example.com',
  'your-user-id',
  'pending',
  public.generate_invite_token(),
  NOW() + INTERVAL '7 days'
);
```

### Check Invitation Status

```sql
SELECT
  i.email,
  i.status,
  i.token,
  i.created_at,
  b.name as band_name,
  CASE
    WHEN i.expires_at < NOW() THEN 'EXPIRED'
    WHEN i.status = 'accepted' THEN 'ACCEPTED'
    ELSE 'ACTIVE'
  END as current_status
FROM band_invitations i
JOIN bands b ON i.band_id = b.id
WHERE i.email = 'test@example.com'
ORDER BY i.created_at DESC
LIMIT 5;
```

---

## Common Patterns

### Redirect After Auth Based on Profile

```typescript
// In auth callback
const { data: profile } = await supabase
  .from('users')
  .select('profile_completed')
  .eq('id', user.id)
  .single();

const hasCompletedProfile = profile?.profile_completed || false;

const redirectTo = hasCompletedProfile ? '/dashboard' : '/profile?onboarding=1';
```

### Validate Invite Token

```typescript
const { data: invitation } = await supabase
  .from('band_invitations')
  .select('*, bands(name)')
  .eq('token', token)
  .eq('email', email.toLowerCase())
  .single();

if (!invitation) {
  return { error: 'Invitation not found' };
}

if (invitation.status === 'accepted') {
  return { error: 'Already accepted' };
}

if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
  return { error: 'Invitation expired' };
}

// Valid invitation
return { invitation };
```

### Add User to Band

```typescript
// Check if already a member
const { data: existingMember } = await supabase
  .from('band_members')
  .select('id')
  .eq('band_id', bandId)
  .eq('user_id', userId)
  .single();

if (existingMember) {
  return { alreadyMember: true };
}

// Add as member
const { error } = await supabase.from('band_members').insert({
  band_id: bandId,
  user_id: userId,
  role: 'member',
});

// Mark invitation accepted
await supabase.from('band_invitations').update({ status: 'accepted' }).eq('id', invitationId);
```

---

## Debugging

### Enable Verbose Logging

```typescript
// In any file
if (process.env.NODE_ENV !== 'production') {
  console.log('[debug] Variable:', value);
}
```

### Check Cookies in Browser

```javascript
// In browser console
document.cookie.split(';').forEach((c) => console.log(c.trim()));

// Check specific cookie
document.cookie.includes('br_logged_out');
```

### Test PWA Manifest

```javascript
// In browser console
fetch('/manifest.json')
  .then((r) => r.json())
  .then((m) => console.log(m));

// Check service worker
navigator.serviceWorker.getRegistrations().then((regs) => console.log(regs));
```

### Simulate Android Link Capture

```bash
# Via ADB (Android Debug Bridge)
adb shell am start -a android.intent.action.VIEW \
  -d "https://bandroadie.com/invite?token=test&email=test@example.com"
```

---

## Migration Checklist

- [ ] Run `012_add_invite_tokens.sql` migration
- [ ] Verify `token` column exists in `band_invitations`
- [ ] Test sending new invite
- [ ] Verify email contains new URL format
- [ ] Test clicking invite link
- [ ] Test full flow: email → auth → dashboard
- [ ] Check database: invitation status = 'accepted'
- [ ] Check database: user in band_members
- [ ] Test PWA install flow
- [ ] Update Digital Asset Links if using Android
- [ ] Monitor logs for errors
- [ ] Test logout → login flow
