import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = await createClient();

    // Get user session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    // Get session info
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    // Check cookies
    const accessTokenCookie = cookieStore.get('sb-access-token');
    const refreshTokenCookie = cookieStore.get('sb-refresh-token');
    const bandIdCookie = cookieStore.get('br_current_band_id');

    const debugInfo = {
      timestamp: new Date().toISOString(),
      user: {
        id: user?.id || 'No user',
        email: user?.email || 'No email',
        error: userError?.message || null,
      },
      session: {
        exists: !!session,
        accessToken: session?.access_token ? 'Present' : 'Missing',
        refreshToken: session?.refresh_token ? 'Present' : 'Missing',
        expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'Unknown',
        error: sessionError?.message || null,
      },
      cookies: {
        accessToken: accessTokenCookie ? 'Present' : 'Missing',
        refreshToken: refreshTokenCookie ? 'Present' : 'Missing',
        bandId: bandIdCookie ? bandIdCookie.value : 'Missing',
      },
      headers: {
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
        authorization: request.headers.get('authorization') ? 'Present' : 'Missing',
      }
    };

    return NextResponse.json({ 
      status: 'success', 
      authenticated: !!user,
      debugInfo 
    });

  } catch (error) {
    console.error('Auth debug error:', error);
    return NextResponse.json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error',
      authenticated: false 
    }, { status: 500 });
  }
}