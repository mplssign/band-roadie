import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { sendBandInvites } from '@/lib/server/send-band-invites';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY!,
};

const adminClient = () =>
  createAdminClient(env.url, env.service, {
    auth: { persistSession: false },
  });

const payloadSchema = z.object({
  emails: z.array(z.string().email()).min(1, 'At least one email is required'),
});

export async function POST(req: Request, { params }: { params: { bandId: string } }) {
  const supabase = createClient();
  const admin = adminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: membership } = await admin
    .from('band_members')
    .select('role')
    .eq('band_id', params.bandId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.errors.map((err) => err.message).join(', ');
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { emails } = parsed.data;

  const { data: bandRow, error: bandError } = await admin
    .from('bands')
    .select('name')
    .eq('id', params.bandId)
    .single();

  if (bandError || !bandRow) {
    return NextResponse.json({ error: 'Band not found' }, { status: 404 });
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('first_name, last_name, email')
    .eq('id', user.id)
    .single();

  const inviterName =
    userProfile?.first_name && userProfile?.last_name
      ? `${userProfile.first_name} ${userProfile.last_name}`
      : userProfile?.email || user.email || 'A band member';

  const { failedInvites, sentCount } = await sendBandInvites({
    supabase,
    bandId: params.bandId,
    bandName: bandRow.name,
    inviterId: user.id,
    inviterName,
    emails,
  });

  if (failedInvites.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        invitesSent: sentCount,
        failedInvites,
        error: 'Some invites could not be delivered',
      },
      { status: 207 },
    );
  }

  return NextResponse.json({ ok: true, invitesSent: sentCount });
}

const deleteSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export async function DELETE(req: Request, { params }: { params: { bandId: string } }) {
  const supabase = createClient();
  const admin = adminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: membership } = await admin
    .from('band_members')
    .select('role')
    .eq('band_id', params.bandId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.errors.map((err) => err.message).join(', ');
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { email } = parsed.data;

  const { error } = await admin
    .from('band_invitations')
    .delete()
    .eq('band_id', params.bandId)
    .eq('email', email.toLowerCase());

  if (error) {
    return NextResponse.json({ error: 'Failed to remove invitation' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
