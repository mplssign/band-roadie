/**
 * BandBoundary component
 * 
 * Wraps protected pages to ensure:
 * 1. User is authenticated
 * 2. Band context is loaded
 * 3. Current band is selected
 * 4. Prevents rendering until band data is ready
 * 
 * Use this to wrap any page that requires band-scoped data.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBands } from '@/contexts/BandsContext';
import { createClient } from '@/lib/supabase/client';

interface BandBoundaryProps {
    children: React.ReactNode;
    /**
     * Custom loading component
     */
    loadingComponent?: React.ReactNode;
    /**
     * Whether to require a band to be selected
     * If true, shows "no bands" message when user has no bands
     * If false, allows rendering even without bands (e.g., for band creation page)
     */
    requireBand?: boolean;
    /**
     * Custom "no bands" component
     */
    noBandsComponent?: React.ReactNode;
}

const DefaultLoader = () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading band data...</p>
        </div>
    </div>
);

const DefaultNoBands = () => (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold mb-4">Welcome to Band Roadie!</h2>
            <p className="text-muted-foreground mb-8">
                You&apos;re officially backstage — but your band&apos;s not here yet. Fire up a new band or text your drummer (they&apos;re late as usual) to add you. Let&apos;s make some noise.
            </p>
            <a
                href="/bands/onboarding"
                className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
                Create Your Band
            </a>
        </div>
    </div>
);

export function BandBoundary({
    children,
    loadingComponent,
    noBandsComponent,
    requireBand = true,
}: BandBoundaryProps) {
    const router = useRouter();
    const supabase = createClient();
    const { bands, currentBand, loading: bandsLoading } = useBands();
    const [user, setUser] = useState<unknown | null>(null);
    const [authChecked, setAuthChecked] = useState(false);

    // Check authentication
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
            } else {
                setUser(user);
                setAuthChecked(true);
            }
        };

        checkAuth();
    }, [router, supabase]);

    // Show loading state while checking auth or loading bands
    if (!authChecked || bandsLoading) {
        return loadingComponent || <DefaultLoader />;
    }

    // Show "no bands" state if required
    if (requireBand && bands.length === 0) {
        return noBandsComponent || <DefaultNoBands />;
    }

    // Show loading state if bands exist but none is selected
    if (requireBand && bands.length > 0 && !currentBand) {
        return loadingComponent || <DefaultLoader />;
    }

    // All checks passed, render children
    return <>{children}</>;
}
