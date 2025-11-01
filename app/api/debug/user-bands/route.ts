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
    console.error('[user-bands] Error in getUser:', error);
    return null;
  }
}

export async function GET() {
  try {
    console.log('[user-bands] Starting user bands check');
    
    // Step 1: Get authenticated user
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[user-bands] User found:', user.id, user.email);

    const a = admin();

    // Step 2: Get all bands the user is a member of
    console.log('[user-bands] Getting user\'s band memberships');
    const { data: memberships, error: membershipsError } = await a
      .from('band_members')
      .select(`
        id,
        band_id,
        role,
        joined_at,

        bands:band_id (
          id,
          name,
          created_by,
          created_at
        )
      `)
      .eq('user_id', user.id)
;

    if (membershipsError) {
      console.error('[user-bands] Error fetching memberships:', membershipsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    console.log('[user-bands] Found memberships:', memberships?.length || 0);

    // Step 3: Get all bands (for comparison)
    const { data: allBands, error: bandsError } = await a
      .from('bands')
      .select('id, name, created_by, created_at')
      .order('created_at', { ascending: false });

    if (bandsError) {
      console.error('[user-bands] Error fetching all bands:', bandsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    console.log('[user-bands] Total bands in system:', allBands?.length || 0);

    const result = {
      userId: user.id,
      userEmail: user.email,
      userMemberships: memberships || [],
      allBands: allBands || [],
      membershipCount: memberships?.length || 0,
      totalBands: allBands?.length || 0,
      specificBandChecks: {
        toxicCrayon: {
          bandId: '003be463-e63a-4ec5-b152-4f64c60afcbf',
          isMember: memberships?.some(m => m.band_id === '003be463-e63a-4ec5-b152-4f64c60afcbf') || false,
        },
        theSecondSummer: {
          bandId: '6d71a662-f1a4-4fb9-a611-9b2c8e7716d3',
          isMember: memberships?.some(m => m.band_id === '6d71a662-f1a4-4fb9-a611-9b2c8e7716d3') || false,
        }
      },
      timestamp: new Date().toISOString(),
    };

    console.log('[user-bands] Result summary:', {
      userId: result.userId,
      membershipCount: result.membershipCount,
      isMemberOfToxicCrayon: result.specificBandChecks.toxicCrayon.isMember,
      isMemberOfTheSecondSummer: result.specificBandChecks.theSecondSummer.isMember,
    });

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('[user-bands] Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}