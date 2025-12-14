import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Copy the interfaces and helper functions from the main songs API
interface iTunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  trackTimeMillis?: number;
  kind: string;
}

interface iTunesResponse {
  results: iTunesTrack[];
}

async function searchItunesForDuration(artist: string, title: string): Promise<number | null> {
  try {
    // Search specifically for this artist and title
    const searchQuery = `${title} ${artist}`;
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=music&entity=song&limit=5`;
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data: iTunesResponse = await response.json();
    
    // Find the best match by comparing title and artist
    const bestMatch = data.results?.find(track => {
      if (track.kind !== 'song') return false;
      
      const trackTitle = track.trackName?.toLowerCase().replace(/[^\w\s]/g, '').trim() || '';
      const trackArtist = track.artistName?.toLowerCase().replace(/[^\w\s]/g, '').trim() || '';
      const searchTitle = title.toLowerCase().replace(/[^\w\s]/g, '').trim();
      const searchArtist = artist.toLowerCase().replace(/[^\w\s]/g, '').trim();
      
      // Check for title match (exact or contains)
      const titleMatch = trackTitle === searchTitle || trackTitle.includes(searchTitle) || searchTitle.includes(trackTitle);
      
      // Check for artist match (exact or contains)
      const artistMatch = trackArtist === searchArtist || trackArtist.includes(searchArtist) || searchArtist.includes(trackArtist);
      
      return titleMatch && artistMatch;
    });
    
    if (bestMatch && bestMatch.trackTimeMillis) {
      return Math.round(bestMatch.trackTimeMillis / 1000);
    }
    
    // If no exact match, try the first result if it has a duration
    const firstResult = data.results?.[0];
    if (firstResult && firstResult.trackTimeMillis) {
      return Math.round(firstResult.trackTimeMillis / 1000);
    }
    
    return null;
  } catch (error) {
    console.warn(`Failed to get duration for "${title}" by ${artist}:`, error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode = 'single', songId, batchSize = 10 } = body;

    // Use service role for updating songs
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseServiceKey || !supabaseUrl) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (mode === 'single' && songId) {
      // Update a single song
      const { data: song, error: fetchError } = await supabase
        .from('songs')
        .select('id, title, artist, duration_seconds')
        .eq('id', songId)
        .single();

      if (fetchError || !song) {
        return NextResponse.json({ error: 'Song not found' }, { status: 404 });
      }

      if (song.duration_seconds) {
        return NextResponse.json({ 
          message: 'Song already has duration',
          song,
          updated: false
        });
      }

      const duration = await searchItunesForDuration(song.artist, song.title);
      
      if (duration) {
        const { data: updatedSong, error: updateError } = await supabase
          .from('songs')
          .update({ duration_seconds: duration })
          .eq('id', songId)
          .select()
          .single();

        if (updateError) {
          return NextResponse.json({ error: 'Failed to update song' }, { status: 500 });
        }

        return NextResponse.json({
          message: 'Duration updated successfully',
          song: updatedSong,
          updated: true,
          duration
        });
      } else {
        return NextResponse.json({
          message: 'Duration not found',
          song,
          updated: false
        });
      }

    } else if (mode === 'batch') {
      // Update multiple songs in batch
      const { data: songsNeedingDuration, error: fetchError } = await supabase
        .from('songs')
        .select('id, title, artist, duration_seconds')
        .is('duration_seconds', null)
        .limit(batchSize);

      if (fetchError) {
        return NextResponse.json({ error: 'Failed to fetch songs' }, { status: 500 });
      }

      if (!songsNeedingDuration || songsNeedingDuration.length === 0) {
        return NextResponse.json({
          message: 'No songs need duration updates',
          processed: 0,
          updated: 0
        });
      }

      const results = {
        processed: songsNeedingDuration.length,
        updated: 0,
        failed: 0,
        songs: [] as Array<{
          id: string;
          title: string;
          artist: string;
          duration?: number;
          status: string;
          error?: string;
        }>
      };

      // Process songs one by one to avoid rate limiting
      for (const song of songsNeedingDuration) {
        try {
          const duration = await searchItunesForDuration(song.artist, song.title);
          
          if (duration) {
            const { data: updatedSong, error: updateError } = await supabase
              .from('songs')
              .update({ duration_seconds: duration })
              .eq('id', song.id)
              .select()
              .single();

            if (!updateError && updatedSong) {
              results.updated++;
              results.songs.push({
                id: song.id,
                title: song.title,
                artist: song.artist,
                duration,
                status: 'updated'
              });
            } else {
              results.failed++;
              results.songs.push({
                id: song.id,
                title: song.title,
                artist: song.artist,
                status: 'update_failed',
                error: updateError?.message
              });
            }
          } else {
            results.songs.push({
              id: song.id,
              title: song.title,
              artist: song.artist,
              status: 'duration_not_found'
            });
          }

          // Small delay to avoid overwhelming the iTunes API
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          results.failed++;
          results.songs.push({
            id: song.id,
            title: song.title,
            artist: song.artist,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return NextResponse.json({
        message: `Processed ${results.processed} songs, updated ${results.updated}`,
        ...results
      });

    } else {
      return NextResponse.json({ error: 'Invalid mode or missing parameters' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in duration backfill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Use regular client for read operations
    const supabase = await createClient();

    // Get stats about songs needing duration
    const { data: allSongs, error } = await supabase
      .from('songs')
      .select('id, title, artist, duration_seconds')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch songs' }, { status: 500 });
    }

    const totalSongs = allSongs?.length || 0;
    const songsWithDuration = allSongs?.filter(song => song.duration_seconds !== null).length || 0;
    const songsWithoutDuration = totalSongs - songsWithDuration;

    const songsNeedingDuration = allSongs?.filter(song => song.duration_seconds === null) || [];

    return NextResponse.json({
      stats: {
        totalSongs,
        songsWithDuration,
        songsWithoutDuration,
        completionPercentage: totalSongs > 0 ? Math.round((songsWithDuration / totalSongs) * 100) : 0
      },
      songsNeedingDuration: songsNeedingDuration.slice(0, 20) // Return first 20 for preview
    });

  } catch (error) {
    console.error('Error getting duration stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}