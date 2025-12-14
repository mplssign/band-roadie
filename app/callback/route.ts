import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config/site';

/**
 * Fallback redirect for old magic link emails that point to /callback
 * Redirects to the correct /auth/callback route
 */
export async function GET() {
  return NextResponse.redirect(new URL('/auth/callback', getBaseUrl()), 308);
}

export const runtime = 'nodejs';
