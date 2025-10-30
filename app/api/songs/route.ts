import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// iTunes Search API interface
interface iTunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
  trackTimeMillis?: number;
  kind: string;
  primaryGenreName?: string;
  releaseDate?: string;
  // Popularity-related fields
  trackPrice?: number;
  trackViewUrl?: string;
  collectionName?: string;
  collectionPrice?: number;
  country?: string;
  currency?: string;
  trackNumber?: number;
  trackCount?: number;
  // The order in iTunes results is itself a popularity signal
  itunesResultIndex?: number;
}

interface iTunesResponse {
  results: iTunesTrack[];
}

// Spotify Web API interfaces
interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  duration_ms: number;
  album: {
    images: Array<{ url: string; height: number; width: number }>;
  };
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
  };
}

interface SpotifyAudioFeatures {
  tempo: number;
  id: string;
}

// Spotify API token management
let spotifyToken: string | null = null;
let tokenExpiry: number = 0;

async function getSpotifyToken(): Promise<string | null> {
  if (spotifyToken && Date.now() < tokenExpiry) {
    return spotifyToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('Spotify credentials not configured - BPM lookup will be unavailable');
    return null;
  }

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    spotifyToken = data.access_token;
    tokenExpiry = Date.now() + data.expires_in * 1000 - 60000; // Refresh 1 minute early
    return spotifyToken;
  } catch (error) {
    return null;
  }
}

