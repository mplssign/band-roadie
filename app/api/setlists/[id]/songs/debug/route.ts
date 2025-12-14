import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log('[Debug] Request received for setlist:', params.id);
    
    const body = await request.json();
    console.log('[Debug] Request body:', JSON.stringify(body, null, 2));
    
    // Test basic database connection
    const supabase = createClient();
    const { data: testQuery, error: testError } = await supabase
      .from('setlists')
      .select('id, name, band_id')
      .eq('id', params.id)
      .single();
    
    console.log('[Debug] Test query result:', { testQuery, testError });
    
    // Also check what band the user is currently in from the request
    const cookies = request.headers.get('cookie') || '';
    console.log('[Debug] Cookies present:', cookies.includes('br_current_band_id'));
    
    // Check the setlist songs to understand the data structure
    const { data: songsQuery, error: songsError } = await supabase
      .from('setlist_songs')
      .select('id, setlist_id, setlists!inner(band_id)')
      .eq('setlist_id', params.id)
      .limit(1);
    
    console.log('[Debug] Songs query result:', { songsQuery, songsError });
    
    return NextResponse.json({
      success: true,
      setlistId: params.id,
      body: body,
      testQuery: testQuery,
      testError: testError?.message,
      songsQuery: songsQuery,
      songsError: songsError?.message,
      cookies: cookies.includes('br_current_band_id') ? 'current_band_cookie_present' : 'no_current_band_cookie',
    });
  } catch (error) {
    console.error('[Debug] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      setlistId: params.id,
    }, { status: 500 });
  }
}