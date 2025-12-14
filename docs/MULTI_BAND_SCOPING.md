# Multi-Band Scoping Implementation

## Overview

This document describes the multi-band scoping architecture implemented in Band Roadie. The system ensures that when a user switches bands, all content updates to show only data for the selected band, with no cross-band data leakage.

## Architecture

### 1. State Management (`contexts/BandsContext.tsx`)

**Key Features:**

- Cookie + localStorage persistence for current band selection
- Custom event system for notifying components of band changes
- Automatic state clearing on band switch

**API:**

```typescript
interface BandsContextType {
  bands: Band[];
  currentBand: Band | null;
  loading: boolean;
  setCurrentBandId: (id: string) => void;
  setCurrentBand: (bandOrId: Band | string | null) => void;
  refreshBands: () => Promise<void>;
  clearBandState: () => void;
}
```

**Implementation Details:**

- Sets both localStorage (`br_current_band_id`) and cookie (`br_current_band_id`)
- Cookie enables server-side band detection
- Dispatches `'band-changed'` event when band switches
- Automatically called by `setCurrentBand` and `setCurrentBandId`

### 2. Server-Side Utilities (`lib/server/band-scope.ts`)

**Purpose:** Enforce band scoping and authorization in API routes and server components.

**Key Functions:**

```typescript
// Get current band ID from cookies or user's first band
async function getCurrentBandId(): Promise<string | null>;

// Set current band ID in cookies (server-side)
async function setCurrentBandId(bandId: string): Promise<void>;

// Verify user is a member of the band (throws if not)
async function requireBandMembership(bandId: string): Promise<void>;

// Check if user is a member of the band
async function getUserBandMembership(bandId: string): Promise<boolean>;

// Create a band-scoped query builder
function withBandScope(supabase, bandId, table);

// Verify a resource belongs to the band
async function requireResourceInBand(table, resourceId, bandId): Promise<void>;
```

**Usage in API Routes:**

```typescript
import { requireBandMembership } from '@/lib/server/band-scope';

export async function GET(request: NextRequest) {
  const bandId = searchParams.get('band_id');

  // Verify authorization
  await requireBandMembership(bandId);

  // Query data - only this band's data will be returned
  const { data } = await supabase.from('gigs').select('*').eq('band_id', bandId);

  return NextResponse.json({ data });
}
```

### 3. Client-Side Hooks

#### `useBandChange` (`hooks/useBandChange.ts`)

Hook to react to band switches and refetch data.

```typescript
useBandChange({
  onBandChange: () => {
    // Close drawers
    setDrawerOpen(false);

    // Clear stale state
    setEvents([]);

    // Refetch data
    loadData();
  },
});
```

**How it works:**

- Listens for `'band-changed'` custom event
- Tracks `currentBand` prop changes
- Calls callback on band switch
- Optionally calls on mount with `callOnMount: true`

#### `useCurrentBandId` (`hooks/useBandChange.ts`)

Simple hook to get the current band ID.

```typescript
const bandId = useCurrentBandId();
```

### 4. Component Wrapper (`components/layout/BandBoundary.tsx`)

**Purpose:** Wrap protected pages to ensure band context is loaded before rendering.

```typescript
<BandBoundary
  requireBand={true}
  loadingComponent={<CustomLoader />}
  noBandsComponent={<NoBandsMessage />}
>
  <YourPage />
</BandBoundary>
```

**Features:**

- Checks authentication
- Waits for band context to load
- Optionally requires a band to be selected
- Shows custom loading/no-bands states

### 5. Database Layer

#### Schema

All band-scoped tables include:

```sql
band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE NOT NULL
```

**Tables with band_id:**

- `gigs`
- `rehearsals`
- `setlists`
- `setlist_songs` (inherited from setlist)
- `block_dates`
- `band_members`
- `band_invitations`

#### Indexes (Migration `014_add_multi_band_scoping.sql`)

```sql
CREATE INDEX idx_gigs_band_date ON gigs(band_id, date);
CREATE INDEX idx_rehearsals_band_date ON rehearsals(band_id, date);
CREATE INDEX idx_block_dates_band_date ON block_dates(band_id, date);
CREATE INDEX idx_setlists_band_id ON setlists(band_id);
```

#### Row Level Security (RLS)

All band-scoped tables have policies like:

```sql
CREATE POLICY "Band members can view" ON gigs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_id = gigs.band_id
      AND user_id = auth.uid()
      AND is_active = true
    )
  );
```

This ensures database-level security even if application code has bugs.

## Implementation Checklist

### For Each Page Component

- [ ] Import `useBandChange` hook
- [ ] Wrap data fetching in `useCallback`
- [ ] Add `useBandChange` to clear state and refetch
- [ ] Filter all queries by `currentBand.id`
- [ ] Close drawers/modals on band change
- [ ] Clear local state arrays on band change

**Example Pattern:**

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useBands } from '@/contexts/BandsContext';
import { useBandChange } from '@/hooks/useBandChange';

