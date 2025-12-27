import 'package:flutter_test/flutter_test.dart';

import 'package:tonyholmes/features/setlists/models/setlist_song.dart';
import 'package:tonyholmes/features/setlists/services/tuning_sort_service.dart';

// ============================================================================
// TUNING SORT INTEGRATION TEST
//
// Tests the full sorting behavior of songs based on tuning priority.
// This simulates what the SetlistDetailController does when sorting songs.
// ============================================================================

void main() {
  /// Helper function that mimics _applySorting() from SetlistDetailController
  List<SetlistSong> applySorting(List<SetlistSong> songs, TuningSortMode mode) {
    final sorted = List<SetlistSong>.from(songs);
    sorted.sort((a, b) {
      final aPriority = TuningSortService.getTuningPriority(a.tuning, mode);
      final bPriority = TuningSortService.getTuningPriority(b.tuning, mode);

      if (aPriority != bPriority) {
        return aPriority.compareTo(bPriority);
      }

      // Same tuning priority - sort by artist, then title
      final artistCompare = a.artist.toLowerCase().compareTo(
        b.artist.toLowerCase(),
      );
      if (artistCompare != 0) return artistCompare;

      return a.title.toLowerCase().compareTo(b.title.toLowerCase());
    });
    return sorted;
  }

  // Create test songs with various tunings
  final List<SetlistSong> testSongs = [
    const SetlistSong(
      id: '1',
      title: 'Standard Song 1',
      artist: 'Artist A',
      tuning: 'standard',
      position: 0,
      durationSeconds: 180,
    ),
    const SetlistSong(
      id: '2',
      title: 'Drop D Song 1',
      artist: 'Artist B',
      tuning: 'drop_d',
      position: 1,
      durationSeconds: 180,
    ),
    const SetlistSong(
      id: '3',
      title: 'Half Step Song 1',
      artist: 'Artist C',
      tuning: 'half_step',
      position: 2,
      durationSeconds: 180,
    ),
    const SetlistSong(
      id: '4',
      title: 'Full Step Song 1',
      artist: 'Artist D',
      tuning: 'full_step',
      position: 3,
      durationSeconds: 180,
    ),
    const SetlistSong(
      id: '5',
      title: 'Standard Song 2',
      artist: 'Artist E',
      tuning: 'standard',
      position: 4,
      durationSeconds: 180,
    ),
    const SetlistSong(
      id: '6',
      title: 'Half Step Song 2',
      artist: 'Artist A',
      tuning: 'half_step',
      position: 5,
      durationSeconds: 180,
    ),
  ];

  group('Song sorting by tuning mode', () {
    test('Standard mode: standard songs come first', () {
      final sorted = applySorting(testSongs, TuningSortMode.standard);

      // Expected order: standard(0), drop_d(1), half_step(2), full_step(3)
      // Standard songs first (2 of them)
      expect(sorted[0].tuning, 'standard');
      expect(sorted[1].tuning, 'standard');
      // Then drop_d
      expect(sorted[2].tuning, 'drop_d');
      // Then half_step (2 of them)
      expect(sorted[3].tuning, 'half_step');
      expect(sorted[4].tuning, 'half_step');
      // Then full_step
      expect(sorted[5].tuning, 'full_step');
    });

    test('Drop D mode: drop_d songs come first, then rotated order', () {
      final sorted = applySorting(testSongs, TuningSortMode.dropD);

      // Expected rotated order: drop_d(0), half_step(1), full_step(2), standard(3)
      expect(sorted[0].tuning, 'drop_d');
      // Then half_step (2 of them)
      expect(sorted[1].tuning, 'half_step');
      expect(sorted[2].tuning, 'half_step');
      // Then full_step
      expect(sorted[3].tuning, 'full_step');
      // Then standard (2 of them)
      expect(sorted[4].tuning, 'standard');
      expect(sorted[5].tuning, 'standard');
    });

    test('Half-Step mode: half_step songs come first', () {
      final sorted = applySorting(testSongs, TuningSortMode.halfStep);

      // Expected rotated order: half_step(0), full_step(1), standard(2), drop_d(3)
      expect(sorted[0].tuning, 'half_step');
      expect(sorted[1].tuning, 'half_step');
      // Then full_step
      expect(sorted[2].tuning, 'full_step');
      // Then standard (2 of them)
      expect(sorted[3].tuning, 'standard');
      expect(sorted[4].tuning, 'standard');
      // Then drop_d
      expect(sorted[5].tuning, 'drop_d');
    });

    test('Full-Step mode: full_step songs come first', () {
      final sorted = applySorting(testSongs, TuningSortMode.fullStep);

      // Expected rotated order: full_step(0), standard(1), drop_d(2), half_step(3)
      expect(sorted[0].tuning, 'full_step');
      // Then standard (2 of them)
      expect(sorted[1].tuning, 'standard');
      expect(sorted[2].tuning, 'standard');
      // Then drop_d
      expect(sorted[3].tuning, 'drop_d');
      // Then half_step (2 of them)
      expect(sorted[4].tuning, 'half_step');
      expect(sorted[5].tuning, 'half_step');
    });

    test('Same tuning priority sorts by artist then title', () {
      // Add songs with same tuning but different artists
      final List<SetlistSong> songsWithSameTuning = [
        const SetlistSong(
          id: '1',
          title: 'Zebra Song',
          artist: 'Zeppelin',
          tuning: 'standard',
          position: 0,
          durationSeconds: 180,
        ),
        const SetlistSong(
          id: '2',
          title: 'Alpha Song',
          artist: 'Aerosmith',
          tuning: 'standard',
          position: 1,
          durationSeconds: 180,
        ),
        const SetlistSong(
          id: '3',
          title: 'Beta Song',
          artist: 'Aerosmith',
          tuning: 'standard',
          position: 2,
          durationSeconds: 180,
        ),
      ];

      final sorted = applySorting(songsWithSameTuning, TuningSortMode.standard);

      // All standard tuning, so sort by artist (Aerosmith < Zeppelin)
      expect(sorted[0].artist, 'Aerosmith');
      expect(sorted[1].artist, 'Aerosmith');
      expect(sorted[2].artist, 'Zeppelin');

      // For same artist, sort by title (Alpha < Beta)
      expect(sorted[0].title, 'Alpha Song');
      expect(sorted[1].title, 'Beta Song');
    });

    test('Unknown tunings sort after known tunings', () {
      final List<SetlistSong> songsWithUnknown = [
        const SetlistSong(
          id: '1',
          title: 'Open G Song',
          artist: 'Artist',
          tuning: 'open_g',
          position: 0,
          durationSeconds: 180,
        ),
        const SetlistSong(
          id: '2',
          title: 'Standard Song',
          artist: 'Artist',
          tuning: 'standard',
          position: 1,
          durationSeconds: 180,
        ),
      ];

      final sorted = applySorting(songsWithUnknown, TuningSortMode.standard);

      // Known tuning (standard) should come before unknown (open_g)
      expect(sorted[0].tuning, 'standard');
      expect(sorted[1].tuning, 'open_g');
    });

    test('Null tuning sorts last', () {
      final List<SetlistSong> songsWithNull = [
        const SetlistSong(
          id: '1',
          title: 'No Tuning',
          artist: 'Artist',
          tuning: null,
          position: 0,
          durationSeconds: 180,
        ),
        const SetlistSong(
          id: '2',
          title: 'Drop D Song',
          artist: 'Artist',
          tuning: 'drop_d',
          position: 1,
          durationSeconds: 180,
        ),
        const SetlistSong(
          id: '3',
          title: 'Standard Song',
          artist: 'Artist',
          tuning: 'standard',
          position: 2,
          durationSeconds: 180,
        ),
      ];

      final sorted = applySorting(songsWithNull, TuningSortMode.standard);

      // Standard first, then drop_d, then null last
      expect(sorted[0].tuning, 'standard');
      expect(sorted[1].tuning, 'drop_d');
      expect(sorted[2].tuning, isNull);
    });
  });

  group('Cycling through tuning modes', () {
    test('Changing mode reorders songs correctly', () {
      // Start with Standard mode
      var sorted = applySorting(testSongs, TuningSortMode.standard);
      expect(sorted[0].tuning, 'standard');

      // Cycle to Half-Step
      sorted = applySorting(testSongs, TuningSortMode.halfStep);
      expect(sorted[0].tuning, 'half_step');

      // Cycle to Full-Step
      sorted = applySorting(testSongs, TuningSortMode.fullStep);
      expect(sorted[0].tuning, 'full_step');

      // Cycle to Drop D
      sorted = applySorting(testSongs, TuningSortMode.dropD);
      expect(sorted[0].tuning, 'drop_d');

      // Cycle back to Standard
      sorted = applySorting(testSongs, TuningSortMode.standard);
      expect(sorted[0].tuning, 'standard');
    });

    test('Toggle changes first song in list based on mode', () {
      // This tests the user-visible behavior:
      // When you toggle, the first song should change to match the selected tuning

      final modes = [
        TuningSortMode.standard,
        TuningSortMode.halfStep,
        TuningSortMode.fullStep,
        TuningSortMode.dropD,
      ];

      for (final mode in modes) {
        final sorted = applySorting(testSongs, mode);
        expect(
          sorted.first.tuning,
          mode.dbValue,
          reason:
              'First song should have ${mode.dbValue} tuning when ${mode.label} mode is selected',
        );
      }
    });
  });
}
