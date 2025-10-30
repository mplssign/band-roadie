import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';

// Shared logic for accepting invitations
async function acceptInvitation(invitationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Unauthorized');
  }

  // Get invitation details
  const { data: invitation, error: inviteError } = await supabase
    .from('band_invitations')
    .select('*, bands(name)')
    .eq('id', invitationId)
    .eq('email', user.email)
    .single();

  if (inviteError || !invitation) {
    throw new Error('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw new Error('Invitation already processed');
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from('band_members')
    .select('id')
    .eq('band_id', invitation.band_id)
    .eq('user_id', user.id)
    .single();

  if (existingMember) {
    // Update invitation status
    await supabase.from('band_invitations').update({ status: 'accepted' }).eq('id', invitationId);

    return {
      success: true,
      band_id: invitation.band_id,
      band_name: invitation.bands?.name,
      message: 'You are already a member of this band',
    };
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
      profile_completed: false,
    },
    {
      onConflict: 'id',
      ignoreDuplicates: false,
    },
  );

  if (upsertError) {
    console.error('Error upserting user:', upsertError);
    // Don't throw - continue with band membership
  }

  // Update user metadata to mark profile as completed for middleware
  const { error: metadataError } = await supabase.auth.updateUser({
    data: { profile_completed: true },
  });

  if (metadataError) {
    console.error('Error updating user metadata:', metadataError);
    // Don't throw - continue with band membership
  }

  // Add user to band
  const { error: memberError } = await supabase.from('band_members').insert({
    band_id: invitation.band_id,
    user_id: user.id,
    role: 'member',
  });

  if (memberError) throw memberError;

  // Update invitation status
  await supabase.from('band_invitations').update({ status: 'accepted' }).eq('id', invitationId);

  return {
    success: true,
    band_id: invitation.band_id,
    band_name: invitation.bands?.name,
  };
}

// GET handler for magic link redirects
export async function GET(request: Request, { params }: { params: { invitationId: string } }) {
  try {
    console.log('[invitation/accept] GET request for invitation:', params.invitationId);
    const result = await acceptInvitation(params.invitationId);
    console.log('[invitation/accept] Invitation accepted, redirecting to dashboard');
    redirect('/dashboard');
  } catch (err: unknown) {
    console.error('[invitation/accept] GET error:', err);
    const message =
      err && typeof err === 'object' && 'message' in err
        ? (err as { message?: unknown }).message
        : 'Failed to accept invitation';
    const messageStr = typeof message === 'string' ? message : 'Failed to accept invitation';

    // Redirect to login with error message if unauthorized
    if (messageStr === 'Unauthorized') {
      redirect('/login?error=Please log in to accept the invitation');
    }

    // Otherwise redirect to dashboard with error
    redirect(`/dashboard?error=${encodeURIComponent(messageStr)}`);
  }
}

export async function POST(request: Request, { params }: { params: { invitationId: string } }) {
  try {
    const result = await acceptInvitation(params.invitationId);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('[invitation/accept] POST error:', err);
    const message =
      err && typeof err === 'object' && 'message' in err
        ? (err as { message?: unknown }).message
        : 'Failed to accept invitation';
    const messageStr = typeof message === 'string' ? message : 'Failed to accept invitation';

    const status =
      messageStr === 'Unauthorized'
        ? 401
        : messageStr === 'Invitation not found'
          ? 404
          : messageStr === 'Invitation already processed'
            ? 400
            : 500;

    return NextResponse.json({ error: messageStr }, { status });
  }
}
