# Restaurant QR Loyalty — client

Vite + React + TypeScript + Tailwind + shadcn/ui scaffold for the public landing and staff app. Aligns with `../DESIGN.md`. This is a scaffold; screens will be finished once the back end is wired through `../docs/api.md`.

## Run locally

1. Copy `client/.env.example` to `client/.env` and leave `VITE_API_URL=http://localhost:3001` unless the API uses another origin.
2. From this `client` folder:

```
npm install
npm run dev
```

The app serves at [http://localhost:5173](http://localhost:5173) and redirects `/` to `/r/trattoria` ([PH] slug).

Other scripts (Windows-friendly, no bash-only commands):

```
npm run build
npm run preview
npm run lint
npm run typecheck
```

## Routes

Customer (no login):

- `/r/:slug` — landing + form (name, phone, email, optional day+month birthday, unticked marketing consent)
- `/r/:slug/reward/:token` — on-screen reward code

Staff (JWT, default screen after login is Redeem):

- `/admin/login`
- `/admin` → `/admin/redeem`
- `/admin/redeem`
- `/admin/contacts` (search + export CSV)
- `/admin/qr` (printable table card placeholder)
- `/admin/campaigns`
- `/admin/campaigns/new`
- `/admin/campaigns/:id`
- `/admin/settings`

All of these pages are `noindex`. Restaurant branding uses `[PH]` placeholders.

## Notes

- Never commit `.env` files. Only `.env.example` belongs in git.
- The API wrapper lives in `src/lib/api.ts` and reads `VITE_API_URL`.
