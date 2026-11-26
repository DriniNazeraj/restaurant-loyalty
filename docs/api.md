# Restaurant QR Loyalty — API Contract

Base URL (local dev): `http://localhost:3001` (prefix `/api`).

## Global Conventions
- **Schemas & Types:** All request/response Zod schemas and TypeScript types live in `server/src/schemas.ts`.
- **Headers:** Every API response sets `X-Robots-Tag: noindex`.
- **Content-Type:** `application/json; charset=utf-8` (except `GET /api/contacts/export.csv` which returns `text/csv; charset=utf-8`).
- **Fixed Error Shape:**
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Human-readable message",
      "details": { "fields": { "phone": "Invalid phone number" } }
    }
  }
  ```
- **Stable Error Codes:**
  - `VALIDATION_ERROR` (`400`) — Zod validation or malformed request
  - `UNAUTHORIZED` (`401`) — missing, malformed, invalid, or expired JWT / bad login credentials
  - `FORBIDDEN` (`403`) — authenticated `staff` user lacks `owner` role
  - `NOT_FOUND` (`404`) — missing resource OR resource belongs to another restaurant (never `403` across tenants)
  - `ALREADY_REDEEMED` (`409`) — reward already redeemed
  - `REWARD_EXPIRED` (`409`) — reward past `expires_at`
  - `OFFER_ENDED` (`409`) — restaurant offer is currently switched off (`offerActive: false`)
  - `RATE_LIMITED` (`429`)
  - `INTERNAL_ERROR` (`500`)

---

## Data Model

- **`restaurants`**: `id` (uuid), `slug` (unique), `name`, `tagline`, `reward_title`, `reward_description`, `brand_color`, `consent_text`, `timezone` (default `Europe/Tirane`), `reward_expiry_days` (int nullable, default **`30` [PH]**; `null` = never expires), `offer_active` (boolean, default `true`), `created_at`.
- **`staff_users`**: `id` (uuid), `restaurant_id` (fk -> restaurants), `email` (unique, lowercase), `name`, `password_hash` (bcrypt), `role` (`owner` | `staff`), `created_at`.
- **`contacts`**: `id` (uuid), `restaurant_id` (fk -> restaurants), `name`, `phone_e164` (E.164), `email` (lowercase nullable), `birth_month` (1–12 nullable), `birth_day` (1–31 nullable), `birth_year` (nullable), `marketing_consent` (boolean, default `false`), `consented_at` (timestamptz nullable), `consent_text` (text nullable), `created_at`, `updated_at`.
  - Unique constraints: `(restaurant_id, phone_e164)` and partial unique index `(restaurant_id, LOWER(email)) WHERE email IS NOT NULL`.
- **`rewards`**: `id` (uuid), `restaurant_id` (fk -> restaurants), `contact_id` (unique fk -> contacts), `code` (6-char crypto-random uppercase from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, no `0/O/1/I`), `title`, `expires_at` (timestamptz nullable), `redeemed_at` (timestamptz nullable), `redeemed_by` (nullable fk -> staff_users), `device_token_hash` (unique SHA-256 hex nullable), `created_at`.
  - Unique constraint: `(restaurant_id, code)`.
- **`reward_audit_logs`**: `id` (uuid), `restaurant_id` (fk), `reward_id` (fk), `action` (`redeem` | `undo_redeem`), `actor_staff_id` (fk), `actor_name`, `created_at`.
- **`campaigns`**: `id` (uuid), `restaurant_id` (fk -> restaurants), `title`, `message`, `audience_type` (`all_consented` | `birthdays_this_week`), `status` (`draft` | `ready` | `sending_not_connected`), `last_attempted_at` (nullable), `created_by` (nullable fk), `created_at`, `updated_at`.

### Domain Rules & Anti-Leak Device Token Flow
1. **Phone normalization & matching (E.164, default region `AL` / `+355`):**
   - Phone is **required**. Normalization strips spaces, hyphens, parentheses, and dots; replaces leading `00` with `+`; converts local `0[1-9]...` to `+355...`; converts bare 9-digit AL mobile `6[6-9]\d{7}` to `+3556...`; converts bare `355...` (11–12 digits) to `+355...`; requires `^\+[1-9]\d{7,14}$`.
   - Email is optional (`""` normalized to `null`) and lowercased/trimmed.
   - An existing guest matches on **normalized `phone_e164` OR `LOWER(email)`** per restaurant. If phone matches one contact and email matches a different contact, **the phone match wins**.
2. **Claim & `deviceToken` anti-leak flow (for front end):**
   - On a **new claim** (`201`): server generates a 32-byte `base64url` `deviceToken`, stores only its **SHA-256 hash** (`device_token_hash`) on the `rewards` row, and returns `{ isExisting: false, alreadyClaimed: false, firstName, deviceToken, reward }`.
   - Front end stores `deviceToken` in `localStorage` scoped by restaurant `slug` (e.g. `loyalty_device_token:${slug}`).
   - On **re-submit**, front end reads `deviceToken` from `localStorage` for that `slug` and sends it in the signup body (`deviceToken`).
     - If `sha256(deviceToken)` matches the matched reward's `device_token_hash` -> `200` `{ isExisting: true, alreadyClaimed: false, firstName, deviceToken, reward }`.
     - Otherwise (different device / cleared storage / missing or wrong `deviceToken`) -> `200` `{ isExisting: true, alreadyClaimed: true, maskedCode: "••••N9", last2: "N9", status, message: "Already claimed — ask your waiter" }`, with **no** full code, name, or PII.
   - Repeat claims **never** overwrite stored contact details (only upgrade `marketing_consent` from `false` to `true` with `consented_at` + `consent_text`).
   - Guest ticket status polling uses `GET /api/public/claims/:deviceToken` (never the reward code), returning `{ status, redeemedAt }` only.
3. **Consent:** `marketingConsent` defaults to `false` if omitted. Non-consented contacts are **never** included in any campaign audience or send.
4. **Birthdays this week:** Evaluated in the restaurant's timezone (`Europe/Tirane` default) over the **Monday–Sunday calendar week** containing today. Feb 29 birthdays count as **Feb 28** in non-leap years. Dec/Jan week wraps are handled.
5. **CSV export:** Owner-only. Uses the same filter params (`q`, `consent`, `reward`, `sort`) as `GET /api/contacts`, includes `marketing_consent` and `consented_at`, RFC 4180 quoting, and prefixes leading `=`, `+`, `-`, `@`, `\t`, `\r` with `'`.

