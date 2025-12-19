import csv
from pathlib import Path

# File path
CSV_FILE = Path("csv/WLGC1.0.csv")

# Read the CSV and find member 274 (row 275, since row 1 is header)
print("Analyzing CSV import issue...\n")

members = []
with CSV_FILE.open(newline="", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row_num, row in enumerate(reader, start=2):  # Start at 2 because row 1 is header
        user_name = (row.get("User Name") or "").strip()
        referrer_name = (row.get("Referrer_User Name") or "").strip()
        activation_seq = (row.get("Activation sequence") or "").strip()
        
        members.append({
            'row': row_num,
            'wallet': user_name,
            'referrer': referrer_name,
            'activation_seq': activation_seq
        })

# Member 274 would be at index 273 (0-based) or row 275
if len(members) >= 274:
    member_274 = members[273]  # Index 273 = member 274
    print(f"Member 274 (Row {member_274['row']}):")
    print(f"  Wallet: {member_274['wallet']}")
    print(f"  Referrer: {member_274['referrer']}")
    print(f"  Activation Sequence: {member_274['activation_seq']}")
    
    # Check if referrer exists in the list
    referrer_found = False
    referrer_row = None
    for idx, m in enumerate(members):
        if m['wallet'].lower() == member_274['referrer'].lower():
            referrer_found = True
            referrer_row = idx + 1  # Member ID (1-based)
            print(f"\n  Referrer found: Member ID {referrer_row} (Row {m['row']})")
            print(f"    Referrer Wallet: {m['wallet']}")
            break
    
    if not referrer_found:
        print(f"\n  [ERROR] Referrer NOT FOUND in CSV!")
        print(f"  This member will be skipped during placement.")
    
    # Check members around 274 to see the pattern
    print(f"\nMembers around 274:")
    for i in range(max(0, 270), min(len(members), 280)):
        m = members[i]
        ref_found = any(x['wallet'].lower() == m['referrer'].lower() for x in members)
        status = "OK" if ref_found or not m['referrer'] else "MISSING"
        print(f"  Row {m['row']} (Member {i+1}): {m['wallet'][:20]}... -> {m['referrer'][:20] if m['referrer'] else 'N/A'}... [{status}]")

# Count missing sponsors
print(f"\n\nSummary:")
print(f"Total members: {len(members)}")
missing_sponsors = []
for m in members:
    if m['referrer']:
        ref_found = any(x['wallet'].lower() == m['referrer'].lower() for x in members)
        if not ref_found:
            missing_sponsors.append(m)

print(f"Members with missing sponsors: {len(missing_sponsors)}")
if missing_sponsors:
    print(f"\nFirst 10 members with missing sponsors:")
    for m in missing_sponsors[:10]:
        print(f"  Row {m['row']}: {m['wallet']} -> {m['referrer']}")

