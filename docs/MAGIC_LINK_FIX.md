# Magic Link Authentication Fix

## Problem

Users were receiving this error when clicking magic links:
```
invalid request: both auth code and code verifier should be non-empty
```

## Root Cause

The authentication callback was implemented as a **server-side route handler** (`app/auth/callback/route.ts`), but Supabase's PKCE (Proof Key for Code Exchange) flow requires:

1. When the magic link is sent, a `code_challenge` is generated
2. The corresponding `code_verifier` is stored in the **browser's localStorage**
3. When the user clicks the link, the callback receives an auth `code`
4. The callback must exchange the `code` + `code_verifier` for a session

**The problem:** Server-side route handlers cannot access localStorage, so the `code_verifier` was unavailable during the exchange, causing the error.

## Solution

Converted the auth callback to a **client-side page** that can access localStorage:

### Changes Made

1. **Created `/app/auth/callback/page.tsx`** (client-side)
   - Uses `'use client'` directive
   - Accesses `useSearchParams()` to get the auth code
   - Calls `supabase.auth.exchangeCodeForSession(code)` on the client
   - The Supabase client automatically retrieves `code_verifier` from localStorage
   - Properly wrapped in `<Suspense>` boundary (Next.js requirement)

2. **Renamed `/app/auth/callback/route.ts` to `route.ts.bak`**
   - Disabled the old server-side handler
   - Next.js will now use the client-side `page.tsx` instead

### How It Works Now

```
1. User clicks "Send Login Link"
   ↓
2. Supabase sends magic link with auth code
   └─ Stores code_verifier in browser localStorage
   
3. User clicks magic link in email
   ↓
4. Browser opens /auth/callback?code=xxx
   ↓
5. Client-side page.tsx loads
   ↓
6. JavaScript reads:
   - auth code from URL params
   - code_verifier from localStorage
   ↓
7. Calls exchangeCodeForSession(code)
   └─ Supabase automatically uses the code_verifier
   
8. Session established → Redirect to dashboard
```

## Files Changed

- ✅ Created: `app/auth/callback/page.tsx` (new client-side handler)
- ✅ Renamed: `app/auth/callback/route.ts` → `route.ts.bak` (disabled old server handler)
- ℹ️ No changes needed to `lib/supabase/client.ts` (standard config works)

## Testing

Build succeeded with no errors:
```bash
pnpm build
# ✓ Build completed successfully
```

## Next Steps

1. Deploy to production
2. Test magic link flow:
   - Request magic link
   - Click link in email
   - Verify successful login without PKCE error
3. If successful, can delete `route.ts.bak`

## Technical Notes

- **PKCE Flow:** Industry standard for OAuth/OIDC, prevents authorization code interception
- **localStorage:** Browser-only storage, not accessible from Node.js server context
- **Suspense:** Required by Next.js when using `useSearchParams()` in App Router
- **Client-side Auth:** Safe because the auth code is single-use and time-limited
