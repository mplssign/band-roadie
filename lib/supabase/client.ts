// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Use PKCE flow for better security
        flowType: 'pkce',
        // Automatically detect redirect URLs from browser context
        detectSessionInUrl: true,
        // Persist session in localStorage (default, but explicit for clarity)
        persistSession: true,
        // Store code_verifier in localStorage for magic links
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    },
  );
}
