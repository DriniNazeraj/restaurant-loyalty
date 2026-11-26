# Restaurant QR Loyalty

Monorepo for the Restaurant QR Loyalty app: guests scan a table QR, leave their details and get an on-screen reward code; staff redeem codes, see contacts, print QR cards and draft campaigns.

- `client/`: Vite + React + TypeScript + Tailwind + shadcn/ui (guest landing + staff app)
- `server/`: Express + TypeScript + PostgreSQL + Zod + JWT (local Postgres only)
- API contract: [`docs/api.md`](docs/api.md) · shared Zod schemas/types: [`server/src/schemas.ts`](server/src/schemas.ts) · design spec: `DESIGN.md`

All restaurant names, copy and offers marked **[PH]** are placeholders.

---

## Quick start (Windows laptop, also works on macOS/Linux)

Every command below runs in **PowerShell** or **Command Prompt** from the repo folder (`restaurant-loyalty\`). No WSL and no bash needed.

### 1. Install once

1. **Node.js 20 LTS or newer** from <https://nodejs.org> (check with `node -v`).
2. **PostgreSQL 16 or 17** from <https://www.postgresql.org/download/windows/>. Keep port `5432` and make sure the "postgresql" Windows service is running.
3. Create the dev database user. Open **SQL Shell (psql)** or pgAdmin as the `postgres` user and run:
   ```sql
   CREATE ROLE loyalty WITH LOGIN PASSWORD 'loyalty_dev_password' CREATEDB;
   ```
   (Or skip this and edit `DATABASE_URL` in `.env` to use your own Postgres user/password.)

### 2. Set up the project

```powershell
npm install
npm run setup:env
npm run install:all
npm run db:setup
npm run db:seed
```

- `npm run setup:env` copies `.env.example` → `.env` (used by the server) and `client/.env.example` → `client/.env`, and never overwrites an existing `.env`. It works the same on Windows, macOS and Linux. Open `.env` and change `JWT_SECRET` to any long random string.
- `npm run install:all` runs `npm install` in `server/` and in `client/`.
- `npm run db:setup` creates the database (if missing) and applies migrations; `npm run db:seed` adds the demo restaurants, logins and guests.
- Shortcut: `npm run setup` does all of the above (env, installs, db:setup, db:seed) in one go.

`.env` files hold local settings only and are git-ignored. Never commit them.

### 3. Run it

```powershell
npm run dev
```

This starts both apps together (via `concurrently`):

| What | URL |
|---|---|
| Guest landing (demo restaurant) | <http://localhost:5173/r/demo-bistro> |
| Second demo restaurant | <http://localhost:5173/r/demo-pizzeria> |
| Staff login | <http://localhost:5173/admin/login> |
| API health check | <http://localhost:3001/api/health> |

Stop both with `Ctrl+C`. To run them separately: `npm run dev:server` and `npm run dev:client` in two terminals.

### Demo logins (local seed data only)

The seed sets every staff password to `SEED_STAFF_PASSWORD` from your `.env`. With the default `.env.example` that is **`dev-staff-password-change-me`**.

| Restaurant | Owner (everything) | Waiter (redeem, contacts, QR, view campaigns) |
|---|---|---|
| [PH] Demo Bistro `demo-bistro` | `owner@demo-bistro.local` | `staff@demo-bistro.local` |
| [PH] Demo Pizzeria `demo-pizzeria` | `owner@demo-pizzeria.local` | `staff@demo-pizzeria.local` |

These are local demo accounts for your laptop only, not real credentials.

### Reset the demo data

```powershell
npm run db:reset
```

This drops and recreates the tables, then re-seeds. It's handy before a QA run.

### Other root scripts

| Script | What it does |
|---|---|
| `npm run build` | Builds server and client |
| `npm run typecheck` | TypeScript check for server and client |
| `npm run lint` | Lints the client |
| `npm test` | Server unit + API tests (needs `TEST_DATABASE_URL`) |
| `npm run size:landing` | After `npm run build`: gzipped JS loaded by the guest landing (budget 100 KB) |

---

## Front end (`client/`)

Routes (DESIGN.md §1):

- Guest: `/r/:slug` (landing + form, or the "Already claimed" card) · `/r/:slug/reward/:token` (reward ticket, live status every 5 s while the tab is visible)
- Staff: `/admin/login` · `/admin/redeem` (default after login) · `/admin/contacts` · `/admin/qr` · `/admin/campaigns` · `/admin/campaigns/new` · `/admin/campaigns/:id` · `/admin/settings` (owner only)

Notes:

- The API base URL comes from `VITE_API_URL` in `client/.env` (default `http://localhost:3001`).
- The guest device token from a claim is stored in `localStorage` under `loyalty_device_token:<slug>` and sent back on a repeat claim, so the same phone sees its full code again. Any other device gets the masked "Already claimed" card.
- Staff JWT is stored in `localStorage`. Any `401` signs out and returns to the login page. Owner-only actions (CSV export, settings, writing campaigns, undo redeem) are hidden for waiters, and a `403` is handled with a message.
- Campaign sending is not connected: the Send button is disabled ("Sending not connected yet").
- Every `/admin` page is lazy-loaded so the guest landing stays under 100 KB of gzipped JS.

---

## Backend (`server/`)

Express + TypeScript + PostgreSQL (`pg`) + Zod + JWT + bcryptjs. Runs against a **local PostgreSQL** instance only.

- Default reward expiry: **`30` days [PH]** per restaurant (nullable; `null` = never expires).

### Prerequisites (Windows & macOS/Linux)
1. **Node.js 20+** (`node -v`)
2. **Local PostgreSQL 16 or 17**
   - Windows: install [PostgreSQL for Windows](https://www.postgresql.org/download/windows/) and make sure the PostgreSQL service is running on port `5432`.
   - Ensure the role in `DATABASE_URL` exists (or update `DATABASE_URL` in `.env` to match your local `postgres` username and password). Example SQL to create the default dev role in pgAdmin or SQL Shell (`psql`):
     ```sql
     CREATE ROLE loyalty WITH LOGIN PASSWORD 'loyalty_dev_password' CREATEDB;
     ```

### Setup & Run Steps

From the repository root (`restaurant-loyalty/`):

1. **Create `.env` from `.env.example`**
   - Windows PowerShell:
     ```powershell
     Copy-Item .env.example .env
     ```
   - Windows Command Prompt (`cmd`):
     ```bat
     copy .env.example .env
     ```
   - macOS / Linux:
     ```sh
     cp .env.example .env
     ```
   Edit `.env` if your local PostgreSQL credentials differ, and set `JWT_SECRET` and `SEED_STAFF_PASSWORD`.

2. **Install server dependencies**
   ```sh
   cd server
   npm install
   ```

3. **Create database & apply SQL migrations** (pure Node script, idempotent — creates the database if it does not exist yet)
   ```sh
   npm run db:setup
   ```

4. **Seed sample restaurants, logins, contacts, and draft campaign** (idempotent)
   ```sh
   npm run db:seed
   ```

5. **Start the API server** (default `http://localhost:3001`)
   ```sh
   npm run dev
   ```

### Useful Server Scripts
Run inside `server/`:
- `npm run dev` — start dev server with watch mode (`tsx watch`)
- `npm run build` — compile TypeScript to `dist/`
- `npm start` — run compiled server (`node dist/index.js`)
- `npm run typecheck` — run `tsc --noEmit`
- `npm test` — run Vitest unit + Supertest integration suite (uses `TEST_DATABASE_URL`)
- `npm run db:setup` — ensure DB exists and apply pending `server/migrations/*.sql`
- `npm run db:seed` — seed `[PH] Demo Bistro` and `[PH] Demo Pizzeria`
- `npm run db:reset` — drop/recreate tables and re-run setup + seed (for QA)

### Seeded Local Accounts
All seeded accounts use the password set in `SEED_STAFF_PASSWORD` in your `.env`:
- **[PH] Demo Bistro** (`slug: demo-bistro`):
  - Owner: `owner@demo-bistro.local` (full access incl. CSV export, settings, campaigns write/send, undo-redeem)
  - Staff: `staff@demo-bistro.local` (redeem, contacts list/search, QR, read-only campaigns)
- **[PH] Demo Pizzeria** (`slug: demo-pizzeria`):
  - Owner: `owner@demo-pizzeria.local`
  - Staff: `staff@demo-pizzeria.local`

> **Messaging note:** Campaign sending is intentionally stubbed behind `MessageProvider` (`LogOnlyMessageProvider`). Calling `POST /api/campaigns/:id/send` logs the simulated payload server-side and returns `status: "sending_not_connected"` (`"sending not connected yet"`).
