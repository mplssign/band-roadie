import { parseDurationToSeconds, formatSecondsHuman, calculateSetlistTotal } from '@/lib/time/duration';

describe('parseDurationToSeconds', () => {
  describe('time formats', () => {
    it('should parse M:SS format', () => {
      expect(parseDurationToSeconds('3:45')).toBe(225);
      expect(parseDurationToSeconds('03:45')).toBe(225);
      expect(parseDurationToSeconds('0:30')).toBe(30);
      expect(parseDurationToSeconds('10:05')).toBe(605);
    });

    it('should parse H:MM:SS format', () => {
      expect(parseDurationToSeconds('1:02:03')).toBe(3723);
      expect(parseDurationToSeconds('2:00:00')).toBe(7200);
      expect(parseDurationToSeconds('0:05:30')).toBe(330);
    });

    it('should handle time formats with spaces', () => {
      expect(parseDurationToSeconds(' 4 : 07 ')).toBe(247);
      expect(parseDurationToSeconds('1 : 02 : 03')).toBe(3723);
      expect(parseDurationToSeconds(' 3:45 ')).toBe(225);
    });
  });

  describe('minute/second notation', () => {
    it('should parse "Xm Ys" format', () => {
      expect(parseDurationToSeconds('3m 10s')).toBe(190);
      expect(parseDurationToSeconds('3m 5s')).toBe(185);
      expect(parseDurationToSeconds('2m')).toBe(120);
      expect(parseDurationToSeconds('45s')).toBe(45);
      expect(parseDurationToSeconds('1m 0s')).toBe(60);
    });
  });

  describe('numeric inputs', () => {
    it('should handle number inputs', () => {
      expect(parseDurationToSeconds(180)).toBe(180);
      expect(parseDurationToSeconds(0)).toBe(0);
      expect(parseDurationToSeconds(65.7)).toBe(65); // floors fractional
    });

    it('should handle string numbers', () => {
      expect(parseDurationToSeconds('180')).toBe(180);
      expect(parseDurationToSeconds('0')).toBe(0);
      expect(parseDurationToSeconds('65.5')).toBe(65);
    });

    it('should handle single digit as seconds', () => {
      expect(parseDurationToSeconds('5')).toBe(5);
      expect(parseDurationToSeconds('30')).toBe(30);
    });
  });

  describe('edge cases and invalid inputs', () => {
    it('should handle placeholder values', () => {
      expect(parseDurationToSeconds('—')).toBe(0);
      expect(parseDurationToSeconds('-')).toBe(0);
      expect(parseDurationToSeconds('TBD')).toBe(0);
      expect(parseDurationToSeconds('')).toBe(0);
      expect(parseDurationToSeconds('   ')).toBe(0);
    });

    it('should handle null and undefined', () => {
      expect(parseDurationToSeconds(null)).toBe(0);
      expect(parseDurationToSeconds(undefined)).toBe(0);
    });

    it('should handle text with numbers', () => {
      expect(parseDurationToSeconds('bpm 120')).toBe(120); // Extract number from text
      expect(parseDurationToSeconds('track 3')).toBe(3); // Extract reasonable duration
    });

    it('should handle negative numbers', () => {
      expect(parseDurationToSeconds(-5)).toBe(0);
      expect(parseDurationToSeconds('-30')).toBe(30); // Extracts 30 from text
    });

    it('should handle malformed time', () => {
      expect(parseDurationToSeconds(':::')).toBe(0);
      expect(parseDurationToSeconds('abc')).toBe(0);
      expect(parseDurationToSeconds('3:xx')).toBe(3); // Extracts first valid number
    });

    it('should handle commas and extra whitespace', () => {
      expect(parseDurationToSeconds('3,45')).toBe(3); // first number extracted from text with comma
      expect(parseDurationToSeconds('  3  :  45  ')).toBe(225);
    });

    it('should floor fractional seconds', () => {
      expect(parseDurationToSeconds(3.9)).toBe(3);
      expect(parseDurationToSeconds('3.9')).toBe(3);
    });
  });
});

