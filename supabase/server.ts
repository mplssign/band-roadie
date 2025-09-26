// lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: async (name: string) => {
          const cookie = cookieStore.get(name);
          return cookie?.value ?? undefined;
        },
        set: async (name: string, value: string, options?: CookieOptions) => {
          cookieStore.set(name, value, options);
        },
        remove: async (name: string, options?: CookieOptions) => {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}