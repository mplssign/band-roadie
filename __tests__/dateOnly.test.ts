import { formatBirthdayDisplay, createDateOnlyString, parseDateOnlyString, monthNameToNumber } from '@/lib/utils/dateOnly';

describe('Date-Only Utilities', () => {
  describe('formatBirthdayDisplay', () => {
    test('formats valid date strings correctly', () => {
      expect(formatBirthdayDisplay('1970-11-09')).toBe('November 9');
      expect(formatBirthdayDisplay('1970-01-01')).toBe('January 1');
      expect(formatBirthdayDisplay('1970-12-31')).toBe('December 31');
      expect(formatBirthdayDisplay('2000-02-29')).toBe('February 29'); // leap year
    });

    test('handles invalid input gracefully', () => {
      expect(formatBirthdayDisplay(null)).toBe('');
      expect(formatBirthdayDisplay(undefined)).toBe('');
      expect(formatBirthdayDisplay('')).toBe('');
      expect(formatBirthdayDisplay('invalid')).toBe('');
      expect(formatBirthdayDisplay('1970-13-01')).toBe(''); // invalid month
      expect(formatBirthdayDisplay('1970-01-32')).toBe(''); // invalid day
      expect(formatBirthdayDisplay('70-01-01')).toBe(''); // incomplete year
    });

    test('is timezone-agnostic', () => {
      // This should always return the same result regardless of timezone
      const result = formatBirthdayDisplay('1970-11-09');
      expect(result).toBe('November 9');
      
      // Test around DST boundaries (these used to cause issues with Date objects)
      expect(formatBirthdayDisplay('1970-11-01')).toBe('November 1');
      expect(formatBirthdayDisplay('1970-03-15')).toBe('March 15');
    });
  });

  describe('createDateOnlyString', () => {
    test('creates proper date strings', () => {
      expect(createDateOnlyString(1970, 11, 9)).toBe('1970-11-09');
      expect(createDateOnlyString(1970, 1, 1)).toBe('1970-01-01');
      expect(createDateOnlyString(2000, 12, 31)).toBe('2000-12-31');
    });

    test('pads single digits correctly', () => {
      expect(createDateOnlyString(1970, 3, 5)).toBe('1970-03-05');
      expect(createDateOnlyString(1970, 10, 5)).toBe('1970-10-05');
    });
  });

  describe('parseDateOnlyString', () => {
    test('parses valid date strings', () => {
      expect(parseDateOnlyString('1970-11-09')).toEqual({ year: 1970, month: 11, day: 9 });
      expect(parseDateOnlyString('2000-01-01')).toEqual({ year: 2000, month: 1, day: 1 });
    });

    test('returns null for invalid input', () => {
      expect(parseDateOnlyString('')).toBeNull();
      expect(parseDateOnlyString('invalid')).toBeNull();
      expect(parseDateOnlyString('1970-13-01')).toBeNull(); // invalid month
      expect(parseDateOnlyString('1970-01-32')).toBeNull(); // invalid day
      expect(parseDateOnlyString('70-01-01')).toBeNull(); // incomplete year
    });
  });

  describe('monthNameToNumber', () => {
    test('converts month names to numbers', () => {
      expect(monthNameToNumber('JAN')).toBe(1);
      expect(monthNameToNumber('JANUARY')).toBe(1);
      expect(monthNameToNumber('NOV')).toBe(11);
      expect(monthNameToNumber('NOVEMBER')).toBe(11);
      expect(monthNameToNumber('DEC')).toBe(12);
      expect(monthNameToNumber('DECEMBER')).toBe(12);
    });

    test('is case-insensitive', () => {
      expect(monthNameToNumber('jan')).toBe(1);
      expect(monthNameToNumber('Jan')).toBe(1);
      expect(monthNameToNumber('november')).toBe(11);
    });

    test('returns null for invalid input', () => {
      expect(monthNameToNumber('INVALID')).toBeNull();
      expect(monthNameToNumber('')).toBeNull();
      expect(monthNameToNumber('13')).toBeNull();
    });
  });

  describe('Integration Test: Profile Save -> Members Display', () => {
    test('birthday survives the full save/display cycle without timezone conversion', () => {
      // Simulate what happens in ProfileForm when user selects November 9
      const monthIndex = 10; // November (0-based)
      const day = 9;
      const savedBirthday = `1970-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      expect(savedBirthday).toBe('1970-11-09');
      
      // Simulate what happens in Members page when displaying this birthday
      const displayText = formatBirthdayDisplay(savedBirthday);
      
      expect(displayText).toBe('November 9');
    });
  });
});