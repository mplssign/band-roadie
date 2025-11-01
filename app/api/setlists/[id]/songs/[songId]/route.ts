import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTuningInfo } from '@/lib/utils/tuning';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; songId: string } }
) {
  const supabase = await createClient();
  const { id: setlistId, songId } = params;

  try {
    const { error } = await supabase
      .from('setlist_songs')
      .delete()
      .eq('setlist_id', setlistId)
      .eq('id', songId);

    if (error) {
      console.error('Error removing song from setlist:', error);
      return NextResponse.json({ error: 'Failed to remove song from setlist' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in remove song from setlist API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; songId: string } }
) {
  const supabase = await createClient();
  const { id: setlistId, songId } = params;

  try {
    const body = await request.json();
    const { bpm, tuning, duration_seconds } = body;

    const { data: setlistSong, error } = await supabase
      .from('setlist_songs')
      .update({
        bpm,
        tuning: tuning || 'standard',
        duration_seconds
      })
      .eq('setlist_id', setlistId)
      .eq('id', songId)
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
      console.error('Error updating setlist song:', error);
      return NextResponse.json({ error: 'Failed to update setlist song' }, { status: 500 });
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
    console.error('Error in update setlist song API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}