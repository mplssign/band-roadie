// ignore_for_file: avoid_print

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:golden_toolkit/golden_toolkit.dart';

import 'package:tonyholmes/app/theme/design_tokens.dart';
import 'package:tonyholmes/features/setlists/models/bulk_song_row.dart';
import 'package:tonyholmes/features/setlists/services/bulk_song_parser.dart';

// ============================================================================
// GOLDEN TEST: BULK ADD SONGS OVERLAY LAYOUT
// Verifies visual layout of the Bulk Add Songs overlay in different states:
// 1. Empty input state
// 2. Parsed rows with valid and invalid entries
// ============================================================================

void main() {
  setUpAll(() async {
    await loadAppFonts();
  });

  group('BulkAddSongsOverlay Layout', () {
    testGoldens('displays empty input state correctly', (tester) async {
      await tester.pumpWidgetBuilder(
        _buildTestOverlay(parseResult: null),
        wrapper: _materialAppWrapper,
        surfaceSize: const Size(400, 700),
      );

      await screenMatchesGolden(tester, 'bulk_add_songs_empty_input');
    });

    testGoldens('displays parsed rows with mixed valid/invalid entries', (
      tester,
    ) async {
      // Create a realistic parse result with mixed data
      final parseResult = BulkSongParser.instance.parse(
        '''The Beatles\tCome Together\t82\tStandard
Led Zeppelin\tWhole Lotta Love\t91\tDrop D
Black Sabbath\tIron Man\t\tDrop D
Pink Floyd\tComfortably Numb\t999\tStandard
Artist\tSong With Unknown Tuning\t120\tWeird Tuning
Duplicate Artist\tDuplicate Song\t100\tStandard''',
      );

      await tester.pumpWidgetBuilder(
        _buildTestOverlay(parseResult: parseResult),
        wrapper: _materialAppWrapper,
        surfaceSize: const Size(400, 800),
      );

      await screenMatchesGolden(tester, 'bulk_add_songs_parsed_rows');
    });

    testGoldens('displays all valid rows state', (tester) async {
      final parseResult = BulkSongParser.instance.parse(
        '''The Beatles\tCome Together\t82\tStandard
Led Zeppelin\tWhole Lotta Love\t91\tDrop D
Black Sabbath\tIron Man\t76\tDrop D''',
      );

      await tester.pumpWidgetBuilder(
        _buildTestOverlay(parseResult: parseResult),
        wrapper: _materialAppWrapper,
        surfaceSize: const Size(400, 700),
      );

      await screenMatchesGolden(tester, 'bulk_add_songs_all_valid');
    });
  });
}

Widget Function(Widget) get _materialAppWrapper => (Widget child) {
  return ProviderScope(
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(),
      home: child,
    ),
  );
};

/// Builds a simplified test version of the overlay body for golden testing
Widget _buildTestOverlay({BulkSongParseResult? parseResult}) {
  return Container(
    color: AppColors.scaffoldBg,
    child: SafeArea(
      child: Container(
        margin: const EdgeInsets.all(Spacing.space16),
        decoration: BoxDecoration(
          color: AppColors.scaffoldBg,
          borderRadius: BorderRadius.circular(Spacing.cardRadius),
          border: Border.all(color: AppColors.borderMuted, width: 1),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(Spacing.cardRadius),
          child: Column(
            children: [
              _buildHeader(),
              Expanded(child: _buildBody(parseResult)),
              _buildFooter(parseResult),
            ],
          ),
        ),
      ),
    ),
  );
}

Widget _buildHeader() {
  return Container(
    padding: const EdgeInsets.all(Spacing.space16),
    decoration: const BoxDecoration(
      border: Border(
        bottom: BorderSide(color: AppColors.borderMuted, width: 1),
      ),
    ),
    child: Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          child: const Icon(
            Icons.arrow_back_ios_rounded,
            size: 20,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(width: Spacing.space8),
        Expanded(
          child: Text(
            'Bulk Add Songs',
            style: AppTextStyles.title3.copyWith(fontSize: 18),
          ),
        ),
        Container(
          padding: const EdgeInsets.all(8),
          child: const Icon(
            Icons.close_rounded,
            size: 24,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    ),
  );
}

Widget _buildBody(BulkSongParseResult? parseResult) {
  return SingleChildScrollView(
    padding: const EdgeInsets.all(Spacing.space16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Paste data from your spreadsheet',
          style: AppTextStyles.body.copyWith(
            color: AppColors.textSecondary,
            fontSize: 16,
          ),
        ),
        const SizedBox(height: Spacing.space8),
        Text(
          'Your spreadsheet should have the columns: ARTIST    SONG    BPM    TUNING',
          style: AppTextStyles.body.copyWith(
            color: AppColors.textMuted,
            fontSize: 14,
          ),
        ),
        const SizedBox(height: Spacing.space16),
        _buildInputArea(),
        if (parseResult != null && parseResult.totalRows > 0) ...[
          const SizedBox(height: Spacing.space20),
          _buildPreviewHeader(parseResult),
          const SizedBox(height: Spacing.space12),
          _buildPreviewList(parseResult),
        ],
      ],
    ),
  );
}

