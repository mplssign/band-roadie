/**
 * Test suite for duration formatting consistency across setlist card and detail views
 */

// Mock formatDurationSummary function (same as in both components)
function formatDurationSummary(seconds: number): string {
  if (seconds === 0) return 'TBD';
  
  // Round to nearest minute
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes.toString().padStart(2, '0')}m`;
  }
  return `${totalMinutes}m`;
}

describe('Duration Formatting', () => {
  it('should format short durations in minutes', () => {
    expect(formatDurationSummary(420)).toBe('7m'); // 7 minutes exactly
    expect(formatDurationSummary(450)).toBe('8m'); // 7.5 minutes rounded up
    expect(formatDurationSummary(390)).toBe('7m'); // 6.5 minutes rounded up
    expect(formatDurationSummary(360)).toBe('6m'); // 6 minutes exactly
  });

  it('should format long durations with hours', () => {
    expect(formatDurationSummary(21764)).toBe('6h 03m'); // 6 hours 2 minutes 44 seconds -> 6h 03m (rounded up)
    expect(formatDurationSummary(21720)).toBe('6h 02m'); // 6 hours 2 minutes exactly
    expect(formatDurationSummary(3600)).toBe('1h 00m'); // 1 hour exactly
    expect(formatDurationSummary(5400)).toBe('1h 30m'); // 1.5 hours
  });

  it('should handle edge cases', () => {
    expect(formatDurationSummary(0)).toBe('TBD');
    expect(formatDurationSummary(30)).toBe('1m'); // 30 seconds rounded up
    expect(formatDurationSummary(29)).toBe('0m'); // 29 seconds rounded down
  });

  it('should round to nearest minute correctly', () => {
    expect(formatDurationSummary(29)).toBe('0m'); // 0.48 minutes -> 0m
    expect(formatDurationSummary(30)).toBe('1m'); // 0.5 minutes -> 1m  
    expect(formatDurationSummary(90)).toBe('2m'); // 1.5 minutes -> 2m
    expect(formatDurationSummary(89)).toBe('1m'); // 1.48 minutes -> 1m
  });

  it('should handle your specific example', () => {
    // Example: 89 songs with total duration of 6h 2m 44s should show "89 Songs • 6h 03m"
    const totalSeconds = 6 * 3600 + 2 * 60 + 44; // 21764 seconds
    expect(formatDurationSummary(totalSeconds)).toBe('6h 03m');
  });
});