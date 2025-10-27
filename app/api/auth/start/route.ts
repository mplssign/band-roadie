import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthCallbackUrl } from '@/lib/config/site';

/**
 * Start magic link authentication
 * 
 * This endpoint initiates the magic link flow.
 * Supabase handles PKCE internally, but we ensure the callback URL is correct
 * and context parameters are preserved.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, invitationId, bandId } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Create admin client for server-side auth
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Build redirect URL with context parameters
    const redirectUrl = new URL(getAuthCallbackUrl());
    if (invitationId) {
      redirectUrl.searchParams.set('invitationId', invitationId);
    }
    if (bandId) {
      redirectUrl.searchParams.set('bandId', bandId);
    }

    console.log('[auth/start] Initiating magic link:', {
      email: email.substring(0, 3) + '***',
      hasInvitation: !!invitationId,
      hasBandId: !!bandId,
      redirectUrl: redirectUrl.toString(),
    });

    // Send magic link - Supabase handles PKCE internally
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: redirectUrl.toString(),
        // Store invitation context in user metadata
        data: {
          invitation_id: invitationId,
          band_id: bandId,
        },
      },
    });

    if (error) {
      console.error('[auth/start] Supabase error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.log('[auth/start] Magic link sent successfully');

    return NextResponse.json({
      success: true,
      message: 'Check your email for the magic link',
    });

  } catch (error) {
    console.error('[auth/start] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
