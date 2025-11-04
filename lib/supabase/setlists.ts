import { createClient } from './client';

export interface SetlistOption {
  id: string;
  name: string;
}

/**
 * Fetch all setlists for a band, excluding the current one
 */
export async function listSetlists(bandId: string, excludeSetlistId?: string): Promise<SetlistOption[]> {
  const supabase = createClient();

  let query = supabase
    .from('setlists')
    .select('id, name')
    .eq('band_id', bandId)
    .order('name');

  if (excludeSetlistId) {
    query = query.neq('id', excludeSetlistId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching setlists:', error);
    throw new Error('Failed to fetch setlists');
  }

  return data || [];
}

/**
 * Copy a song from one setlist to another
 */
export async function copySongToSetlist(
  songId: string,
  fromSetlistId: string,
  toSetlistId: string
): Promise<void> {
  const supabase = createClient();

  try {
    // First, get the song data from the source setlist
    const { data: sourceSetlistSong, error: fetchError } = await supabase
      .from('setlist_songs')
      .select(`
        song_id,
        bpm,
        tuning,
        duration_seconds,
        songs!inner (
          title,
          artist
        )
      `)
      .eq('id', songId)
      .eq('setlist_id', fromSetlistId)
      .single();

    if (fetchError) {
      console.error('Error fetching source song:', fetchError);
      throw new Error('Failed to fetch song details');
    }

    if (!sourceSetlistSong) {
      throw new Error('Song not found in source setlist');
    }

    // Get the next position in the target setlist
    const { data: maxPositionData, error: positionError } = await supabase
      .from('setlist_songs')
      .select('position')
      .eq('setlist_id', toSetlistId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (positionError) {
      console.error('Error getting max position:', positionError);
      throw new Error('Failed to determine position for new song');
    }

    const nextPosition = (maxPositionData?.position || 0) + 1;

    // Insert the song into the target setlist
    const { error: insertError } = await supabase
      .from('setlist_songs')
      .insert({
        setlist_id: toSetlistId,
        song_id: sourceSetlistSong.song_id,
        position: nextPosition,
        bpm: sourceSetlistSong.bpm,
        tuning: sourceSetlistSong.tuning,
        duration_seconds: sourceSetlistSong.duration_seconds,
      });

    if (insertError) {
      console.error('Error copying song to setlist:', insertError);
      // Check if it's a duplicate song error
      if (insertError.code === '23505' && insertError.message?.includes('setlist_songs_setlist_id_song_id_key')) {
        const songs = sourceSetlistSong.songs as { title?: string; artist?: string } | { title?: string; artist?: string }[];
        const songTitle = Array.isArray(songs) ? songs[0]?.title : songs?.title;
        throw new Error(`"${songTitle || 'Song'}" is already in the target setlist`);
      }
      throw new Error('Failed to copy song to setlist');
    }
  } catch (error) {
    // Re-throw our custom errors, wrap others
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to copy song');
  }
}

/**
 * Get setlist name by ID
 */
export async function getSetlistById(setlistId: string): Promise<SetlistOption | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('setlists')
    .select('id, name')
    .eq('id', setlistId)
    .single();

  if (error) {
    console.error('Error fetching setlist:', error);
    return null;
  }

  return data;
}