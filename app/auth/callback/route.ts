import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const invitationId = requestUrl.searchParams.get("invitation");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const origin = requestUrl.origin;

  // eslint-disable-next-line no-console
  console.log('[Auth Callback] Request received:', {
    code: code ? 'present' : 'missing',
    invitationId,
    next,
    origin,
  });

  if (code) {
    const cookieStore = cookies();
    
    // Track cookies that need to be set on the response
    const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = [];
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            // Store cookies to be set on the response later
            cookiesToSet.push({ name, value, options });
          },
          remove(name: string, options: CookieOptions) {
            // Store cookie removal (empty value) to be set on the response
            cookiesToSet.push({ name, value: "", options });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[Auth Callback] Exchange code error:', error);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }

    // Get the user to check their profile status
    const { data: { user } } = await supabase.auth.getUser();
    
    // eslint-disable-next-line no-console
    console.log('[Auth Callback] User retrieved:', user ? `ID: ${user.id}` : 'null');
    
    if (user) {
      // Determine redirect URL
      let redirectUrl: string;
      
      if (invitationId) {
        redirectUrl = `${origin}/invite/${invitationId}`;
      } else {
        // Check if profile is complete
        const { data: profile } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();

        // New user or incomplete profile
        if (!profile || !profile.first_name || !profile.last_name) {
          redirectUrl = `${origin}/profile?welcome=true`;
        } else {
          // Existing user with complete profile
          redirectUrl = next.startsWith('/') ? `${origin}${next}` : `${origin}/dashboard`;
        }
      }

      // Create redirect response and set all cookies on it
      const redirectResponse = NextResponse.redirect(redirectUrl);
      
      // Apply all tracked cookies to the redirect response
      cookiesToSet.forEach(({ name, value, options }) => {
        redirectResponse.cookies.set(name, value, options);
      });
      
      // eslint-disable-next-line no-console
      console.log('[Auth Callback] Redirecting to:', redirectUrl, 'Cookies set:', cookiesToSet.length);
      
      return redirectResponse;
    }
  }

  // If no code or user not found, redirect to login
  return NextResponse.redirect(`${origin}/login`);
}

export const runtime = 'nodejs';
