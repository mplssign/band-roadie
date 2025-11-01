# Real-Time Updates Test Plan

## Overview
This document outlines manual testing scenarios for the real-time collaboration features in Band Roadie. The system uses Server-Sent Events (SSE) to broadcast changes across all band members in real-time.

## Test Environment Setup

### Prerequisites
- Two or more devices/browsers (or incognito windows)
- Different user accounts that are members of the same band
- Development server running (`npm run dev`)
- Network connectivity

### Initial Setup
1. Create test band with multiple members
2. Log in to different user accounts on separate devices/browsers
3. Ensure both users are viewing the same band
4. Open browser developer tools to monitor network/console activity

## Test Scenarios

### 1. Dashboard Real-Time Updates

#### Test 1.1: Potential Gig Response Changes
**Objective**: Verify gig response counts update live across devices

**Steps**:
1. Device A: Create a potential gig
2. Device B: Verify potential gig appears on dashboard
3. Device A: Respond "Yes" to the gig
4. Device B: Verify "Yes" count increments without refresh
5. Device A: Change response to "No"
6. Device B: Verify counts update (Yes decrements, No increments)

**Expected Results**:
- Device B shows live update banner when Device A responds
- Counts update immediately without page refresh
- Toast notification shows user's response change
- No duplicate responses or incorrect counts

#### Test 1.2: Rehearsal Updates
**Objective**: Verify rehearsal changes appear live

**Steps**:
1. Device A: Create a rehearsal for tomorrow
2. Device B: Verify rehearsal appears in "Next Rehearsal" card
3. Device A: Edit rehearsal time/location
4. Device B: Verify changes appear with live update banner
5. Device A: Delete the rehearsal
6. Device B: Verify rehearsal card disappears

**Expected Results**:
- New rehearsals appear immediately
- Changes show live update banner with option to refresh
- Deleted rehearsals disappear from dashboard
- No stale data displayed

### 2. Setlist Real-Time Updates

#### Test 2.1: Song Operations
**Objective**: Verify song additions/removals/reordering sync live

**Steps**:
1. Device A & B: Open same setlist
2. Device A: Add a new song to the setlist
3. Device B: Verify song appears with live update banner
4. Device A: Reorder songs (drag & drop)
5. Device B: Verify new order appears
6. Device A: Remove a song
7. Device B: Verify song disappears

**Expected Results**:
- Song additions appear immediately
- Reordering syncs across devices
- Removals are reflected instantly
- Total duration updates automatically
- Song metadata changes (BPM, tuning) sync

#### Test 2.2: Bulk Operations
**Objective**: Verify bulk paste operations broadcast properly

**Steps**:
1. Device A: Open setlist
2. Device B: View same setlist
3. Device A: Use bulk paste to add multiple songs
4. Device B: Verify all songs appear with single update notification
5. Device A: Use provider import (Spotify/Apple Music)
6. Device B: Verify imported songs appear

**Expected Results**:
- Bulk operations show as single update event
- All songs appear simultaneously
- Duration calculations update correctly
- No UI flicker or duplicate songs

### 3. Calendar Real-Time Updates

#### Test 3.1: Event Creation/Editing
**Objective**: Verify calendar events sync across views

**Steps**:
1. Device A & B: Open calendar view
2. Device A: Create a new gig for next week
3. Device B: Verify gig appears on calendar
4. Device A: Edit gig time/date
5. Device B: Verify gig moves to new time slot
6. Device A: Convert gig to potential gig
7. Device B: Verify gig status changes

**Expected Results**:
- New events appear on calendar immediately
- Time/date changes reflow calendar properly
- Status changes (potential ↔ confirmed) update visually
- Calendar view maintains scroll position

#### Test 3.2: Blockout Dates
**Objective**: Verify blockout date changes sync

**Steps**:
1. Device A: Add blockout dates
2. Device B: Verify blockouts appear on calendar
3. Device A: Remove blockout dates
4. Device B: Verify blockouts disappear

**Expected Results**:
- Blockouts appear/disappear immediately
- No conflicts with existing events
- Proper visual differentiation maintained

### 4. Member Management Real-Time Updates

#### Test 4.1: Member Join/Leave Events
**Objective**: Verify membership changes broadcast properly

**Steps**:
1. Device A: Invite new member via email
2. Device B: Monitor for member join events
3. New member: Accept invitation
4. Device A & B: Verify new member appears in member list
5. Device A: Remove a member
6. Device B: Verify member disappears from list

**Expected Results**:
- Member join events broadcast to all members
- Member removal syncs immediately
- Gig response counts update when members join/leave
- Profile changes (name, avatar) sync across devices

### 5. Conflict Resolution

#### Test 5.1: Simultaneous Editing
**Objective**: Test conflict detection and resolution

