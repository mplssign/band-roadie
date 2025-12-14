# Migration Guide: Adding Band Scoping to Existing Code

This guide walks you through updating existing code to support proper multi-band scoping.

## 📋 Before You Start

1. Read `docs/MULTI_BAND_SCOPING.md` for architecture overview
2. Review `docs/QUICK_REFERENCE_BAND_SCOPING.md` for code patterns
3. Check `docs/API_ROUTES_BAND_SCOPING_STATUS.md` for current status

## 🔄 Step-by-Step Migration

### Step 1: Update UI Component

**Before:**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useBands } from '@/contexts/BandsContext';

export default function MyPage() {
  const { currentBand } = useBands();
  const [items, setItems] = useState([]);

  useEffect(() => {
    async function loadItems() {
      const res = await fetch('/api/items');
      const data = await res.json();
      setItems(data.items);
    }
    loadItems();
  }, []);

  return <div>{items.map(item => <Item key={item.id} {...item} />)}</div>;
}
```

**After:**

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useBands } from '@/contexts/BandsContext';
import { useBandChange } from '@/hooks/useBandChange';

export default function MyPage() {
  const { currentBand } = useBands();
  const [items, setItems] = useState([]);

  // Make loadItems a useCallback so it can be used in dependencies
  const loadItems = useCallback(async () => {
    if (!currentBand?.id) return;

    // Include band_id in request
    const res = await fetch(`/api/items?band_id=${currentBand.id}`);
    const data = await res.json();
    setItems(data.items);
  }, [currentBand?.id]);

  // React to band changes
  useBandChange({
    onBandChange: () => {
      setItems([]);  // Clear stale data
      if (currentBand?.id) {
        loadItems();  // Refetch for new band
      }
    }
  });

  // Initial load
  useEffect(() => {
    if (currentBand?.id) {
      loadItems();
    }
  }, [currentBand?.id, loadItems]);

  return <div>{items.map(item => <Item key={item.id} {...item} />)}</div>;
}
```

**Changes Made:**

1. ✅ Import `useBandChange` hook
2. ✅ Convert load function to `useCallback`
3. ✅ Check `currentBand?.id` exists before loading
4. ✅ Include `band_id` in API request
5. ✅ Add `useBandChange` to clear state and refetch
6. ✅ Update `useEffect` to depend on `currentBand?.id`

### Step 2: Update API Route

**Before:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createClient();

  const { data, error } = await supabase.from('items').select('*');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data });
}
```

**After:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireBandMembership } from '@/lib/server/band-scope';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bandId = searchParams.get('band_id');

  // Validate band_id parameter
  if (!bandId) {
    return NextResponse.json({ error: 'Band ID is required' }, { status: 400 });
  }

  try {
    // Verify user is a member of this band
    await requireBandMembership(bandId);

    const supabase = await createClient();

    // Filter by band_id
    const { data, error } = await supabase.from('items').select('*').eq('band_id', bandId);

    if (error) throw error;

    return NextResponse.json({ items: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const isForbidden = message.includes('Forbidden') || message.includes('not a member');

    return NextResponse.json({ error: message }, { status: isForbidden ? 403 : 500 });
  }
}
```

**Changes Made:**

1. ✅ Import `requireBandMembership`
2. ✅ Get `band_id` from query params
3. ✅ Validate `band_id` exists
4. ✅ Call `requireBandMembership(bandId)`
5. ✅ Filter query by `band_id`
6. ✅ Add proper error handling with 403 for unauthorized

### Step 3: Update Detail Route (GET /items/[id])

**Before:**

```typescript
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { id } = params;

  const { data, error } = await supabase.from('items').select('*').eq('id', id).single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}
```

**After:**

```typescript
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { id } = params;
  const { searchParams } = new URL(request.url);
  const bandId = searchParams.get('band_id');

  if (!bandId) {
    return NextResponse.json({ error: 'Band ID is required' }, { status: 400 });
  }

  try {
    // Verify user is a member
    await requireBandMembership(bandId);

    // Verify this item belongs to this band
    await requireResourceInBand('items', id, bandId);

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .eq('band_id', bandId) // Belt-and-suspenders filtering
      .single();

    if (error) throw error;

    return NextResponse.json({ item: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const isForbidden = message.includes('Forbidden') || message.includes('not a member');

    return NextResponse.json({ error: message }, { status: isForbidden ? 403 : 500 });
  }
}
```

**Changes Made:**

1. ✅ Import `requireResourceInBand`
2. ✅ Get and validate `band_id`
3. ✅ Call `requireBandMembership(bandId)`
4. ✅ Call `requireResourceInBand('items', id, bandId)`
5. ✅ Filter query by both `id` and `band_id`

### Step 4: Update Component with Drawer

