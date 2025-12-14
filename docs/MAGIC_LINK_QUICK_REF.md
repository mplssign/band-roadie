# Magic Link Auth - Quick Reference

## What Was Fixed

✅ **400 Error**: "both auth code and code verifier should be non-empty"  
✅ **Browser Context**: Opens in different browser now shows helpful error  
✅ **Legacy Support**: Both `?code=` and `?token_hash=` formats work  
✅ **Service Worker**: Auth routes never cached  
✅ **Error Messages**: Clear, actionable error messages for users

## Files Changed

1. **`app/auth/callback/page.tsx`** - Enhanced callback handler
2. **`public/sw.js`** - Prevent auth route caching
3. **`lib/supabase/client.ts`** - Explicit PKCE config
4. **`app/(auth)/login/page.tsx`** - Better error handling

## How to Test

### Happy Path

```bash
1. Go to /login
2. Enter email
3. Click "Send Login Link"
4. Check email
5. Click link in email
6. Should redirect to /dashboard (or /profile if new user)
```

### Error Cases

```bash
# Expired Link
→ Should show: "Your login link has expired. Please request a new one."

# Different Browser
→ Should show: "Please open the login link in the same browser where you requested it."

# Invalid Link
→ Should show: "Authentication failed" with details
```

## Common Issues & Solutions

### Issue: Still seeing 400 error

**Check:**

- Are you opening link in same browser where requested?
- Is service worker updated? (Clear cache: see docs/CLEAR_PWA_CACHE.md)
- Are redirect URLs configured in Supabase dashboard?

### Issue: Redirecting to /login

**Check:**

- Middleware config still excludes `/auth/callback`
- No browser extensions blocking cookies/localStorage
- Service worker not serving stale response

### Issue: Works in dev but not production

**Check:**

- `NEXT_PUBLIC_SITE_URL` environment variable set correctly
- Supabase redirect URLs include production domain
- Production service worker is updated

## Environment Setup

### Required Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=https://your-domain.com  # Production only
```

### Supabase Dashboard Configuration

**Auth → URL Configuration**

- Site URL: Your production domain
- Redirect URLs: Add `https://your-domain.com/auth/callback`

## Debug Tips

### View Console Logs

Open browser DevTools → Console tab, look for:

```
[Auth Callback] Received params: {...}
[Auth Callback] Processing PKCE code exchange
[Auth Callback] Authentication complete
```

### Check localStorage

```javascript
// In browser console:
localStorage.getItem('sb-xxxx-auth-token'); // Should show session
localStorage.getItem('sb-xxxx-auth-token-code-verifier'); // Should exist after requesting link
```

### Service Worker Status

```javascript
// In browser console:
navigator.serviceWorker.getRegistrations().then((regs) => console.log(regs));
```

## Quick Fixes

### Clear Service Worker Cache

```javascript
// In browser console:
navigator.serviceWorker.getRegistrations().then((regs) => {
  regs.forEach((reg) => reg.unregister());
});
```

### Force Refresh

1. Open DevTools
2. Right-click refresh button
3. "Empty Cache and Hard Reload"

### Test in Incognito

- No cache
- No extensions
- Fresh localStorage
- Good for isolating issues

## Monitoring

### Success Indicators

- ✅ No 400 errors in Supabase logs
- ✅ Users can authenticate from any email client
- ✅ Clear error messages when issues occur
- ✅ Console logs show auth flow progress

### Warning Signs

- ⚠️ Multiple retries from same user
- ⚠️ High rate of "browser_mismatch" errors
- ⚠️ Users reporting "stuck" on callback page
- ⚠️ Missing console logs (service worker cache issue)

## Need More Help?

See full documentation:

- `docs/MAGIC_LINK_FIX_COMPLETE.md` - Complete technical details
- `docs/MAGIC_LINK_FIX.md` - Original PKCE fix documentation
- `docs/CLEAR_PWA_CACHE.md` - Service worker troubleshooting
