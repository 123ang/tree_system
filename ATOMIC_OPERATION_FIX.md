# Atomic Operation Fix - Step-by-Step Placement

## Problem
The original code had a **race condition** where:
1. `findPlacement()` checks if parent has < 3 children
2. Time gap - other members can fill the parent
3. `placeMember()` tries to insert but parent is now full

## Solution: Atomic Check-and-Insert

The code now performs **check and insert in a single atomic transaction** with row-level locking.

## How It Works

### Step 1: Lock Parent Row
```sql
SELECT COUNT(*) as child_count, GROUP_CONCAT(position) as used_positions
FROM placements 
WHERE parent_id = ?
FOR UPDATE  -- Locks the rows, preventing other transactions from modifying them
```

**FOR UPDATE** ensures:
- No other transaction can modify the parent's placements
- The check and insert happen atomically
- No race conditions possible

### Step 2: Verify Capacity (Within Transaction)
- Check if `child_count < 3`
- If full, rollback and throw error
- Still within the transaction, so state can't change

### Step 3: Find Available Position
- Check if requested position is available
- If taken, find next available (1, 2, or 3)
- All within the locked transaction

### Step 4: Insert All Data (Within Same Transaction)
- Insert placement
- Update closure table
- Update member's root_id and sponsor_id
- All in one atomic operation

### Step 5: Commit (Release Lock)
- Commit transaction
- Lock is released
- Other operations can now proceed

## Key Changes

### Before (Non-Atomic):
```typescript
// Step 1: Check (separate query)
const count = await executeQuery('SELECT COUNT(*) ...');

// [TIME GAP - other operations can modify parent]

// Step 2: Insert (separate operation)
await executeTransaction([...]);
```

### After (Atomic):
```typescript
// Step 1: Begin transaction and lock
const connection = await pool.getConnection();
await connection.beginTransaction();

// Step 2: Lock and check (atomic)
const result = await connection.execute(
  'SELECT ... FOR UPDATE',  // Locks rows
  [parentId]
);

// Step 3: Verify and insert (all in same transaction)
if (childCount < 3) {
  await connection.execute('INSERT ...', [...]);
  await connection.commit();  // Releases lock
}
```

## Benefits

✅ **No Race Conditions**: Row locking prevents concurrent modifications
✅ **Atomic Operations**: Check and insert happen together
✅ **Consistent State**: Database state can't change between check and insert
✅ **Error Handling**: Proper rollback on failures
✅ **Resource Management**: Connection always released in finally block

## Transaction Flow

```
BEGIN TRANSACTION
  ↓
LOCK parent row (FOR UPDATE)
  ↓
CHECK capacity (< 3 children?)
  ↓
FIND available position
  ↓
INSERT placement
  ↓
UPDATE closure table
  ↓
UPDATE member info
  ↓
COMMIT (releases lock)
```

If any step fails:
```
ROLLBACK (releases lock)
  ↓
RELEASE connection
  ↓
THROW error (triggers alternative parent search)
```

## Why This Prevents the Issue

1. **Row Locking**: `FOR UPDATE` prevents other transactions from modifying the parent
2. **Single Transaction**: All operations happen in one transaction
3. **No Time Gap**: Check and insert are atomic - no gap for state changes
4. **Consistent State**: Database state is guaranteed to be consistent

## Result

- ✅ No more "parent is full" errors after checking
- ✅ No race conditions between check and insert
- ✅ Guaranteed atomic operations
- ✅ Better error handling and recovery

