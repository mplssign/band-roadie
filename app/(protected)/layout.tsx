'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import TopNav from '@/components/navigation/TopNav';
import BottomNav from '@/components/navigation/BottomNav';
import { BandsProvider } from '@/contexts/BandsContext';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { AppLoadingBoundary } from '@/components/layout/AppLoadingBoundary';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkProfile = async () => {
      // Skip profile check if we're already on the profile page
      if (pathname === '/profile') {
        setIsLoading(false);
        return;
      }

      try {
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // Get user from our cookie-based auth
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Shouldn't happen since middleware approved, but handle it
          console.warn('Layout: Could not get user from /api/auth/me');
          setIsLoading(false);
          return;
        }

        const { profile } = await response.json();

        if (!mounted) return;

        // Check if profile is complete
        const isProfileComplete = profile?.first_name &&
          profile?.last_name &&
          profile?.phone &&
          profile?.address &&
          profile?.zip;

        if (!isProfileComplete) {
          router.push('/profile');
          return;
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Layout: Error checking profile:', error);
        if (mounted) {
          // On error, continue loading to prevent hang
          setIsLoading(false);
        }
      }
    };

    checkProfile();

    // Failsafe timeout to prevent infinite loading
    const failsafeTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('Layout: Failsafe timeout triggered');
        setIsLoading(false);
      }
    }, 8000);

    return () => {
      mounted = false;
      clearTimeout(failsafeTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount, pathname and router are captured in closure

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (pathname === '/profile') {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }

  return (
    <BandsProvider>
      <AppLoadingBoundary>
        <div className="fixed inset-0 flex flex-col bg-background text-foreground">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,113,133,0.18),_transparent_55%)] opacity-90"
          />
          <TopNav />
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide pt-16 pb-20">
            <div className="px-0 py-0">
              {children}
            </div>
          </div>
          <BottomNav />
          <InstallPrompt />
        </div>
      </AppLoadingBoundary>
    </BandsProvider>
  );
}