**Steps**:
1. Device A & B: Open same gig for editing
2. Device A: Start editing gig name
3. Device B: Edit same gig name to different value
4. Device A: Save changes first
5. Device B: Attempt to save changes
6. Device B: Verify conflict dialog appears
7. Device B: Choose resolution (keep local/accept remote/merge)

**Expected Results**:
- Conflict dialog shows both versions clearly
- User can choose resolution method
- Final result matches chosen resolution
- No data loss occurs

#### Test 5.2: Optimistic Updates
**Objective**: Verify optimistic UI handles failures gracefully

**Steps**:
1. Device A: Make changes with poor network connection
2. Verify "Saving..." indicator appears
3. Disconnect network completely
4. Device A: Make more changes
5. Verify changes show as "pending"
6. Reconnect network
7. Verify changes either confirm or show as failed

**Expected Results**:
- Optimistic updates show pending state
- Failed updates are clearly marked
- User can retry failed operations
- No duplicate data on resolution

### 6. Performance & Stability

#### Test 6.1: Connection Stability
**Objective**: Verify reconnection handling

**Steps**:
1. Device A: Establish connection (green indicator)
2. Disable network for 30 seconds
3. Re-enable network
4. Verify automatic reconnection occurs
5. Test that events during disconnection are handled properly

**Expected Results**:
- Connection indicator shows disconnected state
- Automatic reconnection attempts occur
- Missed events are handled on reconnection
- No memory leaks or duplicate connections

#### Test 6.2: Rapid Updates
**Objective**: Test system under high update frequency

**Steps**:
1. Device A: Rapidly reorder setlist songs (drag & drop quickly)
2. Device B: Verify smooth updates without flicker
3. Device A: Quickly add/remove multiple songs
4. Device B: Verify UI remains responsive

**Expected Results**:
- No UI flicker or jumping
- Updates are batched appropriately
- Performance remains smooth
- Final state is consistent

#### Test 6.3: Band Isolation
**Objective**: Verify no cross-band data leakage

**Steps**:
1. User is member of Band A and Band B
2. Device A: Switch to Band A, make changes
3. Device B: Stay on Band B
4. Verify Device B receives no updates
5. Device B: Switch to Band A
6. Verify Device B now receives Band A updates

**Expected Results**:
- Updates only received for current band
- No mixing of band data
- Clean state when switching bands
- Immediate updates after band switch

## Expected Behaviors

### Visual Feedback
- ✅ Live update banners appear for remote changes
- ✅ Toast notifications show specific change details
- ✅ Optimistic updates show "Saving..." state
- ✅ Failed updates are clearly marked
- ✅ Connection status visible in development mode

### Performance
- ✅ Updates appear within 300ms typically
- ✅ No page reloads required
- ✅ Smooth animations and transitions
- ✅ No memory leaks after extended use
- ✅ Graceful degradation when offline

### User Experience
- ✅ Non-blocking update notifications
- ✅ Clear conflict resolution options
- ✅ Preserved scroll positions and focus
- ✅ Keyboard navigation works with live updates
- ✅ Screen reader announcements for accessibility

## Common Issues & Troubleshooting

### Connection Issues
- **Symptom**: Red disconnected indicator
- **Solution**: Check network connection, server status
- **Prevention**: Implement proper reconnection logic

### Missing Updates
- **Symptom**: Changes don't appear on other devices
- **Solution**: Verify band membership, check browser console
- **Prevention**: Ensure proper event broadcasting

### Duplicate Data
- **Symptom**: Same item appears multiple times
- **Solution**: Refresh page, check unique key usage
- **Prevention**: Proper state management and event deduplication

### Stale Data
- **Symptom**: Old data shows after updates
- **Solution**: Force refresh of affected components
- **Prevention**: Proper cache invalidation

## Test Completion Checklist

- [ ] All dashboard components update live
- [ ] Setlist operations sync properly
- [ ] Calendar events appear/update immediately
- [ ] Member changes broadcast correctly
- [ ] Conflict resolution works as expected
- [ ] Performance remains smooth under load
- [ ] Connection recovery works properly
- [ ] Band isolation prevents data leakage
- [ ] Accessibility features work with live updates
- [ ] No console errors or warnings
- [ ] Memory usage remains stable
- [ ] Offline/online transitions handled gracefully

## Known Limitations

1. **Network Dependencies**: Real-time features require active internet connection
2. **Browser Compatibility**: SSE requires modern browser support
3. **Server Resources**: Connection pooling may limit concurrent users
4. **Merge Conflicts**: Complex data merging may require manual resolution
5. **Mobile Considerations**: Background tab behavior may affect connection persistence

## Success Criteria

The real-time system passes testing when:
- ✅ All specified events broadcast within 300ms
- ✅ UI remains responsive during rapid updates
- ✅ No data corruption or duplication occurs
- ✅ Conflict resolution preserves user intent
- ✅ System recovers gracefully from network issues
- ✅ Band data isolation is maintained
- ✅ Accessibility standards are met