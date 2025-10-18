import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTuningInfo } from '@/lib/utils/tuning';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const setlistId = params.id;

  try {
    const body = await request.json();
    const { song_id, bpm, tuning, duration_seconds } = body;

    if (!song_id) {
      return NextResponse.json({ error: 'Song ID is required' }, { status: 400 });
    }

    // Get the next position for the song
    const { data: lastSong } = await supabase
      .from('setlist_songs')
      .select('position')
      .eq('setlist_id', setlistId)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    const nextPosition = (lastSong?.position || 0) + 1;

    /*
    console.log('Adding song to setlist with data:', {
      setlist_id: setlistId,
      song_id,
      position: nextPosition,
      bpm,
      tuning: tuning || 'standard',
      duration_seconds
    });
    */

    const { data: setlistSong, error } = await supabase
      .from('setlist_songs')
      .insert({
        setlist_id: setlistId,
        song_id,
        position: nextPosition,
        bpm,
        tuning: tuning || 'standard',
        duration_seconds
      })
      .select(`
        id,
        position,
        bpm,
        tuning,
        duration_seconds,
        songs (
          id,
          title,
          artist,
          is_live,
          bpm,
          tuning,
          duration_seconds
        )
      `)
      .single();

    if (error) {
      console.error('Error adding song to setlist:', error);
      return NextResponse.json({ error: 'Failed to add song to setlist' }, { status: 500 });
    }

    // Add tuning information to the response
    const tuningInfo = getTuningInfo(setlistSong.tuning);
    const enhancedSetlistSong = {
      ...setlistSong,
      tuning_name: tuningInfo.name,
      tuning_notes: tuningInfo.notes
    };



    return NextResponse.json({ setlist_song: enhancedSetlistSong });
  } catch (error) {
    console.error('Error in add song to setlist API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params: _params }: { params: { id: string } }
) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { songs } = body; // Array of songs with new positions

    if (!songs || !Array.isArray(songs)) {
      return NextResponse.json({ error: 'Songs array is required' }, { status: 400 });
    }

    // Update positions for all songs individually to avoid RLS policy issues with upsert
    const updatePromises = songs.map(async (song, index) => {
      const { error } = await supabase
        .from('setlist_songs')
        .update({
          position: index + 1,
          bpm: song.bpm,
          tuning: song.tuning || 'standard',
          duration_seconds: song.duration_seconds
        })
        .eq('id', song.id);

      if (error) {
        console.error(`Error updating song ${song.id}:`, error);
        throw error;
      }
    });

    // Execute all updates
    try {
      await Promise.all(updatePromises);
      // console.log('Successfully updated all song positions');
    } catch (error) {
      console.error('Error updating song positions:', error);
      return NextResponse.json({ error: 'Failed to update song positions' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in update song positions API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}