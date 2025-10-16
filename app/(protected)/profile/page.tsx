import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ProfileForm from './ProfileForm';

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { invitation?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  // Get invitation details if present
  let invitation = null;
  if (searchParams.invitation) {
    const { data } = await supabase
      .from('band_invitations')
      .select('*, bands(*)')
      .eq('id', searchParams.invitation)
      .single();
    invitation = data;
  }

  return (
    <ProfileForm 
      user={profile} 
      invitationId={searchParams.invitation}
      invitation={invitation}
    />
  );
}
