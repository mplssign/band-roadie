// Follow Deno deploy pattern: https://deno.land/deploy/docs
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { spotifyFetch } from '../_shared/spotify_auth.ts';

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { spotify_id } = await req.json();

    if (!spotify_id || typeof spotify_id !== 'string') {
      return new Response(
        JSON.stringify({ ok: false, error: 'spotify_id is required', data: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const url = `https://api.spotify.com/v1/audio-features/${spotify_id}`;
    const response = await spotifyFetch(url);

    // 404 means audio features not available for this track
    if (response.status === 404) {
      return new Response(
        JSON.stringify({ ok: true, data: { bpm: null }, error: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Spotify audio features failed: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ ok: false, error: 'Spotify audio features failed', data: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    const data = await response.json();
    
    // Tempo is in BPM as a float, round to int
    const bpm = data.tempo ? Math.round(data.tempo) : null;

    return new Response(
      JSON.stringify({ ok: true, data: { bpm }, error: null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('spotify_audio_features error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage, data: null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
