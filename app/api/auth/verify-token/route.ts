import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Server-side token verifier
 * Exchanges a magic link token for session tokens
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token || !email) {
      return NextResponse.redirect(new URL('/login?error=Invalid+link', req.url));
    }

    console.log('[api/auth/verify-token] Verifying token for:', email);

    // Create admin client with service role key
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

    // Verify the token using admin API
    // This exchanges the hashed token for actual session tokens
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'magiclink',
    });

    if (error || !data.session) {
      console.error('[api/auth/verify-token] Verification failed:', error);
      return NextResponse.redirect(new URL('/login?error=Invalid+or+expired+link', req.url));
    }

    console.log('[api/auth/verify-token] Verification successful for:', email);

    // Set cookies with the session tokens
    const response = NextResponse.redirect(new URL('/auth/verify', req.url));

    response.cookies.set('sb-access-token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });

    response.cookies.set('sb-refresh-token', data.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('[api/auth/verify-token] Error:', err);
    return NextResponse.redirect(new URL('/login?error=Something+went+wrong', req.url));
  }
}
