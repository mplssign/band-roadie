// app/api/bands/create/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { sendBandInvites } from '@/lib/server/send-band-invites';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's name for email
    const { data: userData } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();

    const inviterName = userData?.first_name && userData?.last_name
      ? `${userData.first_name} ${userData.last_name}`
      : user.email || 'A band member';

    // Parse form data
    const formData = await request.formData();
    const bandName = formData.get('name') as string;
    const avatarColor = formData.get('avatarColor') as string;
    const inviteEmailsJson = formData.get('inviteEmails') as string;
    const imageFile = formData.get('image') as File | null;
    
    const inviteEmails = JSON.parse(inviteEmailsJson || '[]');

    // Upload image if provided
  let imageUrl: string | null = null;
    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('band-images')
        .upload(fileName, imageFile);
      
      if (!uploadError) {
        const { data } = supabase.storage
          .from('band-images')
          .getPublicUrl(fileName);
        imageUrl = data.publicUrl;
      }
    }

    // Create band
    const { data: band, error: bandError } = await supabase
      .from('bands')
      .insert({
        name: bandName,
        image_url: imageUrl,
        avatar_color: avatarColor,
        created_by: user.id
      })
      .select()
      .single();

    if (bandError) throw bandError;

    // Add creator as first member
    const { error: memberError } = await supabase
      .from('band_members')
      .insert({
        band_id: band.id,
        user_id: user.id,
        role: 'admin'
      });

    if (memberError) throw memberError;

    // Send invites if any
    if (inviteEmails.length > 0) {
      const { failedInvites } = await sendBandInvites({
        supabase,
        bandId: band.id,
        bandName,
        inviterId: user.id,
        inviterName,
        emails: inviteEmails,
      });

      if (failedInvites.length > 0) {
        const message = failedInvites
          .map(({ email, error }) => `${email}: ${error}`)
          .join('; ');
        throw new Error(`Failed to send invitations — ${message}`);
      }
    }

    return NextResponse.json({ success: true, band });
    
  } catch (error) {
    console.error('Error creating band:', error);
    return NextResponse.json(
      { error: 'Failed to create band' },
      { status: 500 }
    );
  }
}
