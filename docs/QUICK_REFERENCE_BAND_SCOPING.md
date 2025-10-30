# 🎯 Multi-Band Scoping Quick Reference

## For UI Components

```typescript
import { useBands } from '@/contexts/BandsContext';
import { useBandChange } from '@/hooks/useBandChange';

const { currentBand } = useBands();

// React to band changes
useBandChange({
  onBandChange: () => {
    closeDrawers(); // Close any open modals/drawers
    clearState(); // Clear stale arrays/objects
    refetchData(); // Load data for new band
  },
});

// Always filter by currentBand.id
const loadData = async () => {
  if (!currentBand?.id) return;
  const res = await fetch(`/api/data?band_id=${currentBand.id}`);
  // ...
};
```

## For API Routes

```typescript
import { requireBandMembership, requireResourceInBand } from '@/lib/server/band-scope';

export async function GET(request: NextRequest) {
  const bandId = searchParams.get('band_id');

  // Verify user is band member
  await requireBandMembership(bandId);

  // Verify resource belongs to band (for detail routes)
  await requireResourceInBand('table_name', resourceId, bandId);

  // Always filter by band_id
  const { data } = await supabase.from('table').select('*').eq('band_id', bandId);

  return NextResponse.json({ data });
}
```

## For Database Migrations

```sql
-- Add band_id column
ALTER TABLE my_table ADD COLUMN band_id UUID REFERENCES bands(id) ON DELETE CASCADE NOT NULL;

-- Create index
CREATE INDEX idx_my_table_band_id ON my_table(band_id);

-- Add RLS policy
CREATE POLICY "Band members can view" ON my_table
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_id = my_table.band_id
      AND user_id = auth.uid()
      AND is_active = true
    )
  );
```

## ⚠️ Common Mistakes

### ❌ DON'T

```typescript
// Missing band_id filter
const { data } = await supabase.from('gigs').select('*');

// No band change handling
const [gigs, setGigs] = useState([]);

// No authorization check
export async function GET(request) {
  return supabase.from('gigs').select('*');
}
```

### ✅ DO

```typescript
// Always filter by band_id
const { data } = await supabase.from('gigs').select('*').eq('band_id', currentBand.id);

// Clear state on band change
useBandChange({ onBandChange: () => setGigs([]) });

// Always verify membership
await requireBandMembership(bandId);
```

## 🔍 Testing Checklist

- [ ] Create two bands with different data
- [ ] Switch bands → only see current band data
- [ ] Drawers close on switch
- [ ] Network requests include `band_id`
- [ ] Attempting cross-band access returns 403

## 📚 Full Docs

See `docs/MULTI_BAND_SCOPING.md` for complete architecture guide.
