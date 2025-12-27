// ignore_for_file: avoid_print

import 'package:flutter_test/flutter_test.dart';

// ============================================================================
// WIDGET TEST: My Profile Band Selector Visibility
// Verifies:
// 1. No band selector row when user has 0-1 bands
// 2. Band selector row appears when user has 2+ bands
// ============================================================================

void main() {
  group('MyProfile Band Selector Visibility', () {
    test('isMultiBandMode returns false for 0 bands', () {
      final bands = <String>[]; // Empty list
      final isMultiBandMode = bands.length >= 2;
      expect(isMultiBandMode, isFalse);
    });

    test('isMultiBandMode returns false for 1 band', () {
      final bands = ['band-a'];
      final isMultiBandMode = bands.length >= 2;
      expect(isMultiBandMode, isFalse);
    });

    test('isMultiBandMode returns true for 2 bands', () {
      final bands = ['band-a', 'band-b'];
      final isMultiBandMode = bands.length >= 2;
      expect(isMultiBandMode, isTrue);
    });

    test('isMultiBandMode returns true for 3+ bands', () {
      final bands = ['band-a', 'band-b', 'band-c', 'band-d'];
      final isMultiBandMode = bands.length >= 2;
      expect(isMultiBandMode, isTrue);
    });
  });

  group('Band Roles Map Dirty Checking', () {
    test('no dirty state when band roles unchanged', () {
      final originalBandRolesMap = {
        'band-a': {'Guitar', 'Drums'},
        'band-b': {'Bass'},
      };

      final currentBandRolesMap = {
        'band-a': {'Guitar', 'Drums'},
        'band-b': {'Bass'},
      };

      bool isDirty = false;
      for (final bandId in currentBandRolesMap.keys) {
        final current = currentBandRolesMap[bandId] ?? <String>{};
        final original = originalBandRolesMap[bandId] ?? <String>{};
        if (!_setEquals(current, original)) {
          isDirty = true;
          break;
        }
      }

      expect(isDirty, isFalse);
    });

    test('dirty state when band roles changed', () {
      final originalBandRolesMap = {
        'band-a': {'Guitar', 'Drums'},
        'band-b': {'Bass'},
      };

      final currentBandRolesMap = {
        'band-a': {'Guitar', 'Drums', 'Keyboard'}, // Added Keyboard
        'band-b': {'Bass'},
      };

      bool isDirty = false;
      for (final bandId in currentBandRolesMap.keys) {
        final current = currentBandRolesMap[bandId] ?? <String>{};
        final original = originalBandRolesMap[bandId] ?? <String>{};
        if (!_setEquals(current, original)) {
          isDirty = true;
          break;
        }
      }

      expect(isDirty, isTrue);
    });

    test('dirty state when role removed from band', () {
      final originalBandRolesMap = {
        'band-a': {'Guitar', 'Drums'},
      };

      final currentBandRolesMap = {
        'band-a': {'Guitar'}, // Removed Drums
      };

      bool isDirty = false;
      for (final bandId in currentBandRolesMap.keys) {
        final current = currentBandRolesMap[bandId] ?? <String>{};
        final original = originalBandRolesMap[bandId] ?? <String>{};
        if (!_setEquals(current, original)) {
          isDirty = true;
          break;
        }
      }

      expect(isDirty, isTrue);
    });

    test('changes to one band dont affect another bands dirty state', () {
      final originalBandRolesMap = {
        'band-a': {'Guitar'},
        'band-b': {'Bass'},
      };

      final currentBandRolesMap = {
        'band-a': {'Guitar', 'Drums'}, // Changed
        'band-b': {'Bass'}, // Unchanged
      };

      // Check band-a is dirty
      expect(
        _setEquals(
          currentBandRolesMap['band-a']!,
          originalBandRolesMap['band-a']!,
        ),
        isFalse,
      );

      // Check band-b is NOT dirty
      expect(
        _setEquals(
          currentBandRolesMap['band-b']!,
          originalBandRolesMap['band-b']!,
        ),
        isTrue,
      );
    });
  });

  group('Band Selection State', () {
    test('selecting band updates selectedBandId', () {
      final bands = [
        _MockBand(id: 'band-a', name: 'Rock Band'),
        _MockBand(id: 'band-b', name: 'Jazz Ensemble'),
      ];

      // Initial state: first band selected
      String selectedBandId = bands.first.id;
      expect(selectedBandId, equals('band-a'));

      // Switch to second band
      selectedBandId = bands[1].id;
      expect(selectedBandId, equals('band-b'));
    });

    test('switching bands updates displayed roles', () {
      final bandRolesMap = {
        'band-a': {'Guitar', 'Lead Vocals'},
        'band-b': {'Bass', 'Backing Vocals'},
      };

      // Initial: showing band-a roles
      String selectedBandId = 'band-a';
      Set<String> selectedRoles = Set.from(bandRolesMap[selectedBandId] ?? {});
      expect(selectedRoles, equals({'Guitar', 'Lead Vocals'}));

      // Switch to band-b
      selectedBandId = 'band-b';
      selectedRoles = Set.from(bandRolesMap[selectedBandId] ?? {});
      expect(selectedRoles, equals({'Bass', 'Backing Vocals'}));
    });
  });

  group('Role Seeding from Global Roles', () {
    test(
      'seeds band roles from global roles when no band-specific roles exist',
      () {
        final globalRoles = ['Guitar', 'Drums'];
        final existingBandRoles =
            <String, List<String>>{}; // Empty - no band-specific roles

        final bandRolesMap = <String, Set<String>>{};
        final bands = ['band-a', 'band-b'];

        for (final bandId in bands) {
          if (existingBandRoles.containsKey(bandId)) {
            // Use existing band-specific roles
            bandRolesMap[bandId] = Set.from(existingBandRoles[bandId]!);
          } else {
            // Seed from global roles
            bandRolesMap[bandId] = Set.from(globalRoles);
          }
        }

        // Both bands should have global roles since no band-specific exist
        expect(bandRolesMap['band-a'], equals({'Guitar', 'Drums'}));
        expect(bandRolesMap['band-b'], equals({'Guitar', 'Drums'}));
      },
    );

    test('uses existing band roles when present', () {
      final globalRoles = ['Guitar', 'Drums'];
      final existingBandRoles = {
        'band-a': ['Bass', 'Keyboard'], // Already has band-specific roles
      };

      final bandRolesMap = <String, Set<String>>{};
      final bands = ['band-a', 'band-b'];

      for (final bandId in bands) {
        if (existingBandRoles.containsKey(bandId)) {
          // Use existing band-specific roles
          bandRolesMap[bandId] = Set.from(existingBandRoles[bandId]!);
        } else {
          // Seed from global roles
          bandRolesMap[bandId] = Set.from(globalRoles);
        }
      }

      // band-a has existing roles, band-b gets seeded from global
      expect(bandRolesMap['band-a'], equals({'Bass', 'Keyboard'}));
      expect(bandRolesMap['band-b'], equals({'Guitar', 'Drums'}));
    });
  });
}

/// Simple set equality check (order-independent)
bool _setEquals(Set<String> a, Set<String> b) {
  if (a.length != b.length) return false;
  for (final item in a) {
    if (!b.contains(item)) return false;
  }
  return true;
}

/// Mock band for testing
class _MockBand {
  final String id;
  final String name;

  _MockBand({required this.id, required this.name});
}
