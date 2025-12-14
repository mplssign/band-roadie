# API Routes Band Scoping Status

## ✅ Updated Routes (Band Scoping Implemented)

### `/api/setlists` - GET, POST

- **Status**: ✅ Complete
- **Changes**:
  - Added `requireBandMembership()` check
  - Requires `band_id` parameter
  - Returns 403 if user not a member
- **File**: `app/api/setlists/route.ts`

## 🔄 Routes Requiring Update

### `/api/setlists/[id]` - GET, PUT, DELETE

- **Action Needed**: Add `requireResourceInBand()` check to verify setlist belongs to user's band
- **Priority**: High (users could access other bands' setlists)

### `/api/setlists/[id]/songs` - GET, POST

- **Action Needed**: Verify setlist belongs to current band before adding songs
- **Priority**: High

### `/api/bands/[bandId]/members` - GET, POST

- **Status**: Likely OK (already uses bandId in path)
- **Action Needed**: Verify `requireBandMembership()` is called

### `/api/bands/[bandId]/invites` - GET, POST

- **Status**: Likely OK (already uses bandId in path)
- **Action Needed**: Verify authorization

## ✅ Routes Not Requiring Band Scoping

### `/api/auth/*` - Authentication routes

- No band scoping needed (auth is user-level)

### `/api/profile` - User profile

- No band scoping needed (profile is user-level)

### `/api/roles` - Global roles

- No band scoping needed (roles are global)

### `/api/songs` - Song library

- Special case: Songs are global but confirmed tunings are band-specific
- May need partial scoping for tuning confirmations

### `/api/bands` - Band CRUD

- Scoped by user membership, not by current band

## 🚧 To Be Reviewed

### `/api/tunings` - Song tuning confirmations

- **Action Needed**: Review if confirmations should be band-scoped
- **Priority**: Medium

### `/api/cleanup-tunings` - Maintenance endpoint

- **Action Needed**: Determine if this needs band scoping
- **Priority**: Low (likely admin/maintenance only)

## Implementation Pattern

For routes that need updating, use this pattern:

```typescript
import { requireBandMembership, requireResourceInBand } from '@/lib/server/band-scope';

// For creating/listing resources
export async function GET(request: NextRequest) {
  const bandId = searchParams.get('band_id');
  if (!bandId) return NextResponse.json({ error: 'Band ID required' }, { status: 400 });

  await requireBandMembership(bandId);
  // ... rest of logic
}

// For accessing specific resources
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const bandId = searchParams.get('band_id');
  await requireBandMembership(bandId);
  await requireResourceInBand('setlists', params.id, bandId);
  // ... rest of logic
}
```

## Next Steps

1. Update high-priority routes (`/api/setlists/[id]/*`)
2. Review band-specific routes for proper authorization
3. Add integration tests for cross-band access attempts
4. Document any routes that intentionally allow cross-band access
