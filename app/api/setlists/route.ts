import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireBandMembership } from '@/lib/server/band-scope';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const bandId = searchParams.get('band_id');

  if (!bandId) {
    return NextResponse.json({ error: 'Band ID is required' }, { status: 400 });
  }

  try {
    // Verify user is a member of this band
    await requireBandMembership(bandId);

    const { data: setlists, error } = await supabase
      .from('setlists')
      .select(
        `
        id,
        name,
        total_duration,
        created_at,
        updated_at,
        setlist_songs (
          id
        )
      `,
      )
      .eq('band_id', bandId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching setlists:', error);
      return NextResponse.json({ error: 'Failed to fetch setlists' }, { status: 500 });
    }

    // Add song count to each setlist
    const setlistsWithCounts =
      setlists?.map((setlist) => ({
        ...setlist,
        song_count: setlist.setlist_songs?.length || 0,
        setlist_songs: undefined, // Remove the setlist_songs array from response
      })) || [];

    return NextResponse.json({ setlists: setlistsWithCounts });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isForbidden = errorMessage.includes('Forbidden') || errorMessage.includes('not a member');
    console.error('Error in setlists API:', error);
    return NextResponse.json({ error: errorMessage }, { status: isForbidden ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { band_id, name } = body;

    if (!band_id || !name) {
      return NextResponse.json({ error: 'Band ID and name are required' }, { status: 400 });
    }

    // Verify user is a member of this band
    await requireBandMembership(band_id);

    const { data: setlist, error } = await supabase
      .from('setlists')
      .insert({
        band_id,
        name,
        total_duration: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating setlist:', error);
      return NextResponse.json({ error: 'Failed to create setlist' }, { status: 500 });
    }

    return NextResponse.json({ setlist });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isForbidden = errorMessage.includes('Forbidden') || errorMessage.includes('not a member');
    console.error('Error in setlist creation:', error);
    return NextResponse.json({ error: errorMessage }, { status: isForbidden ? 403 : 500 });
  }
}
