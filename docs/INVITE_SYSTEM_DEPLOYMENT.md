# Invite System Deployment Guide

## Post-Deployment Steps

### 1. Run Database Migration

The token system requires a database migration to add the `token` field to the `band_invitations` table.

**Option A: Via Supabase Dashboard**

1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
2. Copy contents of `supabase/migrations/012_add_invite_tokens.sql`
3. Paste and run the SQL
4. Verify: Check `band_invitations` table now has `token` column

**Option B: Via Supabase CLI**

```bash
# If you have Supabase CLI configured
supabase db push

# Or apply specific migration
psql $DATABASE_URL -f supabase/migrations/012_add_invite_tokens.sql
```

**Verification:**

```sql
-- Check that token column exists and has data
SELECT id, email, status, token
FROM band_invitations
LIMIT 5;

-- All rows should have a token value
```

---

### 2. Update Environment Variables

No new environment variables are required! The system uses existing:

- ✓ `NEXT_PUBLIC_SUPABASE_URL` - Already configured
- ✓ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Already configured
- ✓ `SUPABASE_SERVICE_ROLE_KEY` - For magic link generation
- ✓ `RESEND_API_KEY` - For sending emails

---

### 3. Configure Digital Asset Links (Android)

For Android link capture to work, you need to update the SHA256 fingerprint in `public/.well-known/assetlinks.json`.

**Get your SHA256 fingerprint:**

If you have an Android app/TWA:

```bash
# From your Android keystore
keytool -list -v -keystore /path/to/keystore.jks -alias your-key-alias

# Or from Play Console
# Go to: Play Console → Your app → Setup → App integrity
# Copy SHA-256 certificate fingerprint
```

**Update the file:**

```json
{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.bandroadie.twa",
    "sha256_cert_fingerprints": ["YOUR_ACTUAL_SHA256_FINGERPRINT_HERE"]
  }
}
```

**If you don't have an Android app yet:**

- The assetlinks.json file can stay as-is
- Link capture will fall back to browser opening
- Users will still see "Open in App" prompt if PWA installed

**Verify it's accessible:**

```bash
curl https://bandroadie.com/.well-known/assetlinks.json
# Should return the JSON file
```

---

### 4. Test the New Flow

**Quick Smoke Test:**

1. **Send a test invite:**
   - Log into your app as band admin
   - Go to Band Settings → Members
   - Invite a test email address

2. **Check the email:**
   - Email should arrive with subject "You're invited to join [Band] on Band Roadie"
   - Click the CTA button
   - URL should be: `https://bandroadie.com/invite?token=xxxxx&email=test@example.com`

3. **Verify the flow:**
   - Should see invite page with band name
   - If not logged in: "Check your email for verification link"
   - Click verification link → redirects through auth callback
   - Should land on `/profile?onboarding=1` (new user) or `/dashboard` (existing)

4. **Check database:**

   ```sql
   -- Verify invitation was accepted
   SELECT * FROM band_invitations
   WHERE email = 'test@example.com'
   ORDER BY created_at DESC LIMIT 1;
   -- Status should be 'accepted'

   -- Verify user was added to band
   SELECT * FROM band_members
   WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com')
   ORDER BY joined_at DESC LIMIT 1;
   ```

---

### 5. PWA Testing

**Desktop (Chrome):**

1. Visit https://bandroadie.com
2. Look for install prompt in address bar
3. Click "Install"
4. PWA should open in standalone window
5. Send yourself an invite, click link
6. Should open in existing PWA window (not new browser tab)

**Android (Chrome):**

1. Visit https://bandroadie.com on Android
2. Install PWA via Chrome menu → "Add to Home screen"
3. Open installed app
4. Send invite, check email on phone
5. Click invite link
6. Should prompt "Open with Band Roadie" (if Digital Asset Links configured)
7. Or opens in Chrome with "Open in App" button

**iOS (Safari):**

