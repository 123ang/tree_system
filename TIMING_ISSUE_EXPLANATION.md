# Why findPlacement() Finds < 3 Children But placeMember() Fails

## The Problem: Time Gap Between Check and Insert

This is a **race condition** caused by the time gap between checking parent capacity and actually inserting the member.

## Timeline of Events

### Scenario: Member 87 Has 2 Children, Then Gets Filled

```
Time T1: Member 271 Processing
├─ findPlacement(87) → Checks: Member 87 has 2 children ✅
├─ Returns: parent_id = 87, position = 3
└─ placeMember(271, 87, 3) → ✅ SUCCESS (Member 87 now has 3 children)

Time T2: Member 272 Processing  
├─ findPlacement(87) → Checks: Member 87 has 3 children ❌
├─ Calls getAvailableSlots(87) → Finds another parent (e.g., Member 100)
└─ placeMember(272, 100, 1) → ✅ SUCCESS

Time T3: Member 273 Processing
├─ findPlacement(87) → Checks: Member 87 has 3 children ❌
├─ Calls getAvailableSlots(87) → Finds another parent (e.g., Member 100)
└─ placeMember(273, 100, 2) → ✅ SUCCESS

Time T4: Member 274 Processing (THE PROBLEM)
├─ findPlacement(87) → Checks: Member 87 has 3 children ❌
├─ Calls getAvailableSlots(87) → Query executes at T4.1
│   └─ SQL Query: "SELECT ... WHERE child_count < 3"
│   └─ Result: Finds Member 87 with child_count = 2 (STALE DATA!)
│   └─ Returns: parent_id = 87, position = 3
│
├─ [TIME GAP - Other members might be processed here]
│
└─ placeMember(274, 87, 3) → ❌ FAILS
    └─ Checks: Member 87 now has 3 children (FULL!)
    └─ Error: "Parent 87 is full"
```

## Why This Happens

### 1. **Sequential Processing with State Changes**

The code processes members **sequentially** in a loop:

```typescript
for (const member of this.members) {
  const placement = await this.findPlacement(sponsorId, ...);  // T4.1: Checks DB
  await this.placeMember(memberId, ...);                       // T4.2: Inserts (fails)
}
```

Between `findPlacement()` and `placeMember()`, the database state can change!

### 2. **Stale Query Results in getAvailableSlots()**

The `getAvailableSlots()` function uses a SQL query:

```sql
SELECT ... 
WHERE (SELECT COUNT(*) FROM placements p WHERE p.parent_id = st.id) < 3
```

This query:
- Executes at **T4.1** and finds Member 87 with 2 children
- But by **T4.2**, Member 87 might have 3 children (filled by concurrent operations or previous processing)

### 3. **No Transaction Locking**

The code doesn't use database transactions to lock the parent row, so:
- Multiple queries can read the same "available" parent
- Multiple insertions can try to use the same parent simultaneously
- The last one to insert wins, others fail

## Visual Example

```
Member 87's Children Over Time:

T1: [Child 1, Child 2]           → 2 children (< 3) ✅
T2: [Child 1, Child 2, Child 3] → 3 children (FULL) ❌

findPlacement() at T1.5:
  ├─ Query: "Does Member 87 have < 3 children?"
  └─ Answer: YES (2 children) ✅

placeMember() at T2:
  ├─ Check: "Does Member 87 have < 3 children?"
  └─ Answer: NO (3 children) ❌
  └─ FAILS!
```

## The Real Issue: Query Result Caching/Staleness

The problem is that `getAvailableSlots()` uses a **subquery** that might return stale results:

```sql
(SELECT COUNT(*) FROM placements p WHERE p.parent_id = st.id) < 3
```

This subquery is evaluated **once** when the main query runs, but:
- The result might be cached
- Between query execution and result usage, other members fill the parent
- The code doesn't re-verify the parent capacity before using it

## Solution Applied

### 1. **Real-Time Verification in getAvailableSlots()**

Added a double-check before returning slots:

```typescript
// Double-check parent capacity (in case query result is stale)
const currentChildCount = await executeQuery(
  'SELECT COUNT(*) as count FROM placements WHERE parent_id = ?',
  [parentId]
);
const actualChildCount = (currentChildCount as any[])[0].count;

if (actualChildCount >= 3) {
  continue; // Skip full parents
}
```

### 2. **Verification in placeMember()**

Added check at the start of `placeMember()`:

```typescript
// First, check if parent still has available slots
const childCount = await executeQuery(
  'SELECT COUNT(*) as count FROM placements WHERE parent_id = ?',
  [parentId]
);
const currentChildCount = (childCount as any[])[0].count;

if (currentChildCount >= 3) {
  throw new Error(`Parent ${parentId} is full...`);
}
```

### 3. **Alternative Parent Search**

When a parent is full, the code now:
- Excludes the failed parent from alternative search
- Re-queries for available slots
- Verifies each parent in real-time before use

## Why This Is Hard to Prevent Completely

1. **No Database Locks**: Without row-level locking, multiple operations can read the same state
2. **Sequential Processing**: Members are processed one by one, but state changes between steps
3. **Query Optimization**: SQL might cache subquery results
4. **Timing**: The gap between check and insert allows state changes

## Best Practices Applied

✅ **Verify Before Use**: Always re-check parent capacity right before insertion
✅ **Handle Failures Gracefully**: Catch errors and find alternatives
✅ **Exclude Failed Parents**: Don't retry the same full parent
✅ **Real-Time Queries**: Use fresh queries, not cached results

