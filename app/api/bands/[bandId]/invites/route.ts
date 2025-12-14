import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
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

async function getUser() {
  const cookieStore = cookies();
  const supabase = createServerClient(env.url, env.anon, {
    cookies: {
      get(name) { return cookieStore.get(name)?.value; },
      set(name, value, options) { cookieStore.set({ name, value, ...options }); },
      remove(name, options) { cookieStore.delete({ name, ...options }); },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

const payloadSchema = z.object({
  emails: z.array(z.string().email()).min(1, 'At least one email is required'),
});

export async function POST(req: Request, { params }: { params: { bandId: string } }) {
  try {
    const user = await getUser();
    const admin = adminClient();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    const { data: membership } = await admin
      .from('band_members')
      .select('role')
      .eq('band_id', params.bandId)
      .eq('user_id', userId)
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

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(
        `[API /api/bands/${params.bandId}/invites] POST request from user ${userId} for ${emails.length} email(s)`,
      );
    }

    const { data: bandRow, error: bandError } = await admin
      .from('bands')
      .select('name')
      .eq('id', params.bandId)
      .single();

    if (bandError || !bandRow) {
      return NextResponse.json({ error: 'Band not found' }, { status: 404 });
    }

    const { data: userProfile } = await admin
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', userId)
      .single();

    const inviterName =
      userProfile?.first_name && userProfile?.last_name
        ? `${userProfile.first_name} ${userProfile.last_name}`
        : userProfile?.email || user.email || 'A band member';

    const { failedInvites, sentCount } = await sendBandInvites({
      supabase: admin,
      bandId: params.bandId,
      bandName: bandRow.name,
      inviterId: userId,
      inviterName,
      emails,
    });

    if (failedInvites.length > 0) {
      console.error(
        `[API /api/bands/${params.bandId}/invites] ${failedInvites.length} invite(s) failed:`,
        failedInvites,
      );
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

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(
        `[API /api/bands/${params.bandId}/invites] Successfully sent ${sentCount} invite(s)`,
      );
    }

    return NextResponse.json({ ok: true, invitesSent: sentCount });
  } catch (error) {
    console.error(`[API /api/bands/${params.bandId}/invites] Unhandled error:`, error);
    return NextResponse.json(
      {
        error: 'Failed to process invitations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

const deleteSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export async function DELETE(req: Request, { params }: { params: { bandId: string } }) {
  const user = await getUser();
  const admin = adminClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;

  const { data: membership } = await admin
    .from('band_members')
    .select('role')
    .eq('band_id', params.bandId)
    .eq('user_id', userId)
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
