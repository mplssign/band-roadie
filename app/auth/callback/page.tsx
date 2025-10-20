'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Client-side auth callback handler
 * 
 * This must be client-side because PKCE flow stores the code_verifier in localStorage,
 * which is only accessible from the browser (not server-side).
 */
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const invitationId = searchParams.get('invitation');
      const next = searchParams.get('next') ?? '/dashboard';

      if (!code) {
        console.error('[Auth Callback] No code provided');
        router.push('/login?error=' + encodeURIComponent('No authentication code provided'));
        return;
      }

      try {
        const supabase = createClient();

        // Exchange code for session (will automatically retrieve code_verifier from localStorage)
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          console.error('[Auth Callback] Exchange error:', exchangeError);
          setError(exchangeError.message);
          router.push('/login?error=' + encodeURIComponent(exchangeError.message));
          return;
        }

        // Get user data to check profile completion
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          console.error('[Auth Callback] No user after exchange');
          router.push('/login?error=' + encodeURIComponent('Authentication failed'));
          return;
        }

        // Check if user has completed profile
        const { data: profile } = await supabase
          .from('users')
          .select('name')
          .eq('id', user.id)
          .single();

        // Determine redirect based on profile state
        let redirectPath: string;
        if (!profile?.name) {
          // New user - redirect to profile completion
          redirectPath = '/profile?welcome=true';
        } else if (invitationId) {
          // User accepted an invitation - redirect to accept endpoint
          redirectPath = `/api/invitations/${invitationId}/accept`;
        } else if (next && next !== '/') {
          redirectPath = next;
        } else {
          redirectPath = '/dashboard';
        }

        // Success - redirect to appropriate page
        router.push(redirectPath);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Auth Callback] Unexpected error:', err);
        setError(message);
        router.push('/login?error=' + encodeURIComponent(message));
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-black px-4">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-rose-400 mb-4">Authentication failed</p>
            <p className="text-sm text-zinc-500">{error}</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600 mx-auto mb-4"></div>
            <p className="text-zinc-400">Completing sign in...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh flex items-center justify-center bg-black px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600 mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
