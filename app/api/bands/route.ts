import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Schema for creating a band
const createBandSchema = z.object({
  name: z.string().min(1, 'Band name is required'),
  inviteEmails: z.array(z.string().email()).optional().default([]),
});

export type CreateBandPayload = z.infer<typeof createBandSchema>;
export type CreateBandResponse = {
  ok: boolean;
  band: { id: string; name: string } | null;
  invitesCreated: number;
  error?: string;
};

// POST /api/bands — create a band
export async function POST(req: Request): Promise<NextResponse<CreateBandResponse>> {
  try {
    const body = (await req.json()) as unknown;
    const parsed = createBandSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      return NextResponse.json(
        { ok: false, band: null, invitesCreated: 0, error: message },
        { status: 400 },
      );
    }

    const { name, inviteEmails } = parsed.data;

    // TODO: Replace with real DB create
    const bandId = crypto.randomUUID();

    // If/when you wire this up to invitations, keep this count to avoid the
    // previous "unused variable" lint on inviteEmails.
    const invitesCreated = inviteEmails.length;

    return NextResponse.json(
      { ok: true, band: { id: bandId, name }, invitesCreated },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { ok: false, band: null, invitesCreated: 0, error: message },
      { status: 500 },
    );
  }
}

// GET /api/bands — fetch user's bands
export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Resolve the authenticated user via Supabase to ensure we have the right ID
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      console.error('[api/bands] Failed to resolve user from access token:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    // Get band memberships (is_active column doesn't exist in production)

    const membershipsResult = await supabase
      .from('band_members')
      .select('id, band_id, role')
      .eq('user_id', userId);

    const memberships = membershipsResult.data;
    const membershipError = membershipsResult.error;

    if (membershipError) {
      console.error('[api/bands] Error fetching memberships:', membershipError);
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }

    if (!memberships || memberships.length === 0) {
      // eslint-disable-next-line no-console
      console.log('[api/bands] No memberships found for user:', userId);
      return NextResponse.json({ bands: [] }, { status: 200 });
    }

    // eslint-disable-next-line no-console
    console.log('[api/bands] Memberships fetched:', memberships.length, {
      userId,
    });

    // Since is_active column doesn't exist, use all memberships
    const activeMemberships = memberships ?? [];

    // eslint-disable-next-line no-console
    console.log('[api/bands] Found memberships:', activeMemberships.length);

    // Get band details
    const bandIds = activeMemberships.map((membership) => membership.band_id);
    const { data: bands, error: bandsError } = await supabase
      .from('bands')
      .select('id, name, image_url, avatar_color')
      .in('id', bandIds);

    if (bandsError) {
      console.error('[api/bands] Error fetching bands:', bandsError);
      return NextResponse.json({ error: bandsError.message }, { status: 500 });
    }

    // eslint-disable-next-line no-console
    console.log('[api/bands] Returning bands:', bands?.length || 0, 'bands');
    return NextResponse.json({ bands: bands || [] }, { status: 200 });
  } catch (error) {
    console.error('[api/bands] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
