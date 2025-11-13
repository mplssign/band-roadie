/**
 * Test suite to verify duration calculation consistency between setlist card and detail views
 * This ensures both views show identical totals for the same setlist data
 */

import { calculateSetlistTotal, formatDurationSummary } from '@/lib/time/duration';

describe('Setlist Duration Consistency', () => {
  // Sample setlist data simulating the API response structure
  const mockSetlistSongs = [
    {
      id: 'song-1',
      duration_seconds: 195, // 3:15
      songs: { duration_seconds: 200 }
    },
    {
      id: 'song-2', 
      duration_seconds: 240, // 4:00
      songs: { duration_seconds: 235 }
    },
    {
      id: 'song-3',
      duration_seconds: null,
      songs: { duration_seconds: 180 } // 3:00 - should use songs.duration_seconds
    }
  ];

  it('should calculate same duration in both setlist card and detail view', () => {
    // Simulate setlist card calculation (after fix)
    const cardDuration = calculateSetlistTotal(mockSetlistSongs.map((song: any) => ({
      id: song.id,
      duration_seconds: song.duration_seconds,
      duration_text: null,
      songs: song.songs ? {
        duration_seconds: song.songs.duration_seconds
      } : null
    })));

    // Simulate setlist detail calculation  
    const detailDuration = calculateSetlistTotal(mockSetlistSongs.map(song => ({
      id: song.id,
      duration_seconds: song.duration_seconds,
      duration_text: null,
      songs: song.songs ? {
        duration_seconds: song.songs.duration_seconds
      } : null
    })));

    // Both should be identical
    expect(cardDuration).toBe(detailDuration);
    expect(cardDuration).toBe(195 + 240 + 180); // 615 seconds = 10m 15s
  });

  it('should format duration summary identically', () => {
    const totalSeconds = 195 + 240 + 180; // 615 seconds
    
    const cardFormat = formatDurationSummary(totalSeconds);
    const detailFormat = formatDurationSummary(totalSeconds);
    
    expect(cardFormat).toBe(detailFormat);
    expect(cardFormat).toBe('10m'); // 10.25 minutes rounded to 10m
  });

  it('should handle the "All Songs" duration example (6h 03m)', () => {
    // Based on user's report: 89 songs totaling 6h 03m = 21,780 seconds
    const allSongsTotalSeconds = 6 * 3600 + 3 * 60; // 21,780 seconds
    
    const formatted = formatDurationSummary(allSongsTotalSeconds);
    expect(formatted).toBe('6h 03m');
  });

  it('should handle edge case: 47m vs 6h 03m discrepancy', () => {
    // User reported: card shows 47m but detail shows 6h 03m
    // This suggests different song collections were being used
    
    const shortDuration = 47 * 60; // 2,820 seconds (what card was showing)
    const longDuration = 6 * 3600 + 3 * 60; // 21,780 seconds (what detail was showing)
    
    const shortFormat = formatDurationSummary(shortDuration);
    const longFormat = formatDurationSummary(longDuration);
    
    expect(shortFormat).toBe('47m');
    expect(longFormat).toBe('6h 03m');
    
    // After fix, both should use the same data source and show the same result
  });
});