# Band Invitations Troubleshooting Guide

## Overview

This document maps the complete invite flow, required configuration, and debugging steps for Band Roadie's invitation system.

---

## Invite Flow (File + Line References)

### 1. **Client Trigger**
- **File**: `app/(protected)/bands/[bandId]/edit/page.tsx`
- **Lines**: 312-335
- **Action**: User adds email(s) and clicks "Save" → `fetch('/api/bands/${bandId}/invites', { method: 'POST', body: JSON.stringify({ emails }) })`

### 2. **API Route Handler**
- **File**: `app/api/bands/[bandId]/invites/route.ts`
- **Lines**: 22-98
- **Actions**:
  - Validates user is band admin (lines 28-43)
  - Validates email format (lines 45-51)
  - Fetches band name (lines 56-61)
  - Calls `sendBandInvites()` (lines 76-82)
  - Returns success or partial failure (207 Multi-Status) with `failedInvites` array

### 3. **Invite Processing Core**
- **File**: `lib/server/send-band-invites.ts`
- **Lines**: 1-274
- **Flow**:
  1. **Check existing user** (lines 44-52): Query `users` table by email
  2. **If user exists**:
     - Check `band_members` table (lines 56-74)
     - If not already a member: Insert into `band_members` (line 79)
     - Send "member-added" email (lines 88-95)
  3. **If user doesn't exist**:
     - Check/create/update `band_invitations` row (lines 120-187)
     - **Generate magic link** (lines 211-232): Use Supabase Admin API `auth.generateLink({ type: 'magiclink', email, options: { redirectTo } })`
     - Fallback to `/invite/{id}` if magic link fails (line 195)
     - **Send invite email** (lines 235-240): Call `sendEmail()` with template
     - Mark invitation as `'sent'` or `'error'` in DB (lines 242-264)

### 4. **Email Sending**
- **File**: `lib/email/client.ts`
- **Lines**: 1-47
- **Actions**:
  - Logs config check: API key present, from address (lines 14-18)
  - Calls Resend API: `resend.emails.send({ from, to, subject, html })` (lines 20-26)
  - Logs response ID and timing (lines 28-34)
  - Returns `{ success: true, data }` or `{ success: false, error }`

### 5. **Email Template**
- **File**: `lib/email/templates/invite.tsx`
- **Lines**: 3-147
- **Content**:
  - Subject: `"You're invited to join {bandName} on Band Roadie"` (line 238 in send-band-invites.ts)
  - CTA button links to magic link or `/invite/{id}` (line 128)
  - Styled HTML with band name, inviter name, feature list

### 6. **Accept Flow**
- **File**: `app/api/invitations/[invitationId]/accept/route.ts`
- **Action**: When user clicks link, validates invitation and adds to band

---

## Required Environment Variables

### Production & Preview Deployments (Vercel)
```bash
RESEND_API_KEY=re_...          # Resend API key (required)
RESEND_FROM_EMAIL=noreply@bandroadie.com  # From address (must be verified in Resend)
NEXT_PUBLIC_SITE_URL=https://bandroadie.com  # Base URL for link generation
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Required for magic link generation
NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Development (Local)
```bash
RESEND_API_KEY=re_...          # Same as production OR use Resend test mode
RESEND_FROM_EMAIL=noreply@bandroadie.com
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## Redirect URLs Configuration

### Supabase Auth (Dashboard → Authentication → URL Configuration)
Add these redirect URLs:
- Production: `https://bandroadie.com/auth/callback`
- Production (www): `https://www.bandroadie.com/auth/callback`
- Preview: `https://*.vercel.app/auth/callback`
- Dev: `http://localhost:3000/auth/callback`

### Magic Link Flow
1. User clicks magic link from email → Supabase auth endpoint
2. Redirects to: `${baseUrl}/auth/callback?invitation={invitationId}`
3. Callback route (`app/auth/callback/route.ts`) exchanges code for session
4. Redirects to: `/api/invitations/{invitationId}/accept`
5. Accept route adds user to band, redirects to dashboard

---

## Debugging Steps