async function searchItunes(query: string): Promise<iTunesTrack[]> {
  try {
    // Clean and optimize the search query
    const cleanQuery = query
      .trim()
      .replace(/[^\w\s'"-]/g, ' ')
      .replace(/\s+/g, ' ');

    // Multi-strategy search approach with Billboard prioritization
    const searches = [
      // Strategy 1: Basic search with higher limit
      `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQuery)}&media=music&entity=song&limit=50`,

      // Strategy 2: Try with quotes for exact phrase matching
      `https://itunes.apple.com/search?term="${encodeURIComponent(cleanQuery)}"&media=music&entity=song&limit=25`,
    ];

    const allResults: iTunesTrack[] = [];
    const seenTracks = new Set<string>();

    for (const searchUrl of searches) {
      try {
        const response = await fetch(searchUrl, {
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });
        if (!response.ok) {
          console.error(`iTunes API error: ${response.status}`);
          continue;
        }

        const data: iTunesResponse = await response.json();
        const filteredResults =
          data.results
            ?.filter((track) => {
              if (track.kind !== 'song' || !track.trackName || !track.artistName) return false;

              // Avoid duplicates based on title + artist (more lenient matching)
              const normalizedTitle = track.trackName
                .toLowerCase()
                .replace(/[^\w\s]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
              const normalizedArtist = track.artistName
                .toLowerCase()
                .replace(/[^\w\s]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
              const key = `${normalizedTitle}_${normalizedArtist}`;

              if (seenTracks.has(key)) return false;
              seenTracks.add(key);
              return true;
            })
            .map((track, index) => ({
              ...track,
              // Add iTunes result index as popularity signal (lower index = more popular)
              itunesResultIndex: allResults.length + index,
            })) || [];

        allResults.push(...filteredResults);
      } catch (err) {
        console.warn('iTunes search failed for URL:', searchUrl);
      }
    }

    return allResults;
  } catch (error) {
    console.error('iTunes search error:', error);
    return [];
  }
}

// SONG_ARTIST_SUGGESTIONS removed - using Billboard chart prioritization instead

// Common BPM fallbacks for popular songs
const BPM_FALLBACKS: Record<string, number> = {
  // Queen
  'bohemian rhapsody': 72,
  'we will rock you': 114,
  'we are the champions': 64,
  'another one bites the dust': 110,

  // Led Zeppelin
  'stairway to heaven': 82,
  'black dog': 95,
  'whole lotta love': 90,
  'immigrant song': 112,

  // Pearl Jam
  alive: 93,
  jeremy: 116,
  'even flow': 118,
  black: 69,
  'better man': 138,

  // Nirvana
  'smells like teen spirit': 117,
  'come as you are': 118,
  'in bloom': 126,
  lithium: 124,
  'heart shaped box': 96,

  // Eagles/Classic Rock
  'hotel california': 74,
  'take it easy': 138,
  desperado: 62,

  // Guns N' Roses
  'sweet child o mine': 125,
  'welcome to the jungle': 130,
  'paradise city': 106,
  'november rain': 64,
  'mr brownstone': 120,
  patience: 80,

  // Journey/Arena Rock
  "don't stop believin'": 119,
  'any way you want it': 126,
  'separate ways': 122,

  // Bon Jovi
  "livin' on a prayer": 123,
  'you give love a bad name': 124,
  'wanted dead or alive': 120,

  // Pink Floyd
  'another brick in the wall': 104,
  'comfortably numb': 63,
  'wish you were here': 59,

  // Deep Purple/Classic Hard Rock
  'smoke on the water': 112,
  'highway star': 148,

  // AC/DC
  'highway to hell': 115,
  'back in black': 93,
  thunderstruck: 133,
  'you shook me all night long': 120,

  // Metallica
  'enter sandman': 124,
  'master of puppets': 212,
  one: 122,
  'nothing else matters': 144,
  'fade to black': 108,
  'for whom the bell tolls': 113,

  // Def Leppard
  'pour some sugar on me': 95,
  'love bites': 114,
  photograph: 100,

  // Soundgarden
  outshined: 126,
  'black hole sun': 104,

  // Songs with "blackout"
  blackout: 127, // Muse - Blackout (average BPM)
  'black out': 127,
  spoonman: 108,

  // Foo Fighters
  everlong: 158,
  'my hero': 124,
  'times like these': 146,
  'the pretender': 137,
  'monkey wrench': 174,
  'all my life': 188,
  'learn to fly': 137,
  'best of you': 104,
};

function getFallbackBPM(artist: string, title: string): number | null {
  const key = title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return BPM_FALLBACKS[key] || null;
}

// Tuning fallbacks - ONLY for songs we're absolutely certain about
// Most songs should remain 'standard' by default
const TUNING_FALLBACKS: Record<string, string> = {
  // Foo Fighters - Drop D (very well-known drop D songs)
  everlong: 'drop_d',
  'my hero': 'drop_d',
  'monkey wrench': 'drop_d',
  'all my life': 'drop_d',

  // Soundgarden - Drop D (classic drop D songs)
  outshined: 'drop_d',
  'black hole sun': 'drop_d',
  spoonman: 'drop_d',

  // Alice in Chains - Drop D
  'man in the box': 'drop_d',
  'them bones': 'drop_d',

  // Well-known half-step down songs
  'fade to black': 'half_step',
  'nothing else matters': 'half_step',
  'master of puppets': 'half_step',

  // NOTE: Removed many 'standard' entries as they're redundant
  // Songs default to 'standard' anyway, so only list non-standard tunings
};

function getFallbackTuning(artist: string, title: string): string {
  const key = title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return TUNING_FALLBACKS[key] || 'standard';
}

async function getSpotifyBPM(artist: string, title: string): Promise<number | null> {
  const token = await getSpotifyToken();
  if (!token) return null;

  try {
    // Search for the track on Spotify
    const searchUrl = `https://api.spotify.com/v1/search?q=artist:"${encodeURIComponent(artist)}" track:"${encodeURIComponent(title)}"&type=track&limit=1`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!searchResponse.ok) {
      return null;
    }

    const searchData: SpotifySearchResponse = await searchResponse.json();
    const track = searchData.tracks.items[0];

    if (!track) return null;

    // Get audio features for BPM
    const featuresResponse = await fetch(`https://api.spotify.com/v1/audio-features/${track.id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!featuresResponse.ok) {
      return null;
    }

    const features: SpotifyAudioFeatures = await featuresResponse.json();
    const bpm = Math.round(features.tempo);
    return bpm;
  } catch (error) {
    console.warn(`Failed to get BPM for "${title}" by ${artist}:`, error);
    return null;
  }
}

async function normalizeSongData(track: iTunesTrack) {
  const artist = track.artistName || 'Unknown Artist';
  const title = track.trackName;
  const isLive =
    title.toLowerCase().includes('live') ||
    title.toLowerCase().includes('concert') ||
    title.toLowerCase().includes('acoustic');

  // Get BPM from Spotify, fallback to common BPMs if Spotify unavailable
  let bpm = await getSpotifyBPM(artist, title);

  if (bpm === null) {
    bpm = getFallbackBPM(artist, title);
  }

  // Get tuning information with priority: User-confirmed > Songsterr > Fallback
  let tuning = getFallbackTuning(artist, title);
  let tuningSource = 'fallback';

  // TODO: Check for user-confirmed tunings first (requires user context)
  // For now, we'll implement this in the frontend component level

  // Try to get more accurate tuning from Songsterr if we don't have a specific one
  if (tuning === 'standard' || tuning === 'Standard (E)') {
    try {
      const songsterrTunings = await fetchSongsterrTuning(title, artist);
      if (songsterrTunings.length > 0) {
        const suggestedTuning = convertSongsterrTuningToStandard(songsterrTunings[0]);
        if (suggestedTuning !== 'Standard (E)') {
          tuning = suggestedTuning;
          tuningSource = 'songsterr';
        }
      }
    } catch (error) {
      console.warn(`Songsterr tuning fetch failed for "${title}" by ${artist}:`, error);
    }
  }

  return {
    title,
    artist,
    is_live: isLive,
    duration_seconds: track.trackTimeMillis ? Math.round(track.trackTimeMillis / 1000) : null,
    // Include artwork for search results but don't store in DB yet
    album_artwork: track.artworkUrl100 || track.artworkUrl60,
    itunes_id: track.trackId.toString(),
    bpm,
    tuning,
    tuning_source: tuningSource,
  };
}

// Comprehensive Billboard chart hits for prioritizing popular versions of songs (1965-2025)
const BILLBOARD_CHART_HITS: Record<
  string,
  { artist: string; peak_position: number; year: number }[]
> = {
  // CLASSIC ROCK (1965-1980)
  satisfaction: [{ artist: 'The Rolling Stones', peak_position: 1, year: 1965 }],
  'like a rolling stone': [{ artist: 'Bob Dylan', peak_position: 2, year: 1965 }],
  yesterday: [{ artist: 'The Beatles', peak_position: 1, year: 1965 }],
  'help!': [{ artist: 'The Beatles', peak_position: 1, year: 1965 }],
  'we can work it out': [{ artist: 'The Beatles', peak_position: 1, year: 1965 }],
  "california dreamin'": [{ artist: 'The Mamas & The Papas', peak_position: 4, year: 1966 }],
  'good vibrations': [{ artist: 'The Beach Boys', peak_position: 1, year: 1966 }],
  'light my fire': [{ artist: 'The Doors', peak_position: 1, year: 1967 }],
  'all you need is love': [{ artist: 'The Beatles', peak_position: 1, year: 1967 }],
  'purple haze': [{ artist: 'Jimi Hendrix', peak_position: 65, year: 1967 }],
  'hey jude': [{ artist: 'The Beatles', peak_position: 1, year: 1968 }],
  'born to be wild': [{ artist: 'Steppenwolf', peak_position: 2, year: 1968 }],
  'come together': [{ artist: 'The Beatles', peak_position: 1, year: 1969 }],
  'whole lotta love': [{ artist: 'Led Zeppelin', peak_position: 4, year: 1970 }],
  'stairway to heaven': [{ artist: 'Led Zeppelin', peak_position: 37, year: 1971 }],
  'american pie': [{ artist: 'Don McLean', peak_position: 1, year: 1971 }],
  imagine: [{ artist: 'John Lennon', peak_position: 3, year: 1971 }],
  layla: [{ artist: 'Derek and the Dominos', peak_position: 51, year: 1972 }],
  'smoke on the water': [{ artist: 'Deep Purple', peak_position: 76, year: 1973 }],
  'dream on': [{ artist: 'Aerosmith', peak_position: 59, year: 1973 }],
  'free bird': [{ artist: 'Lynyrd Skynyrd', peak_position: 19, year: 1974 }],
  'bohemian rhapsody': [{ artist: 'Queen', peak_position: 9, year: 1975 }],
  'born to run': [{ artist: 'Bruce Springsteen', peak_position: 23, year: 1975 }],
  'hotel california': [{ artist: 'Eagles', peak_position: 1, year: 1977 }],
  'we will rock you': [{ artist: 'Queen', peak_position: 4, year: 1977 }],
  'we are the champions': [{ artist: 'Queen', peak_position: 4, year: 1977 }],
  roxanne: [{ artist: 'The Police', peak_position: 32, year: 1978 }],

  // 80s ROCK & POP
  'another brick in the wall': [{ artist: 'Pink Floyd', peak_position: 1, year: 1979 }],
  'crazy little thing called love': [{ artist: 'Queen', peak_position: 1, year: 1980 }],
  'back in black': [{ artist: 'AC/DC', peak_position: 37, year: 1980 }],
  'you shook me all night long': [{ artist: 'AC/DC', peak_position: 35, year: 1980 }],
  "don't stop believin'": [{ artist: 'Journey', peak_position: 9, year: 1981 }],
  'under pressure': [{ artist: 'Queen & David Bowie', peak_position: 29, year: 1981 }],
  'eye of the tiger': [{ artist: 'Survivor', peak_position: 1, year: 1982 }],
  'billie jean': [{ artist: 'Michael Jackson', peak_position: 1, year: 1983 }],
  'beat it': [{ artist: 'Michael Jackson', peak_position: 1, year: 1983 }],
  jump: [{ artist: 'Van Halen', peak_position: 1, year: 1984 }],
  'when doves cry': [{ artist: 'Prince', peak_position: 1, year: 1984 }],
  'purple rain': [{ artist: 'Prince', peak_position: 2, year: 1984 }],
  'like a virgin': [{ artist: 'Madonna', peak_position: 1, year: 1984 }],
  'we built this city': [{ artist: 'Starship', peak_position: 1, year: 1985 }],
  'money for nothing': [{ artist: 'Dire Straits', peak_position: 1, year: 1985 }],
  "livin' on a prayer": [{ artist: 'Bon Jovi', peak_position: 1, year: 1986 }],
  'you give love a bad name': [{ artist: 'Bon Jovi', peak_position: 1, year: 1986 }],
  'sweet child o mine': [{ artist: "Guns N' Roses", peak_position: 1, year: 1988 }],
  'welcome to the jungle': [{ artist: "Guns N' Roses", peak_position: 7, year: 1988 }],
  'every rose has its thorn': [{ artist: 'Poison', peak_position: 1, year: 1988 }],

  // 90s GRUNGE & ALTERNATIVE
  thunderstruck: [{ artist: 'AC/DC', peak_position: 85, year: 1990 }],
  'more than words': [{ artist: 'Extreme', peak_position: 1, year: 1991 }],
  'smells like teen spirit': [{ artist: 'Nirvana', peak_position: 6, year: 1991 }],
  'come as you are': [{ artist: 'Nirvana', peak_position: 32, year: 1991 }],
  alive: [{ artist: 'Pearl Jam', peak_position: 16, year: 1991 }],
  jeremy: [{ artist: 'Pearl Jam', peak_position: 5, year: 1991 }],
  black: [{ artist: 'Pearl Jam', peak_position: 3, year: 1991 }],
  'enter sandman': [{ artist: 'Metallica', peak_position: 16, year: 1991 }],
  'november rain': [{ artist: "Guns N' Roses", peak_position: 3, year: 1992 }],
  'under the bridge': [{ artist: 'Red Hot Chili Peppers', peak_position: 2, year: 1992 }],
  'would?': [{ artist: 'Alice in Chains', peak_position: 31, year: 1992 }],
  'man in the box': [{ artist: 'Alice in Chains', peak_position: 18, year: 1990 }],
  "touch me i'm sick": [{ artist: 'Mudhoney', peak_position: 0, year: 1988 }], // No chart but influential
  outshined: [{ artist: 'Soundgarden', peak_position: 45, year: 1991 }],
  'black hole sun': [{ artist: 'Soundgarden', peak_position: 29, year: 1994 }],
  spoonman: [{ artist: 'Soundgarden', peak_position: 27, year: 1994 }],
  creep: [{ artist: 'Radiohead', peak_position: 34, year: 1993 }],
  plush: [{ artist: 'Stone Temple Pilots', peak_position: 23, year: 1993 }],
  'interstate love song': [{ artist: 'Stone Temple Pilots', peak_position: 20, year: 1994 }],
  loser: [{ artist: 'Beck', peak_position: 10, year: 1993 }],
  zombie: [{ artist: 'The Cranberries', peak_position: 50, year: 1994 }],
  'basket case': [{ artist: 'Green Day', peak_position: 9, year: 1994 }],
  longview: [{ artist: 'Green Day', peak_position: 13, year: 1994 }],
  'when i come around': [{ artist: 'Green Day', peak_position: 6, year: 1995 }],
  '1979': [{ artist: 'The Smashing Pumpkins', peak_position: 12, year: 1996 }],
  'tonight tonight': [{ artist: 'The Smashing Pumpkins', peak_position: 36, year: 1996 }],
  'bullet with butterfly wings': [
    { artist: 'The Smashing Pumpkins', peak_position: 22, year: 1995 },
  ],
  wonderwall: [{ artist: 'Oasis', peak_position: 8, year: 1996 }],
  'champagne supernova': [{ artist: 'Oasis', peak_position: 20, year: 1996 }],
  everlong: [{ artist: 'Foo Fighters', peak_position: 42, year: 1997 }],
  'my hero': [{ artist: 'Foo Fighters', peak_position: 68, year: 1998 }],
  'learn to fly': [{ artist: 'Foo Fighters', peak_position: 19, year: 1999 }],

  // 2000s ROCK & ALTERNATIVE
  'in the end': [{ artist: 'Linkin Park', peak_position: 2, year: 2001 }],
  crawling: [{ artist: 'Linkin Park', peak_position: 79, year: 2001 }],
  'one step closer': [{ artist: 'Linkin Park', peak_position: 36, year: 2001 }],
  numb: [{ artist: 'Linkin Park', peak_position: 11, year: 2003 }],
  'breaking the habit': [{ artist: 'Linkin Park', peak_position: 20, year: 2004 }],
  'somewhere i belong': [{ artist: 'Linkin Park', peak_position: 32, year: 2003 }],
  "what i've done": [{ artist: 'Linkin Park', peak_position: 7, year: 2007 }],
  blackout: [
    { artist: 'Linkin Park', peak_position: 62, year: 2010 },
    { artist: 'Britney Spears', peak_position: 85, year: 2007 },
  ],
  'chop suey!': [{ artist: 'System of a Down', peak_position: 76, year: 2001 }],
  toxicity: [{ artist: 'System of a Down', peak_position: 0, year: 2001 }], // No chart but huge
  'b.y.o.b.': [{ artist: 'System of a Down', peak_position: 27, year: 2005 }],
  'the pretender': [{ artist: 'Foo Fighters', peak_position: 37, year: 2007 }],
  'times like these': [{ artist: 'Foo Fighters', peak_position: 65, year: 2003 }],
  'best of you': [{ artist: 'Foo Fighters', peak_position: 18, year: 2005 }],
  'how to save a life': [{ artist: 'The Fray', peak_position: 3, year: 2006 }],
  'over my head': [{ artist: 'The Fray', peak_position: 8, year: 2006 }],
  'mr. brightside': [{ artist: 'The Killers', peak_position: 10, year: 2004 }],
  'somebody told me': [{ artist: 'The Killers', peak_position: 51, year: 2004 }],
  'when you were young': [{ artist: 'The Killers', peak_position: 14, year: 2006 }],
  human: [{ artist: 'The Killers', peak_position: 32, year: 2008 }],
  'boulevard of broken dreams': [{ artist: 'Green Day', peak_position: 2, year: 2004 }],
  'american idiot': [{ artist: 'Green Day', peak_position: 61, year: 2004 }],
  holiday: [{ artist: 'Green Day', peak_position: 19, year: 2005 }],
  'wake me up when september ends': [{ artist: 'Green Day', peak_position: 6, year: 2005 }],
  'good riddance': [{ artist: 'Green Day', peak_position: 11, year: 1998 }],
  'time of your life': [{ artist: 'Green Day', peak_position: 11, year: 1998 }],
  'seven nation army': [{ artist: 'The White Stripes', peak_position: 76, year: 2003 }],
  'fell in love with a girl': [{ artist: 'The White Stripes', peak_position: 99, year: 2002 }],
  'icky thump': [{ artist: 'The White Stripes', peak_position: 26, year: 2007 }],
  hysteria: [{ artist: 'Muse', peak_position: 0, year: 2003 }], // UK hit, no US chart
  'supermassive black hole': [{ artist: 'Muse', peak_position: 0, year: 2006 }],
  uprising: [{ artist: 'Muse', peak_position: 37, year: 2009 }],
  'mad world': [{ artist: 'Gary Jules', peak_position: 30, year: 2003 }],
  halo: [{ artist: 'Beyoncé', peak_position: 5, year: 2009 }],

  // POP HITS
  'i want it that way': [{ artist: 'Backstreet Boys', peak_position: 6, year: 1999 }],
  "tearin' up my heart": [{ artist: 'NSYNC', peak_position: 55, year: 1998 }],
  'bye bye bye': [{ artist: 'NSYNC', peak_position: 4, year: 2000 }],
  "it's gonna be me": [{ artist: 'NSYNC', peak_position: 1, year: 2000 }],
  'since u been gone': [{ artist: 'Kelly Clarkson', peak_position: 2, year: 2004 }],
  'behind these hazel eyes': [{ artist: 'Kelly Clarkson', peak_position: 6, year: 2005 }],
  stronger: [{ artist: 'Kelly Clarkson', peak_position: 2, year: 2012 }],
  complicated: [{ artist: 'Avril Lavigne', peak_position: 2, year: 2002 }],
  'sk8er boi': [{ artist: 'Avril Lavigne', peak_position: 10, year: 2002 }],
  "i'm with you": [{ artist: 'Avril Lavigne', peak_position: 4, year: 2002 }],
  'my immortal': [{ artist: 'Evanescence', peak_position: 7, year: 2003 }],
  'bring me to life': [{ artist: 'Evanescence', peak_position: 5, year: 2003 }],
  'going under': [{ artist: 'Evanescence', peak_position: 5, year: 2003 }],

  // COUNTRY CROSSOVERS
  'friends in low places': [{ artist: 'Garth Brooks', peak_position: 0, year: 1990 }], // Country only
  'the dance': [{ artist: 'Garth Brooks', peak_position: 0, year: 1990 }],
  'achy breaky heart': [{ artist: 'Billy Ray Cyrus', peak_position: 4, year: 1992 }],
  'man! i feel like a woman!': [{ artist: 'Shania Twain', peak_position: 23, year: 1999 }],
  "you're still the one": [{ artist: 'Shania Twain', peak_position: 2, year: 1998 }],
  "that don't impress me much": [{ artist: 'Shania Twain', peak_position: 7, year: 1999 }],
  breathe: [{ artist: 'Faith Hill', peak_position: 2, year: 1999 }],
  'the way you love me': [{ artist: 'Faith Hill', peak_position: 6, year: 2000 }],
  'i hope you dance': [{ artist: 'Lee Ann Womack', peak_position: 14, year: 2000 }],
  'before he cheats': [{ artist: 'Carrie Underwood', peak_position: 8, year: 2007 }],
  'jesus take the wheel': [{ artist: 'Carrie Underwood', peak_position: 20, year: 2006 }],
  'cowboy take me away': [{ artist: 'Dixie Chicks', peak_position: 10, year: 2000 }],
  'goodbye earl': [{ artist: 'Dixie Chicks', peak_position: 19, year: 2000 }],
  'love story': [{ artist: 'Taylor Swift', peak_position: 4, year: 2008 }],
  'you belong with me': [{ artist: 'Taylor Swift', peak_position: 2, year: 2009 }],

  // 2010s & MODERN
  'rolling in the deep': [{ artist: 'Adele', peak_position: 1, year: 2011 }],
  'someone like you': [{ artist: 'Adele', peak_position: 1, year: 2011 }],
  'set fire to the rain': [{ artist: 'Adele', peak_position: 1, year: 2012 }],
  hello: [{ artist: 'Adele', peak_position: 1, year: 2015 }],
  royals: [{ artist: 'Lorde', peak_position: 1, year: 2013 }],
  radioactive: [{ artist: 'Imagine Dragons', peak_position: 3, year: 2012 }],
  demons: [{ artist: 'Imagine Dragons', peak_position: 6, year: 2013 }],
  "it's time": [{ artist: 'Imagine Dragons', peak_position: 15, year: 2012 }],
  believer: [{ artist: 'Imagine Dragons', peak_position: 4, year: 2017 }],
  thunder: [{ artist: 'Imagine Dragons', peak_position: 4, year: 2017 }],
  'whatever it takes': [{ artist: 'Imagine Dragons', peak_position: 12, year: 2017 }],
  'high hopes': [{ artist: 'Panic! At The Disco', peak_position: 4, year: 2018 }],
  'i write sins not tragedies': [{ artist: 'Panic! At The Disco', peak_position: 7, year: 2006 }],
  'pumped up kicks': [{ artist: 'Foster the People', peak_position: 3, year: 2011 }],
  'somebody that i used to know': [{ artist: 'Gotye', peak_position: 1, year: 2012 }],
  'safe & sound': [{ artist: 'Capital Cities', peak_position: 8, year: 2013 }],
  'counting stars': [{ artist: 'OneRepublic', peak_position: 2, year: 2013 }],
  apologize: [{ artist: 'OneRepublic', peak_position: 2, year: 2007 }],
  'shake it off': [{ artist: 'Taylor Swift', peak_position: 1, year: 2014 }],
  'blank space': [{ artist: 'Taylor Swift', peak_position: 1, year: 2014 }],
  'bad blood': [{ artist: 'Taylor Swift', peak_position: 1, year: 2015 }],
  'uptown funk': [{ artist: 'Mark Ronson ft. Bruno Mars', peak_position: 1, year: 2014 }],
  '24k magic': [{ artist: 'Bruno Mars', peak_position: 4, year: 2016 }],
  "that's what i like": [{ artist: 'Bruno Mars', peak_position: 1, year: 2017 }],
  'blinding lights': [{ artist: 'The Weeknd', peak_position: 1, year: 2020 }],
  'watermelon sugar': [{ artist: 'Harry Styles', peak_position: 1, year: 2020 }],
  'as it was': [{ artist: 'Harry Styles', peak_position: 1, year: 2022 }],
  flowers: [{ artist: 'Miley Cyrus', peak_position: 1, year: 2023 }],
  unholy: [{ artist: 'Sam Smith ft. Kim Petras', peak_position: 1, year: 2022 }],
  'anti-hero': [{ artist: 'Taylor Swift', peak_position: 1, year: 2022 }],
};

// Songsterr API integration for guitar tunings
interface SongsterrTrack {
  id: number;
  title: string;
  artist: { name: string };
  defaultTuning?: string;
  tunings?: Array<{
    id: number;
    name: string;
    tuning: string[];
    instrument: string;
  }>;
}

async function fetchSongsterrTuning(title: string, artist: string): Promise<string[]> {
  try {
    const cleanTitle = title.replace(/[^\w\s]/g, '').replace(/\s+/g, '+');
    const cleanArtist = artist.replace(/[^\w\s]/g, '').replace(/\s+/g, '+');
    const searchQuery = `${cleanTitle}+${cleanArtist}`;

    // Songsterr public search API
    const response = await fetch(
      `https://www.songsterr.com/a/ra/songs.json?pattern=${encodeURIComponent(searchQuery)}`,
      {
        headers: {
          'User-Agent': 'BandRoadie/1.0 (Guitar Tuning Helper)',
        },
        signal: AbortSignal.timeout(3000), // 3 second timeout
      },
    );

    if (!response.ok) {
      console.warn(`Songsterr API error: ${response.status}`);
      return [];
    }

    const data: SongsterrTrack[] = await response.json();

    if (data.length === 0) return [];

    // Find the best match by title and artist similarity
    const bestMatch =
      data.find((track) => {
        const trackTitle = track.title.toLowerCase();
        const trackArtist = track.artist.name.toLowerCase();
        const searchTitle = title.toLowerCase();
        const searchArtist = artist.toLowerCase();

        return (
          (trackTitle.includes(searchTitle) || searchTitle.includes(trackTitle)) &&
          (trackArtist.includes(searchArtist) || searchArtist.includes(trackArtist))
        );
      }) || data[0]; // Fallback to first result

    // Get detailed track info including tunings
    const trackDetailResponse = await fetch(
      `https://www.songsterr.com/a/ra/songs/${bestMatch.id}.json`,
      {
        headers: {
          'User-Agent': 'BandRoadie/1.0 (Guitar Tuning Helper)',
        },
        signal: AbortSignal.timeout(3000),
      },
    );

    if (trackDetailResponse.ok) {
      const trackDetail: SongsterrTrack = await trackDetailResponse.json();

      // Extract guitar tunings (filter for guitar instruments)
      const guitarTunings =
        trackDetail.tunings?.filter(
          (t) =>
            t.instrument.toLowerCase().includes('guitar') ||
            t.instrument.toLowerCase().includes('electric') ||
            t.instrument.toLowerCase().includes('acoustic'),
        ) || [];

      if (guitarTunings.length > 0) {
        const tuningStrings = guitarTunings.map((t) => t.tuning.join(' '));
        return tuningStrings;
      }
    }

    return [];
  } catch (error) {
    console.warn('Songsterr API error:', error);
    return [];
  }
}

function convertSongsterrTuningToStandard(tuningArray: string): string {
  // Convert Songsterr tuning format to our standard format
  const tuningMap: Record<string, string> = {
    'E A D G B E': 'Standard (E)',
    'D A D G B E': 'Drop D',
    'C G C F A D': 'Drop C',
    'B F# B E G# C#': 'Drop B',
    'E A D G B D': 'DADGBD',
    'D A D F A D': 'DADGBE (Open D)',
    'E B E G# B E': 'Open E',
    'D A D G A D': 'DADGAD',
    'C A D G B E': 'CADGBE',
    'B E A D F# B': 'B Standard',
  };

  // Try exact match first
  if (tuningMap[tuningArray]) {
    return tuningMap[tuningArray];
  }

  // Check for common patterns
  if (tuningArray.includes('Drop D')) return 'Drop D';
  if (tuningArray.includes('Drop C')) return 'Drop C';
  if (tuningArray.includes('Drop B')) return 'Drop B';
  if (tuningArray.includes('DADGAD')) return 'DADGAD';

  // Default fallback
  return 'Standard (E)';
}

// Popular artists that should be prioritized in search results
const POPULAR_ARTISTS = new Set([
  'pearl jam',
  'nirvana',
  'soundgarden',
  'alice in chains',
  'stone temple pilots',
  'metallica',
  'megadeth',
  'slayer',
  'anthrax',
  'iron maiden',
  'led zeppelin',
  'the beatles',
  'pink floyd',
  'queen',
  'the rolling stones',
  'ac/dc',
  "guns n' roses",
  'guns n roses',
  'gnr',
  'aerosmith',
  'van halen',
  'black sabbath',
  'def leppard',
  'bon jovi',
  'journey',
  'foreigner',
  'boston',
  'radiohead',
  'foo fighters',
  'red hot chili peppers',
  'the killers',
  'green day',
  'linkin park',
  'system of a down',
  'tool',
  'rage against the machine',
  'muse',
  // Legendary solo artists
  'john lennon',
  'paul mccartney',
  'bob dylan',
  'david bowie',
  'elvis presley',
  'johnny cash',
  'bruce springsteen',
  'prince',
  'michael jackson',
  'stevie wonder',
  'neil young',
  'eric clapton',
  'jimi hendrix',
  'jim morrison',
  'the doors',
  'leonard cohen',
  'joni mitchell',
  'frank sinatra',
  'ray charles',
  'sam cooke',
]);

function sortiTunesResults(results: iTunesTrack[], query: string): iTunesTrack[] {
  const queryLower = query.toLowerCase().trim();

  // Filter and score results
  const scoredResults = results.map((track) => {
    const title = (track.trackName || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const artist = (track.artistName || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const originalTitle = (track.trackName || '').toLowerCase();
    const originalArtist = (track.artistName || '').toLowerCase();

    let score = 0;

    // Billboard chart hit prioritization - this is the most important factor
    const chartData = BILLBOARD_CHART_HITS[queryLower];
    if (chartData) {
      const matchingChart = chartData.find((chart) => {
        const chartArtist = chart.artist
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        return (
          chartArtist === artist ||
          originalArtist.includes(chartArtist) ||
          chartArtist.includes(artist)
        );
      });

      if (matchingChart) {
        // Higher chart positions get more points (lower number = higher position)
        // #1 hits get 1000 points, declining to 100 points for position 100
        const chartScore = Math.max(100, 1000 - matchingChart.peak_position * 9);
        score += chartScore;
      }
    }

    // iTunes popularity boost - earlier results in iTunes are more popular
    if (track.itunesResultIndex !== undefined) {
      // Give higher scores to tracks that appeared earlier in iTunes results
      // First 10 results get significant boost, with diminishing returns
      if (track.itunesResultIndex <= 5) {
        score += 400; // Top 5 iTunes results get major boost
      } else if (track.itunesResultIndex <= 15) {
        score += 300; // Next 10 results get good boost
      } else if (track.itunesResultIndex <= 30) {
        score += 200; // Next 15 results get moderate boost
      } else if (track.itunesResultIndex <= 50) {
        score += 100; // Next 20 results get small boost
      }
      // Beyond position 50, no iTunes popularity bonus
    }

    // Extremely strong preference for exact song title matches
    if (title === queryLower || originalTitle === queryLower) {
      score += 2000; // Exact title match
    } else {
      // Split query and title into words for better matching
      const queryWords = queryLower.split(/\s+/);
      const titleWords = title.split(/\s+/);
      const originalTitleWords = originalTitle.split(/\s+/);

      // Check for exact word matches vs partial word matches
      let exactWordMatches = 0;
      let partialWordMatches = 0;
      let hasFullQueryAsSubstring = false;

      // Check if the full query appears as a substring in title
      if (title.includes(queryLower) || originalTitle.includes(queryLower)) {
        hasFullQueryAsSubstring = true;
      }

      // Count exact word matches
      for (const queryWord of queryWords) {
        if (
          titleWords.some((titleWord) => titleWord === queryWord) ||
          originalTitleWords.some((titleWord) => titleWord === queryWord)
        ) {
          exactWordMatches++;
        } else if (
          titleWords.some((titleWord) => titleWord.includes(queryWord)) ||
          originalTitleWords.some((titleWord) => titleWord.includes(queryWord))
        ) {
          partialWordMatches++;
        }
      }

      // Check for title starting with query
      const startsWithQuery = title.startsWith(queryLower) || originalTitle.startsWith(queryLower);

      // Scoring based on match quality
      if (exactWordMatches === queryWords.length) {
        // All query words found as exact matches
        score += 1800;
      } else if (hasFullQueryAsSubstring && queryLower.length > 3) {
        // Full query found as substring (good for single words like "blackout")
        const titleLength = Math.min(title.length, originalTitle.length);
        const queryLength = queryLower.length;

        // Only give high score if query is substantial part of title
        if (queryLength / titleLength > 0.5) {
          score += 1600; // Query is major part of title
        } else if (queryLength / titleLength > 0.3) {
          score += 1000; // Query is moderate part of title
        } else {
          score += 400; // Query is small part of title
        }
      } else if (startsWithQuery && queryLower.length > 2) {
        // Title starts with query
        const titleLength = Math.min(title.length, originalTitle.length);
        const matchRatio = queryLower.length / titleLength;

        if (matchRatio > 0.7) {
          score += 1500; // Query is most of the title
        } else if (matchRatio > 0.4) {
          score += 1000; // Query is significant part of title
        } else if (matchRatio > 0.2) {
          score += 600; // Query is moderate part of title
        } else {
          score += 200; // Query is small part of title
        }
      } else if (exactWordMatches > 0) {
        // Some exact word matches
        const wordMatchRatio = exactWordMatches / queryWords.length;
        score += Math.floor(1400 * wordMatchRatio);
      } else if (partialWordMatches > 0) {
        // Only partial word matches - much lower score
        const partialMatchRatio = partialWordMatches / queryWords.length;
        score += Math.floor(300 * partialMatchRatio);
      }
    }

    // Additional iTunes popularity signals
    // Songs with track pricing are typically more popular/commercial
    if (track.trackPrice && track.trackPrice > 0) {
      score += 150; // Available for purchase = more popular
    }

    // Tracks from known albums (have collection info) are typically more popular
    if (track.collectionName && track.collectionName.trim()) {
      score += 100; // Part of album = more established
    }

    // Songs with higher track numbers might be deeper cuts (less popular)
    if (track.trackNumber && track.trackNumber > 10) {
      score -= 50; // Deep album cuts get slight penalty
    }

    // Major bonus for popular artists - they should be prioritized highly
    // Check for exact matches first
    let isPopularArtist = POPULAR_ARTISTS.has(artist) || POPULAR_ARTISTS.has(originalArtist);

    // If no exact match, check if any popular artist is contained in the artist name
    // This handles cases like "John Lennon & Yoko Ono" or "John Lennon & The Plastic Ono Band"
    if (!isPopularArtist) {
      for (const popularArtist of Array.from(POPULAR_ARTISTS)) {
        if (artist.includes(popularArtist) || originalArtist.includes(popularArtist)) {
          isPopularArtist = true;
          break;
        }
      }
    }

    if (isPopularArtist) {
      score += 800; // Strong popular artist bonus

      // Extra boost for legendary/iconic bands
      const legendaryBands = [
        'guns n roses',
        "guns n' roses",
        'gnr',
        'led zeppelin',
        'queen',
        'the beatles',
        'metallica',
        'ac dc',
        'acdc',
        'pink floyd',
        'the rolling stones',
        'rolling stones',
        'nirvana',
        'pearl jam',
        'black sabbath',
        // Legendary solo artists
        'john lennon',
        'paul mccartney',
        'bob dylan',
        'david bowie',
        'elvis presley',
        'johnny cash',
        'bruce springsteen',
        'prince',
        'michael jackson',
        'stevie wonder',
        'neil young',
        'eric clapton',
        'jimi hendrix',
        'jim morrison',
        'the doors',
        'leonard cohen',
        'joni mitchell',
        'frank sinatra',
        'ray charles',
        'sam cooke',
      ];
      const isLegendaryBand =
        legendaryBands.includes(artist) || legendaryBands.includes(originalArtist);
      if (isLegendaryBand) {
        score += 500; // Additional legendary band bonus

        // If it's a good title match AND legendary band, give massive boost
        if (score >= 1000) {
          // Has decent title match
          score += 1000; // Ensure legendary bands with good matches are at the top
        }
      }
    }

    // Much lower score for artist-only matches
    if (score === 0) {
      // Only if no title match found
      if (artist === queryLower || originalArtist === queryLower) {
        score += 200; // Exact artist match
      } else if (artist.includes(queryLower) || originalArtist.includes(queryLower)) {
        score += 100; // Artist contains query
      }
    }

    // Additional scoring factors
    if (score > 0) {
      // Prefer studio versions over live/acoustic/cover versions
      if (!title.includes('live') && !title.includes('acoustic') && !title.includes('concert')) {
        score += 50;
      }

      // Boost for well-known artists (heuristic based on common indicators)
      const isLikelyOriginalArtist =
        !artist.includes('tribute') &&
        !artist.includes('cover') &&
        !artist.includes('karaoke') &&
        !title.includes('style of') &&
        !title.includes('originally performed');
      if (isLikelyOriginalArtist) {
        score += 30;
      }

      // Prefer longer tracks (usually studio versions, not radio edits)
      const duration = track.trackTimeMillis || 0;
      if (duration > 180000) {
        // > 3 minutes
        score += 20;
      }

      // For classic rock/metal songs, slightly prefer older releases (likely originals)
      const releaseYear = new Date(track.releaseDate || '1900-01-01').getFullYear();
      if (title.match(/rock|metal|grunge/i) && releaseYear >= 1980 && releaseYear <= 2000) {
        score += 30; // Boost for classic era
      } else if (releaseYear > 2000) {
        score += Math.min(releaseYear - 2000, 10); // Smaller boost for newer releases
      }
    }

    return { track, score };
  });

  // Filter out results with no relevance and sort by score
  return scoredResults
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((result) => result.track);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    // First, search existing songs in our database (only search song titles)
    // First, search existing songs in our database (only search song titles)
    const { data: existingSongs, error: dbError } = await supabase
      .from('songs')
      .select('*')
      .ilike('title', `%${query}%`)
      .limit(5);

    if (dbError) {
      console.error('Database search error:', dbError);
    }

    // Update existing songs with BPM and tuning data if they don't have it
    const updatedExistingSongs = await Promise.all(
      (existingSongs || []).map(async (song) => {
        let needsUpdate = false;
        const updates: Record<string, unknown> = {};

        // Check if BPM needs updating
        if (!song.bpm) {
          let bpm = await getSpotifyBPM(song.artist, song.title);
          if (bpm === null) {
            bpm = getFallbackBPM(song.artist, song.title);
          }

          if (bpm) {
            updates.bpm = bpm;
            song.bpm = bpm; // Update the local object
            needsUpdate = true;
          }
        }

        // Check if tuning needs updating - fix both incorrect standard AND non-standard assignments
        const correctTuning = getFallbackTuning(song.artist, song.title);
        const currentTuning = song.tuning || 'standard';

        // Update if the current tuning doesn't match what it should be
        if (currentTuning !== correctTuning) {
          updates.tuning = correctTuning;
          song.tuning = correctTuning; // Update the local object
          needsUpdate = true;
        }

        // Update the database if needed
        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from('songs')
            .update(updates)
            .eq('id', song.id);

          if (updateError) {
            console.error('Error updating song:', updateError);
          }
        }

        return song;
      }),
    ); // Search iTunes for new songs
    const iTunesResults = await searchItunes(query);

    // If iTunes returns no results, return empty (no more fallback suggestions)
    if (iTunesResults.length === 0) {
      return NextResponse.json({ songs: [] });
    }

    // Sort results by relevance/popularity with Billboard chart prioritization
    const sortedResults = sortiTunesResults(iTunesResults, query);

    // Normalize data with Spotify BPM (process in parallel for better performance)
    const normalizedResults = await Promise.all(
      sortedResults.slice(0, 10).map((track) => normalizeSongData(track)),
    );

    // Filter out songs that already exist in our database
    const existingTitleArtistPairs = new Set(
      updatedExistingSongs.map(
        (song) => `${song.title.toLowerCase()}_${song.artist.toLowerCase()}`,
      ),
    );

    const newSongs = normalizedResults.filter(
      (song) =>
        !existingTitleArtistPairs.has(`${song.title.toLowerCase()}_${song.artist.toLowerCase()}`),
    );

    // Combine existing songs (now with BPM data) and new search results
    const allResults = [
      ...updatedExistingSongs,
      ...newSongs.slice(0, 10 - updatedExistingSongs.length), // Limit total results to 10
    ];

    return NextResponse.json({ songs: allResults });
  } catch (error) {
    console.error('Error in song search API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Use service role for song creation since songs are global resources
  // This bypasses RLS issues until we can apply the UPDATE policy migration
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseServiceKey || !supabaseUrl) {
    console.error('Missing Supabase service role configuration');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Create service client to bypass RLS
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();
    const { title, artist, is_live, bpm, tuning, duration_seconds, album_artwork } = body;

    if (!title || !artist) {
      return NextResponse.json({ error: 'Title and artist are required' }, { status: 400 });
    }

    // Use upsert with service role (bypasses RLS)
    const { data: song, error } = await supabase
      .from('songs')
      .upsert(
        {
          title,
          artist,
          is_live: is_live || false,
          bpm,
          tuning: tuning || 'standard',
          duration_seconds,
        },
        {
          onConflict: 'title,artist',
          ignoreDuplicates: false,
        },
      )
      .select()
      .single();

    if (error) {
      console.error('Error creating/updating song:', error);
      return NextResponse.json({ error: 'Failed to create song' }, { status: 500 });
    }

    // Include the artwork from the original request in the response
    // even if it wasn't stored in the database
    const responseData = {
      ...song,
      album_artwork: album_artwork || song.album_artwork,
    };

    return NextResponse.json({ song: responseData });
  } catch (error) {
    console.error('Error in song creation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
