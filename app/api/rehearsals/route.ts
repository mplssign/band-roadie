import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

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

    const { band_id, date, start_time, end_time, location, notes, setlist_id } = body;

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

    // Insert rehearsal
    const { data, error } = await supabase
      .from('rehearsals')
      .insert([
        {
          band_id,
          date,
          start_time,
          end_time,
          location: location || 'TBD',
          notes,
          setlist_id: setlist_id || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('[api/rehearsals] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('[api/rehearsals] Unexpected error:', error);
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

    const { id, date, start_time, end_time, location, setlist_id } = body;

    // Verify ownership through band membership
    const { data: rehearsal } = await supabase
      .from('rehearsals')
      .select('band_id')
      .eq('id', id)
      .single();

    if (!rehearsal) {
      return NextResponse.json({ error: 'Rehearsal not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('band_members')
      .select('id')
      .eq('band_id', rehearsal.band_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: Not a band member' }, { status: 403 });
    }

    // Update rehearsal
    const { data, error } = await supabase
      .from('rehearsals')
      .update({
        date,
        start_time,
        end_time,
        location: location || 'TBD',
        setlist_id: setlist_id || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[api/rehearsals] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('[api/rehearsals] Unexpected error:', error);
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
      return NextResponse.json({ error: 'Missing rehearsal ID' }, { status: 400 });
    }

    // Verify ownership through band membership
    const { data: rehearsal } = await supabase
      .from('rehearsals')
      .select('band_id')
      .eq('id', id)
      .single();

    if (!rehearsal) {
      return NextResponse.json({ error: 'Rehearsal not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('band_members')
      .select('id')
      .eq('band_id', rehearsal.band_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: Not a band member' }, { status: 403 });
    }

    // Delete rehearsal
    const { error } = await supabase.from('rehearsals').delete().eq('id', id);

    if (error) {
      console.error('[api/rehearsals] Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[api/rehearsals] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
