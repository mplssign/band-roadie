'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import TopNav from '@/components/navigation/TopNav';
import BottomNav from '@/components/navigation/BottomNav';
import { BandsProvider } from '@/contexts/BandsContext';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { User } from '@supabase/supabase-js';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);
  
  // Wrapper to track when loading is set to false
  const setLoadingFalse = (_reason: string) => {
    setIsLoading(false);
  };
  const [, setUser] = useState<User | null>(null);
  const initializationStarted = useRef(false);

  useEffect(() => {


    
    const timeoutId = setTimeout(() => {
      console.warn('⏰ Layout initialization timed out, allowing access since middleware approved');
      setLoadingFalse('timeout but middleware approved');
    }, 5000);

    let mounted = true;

    const isProfileComplete = (profile: { 
      first_name?: string | null; 
      last_name?: string | null; 
      phone?: string | null; 
      address?: string | null; 
      zip?: string | null; 
    }) => {
      return profile.first_name && 
             profile.last_name && 
             profile.phone && 
             profile.address && 
             profile.zip;
    };

    const handleUserProfile = async (currentUser: User) => {
      if (!mounted) return;

      // If on profile page, just finish loading
      if (pathname === '/profile') {
        setLoadingFalse('on profile page');
        return;
      }

      try {
        // Check if user exists in database
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('first_name, last_name, phone, address, zip, profile_completed')
          .eq('id', currentUser.id)
          .single();

        if (!mounted) return;

        // If user doesn't exist in database, create profile and redirect to profile page
        if (profileError) {
          // Try to create a basic profile record
          try {
            await fetch('/api/users/create-profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
          } catch (error) {
            console.error('Failed to create profile:', error);
            // Continue anyway
          }
          
          router.push('/profile');
          return;
        }

        // If other error or incomplete profile, go to profile page
        if (profileError || !profile || !isProfileComplete(profile)) {
          router.push('/profile');
          return;
        }

        // Profile is complete, allow access
        setLoadingFalse('profile complete');
      } catch (error) {
        console.error('Error checking profile:', error);
        if (mounted) {
          // If database tables don't exist, treat as profile incomplete

          router.push('/profile');
        }
      }
    };

    const initializeAuth = async () => {
      try {
        // Since middleware already handles authentication, we just need to:
        // 1. Get the current user (should be available since middleware approved access)
        // 2. Handle profile completion checks
        
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (!mounted) return;

        // If we can't get user but middleware let us through, there might be an issue
        // but don't block access since middleware already authenticated
        if (error || !user) {
          console.warn('Layout: Could not get user, but middleware approved access');
          setLoadingFalse('middleware approved access');
          return;
        }

        setUser(user);

        // Only do profile checks for non-profile pages
        if (pathname !== '/profile') {
          await handleUserProfile(user);
        } else {
          setLoadingFalse('on profile page');
        }
      } catch (error) {
        console.warn('Layout: Auth error, but middleware approved access:', error);
        // Don't redirect - middleware already handled auth
        setLoadingFalse('middleware handled auth');
      }
    };

    // Set up auth state listener - simplified to avoid conflicts with middleware
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        clearTimeout(timeoutId);

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          // Let middleware handle routing, just update user state
          setLoadingFalse('user signed in');
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setLoadingFalse('user signed out');
          // Let middleware handle the redirect
          window.location.href = '/login';
        }
      }
    );

    // Initialize - prevent double initialization in React Strict Mode
    if (!initializationStarted.current) {
      initializationStarted.current = true;
      initializeAuth();
    }

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [pathname, router, supabase]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-muted-foreground">Authenticating...</div>
        </div>
      </div>
    );
  }

  if (pathname === '/profile') {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }

  return (
    <BandsProvider>
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
    </BandsProvider>
  );
}
