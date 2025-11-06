# BeeHive Reward System

## Overview

The BeeHive system calculates rewards for a multi-level referral program with dual-currency payouts (USDT + BCC tokens). It integrates with the existing tree diagram placement system to calculate layer-based rewards.

## Features

- **19 Levels** with progressive rewards
- **Dual Currency**: USDT payments + BCC token rewards
- **Layer-Based Payouts**: Earn from people at your corresponding layer depth
- **Direct Sponsor Rewards**: 100 USDT per direct referral
- **1st/2nd/3rd Rule**: First and second upgrades in a layer pay instantly, third requires level-up
- **72-Hour Pending**: Unqualified rewards wait 72 hours before passing up
- **Pass-Up Logic**: Rewards pass to nearest qualified upline or company wallet

## Database Setup

### Quick Start

1. **Setup tree first** (if not already done):
   ```bash
   npm run setup-db "sponsor tree1.0.1.csv"
   ```

2. **Setup BeeHive tables**:
   ```bash
   npm run setup-beehive
   ```

   Or use the frontend "Setup BeeHive Database" button.

### Tables Created

- `beehive_levels` - 19 level definitions with fees and rewards
- `beehive_members` - Member status in BeeHive system
- `beehive_transactions` - Payment records (chronological)
- `beehive_rewards` - Individual reward records
- `beehive_layer_counters` - Track upgrade counts per layer

## CSV Format

### Required Columns

| Column | Description | Example | Auto-Detected |
|--------|-------------|---------|---------------|
| `wallet_address` | Member's wallet address | PP1 | No |
| `referrer_wallet` | Sponsor's wallet address | P1 | No |
| `payment_datetime` | Payment timestamp | 2025/10/15 1:03 | No |
| `total_payment` | Amount paid in USDT | 130.00 | No |
| `target_level` | Level being purchased (optional) | 1 | **Yes** |

**Note**: The `target_level` column is **optional**. The system automatically detects the level based on the payment amount by matching it against the level fees.

### Example CSV

```csv
wallet_address,referrer_wallet,payment_datetime,total_payment
P1,P1,2025/10/15 0:00,130
PP1,P1,2025/10/15 1:03,130
PP2,PP1,2025/10/15 1:06,130
PP1,P1,2025/10/16 2:00,150
```

The system will automatically detect:
- `130` → Level 1 (Warrior)
- `150` → Level 2 (Bronze)
- `200` → Level 3 (Silver)
- etc.

### Important Notes

1. **Chronological Order**: Transactions are automatically sorted by `payment_datetime`
2. **Tree Placement First**: Members must exist in the tree (import tree CSV first)
3. **Level Auto-Detection**: `total_payment` must match one of the 19 level fees exactly:
   - Level 1: 130 USDT
   - Level 2: 150 USDT
   - Level 3: 200 USDT
   - ... (see Level Reference table in frontend)
4. **Exact Fees Required**: Payment amount must match a level fee within $0.01 tolerance
5. **Same Member, Multiple Levels**: Use multiple rows for upgrades (system tracks highest level)
6. **Optional target_level**: You can include `target_level` column if you want to explicitly specify, but it's not required

## How It Works

### 1. Direct Sponsor Rewards

- **All Levels**: 100 USDT per direct referral
- **Level 1 Limitation**: Can only claim first 2 direct sponsors (200 USDT total)
- **3rd+ Direct**: Pending until upgrade to Level 2

### 2. Layer Payouts (Levels 2-19)

**Layer = Placement Depth**
- Level 2 → earn from Layer 2 (people 2 steps down in placement tree)
- Level 3 → earn from Layer 3 (people 3 steps down)
- etc.

**1st/2nd/3rd Rule**:
- **1st & 2nd** upgrade in your layer → instant payout (if qualified)
- **3rd** upgrade in your layer → must have level N+1 to receive
- If not qualified → pending for 72 hours, then passes up

### 3. BCC Token Rewards

- Awarded instantly upon level purchase
- Ranges from 500 BCC (Level 1) to 1,950 BCC (Level 19)

