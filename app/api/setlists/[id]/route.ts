import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTuningInfo } from '@/lib/utils/tuning';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { id } = params;

  try {
    const { data: setlist, error } = await supabase
      .from('setlists')
      .select(`
        id,
        name,
        total_duration,
        created_at,
        updated_at,
        setlist_songs (
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
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching setlist:', error);
      return NextResponse.json({ error: 'Failed to fetch setlist' }, { status: 500 });
    }

    if (!setlist) {
      return NextResponse.json({ error: 'Setlist not found' }, { status: 404 });
    }

    // Sort songs by position and add tuning information
    if (setlist.setlist_songs) {
      setlist.setlist_songs.sort((a, b) => a.position - b.position);
      
      // Add tuning names and notes to each song
      setlist.setlist_songs = setlist.setlist_songs.map(song => {
        const tuningInfo = getTuningInfo(song.tuning);
        const enhancedSong = {
          ...song,
          tuning_name: tuningInfo.name,
          tuning_notes: tuningInfo.notes
        };
        

        
        return enhancedSong;
      });
    }

    return NextResponse.json({ setlist });
  } catch (error) {
    console.error('Error in setlist detail API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { id } = params;

  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const { data: setlist, error } = await supabase
      .from('setlists')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating setlist:', error);
      return NextResponse.json({ error: 'Failed to update setlist' }, { status: 500 });
    }

    return NextResponse.json({ setlist });
  } catch (error) {
    console.error('Error in setlist update:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { id } = params;

  try {
    const { error } = await supabase
      .from('setlists')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting setlist:', error);
      return NextResponse.json({ error: 'Failed to delete setlist' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in setlist deletion:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}