import csv
from pathlib import Path

# --- CONFIG ---
ROOT_DIR = Path(__file__).resolve().parent
MEMBERS_CSV = ROOT_DIR / "members_v2_rows (1).csv"
INPUT_CSV = ROOT_DIR / "wo address.csv"
OUTPUT_CSV = ROOT_DIR / "with address.csv"

# Wallet to stop at / default when no referral found in the list
FALLBACK_ROOT = "0xb800d5359a85B5d55a5A680a6eF6f15475D7d9e9"


def load_member_referrers():
    """Build a map: wallet_address -> referrer_wallet (original case)
       from members_v2_rows (1).csv
    """
    mapping = {}
    with MEMBERS_CSV.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            wallet = (row.get("wallet_address") or "").strip()
            ref = (row.get("referrer_wallet") or "").strip()
            if not wallet:
                continue
            mapping[wallet] = ref
    return mapping


def load_user_addresses():
    """Load all USER BEP20 ADDRESS from wo address.csv into a set"""
    addresses = set()
    with INPUT_CSV.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            user = (row.get("USER BEP20 ADDRESS") or "").strip()
            if user:
                addresses.add(user)
    return addresses


def resolve_referrer(user_wallet: str, member_refs: dict, user_addresses: set) -> str:
    """
    Starting from user_wallet, follow referrers until we find one that is
    in user_addresses (the wo address.csv list), or we reach FALLBACK_ROOT.
    """
    seen = set()
    current = user_wallet

    # Get the user's direct referrer from members CSV
    ref = member_refs.get(current, "")

    while True:
        if not ref:
            # No referrer found -> use fallback root
            return FALLBACK_ROOT

        if ref == FALLBACK_ROOT:
            # Reached the root
            return FALLBACK_ROOT

        if ref in seen:
            # Loop protection
            return FALLBACK_ROOT

        seen.add(ref)

        # Check if this referrer is in the user addresses list
        if ref in user_addresses:
            # Found! This referrer is in the wo address.csv list
            return ref

        # Not in the list, continue climbing the chain
        next_ref = member_refs.get(ref, "")
        if not next_ref:
            # This referrer has no parent in members CSV -> use fallback
            return FALLBACK_ROOT

        ref = next_ref


def main():
    member_refs = load_member_referrers()
    user_addresses = load_user_addresses()

    print(f"Loaded {len(member_refs)} members from members CSV")
    print(f"Loaded {len(user_addresses)} user addresses from input CSV")

    with INPUT_CSV.open(newline="", encoding="utf-8-sig") as f_in, \
         OUTPUT_CSV.open("w", newline="", encoding="utf-8") as f_out:

        reader = csv.DictReader(f_in)
        fieldnames = ["No", "USER BEP20 ADDRESS", "REFERAL ADDRESS"]
        writer = csv.DictWriter(f_out, fieldnames=fieldnames)
        writer.writeheader()

        for row in reader:
            no = (row.get("No") or "").strip()
            user = (row.get("USER BEP20 ADDRESS") or "").strip()
            if not user:
                continue

            resolved = resolve_referrer(user, member_refs, user_addresses)

            writer.writerow({
                "No": no,
                "USER BEP20 ADDRESS": user,
                "REFERAL ADDRESS": resolved,
            })

    print(f"Written: {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
