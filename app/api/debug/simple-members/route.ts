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
    console.error('[simple-members] Error in getUser:', error);
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const bandId = url.searchParams.get('bandId');
    
    console.log('[simple-members] Starting simple members API for band:', bandId);
    
    if (!bandId) {
      return NextResponse.json({ error: 'bandId required' }, { status: 400 });
    }

    // Step 1: Get authenticated user
    console.log('[simple-members] Step 1: Getting user');
    const user = await getUser();
    
    if (!user) {
      console.log('[simple-members] No user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[simple-members] User found:', user.id);

    // Step 2: Get admin client
    console.log('[simple-members] Step 2: Creating admin client');
    const a = admin();

    // Step 3: Check if user is member of band
    console.log('[simple-members] Step 3: Checking membership');
    const { data: membership, error: membershipError } = await a
      .from('band_members')
      .select('role')
      .eq('band_id', bandId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError) {
      console.error('[simple-members] Membership check error:', membershipError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!membership) {
      console.log('[simple-members] User is not a member');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('[simple-members] User is a member with role:', membership.role);

    // Step 4: Get all band members
    console.log('[simple-members] Step 4: Getting band members');
    const { data: bandMembers, error: membersError } = await a
      .from('band_members')
      .select('id, user_id, role, joined_at')
      .eq('band_id', bandId);

    if (membersError) {
      console.error('[simple-members] Members query error:', membersError);
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    console.log('[simple-members] Found band members:', bandMembers?.length || 0);

    // Step 5: Get user profiles (simplified - just basic info)
    const userIds = bandMembers?.map((m) => m.user_id) || [];
    console.log('[simple-members] Step 5: Getting user profiles for:', userIds.length, 'users');
    
    const { data: users, error: usersError } = await a
      .from('users')
      .select('id, email, first_name, last_name')
      .in('id', userIds);

    if (usersError) {
      console.error('[simple-members] Users query error:', usersError);
      return NextResponse.json({ error: 'Failed to fetch user profiles' }, { status: 500 });
    }

    console.log('[simple-members] Found user profiles:', users?.length || 0);

    // Step 6: Combine data
    const members = bandMembers?.map((member) => ({
      ...member,
      user: users?.find((u) => u.id === member.user_id) || null,
    })) || [];

    console.log('[simple-members] Success! Returning', members.length, 'members');

    return NextResponse.json({
      members,
      invites: [], // Simplified - no invites for now
      debug: {
        bandId,
        userId: user.id,
        memberCount: members.length,
        timestamp: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('[simple-members] Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}