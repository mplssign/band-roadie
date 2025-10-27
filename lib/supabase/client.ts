// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

/**
 * Custom storage adapter that uses cookies instead of sessionStorage
 * This enables PKCE flow to work across browser tabs for magic links
 */
const cookieStorage = {
  getItem: (key: string): string | null => {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === key) {
        return decodeURIComponent(value);
      }
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof document === 'undefined') return;
    // Store in cookie with 15 min expiration (matches PKCE flow)
    const maxAge = 900; // 15 minutes
    const secure = window.location.protocol === 'https:';
    document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure ? '; Secure' : ''}`;
  },
  removeItem: (key: string): void => {
    if (typeof document === 'undefined') return;
    document.cookie = `${key}=; path=/; max-age=0`;
  },
};

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Use PKCE flow - server callback will exchange code for session
        flowType: 'pkce',
        detectSessionInUrl: false, // Server handles the callback
        persistSession: true,
        autoRefreshToken: true,
        debug: process.env.NODE_ENV === 'development',
        // Use cookie storage instead of sessionStorage for tab-independent PKCE
        storage: cookieStorage,
        storageKey: 'sb-pkce',
      },
    },
  );
}

