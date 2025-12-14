import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get band ID from query params
    const url = new URL(request.url);
    const bandId = url.searchParams.get('bandId');
    
    if (!bandId) {
      return NextResponse.json({ error: 'Band ID required' }, { status: 400 });
    }

    // Verify user is a member of this band
    const { data: membership } = await supabase
      .from('band_members')
      .select('id')
      .eq('band_id', bandId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get next rehearsal
    const { data: nextRehearsal } = await supabase
      .from('rehearsals')
      .select('*')
      .eq('band_id', bandId)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(1)
      .single();

    // Get upcoming gigs (non-potential)
    const { data: upcomingGigs } = await supabase
      .from('gigs')
      .select('*')
      .eq('band_id', bandId)
      .eq('is_potential', false)
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true })
      .limit(5);

    // Get potential gig with response counts
    const { data: potentialGigs } = await supabase
      .from('gigs')
      .select(`
        *,
        gig_member_responses(
          response,
          band_members(
            id,
            user_id
          )
        )
      `)
      .eq('band_id', bandId)
      .eq('is_potential', true)
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true })
      .limit(1);

    // Get all band members for potential gig calculations
    const { data: allMembers } = await supabase
      .from('band_members')
      .select('id, user_id')
      .eq('band_id', bandId)
      .eq('is_active', true);

    // Process potential gig data
    let potentialGig: {
      id: string;
      name: string;
      date: string;
      time: string;
      location: string;
      yesCount: number;
      noCount: number;
      noReplyCount: number;
    } | null = null;
    
    if (potentialGigs && potentialGigs.length > 0) {
      const gig = potentialGigs[0];
      const responses = gig.gig_member_responses || [];
      
      const yesCount = responses.filter((r: { response: string }) => r.response === 'yes').length;
      const noCount = responses.filter((r: { response: string }) => r.response === 'no').length;
      const totalMembers = allMembers?.length || 0;
      const noReplyCount = Math.max(0, totalMembers - responses.length);

      potentialGig = {
        id: gig.id,
        name: gig.name,
        date: new Date(gig.date).toLocaleDateString(),
        time: gig.start_time || 'TBD',
        location: gig.venue || gig.location || 'TBD',
        yesCount,
        noCount,
        noReplyCount,
      };
    }

    // Format response data
    const dashboardData = {
      nextRehearsal: nextRehearsal ? {
        id: nextRehearsal.id,
        date: new Date(nextRehearsal.start_time).toLocaleDateString(),
        time: new Date(nextRehearsal.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        location: nextRehearsal.location || 'TBD',
      } : null,
      upcomingGigs: (upcomingGigs || []).map(gig => ({
        id: gig.id,
        name: gig.name,
        date: new Date(gig.date).toLocaleDateString(),
        time: gig.start_time || 'TBD',
        location: gig.venue || gig.location || 'TBD',
        setlist: gig.setlist_name || undefined,
      })),
      potentialGig,
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('[api/dashboard] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}