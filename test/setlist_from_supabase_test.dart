import 'package:flutter_test/flutter_test.dart';

import 'package:tonyholmes/features/setlists/models/setlist.dart';

void main() {
  group('Setlist.fromSupabase', () {
    test('parses complete valid JSON', () {
      final json = {
        'id': '123e4567-e89b-12d3-a456-426614174000',
        'name': 'Summer Hits',
        'band_id': '987e6543-e21b-12d3-a456-426614174000',
        'total_duration': 3600,
        'is_catalog': false,
        'created_at': '2025-01-01T12:00:00Z',
        'updated_at': '2025-01-15T14:30:00Z',
        'song_count': 12,
      };

      final setlist = Setlist.fromSupabase(json);

      expect(setlist.id, '123e4567-e89b-12d3-a456-426614174000');
      expect(setlist.name, 'Summer Hits');
      expect(setlist.bandId, '987e6543-e21b-12d3-a456-426614174000');
      expect(setlist.totalDuration, const Duration(seconds: 3600));
      expect(setlist.isCatalog, false);
      expect(setlist.songCount, 12);
      expect(setlist.lastUpdated, isNotNull);
      expect(setlist.lastUpdated!.year, 2025);
    });

    test('handles total_duration as int', () {
      final json = {'id': 'test-id', 'name': 'Test', 'total_duration': 1800};

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.totalDuration, const Duration(seconds: 1800));
    });

    test('handles total_duration as double', () {
      final json = {'id': 'test-id', 'name': 'Test', 'total_duration': 1800.5};

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.totalDuration, const Duration(seconds: 1800));
    });

    test('handles total_duration as String', () {
      final json = {'id': 'test-id', 'name': 'Test', 'total_duration': '1800'};

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.totalDuration, const Duration(seconds: 1800));
    });

    test('handles missing total_duration', () {
      final json = {'id': 'test-id', 'name': 'Test'};

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.totalDuration, Duration.zero);
    });

    test('handles null total_duration', () {
      final json = {'id': 'test-id', 'name': 'Test', 'total_duration': null};

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.totalDuration, Duration.zero);
    });

    test('handles created_at as null', () {
      final json = {
        'id': 'test-id',
        'name': 'Test',
        'created_at': null,
        'updated_at': null,
      };

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.lastUpdated, isNull);
    });

    test('handles updated_at with invalid format gracefully', () {
      final json = {
        'id': 'test-id',
        'name': 'Test',
        'updated_at': 'not-a-date',
      };

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.lastUpdated, isNull);
    });

    test('handles snake_case keys', () {
      final json = {
        'id': 'test-id',
        'name': 'Test',
        'band_id': 'band-123',
        'total_duration': 600,
        'is_catalog': true,
        'song_count': 5,
      };

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.bandId, 'band-123');
      expect(setlist.totalDuration, const Duration(seconds: 600));
      expect(setlist.isCatalog, true);
      expect(setlist.songCount, 5);
    });

    test('handles camelCase keys', () {
      final json = {
        'id': 'test-id',
        'name': 'Test',
        'bandId': 'band-456',
        'totalDuration': 900,
        'isCatalog': false,
      };

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.bandId, 'band-456');
      expect(setlist.totalDuration, const Duration(seconds: 900));
      expect(setlist.isCatalog, false);
    });

    test('prefers snake_case over camelCase when both present', () {
      final json = {
        'id': 'test-id',
        'name': 'Test',
        'band_id': 'snake-wins',
        'bandId': 'camel-loses',
        'total_duration': 100,
        'totalDuration': 200,
      };

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.bandId, 'snake-wins');
      expect(setlist.totalDuration, const Duration(seconds: 100));
    });

    test('handles is_catalog as bool true', () {
      final json = {'id': 'test-id', 'name': 'Catalog', 'is_catalog': true};

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.isCatalog, true);
    });

    test('handles is_catalog as bool false', () {
      final json = {'id': 'test-id', 'name': 'Catalog', 'is_catalog': false};

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.isCatalog, false);
    });

    test('falls back to name check when is_catalog is missing', () {
      final json = {'id': 'test-id', 'name': 'Catalog'};

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.isCatalog, true);
    });

    test('name check is case insensitive for Catalog', () {
      final json = {'id': 'test-id', 'name': 'CATALOG'};

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.isCatalog, true);
    });

    test('non-catalog name with missing is_catalog returns false', () {
      final json = {'id': 'test-id', 'name': 'Rock Hits'};

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.isCatalog, false);
    });

    test('handles song_count as double', () {
      final json = {'id': 'test-id', 'name': 'Test', 'song_count': 15.0};

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.songCount, 15);
    });

    test('handles song_count as String', () {
      final json = {'id': 'test-id', 'name': 'Test', 'song_count': '20'};

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.songCount, 20);
    });

    test('handles missing id by generating fallback', () {
      final json = {'name': 'Test'};

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.id, startsWith('unknown-'));
      expect(setlist.name, 'Test');
    });

    test('handles missing name with default', () {
      final json = {'id': 'test-id'};

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.name, 'Untitled');
    });

    test('handles null name with default', () {
      final json = {'id': 'test-id', 'name': null};

      final setlist = Setlist.fromSupabase(json);
      expect(setlist.name, 'Untitled');
    });

    test('handles empty JSON without throwing', () {
      final json = <String, dynamic>{};

      // Should not throw - uses all defaults
      final setlist = Setlist.fromSupabase(json);
      expect(setlist.id, startsWith('unknown-'));
      expect(setlist.name, 'Untitled');
      expect(setlist.songCount, 0);
      expect(setlist.totalDuration, Duration.zero);
      expect(setlist.isCatalog, false); // 'Untitled' is not 'catalog'
    });

    test('handles completely malformed values gracefully', () {
      final json = {
        'id': 12345, // wrong type - should convert to string
        'name': ['array', 'not', 'string'], // wrong type
        'total_duration': {'object': 'not int'}, // wrong type
        'is_catalog': 'yes', // string instead of bool
      };

      // Should not throw - uses safe conversions
      final setlist = Setlist.fromSupabase(json);
      expect(setlist.id, '12345');
      // Array.toString() gives [array, not, string]
      expect(setlist.name, contains('array'));
      expect(setlist.totalDuration, Duration.zero); // fallback
      expect(setlist.isCatalog, true); // 'yes' -> true
    });
  });
}
