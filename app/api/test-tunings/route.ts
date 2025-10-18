import { NextResponse } from 'next/server';
import { getTuningInfo } from '@/lib/utils/tuning';
import { TuningType } from '@/lib/types';

export async function GET() {
  // Test all tuning types
  const tunings: TuningType[] = ['standard', 'drop_d', 'half_step', 'full_step'];
  
  const testSongs = tunings.map((tuning, index) => {
    const tuningInfo = getTuningInfo(tuning);
    return {
      id: `test-${index}`,
      tuning,
      tuning_name: tuningInfo.name,
      tuning_notes: tuningInfo.notes,
      position: index + 1,
      songs: {
        id: `song-${index}`,
        title: `Test Song ${index + 1}`,
        artist: 'Test Artist',
        is_live: false
      }
    };
  });

  return NextResponse.json({ test_songs: testSongs });
}