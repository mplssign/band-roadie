import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    console.log('[DEBUG] Band membership check starting...');
    
    // Create client for user authentication using cookies
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {
            // No-op for read-only operations
          },
          remove() {
            // No-op for read-only operations  
          },
        },
      }
    );

    // Check authentication
    let authenticatedUser: any = null;
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      console.log('[DEBUG] Primary auth failed, trying fallback...');
      
      // Try fallback authentication method
      const cookieStore = await cookies();
      let fallbackAccessToken = cookieStore.get('sb-access-token')?.value;

      // Check for standard Supabase cookies as fallback
      if (!fallbackAccessToken) {
        const supabaseSession = cookieStore.get('sb-127.0.0.1-auth-token')?.value || 
                                cookieStore.get('sb-localhost-auth-token')?.value ||
                                cookieStore.get('sb-bandroadie.com-auth-token')?.value;
        
        if (supabaseSession) {
          try {
            const session = JSON.parse(supabaseSession);
            fallbackAccessToken = session?.access_token;
            console.log('[DEBUG] Using fallback session cookie');
          } catch (e) {
            console.warn('[DEBUG] Failed to parse session cookie:', e);
          }
        }
      }

      if (fallbackAccessToken) {
        // Try to get user with fallback token
        const supabaseFallback = createClient();
        const { data: { user: fallbackUser }, error: fallbackError } = await supabaseFallback.auth.getUser(fallbackAccessToken);
        
        if (fallbackError || !fallbackUser) {
          return NextResponse.json({
            success: false,
            error: 'Authentication failed',
            details: { primaryError: authError?.message, fallbackError: fallbackError?.message }
          });
        }
        
        console.log('[DEBUG] Fallback user authenticated:', fallbackUser.id);
        authenticatedUser = fallbackUser;
      } else {
        return NextResponse.json({
          success: false,
          error: 'No authentication found',
          details: { primaryError: authError?.message, hasCookies: request.headers.get('cookie')?.length || 0 }
        });
      }
    } else {
      console.log('[DEBUG] Primary user authenticated:', user.id);
      authenticatedUser = user;
    }

    // Use service role client for database operations
    const supabase = createClient();
    
    const toxicCrayonBandId = '003be463-e63a-4ec5-b152-4f64c60afcbf';

    // Check all user memberships
    console.log('[DEBUG] Checking all memberships for user:', authenticatedUser.id);
    const { data: allMemberships, error: allMembershipsError } = await supabase
      .from('band_members')
      .select('id, band_id, user_id, bands(id, name)')
      .eq('user_id', authenticatedUser.id);
    
    console.log('[DEBUG] All memberships result:', { allMemberships, allMembershipsError });
    
    // Check specific Toxic Crayon membership
    const { data: toxicMembership, error: toxicError } = await supabase
      .from('band_members')
      .select('id, band_id, user_id')
      .eq('band_id', toxicCrayonBandId)
      .eq('user_id', authenticatedUser.id)
      .maybeSingle();
    
    console.log('[DEBUG] Toxic Crayon membership:', { toxicMembership, toxicError });

    return NextResponse.json({
      success: true,
      user: {
        id: authenticatedUser.id,
        email: authenticatedUser.email
      },
      toxicCrayonBandId,
      allMemberships: allMemberships || [],
      allMembershipsError: allMembershipsError?.message,
      toxicMembership: toxicMembership || null,
      toxicError: toxicError?.message,
      isToxicMember: !!toxicMembership
    });

  } catch (error) {
    console.error('[DEBUG] Exception in band membership check:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}