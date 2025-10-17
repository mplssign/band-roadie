# Clear Desktop PWA Cache - Band Roadie

## Problem
Desktop showing magic links with `localhost:3000` URLs, but mobile works fine with production URLs.

## Root Cause
Your desktop browser has a cached Service Worker (PWA) that contains old code with `localhost` hardcoded. The fix has been deployed, but your browser is still using the old cached version.

## Solution: Clear PWA Cache (5 minutes)

### Option 1: Quick Clear (Recommended)

**Chrome/Edge:**
1. Open https://bandroadie.com
2. Press `F12` to open DevTools
3. Go to **Application** tab
4. In left sidebar:
   - Click **Service Workers** → Click "Unregister" for any active workers
   - Click **Storage** → Click "Clear site data" button
5. Close DevTools
6. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+F5` (Windows)
7. Test magic link - should now use production URL

**Safari:**
1. Open https://bandroadie.com
2. Safari → Settings → Privacy → Manage Website Data
3. Search "bandroadie"
4. Click "Remove" → "Done"
5. Hard refresh: `Cmd+Option+R`
6. Test magic link - should now use production URL

**Firefox:**
1. Open https://bandroadie.com
2. Press `F12` → Storage tab
3. Right-click domain → "Delete All"
4. Hard refresh: `Ctrl+Shift+R`
5. Test magic link - should now use production URL

### Option 2: Nuclear Option (If Quick Clear Doesn't Work)

**Clear All Browser Data:**

1. **Chrome/Edge:**
   - Settings → Privacy and Security → Clear browsing data
   - Time range: "All time"
   - Check: Cached images and files, Site settings
   - Click "Clear data"

2. **Safari:**
   - Safari → Clear History
   - Clear: "all history"
   - Confirm

3. **Firefox:**
   - Settings → Privacy & Security → Cookies and Site Data
   - Click "Clear Data"
   - Check both boxes → Clear

### Option 3: Wait (No Action Required)

The new version (1.2.4) has a new build ID. Your PWA will automatically update within 24 hours when:
- You close and reopen the browser
- The Service Worker detects the new version
- Background sync occurs

## Verification

After clearing cache, test the magic link flow:

1. Go to https://bandroadie.com/login
2. Enter your email
3. Click "Send Login Link"
4. Check your email
5. **Verify:** The link should be `https://bandroadie.com/auth/callback?code=xxx`
   - ✅ Good: `https://bandroadie.com/auth/callback`
   - ❌ Bad: `http://localhost:3000/auth/callback`

## Why This Happened

The previous version had `getBaseUrl()` called server-side during build, which returned `localhost` in the development environment. The Service Worker cached this code.

The fix (commit d7edde0) now uses `window.location.origin` when called from the browser, ensuring it always uses the current domain:
- Production: `https://bandroadie.com`
- Preview: `https://bandroadie.vercel.app`
- Local: `http://localhost:3000`

## For Developers

If you're deploying this fix:

1. The code change is already committed and pushed
2. When users visit after the new deployment, their PWA will update automatically
3. Some users may need to manually clear cache as described above
4. Consider adding a "New version available - Reload" banner in future updates

## Technical Details

**What Changed:**
```typescript
// Before (server-side only)
export function getBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  return fromEnv || 'http://localhost:3000';
}

// After (client-aware)
export function getBaseUrl(): string {
  // Client-side: always use current domain
  if (typeof window !== 'undefined') {
    return window.location.origin; // ✅ https://bandroadie.com
  }
  // Server-side: use env vars
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}
```

The magic link is requested client-side (when user clicks "Send Login Link"), so it now always uses the correct production domain.
