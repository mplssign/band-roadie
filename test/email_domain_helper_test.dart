import 'package:flutter_test/flutter_test.dart';
import 'package:tonyholmes/shared/utils/email_domain_helper.dart';

void main() {
  group('applyEmailDomainShortcut', () {
    test('appends domain when no @ exists', () {
      expect(
        applyEmailDomainShortcut('tony', '@gmail.com'),
        equals('tony@gmail.com'),
      );
      expect(
        applyEmailDomainShortcut('john.doe', '@yahoo.com'),
        equals('john.doe@yahoo.com'),
      );
    });

    test('replaces domain when @ already exists', () {
      expect(
        applyEmailDomainShortcut('tony@gmail.com', '@icloud.com'),
        equals('tony@icloud.com'),
      );
      expect(
        applyEmailDomainShortcut('user@old-domain.org', '@outlook.com'),
        equals('user@outlook.com'),
      );
    });

    test('returns empty string when input is empty', () {
      expect(applyEmailDomainShortcut('', '@gmail.com'), equals(''));
    });

    test('returns empty string when input is only whitespace', () {
      expect(applyEmailDomainShortcut('   ', '@gmail.com'), equals(''));
      expect(applyEmailDomainShortcut('\t\n', '@yahoo.com'), equals(''));
    });

    test('trims whitespace before applying domain', () {
      expect(
        applyEmailDomainShortcut('  tony  ', '@gmail.com'),
        equals('tony@gmail.com'),
      );
      expect(
        applyEmailDomainShortcut('  user@old.com  ', '@icloud.com'),
        equals('user@icloud.com'),
      );
    });

    test('handles partial email with @ but no domain', () {
      expect(
        applyEmailDomainShortcut('tony@', '@gmail.com'),
        equals('tony@gmail.com'),
      );
    });

    test('handles multiple @ symbols (takes first)', () {
      // Edge case: user typed something weird like tony@test@extra
      // Should replace from first @ onward
      expect(
        applyEmailDomainShortcut('tony@test@extra', '@gmail.com'),
        equals('tony@gmail.com'),
      );
    });
  });

  group('emailDomainShortcuts', () {
    test('contains expected domains', () {
      expect(emailDomainShortcuts, contains('@gmail.com'));
      expect(emailDomainShortcuts, contains('@yahoo.com'));
      expect(emailDomainShortcuts, contains('@icloud.com'));
      expect(emailDomainShortcuts, contains('@outlook.com'));
    });

    test('has exactly 4 domains', () {
      expect(emailDomainShortcuts.length, equals(4));
    });
  });
}
