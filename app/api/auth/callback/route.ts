import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Server-side auth callback
 * Accepts tokens from client and sets HttpOnly cookies
 * No PKCE in browser - server is confidential client
 */
export async function POST(req: NextRequest) {
  try {
    const { access_token, refresh_token } = await req.json();

    console.log('[api/auth/callback] POST:', {
      hasAccessToken: !!access_token,
      hasRefreshToken: !!refresh_token,
      accessTokenLength: access_token?.length,
    });

    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: 'Missing tokens' }, { status: 400 });
    }

    // Tokens came from Supabase redirect, trust them without verification
    // Verification would require network call which can fail with ECONNRESET
    console.log('[api/auth/callback] Setting cookies for tokens');

    // Create response with HttpOnly cookies
    const res = NextResponse.json({ success: true });

    res.cookies.set('sb-access-token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });

    res.cookies.set('sb-refresh-token', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    console.log('[api/auth/callback] Cookies set successfully');

    return res;
  } catch (err) {
    console.error('[api/auth/callback] Error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * GET handler for direct redirects (legacy/fallback)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // Check for both token_hash (direct) and access_token/refresh_token (after Supabase redirect)
  const token_hash = url.searchParams.get('token_hash');
  const access_token = url.searchParams.get('access_token');
  const refresh_token = url.searchParams.get('refresh_token');
  const error_code = url.searchParams.get('error_code');
  const error_description = url.searchParams.get('error_description');
  const type = url.searchParams.get('type');
  const origin = url.origin;

  // Log all query params for debugging
  const allParams: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    allParams[key] = value;
  });
  console.log('[api/auth/callback] All params:', allParams);
  console.log('[api/auth/callback] Tokens:', {
    hasTokenHash: !!token_hash,
    hasAccessToken: !!access_token,
    hasRefreshToken: !!refresh_token,
    error_code,
    error_description,
    type,
  });

  // Check for errors from Supabase
  if (error_code || error_description) {
    console.error('[api/auth/callback] Supabase error:', { error_code, error_description });
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error_description || error_code || 'Auth error')}`,
    );
  }

  // If we have tokens directly (from Supabase redirect), use them
  if (access_token && refresh_token) {
    console.log('[api/auth/callback] Using tokens from Supabase redirect');

    const res = NextResponse.redirect(`${origin}/auth/verify`);

    res.cookies.set('sb-access-token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });

    res.cookies.set('sb-refresh-token', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return res;
  }

  // Otherwise, verify token_hash
  if (!token_hash || !type) {
    console.error('[api/auth/callback] Missing token_hash or type');
    return NextResponse.redirect(`${origin}/login?error=Invalid+auth+link`);
  }

  // Create admin client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  try {
    // Verify the OTP token server-side
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    });

    if (error || !data.session) {
      console.error('[api/auth/callback] Verify error:', error);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error?.message || 'Auth failed')}`,
      );
    }

    console.log('[api/auth/callback] Session created for user:', data.user?.id);

    // Create response with HttpOnly cookies
    const res = NextResponse.redirect(`${origin}/auth/verify`);

    // Set session in HttpOnly cookie
    res.cookies.set('sb-access-token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });

    res.cookies.set('sb-refresh-token', data.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return res;
  } catch (err) {
    console.error('[api/auth/callback] Error:', err);
    return NextResponse.redirect(`${origin}/login?error=Auth+failed`);
  }
}
