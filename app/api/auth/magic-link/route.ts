import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { generatePWAMagicLinkHTML } from '@/lib/utils/pwa-links';

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

    // eslint-disable-next-line no-console
    console.log('[api/auth/magic-link] NODE_ENV:', process.env.NODE_ENV);
    // eslint-disable-next-line no-console
    console.log('[api/auth/magic-link] Origin:', origin);
    // eslint-disable-next-line no-console
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

    // eslint-disable-next-line no-console
    console.log('[api/auth/magic-link] Supabase action_link:', supabaseMagicLink);

    // Parse the original Supabase URL to see what we got
    const supabaseUrl = new URL(supabaseMagicLink);
    // eslint-disable-next-line no-console
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
    // Add PWA preference indicator to help with routing
    const callbackUrl = `${origin}/auth/callback?next=/profile&pwa_preferred=1`;
    const emailLink = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?token=${token}&type=${type}&redirect_to=${encodeURIComponent(callbackUrl)}`;

    // eslint-disable-next-line no-console
    console.log('[api/auth/magic-link] Magic link generated for:', email);
    // eslint-disable-next-line no-console
    console.log('[api/auth/magic-link] 🔗 COPY THIS LINK TO TEST:', testLink);
    // eslint-disable-next-line no-console
    console.log('[api/auth/magic-link] 📧 Email will contain:', emailLink);
    // eslint-disable-next-line no-console
    console.log('[api/auth/magic-link] ⬆️  Click the link above or paste into browser ⬆️');

    // Send email using Resend
    try {
      // eslint-disable-next-line no-console
      console.log('[api/auth/magic-link] Attempting to send email via Resend...');
      // eslint-disable-next-line no-console
      console.log('[api/auth/magic-link] From:', 'Band Roadie <noreply@bandroadie.com>');
      // eslint-disable-next-line no-console
      console.log('[api/auth/magic-link] To:', email);
      // eslint-disable-next-line no-console
      console.log('[api/auth/magic-link] Subject:', 'Sign in to Band Roadie');
      // eslint-disable-next-line no-console
      console.log('[api/auth/magic-link] Link in email will be:', emailLink);

      const emailResult = await resend.emails.send({
        from: 'Band Roadie <noreply@bandroadie.com>',
        to: email,
        subject: 'Sign in to Band Roadie',
        html: generatePWAMagicLinkHTML({
          url: emailLink,
          preferPWA: true,
        }),
      });

      // eslint-disable-next-line no-console
      console.log('[api/auth/magic-link] Resend result:', emailResult);

      if (emailResult.error) {
        console.error('[api/auth/magic-link] Resend error:', emailResult.error);
        return NextResponse.json(
          { error: 'Failed to send email: ' + emailResult.error.message },
          { status: 500 },
        );
      }

      // eslint-disable-next-line no-console
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
