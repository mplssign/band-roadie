import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';
import { APP_VERSION } from '@/src/version';

interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
  screenResolution: string;
  viewport: string;
  timezone: string;
  cookiesEnabled: boolean;
  onlineStatus: boolean;
}

interface BugReportRequest {
  location: string;
  description: string;
  currentRoute: string;
  currentBandId: string | null;
  currentBandName: string | null;
  deviceInfo: DeviceInfo;
  timestamp: string;
}

// Helper function to parse device and OS information from user agent
function parseDeviceInfo(deviceInfo: DeviceInfo) {
  const { userAgent } = deviceInfo;
  
  // Detect OS
  let os = 'Unknown OS';
  let device = 'Unknown Device';
  
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    device = userAgent.includes('iPhone') ? 'iPhone' : 'iPad';
    const iosMatch = userAgent.match(/OS (\d+_\d+)/);
    os = iosMatch ? `iOS ${iosMatch[1].replace('_', '.')}` : 'iOS';
  } else if (userAgent.includes('Android')) {
    device = 'Android Device';
    const androidMatch = userAgent.match(/Android (\d+\.?\d*)/);
    os = androidMatch ? `Android ${androidMatch[1]}` : 'Android';
  } else if (userAgent.includes('Mac')) {
    device = 'Mac';
    const macMatch = userAgent.match(/Mac OS X (\d+_\d+_?\d*)/);
    os = macMatch ? `macOS ${macMatch[1].replace(/_/g, '.')}` : 'macOS';
  } else if (userAgent.includes('Windows')) {
    device = 'Windows PC';
    if (userAgent.includes('Windows NT 10.0')) os = 'Windows 10/11';
    else if (userAgent.includes('Windows NT 6.1')) os = 'Windows 7';
    else if (userAgent.includes('Windows NT 6.3')) os = 'Windows 8.1';
    else os = 'Windows';
  } else if (userAgent.includes('Linux')) {
    device = 'Linux Device';
    os = 'Linux';
  }
  
  // Detect browser
  let browser = 'Unknown Browser';
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    const chromeMatch = userAgent.match(/Chrome\/(\d+)/);
    browser = chromeMatch ? `Chrome ${chromeMatch[1]}` : 'Chrome';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    const safariMatch = userAgent.match(/Version\/(\d+)/);
    browser = safariMatch ? `Safari ${safariMatch[1]}` : 'Safari';
  } else if (userAgent.includes('Firefox')) {
    const firefoxMatch = userAgent.match(/Firefox\/(\d+)/);
    browser = firefoxMatch ? `Firefox ${firefoxMatch[1]}` : 'Firefox';
  } else if (userAgent.includes('Edg')) {
    const edgeMatch = userAgent.match(/Edg\/(\d+)/);
    browser = edgeMatch ? `Edge ${edgeMatch[1]}` : 'Edge';
  }
  
  return { os, device, browser };
}

export async function POST(request: NextRequest) {
  try {
    const body: BugReportRequest = await request.json();
    const { location, description, currentRoute, currentBandId, currentBandName, deviceInfo, timestamp } = body;

    // Validate required fields
    if (!description || description.trim().length < 15) {
      return NextResponse.json(
        { error: 'Description must be at least 15 characters long' },
        { status: 400 }
      );
    }

    // Parse device information
    const { os, device, browser } = parseDeviceInfo(deviceInfo);

    // Get user info from cookies
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;
    
    let userInfo = 'Not authenticated';
    let currentBandInfo = 'No band selected';
    let userId: string | null = null;

    if (accessToken) {
      try {
        // Decode JWT to get user ID
        const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
        userId = payload.sub;

        const supabase = createClient();
        
        // Get user profile
        const { data: profile } = await supabase
          .from('users')
          .select('first_name, last_name, email')
          .eq('id', userId)
          .single();

        if (profile) {
          const displayName = profile.first_name && profile.last_name 
            ? `${profile.first_name} ${profile.last_name}`
            : profile.email?.split('@')[0] || 'Unknown';
          userInfo = `${displayName} (${profile.email}) - ID: ${userId}`;
        }

        // Use current band from frontend first, then try to get all user bands as fallback
        if (currentBandId && currentBandName) {
          currentBandInfo = `${currentBandName} (ID: ${currentBandId})`;
        } else {
          // Fallback: Direct query with service role bypassing RLS to get all user bands
          try {
            const { data: directBands, error: bandError } = await supabase
              .from('band_members')
              .select(`
                band_id,
                bands!inner (
                  id,
                  name
                )
              `)
              .eq('user_id', userId)
              .eq('is_active', true);

            if (!bandError && directBands && directBands.length > 0) {
              const bandNames = directBands.map(m => {
                const band = m.bands as unknown as { id: string; name: string };
                return `${band.name} (ID: ${band.id})`;
              });
              currentBandInfo = bandNames.join(', ');
            } else {
              console.error('Error fetching user bands:', bandError);
              currentBandInfo = 'Error fetching band info';
            }
          } catch (bandQueryError) {
            console.error('Exception fetching user bands:', bandQueryError);
            currentBandInfo = 'Exception fetching band info';
          }
        }
      } catch (error) {
        console.error('Error parsing access token:', error);
        userInfo = 'Authentication error';
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

<h3>User Information</h3>
<ul>
<li><strong>User:</strong> ${userInfo}</li>
<li><strong>Band(s):</strong> ${currentBandInfo}</li>
</ul>

<h3>Technical Context</h3>
<ul>
<li><strong>Route:</strong> ${currentRoute}</li>
<li><strong>App Version:</strong> ${APP_VERSION}</li>
<li><strong>Device:</strong> ${device}</li>
<li><strong>Operating System:</strong> ${os}</li>
<li><strong>Browser:</strong> ${browser}</li>
<li><strong>Screen Resolution:</strong> ${deviceInfo.screenResolution}</li>
<li><strong>Viewport:</strong> ${deviceInfo.viewport}</li>
<li><strong>Language:</strong> ${deviceInfo.language}</li>
<li><strong>Timezone:</strong> ${deviceInfo.timezone}</li>
<li><strong>Platform:</strong> ${deviceInfo.platform}</li>
<li><strong>Online Status:</strong> ${deviceInfo.onlineStatus ? 'Online' : 'Offline'}</li>
<li><strong>Cookies Enabled:</strong> ${deviceInfo.cookiesEnabled ? 'Yes' : 'No'}</li>
<li><strong>Timestamp:</strong> ${timestamp} (${new Date(timestamp).toLocaleString()})</li>
</ul>

<h3>Raw User Agent</h3>
<p style="font-family: monospace; font-size: 12px; word-break: break-all;">${deviceInfo.userAgent}</p>
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