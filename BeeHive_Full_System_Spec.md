# BeeHive System — Full Specification (Levels, Fees, Payouts, USDT & BCC Rewards)

> This document defines the BeeHive algorithm for backend and smart-contract implementation — covering levels, dual-currency rewards (USDT + BCC), payout flow, layering, and the pass-up logic.

---

## 1) Onboarding & Referral

- **Join Cost (Level 1 / 勇士)**: 100 USDT (membership) + 30 USDT (service fee) = **130 USDT** total.
- **Direct Referral Reward:** 100 USDT to the sponsor (unlocked instantly).
- **Settlement:** Executed by smart contract, real-time, fully decentralized.
- **Placement:** Members join a **3-wide (ternary)** structure, each with up to 3 directs.
- **Referral Rule:** First 3 directs stay under sponsor; others spill over within the sponsor subtree (round-robin placement).

---

## 2) Level, Fee & Reward Overview

There are **19 levels (1–19)**. Each row includes **Chinese & English names**, **fee**, **BCC reward**, **layer depth**, and **USDT payout**.

> **Rule:** Level 1 can receive **Direct Sponsor (100 USDT)** and **BCC** only (no layering payouts). Levels **2–19** can receive **Direct Sponsor + Layering Payout + BCC**.

| Lvl | 中文名称 | English Name | Fee (USDT) | BCC Reward | Layer Depth | USDT Payout |
|:--:|:--|:--|--:|--:|--:|--:|
| 1 | 勇士 | Warrior (Base) | 130* | 500 | 1 | **100** (direct sponsor only) |
| 2 | 青铜 | Bronze | 150 | 100 | 2 | 150 |
| 3 | 白银 | Silver | 200 | 200 | 3 | 200 |
| 4 | 黄金 | Gold | 250 | 300 | 4 | 250 |
| 5 | 精英 | Elite | 300 | 400 | 5 | 300 |
| 6 | 铂金 | Platinum | 350 | 500 | 6 | 350 |
| 7 | 大师 | Master | 400 | 600 | 7 | 400 |
| 8 | 钻石 | Diamond | 450 | 700 | 8 | 450 |
| 9 | 宗师 | Grandmaster | 500 | 800 | 9 | 500 |
| 10 | 星耀 | Starlight | 550 | 900 | 10 | 550 |
| 11 | 史诗 | Epic | 600 | 1000 | 11 | 600 |
| 12 | 殿堂 | Hall (Legend) | 650 | 1100 | 12 | 650 |
| 13 | 最强王者 | Supreme King | 700 | 1200 | 13 | 700 |
| 14 | 无双王者 | Peerless King | 750 | 1300 | 14 | 750 |
| 15 | 荣耀王者 | Glory King | 800 | 1400 | 15 | 800 |
| 16 | 传奇主宰 | Legendary Overlord | 850 | 1500 | 16 | 850 |
| 17 | 至尊主宰 | Supreme Overlord | 900 | 1600 | 17 | 900 |
| 18 | 至尊神话 | Mythic Supreme | 950 | 900 | 18 | 950 |
| 19 | 神话巅峰 | Mythic Apex | 1000 | 1950 | 19 | 1000 |

*Level 1 fee shown as the **join total (100 + 30)**.

---

## 3) Payout Logic

### Option A — Direct Sponsor Payout
- Each new **direct sponsor** generates **100 USDT** reward for the referrer.
- No expiry; sponsor can claim any time after upgrading to the## 3) Payout Logic

### A) Direct Sponsor (All Levels)
- **100 USDT** per direct referral.
- **Level 1** can earn **Direct Sponsor (100)** and **BCC** only (no layering payouts).
- No expiry for direct sponsor earnings; once the member upgrades to the required level, they can claim.

### B) Layering Payout (Levels 2–19)
- Triggered when someone in your **corresponding layer** upgrades to that level.
- **First & Second** upgrades in that layer → pay you instantly if qualified.
- **Third** upgrade in that layer → you must **upgrade to the next level** to receive; otherwise the reward goes **Pending (72h)** and then **passes up** to the nearest qualified upline; if none, to the **company wallet**.

