import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: { invitationId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get invitation details
    const { data: invitation, error: inviteError } = await supabase
      .from('band_invitations')
      .select('*, bands(name)')
      .eq('id', params.invitationId)
      .eq('email', user.email)
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation already processed' }, { status: 400 });
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
      await supabase
        .from('band_invitations')
        .update({ status: 'accepted' })
        .eq('id', params.invitationId);

      return NextResponse.json({ 
        success: true, 
        band_id: invitation.band_id,
        message: 'You are already a member of this band'
      });
    }

    // Ensure user record exists in database
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        first_name: user.user_metadata?.first_name || '',
        last_name: user.user_metadata?.last_name || '',
        phone: user.user_metadata?.phone || '',
        address: '',
        zip: '',
        profile_completed: false,
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (upsertError) {
      console.error('Error upserting user:', upsertError);
      // Don't throw - continue with band membership
    }

    // Update user metadata to mark profile as completed for middleware
    const { error: metadataError } = await supabase.auth.updateUser({
      data: { profile_completed: true }
    });

    if (metadataError) {
      console.error('Error updating user metadata:', metadataError);
      // Don't throw - continue with band membership
    }

    // Add user to band
    const { error: memberError } = await supabase
      .from('band_members')
      .insert({
        band_id: invitation.band_id,
        user_id: user.id,
        role: 'member',
      });

    if (memberError) throw memberError;

    // Update invitation status
    await supabase
      .from('band_invitations')
      .update({ status: 'accepted' })
      .eq('id', params.invitationId);

    return NextResponse.json({ 
      success: true, 
      band_id: invitation.band_id,
      band_name: invitation.bands?.name
    });

  } catch (err: unknown) {
    console.error('Accept invitation error:', err);
    const message = err && typeof err === 'object' && 'message' in err ? (err as { message?: unknown }).message : 'Failed to accept invitation';
    const messageStr = typeof message === 'string' ? message : 'Failed to accept invitation';
    return NextResponse.json(
      { error: messageStr },
      { status: 500 }
    );
  }
}
