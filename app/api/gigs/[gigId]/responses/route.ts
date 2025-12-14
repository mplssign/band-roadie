import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { broadcastGigResponse } from '@/lib/utils/realtime-broadcast';

export async function POST(
  request: NextRequest,
  { params }: { params: { gigId: string } }
) {
  try {
    const supabase = createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gigId } = params;
    const body = await request.json();
    const { response } = body; // 'yes' or 'no'
    
    if (!['yes', 'no'].includes(response)) {
      return NextResponse.json({ error: 'Invalid response value' }, { status: 400 });
    }

    // Get gig and verify user is a band member
    const { data: gig, error: gigError } = await supabase
      .from('gigs')
      .select('band_id')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) {
      return NextResponse.json({ error: 'Gig not found' }, { status: 404 });
    }

    // Verify user is a member of this band
    const { data: membership, error: membershipError } = await supabase
      .from('band_members')
      .select('id')
      .eq('band_id', gig.band_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Forbidden: Not a band member' }, { status: 403 });
    }

    // Insert or update gig response
    const { data, error: responseError } = await supabase
      .from('gig_member_responses')
      .upsert({
        gig_id: gigId,
        band_member_id: membership.id,
        response: response,
        responded_at: new Date().toISOString(),
      })
      .select(`
        *,
        band_members!inner(
          id,
          user_id,
          users(
            id,
            first_name,
            last_name
          )
        )
      `)
      .single();

    if (responseError) {
      console.error('[api/gigs/responses] Response error:', responseError);
      return NextResponse.json({ error: responseError.message }, { status: 500 });
    }

    // Broadcast real-time event
    try {
      const memberName = data.band_members?.users 
        ? `${data.band_members.users.first_name || ''} ${data.band_members.users.last_name || ''}`.trim() || 'Unknown Member'
        : 'Unknown Member';

      await broadcastGigResponse(
        gig.band_id,
        gigId,
        membership.id,
        response,
        memberName,
        user.id
      );
    } catch (broadcastError) {
      console.error('[api/gigs/responses] Broadcast error:', broadcastError);
      // Don't fail the request if broadcast fails
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('[api/gigs/responses] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { gigId: string } }
) {
  try {
    const supabase = createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gigId } = params;

    // Get gig and verify user is a band member
    const { data: gig, error: gigError } = await supabase
      .from('gigs')
      .select('band_id')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) {
      return NextResponse.json({ error: 'Gig not found' }, { status: 404 });
    }

    // Verify user is a member of this band
    const { data: membership, error: membershipError } = await supabase
      .from('band_members')
      .select('id')
      .eq('band_id', gig.band_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Forbidden: Not a band member' }, { status: 403 });
    }

    // Get all responses for this gig
    const { data: responses, error: responsesError } = await supabase
      .from('gig_member_responses')
      .select(`
        *,
        band_members!inner(
          id,
          user_id,
          users(
            id,
            first_name,
            last_name
          )
        )
      `)
      .eq('gig_id', gigId);

    if (responsesError) {
      console.error('[api/gigs/responses] Get responses error:', responsesError);
      return NextResponse.json({ error: responsesError.message }, { status: 500 });
    }

    return NextResponse.json({ data: responses || [] }, { status: 200 });
  } catch (error) {
    console.error('[api/gigs/responses] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}