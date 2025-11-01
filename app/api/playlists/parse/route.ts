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
    // 1. Apple Music API access (requires developer account and user authentication)
    // 2. Or web scraping (unreliable and against ToS)
    // 3. Or manual parsing from shared playlist text
    
    return {
      success: false,
      tracks: [],
      total_tracks: 0,
      error: 'Apple Music playlist parsing requires Apple Music API access. Please paste the track list manually using "Artist — Song" format (one per line).'
    };
  } catch {
    return {
      success: false,
      tracks: [],
      total_tracks: 0,
      error: 'Failed to parse Apple Music playlist.'
    };
  }
}

// Parse Spotify playlist using Spotify Web API
async function parseSpotifyPlaylist(_playlistId: string): Promise<PlaylistParseResult> {
  try {
    // Note: Spotify Web API requires authentication and user consent
    // For public playlists, you could potentially use the Web API with client credentials
    // but this requires proper OAuth setup and rate limiting
    
    return {
      success: false,
      tracks: [],
      total_tracks: 0,
      error: 'Spotify playlist parsing requires Spotify API access. Please paste the track list manually using "Artist — Song" format (one per line).'
    };
  } catch {
    return {
      success: false,
      tracks: [],
      total_tracks: 0,
      error: 'Failed to parse Spotify playlist.'
    };
  }
}

// Parse manual track list in "Artist — Song" format
function parseTrackList(text: string): PlaylistParseResult {
  try {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const tracks: PlaylistTrack[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Try to parse "Artist — Song" format (with em dash)
      let parts = line.split('—').map(part => part.trim());
      
      // If no em dash, try regular dash
      if (parts.length === 1) {
        parts = line.split('—').map(part => part.trim());
      }
      
      // If still no separator, try hyphen
      if (parts.length === 1) {
        parts = line.split('-').map(part => part.trim());
      }

      if (parts.length >= 2) {
        const artist = parts[0];
        const title = parts.slice(1).join(' — '); // Rejoin in case song title had separators
        
        tracks.push({
          id: `track_${i + 1}`,
          artist,
          title
        });
      } else {
        // If we can't parse the format, treat the whole line as a song title with unknown artist
        tracks.push({
          id: `track_${i + 1}`,
          artist: 'Unknown Artist',
          title: line
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
    const body = await request.json();
    const { url: url_or_text, bandId } = body;

    // Validate required fields
    if (!url_or_text) {
      return NextResponse.json({ 
        error: 'URL or text content is required' 
      }, { status: 400 });
    }

    // Skip authentication in development
    if (process.env.NODE_ENV !== 'development') {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Validate band access if bandId provided
      if (bandId) {
        const { data: bandMember, error: bandError } = await supabase
          .from('band_members')
          .select('id')
          .eq('band_id', bandId)
          .eq('user_id', user.id)
          .single();

        if (bandError || !bandMember) {
          return NextResponse.json({
            error: 'Access denied. You must be a member of this band to import playlists.'
          }, { status: 403 });
        }
      }
    }

    const input = url_or_text.trim();
    let result: PlaylistParseResult;

    // Determine if input is URL or raw text
    const isUrl = input.startsWith('http://') || input.startsWith('https://');

    if (isUrl) {
      // Detect provider from URL
      let provider: string;
      if (input.includes('music.apple.com') || input.includes('itunes.apple.com')) {
        provider = 'apple';
      } else if (input.includes('open.spotify.com')) {
        provider = 'spotify';
      } else {
        provider = 'unknown';
      }

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
          error: `URL not recognized as Apple Music or Spotify playlist. Please paste the track list manually using "Artist — Song" format (one per line).`
        };
      }
    } else {
      // Parse as raw track list
      result = parseTrackList(input);
    }

    return NextResponse.json({
      success: result.success,
      songs: result.tracks.map(track => ({
        artist: track.artist,
        title: track.title,
        duration_seconds: track.duration_seconds,
        bpm: undefined, // BPM detection would need additional API calls
        tuning: undefined // Tuning detection would need additional logic
      })),
      total_tracks: result.total_tracks,
      playlist_name: result.playlist_name,
      error: result.error
    });

  } catch (error) {
    console.error('Playlist parse API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}