import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireBandMembership, requireResourceInBand } from '@/lib/server/band-scope';

export async function POST(request: NextRequest, { params }: { params: { id: string; songId: string } }) {
  const supabase = await createClient();
  const { id: setlistId, songId: setlistSongId } = params;

  try {
    const body = await request.json();
    const { toSetlistId } = body;

    if (!toSetlistId) {
      return NextResponse.json({ error: 'Destination setlist ID is required' }, { status: 400 });
    }

    // Get the source setlist song with all its data and verify ownership
    const { data: sourceSetlistSong, error: fetchError } = await supabase
      .from('setlist_songs')
      .select(`
        song_id,
        bpm,
        tuning,
        duration_seconds,
        setlists!inner (
          band_id
        ),
        songs!inner (
          title,
          artist
        )
      `)
      .eq('id', setlistSongId)
      .eq('setlist_id', setlistId)
      .single();

    if (fetchError || !sourceSetlistSong) {
      console.error('Error fetching source song:', fetchError);
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    const bandId = (sourceSetlistSong as any).setlists.band_id;

    // Verify user has access to the band
    await requireBandMembership(bandId);

    // Verify destination setlist belongs to the same band
    await requireResourceInBand('setlists', toSetlistId, bandId);

    // Get the next position in the destination setlist
    const { data: lastSong } = await supabase
      .from('setlist_songs')
      .select('position')
      .eq('setlist_id', toSetlistId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextPosition = (lastSong?.position || 0) + 1;

    // Insert the song into the destination setlist
    const { data: newSetlistSong, error: insertError } = await supabase
      .from('setlist_songs')
      .insert({
        setlist_id: toSetlistId,
        song_id: sourceSetlistSong.song_id,
        position: nextPosition,
        bpm: sourceSetlistSong.bpm,
        tuning: sourceSetlistSong.tuning,
        duration_seconds: sourceSetlistSong.duration_seconds,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error copying song to setlist:', insertError);
      
      // Check if it's a duplicate song error
      if (insertError.code === '23505' && insertError.message?.includes('setlist_songs_setlist_id_song_id_key')) {
        const songTitle = (sourceSetlistSong as any).songs.title;
        return NextResponse.json({ 
          error: `"${songTitle}" is already in the destination setlist`,
          code: 'DUPLICATE_SONG'
        }, { status: 409 });
      }
      
      return NextResponse.json({ error: 'Failed to copy song' }, { status: 500 });
    }

    return NextResponse.json({ 
      setlist_song: newSetlistSong,
      message: 'Song copied successfully'
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isForbidden = errorMessage.includes('Forbidden') || errorMessage.includes('not a member');
    console.error('Error copying song:', error);
    return NextResponse.json({ error: errorMessage }, { status: isForbidden ? 403 : 500 });
  }
}