export default function MyPage() {
  const { currentBand } = useBands();
  const [data, setData] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentBand?.id) return;

    const response = await fetch(`/api/data?band_id=${currentBand.id}`);
    const json = await response.json();
    setData(json.data);
  }, [currentBand?.id]);

  // React to band changes
  useBandChange({
    onBandChange: () => {
      setDrawerOpen(false); // Close drawers
      setData([]);          // Clear stale data
      if (currentBand?.id) {
        loadData();         // Refetch
      }
    }
  });

  useEffect(() => {
    if (currentBand?.id) {
      loadData();
    }
  }, [currentBand?.id, loadData]);

  return (
    <div>
      {data.map(item => <Item key={item.id} {...item} />)}
    </div>
  );
}
```

### For Each API Route

- [ ] Import `requireBandMembership` from `lib/server/band-scope`
- [ ] Get `bandId` from query params or request body
- [ ] Call `await requireBandMembership(bandId)` before queries
- [ ] Always filter queries by `band_id`
- [ ] Return 403 if authorization fails
- [ ] Handle errors properly

**Example Pattern:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireBandMembership } from '@/lib/server/band-scope';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bandId = searchParams.get('band_id');

  if (!bandId) {
    return NextResponse.json({ error: 'Band ID is required' }, { status: 400 });
  }

  try {
    // Verify authorization
    await requireBandMembership(bandId);

    // Query data (band-scoped)
    const supabase = await createClient();
    const { data, error } = await supabase.from('table').select('*').eq('band_id', bandId);

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const isForbidden = message.includes('Forbidden') || message.includes('not a member');

    return NextResponse.json({ error: message }, { status: isForbidden ? 403 : 500 });
  }
}
```

## Testing

### Manual Testing Checklist

1. **Create Two Bands**
   - Create Band A
   - Create Band B
   - Add distinct gigs/rehearsals to each

2. **Test Dashboard**
   - View Band A dashboard → see only Band A data
   - Switch to Band B → see only Band B data
   - Verify no Band A data appears

3. **Test Calendar**
   - View Band A calendar → see only Band A events
   - Switch to Band B → calendar clears and shows Band B events
   - Verify dots update correctly

4. **Test Drawers/Modals**
   - Open edit drawer for Band A event
   - Switch to Band B
   - Verify drawer closes
   - Verify cannot edit Band A event from Band B context

5. **Test API Routes**
   - Use Network tab to verify all requests include `band_id`
   - Try to access Band A resource with Band B in context
   - Should return 403 Forbidden

6. **Test Deep Links**
   - Copy URL with Band A gig ID
   - Switch to Band B
   - Visit that URL
   - Should show 404 or redirect

### Integration Test Example

```typescript
describe('Multi-band scoping', () => {
  it('shows only current band data', async () => {
    // Seed Band A and B with distinct data
    const bandA = await createBand('Band A');
    const bandB = await createBand('Band B');
    await createGig(bandA.id, 'Gig A');
    await createGig(bandB.id, 'Gig B');

    // Render dashboard with Band A
    await selectBand(bandA.id);
    const { getByText, queryByText } = render(<Dashboard />);

    expect(getByText('Gig A')).toBeInTheDocument();
    expect(queryByText('Gig B')).not.toBeInTheDocument();

    // Switch to Band B
    await selectBand(bandB.id);
    await waitFor(() => {
      expect(queryByText('Gig A')).not.toBeInTheDocument();
      expect(getByText('Gig B')).toBeInTheDocument();
    });
  });
});
```

## Common Pitfalls

### ❌ Don't: Forget to filter by band_id

```typescript
// BAD - returns data from all bands
const { data } = await supabase.from('gigs').select('*');
```

### ✅ Do: Always filter by band_id

```typescript
// GOOD - returns only current band's data
const { data } = await supabase.from('gigs').select('*').eq('band_id', currentBand.id);
```

### ❌ Don't: Store band-specific data in global state

```typescript
// BAD - state persists across band switches
const [gigs, setGigs] = useState([]);
```

### ✅ Do: Clear state on band change

```typescript
// GOOD - clears on band switch
useBandChange({
  onBandChange: () => setGigs([]),
});
```

### ❌ Don't: Skip authorization in API routes

```typescript
// BAD - any user can access any band's data
export async function GET(request) {
  const bandId = searchParams.get('band_id');
  return supabase.from('gigs').select('*').eq('band_id', bandId);
}
```

### ✅ Do: Verify membership

```typescript
// GOOD - verifies user is band member
export async function GET(request) {
  const bandId = searchParams.get('band_id');
  await requireBandMembership(bandId);
  return supabase.from('gigs').select('*').eq('band_id', bandId);
}
```

## Performance Considerations

1. **Indexes**: All `band_id` columns are indexed with composite indexes on frequently queried fields
2. **Query Count**: Band switching triggers refetches, but data is cached per band
3. **RLS**: Database policies prevent fetching wrong band data even if app has bugs

## Migration Path

If you have legacy data without `band_id`:

1. Run migration: `014_add_multi_band_scoping.sql`
2. Backfill: Migration attempts to infer band from user membership
3. Manual cleanup: Review and fix any NULL `band_id` values
4. Test: Verify all queries include band scoping

## Future Enhancements

- [ ] Add query result caching per band
- [ ] Implement optimistic updates for band switching
- [ ] Add band-switch animation/transition
- [ ] Create developer tools panel showing current band context
- [ ] Add telemetry to track cross-band query attempts
