import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { broadcastGigCreated, broadcastGigUpdated, broadcastEvent } from '@/lib/utils/realtime-broadcast';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Decode JWT to get user ID
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
    const userId = payload.sub;

    const supabase = await createClient();
    const body = await req.json();

    const {
      band_id,
      name,
      date,
      start_time,
      end_time,
      location,
      is_potential,
      setlist_id,
      setlist_name,
      notes,
      // optional_member_ids, // Temporarily removed - column doesn't exist in current schema
    } = body;

    // Verify user is a member of the band
    const { data: membership } = await supabase
      .from('band_members')
      .select('id')
      .eq('band_id', band_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: Not a band member' }, { status: 403 });
    }

    // Insert gig
    const { data, error } = await supabase
      .from('gigs')
      .insert([
        {
          band_id,
          name,
          date,
          start_time,
          end_time,
          location: location || 'TBD',
          is_potential: is_potential || false,
          setlist_id: setlist_id || null,
          setlist_name: setlist_name || null,
          notes,
          // optional_member_ids: Array.isArray(optional_member_ids) ? optional_member_ids : [], // Temporarily removed
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('[api/gigs] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Broadcast real-time event
    try {
      await broadcastGigCreated(
        band_id,
        data.id,
        {
          name: data.name,
          venue: data.location || 'TBD',
          date: data.date,
          isPotential: data.is_potential || false,
        },
        userId
      );
    } catch (broadcastError) {
      console.error('[api/gigs] Broadcast error:', broadcastError);
      // Don't fail the request if broadcast fails
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('[api/gigs] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
    const userId = payload.sub;

    const supabase = await createClient();
    const body = await req.json();

    const {
      id,
      name,
      date,
      start_time,
      end_time,
      location,
      is_potential,
      setlist_id,
      setlist_name,
      // optional_member_ids, // Temporarily removed - column doesn't exist in current schema
    } = body;

    // Verify ownership through band membership
    const { data: gig } = await supabase.from('gigs').select('band_id').eq('id', id).single();

    if (!gig) {
      return NextResponse.json({ error: 'Gig not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('band_members')
      .select('id')
      .eq('band_id', gig.band_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: Not a band member' }, { status: 403 });
    }

    // Get original gig data for comparison
    const { data: originalGig } = await supabase
      .from('gigs')
      .select('*')
      .eq('id', id)
      .single();

    // Update gig
    const { data, error } = await supabase
      .from('gigs')
      .update({
        name,
        date,
        start_time,
        end_time,
        location: location || 'TBD',
        is_potential: is_potential || false,
        setlist_id: setlist_id || null,
        setlist_name: setlist_name || null,
        // optional_member_ids: Array.isArray(optional_member_ids) ? optional_member_ids : [], // Temporarily removed
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[api/gigs] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Broadcast real-time event
    try {
      const changes: Record<string, unknown> = {};
      const previousValues: Record<string, unknown> = {};
      
      if (originalGig) {
        // Track what changed
        if (originalGig.name !== name) {
          changes.name = name;
          previousValues.name = originalGig.name;
        }
        if (originalGig.date !== date) {
          changes.date = date;
          previousValues.date = originalGig.date;
        }
        if (originalGig.start_time !== start_time) {
          changes.start_time = start_time;
          previousValues.start_time = originalGig.start_time;
        }
        if (originalGig.location !== (location || 'TBD')) {
          changes.location = location || 'TBD';
          previousValues.location = originalGig.location;
        }
      }
      
      if (Object.keys(changes).length > 0) {
        await broadcastGigUpdated(
          gig.band_id,
          id,
          changes,
          previousValues,
          userId
        );
      }
    } catch (broadcastError) {
      console.error('[api/gigs] Broadcast error:', broadcastError);
      // Don't fail the request if broadcast fails
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('[api/gigs] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
    const userId = payload.sub;

    const supabase = await createClient();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing gig ID' }, { status: 400 });
    }

    // Verify ownership through band membership
    const { data: gig } = await supabase.from('gigs').select('band_id').eq('id', id).single();

    if (!gig) {
      return NextResponse.json({ error: 'Gig not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('band_members')
      .select('id')
      .eq('band_id', gig.band_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: Not a band member' }, { status: 403 });
    }

    // Delete gig
    const { error } = await supabase.from('gigs').delete().eq('id', id);

    if (error) {
      console.error('[api/gigs] Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Broadcast real-time event
    try {
      await broadcastEvent(
        gig.band_id,
        'gig:deleted',
        { gigId: id },
        userId
      );
    } catch (broadcastError) {
      console.error('[api/gigs] Broadcast error:', broadcastError);
      // Don't fail the request if broadcast fails
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[api/gigs] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
