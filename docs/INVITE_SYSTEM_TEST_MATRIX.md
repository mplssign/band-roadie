# Band Roadie Invite System - Test Matrix

## Overview

This document outlines test scenarios for the token-based invite system with PWA-first behavior.

## Test Environment Setup

- Production URL: https://bandroadie.com
- Test accounts needed:
  - Existing user: test-existing@example.com
  - New user: test-new@example.com
  - Logged out user: test-loggedout@example.com

## Test Scenarios

### 1. New User via Invite (No PWA)

**Preconditions:**

- User has never signed up
- PWA is not installed
- Email client: Any (Gmail, Apple Mail, etc.)

**Steps:**

1. Admin sends invite from Band Settings
2. User receives email with magic link
3. User clicks magic link in email client
4. Link opens in browser

**Expected Results:**

- ✓ Browser opens to `/invite?token=xxx&email=xxx`
- ✓ Page shows "Check your email! We sent you a link to join the band"
- ✓ User clicks email verification link
- ✓ Redirects to `/auth/callback?inviteToken=xxx&email=xxx`
- ✓ Session created, cookies set
- ✓ Redirects to `/api/invites/accept?token=xxx&email=xxx`
- ✓ User added to band_members table
- ✓ Redirects to `/profile?onboarding=1` (profile_completed = false)
- ✓ User can complete profile
- ✓ After profile completion, redirects to `/dashboard`
- ✓ User sees their new band in the dashboard

**Edge Cases:**

- Token expired: Should show "Invitation has expired" with resend option
- Invalid token: Should show error with link to login
- Email mismatch: Should show "This invitation is for a different email"

---

### 2. Existing User via Invite (No PWA)

**Preconditions:**

- User already has account with profile_completed = true
- PWA is not installed
- User is logged in

**Steps:**

1. Admin sends invite
2. User clicks magic link while logged in
3. Link opens in browser

**Expected Results:**

- ✓ Opens to `/invite?token=xxx&email=xxx`
- ✓ API call to `/api/invites/accept` succeeds immediately (already authenticated)
- ✓ User added to band_members table
- ✓ Redirects to `/dashboard` (not profile, since profile_completed = true)
- ✓ Success toast: "Welcome to [Band Name]!"
- ✓ New band appears in band list

---

### 3. Existing User via Invite (Logged Out)

**Preconditions:**

- User has account but explicitly logged out
- `br_logged_out` cookie is set
- PWA is not installed

**Steps:**

1. Admin sends invite
2. User clicks magic link
3. Link opens in browser

**Expected Results:**

- ✓ Opens to `/invite?token=xxx&email=xxx`
- ✓ API determines auth required
- ✓ Page shows "Join [Band Name] on Band Roadie"
- ✓ Magic link sent to user's email
- ✓ User clicks verification link
- ✓ Redirects through auth callback with invite token
- ✓ `br_logged_out` cookie cleared on successful login
- ✓ User added to band
- ✓ Redirects to `/dashboard` (profile already completed)

---

### 4. New User via Invite (PWA Installed - Android Chrome)

**Preconditions:**

- User has never signed up
- PWA is installed on Android device
- Chrome supports link capture
- Digital Asset Links configured correctly

**Steps:**

1. Admin sends invite
2. User clicks magic link in email (Gmail app or web)
3. Android system detects PWA can handle link

**Expected Results:**

- ✓ Android shows "Open with Band Roadie" prompt
- ✓ User selects Band Roadie PWA
- ✓ Link opens directly in installed PWA (not browser)
- ✓ `/invite?token=xxx&email=xxx` loads in PWA
- ✓ Service worker handles navigation
- ✓ If PWA was already running, existing window is focused
- ✓ Authentication flow proceeds as normal
- ✓ Redirects to `/profile?onboarding=1` within PWA
- ✓ User completes onboarding in PWA
- ✓ Final redirect to `/dashboard` in PWA

**Verification:**

- Check `window.matchMedia('(display-mode: standalone)').matches` returns `true`
- Check `navigator.standalone` (iOS) or display mode
- Verify no browser chrome visible (address bar, etc.)