describe('formatSecondsHuman', () => {
  it('should format seconds to M:SS when under 1 hour', () => {
    expect(formatSecondsHuman(65)).toBe('1:05');
    expect(formatSecondsHuman(30)).toBe('0:30');
    expect(formatSecondsHuman(605)).toBe('10:05');
    expect(formatSecondsHuman(3599)).toBe('59:59');
  });

  it('should format seconds to H:MM:SS when 1 hour or more', () => {
    expect(formatSecondsHuman(3600)).toBe('1:00:00');
    expect(formatSecondsHuman(3723)).toBe('1:02:03');
    expect(formatSecondsHuman(7265)).toBe('2:01:05');
    expect(formatSecondsHuman(36000)).toBe('10:00:00');
  });

  it('should handle zero and edge cases', () => {
    expect(formatSecondsHuman(0)).toBe('0:00');
    expect(formatSecondsHuman(1)).toBe('0:01');
    expect(formatSecondsHuman(60)).toBe('1:00');
  });

  it('should handle negative numbers (treat as zero)', () => {
    expect(formatSecondsHuman(-5)).toBe('0:00');
    expect(formatSecondsHuman(-100)).toBe('0:00');
  });

  it('should floor fractional seconds', () => {
    expect(formatSecondsHuman(65.9)).toBe('1:05');
    expect(formatSecondsHuman(3723.8)).toBe('1:02:03');
  });
});

describe('calculateSetlistTotal', () => {
  it('should calculate total with mixed duration sources', () => {
    const songs = [
      {
        id: '1',
        duration_seconds: 180, // Use this (priority 1)
        duration_text: '4:00',
        songs: { duration_seconds: 200 }
      },
      {
        id: '2',
        duration_seconds: null,
        duration_text: '3:30', // Use this (priority 2)
        songs: { duration_seconds: 250 }
      },
      {
        id: '3',
        duration_seconds: null,
        duration_text: null,
        songs: { duration_seconds: 160 } // Use this (priority 3)
      },
      {
        id: '4',
        duration_seconds: null,
        duration_text: '',
        songs: { duration_seconds: null } // Use 0 (fallback)
      }
    ];

    // 180 + 210 (3:30) + 160 + 0 = 550
    expect(calculateSetlistTotal(songs)).toBe(550);
  });

  it('should handle duplicate entries by ID (avoid double-counting)', () => {
    const songs = [
      {
        id: '1',
        duration_seconds: 180,
        duration_text: null,
        songs: null
      },
      {
        id: '1', // Duplicate - should be ignored
        duration_seconds: 180,
        duration_text: null,
        songs: null
      },
      {
        id: '2',
        duration_seconds: 200,
        duration_text: null,
        songs: null
      }
    ];

    // Should only count each ID once: 180 + 200 = 380
    expect(calculateSetlistTotal(songs)).toBe(380);
  });

  it('should handle empty array', () => {
    expect(calculateSetlistTotal([])).toBe(0);
  });

  it('should handle songs with no valid durations', () => {
    const songs = [
      {
        id: '1',
        duration_seconds: null,
        duration_text: '—',
        songs: null
      },
      {
        id: '2',
        duration_seconds: null,
        duration_text: '',
        songs: { duration_seconds: null }
      }
    ];

    expect(calculateSetlistTotal(songs)).toBe(0);
  });

  it('should parse duration_text correctly', () => {
    const songs = [
      {
        id: '1',
        duration_seconds: null,
        duration_text: '3:45',
        songs: null
      },
      {
        id: '2',
        duration_seconds: null,
        duration_text: '2m 30s',
        songs: null
      }
    ];

    // 225 (3:45) + 150 (2m 30s) = 375
    expect(calculateSetlistTotal(songs)).toBe(375);
  });

  it('should ignore entries without ID', () => {
    const songs = [
      {
        id: '1',
        duration_seconds: 180,
        duration_text: null,
        songs: null
      },
      {
        id: '', // Invalid ID
        duration_seconds: 200,
        duration_text: null,
        songs: null
      }
    ];

    // Should only count the valid ID: 180
    expect(calculateSetlistTotal(songs)).toBe(180);
  });
});