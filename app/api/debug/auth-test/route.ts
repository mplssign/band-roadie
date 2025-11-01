/* eslint-disable no-console */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
};

export async function GET() {
  try {
    console.log('[auth-test] Starting authentication test');
    
    // Get cookies
    const jar = await cookies();
    const allCookies = jar.getAll();
    
    console.log('[auth-test] Found cookies:', allCookies.map(c => c.name));
    
    // Create Supabase client
    const supa = createServerClient(env.url, env.anon, {
      cookies: {
        get(name) {
          const value = jar.get(name)?.value;
          console.log(`[auth-test] Cookie get: ${name} = ${value ? 'present' : 'missing'}`);
          return value;
        },
        set(name, value, options) {
          console.log(`[auth-test] Cookie set: ${name}`);
          jar.set({ name, value, ...options });
        },
        remove(name, options) {
          console.log(`[auth-test] Cookie remove: ${name}`);
          jar.delete({ name, ...options });
        },
      },
    });
    
    // Try getSession first
    console.log('[auth-test] Getting session...');
    const { data: sessionData, error: sessionError } = await supa.auth.getSession();
    
    console.log('[auth-test] Session result:', {
      hasSession: !!sessionData.session,
      userId: sessionData.session?.user?.id || 'none',
      email: sessionData.session?.user?.email || 'none',
      sessionError: sessionError?.message || 'none'
    });
    
    // Try getUser
    console.log('[auth-test] Getting user...');
    const { data: userData, error: userError } = await supa.auth.getUser();
    
    console.log('[auth-test] User result:', {
      hasUser: !!userData.user,
      userId: userData.user?.id || 'none',
      email: userData.user?.email || 'none',
      userError: userError?.message || 'none'
    });
    
    return NextResponse.json({
      cookies: allCookies.map(c => ({ name: c.name, hasValue: !!c.value })),
      session: {
        exists: !!sessionData.session,
        userId: sessionData.session?.user?.id || null,
        email: sessionData.session?.user?.email || null,
        error: sessionError?.message || null
      },
      user: {
        exists: !!userData.user,
        userId: userData.user?.id || null,
        email: userData.user?.email || null,
        error: userError?.message || null
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[auth-test] Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}