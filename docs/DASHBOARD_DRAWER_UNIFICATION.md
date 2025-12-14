# Dashboard Drawer Unification - UPDATED

## Overview

Successfully unified ALL event creation and editing flows across the entire application to use a single `EditRehearsalDrawer` component. This component now serves as the universal drawer for:

- Creating new rehearsals (add mode)
- Creating new gigs (add mode)
- Editing existing rehearsals (edit mode)
- Editing existing gigs (edit mode)

This applies to BOTH the calendar page and the dashboard page, providing a completely consistent UX throughout the application.

## Migration Summary

**Previous State:**

- Calendar used `AddEventDrawer` for creating events
- Calendar used separate `EditRehearsalDrawer` and `EditGigDrawer` for editing
- Dashboard used `AddEventDrawer` for both creating and editing

**Current State:**

- **ALL pages** now use `EditRehearsalDrawer` as the unified drawer
- Single component handles both add and edit modes
- Single component handles both rehearsals and gigs
- `AddEventDrawer.tsx` has been DELETED from the codebase

## Changes Made

### 1. Extended EditRehearsalDrawer Component

**File**: `app/(protected)/calendar/EditRehearsalDrawer.tsx`

**New Props**:

```typescript
type DrawerMode = 'add' | 'edit';

export type EditRehearsalDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onRehearsalUpdated: () => void;
  onDelete?: (rehearsalId: string) => void;

  // Mode: 'add' for creating new events, 'edit' for modifying existing ones
  mode?: DrawerMode;

  // Event type: determines if we're working with rehearsals or gigs
  eventType?: EventType;

  // For edit mode: pass existing event data
  rehearsal?: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    location: string;
    setlist_id?: string | null;
  } | null;

  // For gig edit mode: pass gig data
  gig?: {
    id: string;
    name: string;
    date: string;
    start_time: string;
    end_time: string;
    location: string;
    is_potential?: boolean;
    setlist_id?: string | null;
  } | null;

  // For add mode: optional prefilled date
  prefilledDate?: string;

  // For add mode: default event type selection
  defaultEventType?: EventType;
};
```

**Key Features**:

- **Mode Switching**: Supports both 'add' and 'edit' modes
- **Event Type Switching**: Handles both 'rehearsal' and 'gig' types
- **Dynamic UI**:
  - Title changes: "Add Rehearsal/Gig" vs "Edit Rehearsal/Gig"
  - Button text: "Add Rehearsal/Gig" vs "Update Rehearsal/Gig"
  - Event type tabs enabled in add mode, disabled in edit mode
- **Gig-Specific Fields**:
  - Gig Name input (required for gigs)
  - "Potential Gig" toggle switch
- **Smart Initialization**: Populates form from rehearsal/gig data in edit mode, uses defaults in add mode
- **Validation**: Prevents submission with invalid data (missing date, missing gig name for gigs)
- **Delete Support**: Shows delete button only in edit mode when event ID exists

### 2. Updated CalendarContent

**File**: `app/(protected)/calendar/CalendarContent.tsx`

**Removed**:

- `import AddEventDrawer from './AddEventDrawer';`

**Added**:

- Using `EditRehearsalDrawer` for adding events with `mode="add"`

**State Changes**:

```typescript
// Before:
const [addEventDrawerOpen, setAddEventDrawerOpen] = useState(false);
const [defaultEventType, setDefaultEventType] = useState<'rehearsal' | 'gig'>('rehearsal');

// After:
const [addEventDrawerOpen, setAddEventDrawerOpen] = useState(false);
const [addEventDefaultType, setAddEventDefaultType] = useState<'rehearsal' | 'gig'>('rehearsal');
```

**Drawer Usage**:

```tsx
{/* Unified drawer for adding events (both rehearsals and gigs) */}
<EditRehearsalDrawer
  isOpen={addEventDrawerOpen}
  onClose={() => setAddEventDrawerOpen(false)}
  onRehearsalUpdated={onEventUpdated}
  mode="add"
  prefilledDate={prefilledDate}
  defaultEventType={addEventDefaultType}
/>

{/* Edit drawer for existing rehearsals */}
<EditRehearsalDrawer
  isOpen={editRehearsalDrawerOpen}
  onClose={() => { ... }}
  onRehearsalUpdated={onEventUpdated}
  mode="edit"
  rehearsal={editRehearsal}
  onDelete={handleDeleteRehearsal}
/>
```

