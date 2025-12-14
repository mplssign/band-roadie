import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

/**
 * Verify page - server-side redirect after magic link authentication
 */
export default async function AuthVerifyPage() {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;

    if (!accessToken) {
        redirect('/login?error=No+session+found');
    }

    // Decode JWT to get user ID
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
    const userId = payload.sub;

    // Check if profile is complete
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data: profile } = await supabase
        .from('users')
        .select('profile_completed, first_name, last_name')
        .eq('id', userId)
        .single();

    // Route based on profile completion
    if (!profile?.profile_completed || !profile?.first_name || !profile?.last_name) {
        redirect('/profile');
    }

    redirect('/dashboard');
}
