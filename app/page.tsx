import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

const DASHBOARD_ROUTE = '/dashboard';
const PROFILE_ROUTE = '/profile';
const VERIFY_CLIENT_ROUTE = '/auth/verify-client';
const LOGIN_ROUTE = '/login';

function decodeUserId(token: string): string | null {
  try {
    const [, payloadBase64] = token.split('.');
    if (!payloadBase64) return null;
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    return typeof payload?.sub === 'string' ? payload.sub : null;
  } catch (error) {
    return null;
  }
}

export default async function Home() {
  const cookieStore = await cookies();
  const loggedOut = cookieStore.get('br_logged_out')?.value === 'true';

  if (loggedOut) {
    redirect(LOGIN_ROUTE);
  }

  const accessToken = cookieStore.get('sb-access-token')?.value;

  if (!accessToken) {
    redirect(`${VERIFY_CLIENT_ROUTE}?next=${encodeURIComponent(DASHBOARD_ROUTE)}&source=landing`);
  }

  const userId = decodeUserId(accessToken);

  if (!userId) {
    redirect(`${VERIFY_CLIENT_ROUTE}?next=${encodeURIComponent(DASHBOARD_ROUTE)}&source=landing`);
  }

  try {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from('users')
      .select('profile_completed, first_name, last_name, phone, address, zip')
      .eq('id', userId)
      .maybeSingle();

    const isProfileComplete = Boolean(
      profile?.profile_completed &&
      profile?.first_name &&
      profile?.last_name &&
      profile?.phone &&
      profile?.address &&
      profile?.zip,
    );

    if (!isProfileComplete) {
      redirect(PROFILE_ROUTE);
    }
  } catch (error) {
    // For PWA launches, be more aggressive about fallback to prevent hangs
    const source = cookieStore.get('pwa_source')?.value;
    if (source === 'pwa') {
      // Fast fallback for PWA - try dashboard even if profile check fails
      redirect(DASHBOARD_ROUTE);
    }
    redirect(`${VERIFY_CLIENT_ROUTE}?next=${encodeURIComponent(DASHBOARD_ROUTE)}&source=landing`);
  }

  redirect(DASHBOARD_ROUTE);
}
