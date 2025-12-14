import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Tuning cleanup endpoint - corrects incorrect tuning assignments
// Only use this to fix database inconsistencies

const CORRECT_TUNINGS: Record<string, string> = {
  // Foo Fighters - Drop D
  'everlong': 'drop_d',
  'my hero': 'drop_d',
  'monkey wrench': 'drop_d',
  'all my life': 'drop_d',
  
  // Soundgarden - Drop D
  'outshined': 'drop_d',
  'black hole sun': 'drop_d',
  'spoonman': 'drop_d',
  
  // Alice in Chains - Drop D
  'man in the box': 'drop_d',
  'them bones': 'drop_d',
  
  // Well-known half-step down songs
  'fade to black': 'half_step',
  'nothing else matters': 'half_step',
  'master of puppets': 'half_step',
};

function getCorrectTuning(title: string): string {
  const key = title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  return CORRECT_TUNINGS[key] || 'standard';
}

export async function POST(_request: NextRequest) {
  const supabase = createClient();
  
  try {
    // Get all songs from database
    const { data: songs, error: fetchError } = await supabase
      .from('songs')
      .select('id, title, artist, tuning');
      
    if (fetchError) {
      console.error('Error fetching songs:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch songs' }, { status: 500 });
    }
    
    let corrected = 0;
    const total = songs?.length || 0;
    
    if (songs) {
      for (const song of songs) {
        const correctTuning = getCorrectTuning(song.title);
        const currentTuning = song.tuning || 'standard';
        
        if (currentTuning !== correctTuning) {
          // console.log(`Correcting "${song.title}" by ${song.artist}: ${currentTuning} -> ${correctTuning}`);
          
          const { error: updateError } = await supabase
            .from('songs')
            .update({ tuning: correctTuning })
            .eq('id', song.id);
            
          if (updateError) {
            console.error(`Error updating song ${song.id}:`, updateError);
          } else {
            corrected++;
          }
        }
      }
    }
    
    return NextResponse.json({ 
      message: `Tuning cleanup complete`,
      total_songs: total,
      corrected: corrected,
      details: `Corrected ${corrected} songs out of ${total} total songs`
    });
    
  } catch (error) {
    console.error('Error in tuning cleanup:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}