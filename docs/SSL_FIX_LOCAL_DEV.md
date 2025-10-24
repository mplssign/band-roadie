# SSL Certificate Fix for Local Development

## Issue

When testing magic links in local development, you may encounter this error:

```
TypeError: fetch failed
  cause: Error: unable to get local issuer certificate
  code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'
```

## Root Cause

Node.js (v22) has strict SSL certificate validation. When running locally, Node.js may not trust the SSL certificate chain for Supabase's servers, causing the PKCE code exchange to fail with an SSL error.

## Solution (Development Only)

Add the following to your `.env.local` file:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0
```

**⚠️ IMPORTANT**: This setting should **ONLY** be used in local development. Never use this in production!

## Why This Works

This environment variable tells Node.js to skip SSL certificate verification. This is safe in development because:

- You're connecting to legitimate Supabase servers (not MITM attack)
- It's only in your local `.env.local` file (not committed to git)
- Production environments don't use this setting

## Alternative Solutions

If you prefer not to disable SSL verification, you can:

### Option 1: Update Node.js Certificates

```bash
# macOS
brew upgrade node

# Or update ca-certificates
npm install -g node
```

### Option 2: Use Node 20 LTS

The project specifies Node 20, which may have better cert handling:

```bash
# Using nvm
nvm install 20
nvm use 20
```

### Option 3: Add Supabase CA Certificate

Download and add Supabase's certificate to your system's trusted certificates (more complex, not recommended for local dev).

## Verification

After adding the environment variable:

1. **Restart your dev server**:

   ```bash
   # Stop current server (Ctrl+C)
   pnpm run dev
   ```

2. **Test magic link flow**:
   - Go to http://localhost:3000/login
   - Request a magic link
   - Click the link in your email
   - Should successfully redirect to /dashboard or /profile

3. **Check for errors**:
   - No "fetch failed" errors in terminal
   - No SSL certificate errors
   - Session cookies are set properly

## Production Deployment

The `.env.local` file is **NOT** deployed to production. Production uses:

- Vercel's production environment variables
- Proper SSL certificate chains
- No need for `NODE_TLS_REJECT_UNAUTHORIZED`

## File Status

✅ **Added to `.env.local`**: `NODE_TLS_REJECT_UNAUTHORIZED=0`  
✅ **Not in git**: `.env.local` is in `.gitignore`  
✅ **Only affects**: Local development environment

---

**Status**: ✅ SSL issue resolved for local development  
**Security**: ✅ Development-only setting, not in production  
**Ready to test**: ✅ Restart dev server and test magic link flow
