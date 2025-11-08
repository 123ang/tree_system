import csv
import random
from datetime import datetime, timedelta
from collections import defaultdict

# Level fee mapping from the spec
LEVEL_FEES = {
    1: 130,   # Warrior (Base): 100 + 30 service fee
    2: 150,   # Bronze
    3: 200,   # Silver
    4: 250,   # Gold
    5: 300,   # Elite
    6: 350,   # Platinum
    7: 400,   # Master
    8: 450,   # Diamond
    9: 500,   # Grandmaster
    10: 550,  # Starlight
    11: 600,  # Epic
    12: 650,  # Hall (Legend)
    13: 700,  # Supreme King
    14: 750,  # Peerless King
    15: 800,  # Glory King
    16: 850,  # Legendary Overlord
    17: 900,  # Supreme Overlord
    18: 950,  # Mythic Supreme
    19: 1000  # Mythic Apex
}

def parse_datetime(date_str):
    """Parse various date formats"""
    formats = [
        '%m/%d/%Y %H:%M',
        '%Y/%m/%d %H:%M',
        '%Y-%m-%d %H:%M:%S',
        '%m/%d/%Y %H:%M:%S'
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except:
            continue
    return None

def main():
    # Read members.csv
    print("Reading members.csv...")
    members = {}
    with open('csv/members.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            wallet = row['wallet_address']
            members[wallet] = {
                'referrer': row['referrer_wallet'],
                'current_level': int(row['current_level']),
                'activation_sequence': int(row['activation_sequence']),
                'activation_time': row['activation_time']
            }
    
    print(f"Loaded {len(members)} members")
    
    # Read filter_transaction.csv to get transaction timestamps
    print("Reading filter_transaction.csv...")
    transactions_by_wallet = defaultdict(list)
    with open('csv/filter_transaction.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            from_addr = row['from_addr'].lower()
            method = row['method']
            age = row['age']
            amount = row['amount']
            
            # Store Register and Upgrade transactions
            if method in ['Register', 'Upgrade']:
                transactions_by_wallet[from_addr].append({
                    'method': method,
                    'datetime': age,
                    'amount': float(amount) if amount else None
                })
    
    print(f"Loaded transactions for {len(transactions_by_wallet)} wallets")
    
    # Generate output transactions
    print("Generating transaction records...")
    output_records = []
    
    # Set random seed for consistency
    random.seed(42)
    
    for wallet, member_info in members.items():
        referrer = member_info['referrer']
        current_level = member_info['current_level']
        activation_time = member_info['activation_time']
        activation_sequence = member_info['activation_sequence']
        
        # Determine registration amount: 120 or 130 USDT
        # Use activation_sequence to determine: even = 130, odd = 120
        registration_amount = 130 if activation_sequence % 2 == 0 else 120
        
        # Parse activation time or use current time as fallback
        base_time = parse_datetime(activation_time)
        if not base_time or base_time.year == 1970:
            # If parsing fails or date is invalid (1970), use a default date
            base_time = datetime(2025, 3, 1, 0, 0) + timedelta(minutes=activation_sequence)
        
        # Add registration transaction (Level 1)
        registration_time = base_time
        output_records.append({
            'wallet_address': wallet,
            'referrer_wallet': referrer,
            'payment_datetime': registration_time.strftime('%Y/%m/%d %H:%M'),
            'total_payment': registration_amount
        })
        
        # Add upgrade transactions if level > 1
        # Generate sequential upgrade transactions
        upgrade_time = registration_time
        for level in range(2, current_level + 1):
            # Add some time between upgrades (e.g., 1-3 days)
            days_gap = random.randint(1, 3)
            upgrade_time = upgrade_time + timedelta(days=days_gap)
            
            fee = LEVEL_FEES.get(level, 0)
            if fee > 0:
                output_records.append({
                    'wallet_address': wallet,
                    'referrer_wallet': referrer,
                    'payment_datetime': upgrade_time.strftime('%Y/%m/%d %H:%M'),
                    'total_payment': fee
                })
    
    # Sort by payment_datetime
    print("Sorting transactions by datetime...")
    output_records.sort(key=lambda x: datetime.strptime(x['payment_datetime'], '%Y/%m/%d %H:%M'))
    
    # Write output CSV
    print(f"Writing {len(output_records)} transactions to members_transaction.csv...")
    with open('members_transaction.csv', 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['wallet_address', 'referrer_wallet', 'payment_datetime', 'total_payment']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(output_records)
    
    print("Done! Output saved to members_transaction.csv")
    print(f"\nSummary:")
    print(f"  Total transactions: {len(output_records)}")
    print(f"  Registrations (120 USDT): {sum(1 for r in output_records if r['total_payment'] == 120)}")
    print(f"  Registrations (130 USDT): {sum(1 for r in output_records if r['total_payment'] == 130)}")
    
    # Count by level fees
    level_counts = defaultdict(int)
    for record in output_records:
        payment = record['total_payment']
        level_counts[payment] += 1
    
    print(f"\nTransactions by payment amount:")
    for amount in sorted(level_counts.keys()):
        print(f"  {amount} USDT: {level_counts[amount]} transactions")

if __name__ == '__main__':
    main()

