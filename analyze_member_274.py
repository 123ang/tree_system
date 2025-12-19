import csv
from pathlib import Path

# File path
CSV_FILE = Path("csv/WLGC1.0.csv")

# Find member 274 (row 275 in CSV, index 273 in 0-based)
print("Finding member 274...\n")

members = []
with CSV_FILE.open(newline="", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row_num, row in enumerate(reader, start=2):
        user_name = (row.get("User Name") or "").strip()
        referrer_name = (row.get("Referrer_User Name") or "").strip()
        activation_seq = (row.get("Activation sequence") or "").strip()
        
        members.append({
            'row': row_num,
            'wallet': user_name,
            'referrer': referrer_name,
            'activation_seq': activation_seq
        })

# Member 274 is at index 273 (0-based)
if len(members) >= 274:
    member_274 = members[273]
    print(f"MEMBER 274 DETAILS:")
    print(f"  Row in CSV: {member_274['row']}")
    print(f"  Wallet Address: {member_274['wallet']}")
    print(f"  Referrer: {member_274['referrer']}")
    print(f"  Activation Sequence: {member_274['activation_seq']}")
    
    # Find the referrer
    referrer_found = False
    for idx, m in enumerate(members):
        if m['wallet'].lower() == member_274['referrer'].lower():
            print(f"\n  Referrer found: Member ID {idx + 1} (Row {m['row']})")
            print(f"    Referrer Wallet: {m['wallet']}")
            referrer_found = True
            break
    
    if not referrer_found:
        print(f"\n  [ERROR] Referrer NOT FOUND in CSV!")
    
    # Check members placed before 274
    print(f"\nMembers placed just before 274:")
    for i in range(max(0, 270), 274):
        m = members[i]
        print(f"  Member {i+1} (Row {m['row']}): {m['wallet'][:30]}... -> {m['referrer'][:30] if m['referrer'] else 'N/A'}...")

