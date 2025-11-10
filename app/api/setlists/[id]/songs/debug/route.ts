import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const setlistId = params.id;
  
  try {
    console.log('[DEBUG] === SETLIST SAVE DEBUG ENDPOINT ===');
    console.log('[DEBUG] Setlist ID:', setlistId);
    
    const body = await request.json();
    console.log('[DEBUG] Request body:', JSON.stringify(body, null, 2));
    
    const { songs } = body;
    console.log('[DEBUG] Songs array:', songs);
    console.log('[DEBUG] Songs count:', songs?.length || 0);
    
    if (!songs || !Array.isArray(songs)) {
      console.log('[DEBUG] Invalid songs array');
      return NextResponse.json({ error: 'Songs array is required' }, { status: 400 });
    }
    
    if (songs.length > 0) {
      console.log('[DEBUG] First song structure:', JSON.stringify(songs[0], null, 2));
    }
    
    // Test database connection
    const supabase = await createClient();
    
    // Try a simple query first
    const { data: setlistData, error: setlistError } = await supabase
      .from('setlists')
      .select('id, name, band_id')
      .eq('id', setlistId)
      .single();
    
    console.log('[DEBUG] Setlist query result:', { setlistData, setlistError });
    
    if (setlistError || !setlistData) {
      return NextResponse.json({ 
        error: 'Setlist not found',
        debug: { setlistId, setlistError }
      }, { status: 404 });
    }
    
    // Try querying setlist_songs
    const { data: existingSongs, error: songsError } = await supabase
      .from('setlist_songs')
      .select('id, position, song_id')
      .eq('setlist_id', setlistId)
      .order('position');
    
    console.log('[DEBUG] Existing songs query result:', { existingSongs, songsError });
    
    return NextResponse.json({ 
      success: true,
      debug: {
        setlistId,
        setlistData,
        existingSongs,
        receivedSongs: songs,
        songCount: songs.length
      }
    });
    
  } catch (error) {
    console.error('[DEBUG] Error in debug endpoint:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      debug: { message: error instanceof Error ? error.message : String(error) }
    }, { status: 500 });
  }
}