### 3. Refactored Dashboard Page

**File**: `app/(protected)/dashboard/page.tsx`

**Import Changed**:

```typescript
// Before:
const AddEventDrawer = dynamic(() => import('@/app/(protected)/calendar/AddEventDrawer'), {
  ssr: false,
});

// After:
const EditRehearsalDrawer = dynamic(
  () => import('@/app/(protected)/calendar/EditRehearsalDrawer'),
  { ssr: false },
);
```

**State Simplified**:

```typescript
// Unified drawer state for EditRehearsalDrawer (handles add/edit for both rehearsals and gigs)
const [drawerOpen, setDrawerOpen] = useState(false);
const [drawerMode, setDrawerMode] = useState<'add' | 'edit'>('add');
const [drawerEventType, setDrawerEventType] = useState<'rehearsal' | 'gig'>('rehearsal');
const [editingRehearsal, setEditingRehearsal] = useState<...>();
const [editingGig, setEditingGig] = useState<...>();
```

**Handler Updates**:

```typescript
const openEditRehearsal = useCallback((rehearsal: Rehearsal) => {
  setEditingRehearsal({
    id: rehearsal.id,
    date: rehearsal.raw_date ?? '',
    start_time: rehearsal.start_time ?? '',
    end_time: rehearsal.end_time ?? '',
    location: rehearsal.location || '',
  });
  setEditingGig(null);
  setDrawerMode('edit');
  setDrawerEventType('rehearsal');
  setDrawerOpen(true);
}, []);

const openEditGig = useCallback((gig: Gig) => {
  setEditingGig({
    id: gig.id,
    name: gig.name || '',
    date: gig.date ?? '',
    start_time: gig.start_time ?? '',
    end_time: gig.end_time ?? '',
    location: gig.location || '',
    is_potential: gig.is_potential ?? false,
    setlist_id: gig.setlist_id || null,
  });
  setEditingRehearsal(null);
  setDrawerMode('edit');
  setDrawerEventType('gig');
  setDrawerOpen(true);
}, []);
```

**"Add Event" Button Handlers**:

```typescript
onClick={() => {
  setDrawerMode('add');
  setDrawerEventType('rehearsal');
  setEditingRehearsal(null);
  setEditingGig(null);
  setDrawerOpen(true);
}}
```

**Single Drawer JSX**:

```tsx
<EditRehearsalDrawer
  isOpen={drawerOpen}
  onClose={() => setDrawerOpen(false)}
  onRehearsalUpdated={
    drawerMode === 'edit'
      ? drawerEventType === 'rehearsal'
        ? handleRehearsalUpdated
        : handleGigUpdated
      : handleEventAdded
  }
  mode={drawerMode}
  eventType={drawerEventType}
  rehearsal={editingRehearsal}
  gig={editingGig}
  defaultEventType={drawerEventType}
/>
```

### 4. Deleted Files

- ✅ `app/(protected)/calendar/AddEventDrawer.tsx` - **REMOVED**

## User Flow

### Add Rehearsal from Calendar

1. User clicks "+ Add Event" button on calendar page
2. `EditRehearsalDrawer` opens with `mode="add"` and `defaultEventType="rehearsal"`
3. User can toggle between Rehearsal/Gig tabs
4. Form shows empty fields ready for input
5. User fills in details and clicks "Add Rehearsal"
6. Drawer performs INSERT operation and closes

### Add Rehearsal from Dashboard

1. User clicks "Schedule Rehearsal" button on dashboard
2. `EditRehearsalDrawer` opens with `mode="add"`, `eventType="rehearsal"`
3. Tabs are enabled, user can switch to Gig if desired
4. User fills in details and clicks "Add Rehearsal"
5. Drawer performs INSERT operation, closes, dashboard refreshes

