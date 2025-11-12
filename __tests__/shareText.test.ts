import { buildShareText } from '@/lib/utils/formatters';

describe('buildShareText', () => {
  it('should format share text exactly as specified', () => {
    const testSetlist = {
      name: 'New Songs',
      songs: [
        {
          title: "Don't Tell Me You Love Me",
          artist: 'Night Ranger',
          tuning: 'standard',
          durationSec: 263, // 4:23
          bpm: undefined
        },
        {
          title: 'Psycho Killer',
          artist: 'Talking Heads',
          tuning: 'standard', 
          durationSec: 260, // 4:20
          bpm: undefined
        },
        {
          title: 'Song Without Artist',
          artist: undefined,
          tuning: undefined,
          durationSec: 180, // 3:00
          bpm: 120
        }
      ]
    };

    const result = buildShareText(testSetlist);
    
    const expectedOutput = `Setlist: New Songs
Songs: 3 • Total Duration: 11:43


Don't Tell Me You Love Me
Night Ranger
Tuning: standard • 4:23 • — BPM

Psycho Killer
Talking Heads
Tuning: standard • 4:20 • — BPM

Song Without Artist

Tuning: standard • 3:00 • 120 BPM`;

    expect(result).toBe(expectedOutput);
  });

  it('should handle empty setlist', () => {
    const testSetlist = {
      name: 'Empty Setlist',
      songs: []
    };

    const result = buildShareText(testSetlist);
    
    const expectedOutput = `Setlist: Empty Setlist
Songs: 0 • Total Duration: 0:00


`;

    expect(result.trim()).toBe(expectedOutput.trim());
  });

  it('should format durations correctly', () => {
    const testSetlist = {
      name: 'Duration Test',
      songs: [
        {
          title: 'Short Song',
          artist: 'Artist',
          tuning: undefined,
          durationSec: 45, // 0:45
          bpm: undefined
        },
        {
          title: 'Long Song', 
          artist: 'Artist',
          tuning: undefined,
          durationSec: 3665, // 1:01:05
          bpm: undefined
        }
      ]
    };

    const result = buildShareText(testSetlist);
    
    // Check header duration (total)
    expect(result).toContain('Total Duration: 1:01:50');
    
    // Check individual song durations
    expect(result).toContain('Tuning: standard • 0:45 • — BPM');
    expect(result).toContain('Tuning: standard • 1:01:05 • — BPM');
  });
});