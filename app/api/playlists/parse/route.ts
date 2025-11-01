import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface PlaylistTrack {
  id: string;
  artist: string;
  title: string;
  duration_seconds?: number;
  album?: string;
  artwork_url?: string;
}

interface PlaylistParseResult {
  success: boolean;
  playlist_name?: string;
  playlist_owner?: string;
  tracks: PlaylistTrack[];
  total_tracks: number;
  error?: string;
}

// Extract Apple Music playlist ID from URL
function extractAppleMusicPlaylistId(url: string): string | null {
  try {
    // Apple Music playlist URLs have format:
    // https://music.apple.com/us/playlist/{name}/{playlist-id}
    // or https://itunes.apple.com/us/playlist/{name}/{playlist-id}
    const match = url.match(/(?:music\.apple\.com|itunes\.apple\.com)\/[a-z]{2}\/playlist\/[^/]+\/([a-zA-Z0-9.]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Extract Spotify playlist ID from URL  
function extractSpotifyPlaylistId(url: string): string | null {
  try {
    // Spotify playlist URLs have format:
    // https://open.spotify.com/playlist/{playlist-id}
    const match = url.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Parse Apple Music playlist using iTunes Search API
async function parseAppleMusicPlaylist(_playlistId: string): Promise<PlaylistParseResult> {
  try {
    // Note: The iTunes Search API doesn't directly support playlist lookups
    // This is a limitation of the public API. In a real implementation, you would need:
    // 1. Apple Music API access (requires developer account)
    // 2. Or web scraping (fragile and against ToS)
    // 3. Or user-provided track lists
    
    // For now, we'll return an error indicating the limitation
    return {
      success: false,
      tracks: [],
      total_tracks: 0,
      error: 'Apple Music playlist parsing requires Apple Music API access. Please paste the track list manually using "Artist — Song" format (one per line).'
    };
  } catch (error) {
    console.error('Apple Music playlist parse error:', error);
    return {
      success: false,
      tracks: [],
      total_tracks: 0,
      error: 'Failed to parse Apple Music playlist. Please try pasting the track list manually.'
    };
  }
}

// Parse Spotify playlist (placeholder for future implementation)
async function parseSpotifyPlaylist(_playlistId: string): Promise<PlaylistParseResult> {
  try {
    // Similar limitation - Spotify Web API requires authentication
    return {
      success: false,
      tracks: [],
      total_tracks: 0,
      error: 'Spotify playlist parsing requires Spotify Web API access. Please paste the track list manually using "Artist — Song" format (one per line).'
    };
  } catch (error) {
    console.error('Spotify playlist parse error:', error);
    return {
      success: false,
      tracks: [],
      total_tracks: 0,
      error: 'Failed to parse Spotify playlist. Please try pasting the track list manually.'
    };
  }
}

// Parse raw text track list
function parseTrackList(text: string): PlaylistParseResult {
  try {
    const lines = text.split('\n').filter(line => line.trim());
    const tracks: PlaylistTrack[] = [];
    
    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;
      
      let artist = '';
      let title = '';
      
      // Try different separators in order of preference
      if (cleanLine.includes(' — ')) {
        [artist, title] = cleanLine.split(' — ', 2);
      } else if (cleanLine.includes(' - ')) {
        [artist, title] = cleanLine.split(' - ', 2);
      } else if (cleanLine.includes('\t')) {
        [artist, title] = cleanLine.split('\t', 2);
      } else if (cleanLine.includes(' by ')) {
        [title, artist] = cleanLine.split(' by ', 2);
      } else {
        // Fallback: assume it's just a title
        title = cleanLine;
        artist = 'Unknown Artist';
      }
      
      if (title) {
        tracks.push({
          id: `track-${tracks.length}`,
          artist: artist.trim() || 'Unknown Artist',
          title: title.trim()
        });
      }
    }
    
    return {
      success: true,
      tracks,
      total_tracks: tracks.length,
      playlist_name: `Custom Track List (${tracks.length} tracks)`
    };
  } catch (error) {
    console.error('Track list parse error:', error);
    return {
      success: false,
      tracks: [],
      total_tracks: 0,
      error: 'Failed to parse track list. Please use format: "Artist — Song" (one per line).'
    };
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { provider, url_or_text, band_id } = body;

    // Validate required fields
    if (!provider || !url_or_text) {
      return NextResponse.json({ 
        error: 'Provider and URL or text content is required' 
      }, { status: 400 });
    }

    // Validate provider
    if (!['apple', 'spotify', 'amazon'].includes(provider)) {
      return NextResponse.json({ 
        error: 'Invalid provider. Must be apple, spotify, or amazon' 
      }, { status: 400 });
    }

    // Validate band access if band_id provided
    if (band_id) {
      const { data: bandAccess } = await supabase
        .from('band_members')
        .select('band_id')
        .eq('band_id', band_id)
        .single();

      if (!bandAccess) {
        return NextResponse.json({ 
          error: 'Access denied to this band' 
        }, { status: 403 });
      }
    }

    const input = url_or_text.trim();
    let result: PlaylistParseResult;

    // Determine if input is URL or raw text
    const isUrl = input.startsWith('http://') || input.startsWith('https://');

    if (isUrl) {
      // Try to parse as playlist URL
      if (provider === 'apple') {
        const playlistId = extractAppleMusicPlaylistId(input);
        if (!playlistId) {
          return NextResponse.json({
            error: 'Invalid Apple Music playlist URL. Please ensure it\'s a public playlist link.'
          }, { status: 400 });
        }
        result = await parseAppleMusicPlaylist(playlistId);
      } else if (provider === 'spotify') {
        const playlistId = extractSpotifyPlaylistId(input);
        if (!playlistId) {
          return NextResponse.json({
            error: 'Invalid Spotify playlist URL. Please ensure it\'s a public playlist link.'
          }, { status: 400 });
        }
        result = await parseSpotifyPlaylist(playlistId);
      } else {
        // Amazon Music or other providers
        result = {
          success: false,
          tracks: [],
          total_tracks: 0,
          error: `${provider} playlist parsing is not yet supported. Please paste the track list manually using "Artist — Song" format (one per line).`
        };
      }
    } else {
      // Parse as raw track list
      result = parseTrackList(input);
    }

    // Log for debugging (dev/staging only)
    if (process.env.NODE_ENV !== 'production') {
      // Log successful parsing for debugging
      // console.log(`[Playlist Parse] Provider: ${provider}, Tracks: ${result.total_tracks}, Success: ${result.success}`);
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Playlist parse API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}