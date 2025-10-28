# Developer Guide: Direct Sales Tree Visualization and API

This guide helps developers get started quickly: local setup, testing, how the placement algorithm works, API + widget usage, and production deployment on a VPS.

---

## 1) Overview

- Backend: Node.js + Express + TypeScript, MySQL (closure table)
- Frontend: React + Vite + Cytoscape.js (for visualization)
- Public UI: `frontend/`
- Public API: `src/server.ts` → `/api/*`
- Embeddable widget + iframe: `public/widget.js`, `public/embed.html`

---

## 2) Repository Structure

```
root/
  frontend/                  # React + Vite app
  public/                    # Static assets (widget, embed page, examples)
    widget.js
    embed.html
    example-integration.html
  src/
    controllers/
    database/
      connection.ts
      schema.sql
    models/
    scripts/
      importCSV.ts           # CSV import + placement algorithm
    services/
      MemberService.ts
      TreeService.ts
    server.ts                # Express server + routes
  members.csv                # Sample data
  README.md                  # Feature overview + API table
  DirectSales_Tree_Guide.md  # Business-facing guide
  MEMBER_MANAGEMENT_README.md
```

---

## 3) Prerequisites

- Node.js 18+
- npm 9+
- MySQL 8+
- Windows, macOS, or Linux

---

## 4) Local Setup (Backend + Frontend)

1. Install dependencies (root + frontend):
   ```bash
   npm install
   cd frontend && npm install && cd ..
   ```

2. Configure environment:
   - Copy `env.example` → `.env` at project root
   - Set DB credentials (MySQL host, port, user, password, database)

3. Initialize database schema:
   ```bash
   # create DB per your .env first if needed
   mysql -u <user> -p < database_name < src/database/schema.sql
   ```

4. Import sample data (this runs the placement algorithm):
   ```bash
   npm run import-csv
   ```

5. Start dev servers (concurrently):
   ```bash
   npm run dev
   # Backend: http://localhost:3000
   # Frontend: http://localhost:5173
   ```

---

## 5) Testing Locally

### 5.1 Health check
```bash
curl http://localhost:3000/api/health
```

### 5.2 Member and tree endpoints
```bash
# Get member by ID
curl http://localhost:3000/api/members/1

# Get member by wallet
curl http://localhost:3000/api/members/wallet/0xABC...

# Get tree by member ID (depth 3)
curl "http://localhost:3000/api/tree/1?maxDepth=3"

# Search members
curl "http://localhost:3000/api/search?term=john"

# Subtree stats
curl http://localhost:3000/api/stats/1

# Members by level
curl "http://localhost:3000/api/level/1/2?limit=100&offset=0"
```

### 5.3 Frontend tree viewer
- Navigate to `http://localhost:5173`

### 5.4 Embeddable widget (no build needed)
- Widget file: `public/widget.js`
- Example page: `public/example-integration.html`
- Embed page: `public/embed.html`
- With the dev server running, open in browser:
  - `http://localhost:3000/example-integration.html`
  - `http://localhost:3000/embed.html?memberId=1&maxDepth=3`

> The backend serves `public/` via static hosting. The widget calls your API at `/api/*`.

---

## 6) Placement Algorithm (How members are placed)

The system builds a fixed-width ternary tree (up to 3 children per member) using a two-phase, deterministic algorithm. This is executed during CSV import (`src/scripts/importCSV.ts`).

- Phase A (Direct placements): The first 3 referrals of a sponsor are placed directly under the sponsor, occupying positions 1, 2, and 3.
- Phase B (Spillover / round-robin): Starting from the 4th referral, placements spill over breadth-first across the sponsor’s subtree, filling the earliest available positions in a round-robin manner.

Key points:
- Deterministic: Same input → same tree.
- No artificial depth limit (trees can grow deep; UI uses depth limiting for performance when rendering).
- Closure Table: We maintain `member_closure (ancestor_id, descendant_id, depth)` for fast subtree queries.

Why closure table:
- O(1) depth checks
- Efficient subtree traversal and counts
- Enables stats like members-by-level and subtree sizes

Tables (conceptually):
- `members`: user identity and their sponsor reference
- `placements`: actual fixed position (1–3) under a parent in the tree
- `member_closure`: transitive relationships for fast queries

---

## 7) Database Schema

- SQL is in `src/database/schema.sql`.
- Ensure appropriate indexes (on `ancestor_id`, `descendant_id`, `depth`) for `member_closure`.
- Use `members.csv` as example data (the CSV import script validates and inserts while generating placements + closure rows).

---

## 8) API Overview

Base URL (local): `http://localhost:3000`

- `GET /api/health`
- `GET /api/members`
- `GET /api/members/:id`
- `GET /api/members/wallet/:wallet`
- `GET /api/members/:id/layer`
- `GET /api/tree/:id?maxDepth=3`
- `GET /api/tree/wallet/:wallet?maxDepth=3`
- `GET /api/search?term=...`
- `GET /api/stats/:id`
- `GET /api/level/:id/:level?limit=100&offset=0`

