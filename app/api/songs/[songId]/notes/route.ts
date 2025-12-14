import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY!,
};

function admin() {
  return createAdminClient(env.url, env.service, { auth: { persistSession: false } });
}

async function getUser() {
  const jar = await cookies();
  const supa = createServerClient(env.url, env.anon, {
    cookies: {
      get(name) {
        return jar.get(name)?.value;
      },
      set(name, value, options) {
        jar.set({ name, value, ...options });
      },
      remove(name, options) {
        jar.delete({ name, ...options });
      },
    },
  });
  const {
    data: { user },
  } = await supa.auth.getUser();
  return user ?? null;
}

async function requireBandMember(bandId: string, userId: string) {
  const a = admin();
  const { data } = await a
    .from('band_members')
    .select('role')
    .eq('band_id', bandId)
    .eq('user_id', userId)
    .maybeSingle();
    
  return data ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: { songId: string } }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const bandId = url.searchParams.get('band_id');
    
    if (!bandId) {
      return NextResponse.json({ error: 'Band ID is required' }, { status: 400 });
    }

    // Verify user is a member of the band
    const membership = await requireBandMember(bandId, user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const a = admin();

    // Get song notes for this band
    const { data: notes, error: notesError } = await a
      .from('song_notes')
      .select(`
        id,
        song_id,
        band_id,
        content,
        created_at,
        updated_at,
        created_by,
        users:created_by (
          first_name,
          last_name
        )
      `)
      .eq('song_id', params.songId)
      .eq('band_id', bandId)
      .order('created_at', { ascending: false });

    if (notesError) {
      console.error('Error fetching song notes:', notesError);
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }

    return NextResponse.json({ notes: notes || [] });
    
  } catch (error) {
    console.error('Error fetching song notes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { songId: string } }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, band_id } = await request.json();
    
    if (!band_id) {
      return NextResponse.json({ error: 'Band ID is required' }, { status: 400 });
    }

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Note content is required' }, { status: 400 });
    }

    // Verify user is a member of the band
    const membership = await requireBandMember(band_id, user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const a = admin();

    // Create the note
    const { data: note, error: noteError } = await a
      .from('song_notes')
      .insert({
        song_id: params.songId,
        band_id,
        content: content.trim(),
        created_by: user.id,
      })
      .select(`
        id,
        song_id,
        band_id,
        content,
        created_at,
        updated_at,
        created_by,
        users:created_by (
          first_name,
          last_name
        )
      `)
      .single();

    if (noteError) {
      console.error('Error creating song note:', noteError);
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    return NextResponse.json({ note });
    
  } catch (error) {
    console.error('Error creating song note:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}