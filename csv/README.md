# CSV Data Files

Place all your CSV files in this folder for easy organization and management.

## Supported CSV Formats

Your CSV files should have the following columns:

### Required Columns:
- `User Name` (or `wallet_address`) - Unique identifier for the member
- `Referrer_User Name` (or `referrer_wallet`) - The sponsor/referrer's username
- `Activation sequence` (or `activation_sequence`) - Sequential activation number (0 for root)

### Optional Columns:
- `Current Level` - Member's current level
- `Activation_time` - When the member was activated (format: YYYY/MM/DD H.MM)
- `Total NFT claim` - Total NFTs claimed by the member

## Example CSV Format

```csv
User Name,Referrer_User Name,Current Level,Activation sequence,Activation_time,Total NFT claim
P1,P1,1,0,2025/10/15 0.00,
PP1,P1,1,1,2025/10/15 1.03,
PP2,PP1,1,2,2025/10/15 1.06,
```

## Usage

### From UI:
1. Click the "🔧 Database Operations" button in the toolbar
2. Select your CSV file from the dropdown
3. Choose "Full Setup" (fresh start) or "Import Only" (add to existing data)

### From Command Line:
```bash
# Full setup (drop database, recreate, import)
npm run setup-db "your-file.csv"

# Import only (add to existing data)
npm run import-csv "your-file.csv"
```

## Notes

- The root member should have `activation_sequence = 0` and reference itself as the referrer
- All referrers must exist in the CSV before their children are referenced
- Duplicate wallet addresses will be skipped during import

