import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const invitationId = requestUrl.searchParams.get("invitation");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const origin = requestUrl.origin;

  console.log("🔐 Auth callback:", { code: !!code, invitationId, next });

  if (code) {
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
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              // The `set` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: "", ...options });
            } catch (error) {
              // The `delete` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
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
      console.log("✅ User authenticated:", user.email);

      // If there's an invitation, redirect there
      if (invitationId) {
        return NextResponse.redirect(`${origin}/invite/${invitationId}`);
      }

      // Check if profile is complete
      const { data: profile } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();

      // New user or incomplete profile
      if (!profile || !profile.first_name || !profile.last_name) {
        console.log("👤 New user, redirecting to profile");
        return NextResponse.redirect(`${origin}/profile?welcome=true`);
      }

      // Existing user with complete profile
      console.log("🎉 Existing user, redirecting to:", next);
      const redirectUrl = next.startsWith('/') ? `${origin}${next}` : `${origin}/dashboard`;
      return NextResponse.redirect(redirectUrl);
    }
  }

  // If no code or user not found, redirect to login
  console.error("❌ No code or user not found");
  return NextResponse.redirect(`${origin}/login`);
}

export const runtime = 'nodejs';
