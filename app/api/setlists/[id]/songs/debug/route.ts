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
    
    return NextResponse.json({
      success: true,
      setlistId: params.id,
      body: body,
      testQuery: testQuery,
      testError: testError?.message,
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