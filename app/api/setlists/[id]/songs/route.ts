import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireBandMembership } from '@/lib/server/band-scope';
import { getTuningInfo } from '@/lib/utils/tuning';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const setlistId = params.id;

  try {
    const body = await request.json();
    const { song_id, bpm, tuning, duration_seconds } = body;

    if (!song_id) {
      return NextResponse.json({ error: 'Song ID is required' }, { status: 400 });
    }

    // Create client for user authentication using cookies
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {
            // No-op for read-only operations
          },
          remove() {
            // No-op for read-only operations  
          },
        },
      }
    );

    // Check authentication
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Use service role client for database operations
    const supabase = createClient();

    // Get setlist info to check if this is "All Songs" and get band_id
    const { data: setlistInfo, error: setlistError } = await supabase
      .from('setlists')
      .select('band_id, name')
      .eq('id', setlistId)
      .single();

    if (setlistError) {
      console.error('Error querying setlist:', setlistError);
      console.error('Setlist query debug:', { setlistId, error: setlistError, user_id: user.id });
      return NextResponse.json({ 
        error: 'Setlist not found', 
        debug: { setlistId, error: setlistError.message, user_id: user.id, code: setlistError.code }
      }, { status: 404 });
    }

    if (!setlistInfo) {
      console.error('Setlist not found in database:', { setlistId, user_id: user.id });
      return NextResponse.json({ 
        error: 'Setlist not found', 
        debug: { setlistId, user_id: user.id, message: 'No setlist found with this ID' }
      }, { status: 404 });
    }

    // Verify user is a member of the band that owns this setlist
    try {
      await requireBandMembership(setlistInfo.band_id);
    } catch (error) {
      console.error('Band membership check failed:', { setlistId, user_id: user.id, band_id: setlistInfo.band_id, error });
      return NextResponse.json({ 
        error: 'Setlist not found', 
        debug: { setlistId, user_id: user.id, band_id: setlistInfo.band_id, message: 'User not member of band' }
      }, { status: 404 });
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
    const isAllSongs = setlistInfo.name === 'All Songs';
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

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const setlistId = params.id;
  
  try {
    console.log('[PUT] Starting setlist song update request for setlist:', setlistId);
    
    // Create client for user authentication using cookies
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {
            // No-op for read-only operations
          },
          remove() {
            // No-op for read-only operations  
          },
        },
      }
    );

    // Check authentication
    let authenticatedUser: any = null;
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      console.log('[PUT] Authentication failed:', authError);
      
      // Try fallback authentication method like in bands API
      const cookieStore = await cookies();
      let fallbackAccessToken = cookieStore.get('sb-access-token')?.value;

      // Check for standard Supabase cookies as fallback
      if (!fallbackAccessToken) {
        const supabaseSession = cookieStore.get('sb-127.0.0.1-auth-token')?.value || 
                                cookieStore.get('sb-localhost-auth-token')?.value ||
                                cookieStore.get('sb-bandroadie.com-auth-token')?.value;
        
        if (supabaseSession) {
          try {
            const session = JSON.parse(supabaseSession);
            fallbackAccessToken = session?.access_token;
            console.log('[PUT] Using fallback session cookie for access token');
          } catch (e) {
            console.warn('[PUT] Failed to parse session cookie:', e);
          }
        }
      }

      if (fallbackAccessToken) {
        // Try to get user with fallback token
        const supabaseFallback = createClient();
        const { data: { user: fallbackUser }, error: fallbackError } = await supabaseFallback.auth.getUser(fallbackAccessToken);
        
        if (fallbackError || !fallbackUser) {
          console.log('[PUT] Fallback authentication also failed:', fallbackError);
          return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }
        
        console.log('[PUT] Fallback user authenticated:', fallbackUser.id);
        authenticatedUser = fallbackUser;
      } else {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
    } else {
      console.log('[PUT] User authenticated:', user.id);
      authenticatedUser = user;
    }

    // Use service role client for database operations
    const supabase = createClient();

    const body = await request.json();
    const { songs } = body; // Array of songs with new positions
    console.log('[PUT] Request body songs count:', songs?.length || 0);

    if (!songs || !Array.isArray(songs)) {
      console.log('[PUT] Invalid songs array:', songs);
      return NextResponse.json({ error: 'Songs array is required' }, { status: 400 });
    }

    // Get setlist info for band validation (from first song)
    if (songs.length > 0) {
      console.log('[PUT] Validating band membership for first song:', songs[0].id);
      const { data: setlistSong, error: fetchError } = await supabase
        .from('setlist_songs')
        .select('setlist_id, setlists!inner(band_id)')
        .eq('id', songs[0].id)
        .single();

      if (fetchError || !setlistSong) {
        console.error('[PUT] Error fetching setlist song:', fetchError);
        return NextResponse.json({ error: 'Setlist song not found' }, { status: 404 });
      }

      console.log('[PUT] Setlist song data:', setlistSong);
      const bandId = (setlistSong as any).setlists.band_id;
      console.log('[PUT] Extracted band ID:', bandId);

      try {
        await requireBandMembership(bandId);
        console.log('[PUT] Band membership validated for band:', bandId);
      } catch (error) {
        console.error('[PUT] Band membership check failed:', { user_id: authenticatedUser.id, band_id: bandId, error });
        return NextResponse.json({ 
          error: 'Setlist not found', 
          debug: { user_id: authenticatedUser.id, band_id: bandId, message: 'User not member of band' }
        }, { status: 404 });
      }
    }

    // Update positions for all songs individually to avoid RLS policy issues with upsert
    console.log('[PUT] Starting song updates for', songs.length, 'songs');
    const updatePromises = songs.map(async (song, index) => {
      console.log('[PUT] Updating song:', { id: song.id, position: index + 1, bpm: song.bpm, tuning: song.tuning });
      
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
        console.error(`[PUT] Error updating song ${song.id}:`, error);
        throw error;
      } else {
        console.log(`[PUT] Successfully updated song ${song.id} to position ${index + 1}`);
      }
    });

    // Execute all updates
    try {
      console.log('[PUT] Executing all song updates...');
      await Promise.all(updatePromises);
      console.log('[PUT] Successfully updated all song positions');
    } catch (error) {
      console.error('[PUT] Error updating song positions:', error);
      return NextResponse.json({ error: 'Failed to update song positions' }, { status: 500 });
    }

    console.log('[PUT] All song updates completed successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PUT] Error in update song positions API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