Widget _buildInputArea() {
  return Container(
    constraints: const BoxConstraints(minHeight: 120),
    decoration: BoxDecoration(
      color: const Color(0xFF2C2C2C),
      borderRadius: BorderRadius.circular(Spacing.buttonRadius),
      border: Border.all(color: AppColors.borderMuted, width: 1),
    ),
    padding: const EdgeInsets.all(Spacing.space16),
    child: Text(
      'Paste data from a spreadsheet or simply type in the format:\nArtist\tSong\tBPM\tTuning\n\nExample:\nThe Beatles\tCome Together\t82\tStandard',
      style: TextStyle(
        fontSize: 14,
        fontFamily: 'monospace',
        fontWeight: FontWeight.w400,
        color: AppColors.textMuted.withValues(alpha: 0.6),
        height: 1.5,
      ),
    ),
  );
}

Widget _buildPreviewHeader(BulkSongParseResult parseResult) {
  final validCount = parseResult.validRows.length;
  final invalidCount = parseResult.invalidRows.length;
  final dupeCount = parseResult.duplicatesRemoved;

  return Row(
    children: [
      Text(
        'Parsed rows',
        style: AppTextStyles.label.copyWith(
          color: AppColors.textSecondary,
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
      const Spacer(),
      if (validCount > 0)
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.success.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            '$validCount valid',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.success,
            ),
          ),
        ),
      if (invalidCount > 0) ...[
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.error.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            '$invalidCount invalid',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.error,
            ),
          ),
        ),
      ],
      if (dupeCount > 0) ...[
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.warning.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            '$dupeCount dupes',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.warning,
            ),
          ),
        ),
      ],
    ],
  );
}

Widget _buildPreviewList(BulkSongParseResult parseResult) {
  return Column(
    children: parseResult.allRows.map((row) {
      return Padding(
        padding: const EdgeInsets.only(bottom: Spacing.space8),
        child: _buildPreviewRow(row),
      );
    }).toList(),
  );
}

Widget _buildPreviewRow(BulkSongRow row) {
  final isValid = row.isValid;
  final borderColor = isValid ? AppColors.borderMuted : AppColors.error;
  final bgColor = isValid
      ? const Color(0xFF2A2A2A)
      : AppColors.error.withValues(alpha: 0.1);

  return Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: bgColor,
      borderRadius: BorderRadius.circular(Spacing.buttonRadius),
      border: Border.all(color: borderColor, width: 1),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                row.title.isEmpty ? '(No title)' : row.title,
                style: AppTextStyles.body.copyWith(
                  fontWeight: FontWeight.w600,
                  color: isValid ? AppColors.textPrimary : AppColors.error,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF3A3A3A),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                row.formattedBpm,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF2563EB),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                row.formattedTuning,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            Expanded(
              child: Text(
                row.artist.isEmpty ? '(No artist)' : row.artist,
                style: AppTextStyles.body.copyWith(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (!isValid && row.errorMessage != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.error,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  row.errorMessage!,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
              ),
          ],
        ),
      ],
    ),
  );
}

Widget _buildFooter(BulkSongParseResult? parseResult) {
  final hasValidRows = parseResult?.hasValidRows ?? false;
  final validCount = parseResult?.validRows.length ?? 0;

  return Container(
    padding: const EdgeInsets.all(Spacing.space16),
    decoration: const BoxDecoration(
      border: Border(top: BorderSide(color: AppColors.borderMuted, width: 1)),
    ),
    child: Row(
      children: [
        Text(
          'Cancel',
          style: AppTextStyles.body.copyWith(
            color: AppColors.textSecondary,
            fontWeight: FontWeight.w500,
          ),
        ),
        const Spacer(),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          decoration: BoxDecoration(
            color: hasValidRows
                ? AppColors.accent
                : AppColors.accent.withValues(alpha: 0.4),
            borderRadius: BorderRadius.circular(Spacing.buttonRadius),
          ),
          child: Text(
            hasValidRows ? 'Add $validCount Songs' : 'Add Songs',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: hasValidRows ? Colors.white : Colors.white60,
            ),
          ),
        ),
      ],
    ),
  );
}
