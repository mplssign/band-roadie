// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

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
      },
    },
  );
}
