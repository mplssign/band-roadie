import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type PendingCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

const PROTECTED_ROUTE_PREFIXES = [
  '/dashboard',
  '/setlists',
  '/calendar',
  '/members',
  '/settings',
  '/bands',
  '/gigs',
  '/rehearsals',
];

function applyPendingCookies(response: NextResponse, pending: PendingCookie[]) {
  for (const cookie of pending) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

function buildDestination(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  return search ? `${pathname}${search}` : pathname;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const skipAuthCheck =
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/auth/set-session') ||
    pathname.startsWith('/auth/verify-client') ||
    pathname.startsWith('/auth/verify') ||
    pathname.startsWith('/api') ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/invite' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/manifest.json' ||
    pathname.startsWith('/.well-known');

  if (skipAuthCheck) {
    return NextResponse.next();
  }

  const hasMagicLinkParams =
    searchParams.has('code') ||
    searchParams.has('state') ||
    searchParams.has('access_token') ||
    searchParams.has('invitationId') ||
    searchParams.has('invitation') ||
    searchParams.has('inviteToken') ||
    searchParams.has('token_hash');

  if (hasMagicLinkParams && pathname !== '/auth/callback') {
    const callbackUrl = new URL('/auth/callback', request.url);
    searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(callbackUrl);
  }

  if (pathname === '/') {
    return NextResponse.next();
  }

  if (hasMagicLinkParams) {
    return NextResponse.next();
  }

  const pendingCookies: PendingCookie[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          pendingCookies.push({ name, value, options });
        },
        remove(name: string, options: CookieOptions) {
          pendingCookies.push({
            name,
            value: '',
            options: { ...options, maxAge: 0 },
          });
        },
      },
    },
  );

  let hasSession = false;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    hasSession = Boolean(session);
  } catch (error) {
    // If Supabase is unreachable (offline scenario), allow the request to continue.
    hasSession = Boolean(request.cookies.get('sb-access-token')?.value);
  }

  const hasLoggedOut = request.cookies.get('br_logged_out')?.value === 'true';

  const requiresAuth = PROTECTED_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (requiresAuth && !hasSession) {
    if (hasLoggedOut) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirectedFrom', pathname);
      const redirectResponse = NextResponse.redirect(url);
      return applyPendingCookies(redirectResponse, pendingCookies);
    }

    const url = request.nextUrl.clone();
    url.pathname = '/auth/verify-client';
    url.searchParams.set('next', buildDestination(request));
    url.searchParams.set('source', 'session-bootstrap');
    const redirectResponse = NextResponse.redirect(url);
    return applyPendingCookies(redirectResponse, pendingCookies);
  }

  if (pathname.startsWith('/profile') && !hasSession) {
    const hasOnboardingParams =
      searchParams.has('onboarding') ||
      searchParams.has('invitationId') ||
      searchParams.has('bandId');

    if (!hasOnboardingParams) {
      if (hasLoggedOut) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('redirectedFrom', pathname);
        const redirectResponse = NextResponse.redirect(url);
        return applyPendingCookies(redirectResponse, pendingCookies);
      }

      const url = request.nextUrl.clone();
      url.pathname = '/auth/verify-client';
      url.searchParams.set('next', buildDestination(request));
      url.searchParams.set('source', 'session-bootstrap');
      const redirectResponse = NextResponse.redirect(url);
      return applyPendingCookies(redirectResponse, pendingCookies);
    }
  }

  const nextResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  return applyPendingCookies(nextResponse, pendingCookies);
}

export const config = {
  matcher: [
    '/((?!_next|api|auth/callback|favicon.ico|manifest.webmanifest|icons|.*\\.(?:png|jpg|jpeg|svg|webp|ico)).*)',
  ],
};
