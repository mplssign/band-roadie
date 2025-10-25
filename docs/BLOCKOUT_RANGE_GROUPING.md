# Blockout Range Grouping Implementation Summary

## Overview

Implemented automatic grouping of consecutive blockout days into single range cards on the Calendar screen. Previously, each blockout day showed as a separate card. Now, consecutive days for the same member are collapsed into one card showing a start date tile and an "Until" end date tile.

## Changes Made

### 1. **New Utility: `lib/utils/blockouts.ts`**

- **Pure function**: `groupBlockoutsIntoRanges(rows: BlockoutRow[]): BlockoutRange[]`
- **Algorithm**:
  1. Groups blockout rows by `user_id`
  2. Sorts each user's blockouts by date ascending
  3. Merges consecutive/overlapping dates into ranges
  4. Returns sorted array (most recent first)
- **Types Added**:

  ```typescript
  interface BlockoutRow {
    id?: string;
    user_id: string;
    date: string; // YYYY-MM-DD
    notes?: string;
    band_id?: string;
    reason?: string;
  }

  interface BlockoutRange {
    user_id: string;
    start_date: string; // YYYY-MM-DD
    end_date: string; // YYYY-MM-DD (>= start_date)
    dayCount: number;
    sourceIds: string[]; // IDs from original rows
    notes?: string;
    reason?: string;
    band_id?: string;
  }
  ```

- **Helper Functions**:
  - `toDate(dateStr)`: Convert YYYY-MM-DD to Date at midnight UTC
  - `toYMD(date)`: Convert Date to YYYY-MM-DD string
  - `isNextDay(a, b)`: Check if b is exactly one day after a
  - `minDate(dates)` / `maxDate(dates)`: Get earliest/latest date
  - `daysBetween(start, end)`: Calculate inclusive day count

### 2. **Updated: `app/(protected)/calendar/page.tsx`**

- **Line 10**: Added imports for `groupBlockoutsIntoRanges` and `BlockoutRow`
- **Lines 230-269**: Replaced per-day blockout processing with:
  1. Map block_dates rows to `BlockoutRow[]` format
  2. Call `groupBlockoutsIntoRanges()` to merge consecutive days
  3. Convert grouped ranges to `CalendarEvent` format with proper `blockout.startDate` and `blockout.endDate`

- **Before**: Each database row became one calendar event (even consecutive days)
- **After**: Consecutive days for same user become ONE calendar event with start/end range

### 3. **Existing UI Already Supports Ranges: `app/(protected)/calendar/CalendarContent.tsx`**

- **Lines 548-550**: Checks `isMultiDayBlockout` when `evt.blockout.startDate !== evt.blockout.endDate`
- **Lines 570-605**: Renders card with 3-column grid when multi-day:
  - Left tile: Start date (month + day)
  - Middle: Title, badge, subtitle
  - Right tile: "Until" label + end date (month + day)
- **Lines 156-190**: Existing deduplication logic prevents duplicate range entries

- **No changes needed** - existing UI fully compatible with grouped ranges!

### 4. **Unit Tests: `__tests__/blockouts.test.ts`**

Comprehensive test suite covering:

- ✅ Empty input
- ✅ Single-day blockout
- ✅ Consecutive days (3-day span)
- ✅ Overlapping/duplicate dates
- ✅ Non-consecutive days (creates separate ranges)
- ✅ Cross-month spans (Oct 30 - Nov 2)
- ✅ Cross-year spans (Dec 30, 2025 - Jan 2, 2026)
- ✅ Multiple users (keeps ranges separate)
- ✅ Unsorted input (sorts correctly)
- ✅ Notes/reason preservation
- ✅ Missing IDs handling
- ✅ Descending sort order

**All 12 tests pass ✅**

## User-Facing Changes

### Before

```
┌─────────┬─────────────────────┐
│  Oct    │ Tony Out            │
│  26     │ Sun, Oct 26, 2025   │
└─────────┴─────────────────────┘

┌─────────┬─────────────────────┐
│  Oct    │ Tony Out            │
│  27     │ Mon, Oct 27, 2025   │
└─────────┴─────────────────────┘

┌─────────┬─────────────────────┐
│  Oct    │ Tony Out            │
│  28     │ Tue, Oct 28, 2025   │
└─────────┴─────────────────────┘
```

### After

```
┌─────────┬─────────────────────┬─────────┐
│  Oct    │ Tony Out            │  Until  │
│  26     │ Sun, Oct 26, 2025 - │   Oct   │
│         │ Tue, Oct 28, 2025   │   28    │
└─────────┴─────────────────────┴─────────┘
```

## Edge Cases Handled

1. **Single-day blockouts**: Render without "Until" tile (existing behavior preserved)
2. **Cross-month spans**: Oct 30 - Nov 2 shown as one range
3. **Cross-year spans**: Dec 30, 2025 - Jan 2, 2026 shown as one range
4. **Multiple members**: Each member's ranges kept separate
5. **Gaps in dates**: Non-consecutive days create separate range cards
6. **Overlapping dates**: Duplicate/overlapping entries merged into single range

## Click Behavior

- Clicking a range card opens the existing edit drawer
- Drawer receives the full range (start_date and end_date)
- Existing delete logic handles removing entire range

## No Regressions

- ✅ Gigs render unchanged
- ✅ Rehearsals render unchanged
- ✅ Single-day blockouts render unchanged (no "Until" tile)
- ✅ Event drawer functionality unchanged
- ✅ Calendar grid dots unchanged
- ✅ All existing tests pass

## Files Modified

1. ✅ `lib/utils/blockouts.ts` (new)
2. ✅ `__tests__/blockouts.test.ts` (new)
3. ✅ `app/(protected)/calendar/page.tsx` (updated blockout processing)
4. ✅ `app/(protected)/calendar/CalendarContent.tsx` (no changes - already compatible!)

## TypeScript Safety

- ✅ All types explicit, no `any` used
- ✅ Full type flow from database → grouping → UI
- ✅ No compile errors
- ✅ No lint warnings

## Performance

- Grouping happens once on data load (not per render)
- O(n log n) complexity for sorting
- Reduces number of cards rendered for consecutive blockouts
- No performance impact on other event types

## Next Steps (Optional Enhancements)

- Add visual indicator on calendar grid showing multi-day blockout spans
- Show day count badge on range cards (e.g., "3 days")
- Add bulk delete for entire ranges from edit drawer
