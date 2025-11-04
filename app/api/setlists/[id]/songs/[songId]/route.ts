import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getTuningInfo } from '@/lib/utils/tuning';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; songId: string } }
) {
  // Create user-authenticated client
  const supabase = createServerClient(
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
  const { id: setlistId, songId } = params;

  try {
    // First check if the record exists
    const { data: existing, error: selectError } = await supabase
      .from('setlist_songs')
      .select('*')
      .eq('id', songId)
      .eq('setlist_id', setlistId)
      .single();

    if (selectError) {
      console.error(`[DELETE] Error finding record:`, selectError);
      return NextResponse.json({ error: 'Song not found in setlist' }, { status: 404 });
    }

    if (!existing) {
      // console.log(`[DELETE] No record found with id=${songId} in setlist=${setlistId}`);
      return NextResponse.json({ error: 'Song not found in setlist' }, { status: 404 });
    }

    // console.log(`[DELETE] Found record:`, existing);

    // First check if user has access to this setlist
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[DELETE] Authentication error:', authError);
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Use a simpler approach - try to query the setlist with user's permissions
    // If the user can see the setlist, they have permission to modify it
    const { data: setlist, error: setlistError } = await supabase
      .from('setlists')
      .select('id, band_id')
      .eq('id', setlistId)
      .single();

    if (setlistError || !setlist) {
      console.error('[DELETE] Setlist access denied or not found:', setlistError);
      return NextResponse.json({ 
        error: 'Access denied - setlist not found or no permission',
        debug: {
          setlistError,
          userId: user.id,
          setlistId,
          step: 'setlist_access_check'
        }
      }, { status: 403 });
    }

    // Use service role to bypass trigger issues
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    let deleteError: unknown = null;

    if (supabaseServiceKey && supabaseUrl) {
      // Use service role client to bypass RLS and triggers
      const { createClient } = await import('@supabase/supabase-js');
      const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Direct delete with service role to avoid trigger issues
      const { error: serviceError } = await serviceSupabase
        .from('setlist_songs')
        .delete()
        .eq('id', songId)
        .eq('setlist_id', setlistId);
      
      deleteError = serviceError;
    } else {
      // Fallback to regular client
      const { error } = await supabase
        .from('setlist_songs')
        .delete()
        .eq('id', songId)
        .eq('setlist_id', setlistId);
      
      deleteError = error;
    }

    if (deleteError) {
      console.error('[DELETE] Error removing song from setlist:', deleteError);
      return NextResponse.json({ 
        error: 'Failed to remove song from setlist',
        debug: {
          supabaseError: deleteError,
          setlistId,
          songId,
          existing,
          userId: user.id,
          bandId: setlist.band_id
        }
      }, { status: 500 });
    }

    // console.log(`[DELETE] Successfully deleted setlist_songs record with id=${songId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE] Exception in remove song from setlist API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      debug: {
        exception: error instanceof Error ? error.message : 'Unknown error',
        setlistId,
        songId
      }
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; songId: string } }
) {
  // Create user-authenticated client
  const supabase = createServerClient(
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