---

### 5. Existing User via Invite (PWA Installed - Running)

**Preconditions:**

- User has account, profile completed
- PWA is installed and currently running
- User clicks invite link

**Expected Results:**

- ✓ PWA window is focused (not new window)
- ✓ Service worker `launch_handler.client_mode: "focus-existing"` works
- ✓ URL navigates to invite page within same PWA instance
- ✓ Seamless experience, no context switch
- ✓ User added to band
- ✓ Dashboard refreshes with new band

---

### 6. New User via Invite (iOS - No True PWA Support)

**Preconditions:**

- User on iOS (Safari or Mail)
- "Add to Home Screen" not done yet
- PWA installed via home screen

**Steps:**

1. User clicks magic link in Mail app
2. iOS opens Safari (no app link capture)

**Expected Results:**

- ✓ Opens in Safari browser
- ✓ Invite page detects not in PWA mode
- ✓ Shows "Install Band Roadie" prompt if `beforeinstallprompt` available
- ✓ Shows "Open in App" button if PWA already installed
- ✓ User can continue in browser normally
- ✓ Auth flow completes
- ✓ Onboarding in browser
- ✓ Can later "Add to Home Screen" for PWA experience

**Fallback Behavior:**

- If user clicks "Open in App" and PWA installed, attempts to navigate to PWA scope
- Otherwise, continues in Safari with full functionality

---

### 7. Expired Invitation

**Preconditions:**

- Invitation created > 7 days ago (or however long expiry is set)
- User clicks link

**Expected Results:**

- ✓ Opens to `/invite?token=xxx&email=xxx`
- ✓ API returns 410 status (expired)
- ✓ Page shows "⏰ Invitation Expired"
- ✓ Shows band name if available
- ✓ "Request New Invitation" button
- ✓ Clicking button shows "Please contact the band admin"

---

### 8. Already Accepted Invitation

**Preconditions:**

- User previously accepted this invitation
- User clicks link again

**Expected Results:**

- ✓ Opens to invite page
- ✓ API recognizes already accepted
- ✓ If authenticated: Redirects to `/dashboard` with message "You are already a member"
- ✓ If not authenticated: Redirects to `/login` with appropriate message
- ✓ No duplicate band_members record created

---

### 9. Middleware Route Protection

**Test Cases:**

| Route                 | Authenticated | br_logged_out | Expected Behavior                 |
| --------------------- | ------------- | ------------- | --------------------------------- |
| `/invite?token=xxx`   | No            | No            | ✓ Allow (public)                  |
| `/invite?token=xxx`   | No            | Yes           | ✓ Allow (public)                  |
| `/invite?token=xxx`   | Yes           | No            | ✓ Allow (public)                  |
| `/dashboard`          | No            | No            | ✓ Redirect to `/login`            |
| `/dashboard`          | No            | Yes           | ✓ Redirect to `/login`            |
| `/dashboard`          | Yes           | No            | ✓ Allow                           |
| `/profile`            | No            | No            | ✓ Redirect to `/login`            |
| `/profile`            | Yes           | No            | ✓ Allow                           |
| `/auth/callback`      | N/A           | N/A           | ✓ Always allow                    |
| `/api/invites/accept` | N/A           | N/A           | ✓ Always allow (API handles auth) |

---

### 10. Service Worker Behavior

**Test Cases:**

| URL Pattern                     | Cache Strategy | Expected                        |
| ------------------------------- | -------------- | ------------------------------- |
| `/auth/callback?code=xxx`       | No cache       | ✓ Always fetch fresh            |
| `/api/invites/accept?token=xxx` | No cache       | ✓ Always fetch fresh            |
| `/invite?token=xxx`             | No cache       | ✓ Always fetch fresh            |
| `/dashboard`                    | Network-first  | ✓ Try network, fallback offline |
| `/static/image.png`             | Cache-first    | ✓ Use cached if available       |

**Offline Behavior:**

- Auth routes show: "Authentication requires an internet connection"
- Other routes show: "Offline - Please check your connection"

---

### 11. PWA Manifest Features

**Verification:**

