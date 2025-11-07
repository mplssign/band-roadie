import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireBandMembership, requireResourceInBand } from '@/lib/server/band-scope';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const setlistId = params.id;

  try {
    const body = await request.json();
    const { songIds } = body;

    if (!songIds || !Array.isArray(songIds) || songIds.length === 0) {
      return NextResponse.json({ error: 'Song IDs array is required' }, { status: 400 });
    }

    // Get setlist info to verify ownership and prevent operation on regular setlists from affecting "All Songs"
    const { data: setlistInfo, error: setlistError } = await supabase
      .from('setlists')
      .select('band_id, name, setlist_type')
      .eq('id', setlistId)
      .single();

    if (setlistError || !setlistInfo) {
      console.error('Error fetching setlist:', setlistError);
      return NextResponse.json({ error: 'Setlist not found' }, { status: 404 });
    }

    // Verify user has access to the band
    await requireBandMembership(setlistInfo.band_id);
    await requireResourceInBand('setlists', setlistId, setlistInfo.band_id);

    // Verify all songs belong to this setlist
    const { data: existingSongs, error: verifyError } = await supabase
      .from('setlist_songs')
      .select('id')
      .eq('setlist_id', setlistId)
      .in('id', songIds);

    if (verifyError) {
      console.error('Error verifying songs:', verifyError);
      return NextResponse.json({ error: 'Failed to verify song ownership' }, { status: 500 });
    }

    if (!existingSongs || existingSongs.length !== songIds.length) {
      return NextResponse.json({ 
        error: 'Some songs do not belong to this setlist' 
      }, { status: 400 });
    }

    // Delete the songs (this will trigger the reorder function automatically)
    const { error: deleteError } = await supabase
      .from('setlist_songs')
      .delete()
      .eq('setlist_id', setlistId)
      .in('id', songIds);

    if (deleteError) {
      console.error('Error deleting songs:', deleteError);
      return NextResponse.json({ error: 'Failed to delete songs' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: `Successfully deleted ${songIds.length} song${songIds.length === 1 ? '' : 's'}`,
      deletedCount: songIds.length
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isForbidden = errorMessage.includes('Forbidden') || errorMessage.includes('not a member');
    console.error('Error in bulk delete:', error);
    return NextResponse.json({ error: errorMessage }, { status: isForbidden ? 403 : 500 });
  }
}