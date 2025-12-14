import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

/**
 * Accept band invitation via token
 *
 * Query params:
 *   - token: Secure invite token
 *   - email: Email address being invited
 *
 * Returns:
 *   - redirectTo: Where to send the user (/profile?onboarding=1 or /dashboard)
 *   - requiresAuth: Whether user needs to authenticate first
 *   - bandName: Name of the band they're joining
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  console.log('[invite/accept] GET request', { token: token?.substring(0, 8) + '...', email });

  // Validate required params
  if (!token || !email) {
    console.error('[invite/accept] Missing required params');
    return NextResponse.json(
      { error: 'Missing token or email', redirectTo: '/login?error=Invalid invitation link' },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const normalizedEmail = email.trim().toLowerCase();

  // Check if user is authenticated
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Verify invitation exists and is valid
  const { data: invitation, error: inviteError } = await supabase
    .from('band_invitations')
    .select('*, bands(name)')
    .eq('token', token)
    .eq('email', normalizedEmail)
    .single();

  if (inviteError || !invitation) {
    console.error('[invite/accept] Invitation not found', inviteError);
    return NextResponse.json(
      {
        error: 'Invitation not found or invalid',
        redirectTo: '/login?error=Invalid or expired invitation',
      },
      { status: 404 },
    );
  }

  // Check if invitation is expired
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    console.log('[invite/accept] Invitation expired');
    return NextResponse.json(
      {
        error: 'Invitation has expired',
        redirectTo: `/invite?token=${token}&email=${email}&expired=1`,
        bandName: invitation.bands?.name,
      },
      { status: 410 },
    );
  }

  // Check if invitation is already accepted
  if (invitation.status === 'accepted') {
    console.log('[invite/accept] Invitation already accepted');
    return NextResponse.json({
      success: true,
      message: 'Invitation already accepted',
      redirectTo: user ? '/dashboard' : '/login?error=Please log in to access your bands',
      bandName: invitation.bands?.name,
      bandId: invitation.band_id,
    });
  }

  // If user is not authenticated, return magic link info
  if (!user || userError) {
    console.log('[invite/accept] User not authenticated, returning requiresAuth');
    return NextResponse.json({
      requiresAuth: true,
      email: normalizedEmail,
      bandName: invitation.bands?.name,
      bandId: invitation.band_id,
      invitationId: invitation.id,
      redirectTo: `/invite?token=${token}&email=${email}`,
    });
  }

  // Verify the authenticated user matches the invitation email
  if (user.email?.toLowerCase() !== normalizedEmail) {
    console.error('[invite/accept] Email mismatch', {
      userEmail: user.email,
      inviteEmail: normalizedEmail,
    });
    return NextResponse.json(
      {
        error: 'This invitation is for a different email address',
        redirectTo: '/dashboard?error=Invitation email mismatch',
      },
      { status: 403 },
    );
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from('band_members')
    .select('id')
    .eq('band_id', invitation.band_id)
    .eq('user_id', user.id)
    .single();

  if (existingMember) {
    console.log('[invite/accept] User already a member');
    // Mark invitation as accepted
    await supabase.from('band_invitations').update({ status: 'accepted' }).eq('id', invitation.id);

    return NextResponse.json({
      success: true,
      message: 'You are already a member of this band',
      bandId: invitation.band_id,
      bandName: invitation.bands?.name,
      redirectTo: '/dashboard',
    });
  }

  // Ensure user record exists in database
  const { error: upsertError } = await supabase.from('users').upsert(
    {
      id: user.id,
      email: user.email,
      first_name: user.user_metadata?.first_name || '',
      last_name: user.user_metadata?.last_name || '',
      phone: user.user_metadata?.phone || '',
      address: '',
      zip: '',
      profile_completed: user.user_metadata?.profile_completed || false,
    },
    {
      onConflict: 'id',
      ignoreDuplicates: false,
    },
  );

  if (upsertError) {
    console.error('[invite/accept] Error upserting user:', upsertError);
  }

  // Add user to band
  const { error: memberError } = await supabase.from('band_members').insert({
    band_id: invitation.band_id,
    user_id: user.id,
    role: 'member',
  });

  if (memberError) {
    console.error('[invite/accept] Error adding band member:', memberError);
    return NextResponse.json(
      {
        error: 'Failed to add you to the band',
        redirectTo: '/dashboard?error=Failed to join band',
      },
      { status: 500 },
    );
  }

  // Update invitation status
  await supabase.from('band_invitations').update({ status: 'accepted' }).eq('id', invitation.id);

  console.log('[invite/accept] Successfully added user to band', { bandId: invitation.band_id });

  // Check if profile is completed
  const { data: userProfile } = await supabase
    .from('users')
    .select('profile_completed')
    .eq('id', user.id)
    .single();

  const profileCompleted =
    userProfile?.profile_completed || user.user_metadata?.profile_completed || false;

  // Determine redirect based on profile completion
  const redirectTo = profileCompleted ? '/dashboard' : '/profile?onboarding=1';

  return NextResponse.json({
    success: true,
    bandId: invitation.band_id,
    bandName: invitation.bands?.name,
    redirectTo,
    message: `Welcome to ${invitation.bands?.name}!`,
  });
}
