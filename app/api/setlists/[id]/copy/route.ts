import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireBandMembership, requireResourceInBand } from '@/lib/server/band-scope';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { id } = params;

  try {
    const body = await request.json();
    const { band_id } = body;

    if (!band_id) {
      return NextResponse.json({ error: 'Band ID is required' }, { status: 400 });
    }

    // Verify user is a member and resource belongs to band
    await requireBandMembership(band_id);
    await requireResourceInBand('setlists', id, band_id);

    // Get the original setlist with all songs
    const { data: originalSetlist, error: fetchError } = await supabase
      .from('setlists')
      .select(`
        id,
        name,
        total_duration,
        setlist_songs (
          position,
          bpm,
          tuning,
          duration_seconds,
          song_id
        )
      `)
      .eq('id', id)
      .eq('band_id', band_id)
      .single();

    if (fetchError || !originalSetlist) {
      console.error('Error fetching original setlist:', fetchError);
      return NextResponse.json({ error: 'Setlist not found' }, { status: 404 });
    }

    // Create the new setlist
    const { data: newSetlist, error: createError } = await supabase
      .from('setlists')
      .insert({
        band_id,
        name: `${originalSetlist.name} (Copy)`,
        total_duration: originalSetlist.total_duration,
      })
      .select()
      .single();

    if (createError || !newSetlist) {
      console.error('Error creating new setlist:', createError);
      return NextResponse.json({ error: 'Failed to create setlist copy' }, { status: 500 });
    }

    // Copy all the songs if there are any
    if (originalSetlist.setlist_songs && originalSetlist.setlist_songs.length > 0) {
      const songsCopy = originalSetlist.setlist_songs.map((setlistSong) => ({
        setlist_id: newSetlist.id,
        song_id: setlistSong.song_id,
        position: setlistSong.position,
        bpm: setlistSong.bpm,
        tuning: setlistSong.tuning,
        duration_seconds: setlistSong.duration_seconds,
      }));

      const { error: songsError } = await supabase
        .from('setlist_songs')
        .insert(songsCopy);

      if (songsError) {
        console.error('Error copying songs:', songsError);
        // Clean up the created setlist if song copying fails
        await supabase.from('setlists').delete().eq('id', newSetlist.id);
        return NextResponse.json({ error: 'Failed to copy setlist songs' }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      setlist: newSetlist,
      message: 'Setlist copied successfully'
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isForbidden = errorMessage.includes('Forbidden') || errorMessage.includes('not a member');
    console.error('Error copying setlist:', error);
    return NextResponse.json({ error: errorMessage }, { status: isForbidden ? 403 : 500 });
  }
}