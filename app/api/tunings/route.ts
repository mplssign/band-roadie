import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

// User-confirmed tuning storage endpoint
export async function POST(request: NextRequest) {
  try {
    const { song_id, title, artist, confirmed_tuning, user_id, band_id } = await request.json();

    if (!song_id || !title || !artist || !confirmed_tuning) {
      return NextResponse.json(
        { error: 'Song ID, title, artist, and confirmed_tuning are required' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS for tuning confirmations
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseService = createServiceClient(supabaseUrl, serviceRoleKey);

    // Store the user-confirmed tuning
    const { data, error } = await supabaseService
      .from('song_tuning_confirmations')
      .upsert({
        song_id,
        title: title.toLowerCase(),
        artist: artist.toLowerCase(),
        confirmed_tuning,
        user_id,
        band_id,
        confirmed_at: new Date().toISOString()
      }, {
        onConflict: 'song_id,user_id,band_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing tuning confirmation:', error);
      return NextResponse.json(
        { error: 'Failed to store tuning confirmation' },
        { status: 500 }
      );
    }

    // console.log(`Stored tuning confirmation: "${title}" by ${artist} = ${confirmed_tuning}`);

    return NextResponse.json({ 
      success: true,
      confirmation: data
    });

  } catch (error) {
    console.error('Error in tuning confirmation API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get user-confirmed tunings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const song_id = searchParams.get('song_id');
    const title = searchParams.get('title');
    const artist = searchParams.get('artist');
    const user_id = searchParams.get('user_id');
    const band_id = searchParams.get('band_id');

    const supabase = createClient();

    let query = supabase
      .from('song_tuning_confirmations')
      .select('*');

    if (song_id) {
      query = query.eq('song_id', song_id);
    } else if (title && artist) {
      query = query
        .eq('title', title.toLowerCase())
        .eq('artist', artist.toLowerCase());
    }

    if (user_id) query = query.eq('user_id', user_id);
    if (band_id) query = query.eq('band_id', band_id);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tuning confirmations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tuning confirmations' },
        { status: 500 }
      );
    }

    return NextResponse.json({ confirmations: data || [] });

  } catch (error) {
    console.error('Error in tuning confirmations GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}