See also: `README.md` → API Endpoints table.

---

## 9) Embeddable Widget + Iframe

### 9.1 Widget (recommended for other sites)
1) Include script
```html
<script src="https://YOUR_DOMAIN/widget.js"></script>
```
2) Add container and initialize
```html
<div id="tree-container" style="width:100%;height:600px;"></div>
<script>
  const widget = TreeWidget.init({
    container: 'tree-container',
    apiUrl: 'https://YOUR_DOMAIN/api',
    memberId: 1,              // or wallet: '0x...'
    maxDepth: 3,
    showControls: true,
    showTooltips: true,
    onNodeClick: (id, data) => console.log(id, data)
  });
</script>
```

### 9.2 Iframe
```html
<iframe
  src="https://YOUR_DOMAIN/embed.html?memberId=1&maxDepth=3"
  width="100%"
  height="600"
  frameborder="0"></iframe>
```

Files:
- `public/widget.js`: the widget script
- `public/embed.html`: minimal viewer for iframe
- `public/example-integration.html`: multiple integration examples

CORS:
- `src/server.ts` has CORS configured. Replace placeholders with your production domains.

---

## 10) Production Deployment (VPS)

Example: Ubuntu 22.04, Node.js 18, MySQL 8, Nginx reverse proxy.

1) Provision VPS and install dependencies
```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential

# MySQL (or use managed DB)
sudo apt-get install -y mysql-server
sudo mysql_secure_installation
```

2) Clone repo and set env
```bash
git clone <your-repo-url>
cd tree_diagram
cp env.example .env
# edit .env with production DB credentials
```

3) Setup database
```bash
mysql -u <user> -p -e "CREATE DATABASE <db_name> CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u <user> -p < <db_name> src/database/schema.sql
npm run import-csv
```

4) Install and build
```bash
npm install
cd frontend && npm install && cd ..
npm run build
```

5) Run the server (choose one)
- PM2:
  ```bash
  npm install -g pm2
  pm2 start dist/server.js --name tree-api
  pm2 save && pm2 startup
  ```
- Or systemd: create a unit file pointing to `node dist/server.js`

6) Reverse proxy with Nginx
```bash
sudo apt-get install -y nginx
sudo tee /etc/nginx/sites-available/tree <<'EOF'
server {
  listen 80;
  server_name YOUR_DOMAIN;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
EOF
sudo ln -s /etc/nginx/sites-available/tree /etc/nginx/sites-enabled/tree
sudo nginx -t && sudo systemctl reload nginx
```

7) SSL (Let’s Encrypt)
```bash
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx -d YOUR_DOMAIN -d www.YOUR_DOMAIN
```

8) Post-deploy checks
- `https://YOUR_DOMAIN/api/health`
- `https://YOUR_DOMAIN/embed.html?memberId=1`
- `https://YOUR_DOMAIN/example-integration.html`

---

## 11) Security & Performance

- CORS: restrict to trusted origins in `src/server.ts`
- Rate limiting + basic WAF (consider `express-rate-limit` / Nginx limits)
- DB indexes on closure table (`ancestor_id`, `descendant_id`, `depth`)
- Depth limiting on UI (`maxDepth`) to keep diagrams fast
- Use PM2/systemd for process resilience
- Set `NODE_ENV=production`

---

## 12) Troubleshooting & FAQ

- "CORS error in browser":
  - Ensure your domain is added in `src/server.ts` CORS `origin` array
- "No data / empty tree":
  - Verify DB connection (.env), run `npm run import-csv`, check `members` count
- "Widget loads but canvas empty":
  - Check the API response in DevTools → Network, and console errors
- "Large trees render slowly":
  - Lower `maxDepth` (e.g., 3–5), or paginate navigation using clicks
- "How do I embed on another site?":
  - Use `public/widget.js` (JS widget) or `public/embed.html` (iframe)

---

## 13) Useful Commands

```bash
# Dev (backend + frontend concurrently)
npm run dev

# Backend only	npm run dev:backend
# Frontend only	cd frontend && npm run dev

# Build (backend + frontend)
npm run build

# Start production server
npm start

# Import/seed from CSV
npm run import-csv
```

---

## 14) Where to Change Things

- API CORS: `src/server.ts`
- DB Credentials: `.env`
- Schema: `src/database/schema.sql`
- Placement algorithm: `src/scripts/importCSV.ts`
- Widget script: `public/widget.js`
- Iframe page: `public/embed.html`
- Example integrations: `public/example-integration.html`
- Frontend viewer components: `frontend/src/components/`

---

If you get stuck, start with `npm run dev`, confirm `GET /api/health`, and open the embed/example pages. This verifies backend, DB, widget, and rendering end-to-end.
