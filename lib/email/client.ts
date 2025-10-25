import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail({ to, subject, html, from }: EmailOptions) {
  const startTime = Date.now();
  
  // Log configuration check (dev only)
  if (process.env.NODE_ENV !== 'production') {
    const apiKeyPresent = !!process.env.RESEND_API_KEY;
    const fromAddress = from || process.env.RESEND_FROM_EMAIL || 'Band Roadie <noreply@bandroadie.com>';
    console.log(`[email.send] Config check - API key: ${apiKeyPresent ? 'present' : 'MISSING'}, from: ${fromAddress}`);
  }

  try {
    const { data, error } = await resend.emails.send({
      from: from || process.env.RESEND_FROM_EMAIL || 'Band Roadie <noreply@bandroadie.com>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    const elapsed = Date.now() - startTime;

    if (error) {
      console.error(`[email.send] ERROR (${elapsed}ms):`, error);
      return { success: false, error };
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[email.send] SUCCESS (${elapsed}ms) - ID: ${data?.id || 'unknown'}, to: ${Array.isArray(to) ? to.join(', ') : to}`);
    }

    return { success: true, data };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[email.send] EXCEPTION (${elapsed}ms):`, error);
    return { success: false, error };
  }
}
