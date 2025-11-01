import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addConnection, removeConnection, broadcastToBand } from '@/lib/utils/realtime-connections';
import { initializeBroadcast } from '@/lib/utils/realtime-broadcast';

// Initialize the broadcast function for other API routes to use
initializeBroadcast(broadcastToBand);

/**
 * Server-Sent Events endpoint for real-time updates
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Get band ID from query params
  const url = new URL(request.url);
  const bandId = url.searchParams.get('bandId');
  
  if (!bandId) {
    return new Response('Band ID required', { status: 400 });
  }

  // Verify user is a member of this band
  const { data: membership } = await supabase
    .from('band_members')
    .select('id')
    .eq('band_id', bandId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!membership) {
    return new Response('Forbidden', { status: 403 });
  }

  // Set up SSE stream
  const encoder = new TextEncoder();
  
  const customReadable = new ReadableStream({
    start(controller) {
      // Add connection to band's connection pool
      const connection = addConnection(bandId, controller, user.id);
      
      // Send initial connection message
      const welcomeMessage = `data: ${JSON.stringify({
        type: 'connected',
        bandId,
        timestamp: Date.now()
      })}\n\n`;
      
      controller.enqueue(encoder.encode(welcomeMessage));
      
      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        removeConnection(bandId, connection);
        controller.close();
      });
    }
  });

  return new Response(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}