### Edit Rehearsal from Dashboard

1. User clicks "Edit" on Next Rehearsal card
2. `openEditRehearsal` handler maps rehearsal data to drawer format
3. `EditRehearsalDrawer` opens with `mode="edit"`, `rehearsal={...}`
4. Form auto-populates with existing values
5. Event type tabs are DISABLED (can't change rehearsal to gig)
6. User makes changes and clicks "Update Rehearsal"
7. Drawer performs UPDATE operation and closes
8. Dashboard refreshes with updated data

### Edit Gig from Calendar

1. User clicks on gig event in calendar
2. Event drawer opens, user clicks "Edit"
3. `EditRehearsalDrawer` opens with `mode="edit"`, `gig={...}`
4. Form shows gig name, potential toggle, and all details
5. User updates and clicks "Update Gig"
6. Drawer saves changes and calendar refreshes

## Benefits

1. **Complete Consistency**: Same drawer component across entire app for all event operations
2. **Eliminated Duplication**: Removed `AddEventDrawer.tsx` entirely
3. **Single Source of Truth**: All event creation/editing logic in one place
4. **Reduced Complexity**: No need to maintain separate add vs edit drawers
5. **Better UX**: Users see the same interface everywhere
6. **Type Safety**: Full TypeScript support with proper discriminated unions
7. **Easier Maintenance**: Changes to drawer behavior only need to be made once

## Testing Checklist

- [ ] Calendar → Click "+ Add Event" → Add rehearsal → Verify creation
- [ ] Calendar → Click "+ Add Event" → Switch to Gig tab → Add gig → Verify creation
- [ ] Calendar → Click day with no events → Auto-opens add drawer with prefilled date
- [ ] Calendar → Click rehearsal event → Edit → Update → Verify changes saved
- [ ] Calendar → Click gig event → Edit → Update → Verify changes saved
- [ ] Dashboard → Click "Schedule Rehearsal" → Add rehearsal → Verify creation
- [ ] Dashboard → Click "Edit" on Next Rehearsal → Update → Verify changes saved
- [ ] Dashboard → Click "Edit" on Upcoming Gig → Update → Verify changes saved
- [ ] Verify event type tabs are enabled in add mode
- [ ] Verify event type tabs are disabled in edit mode
- [ ] Verify gig name field is required when adding/editing gigs
- [ ] Verify "Potential Gig" toggle works correctly
- [ ] Verify setlist selection works for both rehearsals and gigs
- [ ] Verify delete button only shows in edit mode
- [ ] Verify time conversions work correctly (24-hour stored, 12-hour displayed)
- [ ] Verify no "Invalid time value" errors occur

## Files Modified

1. `app/(protected)/calendar/EditRehearsalDrawer.tsx` - Extended with full add mode support
2. `app/(protected)/calendar/CalendarContent.tsx` - Updated to use EditRehearsalDrawer for adds
3. `app/(protected)/dashboard/page.tsx` - Updated to use EditRehearsalDrawer for all operations
4. `docs/DASHBOARD_DRAWER_UNIFICATION.md` - This documentation

## Files Deleted

1. ✅ `app/(protected)/calendar/AddEventDrawer.tsx` - **COMPLETELY REMOVED**

## Build Status

✅ All changes type-check successfully
✅ No compilation errors
✅ All imports updated correctly
✅ No references to deleted file remain

## Time/Date Handling

The unified drawer properly handles time and date to avoid "Invalid time value" errors:

- **Storage Format**: Times stored as 24-hour format strings (e.g., "19:00")
- **Display Format**: Times shown as 12-hour with AM/PM (e.g., "7:00 PM")
- **Date Handling**: Dates stored as YYYY-MM-DD strings, parsed to Date objects for shadcn Calendar
- **Conversion**: `parseTimeString()` helper safely converts between formats
- **Validation**: Never calls `new Date("HH:mm")`, always composes proper date strings

## Props Reference

### EditRehearsalDrawer Complete Props

```typescript
interface EditRehearsalDrawerProps {
  isOpen: boolean; // Controls drawer visibility
  onClose: () => void; // Called when drawer closes
  onRehearsalUpdated: () => void; // Called after successful save (create or update)
  onDelete?: (id: string) => void; // Optional: called when user deletes event

  mode?: 'add' | 'edit'; // Default: 'edit'
  eventType?: 'rehearsal' | 'gig'; // Overrides defaultEventType in add mode

  rehearsal?: {
    // For editing existing rehearsal
    id: string;
    date: string; // YYYY-MM-DD
    start_time: string; // HH:mm (24-hour)
    end_time: string; // HH:mm (24-hour)
    location: string;
    setlist_id?: string | null;
  } | null;

  gig?: {
    // For editing existing gig
    id: string;
    name: string;
    date: string; // YYYY-MM-DD
    start_time: string; // HH:mm (24-hour)
    end_time: string; // HH:mm (24-hour)
    location: string;
    is_potential?: boolean;
    setlist_id?: string | null;
  } | null;

  prefilledDate?: string; // YYYY-MM-DD for add mode
  defaultEventType?: 'rehearsal' | 'gig'; // Default: 'rehearsal'
}
```

## Migration Notes

If you previously had code using `AddEventDrawer`:

```typescript
// OLD:
import AddEventDrawer from '@/app/(protected)/calendar/AddEventDrawer';

<AddEventDrawer
  isOpen={open}
  onClose={() => setOpen(false)}
  onEventUpdated={refresh}
  prefilledDate="2025-10-25"
  defaultEventType="rehearsal"
/>

// NEW:
import EditRehearsalDrawer from '@/app/(protected)/calendar/EditRehearsalDrawer';

<EditRehearsalDrawer
  isOpen={open}
  onClose={() => setOpen(false)}
  onRehearsalUpdated={refresh}
  mode="add"
  prefilledDate="2025-10-25"
  defaultEventType="rehearsal"
/>
```

For edit mode (previously separate components):

```typescript
// OLD:
<EditRehearsalDrawer
  isOpen={open}
  onClose={close}
  onRehearsalUpdated={refresh}
  rehearsal={data}
/>

// NEW: (mostly unchanged, just add mode prop if needed)
<EditRehearsalDrawer
  isOpen={open}
  onClose={close}
  onRehearsalUpdated={refresh}
  mode="edit"  // Optional, defaults to 'edit' anyway
  rehearsal={data}
/>
```

## Benefits

1. **Consistent UX**: Dashboard now uses same drawer design/interaction as calendar's "Add Event" flow
2. **Code Reuse**: Eliminated duplicate edit drawer components for dashboard
3. **Maintainability**: Single source of truth for edit logic (AddEventDrawer)
4. **Flexibility**: `source` prop allows drawer to track and potentially adjust behavior based on where it was opened
5. **Type Safety**: Full TypeScript support with proper typing for all props

## Testing Checklist

- [ ] Dashboard → Click "Edit" on rehearsal → Drawer opens with data → Update → Save → Verify update
- [ ] Dashboard → Click "Edit" on gig → Drawer opens with data → Update → Save → Verify update
- [ ] Dashboard → Click "Add Event" button → Drawer opens in create mode → Add rehearsal → Save
- [ ] Dashboard → Click "Add Event" button → Drawer opens in create mode → Add gig → Save
- [ ] Calendar → Verify edit flow still uses existing edit drawers (no regression)
- [ ] Verify time conversions work correctly (24-hour stored, 12-hour displayed)
- [ ] Verify setlist selection works for gigs
- [ ] Verify "potential gig" checkbox works
- [ ] Verify console logs appear for debugging (edit mode opens)

## Files Modified

1. `app/(protected)/calendar/AddEventDrawer.tsx` - Extended with edit mode support
2. `app/(protected)/dashboard/page.tsx` - Refactored to use AddEventDrawer for edits
3. `docs/DASHBOARD_DRAWER_UNIFICATION.md` - This documentation

## No TypeScript Errors

✅ All changes type-check successfully
✅ No compilation errors
✅ Backward compatible (calendar edit flow unchanged)
