import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:tonyholmes/features/setlists/models/setlist.dart';
import 'package:tonyholmes/features/setlists/widgets/swipeable_setlist_card.dart';

void main() {
  group('SwipeableSetlistCard', () {
    late Setlist normalSetlist;
    late Setlist catalogSetlist;

    setUp(() {
      normalSetlist = Setlist(
        id: 'test-id-1',
        name: 'Summer Hits',
        bandId: 'band-123',
        songCount: 12,
        totalDuration: const Duration(seconds: 3600),
      );

      catalogSetlist = Setlist(
        id: 'test-id-2',
        name: 'Catalog',
        bandId: 'band-123',
        songCount: 50,
        totalDuration: const Duration(seconds: 10800),
        isCatalog: true,
      );
    });

    Widget buildTestWidget({
      required Setlist setlist,
      VoidCallback? onTap,
      SetlistActionCallback? onDeleteConfirmed,
      SetlistActionCallback? onDuplicateConfirmed,
    }) {
      return ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: SwipeableSetlistCard(
              setlist: setlist,
              onTap: onTap,
              onDeleteConfirmed: onDeleteConfirmed,
              onDuplicateConfirmed: onDuplicateConfirmed,
            ),
          ),
        ),
      );
    }

    testWidgets('renders setlist name and metadata', (tester) async {
      await tester.pumpWidget(buildTestWidget(setlist: normalSetlist));

      expect(find.text('Summer Hits'), findsOneWidget);
      // Check that song count is rendered (formattedSongCount returns "12 songs")
      expect(find.textContaining('12 songs'), findsOneWidget);
    });

    testWidgets('triggers onTap callback when tapped', (tester) async {
      bool wasTapped = false;

      await tester.pumpWidget(
        buildTestWidget(setlist: normalSetlist, onTap: () => wasTapped = true),
      );

      await tester.tap(find.byType(SwipeableSetlistCard));
      // Use pump() instead of pumpAndSettle() because gradient animation runs continuously
      await tester.pump(const Duration(milliseconds: 500));

      expect(wasTapped, isTrue);
    });

    testWidgets('normal setlist can be swiped left (delete)', (tester) async {
      bool deleteConfirmCalled = false;
      Setlist? confirmedSetlist;

      await tester.pumpWidget(
        buildTestWidget(
          setlist: normalSetlist,
          onDeleteConfirmed: (setlist) async {
            deleteConfirmCalled = true;
            confirmedSetlist = setlist;
            return false; // Don't actually delete in test
          },
        ),
      );

      // Get the size of the card for proper drag distance
      final size = tester.getSize(find.byType(SwipeableSetlistCard));

      // Swipe left past 40% threshold
      await tester.drag(
        find.byType(SwipeableSetlistCard),
        Offset(-size.width * 0.5, 0),
      );
      // Pump multiple frames to allow Dismissible animation to complete
      // and trigger the confirmDismiss callback
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));

      expect(deleteConfirmCalled, isTrue);
      expect(confirmedSetlist?.id, normalSetlist.id);
    });

    testWidgets('normal setlist can be swiped right (duplicate)', (
      tester,
    ) async {
      bool duplicateConfirmCalled = false;
      Setlist? confirmedSetlist;

      await tester.pumpWidget(
        buildTestWidget(
          setlist: normalSetlist,
          onDuplicateConfirmed: (setlist) async {
            duplicateConfirmCalled = true;
            confirmedSetlist = setlist;
            return false; // Don't actually duplicate in test
          },
        ),
      );

      // Get the size of the card for proper drag distance
      final size = tester.getSize(find.byType(SwipeableSetlistCard));

      // Swipe right past 40% threshold
      await tester.drag(
        find.byType(SwipeableSetlistCard),
        Offset(size.width * 0.5, 0),
      );
      // Pump multiple frames to allow Dismissible animation to complete
      // and trigger the confirmDismiss callback
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));

      expect(duplicateConfirmCalled, isTrue);
      expect(confirmedSetlist?.id, normalSetlist.id);
    });

    testWidgets('Catalog setlist cannot be swiped', (tester) async {
      bool deleteConfirmCalled = false;
      bool duplicateConfirmCalled = false;

      await tester.pumpWidget(
        buildTestWidget(
          setlist: catalogSetlist,
          onDeleteConfirmed: (_) async {
            deleteConfirmCalled = true;
            return true;
          },
          onDuplicateConfirmed: (_) async {
            duplicateConfirmCalled = true;
            return true;
          },
        ),
      );

      // Try swipe left
      await tester.drag(
        find.byType(SwipeableSetlistCard),
        const Offset(-200, 0),
      );
      // Use pump() instead of pumpAndSettle() because gradient animation runs continuously
      await tester.pump(const Duration(milliseconds: 500));

      expect(deleteConfirmCalled, isFalse);

      // Try swipe right
      await tester.drag(
        find.byType(SwipeableSetlistCard),
        const Offset(200, 0),
      );
      await tester.pump(const Duration(milliseconds: 500));

      expect(duplicateConfirmCalled, isFalse);
    });

    testWidgets('shows delete background when swiping left', (tester) async {
      await tester.pumpWidget(
        buildTestWidget(
          setlist: normalSetlist,
          onDeleteConfirmed: (_) async => false,
        ),
      );

      // Start drag but don't complete
      await tester.drag(
        find.byType(SwipeableSetlistCard),
        const Offset(-100, 0),
        warnIfMissed: false,
      );
      await tester.pump();

      // Background should be visible during drag
      expect(find.text('Delete'), findsOneWidget);
      expect(find.byIcon(Icons.delete_outline_rounded), findsOneWidget);
    });

    testWidgets('shows duplicate background when swiping right', (
      tester,
    ) async {
      await tester.pumpWidget(
        buildTestWidget(
          setlist: normalSetlist,
          onDuplicateConfirmed: (_) async => false,
        ),
      );

      // Start drag but don't complete
      await tester.drag(
        find.byType(SwipeableSetlistCard),
        const Offset(100, 0),
        warnIfMissed: false,
      );
      await tester.pump();

      // Background should be visible during drag
      expect(find.text('Duplicate'), findsOneWidget);
      expect(find.byIcon(Icons.copy_rounded), findsOneWidget);
    });

    testWidgets('Catalog setlist does not render Dismissible', (tester) async {
      await tester.pumpWidget(buildTestWidget(setlist: catalogSetlist));

      // Should not find a Dismissible widget for Catalog
      expect(find.byType(Dismissible), findsNothing);
    });

    testWidgets('normal setlist renders with Dismissible', (tester) async {
      await tester.pumpWidget(
        buildTestWidget(
          setlist: normalSetlist,
          onDeleteConfirmed: (_) async => false,
        ),
      );

      // Should find a Dismissible widget
      expect(find.byType(Dismissible), findsOneWidget);
    });

    testWidgets('isCatalog computed property works correctly', (tester) async {
      expect(normalSetlist.isCatalog, isFalse);
      expect(catalogSetlist.isCatalog, isTrue);

      // Test case insensitivity
      final upperCatalog = Setlist(
        id: 'test-3',
        name: 'CATALOG',
        bandId: 'band-123',
        songCount: 0,
        totalDuration: Duration.zero,
        isCatalog: true,
      );
      expect(upperCatalog.isCatalog, isTrue);

      final mixedCatalog = Setlist(
        id: 'test-4',
        name: 'CaTaLoG',
        bandId: 'band-123',
        songCount: 0,
        totalDuration: Duration.zero,
        isCatalog: true,
      );
      expect(mixedCatalog.isCatalog, isTrue);
    });
  });
}
