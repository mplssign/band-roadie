import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type PendingCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

const FALLBACK_REDIRECT = '/dashboard';
const HASH_EXTRACTOR_FLAG = '__hash_parsed';
const HASH_EXTRACTION_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>Verifying&hellip;</title><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f0f0f;color:#fafafa;"><div style="text-align:center;max-width:320px;padding:24px;"><h1 style="font-size:20px;margin-bottom:12px;">Completing sign in&hellip;</h1><p style="font-size:15px;color:#cfcfcf;margin-bottom:20px;">Hang tight while we finish setting up your session.</p></div><script>(function(){try{var hash=window.location.hash;if(hash&&hash.length>1){var hashParams=new URLSearchParams(hash.slice(1));if(hashParams.size>0){var url=new URL(window.location.href);hashParams.forEach(function(value,key){url.searchParams.set(key,value);});url.searchParams.set('${HASH_EXTRACTOR_FLAG}','1');url.hash='';window.location.replace(url.toString());return;}}}catch(error){console.error('[auth/callback] hash extraction error',error);}window.location.replace('/login?error='+encodeURIComponent('No authentication data found.'));})();</script></body></html>`;

export const dynamic = 'force-dynamic';

function buildSafePath(url: URL, value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const target = new URL(value, url.origin);
    if (target.origin !== url.origin) {
      return null;
    }
    return `${target.pathname}${target.search}${target.hash}` || '/';
  } catch (error) {
    if (value.startsWith('/')) {
      return value;
    }
    console.warn('[auth/callback] Ignoring unsafe redirect target:', value, error);
    return null;
  }
}

