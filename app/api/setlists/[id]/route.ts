import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireBandMembership, requireResourceInBand } from '@/lib/server/band-scope';
import { getTuningInfo } from '@/lib/utils/tuning';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { id } = params;
  const { searchParams } = new URL(request.url);
  const bandId = searchParams.get('band_id');

  if (!bandId) {
    return NextResponse.json({ error: 'Band ID is required' }, { status: 400 });
  }

  try {
    // Verify user is a member of this band
    await requireBandMembership(bandId);

    // Verify this setlist belongs to the band
    await requireResourceInBand('setlists', id, bandId);

    // Check if setlist_type column exists
    const { error: columnCheckError } = await supabase
      .from('setlists')
      .select('setlist_type')
      .limit(1);
      
    let selectFields = `
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
      `;
      
    if (!columnCheckError) {
      // Column exists, include setlist_type in select
      selectFields = `
        id,
        name,
        setlist_type,
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
      `;
    }

    const { data: setlist, error } = await supabase
      .from('setlists')
      .select(selectFields)
      .eq('id', id)
      .eq('band_id', bandId)
      .single();

    if (error) {
      console.error('Error fetching setlist:', error);
      return NextResponse.json({ error: 'Failed to fetch setlist' }, { status: 500 });
    }

    if (!setlist) {
      return NextResponse.json({ error: 'Setlist not found' }, { status: 404 });
    }

    // Sort songs by position and add tuning information
    if (setlist && (setlist as any).setlist_songs) {
      (setlist as any).setlist_songs.sort((a: any, b: any) => a.position - b.position);

      // Add tuning names and notes to each song
      (setlist as any).setlist_songs = (setlist as any).setlist_songs.map((song: any) => {
        const tuningInfo = getTuningInfo(song.tuning);
        const enhancedSong = {
          ...song,
          tuning_name: tuningInfo.name,
          tuning_notes: tuningInfo.notes,
        };

        return enhancedSong;
      });
    }

    return NextResponse.json({ setlist });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isForbidden = errorMessage.includes('Forbidden') || errorMessage.includes('not a member');
    console.error('Error in setlist detail API:', error);
    return NextResponse.json({ error: errorMessage }, { status: isForbidden ? 403 : 500 });
  }
}

function isAllSongsVariant(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[^a-z]/g, '');
  const variants = ['allsongs', 'all_songs', 'allsong'];
  return variants.includes(normalized);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { id } = params;

  try {
    const body = await request.json();
    const { name, band_id } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!band_id) {
      return NextResponse.json({ error: 'Band ID is required' }, { status: 400 });
    }

    // Verify user is a member and resource belongs to band
    await requireBandMembership(band_id);
    await requireResourceInBand('setlists', id, band_id);

    // Check if this is the "All Songs" setlist - use both setlist_type and name for backward compatibility
    const { data: existingSetlist } = await supabase
      .from('setlists')
      .select('setlist_type, name')
      .eq('id', id)
      .eq('band_id', band_id)
      .single();

    // Check if this is "All Songs" setlist (by setlist_type or by name for backward compatibility)
    const isAllSongs = existingSetlist?.setlist_type === 'all_songs' || existingSetlist?.name === 'All Songs';
    
    if (isAllSongs) {
      return NextResponse.json({ 
        error: 'The "All Songs" setlist cannot be renamed.' 
      }, { status: 400 });
    }

    // Prevent renaming to "All Songs" variants
    if (isAllSongsVariant(name)) {
      return NextResponse.json({ 
        error: 'The name "All Songs" is reserved. Please choose a different name for your setlist.' 
      }, { status: 400 });
    }

    const { data: setlist, error } = await supabase
      .from('setlists')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('band_id', band_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating setlist:', error);
      return NextResponse.json({ error: 'Failed to update setlist' }, { status: 500 });
    }

    return NextResponse.json({ setlist });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isForbidden = errorMessage.includes('Forbidden') || errorMessage.includes('not a member');
    console.error('Error in setlist update:', error);
    return NextResponse.json({ error: errorMessage }, { status: isForbidden ? 403 : 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { id } = params;
  const { searchParams } = new URL(request.url);
  const bandId = searchParams.get('band_id');

  if (!bandId) {
    return NextResponse.json({ error: 'Band ID is required' }, { status: 400 });
  }

  try {
    // Verify user is a member and resource belongs to band
    await requireBandMembership(bandId);
    await requireResourceInBand('setlists', id, bandId);

    // Check if this is the "All Songs" setlist - use both setlist_type and name for backward compatibility
    const { data: setlistToDelete } = await supabase
      .from('setlists')
      .select('setlist_type, name')
      .eq('id', id)
      .eq('band_id', bandId)
      .single();

    // Check if this is "All Songs" setlist (by setlist_type or by name for backward compatibility)
    const isAllSongs = setlistToDelete?.setlist_type === 'all_songs' || setlistToDelete?.name === 'All Songs';
    
    if (isAllSongs) {
      return NextResponse.json({ 
        error: 'The "All Songs" setlist cannot be deleted.' 
      }, { status: 400 });
    }

    const { error } = await supabase.from('setlists').delete().eq('id', id).eq('band_id', bandId);

    if (error) {
      console.error('Error deleting setlist:', error);
      return NextResponse.json({ error: 'Failed to delete setlist' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isForbidden = errorMessage.includes('Forbidden') || errorMessage.includes('not a member');
    console.error('Error deleting setlist:', error);
    return NextResponse.json({ error: errorMessage }, { status: isForbidden ? 403 : 500 });
  }
}