```javascript
// Test in browser console
const manifest = await fetch('/manifest.json').then((r) => r.json());

console.assert(manifest.launch_handler.client_mode === 'focus-existing', 'Launch handler set');
console.assert(manifest.capture_links === 'existing-client-navigate', 'Link capture enabled');
console.assert(manifest.handle_links === 'preferred', 'Handle links preferred');
console.assert(manifest.start_url === '/?source=pwa', 'Start URL correct');
console.assert(manifest.scope === '/', 'Scope is root');
```

**Android Verification:**

- Check `/.well-known/assetlinks.json` accessible
- Verify SHA256 cert fingerprint matches app
- Test link capture with Android Debug Bridge (adb)

---

### 12. Logout Cookie Behavior

**Test Case 1: Explicit Logout**

1. User clicks "Log Out"
2. `br_logged_out` cookie set (5min expiry)
3. Redirect to `/login`
4. Middleware blocks protected routes
5. User logs back in
6. `br_logged_out` cookie cleared in auth callback
7. Access to protected routes restored

**Test Case 2: Invite Flow (No Logout)**

1. New user clicks invite (no br_logged_out cookie)
2. Middleware allows `/invite` page
3. Auth callback doesn't require explicit login
4. User seamlessly onboarded

---

## Automated Test Suggestions

### Unit Tests

- `lib/server/send-band-invites.ts`:
  - Token generation
  - Email URL formatting
  - Magic link generation with invite token
- `app/api/invites/accept/route.ts`:
  - Token validation
  - Email verification
  - Band membership creation
  - Redirect logic based on profile_completed

### Integration Tests

- Full invite flow from creation to acceptance
- Auth callback with invite token parameter
- Middleware route protection logic
- Service worker fetch interception

### E2E Tests (Playwright/Cypress)

- New user invite → onboarding → dashboard
- Existing user invite → dashboard (skip onboarding)
- PWA mode detection and behavior
- Logout → login flow with cookie handling

---

## Manual Testing Checklist

### Pre-Deployment

- [ ] Run database migration: `012_add_invite_tokens.sql`
- [ ] Verify SUPABASE_SERVICE_ROLE_KEY in environment
- [ ] Verify RESEND_API_KEY in environment
- [ ] Update Digital Asset Links with actual SHA256 fingerprint

### Post-Deployment

- [ ] Send test invite to new email
- [ ] Verify email received with correct link format
- [ ] Click link, verify redirect flow
- [ ] Check database: band_members record created
- [ ] Check database: invitation status = 'accepted'
- [ ] Test PWA install prompt appears
- [ ] Test logout → login flow
- [ ] Test expired invitation error handling
- [ ] Test already-member error handling

### Browser Testing

- [ ] Chrome (desktop)
- [ ] Chrome (Android with PWA)
- [ ] Safari (desktop)
- [ ] Safari (iOS)
- [ ] Firefox
- [ ] Edge

---

## Troubleshooting

### Issue: "Invalid token or email"

- Check database: Does invitation exist with that token?
- Check email match: Are emails case-normalized?
- Check expiry: Is expires_at in future?

### Issue: PWA not opening on Android

- Verify Digital Asset Links at `/.well-known/assetlinks.json`
- Check SHA256 fingerprint matches installed app
- Test with `adb shell am start -a android.intent.action.VIEW -d "https://bandroadie.com/invite?token=xxx"`

### Issue: Redirect loop

- Check middleware logic for br_logged_out cookie
- Verify auth callback clears cookie on success
- Check service worker isn't caching auth routes

### Issue: Profile not updating

- Verify `profile_completed` field in users table
- Check user metadata sync in auth callback
- Verify upsert logic in invite accept endpoint

---

## Success Metrics

- [ ] 100% of new invites use token-based URLs
- [ ] 0 redirect loops reported
- [ ] PWA link capture works on Android Chrome
- [ ] iOS users get functional fallback
- [ ] Average time from email click to dashboard < 10 seconds
- [ ] No duplicate band_members records
- [ ] Proper onboarding shown only for new users
- [ ] br_logged_out cookie prevents invite bypass of login
