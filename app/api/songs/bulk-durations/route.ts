import { NextRequest, NextResponse } from 'next/server';

// iTunes Search API interface - reuse from main songs route
interface iTunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  trackTimeMillis?: number;
  artworkUrl100?: string;
  artworkUrl60?: string;
  previewUrl?: string;
  kind: string;
  isLiveEpisode?: boolean;
}

interface iTunesResponse {
  resultCount: number;
  results: iTunesTrack[];
}

interface DurationLookupRequest {
  artist: string;
  title: string;
}

interface DurationLookupResult {
  artist: string;
  title: string;
  duration_seconds?: number;
  status: 'found' | 'multiple' | 'not_found' | 'error';
  matches?: {
    id: string;
    artist: string;
    title: string;
    duration_seconds: number;
    artwork?: string;
  }[];
  error?: string;
}

// Cache for session-level duration lookups to avoid duplicate requests
const durationCache = new Map<string, DurationLookupResult>();

function getCacheKey(artist: string, title: string): string {
  return `${artist.toLowerCase().trim()}|${title.toLowerCase().trim()}`;
}

async function searchItunesForDuration(artist: string, title: string): Promise<iTunesTrack[]> {
  try {
    // Clean and optimize the search query
    const cleanQuery = `${artist} ${title}`
      .trim()
      .replace(/[^\w\s'"-]/g, ' ')
      .replace(/\s+/g, ' ');

    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQuery)}&media=music&entity=song&limit=10`;

    const response = await fetch(searchUrl, {
      signal: AbortSignal.timeout(8000), // 8 second timeout for bulk requests
    });

    if (!response.ok) {
      console.error(`iTunes API error: ${response.status}`);
      return [];
    }

    const data: iTunesResponse = await response.json();
    
    return data.results?.filter((track) => {
      return track.kind === 'song' && track.trackName && track.artistName && track.trackTimeMillis;
    }) || [];
  } catch (error) {
    console.error('iTunes search error:', error);
    return [];
  }
}

function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateMatchScore(searchArtist: string, searchTitle: string, track: iTunesTrack): number {
  const trackArtist = normalizeForMatching(track.artistName);
  const trackTitle = normalizeForMatching(track.trackName);
  const normalizedSearchArtist = normalizeForMatching(searchArtist);
  const normalizedSearchTitle = normalizeForMatching(searchTitle);

  let score = 0;

  // Artist matching (40% of score)
  if (trackArtist === normalizedSearchArtist) {
    score += 400;
  } else if (trackArtist.includes(normalizedSearchArtist) || normalizedSearchArtist.includes(trackArtist)) {
    score += 200;
  }

  // Title matching (60% of score)
  if (trackTitle === normalizedSearchTitle) {
    score += 600;
  } else if (trackTitle.includes(normalizedSearchTitle) || normalizedSearchTitle.includes(trackTitle)) {
    score += 300;
  } else {
    // Check for partial word matches
    const searchWords = normalizedSearchTitle.split(' ');
    const titleWords = trackTitle.split(' ');
    let wordMatches = 0;
    
    for (const searchWord of searchWords) {
      for (const titleWord of titleWords) {
        if (titleWord === searchWord) {
          wordMatches++;
          break;
        }
      }
    }
    
    if (wordMatches > 0) {
      score += (wordMatches / searchWords.length) * 200;
    }
  }

  // Bonus for non-live versions
  if (!trackTitle.includes('live') && !trackTitle.includes('acoustic')) {
    score += 50;
  }

  return Math.round(score);
}

async function lookupDuration(artist: string, title: string): Promise<DurationLookupResult> {
  const cacheKey = getCacheKey(artist, title);
  
  // Check cache first
  if (durationCache.has(cacheKey)) {
    return durationCache.get(cacheKey)!;
  }

  try {
    const tracks = await searchItunesForDuration(artist, title);
    
    if (tracks.length === 0) {
      const result: DurationLookupResult = {
        artist,
        title,
        status: 'not_found'
      };
      durationCache.set(cacheKey, result);
      return result;
    }

    // Score and sort tracks
    const scoredTracks = tracks
      .map(track => ({
        track,
        score: calculateMatchScore(artist, title, track)
      }))
      .filter(item => item.score > 100) // Only keep reasonable matches
      .sort((a, b) => b.score - a.score);

    if (scoredTracks.length === 0) {
      const result: DurationLookupResult = {
        artist,
        title,
        status: 'not_found'
      };
      durationCache.set(cacheKey, result);
      return result;
    }

    const bestMatch = scoredTracks[0];
    const secondBestScore = scoredTracks[1]?.score || 0;

    // If best match is significantly better (>100 points difference), use it
    if (bestMatch.score - secondBestScore > 100 && bestMatch.score > 400) {
      const result: DurationLookupResult = {
        artist,
        title,
        duration_seconds: Math.round(bestMatch.track.trackTimeMillis! / 1000),
        status: 'found'
      };
      durationCache.set(cacheKey, result);
      return result;
    }

    // Multiple good matches - return them for user selection
    const matches = scoredTracks.slice(0, 5).map(item => ({
      id: item.track.trackId.toString(),
      artist: item.track.artistName,
      title: item.track.trackName,
      duration_seconds: Math.round(item.track.trackTimeMillis! / 1000),
      artwork: item.track.artworkUrl100 || item.track.artworkUrl60
    }));

    const result: DurationLookupResult = {
      artist,
      title,
      status: 'multiple',
      matches
    };
    durationCache.set(cacheKey, result);
    return result;

  } catch (error) {
    console.error(`Duration lookup error for "${title}" by ${artist}:`, error);
    const result: DurationLookupResult = {
      artist,
      title,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    durationCache.set(cacheKey, result);
    return result;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { songs }: { songs: DurationLookupRequest[] } = body;

    if (!Array.isArray(songs) || songs.length === 0) {
      return NextResponse.json({ error: 'Songs array is required' }, { status: 400 });
    }

    if (songs.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 songs per request' }, { status: 400 });
    }

    // Validate each song has required fields
    for (const song of songs) {
      if (!song.artist || !song.title) {
        return NextResponse.json({ 
          error: 'Each song must have artist and title' 
        }, { status: 400 });
      }
    }

    // Process songs with rate limiting (batch of 5 concurrent requests)
    const results: DurationLookupResult[] = [];
    const batchSize = 5;
    
    for (let i = 0; i < songs.length; i += batchSize) {
      const batch = songs.slice(i, i + batchSize);
      const batchPromises = batch.map(song => lookupDuration(song.artist, song.title));
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < songs.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return NextResponse.json({ results });

  } catch (error) {
    console.error('Bulk duration lookup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}