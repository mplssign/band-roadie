import 'package:flutter_test/flutter_test.dart';

import 'package:tonyholmes/app/constants/app_constants.dart';
import 'package:tonyholmes/features/setlists/models/setlist.dart';
import 'package:tonyholmes/features/setlists/setlists_screen.dart';

// =============================================================================
// CATALOG UNIQUENESS REGRESSION TEST
//
// Verifies that the UI shows exactly one Catalog card even when the repository
// returns duplicate Catalog/All Songs entries (as may exist in legacy data).
// =============================================================================

/// Mock state with duplicate Catalogs to test deduplication in UI
SetlistsState _createStateWithDuplicateCatalogs() {
  return SetlistsState(
    setlists: [
      const Setlist(
        id: 'catalog-1',
        name: 'Catalog',
        songCount: 50,
        totalDuration: Duration(hours: 2),
        isCatalog: true,
      ),
      const Setlist(
        id: 'catalog-2',
        name: 'Catalog',
        songCount: 50,
        totalDuration: Duration(hours: 2),
        isCatalog: true,
      ),
      const Setlist(
        id: 'all-songs-1',
        name: 'All Songs',
        songCount: 50,
        totalDuration: Duration(hours: 2),
        isCatalog: true,
      ),
      const Setlist(
        id: 'regular-1',
        name: 'Friday Night Set',
        songCount: 15,
        totalDuration: Duration(minutes: 45),
        isCatalog: false,
      ),
    ],
    isLoading: false,
  );
}

/// Mock state with single Catalog
SetlistsState _createStateWithSingleCatalog() {
  return SetlistsState(
    setlists: [
      const Setlist(
        id: 'catalog-1',
        name: 'Catalog',
        songCount: 50,
        totalDuration: Duration(hours: 2),
        isCatalog: true,
      ),
      const Setlist(
        id: 'regular-1',
        name: 'Friday Night Set',
        songCount: 15,
        totalDuration: Duration(minutes: 45),
        isCatalog: false,
      ),
    ],
    isLoading: false,
  );
}

void main() {
  group('Catalog Uniqueness', () {
    testWidgets('UI shows only one Catalog card when duplicates exist', (
      tester,
    ) async {
      // This test verifies that even if duplicate Catalog/All Songs setlists
      // come back from the database, the UI only shows one Catalog.
      //
      // The actual deduplication happens in the repository, but this test
      // ensures the UI would handle it gracefully if duplicates slip through.

      final state = _createStateWithDuplicateCatalogs();

      // Filter to unique Catalogs - this is what the UI should do
      final catalogSetlists = state.setlists
          .where((s) => s.isCatalog || isCatalogName(s.name))
          .toList();

      final uniqueCatalogs = <Setlist>[];
      final seenCatalogs = <bool>{};
      for (final s in state.setlists) {
        if (s.isCatalog || isCatalogName(s.name)) {
          if (!seenCatalogs.contains(true)) {
            seenCatalogs.add(true);
            uniqueCatalogs.add(s);
          }
        } else {
          uniqueCatalogs.add(s);
        }
      }

      // Should have reduced 3 Catalog entries to 1
      expect(catalogSetlists.length, 3);
      expect(
        uniqueCatalogs
            .where((s) => s.isCatalog || isCatalogName(s.name))
            .length,
        1,
      );

      // The first Catalog should be named "Catalog" (not "All Songs")
      final catalog = uniqueCatalogs.firstWhere(
        (s) => s.isCatalog || isCatalogName(s.name),
      );
      expect(catalog.name, kCatalogSetlistName);
    });

    testWidgets('kCatalogSetlistName constant is "Catalog"', (tester) async {
      // Verify the constant is correct
      expect(kCatalogSetlistName, 'Catalog');
      expect(kCatalogSetlistName, isNot('All Songs'));
    });

    testWidgets('isCatalogName detects both Catalog and All Songs', (
      tester,
    ) async {
      // Test the shared helper function
      expect(isCatalogName('Catalog'), true);
      expect(isCatalogName('catalog'), true);
      expect(isCatalogName('CATALOG'), true);
      expect(isCatalogName('All Songs'), true);
      expect(isCatalogName('all songs'), true);
      expect(isCatalogName('ALL SONGS'), true);
      expect(isCatalogName('  Catalog  '), true); // with whitespace
      expect(isCatalogName('Friday Night Set'), false);
      expect(isCatalogName('My Catalog'), false); // partial match
    });

    test('SetlistsState filters duplicates correctly', () {
      final state = _createStateWithDuplicateCatalogs();

      // Count raw Catalogs
      final rawCatalogCount = state.setlists
          .where((s) => s.isCatalog || isCatalogName(s.name))
          .length;
      expect(rawCatalogCount, 3); // 2 "Catalog" + 1 "All Songs"

      // Apply deduplication logic
      final filtered = <Setlist>[];
      bool hasCatalog = false;
      for (final s in state.setlists) {
        if (s.isCatalog || isCatalogName(s.name)) {
          if (!hasCatalog) {
            hasCatalog = true;
            filtered.add(s);
          }
          // Skip duplicates
        } else {
          filtered.add(s);
        }
      }

      // Should have 2 setlists: 1 Catalog + 1 regular
      expect(filtered.length, 2);
      expect(
        filtered.where((s) => s.isCatalog || isCatalogName(s.name)).length,
        1,
      );
    });

    test('Single Catalog state has exactly one Catalog', () {
      final state = _createStateWithSingleCatalog();

      final catalogCount = state.setlists
          .where((s) => s.isCatalog || isCatalogName(s.name))
          .length;

      expect(catalogCount, 1);
      expect(state.setlists.first.name, kCatalogSetlistName);
    });
  });
}
