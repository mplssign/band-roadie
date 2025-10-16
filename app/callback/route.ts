import { NextResponse } from 'next/server';

/**
 * Fallback redirect for old magic link emails that point to /callback
 * Redirects to the correct /auth/callback route
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return NextResponse.redirect(new URL('/auth/callback', url), 308);
}

export const runtime = 'nodejs';
