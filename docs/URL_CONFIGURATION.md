# URL Configuration Guide

This document explains how Band Roadie handles URLs across different environments (local, preview, production) to ensure auth redirects and email links always work correctly.

## Overview

The app uses a centralized `getBaseUrl()` helper that automatically detects the correct base URL based on the environment. This ensures magic links, invite emails, and OAuth callbacks work seamlessly across all deployment environments.

## How It Works

### The `getBaseUrl()` Helper

Located in `lib/config/site.ts`, this function determines the base URL with the following priority:

1. **`NEXT_PUBLIC_SITE_URL`** - Explicit override (highest priority)
2. **`VERCEL_URL`** - Automatic Vercel preview URL (preview deployments)
3. **`http://localhost:3000`** - Local development fallback

```typescript
export function getBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  const fromVercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  return (fromEnv || fromVercel || 'http://localhost:3000').replace(/\/$/, '');
}
```

### Where It's Used

1. **`lib/constants.ts`**
   - `APP_URL` exports the base URL for use throughout the app
   
2. **`lib/config/site.ts`**
   - `getAuthCallbackUrl()` builds the full auth callback URL
   
3. **Auth pages** (`login`, `signup`)
   - Use `getAuthCallbackUrl()` for `emailRedirectTo` in magic links
   
4. **Invite system** (`lib/server/send-band-invites.ts`)
   - Uses `APP_URL` to build invite links and auth callbacks
   
5. **Fallback redirect** (`app/callback/route.ts`)
   - Uses `getBaseUrl()` to redirect old callback URLs

## Environment Setup

### Local Development

```bash
# .env.local
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Vercel Deployment

Configure these environment variables in Vercel → Project Settings → Environment Variables:

#### Production
```bash
NEXT_PUBLIC_SITE_URL=https://bandroadie.com
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### Preview (Optional)
You can leave `NEXT_PUBLIC_SITE_URL` unset for preview deployments, and the app will automatically use Vercel's preview URL (`VERCEL_URL`).

Or explicitly set:
```bash
NEXT_PUBLIC_SITE_URL=https://bandroadie.vercel.app
```

#### Development (Optional)
```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Supabase Configuration

After deploying, update your Supabase project settings:

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL**: `https://bandroadie.com`
3. Add **Redirect URLs**:
   - `https://bandroadie.com/auth/callback` (production)
   - `https://bandroadie.vercel.app/auth/callback` (preview)
   - `http://localhost:3000/auth/callback` (local dev)

## Migration Notes

### Old Environment Variable

The app previously used `NEXT_PUBLIC_APP_URL`, which has been replaced with `NEXT_PUBLIC_SITE_URL` for consistency with Next.js conventions and better Vercel integration.

If you have existing environment variables, update them:
```diff
- NEXT_PUBLIC_APP_URL=https://bandroadie.com
+ NEXT_PUBLIC_SITE_URL=https://bandroadie.com
```

### Automatic Vercel Preview URLs

A key improvement is that preview deployments now automatically use the correct Vercel-provided URL without requiring manual configuration. This means:

- ✅ Preview deployments work out of the box
- ✅ No need to manually update URLs for each preview
- ✅ Auth callbacks automatically point to the preview URL

## Troubleshooting

### Magic links redirect to wrong domain

**Symptom:** Magic links redirect to localhost or an old domain

**Solution:** 
1. Check `NEXT_PUBLIC_SITE_URL` is set correctly in Vercel
2. Redeploy after changing environment variables
3. Ensure Supabase redirect URLs include your domain

### Invite emails have wrong URLs

**Symptom:** Invite emails contain localhost URLs in production

**Solution:**
1. Verify `NEXT_PUBLIC_SITE_URL` is set in production environment
2. The `APP_URL` constant automatically uses `getBaseUrl()`
3. Check `lib/server/send-band-invites.ts` uses `APP_URL`

### Preview deployments don't work

**Symptom:** Auth callbacks fail in Vercel preview deployments

**Solution:**
1. Leave `NEXT_PUBLIC_SITE_URL` unset in preview environment
2. The app will automatically use `VERCEL_URL`
3. Add the preview URL pattern to Supabase redirect URLs

## Testing

You can verify the URL configuration by checking these values:

```typescript
import { getBaseUrl, getAuthCallbackUrl } from '@/lib/config/site';
import { APP_URL } from '@/lib/constants';

console.log('Base URL:', getBaseUrl());
console.log('Auth Callback:', getAuthCallbackUrl());
console.log('App URL:', APP_URL);
```

Expected output:
- **Local:** `http://localhost:3000`
- **Preview:** `https://your-app-git-branch-username.vercel.app`
- **Production:** `https://bandroadie.com`
