import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

interface SessionPayload {
  access_token?: string;
  refresh_token?: string;
}

type PendingCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

function applyCookies(response: NextResponse, pending: PendingCookie[]) {
  for (const cookie of pending) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

export async function POST(request: Request) {
  let payload: SessionPayload;

  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { access_token, refresh_token } = payload;

  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: 'Missing session tokens' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const pendingCookies: PendingCookie[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
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

  try {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to establish session' }, { status: 500 });
  }

  pendingCookies.push({
    name: 'br_logged_out',
    value: 'false',
    options: {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      secure: process.env.NODE_ENV === 'production',
    },
  });

  const response = NextResponse.json({ success: true });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return applyCookies(response, pendingCookies);
}
