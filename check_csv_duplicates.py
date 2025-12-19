import csv
from pathlib import Path
from collections import Counter

# File path
CSV_FILE = Path("csv/WLGC1.0.csv")

# Read the CSV
wallets = []
referrers = []
wallet_to_row = {}
referrer_to_rows = {}
duplicate_wallets = []
missing_sponsors = []

print("Reading CSV file...")
with CSV_FILE.open(newline="", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row_num, row in enumerate(reader, start=2):  # Start at 2 because row 1 is header
        user_name = (row.get("User Name") or "").strip()
        referrer_name = (row.get("Referrer_User Name") or "").strip()
        
        if user_name:
            wallets.append(user_name)
            if user_name not in wallet_to_row:
                wallet_to_row[user_name] = []
            wallet_to_row[user_name].append(row_num)
        
        if referrer_name:
            referrers.append(referrer_name)

# Find duplicate wallets
print("\n" + "="*80)
print("CHECKING FOR DUPLICATE WALLET ADDRESSES")
print("="*80)

wallet_counts = Counter(wallets)
duplicates = {wallet: count for wallet, count in wallet_counts.items() if count > 1}

if duplicates:
    print(f"\n[ERROR] Found {len(duplicates)} duplicate wallet address(es):\n")
    for wallet, count in sorted(duplicates.items()):
        rows = wallet_to_row[wallet]
        print(f"  Wallet: {wallet}")
        print(f"  Appears {count} times at rows: {', '.join(map(str, rows))}")
        print()
else:
    print("\n[OK] No duplicate wallet addresses found!")

# Find missing sponsors
print("\n" + "="*80)
print("CHECKING FOR MISSING SPONSORS (Referrer not in User Name list)")
print("="*80)

# Create a set of all wallet addresses for quick lookup
wallet_set = set(wallets)

missing = []
with CSV_FILE.open(newline="", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row_num, row in enumerate(reader, start=2):
        user_name = (row.get("User Name") or "").strip()
        referrer_name = (row.get("Referrer_User Name") or "").strip()
        
        # Skip root member (self-referring)
        if referrer_name and referrer_name != user_name:
            if referrer_name not in wallet_set:
                missing.append({
                    'row': row_num,
                    'user': user_name,
                    'referrer': referrer_name
                })

if missing:
    print(f"\n[ERROR] Found {len(missing)} entries with missing sponsors:\n")
    for item in missing:
        print(f"  Row {item['row']}:")
        print(f"    User: {item['user']}")
        print(f"    Referrer (NOT FOUND): {item['referrer']}")
        print()
else:
    print("\n[OK] All referrers are found in the User Name list!")

# Summary
print("\n" + "="*80)
print("SUMMARY")
print("="*80)
print(f"Total rows (excluding header): {len(wallets)}")
print(f"Unique wallet addresses: {len(wallet_set)}")
print(f"Duplicate wallet addresses: {len(duplicates)}")
print(f"Entries with missing sponsors: {len(missing)}")
print("="*80)

