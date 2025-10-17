/**
 * Site configuration and URL helpers for auth redirects
 */

/**
 * Get the base site URL with automatic environment detection.
 * 
 * Priority:
 * 1. NEXT_PUBLIC_SITE_URL (production/preview/dev override)
 * 2. VERCEL_URL (automatic Vercel preview deployments)
 * 3. http://localhost:3000 (local dev fallback)
 * 
 * @returns Site URL without trailing slash
 */
export function getBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  const fromVercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  return (fromEnv || fromVercel || 'http://localhost:3000').replace(/\/$/, '');
}

/**
 * @deprecated Use getBaseUrl() instead
 */
export function getSiteUrl(): string {
  return getBaseUrl();
}

/**
 * Get the auth callback URL for magic links and OAuth
 * @returns Full URL to /auth/callback
 */
export function getAuthCallbackUrl(): string {
  return `${getBaseUrl()}/auth/callback`;
}