### 4. Qualification

To receive a layer payout:
- **For 1st/2nd upgrades**: Need to be at that level
- **For 3rd+ upgrades**: Need to be at next level (N+1)

### 5. Pass-Up Logic

If reward is pending after 72 hours:
1. Find nearest **placement parent** who is qualified
2. If no qualified upline → pass to company wallet

## Usage

### Frontend

1. Navigate to "🐝 BeeHive" tab
2. Click "Setup BeeHive Database" (first time only)
3. Select your CSV file from dropdown
4. Click "Process Transactions"
5. View results:
   - System statistics
   - Member-by-member breakdown
   - Pending rewards
   - Level reference table

### API Endpoints

```
GET  /api/beehive/levels              - Get all 19 levels
POST /api/beehive/setup               - Setup database tables
POST /api/beehive/process             - Process CSV transactions
GET  /api/beehive/stats               - System statistics
GET  /api/beehive/members             - All member stats
GET  /api/beehive/members/:wallet     - Single member stats
GET  /api/beehive/members/:wallet/rewards - Member's reward history
```

### Backend Service

```typescript
import { BeeHiveService } from './services/BeeHiveService';

const service = new BeeHiveService();

// Process transactions
const result = await service.processTransactions([
  {
    wallet_address: 'PP1',
    referrer_wallet: 'P1',
    payment_datetime: '2025/10/15 1:03',
    total_payment: 130,
    target_level: 1
  }
]);

// Get member stats
const stats = await service.getMemberStats('PP1');
```

## Example Scenarios

### Scenario 1: Direct Sponsor

```
P1 joins (Level 1)
PP1 joins under P1
→ P1 earns 100 USDT direct sponsor reward
```

### Scenario 2: Level 1 Limit

```
P1 at Level 1, has 2 directs already claimed
PP3 joins under P1
→ Reward pending until P1 upgrades to Level 2
```

### Scenario 3: Layer Payout

```
P1 at Level 2
PP1 at Level 1 (Layer 1 from P1)
PP2 at Level 1 (Layer 2 from P1)

PP2 upgrades to Level 2
→ P1 earns 150 USDT (1st upgrade in Layer 2)
```

### Scenario 4: Third Upgrade

```
P1 at Level 2
Already had 2 people in Layer 2 upgrade

PP3 in Layer 2 upgrades
→ P1 needs Level 3 to receive
→ If not qualified: pending 72h → pass up
```

## Troubleshooting

### "Member not found in tree"
- Import tree placement CSV first using the Database tab
- Ensure wallet addresses match exactly

### "Payment doesn't match level fee"
- Check the level reference table for exact fees
- Level 1: 130 USDT, Level 2: 150 USDT, etc.

### No layer payouts showing
- Member must be placed in tree (have a parent)
- Upline must exist at the correct layer depth
- Check qualification level

### Rewards stuck in pending
- Check if member has reached required level
- Verify 72-hour window hasn't expired
- Check logs for pass-up information

## Testing

Use the sample CSV:
```bash
# Setup tree first
npm run import-csv "sponsor tree1.0.1.csv"

# Setup BeeHive
npm run setup-beehive

# Process sample BeeHive transactions
# Use frontend: select "beehive-sample.csv"
```

## Development

Key files:
- Backend:
  - `src/database/beehive-schema.sql` - Database schema
  - `src/services/BeeHiveService.ts` - Core calculation logic
  - `src/controllers/BeeHiveController.ts` - API endpoints
  
- Frontend:
  - `frontend/src/components/BeeHive.tsx` - Main UI
  - `frontend/src/services/beeHiveApi.ts` - API client

## Future Enhancements

- [ ] Reward history timeline view
- [ ] Export calculations to CSV/PDF
- [ ] Real-time pending expiry countdown
- [ ] Pass-up chain visualization
- [ ] Smart contract integration
- [ ] Automatic 72-hour expiry processing
- [ ] Email notifications for pending expiry

