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

    // Get song details
    const { data: song, error: songError } = await a
      .from('songs')
      .select('*')
      .eq('id', params.songId)
      .single();

    if (songError || !song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    return NextResponse.json({ song });
    
  } catch (error) {
    console.error('Error fetching song:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}