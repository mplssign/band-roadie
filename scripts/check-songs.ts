#!/usr/bin/env npx tsx
/* eslint-disable no-console */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSongs() {
  try {
    const { data: allSongs, error } = await supabase
      .from('songs')
      .select('id, title, artist, duration_seconds, bpm, tuning')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching songs:', error);
      return;
    }

    const totalSongs = allSongs?.length || 0;
    const songsWithDuration = allSongs?.filter(song => song.duration_seconds !== null).length || 0;
    const songsWithoutDuration = totalSongs - songsWithDuration;
    
    console.log(`📊 Song Duration Analysis:`);
    console.log(`   Total songs: ${totalSongs}`);
    console.log(`   With duration: ${songsWithDuration}`);
    console.log(`   Missing duration: ${songsWithoutDuration}`);
    
    if (songsWithoutDuration > 0) {
      console.log(`\n🔍 Songs missing duration:`);
      const songsNeedingDuration = allSongs?.filter(song => song.duration_seconds === null) || [];
      songsNeedingDuration.slice(0, 10).forEach(song => {
        console.log(`   - "${song.title}" by ${song.artist}`);
      });
      if (songsNeedingDuration.length > 10) {
        console.log(`   ... and ${songsNeedingDuration.length - 10} more`);
      }
    }
    
    // Also check BPM data
    const songsWithBPM = allSongs?.filter(song => song.bpm !== null).length || 0;
    const songsWithoutBPM = totalSongs - songsWithBPM;
    
    console.log(`\n🎵 BPM Analysis:`);
    console.log(`   With BPM: ${songsWithBPM}`);
    console.log(`   Missing BPM: ${songsWithoutBPM}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSongs();