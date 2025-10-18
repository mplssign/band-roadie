import { NextResponse } from 'next/server';
import { z } from 'zod';
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
  const jar = cookies();
  const supa = createServerClient(env.url, env.anon, {
    cookies: {
      get(name) { return jar.get(name)?.value; },
      set(name, value, options) { jar.set({ name, value, ...options }); },
      remove(name, options) { jar.delete({ name, ...options }); },
    },
  });
  const { data: { user } } = await supa.auth.getUser();
  return user ?? null;
}

async function requireMember(bandId: string, userId: string) {
  const a = admin();
  const { data } = await a
    .from('band_members')
    .select('role')
    .eq('band_id', bandId)
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

const PatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  image_url: z.string().url().nullable().optional(),
  avatar_color: z.string().min(1).max(50).nullable().optional(),
});

export async function GET(_: Request, { params }: { params: { bandId: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const mem = await requireMember(params.bandId, user.id);
  if (!mem) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const a = admin();
  
  // Get band members
  const { data: bandMembers, error: membersError } = await a
    .from('band_members')
    .select(`
      user_id,
      role,
      joined_at
    `)
    .eq('band_id', params.bandId);

  if (membersError) {
    console.error('Error fetching members:', membersError);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }

  // Get profiles for these users
  const userIds = bandMembers?.map(m => m.user_id) || [];
  const { data: users, error: usersError } = await a
    .from('users')
    .select('id, email, first_name, last_name, phone, address, city, zip, birthday, roles, profile_completed')
    .in('id', userIds);

  if (usersError) {
    console.error('Error fetching users:', usersError);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }

  // Combine the data
  const members = bandMembers?.map(member => ({
    ...member,
    user: users?.find(u => u.id === member.user_id) || null
  })) || [];

  // Get pending invites
  const { data: invites, error: invitesError } = await a
    .from('band_invitations')
    .select('id, email, status, created_at, expires_at')
    .eq('band_id', params.bandId)
    .eq('status', 'pending');

  if (invitesError) {
    console.error('Error fetching invites:', invitesError);
    return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 });
  }

  return NextResponse.json({ 
    members: members || [], 
    invites: invites || [] 
  });
}

export async function PATCH(req: Request, { params }: { params: { bandId: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = PatchSchema.parse(await req.json());

  // must be admin member or creator
  const a = admin();

  const { data: bandMember } = await a
    .from('band_members')
    .select('role')
    .eq('band_id', params.bandId)
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: bandRow } = await a
    .from('bands')
    .select('created_by')
    .eq('id', params.bandId)
    .maybeSingle();

  const isCreator = !!bandRow?.created_by && bandRow.created_by === user.id;
  const isAdmin = !!bandMember?.role && bandMember.role === 'admin';

  if (!isCreator && !isAdmin) {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  }

  const { error } = await a
    .from('bands')
    .update({
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.image_url !== undefined ? { image_url: payload.image_url } : {}),
      ...(payload.avatar_color !== undefined ? { avatar_color: payload.avatar_color } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.bandId);

  if (error) {
    return NextResponse.json({ error: 'Failed to update band' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}