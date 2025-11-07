import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTuningInfo } from '@/lib/utils/tuning';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const setlistId = params.id;

  try {
    const body = await request.json();
    const { song_id, bpm, tuning, duration_seconds } = body;

    if (!song_id) {
      return NextResponse.json({ error: 'Song ID is required' }, { status: 400 });
    }

    // Get setlist info to check if this is "All Songs" and get band_id
    const { data: setlistInfo } = await supabase
      .from('setlists')
      .select('band_id, setlist_type, name')
      .eq('id', setlistId)
      .single();

    if (!setlistInfo) {
      return NextResponse.json({ error: 'Setlist not found' }, { status: 404 });
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

    // Adding song to setlist
    const { data: setlistSong, error } = await supabase
      .from('setlist_songs')
      .insert({
        setlist_id: setlistId,
        song_id,
        position: nextPosition,
        bpm,
        tuning: tuning || 'standard',
        duration_seconds,
      })
      .select(
        `
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
      `,
      )
      .single();

    if (error) {
      console.error('Error adding song to setlist:', error);
      
      // Handle duplicate song constraint
      if (error.code === '23505' && error.message.includes('setlist_songs_setlist_id_song_id_key')) {
        return NextResponse.json({ 
          error: 'Song is already in this setlist',
          code: 'DUPLICATE_SONG'
        }, { status: 409 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to add song to setlist',
        details: error.message || error
      }, { status: 500 });
    }

    // If this isn't the "All Songs" setlist, auto-add to "All Songs"
    // Use both setlist_type and name for backward compatibility
    const isAllSongs = setlistInfo.setlist_type === 'all_songs' || setlistInfo.name === 'All Songs';
    if (!isAllSongs) {
      await autoAddToAllSongs(setlistInfo.band_id, song_id, {
        bpm,
        tuning: tuning || 'standard',
        duration_seconds
      });
    }

    // Add tuning information to the response
    const tuningInfo = getTuningInfo(setlistSong.tuning);
    const enhancedSetlistSong = {
      ...setlistSong,
      tuning_name: tuningInfo.name,
      tuning_notes: tuningInfo.notes,
    };

    return NextResponse.json({ setlist_song: enhancedSetlistSong });
  } catch (error) {
    console.error('Error in add song to setlist API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function autoAddToAllSongs(bandId: string, songId: string, songData: {
  bpm?: number;
  tuning: string;
  duration_seconds?: number;
}) {
  const supabase = await createClient();
  
  try {
    // Get or create "All Songs" setlist - use backward compatible approach
    let { data: allSongsSetlist } = await supabase
      .from('setlists')
      .select('id')
      .eq('band_id', bandId)
      .eq('name', 'All Songs')  // Use name for backward compatibility
      .single();
    
    if (!allSongsSetlist) {
      // Create "All Songs" setlist if it doesn't exist
      // Check if setlist_type column exists by trying to include it
      let insertData: any = {
        band_id: bandId,
        name: 'All Songs',
        total_duration: 0,
      };
      
      // Try to include setlist_type if the column exists
      const { error: columnCheckError } = await supabase
        .from('setlists')
        .select('setlist_type')
        .limit(1);
        
      if (!columnCheckError) {
        insertData.setlist_type = 'all_songs';
      }
      
      const { data: newSetlist } = await supabase
        .from('setlists')
        .insert(insertData)
        .select()
        .single();
      
      allSongsSetlist = newSetlist;
    }
    
    if (!allSongsSetlist) return; // Failed to create/find All Songs
    
    // Check if song already exists in "All Songs"
    const { data: existingSong } = await supabase
      .from('setlist_songs')
      .select('id')
      .eq('setlist_id', allSongsSetlist.id)
      .eq('song_id', songId)
      .single();
    
    if (existingSong) return; // Song already in "All Songs"
    
    // Get next position in "All Songs"
    const { data: lastSong } = await supabase
      .from('setlist_songs')
      .select('position')
      .eq('setlist_id', allSongsSetlist.id)
      .order('position', { ascending: false })
      .limit(1)
      .single();
    
    const nextPosition = (lastSong?.position || 0) + 1;
    
    // Add song to "All Songs"
    await supabase
      .from('setlist_songs')
      .insert({
        setlist_id: allSongsSetlist.id,
        song_id: songId,
        position: nextPosition,
        bpm: songData.bpm,
        tuning: songData.tuning,
        duration_seconds: songData.duration_seconds,
      });
      
  } catch (error) {
    console.error('Error auto-adding to All Songs:', error);
    // Don't throw - this shouldn't fail the main operation
  }
}

export async function PUT(request: NextRequest, { params: _params }: { params: { id: string } }) {
  const supabase = await createClient();

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
          duration_seconds: song.duration_seconds,
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
