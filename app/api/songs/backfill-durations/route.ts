import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface SongData {
  id: string;
  duration_seconds: number | null;
  songs: {
    id: string;
    title: string;
    artist: string;
    duration_seconds: number | null;
  };
}

export async function POST() {
  const supabase = createClient();

  try {
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get all setlist_songs without duration_seconds from user's bands
    const { data: rawData, error: queryError } = await supabase
      .from('setlist_songs')
      .select(`
        id,
        duration_seconds,
        songs!inner (
          id,
          title,
          artist,
          duration_seconds
        ),
        setlists!inner (
          id,
          band_id,
          band_members!inner (
            user_id
          )
        )
      `)
      .is('duration_seconds', null)
      .eq('setlists.band_members.user_id', user.id)
      .eq('setlists.band_members.is_active', true);

    if (queryError) {
      console.error('Error querying songs without duration:', queryError);
      return NextResponse.json(
        { error: 'Failed to query songs' },
        { status: 500 }
      );
    }

    // Type assertion since we know the structure from the select query
    const songsWithoutDuration = rawData as unknown as SongData[];

    if (!songsWithoutDuration || songsWithoutDuration.length === 0) {
      return NextResponse.json({
        message: 'No songs found that need duration backfill',
        updated: 0
      });
    }

    // Prepare songs for bulk duration lookup
    const songsToLookup = songsWithoutDuration
      .filter(item => item.songs && item.songs.title && item.songs.artist)
      .map(item => ({
        setlist_song_id: item.id,
        song_id: item.songs.id,
        artist: item.songs.artist,
        title: item.songs.title,
        existing_duration: item.songs.duration_seconds
      }));

    if (songsToLookup.length === 0) {
      return NextResponse.json({
        message: 'No valid songs found for duration lookup',
        updated: 0
      });
    }

    // Call the bulk duration API
    const bulkDurationResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/songs/bulk-durations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({
        songs: songsToLookup.map(song => ({
          artist: song.artist,
          title: song.title
        }))
      })
    });

    if (!bulkDurationResponse.ok) {
      throw new Error('Failed to fetch durations from bulk API');
    }

    const { results } = await bulkDurationResponse.json();
    let updatedCount = 0;

    // Process results and update setlist_songs
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const songToUpdate = songsToLookup[i];

      if (result.status === 'found' && result.duration_seconds) {
        try {
          // Update both the song record and setlist_song record
          const { error: songUpdateError } = await supabase
            .from('songs')
            .update({ duration_seconds: result.duration_seconds })
            .eq('id', songToUpdate.song_id);

          const { error: setlistSongUpdateError } = await supabase
            .from('setlist_songs')
            .update({ duration_seconds: result.duration_seconds })
            .eq('id', songToUpdate.setlist_song_id);

          if (songUpdateError) {
            console.error(`Error updating song ${songToUpdate.song_id}:`, songUpdateError);
          }

          if (setlistSongUpdateError) {
            console.error(`Error updating setlist_song ${songToUpdate.setlist_song_id}:`, setlistSongUpdateError);
          }

          if (!songUpdateError && !setlistSongUpdateError) {
            updatedCount++;
          }
        } catch (error) {
          console.error(`Error updating duration for song ${songToUpdate.title}:`, error);
        }
      }
    }

    return NextResponse.json({
      message: `Successfully backfilled durations for ${updatedCount} songs`,
      processed: songsToLookup.length,
      updated: updatedCount,
      found_songs: songsWithoutDuration.length
    });

  } catch (error) {
    console.error('Error in duration backfill API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}