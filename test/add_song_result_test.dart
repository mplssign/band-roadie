import 'package:flutter_test/flutter_test.dart';

import 'package:tonyholmes/features/setlists/setlist_repository.dart';

void main() {
  group('AddSongResult', () {
    test('success returns true when setlistSongId is present', () {
      const result = AddSongResult(
        setlistSongId: 'song-123',
        songTitle: 'Test Song',
        songArtist: 'Test Artist',
      );
      expect(result.success, isTrue);
    });

    test('success returns false when setlistSongId is null', () {
      const result = AddSongResult(
        setlistSongId: null,
        songTitle: 'Test Song',
        songArtist: 'Test Artist',
      );
      expect(result.success, isFalse);
    });

    group('friendlyMessage', () {
      test(
        'returns "already in setlist" message when wasAlreadyInSetlist is true',
        () {
          const result = AddSongResult(
            setlistSongId: 'song-123',
            wasAlreadyInSetlist: true,
            songTitle: 'Enter Sandman',
            songArtist: 'Metallica',
          );

          expect(result.friendlyMessage, contains('Enter Sandman'));
          expect(result.friendlyMessage, contains('already in this setlist'));
          expect(
            result.friendlyMessage,
            contains('great minds rehearse alike'),
          );
        },
      );

      test(
        'returns humorous Catalog message when wasAlreadyInCatalog is true',
        () {
          const result = AddSongResult(
            setlistSongId: 'song-123',
            wasAlreadyInCatalog: true,
            wasEnriched: false,
            songTitle: 'Back In Black',
            songArtist: 'AC/DC',
          );

          expect(result.friendlyMessage, contains('Back In Black'));
          expect(
            result.friendlyMessage,
            contains('already exists in the Catalog'),
          );
          expect(
            result.friendlyMessage,
            contains('The Catalog remembers everything… like a drummer'),
          );
        },
      );

      test('returns enriched message when wasEnriched is true', () {
        const result = AddSongResult(
          setlistSongId: 'song-123',
          wasAlreadyInCatalog: true,
          wasEnriched: true,
          songTitle: 'Smells Like Teen Spirit',
          songArtist: 'Nirvana',
        );

        expect(result.friendlyMessage, contains('Smells Like Teen Spirit'));
        expect(result.friendlyMessage, contains('updated with new info'));
        expect(result.friendlyMessage, isNot(contains('like a drummer')));
      });

      test('returns simple added message for new songs', () {
        const result = AddSongResult(
          setlistSongId: 'song-123',
          wasAlreadyInCatalog: false,
          wasAlreadyInSetlist: false,
          songTitle: 'Bohemian Rhapsody',
          songArtist: 'Queen',
        );

        expect(result.friendlyMessage, 'Added "Bohemian Rhapsody" to setlist');
      });

      test('wasAlreadyInSetlist takes priority over wasAlreadyInCatalog', () {
        const result = AddSongResult(
          setlistSongId: 'song-123',
          wasAlreadyInCatalog: true,
          wasAlreadyInSetlist: true,
          songTitle: 'Stairway to Heaven',
          songArtist: 'Led Zeppelin',
        );

        // When both are true, "already in setlist" message should show
        expect(result.friendlyMessage, contains('already in this setlist'));
        expect(result.friendlyMessage, isNot(contains('Catalog')));
      });
    });

    group('catalogAddMessage', () {
      test('returns humorous message when wasAlreadyInCatalog is true', () {
        const result = AddSongResult(
          setlistSongId: 'song-123',
          wasAlreadyInCatalog: true,
          wasEnriched: false,
          songTitle: 'Sweet Child O Mine',
          songArtist: 'Guns N Roses',
        );

        expect(result.catalogAddMessage, contains('Sweet Child O Mine'));
        expect(
          result.catalogAddMessage,
          contains('already exists in the Catalog'),
        );
        expect(
          result.catalogAddMessage,
          contains('The Catalog remembers everything… like a drummer'),
        );
      });

      test('returns enriched message when wasEnriched is true', () {
        const result = AddSongResult(
          setlistSongId: 'song-123',
          wasAlreadyInCatalog: true,
          wasEnriched: true,
          songTitle: 'Free Bird',
          songArtist: 'Lynyrd Skynyrd',
        );

        expect(result.catalogAddMessage, contains('Free Bird'));
        expect(result.catalogAddMessage, contains('updated with new info'));
      });

      test('returns simple added message for new songs', () {
        const result = AddSongResult(
          setlistSongId: 'song-123',
          wasAlreadyInCatalog: false,
          songTitle: 'Purple Haze',
          songArtist: 'Jimi Hendrix',
        );

        expect(result.catalogAddMessage, 'Added "Purple Haze" to Catalog');
      });
    });
  });

  group('BulkAddResult', () {
    test('hasAddedSongs returns true when addedCount > 0', () {
      const result = BulkAddResult(
        addedCount: 5,
        setlistSongIds: ['a', 'b', 'c', 'd', 'e'],
      );
      expect(result.hasAddedSongs, isTrue);
    });

    test('hasAddedSongs returns false when addedCount is 0', () {
      const result = BulkAddResult(addedCount: 0, setlistSongIds: []);
      expect(result.hasAddedSongs, isFalse);
    });
  });

  group('SetlistQueryError', () {
    test('userMessage returns permission denied for RLS errors', () {
      const error = SetlistQueryError(
        code: '42501',
        message: 'permission denied for table setlists',
      );
      expect(error.userMessage, contains('Access denied'));
    });

    test('userMessage returns not found for no rows error', () {
      const error = SetlistQueryError(
        code: 'PGRST116',
        message: 'No rows returned',
        reason: 'no_rows',
      );
      expect(error.userMessage, contains('not found'));
    });

    test('userMessage returns schema error for column not found', () {
      const error = SetlistQueryError(
        code: '42703',
        message: 'column does not exist',
        reason: 'schema_mismatch',
      );
      expect(error.userMessage, contains('Database schema update'));
    });

    test('userMessage returns network error for connection issues', () {
      const error = SetlistQueryError(
        code: 'NETWORK',
        message: 'network connection failed',
      );
      expect(error.userMessage, contains('Network error'));
    });

    test('toString includes all fields', () {
      const error = SetlistQueryError(
        code: 'TEST',
        message: 'Test message',
        details: 'Some details',
        hint: 'Try this',
        reason: 'testing',
      );

      final str = error.toString();
      expect(str, contains('TEST'));
      expect(str, contains('Test message'));
      expect(str, contains('Some details'));
      expect(str, contains('Try this'));
      expect(str, contains('testing'));
    });
  });
}
