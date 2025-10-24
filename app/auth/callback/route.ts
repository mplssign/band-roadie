import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Server-side auth callback handler for PKCE flow
 *
 * This route handles the magic link callback by:
 * 1. Extracting the auth code from query params
 * 2. Exchanging the code for a session server-side
 * 3. Setting session cookies via Next.js cookies()
 * 4. Redirecting to appropriate destination based on user state
 *
 * CRITICAL: This must be a server route (not a client page) to properly
 * set httpOnly session cookies and avoid browser context issues.
 */
export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get('code');
  const invitationId = requestUrl.searchParams.get('invitation');
  const next = requestUrl.searchParams.get('next') ?? '/dashboard';
  const origin = requestUrl.origin;

  // Handle error params from Supabase (expired links, etc.)
  const errorCode = requestUrl.searchParams.get('error_code');
  const errorDescription = requestUrl.searchParams.get('error_description');

  if (errorCode || errorDescription) {
    const message =
      errorCode === 'otp_expired'
        ? 'Your login link has expired. Please request a new one.'
        : errorDescription || 'Authentication failed';

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(message)}&error_code=${encodeURIComponent(errorCode || '')}`,
      302,
    );
  }

  // Require auth code
  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('No authentication code provided')}`,
      302,
    );
  }

  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log('[Auth Callback] Received code:', code.substring(0, 10) + '...');
  }

  const cookieStore = cookies();

  // Create server client with cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Cookie setting can fail in middleware, ignore
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Cookie removal can fail in middleware, ignore
          }
        },
      },
    },
  );

  // Exchange code for session (server-side, sets cookies automatically)
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    // eslint-disable-next-line no-console
    console.error('[Auth Callback] Exchange error:', exchangeError.message);

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`,
      302,
    );
  }

  // Get user to check profile status
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Authentication failed')}`,
      302,
    );
  }

  // Determine redirect destination based on user state
  let redirectUrl: string;
  let redirectReason: string;

  // Priority 1: Invitation flow
  if (invitationId) {
    // User has an invitation to accept - process invitation first
    redirectUrl = `${origin}/api/invitations/${invitationId}/accept`;
    redirectReason = 'invitation';
    // eslint-disable-next-line no-console
    console.log(`[Auth Callback] User ${user.id} → ${redirectUrl} (reason: ${redirectReason})`);
  } else {
    // Check if user has completed their profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('first_name, last_name, profile_completed')
      .eq('id', user.id)
      .single();

    // Profile is considered complete if user has first_name OR profile_completed flag is true
    const hasCompletedProfile =
      !profileError && (profile?.profile_completed || profile?.first_name);

    if (!hasCompletedProfile) {
      // Priority 2: New user (no profile) → must complete profile
      redirectUrl = `${origin}/profile?welcome=true`;
      redirectReason = 'new_user_profile_required';
      // eslint-disable-next-line no-console
      console.log(`[Auth Callback] User ${user.id} → ${redirectUrl} (reason: ${redirectReason})`);
    } else {
      // Priority 3: Existing user with completed profile
      // Check if there's a safe 'next' destination
      const hasValidNext =
        next &&
        next !== '/' &&
        next !== '/dashboard' &&
        !next.includes('login') &&
        !next.includes('signup');

      if (hasValidNext) {
        // Use requested destination for existing user
        redirectUrl = next.startsWith('/') ? `${origin}${next}` : `${origin}/dashboard`;
        redirectReason = 'existing_user_with_next';
      } else {
        // Default destination for existing user: dashboard
        redirectUrl = `${origin}/dashboard`;
        redirectReason = 'existing_user_default';
      }
      // eslint-disable-next-line no-console
      console.log(
        `[Auth Callback] User ${user.id} → ${redirectUrl} (reason: ${redirectReason}, hasProfile: true)`,
      );
    }
  }

  // Redirect with session cookies set
  return NextResponse.redirect(redirectUrl, 302);
}
