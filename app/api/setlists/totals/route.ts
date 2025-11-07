import { NextRequest, NextResponse } from 'next/server';
import { requireBandMembership } from '@/lib/server/band-scope';
import { getSetlistsWithTotals } from '@/lib/supabase/setlist-totals';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bandId = searchParams.get('band_id');

  if (!bandId) {
    return NextResponse.json({ error: 'Band ID is required' }, { status: 400 });
  }

  try {
    // Verify user is a member of this band
    await requireBandMembership(bandId);

    // Get setlists with correctly calculated totals
    const setlists = await getSetlistsWithTotals(bandId);

    return NextResponse.json({ 
      setlists,
      message: `Found ${setlists.length} setlists with recalculated durations` 
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isForbidden = errorMessage.includes('Forbidden') || errorMessage.includes('not a member');
    console.error('Error in setlists totals API:', error);
    return NextResponse.json({ error: errorMessage }, { status: isForbidden ? 403 : 500 });
  }
}