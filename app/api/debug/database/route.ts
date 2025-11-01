import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Test 1: Basic admin client connection
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Test 2: Check if we can read users table
    const { data: usersTest, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    // Test 3: Check if we can read band_members table
    const { data: membersTest, error: membersError } = await supabase
      .from('band_members')
      .select('id')
      .limit(1);

    // Test 4: Check if we can read bands table
    const { data: bandsTest, error: bandsError } = await supabase
      .from('bands')
      .select('id')
      .limit(1);

    // Test 5: Check current user authentication
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;
    
    let currentUserId = null;
    if (accessToken) {
      try {
        const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
        currentUserId = payload.sub;
      } catch (e) {
        // Invalid token
      }
    }

    // Test 6: If we have a user, check their band memberships
    let userMemberships: { band_id: string; role: string }[] | null = null;
    let membershipError: { message: string } | null = null;
    if (currentUserId) {
      const { data, error } = await supabase
        .from('band_members')
        .select('band_id, role')
        .eq('user_id', currentUserId);
      userMemberships = data;
      membershipError = error;
    }

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      tests: {
        usersTable: {
          success: !usersError,
          error: usersError?.message,
          count: usersTest?.length || 0
        },
        membersTable: {
          success: !membersError,
          error: membersError?.message,
          count: membersTest?.length || 0
        },
        bandsTable: {
          success: !bandsError,
          error: bandsError?.message,
          count: bandsTest?.length || 0
        },
        authentication: {
          hasAccessToken: !!accessToken,
          currentUserId,
          userMemberships: {
            success: !membershipError,
            error: membershipError?.message,
            count: userMemberships?.length || 0,
            data: userMemberships
          }
        }
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}