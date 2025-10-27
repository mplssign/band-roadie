import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Skip middleware for auth routes, API, and static assets
  // These routes need uninterrupted access for magic links and PKCE flow
  if (
    pathname.startsWith('/api/auth') || // Auth API endpoints (including /api/auth/start)
    pathname.startsWith('/auth/callback') || // OAuth callback
    pathname.startsWith('/api') || // All other API routes
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/invite' || // Invite landing page
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/manifest.json' ||
    pathname.startsWith('/.well-known')
  ) {
    return NextResponse.next();
  }

  // Check for magic link / invitation parameters that indicate auth flow
  const hasMagicLinkParams =
    searchParams.has('code') ||
    searchParams.has('state') || // PKCE state parameter
    searchParams.has('access_token') ||
    searchParams.has('invitationId') ||
    searchParams.has('invitation') ||
    searchParams.has('inviteToken') ||
    searchParams.has('token_hash');

  // If URL has magic link params, redirect to auth callback
  if (hasMagicLinkParams && pathname !== '/auth/callback') {
    const callbackUrl = new URL('/auth/callback', request.url);
    // Preserve all query params including state for PKCE
    searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value);
    });
    console.log('[middleware] Redirecting magic link to /auth/callback');
    return NextResponse.redirect(callbackUrl);
  }

  // Public path that never requires auth
  if (pathname === '/') {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check for explicit logout cookie
  const hasLoggedOut = request.cookies.get('br_logged_out')?.value === 'true';

  // Protected routes require authentication
  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/setlists') ||
    pathname.startsWith('/calendar') ||
    pathname.startsWith('/members') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/bands') ||
    pathname.startsWith('/gigs') ||
    pathname.startsWith('/rehearsals')
  ) {
    if (!user) {
      // Only redirect to login if user explicitly logged out
      // Don't redirect if they're in an auth flow (will be handled by callback)
      if (hasLoggedOut) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('redirectedFrom', pathname);
        return NextResponse.redirect(url);
      }
      // If not explicitly logged out, still redirect to login but preserve context
      // The auth callback will handle the proper flow
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirectedFrom', pathname);
      return NextResponse.redirect(url);
    }
  }

  // /profile route - allow new users from auth callback (onboarding flow)
  // but require auth for direct access without onboarding params
  if (pathname.startsWith('/profile')) {
    const hasOnboardingParams =
      searchParams.has('onboarding') ||
      searchParams.has('invitationId') ||
      searchParams.has('bandId');

    if (!user && !hasOnboardingParams) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirectedFrom', pathname);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

// Exclude callback and static assets from running middleware at all
export const config = {
  matcher: [
    '/((?!_next|api|auth/callback|favicon.ico|manifest.webmanifest|icons|.*\\.(?:png|jpg|jpeg|svg|webp|ico)).*)',
  ],
};