function buildLoginRedirect(url: URL, message: string) {
  const loginUrl = new URL('/login', url.origin);
  loginUrl.searchParams.set('error', message);
  return loginUrl;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const params = url.searchParams;

  const code = params.get('code');
  const accessTokenParam = params.get('access_token');
  const refreshTokenParam = params.get('refresh_token');
  const tokenHash = params.get('token_hash');
  const tokenType = params.get('type');
  const rawNext = params.get('next');
  const invitationParam =
    params.get('invitation') ?? params.get('invitationId') ?? params.get('inviteToken');
  const bandId = params.get('bandId');
  const onboarding = params.get('onboarding');
  const errorParam = params.get('error');
  const errorCode = params.get('error_code');
  const errorDescription = params.get('error_description');
  const hashParsed = params.get(HASH_EXTRACTOR_FLAG) === '1';

  if (hashParsed) {
    url.searchParams.delete(HASH_EXTRACTOR_FLAG);
  }

  console.log('[auth/callback] === CALLBACK STARTED ===');
  console.log('[auth/callback] URL:', url.toString());
  console.log('[auth/callback] Params:', Object.fromEntries(params.entries()));

  if (errorParam || errorCode || errorDescription) {
    const rawError = errorDescription || errorCode || errorParam || 'Authentication failed';
    let message = rawError;

    try {
      message = decodeURIComponent(rawError.replace(/\+/g, ' '));
    } catch (error) {
      console.warn('[auth/callback] Failed to decode error message:', error);
    }

    console.error('[auth/callback] Supabase returned error:', {
      error: errorParam,
      errorCode,
      errorDescription,
    });
    return NextResponse.redirect(buildLoginRedirect(url, message));
  }

  if (!code && !(accessTokenParam && refreshTokenParam) && !tokenHash) {
    if (!hashParsed) {
      return new NextResponse(HASH_EXTRACTION_HTML, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    console.error('[auth/callback] Missing auth credentials in callback');
    return NextResponse.redirect(buildLoginRedirect(url, 'No authentication data found.'));
  }

  const cookieStore = cookies();
  const cookiesToSet: PendingCookie[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookiesToSet.push({ name, value, options });
        },
        remove(name: string, options: CookieOptions) {
          cookiesToSet.push({ name, value: '', options });
        },
      },
    },
  );

  let sessionUserId: string | null = null;
  let sessionAccessToken: string | null = null;
  let sessionRefreshToken: string | null = null;

  try {
    if (code) {
      console.log('[auth/callback] Exchanging code for session...', {
        codePreview: `${code.slice(0, 6)}…`,
      });
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('[auth/callback] exchangeCodeForSession error:', error);
        return NextResponse.redirect(buildLoginRedirect(url, error.message));
      }

      sessionUserId = data.user?.id ?? null;
      sessionAccessToken = data.session?.access_token ?? null;
      sessionRefreshToken = data.session?.refresh_token ?? null;
    } else if (accessTokenParam && refreshTokenParam) {
      console.log('[auth/callback] Using access/refresh tokens provided in callback');
      const { data, error } = await supabase.auth.setSession({
        access_token: accessTokenParam,
        refresh_token: refreshTokenParam,
      });

      if (error) {
        console.error('[auth/callback] setSession error:', error);
        return NextResponse.redirect(buildLoginRedirect(url, error.message));
      }

      sessionUserId = data.user?.id ?? null;
      sessionAccessToken = data.session?.access_token ?? accessTokenParam;
      sessionRefreshToken = data.session?.refresh_token ?? refreshTokenParam;
    } else if (tokenHash && tokenType) {
      console.log('[auth/callback] Verifying legacy token_hash flow');
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: tokenType as 'magiclink' | 'signup' | 'recovery',
      });

      if (error || !data.session) {
        console.error('[auth/callback] verifyOtp error:', error);
        return NextResponse.redirect(
          buildLoginRedirect(url, error?.message ?? 'Authentication failed.'),
        );
      }

      sessionUserId = data.user?.id ?? null;
      sessionAccessToken = data.session?.access_token ?? null;
      sessionRefreshToken = data.session?.refresh_token ?? null;
    }
  } catch (error) {
    console.error('[auth/callback] Unexpected error during session establishment:', error);
    return NextResponse.redirect(buildLoginRedirect(url, 'Authentication failed.'));
  }

  if (!sessionUserId) {
    console.error('[auth/callback] Session established but user missing');
    return NextResponse.redirect(buildLoginRedirect(url, 'Authentication failed.'));
  }

  // Ensure logout marker is cleared once the user returns via magic link.
  cookiesToSet.push({
    name: 'br_logged_out',
    value: 'false',
    options: {
      path: '/',
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    },
  });

  if (sessionAccessToken && sessionRefreshToken) {
    cookiesToSet.push(
      {
        name: 'sb-access-token',
        value: sessionAccessToken,
        options: {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'lax',
          maxAge: 60 * 60,
          path: '/',
        },
      },
      {
        name: 'sb-refresh-token',
        value: sessionRefreshToken,
        options: {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30,
          path: '/',
        },
      },
    );
  } else {
    console.warn('[auth/callback] Session tokens missing after auth flow');
  }

  // Fetch minimal profile information to decide where to send the user next.
  let isProfileComplete = false;

  try {
    const { data: profile, error } = await supabase
      .from('users')
      .select('profile_completed, first_name, last_name')
      .eq('id', sessionUserId)
      .maybeSingle();

    if (error) {
      console.warn('[auth/callback] Profile lookup failed, defaulting redirect:', error);
    }

    if (profile) {
      isProfileComplete = Boolean(
        profile.profile_completed && profile.first_name && profile.last_name,
      );
    }
  } catch (error) {
    console.warn('[auth/callback] Unexpected error fetching profile:', error);
  }

  const safeNext = buildSafePath(url, rawNext);
  let redirectPath: string;

  if (invitationParam) {
    redirectPath = `/invite/${encodeURIComponent(invitationParam)}`;
  } else if (!isProfileComplete) {
    const profileUrl = new URL('/profile', url.origin);
    profileUrl.searchParams.set('welcome', 'true');
    if (onboarding) {
      profileUrl.searchParams.set('onboarding', onboarding);
    }
    if (bandId) {
      profileUrl.searchParams.set('bandId', bandId);
    }
    redirectPath = `${profileUrl.pathname}${profileUrl.search}`;
  } else if (safeNext) {
    redirectPath = safeNext;
  } else {
    redirectPath = FALLBACK_REDIRECT;
  }

  console.log('[auth/callback] Redirecting user', {
    userId: sessionUserId,
    redirectPath,
    profileComplete: isProfileComplete,
  });

  console.log(
    '[auth/callback] Cookies to set:',
    cookiesToSet.map(({ name, value, options }) => ({
      name,
      hasValue: value.length > 0,
      options,
    })),
  );

  const response = NextResponse.redirect(new URL(redirectPath, url.origin));

  for (const pending of cookiesToSet) {
    response.cookies.set(pending.name, pending.value, pending.options);
  }

  return response;
}
