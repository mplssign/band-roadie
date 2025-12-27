import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:tonyholmes/features/setlists/services/tuning_sort_service.dart';

void main() {
  group('TuningSortMode', () {
    test('has correct labels for each mode', () {
      expect(TuningSortMode.standard.label, 'Standard');
      expect(TuningSortMode.halfStep.label, 'Half-Step');
      expect(TuningSortMode.fullStep.label, 'Full-Step');
      expect(TuningSortMode.dropD.label, 'Drop D');
    });

    test('has correct dbValue for each mode', () {
      expect(TuningSortMode.standard.dbValue, 'standard');
      expect(TuningSortMode.halfStep.dbValue, 'half_step');
      expect(TuningSortMode.fullStep.dbValue, 'full_step');
      expect(TuningSortMode.dropD.dbValue, 'drop_d');
    });

    test('cycles through modes correctly', () {
      // standard -> halfStep -> fullStep -> dropD -> standard
      expect(TuningSortMode.standard.next, TuningSortMode.halfStep);
      expect(TuningSortMode.halfStep.next, TuningSortMode.fullStep);
      expect(TuningSortMode.fullStep.next, TuningSortMode.dropD);
      expect(TuningSortMode.dropD.next, TuningSortMode.standard);
    });

    test('fromDbValue parses all known values', () {
      expect(TuningSortMode.fromDbValue('standard'), TuningSortMode.standard);
      expect(TuningSortMode.fromDbValue('half_step'), TuningSortMode.halfStep);
      expect(TuningSortMode.fromDbValue('full_step'), TuningSortMode.fullStep);
      expect(TuningSortMode.fromDbValue('drop_d'), TuningSortMode.dropD);
    });

    test('fromDbValue returns standard for unknown values', () {
      expect(TuningSortMode.fromDbValue('unknown'), TuningSortMode.standard);
      expect(TuningSortMode.fromDbValue(''), TuningSortMode.standard);
      expect(TuningSortMode.fromDbValue('STANDARD'), TuningSortMode.standard);
    });
  });

  group('TuningSortService', () {
    const testBandId = 'band-123';
    const testSetlistId = 'setlist-456';

    setUp(() {
      // Initialize SharedPreferences with empty values for testing
      SharedPreferences.setMockInitialValues({});
    });

    test('getSortMode returns standard when no preference saved', () async {
      final mode = await TuningSortService.getSortMode(
        bandId: testBandId,
        setlistId: testSetlistId,
      );
      expect(mode, TuningSortMode.standard);
    });

    test('setSortMode persists and getSortMode retrieves correctly', () async {
      // Save a preference
      await TuningSortService.setSortMode(
        bandId: testBandId,
        setlistId: testSetlistId,
        mode: TuningSortMode.dropD,
      );

      // Retrieve it
      final mode = await TuningSortService.getSortMode(
        bandId: testBandId,
        setlistId: testSetlistId,
      );
      expect(mode, TuningSortMode.dropD);
    });

    test('clearSortMode removes saved preference', () async {
      // Save a preference
      await TuningSortService.setSortMode(
        bandId: testBandId,
        setlistId: testSetlistId,
        mode: TuningSortMode.halfStep,
      );

      // Clear it
      await TuningSortService.clearSortMode(
        bandId: testBandId,
        setlistId: testSetlistId,
      );

      // Should return default
      final mode = await TuningSortService.getSortMode(
        bandId: testBandId,
        setlistId: testSetlistId,
      );
      expect(mode, TuningSortMode.standard);
    });

    test('different setlists have independent preferences', () async {
      const setlist1 = 'setlist-1';
      const setlist2 = 'setlist-2';

      await TuningSortService.setSortMode(
        bandId: testBandId,
        setlistId: setlist1,
        mode: TuningSortMode.dropD,
      );
      await TuningSortService.setSortMode(
        bandId: testBandId,
        setlistId: setlist2,
        mode: TuningSortMode.fullStep,
      );

      final mode1 = await TuningSortService.getSortMode(
        bandId: testBandId,
        setlistId: setlist1,
      );
      final mode2 = await TuningSortService.getSortMode(
        bandId: testBandId,
        setlistId: setlist2,
      );

      expect(mode1, TuningSortMode.dropD);
      expect(mode2, TuningSortMode.fullStep);
    });

    test('different bands have independent preferences', () async {
      const band1 = 'band-1';
      const band2 = 'band-2';

      await TuningSortService.setSortMode(
        bandId: band1,
        setlistId: testSetlistId,
        mode: TuningSortMode.halfStep,
      );
      await TuningSortService.setSortMode(
        bandId: band2,
        setlistId: testSetlistId,
        mode: TuningSortMode.dropD,
      );

      final mode1 = await TuningSortService.getSortMode(
        bandId: band1,
        setlistId: testSetlistId,
      );
      final mode2 = await TuningSortService.getSortMode(
        bandId: band2,
        setlistId: testSetlistId,
      );

      expect(mode1, TuningSortMode.halfStep);
      expect(mode2, TuningSortMode.dropD);
    });
  });

  group('getRotatedOrder', () {
    test('Standard mode returns base order unchanged', () {
      final order = TuningSortService.getRotatedOrder(TuningSortMode.standard);
      // Base order: standard, drop_d, half_step, full_step
      expect(order, ['standard', 'drop_d', 'half_step', 'full_step']);
    });

    test('Drop D mode rotates so drop_d is first', () {
      final order = TuningSortService.getRotatedOrder(TuningSortMode.dropD);
      // drop_d is at index 1, so: drop_d, half_step, full_step, standard
      expect(order, ['drop_d', 'half_step', 'full_step', 'standard']);
    });

    test('Half-Step mode rotates so half_step is first', () {
      final order = TuningSortService.getRotatedOrder(TuningSortMode.halfStep);
      // half_step is at index 2, so: half_step, full_step, standard, drop_d
      expect(order, ['half_step', 'full_step', 'standard', 'drop_d']);
    });

    test('Full-Step mode rotates so full_step is first', () {
      final order = TuningSortService.getRotatedOrder(TuningSortMode.fullStep);
      // full_step is at index 3, so: full_step, standard, drop_d, half_step
      expect(order, ['full_step', 'standard', 'drop_d', 'half_step']);
    });
  });

  group('getTuningPriority', () {
    test('selected tuning always has priority 0', () {
      expect(
        TuningSortService.getTuningPriority(
          'standard',
          TuningSortMode.standard,
        ),
        0,
      );
      expect(
        TuningSortService.getTuningPriority('drop_d', TuningSortMode.dropD),
        0,
      );
      expect(
        TuningSortService.getTuningPriority(
          'half_step',
          TuningSortMode.halfStep,
        ),
        0,
      );
      expect(
        TuningSortService.getTuningPriority(
          'full_step',
          TuningSortMode.fullStep,
        ),
        0,
      );
    });

    test('Standard mode priorities follow base order', () {
      const mode = TuningSortMode.standard;
      // Order: standard(0), drop_d(1), half_step(2), full_step(3)
      expect(TuningSortService.getTuningPriority('standard', mode), 0);
      expect(TuningSortService.getTuningPriority('drop_d', mode), 1);
      expect(TuningSortService.getTuningPriority('half_step', mode), 2);
      expect(TuningSortService.getTuningPriority('full_step', mode), 3);
    });

    test('Drop D mode priorities follow rotated order', () {
      const mode = TuningSortMode.dropD;
      // Rotated: drop_d(0), half_step(1), full_step(2), standard(3)
      expect(TuningSortService.getTuningPriority('drop_d', mode), 0);
      expect(TuningSortService.getTuningPriority('half_step', mode), 1);
      expect(TuningSortService.getTuningPriority('full_step', mode), 2);
      expect(TuningSortService.getTuningPriority('standard', mode), 3);
    });

    test('Half-Step mode priorities follow rotated order', () {
      const mode = TuningSortMode.halfStep;
      // Rotated: half_step(0), full_step(1), standard(2), drop_d(3)
      expect(TuningSortService.getTuningPriority('half_step', mode), 0);
      expect(TuningSortService.getTuningPriority('full_step', mode), 1);
      expect(TuningSortService.getTuningPriority('standard', mode), 2);
      expect(TuningSortService.getTuningPriority('drop_d', mode), 3);
    });

    test('Full-Step mode priorities follow rotated order', () {
      const mode = TuningSortMode.fullStep;
      // Rotated: full_step(0), standard(1), drop_d(2), half_step(3)
      expect(TuningSortService.getTuningPriority('full_step', mode), 0);
      expect(TuningSortService.getTuningPriority('standard', mode), 1);
      expect(TuningSortService.getTuningPriority('drop_d', mode), 2);
      expect(TuningSortService.getTuningPriority('half_step', mode), 3);
    });

    test('unknown tunings get high priority (sorted alphabetically later)', () {
      const mode = TuningSortMode.standard;

      final unknownPriority = TuningSortService.getTuningPriority(
        'open_g',
        mode,
      );
      final standardPriority = TuningSortService.getTuningPriority(
        'standard',
        mode,
      );

      // Unknown tunings should sort after known ones (priority 100+)
      expect(unknownPriority, greaterThan(standardPriority));
      expect(unknownPriority, greaterThanOrEqualTo(100));
    });

    test('null tuning sorts last', () {
      const mode = TuningSortMode.halfStep;

      final nullPriority = TuningSortService.getTuningPriority(null, mode);

      // null tuning should get 999 (sorts last)
      expect(nullPriority, 999);
    });

    test('normalizes display labels to db values', () {
      // "Half-Step" display label should normalize to "half_step"
      expect(
        TuningSortService.getTuningPriority(
          'Half-Step',
          TuningSortMode.halfStep,
        ),
        0,
      );
      // "Drop D" display label should normalize
      expect(
        TuningSortService.getTuningPriority('Drop D', TuningSortMode.dropD),
        0,
      );
      // "Eb Standard" is an alias for half_step
      expect(
        TuningSortService.getTuningPriority(
          'Eb Standard',
          TuningSortMode.halfStep,
        ),
        0,
      );
    });
  });
}