---

## Routes

### `GET /api/health`
- Auth: Public
- `200`: `{ "ok": true }`

### Public Customer Flow

#### `GET /api/public/restaurants/:slug`
- Auth: Public
- `200`: `{ "restaurant": { id, slug, name, tagline, rewardTitle, rewardDescription, brandColor, consentText, offerActive, rewardExpiryDays } }`
- Errors: `404 NOT_FOUND`

#### `POST /api/public/restaurants/:slug/signups`
- Auth: Public (rate-limited)
- Body: `{ name, phone, email?, birthday?, marketingConsent?, deviceToken? }`
  - `birthday` (optional/nullable): `"YYYY-MM-DD"`, `"MM-DD"`, or `{ month, day, year? }`.
  - `marketingConsent` (optional boolean, defaults `false`).
  - `deviceToken` (optional string from `localStorage` for same-device recovery).
- `201` (new contact + reward):
  `{ isExisting: false, alreadyClaimed: false, firstName, deviceToken, reward: { id, code, title, status, expiresAt, redeemedAt, createdAt } }`
- `200` (existing guest, matching `deviceToken`):
  `{ isExisting: true, alreadyClaimed: false, firstName, deviceToken, reward: { id, code, title, status, expiresAt, redeemedAt, createdAt } }`
- `200` (existing guest, missing/mismatched `deviceToken`):
  `{ isExisting: true, alreadyClaimed: true, maskedCode: "••••K9", last2: "K9", status: "active" | "redeemed" | "expired", message: "Already claimed — ask your waiter" }`
- Errors: `400 VALIDATION_ERROR`, `404 NOT_FOUND`, `409 OFFER_ENDED`, `429 RATE_LIMITED`

#### `GET /api/public/claims/:deviceToken`
- Auth: Public (generous rate limit for ~5s polling, zero PII)
- `200`: `{ "status": "active" | "redeemed" | "expired", "redeemedAt": string | null }`
- Errors: `404 NOT_FOUND`, `429 RATE_LIMITED`

### Staff Auth & Roles

All staff endpoints require `Authorization: Bearer <token>` (`401 UNAUTHORIZED` if missing/invalid). Every query is scoped to `restaurant_id` from the JWT.
- **`staff` & `owner`:** `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/contacts`, `GET /api/rewards/:code`, `POST /api/rewards/:code/redeem`, `GET /api/qr`, `GET /api/campaigns`, `GET /api/campaigns/audience-counts`, `GET /api/campaigns/:id/audience-preview`.
- **`owner` only (`403 FORBIDDEN` for `staff`):** `GET /api/contacts/export.csv`, `POST /api/rewards/:code/undo-redeem`, `PATCH /api/restaurant/settings`, `POST /api/campaigns`, `PATCH /api/campaigns/:id`, `DELETE /api/campaigns/:id`, `POST /api/campaigns/:id/send`.