1. Visit https://bandroadie.com on iOS
2. Tap Share → "Add to Home Screen"
3. Open installed app
4. Click invite link in Mail
5. Opens in Safari (iOS doesn't support deep linking from email)
6. Shows "Open in App" button if PWA installed
7. Otherwise continues in browser normally

---

### 6. Monitor Logs

After deployment, watch for these log messages:

**Successful invite creation:**

```
[invite.create] Created invitation abc12345... for user@example.com
[invite.magiclink] Generated magic link for user@example.com with token abc12345...
[email.send] SUCCESS (XXms) - ID: re_xxxxx
```

**Successful invite acceptance:**

```
[invite/accept] GET request { token: 'abc12345...', email: 'user@example.com' }
[invite/accept] Successfully added user to band { bandId: 'xxx' }
```

**Auth callback with invite:**

```
[auth/callback] user authenticated: xxx
[auth/callback] → token-based invitation flow
```

**Errors to watch for:**

```
[invite/accept] Invitation not found
[invite/accept] Email mismatch
[invite/accept] Invitation expired
```

---

### 7. Rollback Plan (If Needed)

If you need to rollback:

**1. Revert code:**

```bash
git revert 023cdc7
git push origin main
```

**2. Database stays safe:**

- The `token` column is backward compatible
- Old invitation flow still works via `/api/invitations/[id]/accept`
- New invites will have tokens but won't be used

**3. DNS/CDN:**

- No DNS changes were made
- Vercel auto-deploys from git

---

### 8. Gradual Rollout (Recommended)

You can enable the new flow gradually:

**Phase 1: Monitor (Current)**

- New system is live
- All new invites use tokens
- Old invites (by ID) still work
- Monitor for errors

**Phase 2: Backfill (Optional)**

- Run migration if not done yet
- All invitations get tokens
- Both flows work simultaneously

**Phase 3: Deprecate (Future)**

- After 30 days, remove old `/api/invitations/[id]/accept` route
- All invites must use tokens
- Cleaner codebase

---

### 9. User Communication

**No user action required!** The changes are transparent:

- Existing invite links still work (legacy flow)
- New invite links use improved flow
- PWA users get better experience automatically
- Non-PWA users see no difference

**Optional announcement:**

> "We've improved our invite system! Now when you invite band members:
>
> - 🚀 Faster onboarding for new users
> - 📱 Better mobile app experience
> - 🔗 More reliable invitation links
>
> Everything works the same, just smoother!"

---

### 10. Success Metrics

Track these metrics to verify successful deployment:

**Week 1:**

- [ ] Zero error spikes in logs
- [ ] All new invites use token format
- [ ] Invite acceptance rate >= baseline
- [ ] No complaints about broken invites

**Week 2:**

- [ ] PWA installs tracked (if analytics added)
- [ ] Reduced time from email click to dashboard
- [ ] Zero duplicate band_members records
- [ ] Proper onboarding flow for new users

**Month 1:**

- [ ] Migration complete on all invitations
- [ ] Android link capture working (if configured)
- [ ] Positive user feedback on mobile experience
- [ ] Ready to deprecate legacy invite flow

---

## Troubleshooting

### "Token not found" errors

- **Cause:** Migration not run yet
- **Fix:** Run `012_add_invite_tokens.sql` migration
- **Verify:** Check `token` column exists in `band_invitations`

### Redirect loops

- **Cause:** Middleware or cookie issues
- **Fix:** Check `br_logged_out` cookie is cleared on login
- **Debug:** Add console.log in middleware.ts

### PWA not installing

- **Cause:** Missing icons or manifest errors
- **Fix:** Verify manifest.json accessible at `/manifest.json`
- **Check:** Browser DevTools → Application → Manifest

### Android link capture not working

- **Cause:** Digital Asset Links not configured
- **Fix:** Update `.well-known/assetlinks.json` with real SHA256
- **Test:** Use `adb shell am start -a android.intent.action.VIEW -d "URL"`

### Email links going to browser instead of PWA

- **iOS:** Expected behavior - show "Open in App" prompt
- **Android:** Verify Digital Asset Links configured correctly
- **Fallback:** App still works in browser

---

## Next Steps

1. [ ] Run database migration
2. [ ] Test with personal email
3. [ ] Verify logs look good
4. [ ] Send to team for testing
5. [ ] Configure Android Asset Links (if applicable)
6. [ ] Monitor metrics for 1 week
7. [ ] Consider adding PWA install analytics
8. [ ] Plan Phase 3 deprecation timeline

---

## Support

If you encounter issues:

1. Check logs in Vercel Functions
2. Check Supabase logs for database errors
3. Review test matrix: `docs/INVITE_SYSTEM_TEST_MATRIX.md`
4. File issue with specific error messages and reproduction steps
