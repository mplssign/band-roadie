// Supabase Edge Function: send-band-invite
// Sends band invitation emails via Resend
//
// Required secrets:
//   supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
//
// Optional environment variables:
//   PUBLIC_APP_URL - defaults to https://bandroadie.com

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const PUBLIC_APP_URL = Deno.env.get("PUBLIC_APP_URL") || "https://bandroadie.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface InviteRequest {
  bandInvitationId: string;
}

interface InviteRow {
  id: string;
  band_id: string;
  email: string;
  invited_by: string;
  status: string;
  token: string;
  created_at: string;
  expires_at: string;
}

interface BandRow {
  id: string;
  name: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    // Validate API key
    if (!RESEND_API_KEY) {
      console.error("[send-band-invite] RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ ok: false, error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: InviteRequest = await req.json();
    const { bandInvitationId } = body;

    if (!bandInvitationId) {
      return new Response(
        JSON.stringify({ ok: false, error: "bandInvitationId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-band-invite] Processing invitation id=${bandInvitationId}`);

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("band_invitations")
      .select("*")
      .eq("id", bandInvitationId)
      .single();

    if (inviteError || !invitation) {
      console.error(`[send-band-invite] Invitation not found: ${inviteError?.message}`);
      return new Response(
        JSON.stringify({ ok: false, error: "Invitation not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const invite = invitation as InviteRow;

    // Validate status
    if (invite.status !== "pending") {
      console.log(`[send-band-invite] Invitation status is '${invite.status}', skipping`);
      return new Response(
        JSON.stringify({ ok: false, error: `Invitation status is '${invite.status}', not pending` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch band name
    const { data: band, error: bandError } = await supabase
      .from("bands")
      .select("id, name")
      .eq("id", invite.band_id)
      .single();

    if (bandError || !band) {
      console.error(`[send-band-invite] Band not found: ${bandError?.message}`);
      return new Response(
        JSON.stringify({ ok: false, error: "Band not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const bandData = band as BandRow;
    const bandName = bandData.name;

    // Build invite links
    const deepLink = `bandroadie://invite?token=${invite.token}`;
    const webLink = `${PUBLIC_APP_URL}/invite?token=${invite.token}`;

    // Format expiration date
    const expiresAt = new Date(invite.expires_at);
    const expiresFormatted = expiresAt.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Join ${bandName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #1a1a1a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #2a2a2a; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">
                🎸 You're Invited!
              </h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 0 32px 32px;">
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.5; color: #b3b3b3; text-align: center;">
                You've been invited to join <strong style="color: #ffffff;">${bandName}</strong> on BandRoadie.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="${deepLink}" style="display: inline-block; padding: 16px 48px; background-color: #f43f5e; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 12px;">
                      Join Band
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; font-size: 14px; line-height: 1.5; color: #808080; text-align: center;">
                Button not working? Copy and paste this link:<br>
                <a href="${webLink}" style="color: #f43f5e; text-decoration: underline;">${webLink}</a>
              </p>
              
              <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.5; color: #666666; text-align: center;">
                This invitation expires on ${expiresFormatted}.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #222222; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #666666;">
                Sent by BandRoadie · <a href="${PUBLIC_APP_URL}" style="color: #808080;">bandroadie.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    // Send email via Resend
    console.log(`[send-band-invite] Sending email to ${invite.email} for band "${bandName}"`);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "BandRoadie <invites@bandroadie.com>",
        to: [invite.email],
        subject: `You're invited to join ${bandName} on BandRoadie`,
        html: emailHtml,
      }),
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error(`[send-band-invite] Resend error: ${JSON.stringify(resendResult)}`);
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to send email", details: resendResult }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-band-invite] Email sent successfully, resend id=${resendResult.id}`);

    // Update invitation status to 'sent'
    const { error: updateError } = await supabase
      .from("band_invitations")
      .update({ status: "sent" })
      .eq("id", bandInvitationId);

    if (updateError) {
      console.error(`[send-band-invite] Failed to update status: ${updateError.message}`);
      // Email was sent, so we return success but log the issue
    }

    console.log(`[send-band-invite] Completed successfully for invitation id=${bandInvitationId}`);

    return new Response(
      JSON.stringify({ ok: true, emailId: resendResult.id }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[send-band-invite] Unexpected error: ${error}`);
    return new Response(
      JSON.stringify({ ok: false, error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
