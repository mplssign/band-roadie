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
    console.error('[debug/members] Error in getUser:', error);
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bandId = url.searchParams.get('bandId');
  
  // eslint-disable-next-line no-console
  console.log('[debug/members] Starting debug for band:', bandId);
  
  const result: {
    timestamp: string;
    bandId: string | null;
    steps: Record<string, unknown>;
    errors: string[];
    summary?: Record<string, unknown>;
  } = {
    timestamp: new Date().toISOString(),
    bandId,
    steps: {},
    errors: [],
  };

  try {
    // Step 1: Test authentication
    console.log('[debug/members] Step 1: Testing authentication');
    result.steps.authentication = { status: 'starting' };
    
    const user = await getUser();
    result.steps.authentication = {
      status: user ? 'success' : 'failed',
      userId: user?.id || null,
      email: user?.email || null,
    };
    console.log('[debug/members] Auth result:', result.steps.authentication);

    if (!user) {
      result.errors.push('No authenticated user found');
      return NextResponse.json(result, { status: 401 });
    }

    // Step 2: Test admin client
    console.log('[debug/members] Step 2: Testing admin client');
    result.steps.adminClient = { status: 'starting' };
    
    const a = admin();
    result.steps.adminClient = { status: 'success' };
    console.log('[debug/members] Admin client created successfully');

    if (!bandId) {
      result.errors.push('No bandId provided');
      return NextResponse.json(result, { status: 400 });
    }

    // Step 3: Test band membership check
    console.log('[debug/members] Step 3: Testing band membership');
    result.steps.membershipCheck = { status: 'starting' };
    
    const { data: memberData, error: memberError } = await a
      .from('band_members')
      .select('role')
      .eq('band_id', bandId)
      .eq('user_id', user.id)
      .maybeSingle();
      
    result.steps.membershipCheck = {
      status: memberError ? 'error' : 'success',
      data: memberData,
      error: memberError?.message || null,
      isMember: !!memberData,
    };
    console.log('[debug/members] Membership check result:', result.steps.membershipCheck);

    if (memberError) {
      result.errors.push(`Membership check error: ${memberError.message}`);
    }

    if (!memberData) {
      result.errors.push('User is not a member of this band');
      return NextResponse.json(result, { status: 403 });
    }

    // Step 4: Test band members query
    console.log('[debug/members] Step 4: Testing band members query');
    result.steps.bandMembersQuery = { status: 'starting' };
    
    const { data: bandMembers, error: membersError } = await a
      .from('band_members')
      .select('id, user_id, role, joined_at')
      .eq('band_id', bandId);

    result.steps.bandMembersQuery = {
      status: membersError ? 'error' : 'success',
      count: bandMembers?.length || 0,
      data: bandMembers?.slice(0, 3) || [], // Show first 3 for debugging
      error: membersError?.message || null,
    };
    console.log('[debug/members] Band members query result:', result.steps.bandMembersQuery);

    if (membersError) {
      result.errors.push(`Band members query error: ${membersError.message}`);
      return NextResponse.json(result, { status: 500 });
    }

    // Step 5: Test users query
    console.log('[debug/members] Step 5: Testing users query');
    result.steps.usersQuery = { status: 'starting' };
    
    const userIds = bandMembers?.map((m) => m.user_id) || [];
    
    const { data: users, error: usersError } = await a
      .from('users')
      .select('id, email, first_name, last_name, phone, address, city, zip, birthday, roles, profile_completed')
      .in('id', userIds);

    result.steps.usersQuery = {
      status: usersError ? 'error' : 'success',
      userIds,
      count: users?.length || 0,
      data: users?.slice(0, 3) || [], // Show first 3 for debugging
      error: usersError?.message || null,
    };
    console.log('[debug/members] Users query result:', result.steps.usersQuery);

    if (usersError) {
      result.errors.push(`Users query error: ${usersError.message}`);
      return NextResponse.json(result, { status: 500 });
    }

    // Step 6: Test invites query
    console.log('[debug/members] Step 6: Testing invites query');
    result.steps.invitesQuery = { status: 'starting' };
    
    const { data: invites, error: invitesError } = await a
      .from('band_invitations')
      .select('id, email, status, created_at, expires_at')
      .eq('band_id', bandId)
      .eq('status', 'pending');

    result.steps.invitesQuery = {
      status: invitesError ? 'error' : 'success',
      count: invites?.length || 0,
      data: invites || [],
      error: invitesError?.message || null,
    };
    console.log('[debug/members] Invites query result:', result.steps.invitesQuery);

    if (invitesError) {
      result.errors.push(`Invites query error: ${invitesError.message}`);
    }

    result.summary = {
      allStepsCompleted: true,
      errorCount: result.errors.length,
      status: result.errors.length > 0 ? 'completed_with_errors' : 'success',
    };

    console.log('[debug/members] Debug complete:', result.summary);
    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('[debug/members] Unexpected error:', error);
    result.errors.push(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.summary = {
      allStepsCompleted: false,
      errorCount: result.errors.length,
      status: 'fatal_error',
      fatalError: error instanceof Error ? error.message : 'Unknown error',
    };
    
    return NextResponse.json(result, { status: 500 });
  }
}