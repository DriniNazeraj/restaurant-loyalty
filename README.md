# Restaurant QR Loyalty

Monorepo for the Restaurant QR Loyalty app (`client/` + `server/` + `docs/`).

- API contract: [`docs/api.md`](docs/api.md)
- Shared request/response Zod schemas & types: [`server/src/schemas.ts`](server/src/schemas.ts)
- Design spec: [`DESIGN.md`](DESIGN.md)

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
