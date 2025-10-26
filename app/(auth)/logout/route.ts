import { createClient } from '../../../lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = createClient();
  await supabase.auth.signOut();
  
  // Set br_logged_out cookie to show login page for this explicit logout
  // Cookie expires in 5 minutes or after next successful login
  const response = NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  response.cookies.set('br_logged_out', 'true', {
    maxAge: 300, // 5 minutes
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  
  return response;
}

export async function GET() {
  // Support GET for logout links
  return POST();
}