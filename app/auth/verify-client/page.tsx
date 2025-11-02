'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { sanitizeAppPath, syncSessionToCookies } from '@/lib/auth/session';

const FALLBACK_DESTINATION = '/dashboard';
const LOGIN_DESTINATION = '/login?reauth=1';

type RestoreState = 'checking' | 'syncing' | 'redirecting' | 'failed';

async function resolveDestination(requestedDestination: string | null): Promise<string> {
    try {
        // eslint-disable-next-line no-console
        console.log('[verify-client] Checking /api/auth/me for profile completion');
        
        const response = await fetch('/api/auth/me', {
            credentials: 'include',
            cache: 'no-store',
        });

        // eslint-disable-next-line no-console
        console.log('[verify-client] /api/auth/me response:', response.status);

        if (!response.ok) {
            // eslint-disable-next-line no-console
            console.log('[verify-client] /api/auth/me failed, using fallback destination');
            return FALLBACK_DESTINATION;
        }

        const { profile } = await response.json();
        // eslint-disable-next-line no-console
        console.log('[verify-client] Profile data:', profile);

        const isProfileComplete = Boolean(
            profile?.first_name &&
            profile?.last_name &&
            profile?.phone &&
            profile?.address &&
            profile?.zip &&
            profile?.profile_completed,
        );

        if (!isProfileComplete) {
            return '/profile';
        }

        if (requestedDestination && requestedDestination !== '/login') {
            return requestedDestination;
        }

        return FALLBACK_DESTINATION;
    } catch (error) {
        if (requestedDestination && requestedDestination !== '/login') {
            return requestedDestination;
        }
        return FALLBACK_DESTINATION;
    }
}

function VerifyClientContent() {
    const router = useRouter();
    const params = useSearchParams();
    const [state, setState] = useState<RestoreState>('checking');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const requestedDestination = useMemo(() => {
        const nextParam = params?.get('next');
        return sanitizeAppPath(nextParam);
    }, [params]);

    useEffect(() => {
        let cancelled = false;
        const supabase = createClient();

        const bootstrap = async () => {
            try {
                setState('checking');
                // eslint-disable-next-line no-console
                console.log('[verify-client] Starting bootstrap process');
                
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                // eslint-disable-next-line no-console
                console.log('[verify-client] Session check result:', !!session);

                if (!session) {
                    throw new Error('no-session');
                }

                if (cancelled) return;

                setState('syncing');
                // eslint-disable-next-line no-console
                console.log('[verify-client] Syncing session to cookies');
                await syncSessionToCookies(session);

                if (cancelled) return;

                // eslint-disable-next-line no-console
                console.log('[verify-client] Resolving destination');
                const destination = await resolveDestination(requestedDestination);
                // eslint-disable-next-line no-console
                console.log('[verify-client] Destination resolved:', destination);

                if (cancelled) return;

                setState('redirecting');
                router.replace(destination);
            } catch (error) {
                if (cancelled) return;
                // eslint-disable-next-line no-console
                console.error('[verify-client] Bootstrap failed:', error);
                setState('failed');
                setErrorMessage(error instanceof Error ? error.message : 'unknown-error');
            }
        };

        // Shorter timeout for PWA to prevent hangs
        const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                     ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);
        const timeoutDuration = isPWA ? 5000 : 10000; // 5s for PWA, 10s for browser
        
        const timeoutId = setTimeout(() => {
            if (!cancelled) {
                // eslint-disable-next-line no-console
                console.error('[verify-client] Bootstrap timeout - redirecting to login');
                setState('failed');
                setErrorMessage('timeout');
            }
        }, timeoutDuration);

        bootstrap();

        const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
            if (cancelled) return;
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                syncSessionToCookies(session)
                    .then(async () => {
                        if (cancelled) return;
                        const destination = await resolveDestination(requestedDestination);
                        if (cancelled) return;
                        router.replace(destination || FALLBACK_DESTINATION);
                    })
                    .catch((error) => {
                        if (cancelled) return;
                        setState('failed');
                        setErrorMessage(error instanceof Error ? error.message : 'sync-failed');
                    });
            }
            if (event === 'SIGNED_OUT') {
                router.replace(LOGIN_DESTINATION);
            }
        });

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
            subscription.subscription.unsubscribe();
        };
    }, [requestedDestination, router]);

    useEffect(() => {
        if (state === 'failed') {
            const timer = window.setTimeout(() => {
                router.replace(LOGIN_DESTINATION);
            }, 1500);

            return () => window.clearTimeout(timer);
        }
        return undefined;
    }, [router, state]);

    const retry = useCallback(() => {
        router.replace(window.location.pathname + window.location.search);
    }, [router]);

    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
            <div className="max-w-md space-y-3">
                <h1 className="text-2xl font-semibold">Just a moment…</h1>
                {state === 'failed' ? (
                    <p className="text-muted-foreground">
                        We couldn&apos;t restore your session automatically. Redirecting to login.
                        <button type="button" className="ml-2 text-primary underline" onClick={retry}>
                            Try again
                        </button>
                    </p>
                ) : (
                    <p className="text-muted-foreground">
                        We&apos;re restoring your session so you can jump right back in.
                    </p>
                )}
                {errorMessage && (
                    <p className="text-xs text-muted-foreground/70">{errorMessage}</p>
                )}
            </div>
        </main>
    );
}

export default function VerifyClientPage() {
    return (
        <Suspense
            fallback={(
                <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
                    <div className="max-w-md space-y-3">
                        <h1 className="text-2xl font-semibold">Just a moment…</h1>
                        <p className="text-muted-foreground">We&apos;re restoring your session so you can jump right back in.</p>
                    </div>
                </main>
            )}
        >
            <VerifyClientContent />
        </Suspense>
    );
}
