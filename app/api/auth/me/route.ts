import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Get current user from server session cookies
 */
export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('sb-access-token')?.value;
  const refreshToken = req.cookies.get('sb-refresh-token')?.value;

  console.log('[api/auth/me] Checking cookies:', {
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
    accessTokenLength: accessToken?.length,
    cookieNames: Array.from(req.cookies.getAll().map((c) => c.name)),
  });

  if (!accessToken || !refreshToken) {
    console.error('[api/auth/me] No session cookies found');
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }

  try {
    // Decode JWT to get user ID (no network call needed - token came from Supabase)
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
    const userId = payload.sub;

    console.log('[api/auth/me] Decoded user ID:', userId);

    // Get user profile from database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: profile } = await supabase
      .from('users')
      .select('profile_completed, first_name, last_name')
      .eq('id', userId)
      .single();

    console.log('[api/auth/me] Profile data:', profile);

    // Return minimal user object from JWT payload
    const user = {
      id: userId,
      email: payload.email,
      user_metadata: payload.user_metadata,
    };

    console.log('[api/auth/me] Returning user and profile');

    return NextResponse.json({ user, profile });
  } catch (err) {
    console.error('[api/auth/me] Error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
