# Direct-Sales Tree (3-wide, no depth cap) — Design & Implementation Guide

> Use this Markdown with Cursor to scaffold your backend + frontend.

---

## 1) Overview

- **Structure:** Fixed-width **ternary tree** (each member ≤ 3 children).
- **Referral rule:** Sponsor’s first 3 go directly under sponsor; afterwards **even spillover** across the entire sponsor subtree via a **round-robin, slot-based** algorithm.
- **No depth cap:** The tree can grow arbitrarily deep.
- **Goals:** Strong data integrity, fast subtree reads, deterministic placement, scalable graph UI.

---

## 2) Database Design (MySQL 8+ or PostgreSQL)

### Tables

```sql
-- members: business identity + sponsor link
CREATE TABLE members (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  username   VARCHAR(80) NOT NULL UNIQUE,
  joined_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  root_id    BIGINT NULL,           -- top ancestor of the placed team
  sponsor_id BIGINT NULL,           -- business referrer (not always the placement parent)
  CONSTRAINT fk_members_sponsor FOREIGN KEY (sponsor_id) REFERENCES members(id)
);

-- placements: actual tree parenting with fixed positions 1..3
CREATE TABLE placements (
  parent_id BIGINT NOT NULL,
  child_id  BIGINT NOT NULL,
  position  TINYINT NOT NULL,       -- 1, 2, or 3
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (child_id),
  CONSTRAINT fk_pl_parent FOREIGN KEY (parent_id) REFERENCES members(id),
  CONSTRAINT fk_pl_child  FOREIGN KEY (child_id)  REFERENCES members(id),
  CONSTRAINT uq_parent_pos UNIQUE (parent_id, position),
  CONSTRAINT chk_pos CHECK (position BETWEEN 1 AND 3)
);

-- member_closure: transitive closure for fast subtree/level queries
CREATE TABLE member_closure (
  ancestor_id   BIGINT NOT NULL,
  descendant_id BIGINT NOT NULL,
  depth         INT    NOT NULL,    -- 0=self, 1=parent, 2=grandparent, ...
  PRIMARY KEY (ancestor_id, descendant_id),
  CONSTRAINT fk_mc_anc FOREIGN KEY (ancestor_id) REFERENCES members(id),
  CONSTRAINT fk_mc_des FOREIGN KEY (descendant_id) REFERENCES members(id)
);

-- helpful indexes
CREATE INDEX idx_pl_parent   ON placements(parent_id);
CREATE INDEX idx_mc_anc_depth ON member_closure(ancestor_id, depth);
CREATE INDEX idx_mc_des_depth ON member_closure(descendant_id, depth);
```

### Why this schema
- `placements` + `uq_parent_pos` **enforces ≤3 children**.
- `member_closure` enables **O(1) depth checks** and **O(log n)–O(n)** subtree reads (no recursive loops in app).
- `sponsor_id` preserves **referral lineage** even when spillover places a member elsewhere.
- `root_id` lets you group/partition large teams easily.

> Optional optimization columns (denormalized, updated transactionally):  
> `members.child_count TINYINT` (0–3), `members.depth INT` (distance from root). These speed up reads/UI.

---

## 3) Placement Algorithm (No Code)

### Phase A — Direct under Sponsor
1. If **sponsor has < 3 children**, place new member under sponsor at **lowest free position (1→2→3)**. Done.

### Phase B — Even Spillover (Round-Robin), No Depth Cap
2. **Candidate set:** all nodes in sponsor’s **entire subtree** that currently have **< 3 children**. (No depth filter.)
3. **Slots:** convert each candidate’s free capacity into ordered slots:
   - 1 free → **slot #1**
   - 2 free → **slot #1, slot #2**
   - 3 free → **slot #1, slot #2, slot #3**
4. **Sort slots** deterministically:
   1) slot index ASC (**#1 before #2 before #3**)
   2) depth ASC (**shallower first**, i.e., closer to sponsor)
   3) parent’s **joined_at** ASC (**earlier first**)
   4) stable tiebreak (e.g., **parent_id ASC**)
