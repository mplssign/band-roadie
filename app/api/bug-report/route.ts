import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';
import { APP_VERSION } from '@/src/version';

interface BugReportRequest {
  location: string;
  description: string;
  currentRoute: string;
  userAgent: string;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: BugReportRequest = await request.json();
    const { location, description, currentRoute, userAgent, timestamp } = body;

    // Validate required fields
    if (!description || description.trim().length < 15) {
      return NextResponse.json(
        { error: 'Description must be at least 15 characters long' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Get current user info
    const { data: { user } } = await supabase.auth.getUser();
    let userInfo = 'Not authenticated';
    let currentBandInfo = 'No band selected';

    if (user) {
      // Get user profile
      const { data: profile } = await supabase
        .from('users')
        .select('first_name, last_name, email')
        .eq('id', user.id)
        .single();

      if (profile) {
        const displayName = profile.first_name && profile.last_name 
          ? `${profile.first_name} ${profile.last_name}`
          : profile.email?.split('@')[0] || 'Unknown';
        userInfo = `${displayName} (${profile.email}) - ID: ${user.id}`;
      }

      // Get current band info if available
      const { data: memberships } = await supabase
        .from('band_members')
        .select(`
          band_id,
          bands!inner (
            id,
            name
          )
        `)
        .eq('user_id', user.id);

      if (memberships && memberships.length > 0) {
        // For simplicity, just use the first band - in real app we'd need to track current band
        const membership = memberships[0];
        const band = membership.bands;
        if (band && typeof band === 'object' && 'name' in band && 'id' in band) {
          currentBandInfo = `${band.name} (ID: ${band.id})`;
        }
      }
    }

    // Prepare email content
    const locationText = location === 'Unspecified' ? 'Unspecified' : location;
    const shortDescription = description.length > 50 
      ? description.substring(0, 50) + '...' 
      : description;

    const subject = `Bug Report – ${locationText} – ${shortDescription}`;
    
    const emailBody = `
<h2>Bug Report Submitted</h2>

<p><strong>Location:</strong> ${locationText}</p>

<p><strong>Description:</strong><br>
${description.replace(/\n/g, '<br>')}</p>

<hr>

<h3>Technical Context</h3>
<ul>
<li><strong>Route:</strong> ${currentRoute}</li>
<li><strong>App Version:</strong> ${APP_VERSION}</li>
<li><strong>Platform:</strong> PWA (Web App)</li>
<li><strong>User Agent:</strong> ${userAgent}</li>
<li><strong>User:</strong> ${userInfo}</li>
<li><strong>Current Band:</strong> ${currentBandInfo}</li>
<li><strong>Timestamp:</strong> ${timestamp} (${new Date(timestamp).toLocaleString()})</li>
</ul>
`;

    // Send email using existing email service
    await sendEmail({
      to: 'tonycraig@gmail.com',
      subject,
      html: emailBody,
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error submitting bug report:', error);
    return NextResponse.json(
      { error: 'Failed to submit bug report. Please try again.' },
      { status: 500 }
    );
  }
}