### Step 1: Check Logs Location
- **Vercel Production**: [Vercel Dashboard](https://vercel.com) → Project → Logs → Functions
- **Vercel Preview**: Same as above, filter by deployment URL
- **Local Dev**: Terminal running `npm run dev` or `pnpm dev`

### Step 2: Log Patterns to Look For

#### Success Flow (Non-Production Only)
```
[invite.create] Starting invite for user@example.com to band abc-123
[invite.create] Created invitation 1a2b3c4d... for user@example.com
[invite.magiclink] Generated magic link for user@example.com, redirect to invitation=1a2b3c4d-...
[invite.send] Sending email to user@example.com with CTA: https://...
[email.send] Config check - API key: present, from: noreply@bandroadie.com
[email.send] SUCCESS (234ms) - ID: 4f8a9b2c-..., to: user@example.com
[invite.send] SUCCESS sent invite email to user@example.com, marked as 'sent'
```

#### Error Patterns (Always Logged)
```
[invite.create] ERROR invalid invitation for user@example.com
[invite.magiclink] ERROR generating magic link: { message: "..." }
[email.send] ERROR (123ms): { statusCode: 422, message: "..." }
[invite.send] ERROR sending invite email to user@example.com: { ... }
[API /api/bands/abc-123/invites] 1 invite(s) failed: [{ email: "...", error: "..." }]
```

### Step 3: Verify Resend Dashboard
1. Go to [Resend Dashboard](https://resend.com/emails)
2. Check "Emails" tab for recent sends
3. Look for status:
   - **Delivered**: Email sent successfully
   - **Bounced**: Invalid email or mailbox full
   - **Spam**: Email marked as spam
   - **Failed**: Resend API error

### Step 4: Check Database
```sql
-- Check invitation status
SELECT id, email, status, created_at, invited_by 
FROM band_invitations 
WHERE band_id = 'your-band-id' 
ORDER BY created_at DESC 
LIMIT 10;

-- Possible statuses: 'pending', 'sent', 'accepted', 'error'
```

### Step 5: Common Issues & Fixes

| Issue | Symptom | Fix |
|-------|---------|-----|
| **Missing API Key** | `[email.send] Config check - API key: MISSING` | Add `RESEND_API_KEY` to env vars |
| **Unverified Domain** | Resend error: "Domain not verified" | Verify domain in Resend dashboard |
| **Wrong From Address** | Resend error: "From address not allowed" | Use verified address in `RESEND_FROM_EMAIL` |
| **Magic Link Fails** | Invitation creates but email not sent | Check `SUPABASE_SERVICE_ROLE_KEY` is set |
| **Redirect Fails** | User clicks link but can't authenticate | Add callback URL to Supabase dashboard |
| **Silent Failure** | No logs, no email | Check Vercel function logs for timeouts/errors |

---

## Manual Re-send Process

If an invite fails to send:

1. **Check DB for invitation ID**:
   ```sql
   SELECT id, email, status FROM band_invitations 
   WHERE email = 'user@example.com' AND band_id = 'band-id';
   ```

2. **Copy invitation link** (fallback):
   - Format: `https://bandroadie.com/invite/{invitation-id}`
   - Send manually via other channel (text, Slack, etc.)

3. **Reset invitation status** (to retry send):
   ```sql
   UPDATE band_invitations 
   SET status = 'pending' 
   WHERE id = 'invitation-id';
   ```
   Then re-trigger invite from UI.

---

## Example Resend Response (Sanitized)

### Success
```json
{
  "id": "4f8a9b2c-e1d3-4a5b-9c7e-2f3a1b4c5d6e",
  "from": "Band Roadie <noreply@bandroadie.com>",
  "to": ["user@example.com"],
  "created_at": "2025-01-15T10:30:45.123Z"
}
```

### Error
```json
{
  "statusCode": 422,
  "message": "Invalid 'to' email address",
  "name": "validation_error"
}
```

---

## Next Steps to Verify Delivery

1. **Trigger an invite** from the band edit page
2. **Check terminal/Vercel logs** for `[invite.send] SUCCESS`
3. **Check Resend dashboard** for "Delivered" status
4. **Check recipient's inbox** (and spam folder)
5. **Test magic link** by clicking it
6. **Verify user added to band** in database

---

## Feature Flag: Copy Invitation Link (Optional)

To expose invitation links in the UI for manual sharing:

1. Add env var: `NEXT_PUBLIC_ENABLE_INVITE_LINK_COPY=true`
2. UI will show "Copy Link" button after successful invite creation
3. Link format: `https://bandroadie.com/invite/{invitation-id}`

(This feature is not yet implemented but can be added if needed.)

---

## Support

If issues persist after following this guide:
- Check Vercel function logs for timeout errors (30s limit)
- Verify Resend account is in good standing (not rate-limited)
- Test with a simple email (e.g., your own) to isolate deliverability issues
