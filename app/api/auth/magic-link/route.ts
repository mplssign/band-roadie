import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Server-side magic link generator
 * Uses admin API to generate links without PKCE
 */
export async function POST(req: NextRequest) {
  try {
    // Temporarily disable SSL verification for development only
    if (process.env.NODE_ENV === 'development') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Use localhost for development, otherwise use the request origin
    const origin =
      process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : req.nextUrl.origin;

    console.log('[api/auth/magic-link] NODE_ENV:', process.env.NODE_ENV);
    console.log('[api/auth/magic-link] Origin:', origin);
    console.log('[api/auth/magic-link] Redirect will be:', `${origin}/auth/callback?next=/profile`);

    // Create admin client for generating magic links
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // Generate magic link using admin API (no PKCE)
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${origin}/auth/callback?next=/profile`,
      },
    });

    if (error) {
      console.error('[api/auth/magic-link] Error generating link:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data?.properties?.action_link) {
      console.error('[api/auth/magic-link] No action_link in response');
      return NextResponse.json({ error: 'No action link generated' }, { status: 500 });
    }

    const supabaseMagicLink = data.properties.action_link;

    console.log('[api/auth/magic-link] Supabase action_link:', supabaseMagicLink);

    // Parse the original Supabase URL to see what we got
    const supabaseUrl = new URL(supabaseMagicLink);
    console.log(
      '[api/auth/magic-link] Supabase redirect_to param:',
      supabaseUrl.searchParams.get('redirect_to'),
    );

    // Use the Supabase link as-is for the terminal test link
    const testLink = supabaseMagicLink;

    // For the email, construct our own link that goes directly to our callback
    // We'll use the token from Supabase's link
    const token = supabaseUrl.searchParams.get('token');
    const type = supabaseUrl.searchParams.get('type');

    if (!token || !type) {
      console.error('[api/auth/magic-link] Invalid action_link - missing token or type');
      return NextResponse.json({ error: 'Invalid magic link generated' }, { status: 500 });
    }

    // Build URL that goes directly to Supabase verify with our callback
    const emailLink = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?token=${token}&type=${type}&redirect_to=${encodeURIComponent(`${origin}/auth/callback?next=/profile`)}`;

    console.log('[api/auth/magic-link] Magic link generated for:', email);
    console.log('[api/auth/magic-link] 🔗 COPY THIS LINK TO TEST:', testLink);
    console.log('[api/auth/magic-link] 📧 Email will contain:', emailLink);
    console.log('[api/auth/magic-link] ⬆️  Click the link above or paste into browser ⬆️');

    // Send email using Resend
    try {
      console.log('[api/auth/magic-link] Attempting to send email via Resend...');
      console.log('[api/auth/magic-link] From:', 'Band Roadie <noreply@bandroadie.com>');
      console.log('[api/auth/magic-link] To:', email);
      console.log('[api/auth/magic-link] Subject:', 'Sign in to Band Roadie');
      console.log('[api/auth/magic-link] Link in email will be:', emailLink);

      const emailResult = await resend.emails.send({
        from: 'Band Roadie <noreply@bandroadie.com>',
        to: email,
        subject: 'Sign in to Band Roadie',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin: 20px 0;">
      <h1 style="color: #000; margin: 0 0 20px 0; font-size: 24px;">Sign in to Band Roadie</h1>
      <p style="margin: 0 0 20px 0; font-size: 16px;">Click the button below to sign in to your account:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a
          href="https://nekwjxvgbveheooyorjo.supabase.co/auth/v1/verify?token=2eccd0313c7f6aa31b8dac9edcbc52116e68bcce251e801b23621983&type=magiclink&redirect_to=https%3A%2F%2Fbandroadie.com%2Fauth%2Fcallback%3Fnext%3D%2Fprofile"
          style="display: inline-block; background-color: #ffffff; color: #000000; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 16px; border: 2px solid #000000;">
          Sign In
        </a>
      </div>
      <p style="margin: 20px 0 0 0; font-size: 14px; color: #666;">
        This link will expire in 1 hour. If you didn't request this email, you can safely ignore it.
      </p>
    </div>
    <p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">
      Band Roadie - Your band management tool
    </p>
  </body>
</html>
        `,
      });

      console.log('[api/auth/magic-link] Resend result:', emailResult);

      if (emailResult.error) {
        console.error('[api/auth/magic-link] Resend error:', emailResult.error);
        return NextResponse.json(
          { error: 'Failed to send email: ' + emailResult.error.message },
          { status: 500 },
        );
      }

      console.log('[api/auth/magic-link] Email sent successfully with ID:', emailResult.data?.id);
    } catch (emailError) {
      console.error('[api/auth/magic-link] Email send error:', emailError);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/auth/magic-link] Error:', err);
    return NextResponse.json({ error: 'Failed to send magic link' }, { status: 500 });
  }
}