5. **Pick slot (round-robin):**
   - Let `referrals_before` = how many members this sponsor referred **before** this new one (by time).
   - If `< 3`, Phase A handled it already.
   - Else `k = referrals_before − 3 + 1` (1-based).  
     Choose the **k-th** slot in the ordered list; **wrap** to start if past the end.
6. **Place** under that slot’s parent at **lowest free position**. Done.
7. **Concurrency:** if that parent just filled up, pick the **next** slot in order.

> Intuition: After A/B/C are sponsor’s first 3 directs, their **slot #1** appear first → 4th→A, 5th→B, 6th→C; then slot #2 pass → 7th→A, 8th→B, 9th→C; etc. If someone is full, skip them.

---

## 4) Maintaining the Closure Table (on each placement)

When placing `child` under `parent`:

1. Insert into `placements(parent_id, child_id, position)`.
2. Add closure **self-link**: `(child, child, 0)`.
3. For **every ancestor** of `parent` (including parent itself from its self-link), add `(ancestor_of_parent, child, depth+1)`.

```sql
-- self link
INSERT INTO member_closure (ancestor_id, descendant_id, depth)
VALUES (:child, :child, 0);

-- ancestors of parent → child
INSERT INTO member_closure (ancestor_id, descendant_id, depth)
SELECT ancestor_id, :child, depth + 1
FROM member_closure
WHERE descendant_id = :parent;
```

Also set `members.root_id` of the child to the parent’s root (ancestor with `depth=0`).

---

## 5) Recommended Tech Stack

### Backend
- **MySQL 8+ / PostgreSQL** — transactional, recursive queries.
- **Language choices:**
  - PHP / Laravel (simple + reliable)
  - Node.js / TypeScript (Knex / Prisma)
  - Python / FastAPI (if you prefer Python stack)

### Frontend
- **Best Tree Libraries:**
  - 🧩 **vis-network** → Canvas-based, fast for thousands of nodes.
  - 🌿 **Cytoscape.js** → WebGL-based, supports very large trees.
  - 📊 **D3.js** → excellent for small-medium data, can be switched to Canvas mode for large trees.

### Rendering Tips
- Load tree by **depth range** (`maxDepth=3` initially), expand on click.
- Cache shallow levels (depth ≤3) client-side.
- Collapse unused branches for performance.
- For tables, use **react-window** or **vue-virtual-scroll-list** for virtual scrolling.

---

## 6) Scaling & Performance Checklist

- ✅ DB constraints: `UNIQUE(parent_id, position)` and PK on closure table.
- ✅ Use transactions + `FOR UPDATE` to avoid duplicate placement.
- ✅ Add `child_count` and `depth` columns for speed.
- ✅ Paginate master list view (e.g., show 200–500 per depth).
- ✅ Partition or shard by `root_id` when teams grow large.
- ✅ Lazy load deeper levels, virtualize UI rendering.
- ✅ Use Redis/Firebase only as a **read cache**, not as primary DB.

---

## 7) Example JSON Output for Graph

```json
{
  "id": 1,
  "name": "root",
  "children": [
    { "id": 2, "name": "A", "position": 1, "children": [
      { "id": 5, "name": "D", "position": 1 },
      { "id": 8, "name": "G", "position": 2 }
    ]},
    { "id": 3, "name": "B", "position": 2, "children": [
      { "id": 6, "name": "E", "position": 1 }
    ]},
    { "id": 4, "name": "C", "position": 3, "children": [
      { "id": 7, "name": "F", "position": 1 }
    ]}
  ]
}
```

---

## 8) Final Notes

- **Backend:** MySQL + PHP/Laravel or Node/TS preferred.
- **Frontend:** vis-network (Canvas) or Cytoscape.js (WebGL).
- **Design goal:** stable 3-branch tree, deterministic placement, no depth limit.
- **UI Strategy:** depth-limited lazy loading, caching, virtualized rendering.
