import { groupBlockoutsIntoRanges } from '@/lib/utils/blockouts';
import type { BlockoutRow } from '@/lib/utils/blockouts';

describe('groupBlockoutsIntoRanges', () => {
  const user1 = 'user-1';
  const user2 = 'user-2';
  const bandId = 'band-123';

  it('should return empty array for empty input', () => {
    const result = groupBlockoutsIntoRanges([]);
    expect(result).toEqual([]);
  });

  it('should handle single-day blockout', () => {
    const rows: BlockoutRow[] = [
      {
        id: '1',
        user_id: user1,
        date: '2025-10-26',
        notes: 'Out sick',
        band_id: bandId,
      },
    ];

    const result = groupBlockoutsIntoRanges(rows);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      user_id: user1,
      start_date: '2025-10-26',
      end_date: '2025-10-26',
      dayCount: 1,
      sourceIds: ['1'],
      notes: 'Out sick',
      band_id: bandId,
    });
  });

  it('should group consecutive days into single range', () => {
    const rows: BlockoutRow[] = [
      { id: '1', user_id: user1, date: '2025-10-26', band_id: bandId },
      { id: '2', user_id: user1, date: '2025-10-27', band_id: bandId },
      { id: '3', user_id: user1, date: '2025-10-28', band_id: bandId },
    ];

    const result = groupBlockoutsIntoRanges(rows);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      user_id: user1,
      start_date: '2025-10-26',
      end_date: '2025-10-28',
      dayCount: 3,
      sourceIds: ['1', '2', '3'],
      band_id: bandId,
    });
  });

  it('should handle overlapping dates (duplicate days)', () => {
    const rows: BlockoutRow[] = [
      { id: '1', user_id: user1, date: '2025-10-26', band_id: bandId },
      { id: '2', user_id: user1, date: '2025-10-26', band_id: bandId }, // duplicate
      { id: '3', user_id: user1, date: '2025-10-27', band_id: bandId },
    ];

    const result = groupBlockoutsIntoRanges(rows);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      user_id: user1,
      start_date: '2025-10-26',
      end_date: '2025-10-27',
      dayCount: 2,
      sourceIds: ['1', '2', '3'],
      band_id: bandId,
    });
  });

  it('should create separate ranges for non-consecutive days', () => {
    const rows: BlockoutRow[] = [
      { id: '1', user_id: user1, date: '2025-10-26', band_id: bandId },
      { id: '2', user_id: user1, date: '2025-10-27', band_id: bandId },
      { id: '3', user_id: user1, date: '2025-10-30', band_id: bandId }, // gap
      { id: '4', user_id: user1, date: '2025-10-31', band_id: bandId },
    ];

    const result = groupBlockoutsIntoRanges(rows);

    expect(result).toHaveLength(2);
    // Sorted by start_date descending (most recent first)
    expect(result[0]).toEqual({
      user_id: user1,
      start_date: '2025-10-30',
      end_date: '2025-10-31',
      dayCount: 2,
      sourceIds: ['3', '4'],
      band_id: bandId,
    });
    expect(result[1]).toEqual({
      user_id: user1,
      start_date: '2025-10-26',
      end_date: '2025-10-27',
      dayCount: 2,
      sourceIds: ['1', '2'],
      band_id: bandId,
    });
  });

  it('should handle cross-month span', () => {
    const rows: BlockoutRow[] = [
      { id: '1', user_id: user1, date: '2025-10-30', band_id: bandId },
      { id: '2', user_id: user1, date: '2025-10-31', band_id: bandId },
      { id: '3', user_id: user1, date: '2025-11-01', band_id: bandId },
      { id: '4', user_id: user1, date: '2025-11-02', band_id: bandId },
    ];

    const result = groupBlockoutsIntoRanges(rows);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      user_id: user1,
      start_date: '2025-10-30',
      end_date: '2025-11-02',
      dayCount: 4,
      sourceIds: ['1', '2', '3', '4'],
      band_id: bandId,
    });
  });

  it('should handle cross-year span', () => {
    const rows: BlockoutRow[] = [
      { id: '1', user_id: user1, date: '2025-12-30', band_id: bandId },
      { id: '2', user_id: user1, date: '2025-12-31', band_id: bandId },
      { id: '3', user_id: user1, date: '2026-01-01', band_id: bandId },
      { id: '4', user_id: user1, date: '2026-01-02', band_id: bandId },
    ];

    const result = groupBlockoutsIntoRanges(rows);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      user_id: user1,
      start_date: '2025-12-30',
      end_date: '2026-01-02',
      dayCount: 4,
      sourceIds: ['1', '2', '3', '4'],
      band_id: bandId,
    });
  });

  it('should keep ranges separate for different users', () => {
    const rows: BlockoutRow[] = [
      { id: '1', user_id: user1, date: '2025-10-26', band_id: bandId },
      { id: '2', user_id: user1, date: '2025-10-27', band_id: bandId },
      { id: '3', user_id: user2, date: '2025-10-26', band_id: bandId },
      { id: '4', user_id: user2, date: '2025-10-27', band_id: bandId },
    ];

    const result = groupBlockoutsIntoRanges(rows);

    expect(result).toHaveLength(2);

    // Both have same start date, so order might vary - check both exist
    const user1Range = result.find((r) => r.user_id === user1);
    const user2Range = result.find((r) => r.user_id === user2);

    expect(user1Range).toEqual({
      user_id: user1,
      start_date: '2025-10-26',
      end_date: '2025-10-27',
      dayCount: 2,
      sourceIds: ['1', '2'],
      band_id: bandId,
    });

    expect(user2Range).toEqual({
      user_id: user2,
      start_date: '2025-10-26',
      end_date: '2025-10-27',
      dayCount: 2,
      sourceIds: ['3', '4'],
      band_id: bandId,
    });
  });

  it('should handle unsorted input dates', () => {
    const rows: BlockoutRow[] = [
      { id: '3', user_id: user1, date: '2025-10-28', band_id: bandId },
      { id: '1', user_id: user1, date: '2025-10-26', band_id: bandId },
      { id: '2', user_id: user1, date: '2025-10-27', band_id: bandId },
    ];

    const result = groupBlockoutsIntoRanges(rows);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      user_id: user1,
      start_date: '2025-10-26',
      end_date: '2025-10-28',
      dayCount: 3,
      sourceIds: ['1', '2', '3'],
      band_id: bandId,
    });
  });

  it('should preserve notes and reason from first row in range', () => {
    const rows: BlockoutRow[] = [
      {
        id: '1',
        user_id: user1,
        date: '2025-10-26',
        notes: 'Vacation',
        reason: 'Personal',
        band_id: bandId,
      },
      {
        id: '2',
        user_id: user1,
        date: '2025-10-27',
        band_id: bandId,
      },
    ];

    const result = groupBlockoutsIntoRanges(rows);

    expect(result).toHaveLength(1);
    expect(result[0].notes).toBe('Vacation');
    expect(result[0].reason).toBe('Personal');
  });

  it('should handle rows without IDs', () => {
    const rows: BlockoutRow[] = [
      { user_id: user1, date: '2025-10-26', band_id: bandId },
      { user_id: user1, date: '2025-10-27', band_id: bandId },
    ];

    const result = groupBlockoutsIntoRanges(rows);

    expect(result).toHaveLength(1);
    expect(result[0].sourceIds).toEqual([]);
  });

  it('should sort output ranges by start_date descending', () => {
    const rows: BlockoutRow[] = [
      { id: '1', user_id: user1, date: '2025-10-10', band_id: bandId },
      { id: '2', user_id: user1, date: '2025-10-20', band_id: bandId },
      { id: '3', user_id: user1, date: '2025-10-15', band_id: bandId },
    ];

    const result = groupBlockoutsIntoRanges(rows);

    expect(result).toHaveLength(3);
    expect(result[0].start_date).toBe('2025-10-20');
    expect(result[1].start_date).toBe('2025-10-15');
    expect(result[2].start_date).toBe('2025-10-10');
  });
});
