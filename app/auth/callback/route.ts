import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Server-side auth callback handler for PKCE flow
 *
 * This route handles the magic link callback by:
 * 1. Extracting the auth code from query params
 * 2. Creating redirect response FIRST
 * 3. Exchanging code for session (writes cookies to response)
 * 4. Returning response with Set-Cookie headers
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash'); // Legacy support
  const invitationId = url.searchParams.get('invitation'); // Legacy invitation ID
  const inviteToken = url.searchParams.get('inviteToken'); // New token-based invite
  const inviteEmail = url.searchParams.get('email'); // Email for token-based invite
  const next = url.searchParams.get('next') ?? '/dashboard';
  const origin = url.origin;

  // Handle error params from Supabase
  const errorCode = url.searchParams.get('error_code');
  const errorDescription = url.searchParams.get('error_description');

  if (errorCode || errorDescription) {
    const message =
      errorCode === 'otp_expired'
        ? 'Your login link has expired. Please request a new one.'
        : errorDescription || 'Authentication failed';

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(message)}&error_code=${encodeURIComponent(errorCode || '')}`,
    );
  }

  // Require auth code or token_hash
  if (!code && !tokenHash) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('No authentication code provided')}`,
    );
  }

  // Create redirect response FIRST (will be modified with cookies)
  const redirectUrl = `${origin}${next}`;
  const res = NextResponse.redirect(redirectUrl, { status: 303 });

  // Create server client that writes cookies to the response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({
            name,
            value,
            ...options,
            sameSite: 'lax',
            secure: url.protocol === 'https:',
          });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({
            name,
            value: '',
            ...options,
            maxAge: 0,
            sameSite: 'lax',
            secure: url.protocol === 'https:',
          });
        },
      },
    },
  );

  try {
    // Exchange code for session (writes cookies to res)
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (tokenHash) {
      // Legacy token_hash support
      const { error } = await supabase.auth.verifyOtp({
        type: 'email',
        token_hash: tokenHash,
      });
      if (error) throw error;
    }

    // Get user to determine redirect
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('No user after auth');
    }

    console.log('[auth/callback] user authenticated:', user.id);

    // Clear br_logged_out cookie on successful login
    res.cookies.set('br_logged_out', '', { maxAge: 0, path: '/' });

    // Determine final redirect based on user state
    let finalRedirect = `${origin}/dashboard`;

    // Priority 1: Token-based invitation flow (new)
    if (inviteToken && inviteEmail) {
      finalRedirect = `${origin}/api/invites/accept?token=${encodeURIComponent(inviteToken)}&email=${encodeURIComponent(inviteEmail)}`;
      console.log('[auth/callback] → token-based invitation flow');
    }
    // Priority 2: Legacy invitation ID flow
    else if (invitationId) {
      finalRedirect = `${origin}/api/invitations/${invitationId}/accept`;
      console.log('[auth/callback] → legacy invitation flow');
    } else {
      // Check if user has completed their profile
      const { data: profile } = await supabase
        .from('users')
        .select('first_name, last_name, profile_completed')
        .eq('id', user.id)
        .single();

      const hasCompletedProfile = profile?.profile_completed || profile?.first_name;

      if (!hasCompletedProfile) {
        // New user → profile page with onboarding flag
        finalRedirect = `${origin}/profile?onboarding=1`;
        console.log('[auth/callback] → new user profile (onboarding)');
      } else if (next && next !== '/' && !next.includes('login') && !next.includes('signup')) {
        // Existing user with custom redirect
        finalRedirect = next.startsWith('/') ? `${origin}${next}` : `${origin}/dashboard`;
        console.log('[auth/callback] → custom destination');
      } else {
        // Existing user → dashboard
        console.log('[auth/callback] → dashboard');
      }
    }

    // Update redirect if needed
    if (finalRedirect !== redirectUrl) {
      return NextResponse.redirect(finalRedirect, {
        status: 303,
        headers: res.headers, // Preserve Set-Cookie headers
      });
    }

    // Prevent caching
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (error: any) {
    console.error('[auth/callback] error:', error);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message || 'auth_failed')}`,
    );
  }
}
