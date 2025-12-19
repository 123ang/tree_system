import csv
from pathlib import Path
from collections import Counter

# File path
CSV_FILE = Path("csv/WLGC1.0.csv")
OUTPUT_CSV = Path("csv/missing_sponsors.csv")

# Read the CSV
print("Reading CSV file...")
members = []
all_wallets = set()

with CSV_FILE.open(newline="", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row_num, row in enumerate(reader, start=2):  # Start at 2 because row 1 is header
        user_name = (row.get("User Name") or "").strip()
        referrer_name = (row.get("Referrer_User Name") or "").strip()
        activation_seq = (row.get("Activation sequence") or "").strip()
        
        if user_name:
            all_wallets.add(user_name.lower())
            members.append({
                'row': row_num,
                'wallet': user_name,
                'referrer': referrer_name,
                'activation_seq': activation_seq
            })

print(f"Total members: {len(members)}")
print(f"Total unique wallets: {len(all_wallets)}")

# Find missing sponsors
print("\nFinding missing sponsors...")
missing_sponsors = []
missing_sponsor_counts = Counter()

for member in members:
    if member['referrer']:
        # Check if referrer exists (case-insensitive)
        referrer_lower = member['referrer'].lower()
        if referrer_lower not in all_wallets:
            missing_sponsors.append({
                'Row': member['row'],
                'Member_Wallet': member['wallet'],
                'Missing_Sponsor': member['referrer'],
                'Activation_Sequence': member['activation_seq']
            })
            missing_sponsor_counts[member['referrer']] += 1

print(f"\nFound {len(missing_sponsors)} members with missing sponsors")
print(f"Unique missing sponsors: {len(missing_sponsor_counts)}")

# Export to CSV
print(f"\nExporting to {OUTPUT_CSV}...")
with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as f:
    if missing_sponsors:
        fieldnames = ['Row', 'Member_Wallet', 'Missing_Sponsor', 'Activation_Sequence']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(missing_sponsors)
    else:
        # Write header even if no missing sponsors
        writer = csv.DictWriter(f, fieldnames=['Row', 'Member_Wallet', 'Missing_Sponsor', 'Activation_Sequence'])
        writer.writeheader()

print(f"[OK] Exported {len(missing_sponsors)} entries to {OUTPUT_CSV}")

# Print summary of most common missing sponsors
print("\n" + "="*80)
print("MISSING SPONSORS SUMMARY")
print("="*80)
print(f"\nTotal unique missing sponsors: {len(missing_sponsor_counts)}")
print(f"Total members affected: {len(missing_sponsors)}")
print("\nTop 10 most common missing sponsors:")
for sponsor, count in missing_sponsor_counts.most_common(10):
    print(f"  {sponsor}: appears {count} time(s)")

# Export unique missing sponsors list
UNIQUE_SPONSORS_CSV = Path("csv/unique_missing_sponsors.csv")
print(f"\nExporting unique missing sponsors to {UNIQUE_SPONSORS_CSV}...")
with UNIQUE_SPONSORS_CSV.open("w", newline="", encoding="utf-8") as f:
    fieldnames = ['Missing_Sponsor', 'Count']
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    for sponsor, count in sorted(missing_sponsor_counts.items(), key=lambda x: x[1], reverse=True):
        writer.writerow({
            'Missing_Sponsor': sponsor,
            'Count': count
        })

print(f"[OK] Exported {len(missing_sponsor_counts)} unique missing sponsors to {UNIQUE_SPONSORS_CSV}")

