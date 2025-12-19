# Parent 87 Full Issue - Explanation

## What Happened

Member 274's placement failed because:

1. **Initial Placement Attempt**:
   - Member 274's sponsor is Member 87
   - `findPlacement()` checked if Member 87 has < 3 children
   - At that moment, Member 87 had < 3 children, so it returned Member 87 as the parent
   - But by the time `placeMember()` tried to insert, Member 87 was already full (had 3 children)

2. **Alternative Parent Search**:
   - When the first attempt failed, the code tried to find an alternative parent
   - It called `getAvailableSlots(87)` to find other parents in Member 87's subtree
   - **BUG**: `getAvailableSlots()` was still returning Member 87 itself because:
     - The SQL query result was stale (cached or not refreshed)
     - The query checked `child_count < 3` but didn't re-verify at insertion time
     - Member 87 was included in the results even though it was full

3. **Why It Failed Again**:
   - The alternative parent search found Member 87 again
   - Tried to place Member 274 under Member 87 again
   - Member 87 was still full, so it failed again

## Root Causes

### 1. Stale Query Results
The `getAvailableSlots()` function uses a SQL query that checks `child_count < 3`, but:
- The query result might be cached or stale
- Between query execution and slot usage, other members can fill the parent
- The function doesn't re-verify parent capacity before returning slots

### 2. No Exclusion of Failed Parent
When searching for alternative parents, the code didn't exclude the parent that just failed:
- It would re-query and potentially get the same full parent
- The `find()` logic tried to exclude it, but if it was the only result, it would still use it

### 3. Timing/Race Condition
- Multiple members are being placed sequentially
- Member 87 might have 2 children when queried, but 3 by insertion time
- This creates a race condition where the same parent is selected multiple times

## Fixes Applied

### 1. Added `excludeParentId` Parameter
- `getAvailableSlots()` now accepts an optional `excludeParentId` parameter
- When searching for alternatives, it excludes the failed parent from results

### 2. Real-Time Capacity Verification
- Before adding a parent to the slots list, the code now re-verifies its capacity
- Queries the database again to get the current child count
- Skips any parent that has 3 or more children

### 3. Better Alternative Selection
- When finding alternatives, passes the failed parent ID to exclude it
- Ensures we never try the same full parent twice

## Code Changes

```typescript
// Before:
const alternativeSlots = await this.getAvailableSlots(sponsorId);
const alternativePlacement = alternativeSlots.find(slot => 
  slot.parent_id !== placement.parent_id || slot.position !== placement.position
) || alternativeSlots[0];

// After:
const alternativeSlots = await this.getAvailableSlots(sponsorId, placement.parent_id);
const alternativePlacement = alternativeSlots[0]; // Already filtered
```

```typescript
// Added real-time verification:
const currentChildCount = await executeQuery(
  'SELECT COUNT(*) as count FROM placements WHERE parent_id = ?',
  [parentId]
);
const actualChildCount = (currentChildCount as any[])[0].count;

if (actualChildCount >= 3) {
  continue; // Skip full parents
}
```

## Expected Behavior Now

1. Member 274 tries to place under Member 87
2. Member 87 is full → error caught
3. Alternative search excludes Member 87
4. Finds a different parent in Member 87's subtree
5. Successfully places Member 274 under the alternative parent

## Prevention

The fix ensures:
- ✅ Failed parents are excluded from alternative searches
- ✅ Parent capacity is verified in real-time before use
- ✅ No stale query results are used
- ✅ Better error messages for debugging

