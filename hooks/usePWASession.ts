'use client';

import { useEffect, useState } from 'react';

interface PWASession {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  profile_completed?: boolean;
}

const PWA_SESSION_KEY = 'band_roadie_pwa_session';
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * PWA-specific session management for better persistence
 */
export function usePWASession() {
  const [session, setSession] = useState<PWASession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initSession = () => {
      try {
        // Check if we're in PWA mode
        const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                     ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);

        if (!isPWA) {
          setIsLoading(false);
          return;
        }

        // Try to restore session from localStorage for PWA
        const storedSession = localStorage.getItem(PWA_SESSION_KEY);
        if (storedSession) {
          try {
            const parsed: PWASession = JSON.parse(storedSession);
            
            // Check if session is still valid
            if (parsed.expires_at > Date.now()) {
              setSession(parsed);
            } else {
              // Clean up expired session
              localStorage.removeItem(PWA_SESSION_KEY);
            }
          } catch (error) {
            // Invalid session data, clean up
            localStorage.removeItem(PWA_SESSION_KEY);
          }
        }
      } catch (error) {
        // LocalStorage not available or other error
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, []);

  const saveSession = (sessionData: Omit<PWASession, 'expires_at'>) => {
    try {
      const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                   ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);

      if (!isPWA) return;

      const pwaSession: PWASession = {
        ...sessionData,
        expires_at: Date.now() + SESSION_DURATION,
      };

      localStorage.setItem(PWA_SESSION_KEY, JSON.stringify(pwaSession));
      setSession(pwaSession);
    } catch (error) {
      // LocalStorage not available
    }
  };

  const clearSession = () => {
    try {
      localStorage.removeItem(PWA_SESSION_KEY);
      setSession(null);
    } catch (error) {
      // LocalStorage not available
    }
  };

  const isValidSession = (): boolean => {
    return session !== null && session.expires_at > Date.now();
  };

  return {
    session,
    isLoading,
    saveSession,
    clearSession,
    isValidSession,
  };
}

/**
 * PWA Session Provider Component
 */
export function PWASessionSync() {
  const { saveSession, clearSession } = usePWASession();

  useEffect(() => {
    // Listen for auth state changes and sync to PWA storage
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'supabase.auth.token') {
        try {
          const tokenData = event.newValue ? JSON.parse(event.newValue) : null;
          if (tokenData && tokenData.access_token) {
            // Save to PWA session
            saveSession({
              user_id: tokenData.user?.id || '',
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token || '',
              profile_completed: tokenData.user?.profile_completed,
            });
          } else {
            // Clear PWA session
            clearSession();
          }
        } catch (error) {
          // Invalid token data
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [saveSession, clearSession]);

  return null;
}