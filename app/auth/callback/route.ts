import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(req: Request) {
  // Log that callback route was hit
  console.error("🚨 AUTH CALLBACK HIT - URL:", req.url);
  
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const invitationId = searchParams.get("invitation");
  
  console.error("🚨 AUTH CALLBACK - Code present:", !!code, "Invitation ID:", invitationId);

  // Handle error cases first
  const error = searchParams.get("error");
  if (error) {
    const errorDescription = searchParams.get("error_description");
    if (error === "access_denied" && errorDescription?.includes("otp_expired")) {
      return NextResponse.redirect(
        new URL("/login?error=Email link has expired. Please request a new one.", origin)
      );
    }
    
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error)}`, origin)
    );
  }

  if (!code) {
    console.error("🚨 AUTH CALLBACK - No code provided, redirecting to login");
    return NextResponse.redirect(`${origin}/login?error=no_code_provided`);
  }

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
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );

  try {
    // Exchange the code for a session with timeout
    console.error("🚨 STARTING CODE EXCHANGE...");
    const exchangePromise = supabase.auth.exchangeCodeForSession(code);
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Code exchange timeout')), 5000)
    );
    
    const result = await Promise.race([exchangePromise, timeoutPromise]);
    console.error("🚨 CODE EXCHANGE COMPLETED");
    const { data: sessionData, error: exchangeError } = result;

    if (exchangeError) {
      console.error("Code exchange error:", exchangeError);
      
      // Handle specific PKCE errors
      if (exchangeError.message.includes("code verifier") || exchangeError.message.includes("Invalid PKCE")) {
        return NextResponse.redirect(
          new URL("/login?error=Authentication session expired. Please sign in again.", origin)
        );
      }
      
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, origin)
      );
    }

    // Check if we got a valid session
    if (!sessionData.session || !sessionData.user) {
      return NextResponse.redirect(
        new URL("/login?error=No session created", origin)
      );
    }

    console.error("🚨 SESSION CREATED SUCCESSFULLY");

    // Successful authentication - redirect appropriately
    if (invitationId) {
      return NextResponse.redirect(new URL(`/invite/${invitationId}`, origin));
    }

    // Check if user has completed their profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', sessionData.user.id)
      .single();

    // If profile doesn't exist or is incomplete, send to profile page
    if (profileError || !profile || !profile.first_name || !profile.last_name) {
      console.error("🚨 NEW USER - redirecting to profile");
      return NextResponse.redirect(new URL("/profile?welcome=true", origin));
    }

    // Existing user with complete profile - check for 'next' param or go to dashboard
    const next = searchParams.get('next');
    if (next && next.startsWith('/')) {
      console.error("🚨 EXISTING USER - redirecting to:", next);
      return NextResponse.redirect(new URL(next, origin));
    }

    console.error("🚨 EXISTING USER - redirecting to dashboard");
    return NextResponse.redirect(new URL("/dashboard", origin));
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error("🚨 SERVER AUTH CALLBACK ERROR:", errorMessage);
    
    if (errorMessage.includes('timeout')) {
      console.error("🚨 CODE EXCHANGE TIMED OUT - redirecting to login");
      return NextResponse.redirect(
        new URL("/login?error=Authentication timeout - please try again", origin)
      );
    }
    
    return NextResponse.redirect(
      new URL(`/login?error=Authentication processing failed: ${encodeURIComponent(errorMessage)}`, origin)
    );
  }
}