import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const invitationId = requestUrl.searchParams.get("invitation");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const origin = requestUrl.origin;

  // Temporary debugging
  console.log("🔐 Callback hit:", {
    hasCode: !!code,
    invitationId,
    next,
    origin,
    fullUrl: req.url
  });

  if (code) {
    const cookieStore = await cookies();
    
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
      console.error("❌ Code exchange failed:", error.message);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }

    console.log("✅ Code exchange successful");

    // Get the user to check their profile status
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      console.log("✅ User found:", user.email, "ID:", user.id);
      
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
      
      console.log("🍪 Setting", cookiesToSet.length, "cookies on redirect to:", redirectUrl);
      
      // Apply all tracked cookies to the redirect response
      cookiesToSet.forEach(({ name, value, options }) => {
        redirectResponse.cookies.set(name, value, options);
        console.log("  - Cookie:", name, "=", value.substring(0, 20) + "...");
      });
      
      return redirectResponse;
    } else {
      console.error("❌ No user found after code exchange");
    }
  }

  // If no code or user not found, redirect to login
  console.error("❌ Redirecting to login - no code or authentication failed");
  return NextResponse.redirect(`${origin}/login`);
}

export const runtime = 'nodejs';
