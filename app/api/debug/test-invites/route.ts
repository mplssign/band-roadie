/* eslint-disable no-console */
import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY!,
};

function admin() {
  return createAdminClient(env.url, env.service, { auth: { persistSession: false } });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const bandId = url.searchParams.get('bandId') || '003be463-e63a-4ec5-b152-4f64c60afcbf';
    
    console.log('[test-invites] Testing invites table for band:', bandId);
    
    const a = admin();
    const result: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      bandId,
      tests: {},
    };

    // Test 1: Check if table exists by querying it
    console.log('[test-invites] Test 1: Basic table query');
    try {
      const { data: invites, error: invitesError } = await a
        .from('band_invitations')
        .select('id, email, status, created_at, expires_at')
        .eq('band_id', bandId)
        .eq('status', 'pending');

      result.tests = {
        ...result.tests as object,
        basicQuery: {
          status: invitesError ? 'error' : 'success',
          error: invitesError?.message || null,
          count: invites?.length || 0,
          data: invites?.slice(0, 3) || [], // First 3 records
        }
      };
      console.log('[test-invites] Basic query result:', result.tests);

    } catch (error) {
      result.tests = {
        ...result.tests as object,
        basicQuery: {
          status: 'exception',
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      };
      console.error('[test-invites] Basic query exception:', error);
    }

    // Test 2: Check all band invitations (not just pending)
    console.log('[test-invites] Test 2: All invitations query');
    try {
      const { data: allInvites, error: allInvitesError } = await a
        .from('band_invitations')
        .select('id, email, status, created_at, expires_at')
        .eq('band_id', bandId);

      result.tests = {
        ...result.tests as object,
        allInvitesQuery: {
          status: allInvitesError ? 'error' : 'success',
          error: allInvitesError?.message || null,
          count: allInvites?.length || 0,
          data: allInvites?.slice(0, 3) || [],
        }
      };
      console.log('[test-invites] All invites query result:', result.tests);

    } catch (error) {
      result.tests = {
        ...result.tests as object,
        allInvitesQuery: {
          status: 'exception',
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      };
      console.error('[test-invites] All invites query exception:', error);
    }

    // Test 3: Check table schema
    console.log('[test-invites] Test 3: Table schema check');
    try {
      const { data: schemaData, error: schemaError } = await a
        .from('band_invitations')
        .select('*')
        .limit(1);

      result.tests = {
        ...result.tests as object,
        schemaCheck: {
          status: schemaError ? 'error' : 'success',
          error: schemaError?.message || null,
          sampleRecord: schemaData?.[0] || null,
        }
      };
      console.log('[test-invites] Schema check result:', result.tests);

    } catch (error) {
      result.tests = {
        ...result.tests as object,
        schemaCheck: {
          status: 'exception',
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      };
      console.error('[test-invites] Schema check exception:', error);
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('[test-invites] Overall error:', error);
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}