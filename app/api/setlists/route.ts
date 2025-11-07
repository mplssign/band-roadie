import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireBandMembership } from '@/lib/server/band-scope';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const bandId = searchParams.get('band_id');

  if (!bandId) {
    return NextResponse.json({ error: 'Band ID is required' }, { status: 400 });
  }

  try {
    // Verify user is a member of this band
    await requireBandMembership(bandId);

    // Auto-create "All Songs" setlist if it doesn't exist
    await ensureAllSongsSetlist(bandId);

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
          id
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
          id
        )
      `;
    }

    let query = supabase
      .from('setlists')
      .select(selectFields)
      .eq('band_id', bandId);
      
    if (!columnCheckError) {
      // Column exists, order by setlist_type first ("all_songs" first)
      query = query.order('setlist_type', { ascending: false });
    }
    
    // Always order by created_at as secondary sort
    query = query.order('created_at', { ascending: false });
    
    const { data: setlists, error } = await query;

    if (error) {
      console.error('Error fetching setlists:', error);
      return NextResponse.json({ error: 'Failed to fetch setlists' }, { status: 500 });
    }

    // Add song count to each setlist
    const setlistsWithCounts =
      setlists?.map((setlist: any) => ({
        ...setlist,
        song_count: setlist.setlist_songs?.length || 0,
        setlist_songs: undefined, // Remove the setlist_songs array from response
      })) || [];

    return NextResponse.json({ setlists: setlistsWithCounts });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isForbidden = errorMessage.includes('Forbidden') || errorMessage.includes('not a member');
    console.error('Error in setlists API:', error);
    return NextResponse.json({ error: errorMessage }, { status: isForbidden ? 403 : 500 });
  }
}

async function ensureAllSongsSetlist(bandId: string): Promise<string> {
  const supabase = await createClient();
  
  // Check if "All Songs" already exists - use name check as fallback for backward compatibility
  const { data: existing } = await supabase
    .from('setlists')
    .select('id')
    .eq('band_id', bandId)
    .eq('name', 'All Songs')
    .single();
    
  if (existing) {
    return existing.id;
  }
  
  // Create "All Songs" setlist - only include setlist_type if column exists
  let insertData: any = {
    band_id: bandId,
    name: 'All Songs',
    total_duration: 0,
  };
  
  // Check if setlist_type column exists by trying to query it
  const { error: columnCheckError } = await supabase
    .from('setlists')
    .select('setlist_type')
    .limit(1);
    
  if (!columnCheckError) {
    // Column exists, safe to use setlist_type
    insertData.setlist_type = 'all_songs';
  }
  
  const { data: newSetlist, error } = await supabase
    .from('setlists')
    .insert(insertData)
    .select()
    .single();
    
  if (error) {
    console.error('Error creating All Songs setlist:', error);
    throw new Error('Failed to create All Songs setlist');
  }
  
  // Backfill with existing songs from other setlists
  const { data: existingSongs } = await supabase
    .from('setlist_songs')
    .select(`
      song_id,
      duration_seconds,
      bpm,
      tuning,
      songs!inner(title, artist)
    `)
    .in('setlist_id', 
      await supabase
        .from('setlists')
        .select('id')
        .eq('band_id', bandId)
        .neq('name', 'All Songs') // Use name check instead of setlist_type for backward compatibility
        .then(result => result.data?.map(s => s.id) || [])
    );
    
  if (existingSongs && existingSongs.length > 0) {
    // Get unique songs and add them to "All Songs"
    const uniqueSongs = existingSongs.reduce((acc: any[], song) => {
      if (!acc.find(s => s.song_id === song.song_id)) {
        acc.push(song);
      }
      return acc;
    }, []);
    
    const songsToInsert = uniqueSongs.map((song, index) => ({
      setlist_id: newSetlist.id,
      song_id: song.song_id,
      position: index + 1,
      duration_seconds: song.duration_seconds,
      bpm: song.bpm,
      tuning: song.tuning || 'standard'
    }));
    
    await supabase
      .from('setlist_songs')
      .insert(songsToInsert);
  }
  
  return newSetlist.id;
}

function isAllSongsVariant(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[^a-z]/g, '');
  const variants = ['allsongs', 'all_songs', 'allsong'];
  return variants.includes(normalized);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { band_id, name } = body;

    if (!band_id || !name) {
      return NextResponse.json({ error: 'Band ID and name are required' }, { status: 400 });
    }

    // Prevent creating setlists with "All Songs" variants
    if (isAllSongsVariant(name)) {
      return NextResponse.json({ 
        error: 'The name "All Songs" is reserved. Please choose a different name for your setlist.' 
      }, { status: 400 });
    }

    // Verify user is a member of this band
    await requireBandMembership(band_id);

    // Ensure "All Songs" exists for this band
    await ensureAllSongsSetlist(band_id);

    // Prepare insert data - only include setlist_type if column exists
    let insertData: any = {
      band_id,
      name,
      total_duration: 0,
    };
    
    // Check if setlist_type column exists by trying to query it
    const { error: columnCheckError } = await supabase
      .from('setlists')
      .select('setlist_type')
      .limit(1);
      
    if (!columnCheckError) {
      // Column exists, safe to use setlist_type
      insertData.setlist_type = 'regular';
    }

    const { data: setlist, error } = await supabase
      .from('setlists')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating setlist:', error);
      return NextResponse.json({ error: 'Failed to create setlist' }, { status: 500 });
    }

    return NextResponse.json({ setlist });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isForbidden = errorMessage.includes('Forbidden') || errorMessage.includes('not a member');
    console.error('Error in setlist creation:', error);
    return NextResponse.json({ error: errorMessage }, { status: isForbidden ? 403 : 500 });
  }
}
