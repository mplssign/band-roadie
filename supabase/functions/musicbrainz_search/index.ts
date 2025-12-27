// Follow Deno deploy pattern: https://deno.land/deploy/docs
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

interface MusicBrainzRecording {
  id: string;
  title: string;
  length?: number; // milliseconds
  'artist-credit'?: Array<{
    name: string;
    artist: { name: string };
  }>;
}

interface SearchResult {
  title: string;
  artist: string;
  musicbrainz_id: string;
  duration_seconds: number | null;
  album_artwork: null; // MusicBrainz doesn't provide artwork directly
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
    const url = `https://musicbrainz.org/ws/2/recording?query=${searchQuery}&limit=${Math.min(limit, 20)}&fmt=json`;

    const response = await fetch(url, {
      headers: {
        // MusicBrainz requires a User-Agent with app info
        'User-Agent': 'BandRoadie/1.0.0 (support@bandroadie.com)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`MusicBrainz search failed: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ ok: false, error: 'MusicBrainz search failed', data: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    const data = await response.json();
    const recordings: MusicBrainzRecording[] = data.recordings || [];

    // Normalize results
    const results: SearchResult[] = recordings.map((recording) => {
      // Get first artist from artist-credit
      const artistCredit = recording['artist-credit']?.[0];
      const artist = artistCredit?.name || artistCredit?.artist?.name || 'Unknown Artist';

      return {
        title: recording.title,
        artist: artist,
        musicbrainz_id: recording.id,
        duration_seconds: recording.length ? Math.round(recording.length / 1000) : null,
        album_artwork: null, // MusicBrainz doesn't provide artwork
      };
    });

    return new Response(
      JSON.stringify({ ok: true, data: results, error: null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('musicbrainz_search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage, data: null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
