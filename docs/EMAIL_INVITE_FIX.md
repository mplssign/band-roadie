# Email Invite Error Fix Guide

## Problem
Members are not receiving invitation emails in production. Error message: "Unknown error sending invite"

## Root Cause
The error "Unknown error sending invite" in `lib/server/send-band-invites.ts:291` occurs when the Resend email API fails to send. This typically happens due to:

1. Missing/invalid Resend API key
2. Unverified sender email address
3. Resend account issues (quota, billing, etc.)

---

## Quick Fix Steps

### Step 1: Verify Resend Configuration

Go to [Resend Dashboard](https://resend.com/):

1. **Check API Key**
   - Go to API Keys section
   - Ensure you have an active API key
   - Copy the key (starts with `re_`)

2. **Verify Domain/Email**
   - Go to Domains section
   - Ensure `bandroadie.com` is verified (or your custom domain)
   - Verify that `noreply@bandroadie.com` is listed as a verified sender
   - If not verified, follow Resend's verification process (add DNS records)

3. **Check Account Status**
   - Verify account is active and not suspended
   - Check if you've exceeded sending limits
   - Review any billing issues

### Step 2: Update Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your `band-roadie` project
3. Go to **Settings** → **Environment Variables**

4. **Add or update these variables for Production:**

   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   *(Use the API key from Resend dashboard)*

   ```
   RESEND_FROM_EMAIL=noreply@bandroadie.com
   ```
   *(Or whatever verified email you're using)*

5. **Important:** These environment variables only take effect on new deployments!

### Step 3: Redeploy

After updating environment variables:

**Option A: Trigger new deployment from Git**
```bash
git commit --allow-empty -m "Trigger redeploy for email config"
git push origin main
```

**Option B: Redeploy from Vercel Dashboard**
- Go to Deployments tab
- Click "..." on latest deployment
- Click "Redeploy"

**Option C: Use Vercel CLI**
```bash
vercel --prod
```

---

## Verification

After redeployment:

1. **Check Server Logs**
   - Go to Vercel Dashboard → your project → Deployments
   - Click latest deployment → Functions tab
   - Look for logs from `/api/bands/[bandId]/invites`
   - You should see: `[email.send] Config check - API key: present`
   - If you see `API key: MISSING`, environment variables didn't apply

2. **Test Invite**
   - Go to your band's Edit page
   - Add your own email address
   - Click "Send Invites"
   - Check your email inbox (and spam folder)

3. **Check Resend Dashboard**
   - Go to Resend → Emails section
   - You should see the sent email with status
   - If email failed, Resend will show specific error (e.g., "Invalid API key", "Domain not verified")

---

## Common Issues & Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| **API Key Missing** | `[email.send] Config check - API key: MISSING` | Add `RESEND_API_KEY` to Vercel env vars |
| **Wrong API Key** | Resend error: "Invalid API key" | Double-check key in Resend dashboard, update in Vercel |
| **Domain Not Verified** | Resend error: "Domain not verified" | Add DNS records in your domain registrar as shown in Resend |
| **From Email Not Verified** | Resend error: "From address not allowed" | Use verified sender email in `RESEND_FROM_EMAIL` |
| **Rate Limit** | Resend error: "Rate limit exceeded" | Wait or upgrade Resend plan |
| **Env Vars Not Applied** | Still seeing errors after update | Redeploy! Env vars only apply to new deployments |

---

## Alternative: Use Resend Test Mode (Temporary)

If you need a quick workaround while setting up production:

1. In Resend, create a **test API key** instead of production key
2. Test mode allows sending to any email without domain verification
3. Emails won't actually be delivered, but you can see them in Resend dashboard

**⚠️ Warning:** This is only for testing! Use production keys for real users.

---

## Debug Logging

To see detailed logs in production:

1. The code already includes extensive logging
2. Check Vercel Function logs after invite attempt
3. Look for these log patterns:

```
[invite.create] Starting invite for user@example.com
[invite.magiclink] Generated magic link
[email.send] Config check - API key: present, from: noreply@bandroadie.com
[email.send] SUCCESS (234ms) - ID: abc123def
[invite.send] SUCCESS sent invite email
```

If you see errors, they'll appear as:
```
[email.send] ERROR (456ms): { message: "Invalid API key", ... }
[invite.send] ERROR sending invite email to user@example.com
```

---

## Contact Support

If issue persists after following these steps:

1. **Resend Support**: support@resend.com (for API/domain issues)
2. **Check Resend Status**: https://status.resend.com/
3. **Vercel Support**: For environment variable issues

---

## Summary Checklist

- [ ] Resend account is active and verified
- [ ] API key exists and is copied correctly
- [ ] Domain/email is verified in Resend
- [ ] `RESEND_API_KEY` set in Vercel production environment
- [ ] `RESEND_FROM_EMAIL` set in Vercel production environment
- [ ] Redeployed after setting environment variables
- [ ] Tested invite and checked email delivery
- [ ] Checked Vercel function logs for errors
- [ ] Checked Resend dashboard for email status
