import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Server-side auth callback handler for PKCE flow
 *
 * This route handles the magic link callback by:
 * 1. Extracting auth code from query params
 * 2. Exchanging code for session (Supabase handles PKCE verifier lookup from cookies)
 * 3. Routing users based on profile state (new → /profile, existing → /dashboard)
 * 4. Processing invitations if present
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const tokenHash = url.searchParams.get('token_hash'); // Legacy support
  const invitationId = url.searchParams.get('invitation') || url.searchParams.get('invitationId');
  const inviteToken = url.searchParams.get('inviteToken');
  const inviteEmail = url.searchParams.get('email');
  const next = url.searchParams.get('next') ?? '/dashboard';
  const origin = url.origin;

  console.log('[auth/callback] Request:', {
    hasCode: !!code,
    hasState: !!state,
    hasTokenHash: !!tokenHash,
    invitationId,
    inviteToken: inviteToken?.substring(0, 8),
    inviteEmail,
    next,
  });

  // Handle error params from Supabase
  const errorCode = url.searchParams.get('error_code');
  const errorDescription = url.searchParams.get('error_description');

  if (errorCode || errorDescription) {
    const message =
      errorCode === 'otp_expired'
        ? 'Your login link has expired. Please request a new one.'
        : errorCode === 'pkce_session_expired'
        ? 'Your login session expired. Please open the magic link in the same browser or request a new one.'
        : errorDescription || 'Authentication failed';

    console.error('[auth/callback] Auth error:', { errorCode, errorDescription });

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(message)}&error_code=${encodeURIComponent(errorCode || '')}`,
    );
  }

  // Require auth code or token_hash
  if (!code && !tokenHash) {
    console.error('[auth/callback] Missing auth code');
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
    // Exchange code for session (Supabase retrieves PKCE verifier from cookie storage)
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('[auth/callback] exchangeCodeForSession error:', {
          message: error.message,
          status: error.status,
        });
        throw error;
      }

      console.log('[auth/callback] Session exchanged successfully:', {
        hasUser: !!data?.user,
        hasSession: !!data?.session,
      });
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

    // Check user metadata for invitation_id (stored during magic link generation)
    let invitationIdFromMetadata: string | null = null;
    if (user.user_metadata?.invitation_id) {
      invitationIdFromMetadata = user.user_metadata.invitation_id;
      console.log(
        '[auth/callback] Found invitation_id in user metadata:',
        invitationIdFromMetadata,
      );
    }

    // Use invitation from query param or metadata
    const finalInvitationId = invitationId || invitationIdFromMetadata;

    // Clear br_logged_out cookie on successful login
    res.cookies.set('br_logged_out', '', { maxAge: 0, path: '/' });

    // Check if user profile exists and is completed
    const { data: profile } = await supabase
      .from('users')
      .select('first_name, last_name, profile_completed')
      .eq('id', user.id)
      .single();

    const isNewUser = !profile || (!profile.profile_completed && !profile.first_name);

    console.log('[auth/callback] Profile check:', {
      hasProfile: !!profile,
      isNewUser,
      profile_completed: profile?.profile_completed,
    });

    // Determine final redirect based on user state
    let finalRedirect = `${origin}/dashboard`;
    let bandIdForRedirect: string | null = null;

    // PRIORITY 1: Handle invitation acceptance first (if present)
    if (finalInvitationId || inviteToken) {
      console.log('[auth/callback] Processing invitation:', {
        finalInvitationId,
        inviteToken: inviteToken?.substring(0, 8),
      });

      try {
        let invitation: any = null;

        // Fetch invitation by ID or token
        if (finalInvitationId) {
          const { data, error } = await supabase
            .from('band_invitations')
            .select('*, bands(name)')
            .eq('id', finalInvitationId)
            .eq('email', user.email)
            .single();

          if (!error && data) invitation = data;
        } else if (inviteToken && inviteEmail) {
          const { data, error } = await supabase
            .from('band_invitations')
            .select('*, bands(name)')
            .eq('token', inviteToken)
            .eq('email', inviteEmail.toLowerCase())
            .single();

          if (!error && data) invitation = data;
        }

        if (invitation && invitation.status !== 'accepted') {
          // Check if already a member
          const { data: existingMember } = await supabase
            .from('band_members')
            .select('id')
            .eq('band_id', invitation.band_id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (!existingMember) {
            // Add user to band
            const { error: memberError } = await supabase.from('band_members').insert({
              band_id: invitation.band_id,
              user_id: user.id,
              role: 'member',
            });

            if (memberError) {
              console.error('[auth/callback] Error adding to band:', memberError);
            } else {
              console.log('[auth/callback] Successfully added user to band:', invitation.band_id);
            }
          }

          // Mark invitation as accepted
          await supabase
            .from('band_invitations')
            .update({ status: 'accepted' })
            .eq('id', invitation.id);

          bandIdForRedirect = invitation.band_id;
        }
      } catch (inviteError) {
        console.error('[auth/callback] Error processing invitation:', inviteError);
        // Continue with normal flow even if invitation fails
      }
    }

    // PRIORITY 2: Route based on user profile status
    if (isNewUser) {
      // New user → profile page with invitation context
      if (invitationId) {
        finalRedirect = `${origin}/profile?invitationId=${invitationId}`;
      } else if (bandIdForRedirect) {
        finalRedirect = `${origin}/profile?bandId=${bandIdForRedirect}`;
      } else {
        finalRedirect = `${origin}/profile?onboarding=1`;
      }
      console.log('[auth/callback] → new user to profile');
    } else {
      // Existing user → dashboard with band context
      if (bandIdForRedirect) {
        finalRedirect = `${origin}/dashboard?bandId=${bandIdForRedirect}`;
      } else if (next && next !== '/' && !next.includes('login') && !next.includes('signup')) {
        finalRedirect = next.startsWith('/') ? `${origin}${next}` : `${origin}/dashboard`;
      } else {
        finalRedirect = `${origin}/dashboard`;
      }
      console.log('[auth/callback] → existing user to dashboard');
    }

    console.log('[auth/callback] Final redirect:', {
      isNewUser,
      hasBandId: !!bandIdForRedirect,
      hasInvitation: !!(finalInvitationId || inviteToken),
      destination: finalRedirect,
    });

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
    console.error('[auth/callback] Error:', {
      message: error.message,
      code: error.code,
      status: error.status,
      hasState: !!state,
      hasCode: !!code,
    });

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message || 'auth_failed')}`,
    );
  }
}
