import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const invitationId = requestUrl.searchParams.get("invitation");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const origin = requestUrl.origin;

  if (code) {
    // Create response first so we can set cookies on it
    const response = NextResponse.next();
    const cookieStore = cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: "", ...options });
            response.cookies.set({ name, value: "", ...options });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("❌ Code exchange error:", error.message);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }

    // Get the user to check their profile status
    const { data: { user } } = await supabase.auth.getUser();
    
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

      // Create redirect response and copy all cookies to it
      const redirectResponse = NextResponse.redirect(redirectUrl);
      response.cookies.getAll().forEach(cookie => {
        redirectResponse.cookies.set(cookie);
      });
      
      return redirectResponse;
    }
  }

  // If no code or user not found, redirect to login
  console.error("❌ No code or user not found");
  return NextResponse.redirect(`${origin}/login`);
}

export const runtime = 'nodejs';