**Examples**
- **Level 2 → Layer 2:** earn **150 USDT** per upgrade in Layer 2 (subject to the 1st/2nd/3rd rule above).
- **Level 3 → Layer 3:** earn **200 USDT** per upgrade in Layer 3 (same rule).

---

## 4) Dual-Currency Reward Summary Reward | Layer-based payout | USDT (150–1000) | Instant if qualified; 72h pass-up if not |
| Token Reward | Level-based bonus | BCC (100–1950) | Instant or vest depending on tier |

---

## 5) Data Schema (Input & Output)

### Input Schema (Payment-First; starts 72h window)
| Field | Type | Description |
|:--|:--|:--|
| wallet_address | string | Member’s wallet address |
| referrer_wallet | string | Sponsor wallet address |
| **payment_datetime** | datetime | **Timestamp of the upgrade/join payment** (starts the **72h** eligibility window) |
| **total_payment** | decimal | **Amount paid (USDT)**; must **match the required fee** for the target level |
| target_level | int | Intended level after payment |

**Rule:** On receiving a valid payment (amount = required fee), create an **Upgrade Pending** record with `expires_at = payment_datetime + 72h`. If the member reaches the required qualification before `expires_at`, the reward is claimable; otherwise it **passes up**.

### Output Schema
| Field | Type | Description |
|:--|:--|:--|
| wallet_address | string | Unique wallet/account ID |
| total_account | int | Downline count under member |
| total_inflow | decimal | Total payments made (USDT in) |
| total_outflow | decimal | Total rewards earned (**USDT + BCC**) |
| pending | decimal | Rewards in **72h** hold state |
| next_required_level | int | Next level required to unlock pending |
| pending_expires_at | datetime | Expiry time for current pending rewards |

---|:---|
| wallet_address | Member’s wallet address |
| referrer_wallet | Sponsor wallet address |
| payment_datetime | Date & time of transaction |
| total_payment | Amount paid in USDT |

### Output Schema
| Field | Description |
|:---|:---|
| wallet_address | Unique wallet/account ID |
| total_account | Number of accounts (downlines) under member |
| total_inflow | Total payments made (USDT in) |
| total_outflow | Total rewards earned (USDT + BCC out) |
| pending | Pending payouts awaiting qualification or 72h expiry |

---

## 6) Summary of Rules

- **Three directs minimum** to unlock higher levels.
- **Direct sponsor reward:** 100 USDT each.
- **Upgrade fee:** unlocks corresponding **layering payout**.
- **First & second layer payouts:** automatic.
- **Third in same layer:** requires upgrade or reward passes up (after 72h).
- **BCC tokens:** bonus at each level-up (100–1950).
- **USDT payouts:** depend on layering & level qualification.
- **Company wallet** receives unclaimed pass-up rewards.
- **Direct sponsor reward:** can get paid up to 2 people. third direct sponsor and above payout will get on hold unless level up to level 2.
---

## 7) Example Flow

1. **Join:** Pay 130 USDT, receive 500 BCC, sponsor gets 100 USDT.
2. **Upgrade to Level 2:** Pay 150 USDT.
   - Can claim 100×3 from directs.
   - Can receive 150 from first and second people in Layer 2 upgrading.
3. **Upgrade to Level 3:** Pay 200 USDT.
   - Eligible for 200 rewards from first and second upgrades in Layer 3.
   - Must upgrade to Level 4 for third upgrade claim.

---

## 8) Smart-Contract Implementation Notes

### Token Mint Logic
```solidity
function mintBCC(address user, uint level) public {
    uint bccReward = BCC_LEVEL_REWARD[level];
    mint(user, bccReward * 1e18);
}
```

### Layer Payout Logic
```solidity
function handleLayerUpgrade(address user, uint layerLevel, uint payout) public {
    address upline = getUpline(user, layerLevel);
    if (qualified(upline, layerLevel)) {
        payUSDT(upline, payout);
    } else {
        holdPending(upline, payout, 72 hours);
        passUpIfExpired(upline, payout);
    }
}
```

---

## 9) Transparency & Fairness

- 100% on-chain, automatic execution.
- Every upgrade recorded via transaction log.
- All pending rewards visible in wallet.
- No manual intervention, no hidden pool.

---

**End of BeeHive USDT + BCC Dual-Rewards Specification**

