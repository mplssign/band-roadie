import 'package:flutter_test/flutter_test.dart';

import 'package:tonyholmes/features/setlists/models/bulk_song_row.dart';
import 'package:tonyholmes/features/setlists/services/bulk_song_parser.dart';

void main() {
  group('BulkSongParser', () {
    const parser = BulkSongParser.instance;

    group('Tab-delimited parsing', () {
      test('parses tab-delimited row correctly', () {
        const input = 'The Beatles\tCome Together\t82\tStandard';
        final result = parser.parse(input);

        expect(result.validRows.length, 1);
        expect(result.invalidRows.length, 0);

        final row = result.validRows.first;
        expect(row.artist, 'The Beatles');
        expect(row.title, 'Come Together');
        expect(row.bpm, 82);
        expect(row.tuning, 'standard_e');
        expect(row.tuningLabel, 'Standard');
      });

      test('parses multiple tab-delimited rows', () {
        const input = '''The Beatles\tCome Together\t82\tStandard
Led Zeppelin\tWhole Lotta Love\t91\tStandard
Black Sabbath\tIron Man\t76\tDrop D''';

        final result = parser.parse(input);

        expect(result.validRows.length, 3);
        expect(result.invalidRows.length, 0);

        expect(result.validRows[0].artist, 'The Beatles');
        expect(result.validRows[1].artist, 'Led Zeppelin');
        expect(result.validRows[2].artist, 'Black Sabbath');
        expect(result.validRows[2].tuning, 'drop_d');
      });
    });

    group('Space-delimited fallback', () {
      test('parses 2+ space delimited row when no tabs', () {
        const input = 'The Beatles  Come Together  82  Standard';
        final result = parser.parse(input);

        expect(result.validRows.length, 1);
        final row = result.validRows.first;
        expect(row.artist, 'The Beatles');
        expect(row.title, 'Come Together');
        expect(row.bpm, 82);
      });
    });

    group('BPM validation', () {
      test('missing BPM is allowed and displays "- BPM"', () {
        const input = 'The Beatles\tCome Together\t\tStandard';
        final result = parser.parse(input);

        expect(result.validRows.length, 1);
        expect(result.invalidRows.length, 0);

        final row = result.validRows.first;
        expect(row.bpm, isNull);
        expect(row.formattedBpm, '- BPM');
      });

      test('empty BPM column is allowed', () {
        const input = 'The Beatles\tCome Together';
        final result = parser.parse(input);

        expect(result.validRows.length, 1);
        expect(result.validRows.first.bpm, isNull);
      });

      test(
        'invalid BPM (non-numeric) is treated as warning, row still valid',
        () {
          const input = 'The Beatles\tCome Together\tabc\tStandard';
          final result = parser.parse(input);

          expect(result.validRows.length, 1);
          expect(result.invalidRows.length, 0);

          final row = result.validRows.first;
          expect(row.isValid, true);
          expect(row.hasWarning, true);
          expect(row.warning, BulkSongValidationError.invalidBpm);
          expect(row.bpm, isNull); // Invalid BPM cleared
        },
      );

      test('BPM of 0 is treated as warning, row still valid', () {
        const input = 'The Beatles\tCome Together\t0\tStandard';
        final result = parser.parse(input);

        expect(result.validRows.length, 1);
        expect(result.invalidRows.length, 0);
        expect(result.validRows.first.hasWarning, true);
        expect(
          result.validRows.first.warning,
          BulkSongValidationError.invalidBpm,
        );
        expect(result.validRows.first.bpm, isNull);
      });

      test('BPM over 300 is treated as warning, row still valid', () {
        const input = 'The Beatles\tCome Together\t301\tStandard';
        final result = parser.parse(input);

        expect(result.validRows.length, 1);
        expect(result.invalidRows.length, 0);
        expect(result.validRows.first.hasWarning, true);
        expect(
          result.validRows.first.warning,
          BulkSongValidationError.invalidBpm,
        );
        expect(result.validRows.first.bpm, isNull);
      });

      test('BPM of 1 is valid', () {
        const input = 'The Beatles\tCome Together\t1\tStandard';
        final result = parser.parse(input);

        expect(result.validRows.length, 1);
        expect(result.validRows.first.bpm, 1);
      });

      test('BPM of 300 is valid', () {
        const input = 'The Beatles\tCome Together\t300\tStandard';
        final result = parser.parse(input);

        expect(result.validRows.length, 1);
        expect(result.validRows.first.bpm, 300);
      });
    });

    group('Tuning normalization', () {
      test('empty tuning is allowed', () {
        const input = 'The Beatles\tCome Together\t82';
        final result = parser.parse(input);

        expect(result.validRows.length, 1);
        expect(result.validRows.first.tuning, isNull);
      });

      test('unknown tuning is treated as warning, row still valid', () {
        const input = 'The Beatles\tCome Together\t82\tWeird Tuning';
        final result = parser.parse(input);

        expect(result.validRows.length, 1);
        expect(result.invalidRows.length, 0);

        final row = result.validRows.first;
        expect(row.isValid, true);
        expect(row.hasWarning, true);
        expect(row.warning, BulkSongValidationError.unknownTuning);
        expect(row.tuning, isNull); // Unknown tuning cleared
      });

      test('normalizes "Standard" tuning', () {
        const input = 'Artist\tSong\t120\tStandard';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'standard_e');
        expect(result.validRows.first.tuningLabel, 'Standard');
      });

      test('normalizes "E Standard" tuning', () {
        const input = 'Artist\tSong\t120\tE Standard';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'standard_e');
      });

      test('normalizes "E" tuning', () {
        const input = 'Artist\tSong\t120\tE';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'standard_e');
      });

      test('normalizes "Half-Step" tuning', () {
        const input = 'Artist\tSong\t120\tHalf-Step';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'half_step_down');
        expect(result.validRows.first.tuningLabel, 'Half-Step');
      });

      test('normalizes "Half Step" (no hyphen) tuning', () {
        const input = 'Artist\tSong\t120\tHalf Step';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'half_step_down');
      });

      test('normalizes "Eb Standard" tuning', () {
        const input = 'Artist\tSong\t120\tEb Standard';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'half_step_down');
      });

      test('normalizes "E♭" tuning (with flat symbol)', () {
        const input = 'Artist\tSong\t120\tE♭';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'half_step_down');
      });

      test('normalizes "Drop D" tuning', () {
        const input = 'Artist\tSong\t120\tDrop D';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'drop_d');
        expect(result.validRows.first.tuningLabel, 'Drop D');
      });

      test('normalizes "Full-Step" tuning', () {
        const input = 'Artist\tSong\t120\tFull-Step';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'whole_step_down');
        expect(result.validRows.first.tuningLabel, 'Full-Step');
      });

      test('normalizes "Full Step" (no hyphen) tuning', () {
        const input = 'Artist\tSong\t120\tFull Step';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'whole_step_down');
      });

      test('normalizes "D Standard" tuning', () {
        const input = 'Artist\tSong\t120\tD Standard';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'd_standard');
        expect(result.validRows.first.tuningLabel, 'D Standard');
      });

      test('normalizes "Drop C" tuning', () {
        const input = 'Artist\tSong\t120\tDrop C';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'drop_c');
      });

      test('normalizes "Drop Db" tuning', () {
        const input = 'Artist\tSong\t120\tDrop Db';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'drop_db');
      });

      test('normalizes "Drop B" tuning', () {
        const input = 'Artist\tSong\t120\tDrop B';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'drop_b');
      });

      test('normalizes "Drop A" tuning', () {
        const input = 'Artist\tSong\t120\tDrop A';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'drop_a');
      });

      test('normalizes "Open G" tuning', () {
        const input = 'Artist\tSong\t120\tOpen G';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'open_g');
      });

      test('normalizes "Open D" tuning', () {
        const input = 'Artist\tSong\t120\tOpen D';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'open_d');
      });

      test('normalizes "Open E" tuning', () {
        const input = 'Artist\tSong\t120\tOpen E';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'open_e');
      });

      test('normalizes "Open A" tuning', () {
        const input = 'Artist\tSong\t120\tOpen A';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'open_a');
      });

      test('normalizes "Open C" tuning', () {
        const input = 'Artist\tSong\t120\tOpen C';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'open_c');
      });

      test('tuning is case-insensitive', () {
        const input = 'Artist\tSong\t120\tDROP D';
        final result = parser.parse(input);

        expect(result.validRows.first.tuning, 'drop_d');
      });
    });

    group('De-duplication', () {
      test('removes duplicate rows within pasted input', () {
        const input = '''The Beatles\tCome Together\t82\tStandard
The Beatles\tCome Together\t82\tStandard''';

        final result = parser.parse(input);

        expect(result.validRows.length, 1);
        expect(result.duplicatesRemoved, 1);
      });

      test('de-duplication is case-insensitive', () {
        const input = '''The Beatles\tCome Together\t82\tStandard
THE BEATLES\tCOME TOGETHER\t82\tStandard''';

        final result = parser.parse(input);

        expect(result.validRows.length, 1);
        expect(result.duplicatesRemoved, 1);
      });

      test(
        'different BPM is still considered duplicate (same artist/song)',
        () {
          const input = '''The Beatles\tCome Together\t82\tStandard
The Beatles\tCome Together\t120\tDrop D''';

          final result = parser.parse(input);

          expect(result.validRows.length, 1);
          expect(result.duplicatesRemoved, 1);
          // First occurrence wins
          expect(result.validRows.first.bpm, 82);
        },
      );
    });

    group('Missing required fields', () {
      test('missing song title marks row as invalid', () {
        const input = 'The Beatles\t\t82\tStandard';
        final result = parser.parse(input);

        expect(result.validRows.length, 0);
        expect(result.invalidRows.length, 1);

        final row = result.invalidRows.first;
        expect(row.error, BulkSongValidationError.missingTitle);
        expect(row.errorMessage, 'Missing song title');
      });

      test('only one column marks row as invalid', () {
        const input = 'The Beatles';
        final result = parser.parse(input);

        expect(result.validRows.length, 0);
        expect(result.invalidRows.length, 1);
        expect(
          result.invalidRows.first.error,
          BulkSongValidationError.missingTitle,
        );
      });
    });

    group('Edge cases', () {
      test('empty input returns empty result', () {
        const input = '';
        final result = parser.parse(input);

        expect(result.validRows.length, 0);
        expect(result.invalidRows.length, 0);
        expect(result.totalRows, 0);
        expect(result.hasValidRows, false);
      });

      test('whitespace only input returns empty result', () {
        const input = '   \n  \t  \n   ';
        final result = parser.parse(input);

        expect(result.validRows.length, 0);
        expect(result.invalidRows.length, 0);
      });

      test('blank lines are ignored', () {
        const input = '''The Beatles\tCome Together\t82\tStandard

Led Zeppelin\tWhole Lotta Love\t91\tStandard

''';

        final result = parser.parse(input);
        expect(result.validRows.length, 2);
      });

      test('trims whitespace from values', () {
        const input =
            '  The Beatles  \t  Come Together  \t  82  \t  Standard  ';
        final result = parser.parse(input);

        expect(result.validRows.length, 1);
        expect(result.validRows.first.artist, 'The Beatles');
        expect(result.validRows.first.title, 'Come Together');
      });
    });

    group('BulkSongRow model', () {
      test('formattedBpm returns BPM value when present', () {
        final row = BulkSongRow.valid(
          artist: 'Artist',
          title: 'Song',
          bpm: 120,
        );
        expect(row.formattedBpm, '120 BPM');
      });

      test('formattedBpm returns "- BPM" when null', () {
        final row = BulkSongRow.valid(artist: 'Artist', title: 'Song');
        expect(row.formattedBpm, '- BPM');
      });

      test('formattedTuning returns tuning label when present', () {
        final row = BulkSongRow.valid(
          artist: 'Artist',
          title: 'Song',
          tuningLabel: 'Drop D',
        );
        expect(row.formattedTuning, 'Drop D');
      });

      test('formattedTuning returns tuning ID when no label', () {
        final row = BulkSongRow.valid(
          artist: 'Artist',
          title: 'Song',
          tuning: 'drop_d',
        );
        expect(row.formattedTuning, 'drop_d');
      });

      test('formattedTuning returns "Standard" when null', () {
        final row = BulkSongRow.valid(artist: 'Artist', title: 'Song');
        expect(row.formattedTuning, 'Standard');
      });

      test('isValid returns true for valid row', () {
        final row = BulkSongRow.valid(artist: 'Artist', title: 'Song');
        expect(row.isValid, true);
      });

      test('isValid returns false for invalid row', () {
        final row = BulkSongRow.invalid(
          artist: 'Artist',
          title: '',
          error: BulkSongValidationError.missingTitle,
          errorMessage: 'Missing title',
        );
        expect(row.isValid, false);
      });

      test('dedupeKey is case-insensitive', () {
        final row1 = BulkSongRow.valid(
          artist: 'The Beatles',
          title: 'Come Together',
        );
        final row2 = BulkSongRow.valid(
          artist: 'THE BEATLES',
          title: 'COME TOGETHER',
        );
        expect(row1.dedupeKey, row2.dedupeKey);
      });
    });

    group('Row limit', () {
      test('respects maxRows limit', () {
        final lines = List.generate(
          20,
          (i) => 'Artist $i\tSong $i\t${100 + i}\tStandard',
        ).join('\n');

        final result = parser.parse(lines, maxRows: 10);

        expect(result.validRows.length, 10);
        expect(result.validRows.first.artist, 'Artist 0');
        expect(result.validRows.last.artist, 'Artist 9');
      });

      test('no limit when maxRows is null', () {
        final lines = List.generate(
          50,
          (i) => 'Artist $i\tSong $i\t${100 + i}\tStandard',
        ).join('\n');

        final result = parser.parse(lines);

        expect(result.validRows.length, 50);
      });
    });

    group('Fuzzy tuning normalization', () {
      test('normalizes "Standard (E A D G B e)" to Standard', () {
        const input = 'Artist\tSong\t120\tStandard (E A D G B e)';
        final result = parser.parse(input);

        expect(result.validRows.length, 1);
        expect(result.validRows.first.tuning, 'standard_e');
        expect(result.validRows.first.tuningLabel, 'Standard');
      });

      test('normalizes "Drop D tuning" to Drop D', () {
        const input = 'Artist\tSong\t120\tDrop D tuning';
        final result = parser.parse(input);

        expect(result.validRows.length, 1);
        expect(result.validRows.first.tuning, 'drop_d');
        expect(result.validRows.first.tuningLabel, 'Drop D');
      });

      test('normalizes "Open G (D G D G B D)" to Open G', () {
        const input = 'Artist\tSong\t120\tOpen G (D G D G B D)';
        final result = parser.parse(input);

        expect(result.validRows.length, 1);
        expect(result.validRows.first.tuning, 'open_g');
        expect(result.validRows.first.tuningLabel, 'Open G');
      });

      test(
        'normalizes "Half-Step Down (D♯ G♯ C♯ F♯ A♯ d♯)" to half_step_down',
        () {
          const input =
              'Alice In Chains\tMan In The Box\t107\tHalf-Step Down (D♯ G♯ C♯ F♯ A♯ d♯)';
          final result = parser.parse(input);

          expect(result.validRows.length, 1);
          expect(result.validRows.first.tuning, 'half_step_down');
          expect(result.validRows.first.tuningLabel, 'Half-Step');
        },
      );

      test('normalizes "Full-Step Down (D G C F A D)" to whole_step_down', () {
        const input = 'Nirvana\tLithium\t124\tFull-Step Down (D G C F A D)';
        final result = parser.parse(input);

        expect(result.validRows.length, 1);
        expect(result.validRows.first.tuning, 'whole_step_down');
        expect(result.validRows.first.tuningLabel, 'Full-Step');
      });

      test('normalizes "Drop D (D A D G B e)" to drop_d', () {
        const input = 'Foo Fighters\tEverlong\t158\tDrop D (D A D G B e)';
        final result = parser.parse(input);

        expect(result.validRows.length, 1);
        expect(result.validRows.first.tuning, 'drop_d');
        expect(result.validRows.first.tuningLabel, 'Drop D');
      });

      test('parses multiple rows with different tunings correctly', () {
        const input = '''3 Doors Down\tKryptonite\t100\tStandard (E A D G B e)
Alice In Chains\tMan In The Box\t107\tHalf-Step Down (D♯ G♯ C♯ F♯ A♯ d♯)
Foo Fighters\tEverlong\t158\tDrop D (D A D G B e)
Nirvana\tLithium\t124\tFull-Step Down (D G C F A D)''';
        final result = parser.parse(input);

        expect(result.validRows.length, 4);

        // Standard
        expect(result.validRows[0].artist, '3 Doors Down');
        expect(result.validRows[0].tuning, 'standard_e');
        expect(result.validRows[0].tuningLabel, 'Standard');

        // Half-Step Down
        expect(result.validRows[1].artist, 'Alice In Chains');
        expect(result.validRows[1].tuning, 'half_step_down');
        expect(result.validRows[1].tuningLabel, 'Half-Step');

        // Drop D
        expect(result.validRows[2].artist, 'Foo Fighters');
        expect(result.validRows[2].tuning, 'drop_d');
        expect(result.validRows[2].tuningLabel, 'Drop D');

        // Full-Step Down
        expect(result.validRows[3].artist, 'Nirvana');
        expect(result.validRows[3].tuning, 'whole_step_down');
        expect(result.validRows[3].tuningLabel, 'Full-Step');
      });
    });
  });
}
