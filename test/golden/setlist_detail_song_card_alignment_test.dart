// ignore_for_file: avoid_print

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:golden_toolkit/golden_toolkit.dart';

import 'package:tonyholmes/app/theme/design_tokens.dart';
import 'package:tonyholmes/features/setlists/models/setlist_song.dart';
import 'package:tonyholmes/features/setlists/widgets/song_card.dart';

// ============================================================================
// GOLDEN TEST: SONG CARD 3-COLUMN ALIGNMENT
// Verifies that the Duration column x-position is identical across cards
// regardless of:
// - Long vs short title/artist
// - BPM null vs set (placeholder vs number)
// - duration null vs set
// - different tuning badge widths/labels
// ============================================================================

void main() {
  setUpAll(() async {
    // Load fonts for golden tests
    await loadAppFonts();
  });

  group('SongCard 3-Column Alignment', () {
    testGoldens('maintains fixed column alignment across variance scenarios', (
      tester,
    ) async {
      // Test cards with deliberate variance
      final testCards = [
        // 1. Long title, bpm=120, duration=225 (3:45)
        const SetlistSong(
          id: '1',
          title: 'This Is A Really Long Song Title That Should Be Truncated',
          artist: 'Artist Name',
          bpm: 120,
          durationSeconds: 225,
          tuning: 'standard_e',
          position: 1,
        ),
        // 2. Short title, bpm=null (placeholder), duration=252 (4:12)
        const SetlistSong(
          id: '2',
          title: 'Short',
          artist: 'A',
          bpm: null,
          durationSeconds: 252,
          tuning: 'drop_d',
          position: 2,
        ),
        // 3. Medium title, bpm=95, duration set but testing tuning variation
        const SetlistSong(
          id: '3',
          title: 'Medium Length Title',
          artist: 'Medium Artist',
          bpm: 95,
          durationSeconds: 180,
          tuning: 'half_step_down',
          position: 3,
        ),
        // 4. Long artist name, bpm=null, wide tuning badge
        const SetlistSong(
          id: '4',
          title: 'Normal Song',
          artist:
              'A Very Long Artist Name That Goes On And On And Should Ellipsize',
          bpm: null,
          durationSeconds: 300,
          tuning: 'b_standard',
          position: 4,
        ),
        // 5. Very short everything, test open tuning (different color)
        const SetlistSong(
          id: '5',
          title: 'X',
          artist: 'Y',
          bpm: 200,
          durationSeconds: 60,
          tuning: 'open_g',
          position: 5,
        ),
        // 6. Edge case: high BPM, long duration
        const SetlistSong(
          id: '6',
          title: 'Edge Case Song',
          artist: 'Test Artist',
          bpm: 280,
          durationSeconds: 900,
          tuning: 'drop_c',
          position: 6,
        ),
      ];

      final widget = MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: ThemeData.dark().copyWith(
          scaffoldBackgroundColor: AppColors.scaffoldBg,
        ),
        home: Scaffold(
          backgroundColor: AppColors.scaffoldBg,
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: testCards
                  .map(
                    (song) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: SongCard(
                        song: song,
                        showDragHandle: true,
                        showDeleteIcon: true,
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
      );

      // Test at mobile size (390x844 - iPhone 14 dimensions)
      await tester.pumpWidgetBuilder(widget, surfaceSize: const Size(390, 900));
      await screenMatchesGolden(tester, 'song_card_alignment_mobile');

      // Test at tablet/desktop size (900x900)
      await tester.pumpWidgetBuilder(widget, surfaceSize: const Size(900, 900));
      await screenMatchesGolden(tester, 'song_card_alignment_tablet');
    });

    testGoldens('BPM placeholder shows em-dash correctly', (tester) async {
      // Cards specifically testing placeholder behavior
      final testCards = [
        // With BPM (value shown)
        const SetlistSong(
          id: '1',
          title: 'Song With BPM',
          artist: 'Artist',
          bpm: 120,
          durationSeconds: 180,
          tuning: 'standard_e',
          position: 1,
        ),
        // Without BPM (placeholder shown)
        const SetlistSong(
          id: '2',
          title: 'Song Without BPM',
          artist: 'Artist',
          bpm: null,
          durationSeconds: 180,
          tuning: 'standard_e',
          position: 2,
        ),
      ];

      final widget = MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: ThemeData.dark().copyWith(
          scaffoldBackgroundColor: AppColors.scaffoldBg,
        ),
        home: Scaffold(
          backgroundColor: AppColors.scaffoldBg,
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: testCards
                  .map(
                    (song) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: SongCard(
                        song: song,
                        showDragHandle: true,
                        showDeleteIcon: true,
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
      );

      await tester.pumpWidgetBuilder(widget, surfaceSize: const Size(390, 300));
      await screenMatchesGolden(tester, 'song_card_bpm_placeholder');
    });

    testGoldens('tuning badge colors vary correctly', (tester) async {
      // Cards testing different tuning colors
      final tunings = [
        'standard_e', // Blue
        'drop_d', // Green
        'half_step_down', // Purple
        'open_g', // Rose
        'drop_c', // Cyan
        'b_standard', // Indigo
      ];

      final testCards = tunings
          .asMap()
          .entries
          .map(
            (entry) => SetlistSong(
              id: '${entry.key + 1}',
              title: 'Tuning Test ${entry.key + 1}',
              artist: 'Artist',
              bpm: 120,
              durationSeconds: 180,
              tuning: entry.value,
              position: entry.key + 1,
            ),
          )
          .toList();

      final widget = MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: ThemeData.dark().copyWith(
          scaffoldBackgroundColor: AppColors.scaffoldBg,
        ),
        home: Scaffold(
          backgroundColor: AppColors.scaffoldBg,
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: testCards
                  .map(
                    (song) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: SongCard(
                        song: song,
                        showDragHandle: true,
                        showDeleteIcon: true,
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
      );

      await tester.pumpWidgetBuilder(widget, surfaceSize: const Size(390, 844));
      await screenMatchesGolden(tester, 'song_card_tuning_colors');
    });
  });
}