#### `POST /api/auth/login`
- Auth: Public (rate-limited)
- Body: `{ email, password }`
- `200`: `{ token, staff: { id, email, name, role, restaurantId }, restaurant }`
- Errors: `400 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `429 RATE_LIMITED`

#### `GET /api/auth/me`
- Auth: Staff JWT (`owner` | `staff`)
- `200`: `{ staff, restaurant }`

### Contacts & CSV Export

#### `GET /api/contacts?q=&consent=all&reward=all&sort=newest&page=1&limit=50`
- Auth: Staff JWT (`owner` | `staff`)
- Query: `q` (search name, email, or phone in any format — e.g. `069...`, `+35569...`, `00355...`, with spaces), `consent` (`all`|`consented`|`not_consented`), `reward` (`all`|`active`|`redeemed`|`expired`), `sort` (`newest`|`name`), `page` (>=1), `limit` (1..100, default 50)
- `200`: `{ contacts: [...], pagination: { page, limit, total, totalPages } }`

#### `GET /api/contacts/export.csv?q=&consent=all&reward=all&sort=newest`
- Auth: Staff JWT (**`owner` only**, `403 FORBIDDEN` for `staff`)
- `200` (`text/csv; charset=utf-8`): Columns `name,phone,email,birthday,marketing_consent,consented_at,reward_code,reward_status,reward_redeemed_at,reward_expires_at,created_at`

### Rewards & Redemption

#### `GET /api/rewards/:code`
- Auth: Staff JWT (`owner` | `staff`, rate-limited)
- `200`: `{ reward: { id, code, title, status, expiresAt, redeemedAt, redeemedBy, createdAt }, contact: { id, name, phoneE164, email } }`
  (`redeemedBy` is the redeeming staff user's display name or `null`)
- Errors: `401 UNAUTHORIZED`, `404 NOT_FOUND`, `429 RATE_LIMITED`

#### `POST /api/rewards/:code/redeem`
- Auth: Staff JWT (`owner` | `staff`, rate-limited)
- Atomic conditional `UPDATE ... WHERE redeemed_at IS NULL AND (expires_at IS NULL OR expires_at > now())`.
- `200`: `{ reward: { id, code, title, status: "redeemed", expiresAt, redeemedAt, redeemedBy }, contact }`
- Errors: `401 UNAUTHORIZED`, `404 NOT_FOUND`, `409 ALREADY_REDEEMED`, `409 REWARD_EXPIRED`, `429 RATE_LIMITED`

#### `POST /api/rewards/:code/undo-redeem`
- Auth: Staff JWT (**`owner` only**, `403 FORBIDDEN` for `staff`)
- Clears `redeemed_at` and `redeemed_by` and logs `{ actorStaffId, actorName, timestamp }` in `reward_audit_logs`.
- `200`: `{ reward: { id, code, title, status: "active" | "expired", expiresAt, redeemedAt: null, redeemedBy: null }, contact }`
- Errors: `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 NOT_FOUND`

### QR Card & Restaurant Settings

#### `GET /api/qr`
- Auth: Staff JWT (`owner` | `staff`)
- `200`: `{ landingUrl, qrSvg, qrDataUrl, restaurant }`

#### `PATCH /api/restaurant/settings`
- Auth: Staff JWT (**`owner` only**, `403 FORBIDDEN` for `staff`)
- Body: partial `{ name?, tagline?, rewardTitle?, rewardDescription?, brandColor?, consentText?, offerActive?, rewardExpiryDays? }`
- `200`: `{ restaurant }`

### Campaigns & MessageProvider Stub

#### `GET /api/campaigns/audience-counts`
- Auth: Staff JWT (`owner` | `staff`)
- `200`: `{ timezone, weekRange: { start, end }, counts: { all_consented: number, birthdays_this_week: number } }`

#### `GET /api/campaigns`
- Auth: Staff JWT (`owner` | `staff`)
- `200`: `{ campaigns: [...] }`

#### `POST /api/campaigns`
- Auth: Staff JWT (**`owner` only**, `403 FORBIDDEN` for `staff`)
- Body: `{ title, message, audienceType: "all_consented" | "birthdays_this_week", status?: "draft" | "ready" }`
- `201`: `{ campaign }`

#### `PATCH /api/campaigns/:id`
- Auth: Staff JWT (**`owner` only**, `403 FORBIDDEN` for `staff`)
- Body: partial `{ title?, message?, audienceType?, status? }`
- `200`: `{ campaign }`

#### `DELETE /api/campaigns/:id`
- Auth: Staff JWT (**`owner` only**, `403 FORBIDDEN` for `staff`)
- `200`: `{ deleted: true, id }`

#### `GET /api/campaigns/:id/audience-preview`
- Auth: Staff JWT (`owner` | `staff`)
- `200`: `{ campaignId, audienceType, timezone, weekRange, count, sample: [...] }`

#### `POST /api/campaigns/:id/send`
- Auth: Staff JWT (**`owner` only**, `403 FORBIDDEN` for `staff`)
- Calls `MessageProvider` (`LogOnlyMessageProvider`), saves attempt (`status = "sending_not_connected"`), returns `200`:
  `{ campaign, dispatch: { status: "sending_not_connected", code: "SENDING_NOT_CONNECTED", message: "sending not connected yet", provider: "log-only", recipientCount, loggedAt } }`
