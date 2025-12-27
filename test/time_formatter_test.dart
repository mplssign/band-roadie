import 'package:flutter_test/flutter_test.dart';
import 'package:tonyholmes/app/utils/time_formatter.dart';

void main() {
  group('TimeFormatter.parse', () {
    test('parses 12-hour format with uppercase AM/PM', () {
      final result = TimeFormatter.parse('6:00 PM');
      expect(result.hour, 6);
      expect(result.minutes, 0);
      expect(result.isPM, true);
      expect(result.format(), '6:00 PM');
    });

    test('parses 12-hour format with lowercase am/pm', () {
      final result = TimeFormatter.parse('6:00 pm');
      expect(result.hour, 6);
      expect(result.minutes, 0);
      expect(result.isPM, true);
      expect(result.format(), '6:00 PM');
    });

    test('parses 12-hour format without space before AM/PM', () {
      final result = TimeFormatter.parse('7:30PM');
      expect(result.hour, 7);
      expect(result.minutes, 30);
      expect(result.isPM, true);
      expect(result.format(), '7:30 PM');
    });

    test('parses 12-hour format with extra whitespace', () {
      final result = TimeFormatter.parse('  8:15 AM  ');
      expect(result.hour, 8);
      expect(result.minutes, 15);
      expect(result.isPM, false);
      expect(result.format(), '8:15 AM');
    });

    test('parses 24-hour format (evening)', () {
      final result = TimeFormatter.parse('18:00');
      expect(result.hour, 6);
      expect(result.minutes, 0);
      expect(result.isPM, true);
      expect(result.format(), '6:00 PM');
    });

    test('parses 24-hour format with seconds', () {
      // Should still work, seconds get ignored
      final result = TimeFormatter.parse('18:00:00');
      expect(result.hour, 6);
      expect(result.minutes, 0);
      expect(result.isPM, true);
    });

    test('parses 24-hour format (morning)', () {
      final result = TimeFormatter.parse('09:30');
      expect(result.hour, 9);
      expect(result.minutes, 30);
      expect(result.isPM, false);
      expect(result.format(), '9:30 AM');
    });

    test('parses midnight (00:00) correctly', () {
      final result = TimeFormatter.parse('00:00');
      expect(result.hour, 12);
      expect(result.minutes, 0);
      expect(result.isPM, false);
      expect(result.format(), '12:00 AM');
    });

    test('parses noon (12:00) correctly in 24h format', () {
      final result = TimeFormatter.parse('12:00');
      expect(result.hour, 12);
      expect(result.minutes, 0);
      expect(result.isPM, true);
      expect(result.format(), '12:00 PM');
    });

    test('parses noon (12:00 PM) correctly in 12h format', () {
      final result = TimeFormatter.parse('12:00 PM');
      expect(result.hour, 12);
      expect(result.minutes, 0);
      expect(result.isPM, true);
      expect(result.format(), '12:00 PM');
    });

    test('parses 12:00 AM (midnight in 12h format) correctly', () {
      final result = TimeFormatter.parse('12:00 AM');
      expect(result.hour, 12);
      expect(result.minutes, 0);
      expect(result.isPM, false);
      expect(result.format(), '12:00 AM');
    });

    test('returns default for null input', () {
      final result = TimeFormatter.parse(null);
      expect(result.hour, 7);
      expect(result.minutes, 0);
      expect(result.isPM, true);
      expect(result.format(), '7:00 PM');
    });

    test('returns default for empty string', () {
      final result = TimeFormatter.parse('');
      expect(result.hour, 7);
      expect(result.minutes, 0);
      expect(result.isPM, true);
    });

    test('returns default for invalid format', () {
      final result = TimeFormatter.parse('not a time');
      expect(result.hour, 7);
      expect(result.minutes, 0);
      expect(result.isPM, true);
    });
  });

  group('TimeFormatter.formatRange', () {
    test('formats 12-hour times correctly', () {
      final result = TimeFormatter.formatRange('6:00 PM', '8:00 PM');
      expect(result, '6:00 PM - 8:00 PM');
    });

    test('formats 24-hour times to 12-hour display', () {
      final result = TimeFormatter.formatRange('18:00', '20:00');
      expect(result, '6:00 PM - 8:00 PM');
    });

    test('formats mixed formats correctly', () {
      final result = TimeFormatter.formatRange('18:00', '8:00 PM');
      expect(result, '6:00 PM - 8:00 PM');
    });

    test('handles lowercase am/pm', () {
      final result = TimeFormatter.formatRange('6:00 pm', '8:00 pm');
      expect(result, '6:00 PM - 8:00 PM');
    });

    test('handles extra whitespace', () {
      final result = TimeFormatter.formatRange('  6:00 PM  ', '  8:00 PM  ');
      expect(result, '6:00 PM - 8:00 PM');
    });
  });

  group('TimeFormatter.durationMinutes', () {
    test('calculates simple duration', () {
      final result = TimeFormatter.durationMinutes('6:00 PM', '8:00 PM');
      expect(result, 120);
    });

    test('calculates duration with 24-hour format', () {
      final result = TimeFormatter.durationMinutes('18:00', '20:00');
      expect(result, 120);
    });

    test('handles overnight events', () {
      final result = TimeFormatter.durationMinutes('10:00 PM', '2:00 AM');
      expect(result, 240); // 4 hours
    });

    test('calculates duration with minutes', () {
      final result = TimeFormatter.durationMinutes('7:30 PM', '10:00 PM');
      expect(result, 150); // 2.5 hours
    });
  });

  group('ParsedTime.hour24', () {
    test('converts PM hour correctly', () {
      final parsed = TimeFormatter.parse('6:00 PM');
      expect(parsed.hour24, 18);
    });

    test('converts AM hour correctly', () {
      final parsed = TimeFormatter.parse('9:00 AM');
      expect(parsed.hour24, 9);
    });

    test('converts 12 PM (noon) correctly', () {
      final parsed = TimeFormatter.parse('12:00 PM');
      expect(parsed.hour24, 12);
    });

    test('converts 12 AM (midnight) correctly', () {
      final parsed = TimeFormatter.parse('12:00 AM');
      expect(parsed.hour24, 0);
    });
  });
}
