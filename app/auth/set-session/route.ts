import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const access_token = url.searchParams.get('access_token');
  const refresh_token = url.searchParams.get('refresh_token');
  // Always redirect to /auth/verify-client after session is set
  const next = '/auth/verify-client';

  console.log('[auth/callback] === CALLBACK STARTED ===');
  console.log('[auth/callback] Full URL:', request.url);
  console.log('[auth/callback] Code:', code ? `present (${code.substring(0, 10)}...)` : 'MISSING');
  console.log(
    '[auth/callback] Access token:',
    access_token ? `present (${access_token.substring(0, 10)}...)` : 'MISSING',
  );
  console.log('[auth/callback] Next:', next);
  console.log('[auth/callback] All params:', Object.fromEntries(url.searchParams));

  const cookieStore = await cookies();

  // Track cookies to set in response
  const cookiesToSet: Array<{ name: string; value: string; options: any }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookiesToSet.push({ name, value, options });
        },
        remove(name: string, options: any) {
          cookiesToSet.push({ name, value: '', options });
        },
      },
    },
  );

  if (code) {
    console.log('[auth/callback] Exchanging code for session...');
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[auth/callback] Exchange error:', error);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
      );
    }

    console.log('[auth/callback] Session established successfully');
    console.log('[auth/callback] User:', data.user?.email);
  } else if (access_token && refresh_token) {
    console.log('[auth/callback] Setting session from tokens...');
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      console.error('[auth/callback] Set session error:', error);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
      );
    }

    console.log('[auth/callback] Session established successfully via tokens');
    console.log('[auth/callback] User:', data.user?.email);
  } else {
    console.error('[auth/callback] No code or tokens provided - cannot establish session');
    return NextResponse.redirect(new URL('/login?error=No+authentication+data', url.origin));
  }

  console.log('[auth/callback] Redirecting to:', next);
  // Create redirect response to /auth/verify
  const redirectResponse = NextResponse.redirect(new URL(next, url.origin));
  for (const cookie of cookiesToSet) {
    redirectResponse.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  console.log('[auth/callback] Set', cookiesToSet.length, 'cookies in response');
  return redirectResponse;
}
