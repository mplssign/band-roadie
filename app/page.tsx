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
  try {
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

  // Fast path for PWA and returning users - skip profile check if recently verified
  const source = cookieStore.get('pwa_source')?.value;
  const profileVerified = cookieStore.get('profile_verified')?.value;
  const recentVerification = profileVerified && (Date.now() - parseInt(profileVerified) < 24 * 60 * 60 * 1000); // 24 hours

  if (source === 'pwa' || recentVerification) {
    redirect(DASHBOARD_ROUTE);
  }

  try {
    // Use a more efficient query with timeout
    const supabase = await createClient();
    const profileQuery = supabase
      .from('users')
      .select('profile_completed, first_name, last_name, phone, address, zip')
      .eq('id', userId)
      .maybeSingle();

    // Add a timeout to prevent hanging
    const profileResult = await Promise.race([
      profileQuery,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Profile query timeout')), 3000)
      )
    ]);

    const profile = profileResult.data;
    
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
    } else {
      // Cache successful profile verification using cookies API
      const cookieStore = await cookies();
      cookieStore.set('profile_verified', Date.now().toString(), {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 86400 // 24 hours
      });
      redirect(DASHBOARD_ROUTE);
    }
    } catch (error) {
      // Fast fallback for any errors to prevent hanging
      redirect(DASHBOARD_ROUTE);
    }

    redirect(DASHBOARD_ROUTE);
  } catch (error) {
    // Top-level catch for any critical errors
    console.error('Critical error in Home component:', error);
    redirect(DASHBOARD_ROUTE);
  }
}
