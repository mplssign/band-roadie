// app/(auth)/callback/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

// This runs on the server and exchanges the `code` for a Supabase session
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    // No code? Bounce to login with an error.
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  }

  const supabase = createClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Couldn’t exchange the code for a session
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  // Success — redirect the user into your app (dashboard/home)
  return NextResponse.redirect(new URL('/dashboard', request.url));
}