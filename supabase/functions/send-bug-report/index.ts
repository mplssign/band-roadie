// supabase/functions/send-bug-report/index.ts
// Edge function to send bug reports via Resend (no email client needed)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RECIPIENT_EMAIL = "tonycraig@gmail.com";

Deno.serve(async (req) => {
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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      type,
      description,
      screenName,
      bandId,
      userId,
      platform,
      osVersion,
      appVersion,
      buildNumber,
    } = body;

    if (!description || description.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Description is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!RESEND_API_KEY) {
      console.error("[send-bug-report] RESEND_API_KEY not set");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build subject line
    const reportType = type === "bug" ? "Bug Report" : "Feature Request";
    const screen = screenName || "Report Bugs";
    const platformName = platform || "Unknown";
    const subject = `BandRoadie ${reportType} — ${screen} — ${platformName}`;

    // Build email body
    const timestamp = new Date().toISOString();
    const emailBody = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #f43f5e;">🎸 BandRoadie ${reportType}</h2>
  
  <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
    <h3 style="margin-top: 0; color: #333;">Description</h3>
    <p style="white-space: pre-wrap; color: #333;">${escapeHtml(description)}</p>
  </div>
  
  <div style="background: #e9ecef; padding: 16px; border-radius: 8px;">
    <h3 style="margin-top: 0; color: #666; font-size: 14px;">Diagnostic Info</h3>
    <table style="width: 100%; font-size: 13px; color: #666;">
      <tr><td style="padding: 4px 8px 4px 0; font-weight: 600;">Type:</td><td>${reportType}</td></tr>
      <tr><td style="padding: 4px 8px 4px 0; font-weight: 600;">Screen:</td><td>${escapeHtml(screen)}</td></tr>
      <tr><td style="padding: 4px 8px 4px 0; font-weight: 600;">Band ID:</td><td>${bandId || "none"}</td></tr>
      <tr><td style="padding: 4px 8px 4px 0; font-weight: 600;">User ID:</td><td>${userId || "not signed in"}</td></tr>
      <tr><td style="padding: 4px 8px 4px 0; font-weight: 600;">Platform:</td><td>${platformName}</td></tr>
      <tr><td style="padding: 4px 8px 4px 0; font-weight: 600;">OS Version:</td><td>${osVersion || "unknown"}</td></tr>
      <tr><td style="padding: 4px 8px 4px 0; font-weight: 600;">App Version:</td><td>${appVersion || "unknown"} (${buildNumber || "?"})</td></tr>
      <tr><td style="padding: 4px 8px 4px 0; font-weight: 600;">Timestamp:</td><td>${timestamp}</td></tr>
    </table>
  </div>
</div>
`;

    // Plain text version
    const textBody = `
BandRoadie ${reportType}

DESCRIPTION:
${description}

--- Diagnostic Info ---
Type: ${reportType}
Screen: ${screen}
Band ID: ${bandId || "none"}
User ID: ${userId || "not signed in"}
Platform: ${platformName}
OS Version: ${osVersion || "unknown"}
App Version: ${appVersion || "unknown"} (${buildNumber || "?"})
Timestamp: ${timestamp}
`;

    // Send via Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "BandRoadie <noreply@bandroadie.com>",
        to: [RECIPIENT_EMAIL],
        reply_to: userId ? undefined : undefined, // Could add user email if available
        subject: subject,
        html: emailBody,
        text: textBody,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("[send-bug-report] Resend API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const resendData = await resendResponse.json();
    console.log("[send-bug-report] Email sent successfully:", resendData.id);

    return new Response(
      JSON.stringify({ ok: true, emailId: resendData.id }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("[send-bug-report] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
