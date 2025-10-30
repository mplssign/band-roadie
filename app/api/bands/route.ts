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
export async function GET(req: NextRequest): Promise<NextResponse> {
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
    // Get band memberships (feature-detect the optional is_active column)
    let supportsIsActive = true;
    let memberships: Array<Record<string, any>> | null = null;
    let membershipError: any = null;

    const membershipsResult = await supabase
      .from('band_members')
      .select('id, band_id, role, is_active')
      .eq('user_id', userId);

    memberships = membershipsResult.data;
    membershipError = membershipsResult.error;

    if (membershipError?.code === '42703') {
      supportsIsActive = false;
      const fallbackResult = await supabase
        .from('band_members')
        .select('id, band_id, role')
        .eq('user_id', userId);

      memberships = fallbackResult.data;
      membershipError = fallbackResult.error;
    }

    if (membershipError) {
      console.error('[api/bands] Error fetching memberships:', membershipError);
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }

    if (!memberships || memberships.length === 0) {
      console.log('[api/bands] No memberships found for user:', userId);
      return NextResponse.json({ bands: [] }, { status: 200 });
    }

    console.log('[api/bands] Memberships fetched:', memberships.length, {
      userId,
    });

    let activeMemberships = memberships ?? [];

    if (supportsIsActive) {
      const inactiveMemberships = (memberships || []).filter(
        (membership: { is_active?: boolean | null }) => membership.is_active === false,
      );

      if (inactiveMemberships.length > 0) {
        const inactiveIds = inactiveMemberships.map((membership: { id: string }) => membership.id);
        console.log('[api/bands] Reactivating inactive memberships for user:', {
          userId,
          inactiveIds,
        });

        const { error: reactivateError } = await supabase
          .from('band_members')
          .update({ is_active: true })
          .in('id', inactiveIds);

        if (reactivateError) {
          console.error('[api/bands] Failed to reactivate memberships:', reactivateError);
        } else {
          for (const membership of inactiveMemberships) {
            (membership as { is_active?: boolean | null }).is_active = true;
          }
        }
      }

      activeMemberships = (memberships || []).filter(
        (membership: { is_active?: boolean | null }) => membership.is_active !== false,
      );

      if (activeMemberships.length === 0) {
        console.warn(
          '[api/bands] No active memberships after reactivation attempt, falling back:',
          {
            userId,
            membershipCount: memberships.length,
          },
        );
        activeMemberships = memberships;
      }
    }

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

    console.log('[api/bands] Returning bands:', bands?.length || 0, 'bands');
    return NextResponse.json({ bands: bands || [] }, { status: 200 });
  } catch (error) {
    console.error('[api/bands] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
