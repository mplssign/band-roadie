/**
 * Site configuration and URL helpers for auth redirects
 */

/**
 * Get the base site URL, works in both dev and production
 * @returns Site URL without trailing slash
 */
export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return url.replace(/\/+$/, '');
}

/**
 * Get the auth callback URL for magic links and OAuth
 * @returns Full URL to /auth/callback
 */
export function getAuthCallbackUrl(): string {
  return `${getSiteUrl()}/auth/callback`;
}
