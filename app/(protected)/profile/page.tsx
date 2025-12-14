import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import ProfileForm from './ProfileForm';

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { invitation?: string };
}) {
  // Get user ID from our custom cookie
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('sb-access-token')?.value;

  if (!accessToken) {
    redirect('/login');
  }

  // Decode JWT to get user ID
  const payload = JSON.parse(
    Buffer.from(accessToken.split('.')[1], 'base64').toString()
  );
  const userId = payload.sub;

  // Create admin client to query database
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

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  // If profile is already completed, redirect to dashboard
  if (profile?.profile_completed && profile?.first_name && profile?.last_name) {
    redirect('/dashboard');
  }

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
