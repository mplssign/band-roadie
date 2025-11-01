/* eslint-disable no-console */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY!,
};

function admin() {
  return createAdminClient(env.url, env.service, { auth: { persistSession: false } });
}

async function getUser() {
  try {
    const jar = await cookies();
    const supa = createServerClient(env.url, env.anon, {
      cookies: {
        get(name) {
          return jar.get(name)?.value;
        },
        set(name, value, options) {
          jar.set({ name, value, ...options });
        },
        remove(name, options) {
          jar.delete({ name, ...options });
        },
      },
    });
    const {
      data: { user },
    } = await supa.auth.getUser();
    return user ?? null;
  } catch (error) {
    console.error('[production-debug] Error in getUser:', error);
    return null;
  }
}

export async function GET() {
  try {
    console.log('[production-debug] Starting production Members API debug');
    
    const user = await getUser();
    
    if (!user) {
      console.log('[production-debug] No user found - unauthorized');
      return NextResponse.json({ 
        error: 'Unauthorized',
        step: 'authentication',
        timestamp: new Date().toISOString(),
      }, { status: 401 });
    }

    console.log('[production-debug] User authenticated:', user.id, user.email);

    const a = admin();
    const secondSummerBandId = '6d71a662-f1a4-4fb9-a611-9b2c8e7716d3';

    // Step 1: Check if user is member of The Second Summer
    console.log('[production-debug] Checking membership for The Second Summer');
    const { data: membership, error: membershipError } = await a
      .from('band_members')
      .select('id, role, joined_at')
      .eq('band_id', secondSummerBandId)
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('[production-debug] Membership check result:', { 
      membership: membership ? 'found' : 'not found', 
      error: membershipError?.message || 'none',
      role: membership?.role || 'none'
    });

    if (membershipError) {
      return NextResponse.json({
        error: 'Database error checking membership',
        details: membershipError.message,
        step: 'membership_check',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    if (!membership) {
      return NextResponse.json({
        error: 'User is not a member of The Second Summer band',
        step: 'membership_validation',
        userId: user.id,
        bandId: secondSummerBandId,
        timestamp: new Date().toISOString(),
      }, { status: 403 });
    }

    // Step 2: Try to fetch band members
    console.log('[production-debug] Fetching band members for The Second Summer');
    const { data: bandMembers, error: membersError } = await a
      .from('band_members')
      .select(`
        id,
        user_id,
        role,
        joined_at
      `)
      .eq('band_id', secondSummerBandId);

    console.log('[production-debug] Band members query result:', { 
      count: bandMembers?.length || 0, 
      error: membersError?.message || 'none' 
    });

    if (membersError) {
      return NextResponse.json({
        error: 'Failed to fetch band members',
        details: membersError.message,
        step: 'fetch_members',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    // Step 3: Try to fetch user profiles
    const userIds = bandMembers?.map((m) => m.user_id) || [];
    console.log('[production-debug] Fetching user profiles for IDs:', userIds.length);
    
    const { data: users, error: usersError } = await a
      .from('users')
      .select('id, email, first_name, last_name, phone, address, city, zip, birthday, roles, profile_completed')
      .in('id', userIds);

    console.log('[production-debug] User profiles query result:', { 
      count: users?.length || 0, 
      error: usersError?.message || 'none' 
    });

    if (usersError) {
      return NextResponse.json({
        error: 'Failed to fetch user profiles',
        details: usersError.message,
        step: 'fetch_users',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    // Step 4: Try to fetch pending invites
    console.log('[production-debug] Fetching pending invites');
    const { data: invites, error: invitesError } = await a
      .from('invitations')
      .select('id, email, status, created_at')
      .eq('band_id', secondSummerBandId)
      .eq('status', 'pending');

    console.log('[production-debug] Invites query result:', { 
      count: invites?.length || 0, 
      error: invitesError?.message || 'none' 
    });

    // Return success with debug info
    return NextResponse.json({
      success: true,
      debug: {
        userId: user.id,
        userEmail: user.email,
        bandId: secondSummerBandId,
        membership: membership,
        membersCount: bandMembers?.length || 0,
        usersCount: users?.length || 0,
        invitesCount: invites?.length || 0,
        invitesError: invitesError?.message || null,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[production-debug] Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      step: 'unexpected_error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}