**Before:**

```typescript
export default function MyPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  return (
    <>
      <ItemList onItemClick={(item) => {
        setSelectedItem(item);
        setDrawerOpen(true);
      }} />

      <EditDrawer
        isOpen={drawerOpen}
        item={selectedItem}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
```

**After:**

```typescript
export default function MyPage() {
  const { currentBand } = useBands();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Close drawer when band changes
  useBandChange({
    onBandChange: () => {
      setDrawerOpen(false);
      setSelectedItem(null);
    }
  });

  return (
    <>
      <ItemList onItemClick={(item) => {
        setSelectedItem(item);
        setDrawerOpen(true);
      }} />

      <EditDrawer
        isOpen={drawerOpen}
        item={selectedItem}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedItem(null);
        }}
      />
    </>
  );
}
```

**Changes Made:**

1. ✅ Add `useBandChange` hook
2. ✅ Close drawer on band change
3. ✅ Clear selected item on band change

### Step 5: Update Database (if needed)

If your table doesn't have `band_id` yet:

```sql
-- Add column
ALTER TABLE items ADD COLUMN band_id UUID REFERENCES bands(id) ON DELETE CASCADE;

-- Backfill (adjust logic as needed)
UPDATE items SET band_id = (
  SELECT band_id FROM some_related_table
  WHERE some_related_table.item_id = items.id
);

-- Make NOT NULL after backfill
ALTER TABLE items ALTER COLUMN band_id SET NOT NULL;

-- Add index
CREATE INDEX idx_items_band_id ON items(band_id);

-- Add RLS policy
CREATE POLICY "Band members can view items" ON items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_id = items.band_id
      AND user_id = auth.uid()
      AND is_active = true
    )
  );

-- Repeat for INSERT, UPDATE, DELETE policies
```

## 🧪 Testing Your Changes

### 1. Create Test Data

```typescript
// In Supabase SQL Editor or test setup
INSERT INTO bands (id, name) VALUES
  ('band-a-uuid', 'Band A'),
  ('band-b-uuid', 'Band B');

INSERT INTO items (band_id, name) VALUES
  ('band-a-uuid', 'Item from Band A'),
  ('band-b-uuid', 'Item from Band B');
```

### 2. Manual Test

1. Log in and select Band A
2. Verify you see "Item from Band A"
3. Verify you DON'T see "Item from Band B"
4. Switch to Band B
5. Verify drawer closes (if open)
6. Verify you now see "Item from Band B"
7. Verify you DON'T see "Item from Band A"

### 3. Test Cross-Band Access

1. While in Band A, copy the URL for an item
2. Switch to Band B
3. Try to access that URL
4. Should get 403 Forbidden or 404 Not Found

### 4. Check Network Tab

1. Switch bands
2. Open Network tab
3. Verify all requests include `band_id` parameter
4. Verify responses only contain current band data

## ✅ Checklist

Before marking your migration complete:

- [ ] UI component imports `useBandChange`
- [ ] UI component includes `band_id` in API calls
- [ ] UI component clears state on band change
- [ ] API route validates `band_id` parameter
- [ ] API route calls `requireBandMembership()`
- [ ] API route filters queries by `band_id`
- [ ] API route returns 403 for unauthorized access
- [ ] Database table has `band_id` column
- [ ] Database table has index on `band_id`
- [ ] Database table has RLS policies
- [ ] Tested with two bands
- [ ] Verified no cross-band data leakage
- [ ] Verified drawers close on band switch

## 🆘 Troubleshooting

### "User is not a member of band X"

**Cause**: User switched bands but API still using old band ID  
**Fix**: Ensure `band_id` comes from `currentBand.id` or query params

### Data shows from multiple bands

**Cause**: Missing `.eq('band_id', bandId)` filter  
**Fix**: Add filter to all database queries

### Drawer shows old band's data after switch

**Cause**: Missing `useBandChange` hook  
**Fix**: Add hook to close drawer on band change

### API returns 400 "Band ID is required"

**Cause**: UI not sending `band_id` parameter  
**Fix**: Add `?band_id=${currentBand.id}` to fetch URL

## 📚 Additional Resources

- Full Architecture: `docs/MULTI_BAND_SCOPING.md`
- Quick Reference: `docs/QUICK_REFERENCE_BAND_SCOPING.md`
- API Status: `docs/API_ROUTES_BAND_SCOPING_STATUS.md`
- Examples: `app/api/setlists/route.ts`, `app/(protected)/setlists/page.tsx`

## 🎓 Learning Path

1. Read this migration guide
2. Update one simple API route (e.g., GET /items)
3. Update the corresponding UI component
4. Test thoroughly
5. Repeat for other routes
6. Review and refactor as needed

Good luck! 🚀
