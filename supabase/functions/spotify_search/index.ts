// Follow Deno deploy pattern: https://deno.land/deploy/docs
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { spotifyFetch } from '../_shared/spotify_auth.ts';

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    images: Array<{ url: string; height: number; width: number }>;
  };
  duration_ms: number;
}

interface SearchResult {
  title: string;
  artist: string;
  spotify_id: string;
  duration_seconds: number;
  album_artwork: string | null;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query, limit = 10 } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Query must be at least 2 characters', data: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const searchQuery = encodeURIComponent(query.trim());
    const url = `https://api.spotify.com/v1/search?q=${searchQuery}&type=track&limit=${Math.min(limit, 20)}`;

    const response = await spotifyFetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Spotify search failed: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ ok: false, error: 'Spotify search failed', data: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    const data = await response.json();
    const tracks: SpotifyTrack[] = data.tracks?.items || [];

    // Normalize results
    const results: SearchResult[] = tracks.map((track) => {
      // Get best available album artwork (prefer medium ~300px)
      const images = track.album.images || [];
      const sortedImages = [...images].sort((a, b) => {
        // Prefer images around 300px
        const aDiff = Math.abs((a.height || 300) - 300);
        const bDiff = Math.abs((b.height || 300) - 300);
        return aDiff - bDiff;
      });
      const artwork = sortedImages[0]?.url || null;

      return {
        title: track.name,
        artist: track.artists[0]?.name || 'Unknown Artist',
        spotify_id: track.id,
        duration_seconds: Math.round(track.duration_ms / 1000),
        album_artwork: artwork,
      };
    });

    return new Response(
      JSON.stringify({ ok: true, data: results, error: null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('spotify_search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage, data: null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
