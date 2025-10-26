import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { APP_URL } from '@/lib/constants';
import { sendEmail } from '@/lib/email/client';
import { getInviteEmailHtml } from '@/lib/email/templates/invite';
import { getBandMemberAddedEmailHtml } from '@/lib/email/templates/member-added';

/**
 * Band Invitation Flow:
 * 1. Check if user exists by email (line ~39)
 * 2. If exists and not a member: add to band_members, send "added" email (lines ~79-95)
 * 3. If doesn't exist: create/update band_invitations row (lines ~148-187)
 * 4. Generate magic link with Supabase admin API (lines ~211-232) or fallback to /invite/:id
 * 5. Send invite email via Resend (lines ~235-240)
 * 6. Mark invitation as 'sent' or 'error' in DB (lines ~242-264)
 */

type SendBandInvitesParams = {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  supabase: SupabaseClient<any>;
  bandId: string;
  bandName: string;
  inviterId: string;
  inviterName: string;
  emails: string[];
};

export type FailedInvite = { email: string; error: string };

export async function sendBandInvites({
  supabase,
  bandId,
  bandName,
  inviterId,
  inviterName,
  emails,
}: SendBandInvitesParams): Promise<{ failedInvites: FailedInvite[]; sentCount: number }> {
  const failedInvites: FailedInvite[] = [];
  let sentCount = 0;

  const uniqueEmails = Array.from(new Set(emails));

  for (const rawEmail of uniqueEmails) {
    const normalizedEmail = rawEmail.trim().toLowerCase();
    if (!normalizedEmail) continue;

    // Log: Starting invite process
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[invite.create] Starting invite for ${normalizedEmail} to band ${bandId}`);
    }

    // Check if this user already exists
    const { data: existingUserRows, error: existingUserError } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1);

    if (existingUserError) {
      const reason = existingUserError.message || 'Failed to look up user';
      console.error(`Failed to look up user for ${normalizedEmail}:`, existingUserError);
      failedInvites.push({ email: normalizedEmail, error: reason });
      continue;
    }

    const existingUser = Array.isArray(existingUserRows) ? existingUserRows[0] : null;

    if (existingUser?.id) {
      const { data: membershipRows, error: membershipError } = await supabase
        .from('band_members')
        .select('id')
        .eq('band_id', bandId)
        .eq('user_id', existingUser.id)
        .limit(1);

      if (membershipError) {
        const reason = membershipError.message || 'Failed to check membership';
        console.error(
          `Failed to check membership for ${normalizedEmail} in band ${bandId}:`,
          membershipError,
        );
        failedInvites.push({ email: normalizedEmail, error: reason });
        continue;
      }

      if (Array.isArray(membershipRows) && membershipRows.length > 0) {
        // Already a member — nothing to send
        continue;
      }

      const { error: addMemberError } = await supabase.from('band_members').insert({
        band_id: bandId,
        user_id: existingUser.id,
        role: 'member',
      });

      if (addMemberError) {
        const reason = addMemberError.message || 'Failed to add member to band';
        console.error(
          `Failed to add ${normalizedEmail} as member to band ${bandId}:`,
          addMemberError,
        );
        failedInvites.push({ email: normalizedEmail, error: reason });
        continue;
      }

      const emailHtml = getBandMemberAddedEmailHtml(bandName, inviterName, bandId);
      const result = await sendEmail({
        to: normalizedEmail,
        subject: `${inviterName} added you to ${bandName} on Band Roadie`,
        html: emailHtml,
      });

      if (!result.success) {
        const reason =
          result.error instanceof Error
            ? result.error.message
            : typeof result.error === 'string'
              ? result.error
              : 'Failed to send band notification';

        console.error(
          `[invite.send] ERROR sending added-member email to ${normalizedEmail}:`,
          result.error,
        );
        failedInvites.push({ email: normalizedEmail, error: reason });
        continue;
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[invite.send] SUCCESS sent added-member email to ${normalizedEmail}`);
      }
      sentCount += 1;
      continue;
    }

    const { data: invitationRows, error: inviteLookupError } = await supabase
      .from('band_invitations')
      .select('id, status')
      .eq('band_id', bandId)
      .eq('email', normalizedEmail)
      .order('created_at', { ascending: false })
      .limit(1);

    if (inviteLookupError) {
      const reason = inviteLookupError.message || 'Failed to look up invitation';
      console.error(
        `Failed to look up invitation for ${normalizedEmail} in band ${bandId}:`,
        inviteLookupError,
      );
      failedInvites.push({ email: normalizedEmail, error: reason });
      continue;
    }

    let invitation = Array.isArray(invitationRows) ? invitationRows[0] : null;

    if (invitation?.status === 'accepted') {
      // Invitation already accepted; member should already be in the band
      continue;
    }

    if (!invitation) {
      const { data: newInvitation, error: invitationError } = await supabase
        .from('band_invitations')
        .insert({
          band_id: bandId,
          email: normalizedEmail,
          invited_by: inviterId,
          status: 'pending',
        })
        .select()
        .single();

      if (invitationError || !newInvitation) {
        const reason = invitationError?.message || 'Failed to create invitation record';
        console.error(
          `Failed to create invitation for ${normalizedEmail} in band ${bandId}:`,
          invitationError,
        );
        failedInvites.push({ email: normalizedEmail, error: reason });
        continue;
      }

      invitation = newInvitation;
    } else if (invitation.status !== 'pending') {
      const { data: updatedInvitation, error: statusResetError } = await supabase
        .from('band_invitations')
        .update({ status: 'pending' })
        .eq('id', invitation.id)
        .select()
        .single();

      if (statusResetError || !updatedInvitation) {
        const reason = statusResetError?.message || 'Failed to reset invitation status';
        console.error(
          `Failed to reset invitation ${invitation.id} for ${normalizedEmail}:`,
          statusResetError,
        );
        failedInvites.push({ email: normalizedEmail, error: reason });
        continue;
      }

      invitation = updatedInvitation;
    }

    if (!invitation || !invitation.id) {
      const reason = 'Invalid invitation record';
      console.error(`[invite.create] ERROR invalid invitation for ${normalizedEmail}`);
      failedInvites.push({ email: normalizedEmail, error: reason });
      continue;
    }

    // Log: Invitation created with ID
    const tokenPreview = invitation.id.substring(0, 8); // First 8 chars of UUID
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[invite.create] Created invitation ${tokenPreview}... for ${normalizedEmail}`);
    }

    // Build a CTA URL. For users that don't exist yet we prefer to generate
    // a Supabase magic link (server-side) that will sign them in and redirect
    // back to the app with the invitation id preserved. Fall back to the
    // standard /invite/:id URL if that generation fails.
    let ctaUrl = `${APP_URL}/invite/${invitation.id}`;

    try {
      // Attempt to use the service role key to generate a magic link via the
      // admin client. This requires SUPABASE_SERVICE_ROLE_KEY to be set in
      // the environment where this runs.
      if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const admin = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          {
            auth: { persistSession: false },
          },
        );

        // generate_link endpoint supports redirect_to which will be encoded
        // into the generated action_link. We pass a redirect that includes
        // the invitation id so the callback can accept the invite.
        const redirectTo = `${APP_URL}/auth/callback?invitation=${invitation.id}`;

        // The admin API exposes auth.admin.generateLink for generating magic links.
        // Use the admin client to generate a sign-in link for the email.
        // NOTE: types from supabase may vary; use any to avoid TS errors here.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: genData, error: genError } = await (admin as any).auth.admin.generateLink({
          type: 'magiclink',
          email: normalizedEmail,
          options: { redirectTo },
        });

        if (!genError && genData && genData.properties && genData.properties.action_link) {
          ctaUrl = genData.properties.action_link as string;
          if (process.env.NODE_ENV !== 'production') {
            console.log(
              `[invite.magiclink] Generated magic link for ${normalizedEmail}, redirect to invitation=${invitation.id}`,
            );
          }
        }
      }
    } catch (err) {
      // Non-fatal — we'll use the standard invite URL
      console.error('[invite.magiclink] ERROR generating magic link:', err);
    }

    // Log: Final CTA URL
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[invite.send] Sending email to ${normalizedEmail} with CTA: ${ctaUrl}`);
    }

    const emailHtml = getInviteEmailHtml(bandName, inviterName, ctaUrl);
    const result = await sendEmail({
      to: normalizedEmail,
      subject: `You're invited to join ${bandName} on Band Roadie`,
      html: emailHtml,
    });

    if (result.success) {
      const { error: statusError } = await supabase
        .from('band_invitations')
        .update({ status: 'sent' })
        .eq('id', invitation.id);

      if (statusError) {
        console.error('[invite.update] ERROR marking invitation as sent:', statusError);
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(
          `[invite.send] SUCCESS sent invite email to ${normalizedEmail}, marked as 'sent'`,
        );
      }
      sentCount += 1;
    } else {
      const reason =
        result.error instanceof Error
          ? result.error.message
          : typeof result.error === 'string'
            ? result.error
            : 'Unknown error sending invite';

      console.error(
        `[invite.send] ERROR sending invite email to ${normalizedEmail}:`,
        result.error,
      );

      const { error: statusError } = await supabase
        .from('band_invitations')
        .update({ status: 'error' })
        .eq('id', invitation.id);
      if (statusError) {
        console.error('[invite.update] ERROR marking invitation as errored:', statusError);
      }

      failedInvites.push({ email: normalizedEmail, error: reason });
    }
  }

  return { failedInvites, sentCount };
}
