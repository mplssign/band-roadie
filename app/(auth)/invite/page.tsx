'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function InvitePageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'auth_required' | 'expired' | 'error'>('loading');
    const [message, setMessage] = useState('Processing your invitation...');
    const [bandName, setBandName] = useState<string>('');
    const [isPWA, setIsPWA] = useState(false);
    const [canInstall, setCanInstall] = useState(false);

    const token = searchParams.get('token');
    const email = searchParams.get('email');
    const expired = searchParams.get('expired');

    useEffect(() => {
        // Detect if running as PWA
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;
        setIsPWA(isStandalone);

        // Check if app can be installed
        window.addEventListener('beforeinstallprompt', () => {
            setCanInstall(true);
        });
    }, []);

    useEffect(() => {
        if (!token || !email) {
            setStatus('error');
            setMessage('Invalid invitation link. Please check the link and try again.');
            return;
        }

        if (expired === '1') {
            setStatus('expired');
            setMessage('This invitation has expired.');
            return;
        }

        processInvitation();
    }, [token, email, expired]);

    const processInvitation = async () => {
        if (!token || !email) return;

        console.log('[invite] Processing invitation', { token: token.substring(0, 8) + '...', email });

        try {
            // Call the accept API endpoint
            const response = await fetch(`/api/invites/accept?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`);
            const data = await response.json();

            if (data.bandName) {
                setBandName(data.bandName);
            }

            if (response.ok && data.success) {
                // Success - redirect to dashboard or profile
                console.log('[invite] Invitation accepted, redirecting to', data.redirectTo);
                setMessage(data.message || `Welcome to ${data.bandName}!`);

                // Small delay so user sees the success message
                setTimeout(() => {
                    window.location.href = data.redirectTo || '/dashboard';
                }, 1000);
            } else if (data.requiresAuth) {
                // User needs to authenticate via magic link
                console.log('[invite] Requires authentication, sending magic link');
                setStatus('auth_required');
                setMessage(`Join ${data.bandName || 'the band'} on Band Roadie`);
                await sendMagicLink(email, token);
            } else if (response.status === 410 || data.error?.includes('expired')) {
                // Invitation expired
                setStatus('expired');
                setMessage('This invitation has expired.');
            } else {
                // Other error
                setStatus('error');
                setMessage(data.error || 'Failed to process invitation');
                console.error('[invite] Error:', data);
            }
        } catch (error) {
            console.error('[invite] Exception:', error);
            setStatus('error');
            setMessage('An unexpected error occurred. Please try again.');
        }
    };

    const sendMagicLink = async (email: string, inviteToken: string) => {
        try {
            const supabase = createClient();

            // Generate magic link with invite context
            const redirectTo = `${window.location.origin}/auth/callback?inviteToken=${encodeURIComponent(inviteToken)}&email=${encodeURIComponent(email)}`;

            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: redirectTo,
                },
            });

            if (error) {
                console.error('[invite] Error sending magic link:', error);
                setStatus('error');
                setMessage('Failed to send authentication email. Please try again.');
            } else {
                setMessage('Check your email! We sent you a link to join the band.');
            }
        } catch (error) {
            console.error('[invite] Exception sending magic link:', error);
            setStatus('error');
            setMessage('Failed to send authentication email. Please try again.');
        }
    };

    const handleResendInvite = () => {
        // In a real app, you'd call an API to resend
        // For now, just show instructions
        setMessage('Please contact the band admin to resend the invitation.');
    };

    const handleInstallPWA = () => {
        // This would trigger the install prompt if available
        // The actual prompt is stored in the beforeinstallprompt event
        setMessage('Look for the "Install" option in your browser menu.');
    };

    const handleOpenInApp = () => {
        // Try to open in installed PWA
        if (isPWA) {
            // Already in PWA, just process
            processInvitation();
        } else {
            // Try to navigate to PWA scope
            window.location.href = `/invite?token=${token}&email=${email}`;
        }
    };

    // Show PWA handoff for non-PWA users
    const showPWAHandoff = !isPWA && status === 'auth_required';

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="max-w-md w-full space-y-6 text-center">
                {/* Logo */}
                <div className="flex justify-center">
                    <div className="text-4xl font-bold text-primary">
                        🎸 Band Roadie
                    </div>
                </div>

                {/* Status Card */}
                <div className="bg-card border rounded-lg p-8 space-y-4">
                    {status === 'loading' && (
                        <>
                            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                            <h2 className="text-xl font-semibold">{message}</h2>
                        </>
                    )}

                    {status === 'auth_required' && (
                        <>
                            <div className="text-5xl mb-4">📧</div>
                            {bandName && (
                                <h2 className="text-2xl font-bold text-primary">
                                    Join {bandName}
                                </h2>
                            )}
                            <p className="text-muted-foreground">{message}</p>

                            {showPWAHandoff && canInstall && (
                                <div className="mt-6 p-4 bg-muted rounded-lg space-y-3">
                                    <p className="text-sm font-medium">
                                        💡 For the best experience, install our app!
                                    </p>
                                    <Button onClick={handleInstallPWA} variant="outline" size="sm">
                                        Install Band Roadie
                                    </Button>
                                </div>
                            )}

                            {isPWA && (
                                <p className="text-sm text-green-600 dark:text-green-400">
                                    ✓ Running in app mode
                                </p>
                            )}
                        </>
                    )}

                    {status === 'expired' && (
                        <>
                            <div className="text-5xl mb-4">⏰</div>
                            <h2 className="text-xl font-semibold text-destructive">
                                Invitation Expired
                            </h2>
                            <p className="text-muted-foreground">{message}</p>
                            {bandName && (
                                <p className="text-sm">
                                    Band: <span className="font-medium">{bandName}</span>
                                </p>
                            )}
                            <Button onClick={handleResendInvite} variant="outline" className="mt-4">
                                Request New Invitation
                            </Button>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div className="text-5xl mb-4">⚠️</div>
                            <h2 className="text-xl font-semibold text-destructive">
                                Something Went Wrong
                            </h2>
                            <p className="text-muted-foreground">{message}</p>
                            <Button onClick={() => router.push('/login')} variant="outline" className="mt-4">
                                Go to Login
                            </Button>
                        </>
                    )}
                </div>

                {/* Footer */}
                <p className="text-xs text-muted-foreground">
                    Having trouble? Contact support or try logging in directly.
                </p>
            </div>
        </div>
    );
}

export default function InvitePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <div className="max-w-md w-full space-y-6 text-center">
                    <div className="flex justify-center">
                        <div className="text-4xl font-bold text-primary">
                            🎸 Band Roadie
                        </div>
                    </div>
                    <div className="bg-card border rounded-lg p-8 space-y-4">
                        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                        <h2 className="text-xl font-semibold">Loading invitation...</h2>
                    </div>
                </div>
            </div>
        }>
            <InvitePageContent />
        </Suspense>
    );
}
