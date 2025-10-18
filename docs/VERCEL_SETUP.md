# Vercel Environment Variables Setup Guide

After deploying to Vercel, configure these environment variables for correct auth redirect behavior.

## Quick Setup

Go to your Vercel project → **Settings** → **Environment Variables**

## Required Variables

### Production Environment

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SITE_URL` | `https://bandroadie.com` | Your production domain |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://nekwjxvgbveheooyorjo.supabase.co` | From Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` | From Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | From Supabase project settings (Secret!) |
| `RESEND_API_KEY` | `re_...` | For sending emails |
| `RESEND_FROM_EMAIL` | `noreply@bandroadie.com` | Verified sender email |
| `SPOTIFY_CLIENT_ID` | `74f53...` | Optional: for BPM lookup |
| `SPOTIFY_CLIENT_SECRET` | `a8528...` | Optional: for BPM lookup |

### Preview Environment

For preview deployments, you can either:

**Option A: Let Vercel auto-detect (Recommended)**
- Leave `NEXT_PUBLIC_SITE_URL` unset
- App will automatically use `VERCEL_URL` for preview deployments

**Option B: Set explicit preview URL**
| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SITE_URL` | `https://bandroadie.vercel.app` |

Also set the same database/API keys as production:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

### Development Environment

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` |

(Other variables should be set in your local `.env.local` file)

## Using Vercel CLI

Alternatively, add variables via CLI:

```bash
# Production
vercel env add NEXT_PUBLIC_SITE_URL production
# Enter: https://bandroadie.com

vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Enter: https://nekwjxvgbveheooyorjo.supabase.co

# ... repeat for other variables

# Preview (optional - can skip to use auto-detection)
vercel env add NEXT_PUBLIC_SITE_URL preview
# Enter: https://bandroadie.vercel.app
```

## Post-Deployment Checklist

After setting environment variables:

1. ✅ **Redeploy** - Environment variables only apply to new deployments
   ```bash
   vercel --prod
   ```

2. ✅ **Update Supabase Redirect URLs**
   - Go to Supabase → Authentication → URL Configuration
   - Set Site URL: `https://bandroadie.com`
   - Add redirect URLs:
     - `https://bandroadie.com/auth/callback`
     - `https://bandroadie.vercel.app/auth/callback` (preview)
     - `http://localhost:3000/auth/callback` (dev)

3. ✅ **Test Magic Link Login**
   - Try logging in with email on production
   - Check that redirect goes to `https://bandroadie.com/auth/callback`
   - Verify you're redirected to dashboard after login

4. ✅ **Test Invite Emails**
   - Send a band invitation
   - Check email contains production URL
   - Verify invite link works correctly

## Troubleshooting

### "Invalid redirect URL" error from Supabase

**Solution:** Add your domain to Supabase redirect URLs (see step 2 above)

### Magic links redirect to localhost

**Solution:** 
1. Check `NEXT_PUBLIC_SITE_URL` is set in Vercel production environment
2. Redeploy after setting the variable

### Preview deployments show wrong URL

**Solution:**
1. Check `NEXT_PUBLIC_SITE_URL` is NOT set in preview environment
2. Or set it to your preview domain explicitly
3. Redeploy the preview

### Environment variables not taking effect

**Solution:** Redeploy! Changes only apply to new deployments.

```bash
vercel --prod  # Redeploy production
```

## Security Notes

⚠️ **Never commit secrets to git**
- `.env.local` is in `.gitignore`
- Store secrets only in Vercel dashboard or CLI

⚠️ **Service role key is powerful**
- `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security
- Only use server-side, never expose to client
- Keep it secret in Vercel environment variables

## Migration from Old Variable

If you previously used `NEXT_PUBLIC_APP_URL`, update it:

```diff
- NEXT_PUBLIC_APP_URL=https://bandroadie.com
+ NEXT_PUBLIC_SITE_URL=https://bandroadie.com
```

Then redeploy.
