#!/usr/bin/env npx tsx
/* eslint-disable no-console */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Copy duration search logic from the API
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

async function backfillDurations(limit: number = 5) {
  try {
    // Get songs without durations
    const { data: songsNeedingDuration, error: fetchError } = await supabase
      .from('songs')
      .select('id, title, artist, duration_seconds')
      .is('duration_seconds', null)
      .limit(limit);

    if (fetchError) {
      console.error('Error fetching songs:', fetchError);
      return;
    }

    if (!songsNeedingDuration || songsNeedingDuration.length === 0) {
      console.log('✅ No songs need duration updates!');
      return;
    }

    console.log(`🔍 Processing ${songsNeedingDuration.length} songs...`);

    let updated = 0;
    let failed = 0;

    for (const song of songsNeedingDuration) {
      console.log(`\n🎵 "${song.title}" by ${song.artist}`);
      
      try {
        const duration = await searchItunesForDuration(song.artist, song.title);
        
        if (duration) {
          const { error: updateError } = await supabase
            .from('songs')
            .update({ duration_seconds: duration })
            .eq('id', song.id);

          if (!updateError) {
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            console.log(`   ✅ Updated: ${minutes}:${seconds.toString().padStart(2, '0')}`);
            updated++;
          } else {
            console.log(`   ❌ Update failed: ${updateError.message}`);
            failed++;
          }
        } else {
          console.log(`   ⚠️  Duration not found`);
        }

        // Small delay to be nice to iTunes API
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        failed++;
      }
    }

    console.log(`\n📊 Results:`);
    console.log(`   Updated: ${updated} songs`);
    console.log(`   Failed: ${failed} songs`);
    console.log(`   Total processed: ${songsNeedingDuration.length} songs`);

  } catch (error) {
    console.error('Error in backfill process:', error);
  }
}

// Run the backfill with a larger batch
const batchSize = process.argv[2] ? parseInt(process.argv[2]) : 20;
backfillDurations(batchSize);