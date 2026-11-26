import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import type { Pool } from 'pg';
import {
  PublicSignupRequestSchema,
  type PublicClaimStatusResponse,
  type PublicSignupResponse,
} from '../schemas.js';
import type { RateLimiters } from '../middleware/rateLimit.js';
import { AppError, formatZodDetails } from '../utils/errors.js';
import { normalizePhoneE164 } from '../utils/phone.js';
import { parseBirthdayInput } from '../utils/birthday.js';
import { generateRewardCode } from '../utils/rewardCode.js';
import {
  computeRewardStatus,
  mapPublicRestaurant,
  mapRewardSummary,
  toIsoOrNull,
  type ContactRow,
  type RestaurantRow,
  type RewardRow,
} from '../services/mappers.js';

interface RewardWithHashRow extends RewardRow {
  device_token_hash: string | null;
}

function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function tokensMatch(providedToken: string | null | undefined, storedHash: string | null): boolean {
  if (!providedToken || !storedHash) return false;
  const providedBuf = Buffer.from(hashDeviceToken(providedToken), 'hex');
  const storedBuf = Buffer.from(storedHash, 'hex');
  if (providedBuf.length !== storedBuf.length) return false;
  return timingSafeEqual(providedBuf, storedBuf);
}

async function handleExistingClaim(opts: {
  pool: Pool;
  existing: { contact: ContactRow; reward: RewardWithHashRow };
  suppliedToken: string | null | undefined;
  marketingConsent: boolean;
  consentText: string;
  now: Date;
}): Promise<PublicSignupResponse> {
  const { pool, existing, suppliedToken, marketingConsent, consentText, now } = opts;
  if (suppliedToken && tokensMatch(suppliedToken, existing.reward.device_token_hash)) {
    const contact = await maybeUpgradeConsent(
      pool,
      existing.contact,
      marketingConsent,
      consentText,
      now
    );
    return {
      isExisting: true,
      alreadyClaimed: false,
      firstName: firstNameOf(contact.name),
      deviceToken: suppliedToken,
      reward: mapRewardSummary(existing.reward, now),
    };
  }

  // No matching deviceToken -> change NOTHING on contact (do not upgrade consent)
  const last2 = existing.reward.code.slice(-2);
  return {
    isExisting: true,
    alreadyClaimed: true,
    maskedCode: `••••${last2}`,
    last2,
    status: computeRewardStatus(existing.reward.redeemed_at, existing.reward.expires_at, now),
    message: 'Already claimed — ask your waiter',
  };
}

export function createPublicRouter(pool: Pool, limiters: RateLimiters, clock: () => Date): Router {
  const router = Router();

  router.get('/restaurants/:slug', async (req, res, next) => {
    try {
      const slug = req.params.slug;
      const result = await pool.query<RestaurantRow>(
        `SELECT id, slug, name, tagline, reward_title, reward_description, brand_color,
                consent_text, timezone, reward_expiry_days, offer_active
         FROM restaurants
         WHERE slug = $1`,
        [slug]
      );
      const row = result.rows[0];
      if (!row) {
        throw new AppError(404, 'NOT_FOUND', 'Restaurant not found');
      }
      res.json({ restaurant: mapPublicRestaurant(row) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/restaurants/:slug/signups', limiters.publicSignup, async (req, res, next) => {
    try {
      const parsed = PublicSignupRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid signup data', formatZodDetails(parsed.error));
      }

      const now = clock();
      const phoneE164 = normalizePhoneE164(parsed.data.phone);
      if (!phoneE164) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid phone number', {
          fields: { phone: 'Enter a valid phone number (e.g. 0691234567 or +355691234567)' },
        });
      }

      const email =
        parsed.data.email && parsed.data.email.trim().length > 0
          ? parsed.data.email.trim().toLowerCase()
          : null;

      const birthday = parseBirthdayInput(parsed.data.birthday, now.getUTCFullYear());
      const marketingConsent = parsed.data.marketingConsent === true;
      const suppliedDeviceToken = parsed.data.deviceToken ?? null;

      const restRes = await pool.query<RestaurantRow>(
        `SELECT id, slug, name, tagline, reward_title, reward_description, brand_color,
                consent_text, timezone, reward_expiry_days, offer_active
         FROM restaurants
         WHERE slug = $1`,
        [req.params.slug]
      );
      const restaurant = restRes.rows[0];
      if (!restaurant) {
        throw new AppError(404, 'NOT_FOUND', 'Restaurant not found');
      }

      const existingLookup = await findExistingContactWithReward(pool, restaurant.id, phoneE164, email);
      if (existingLookup) {
        const body = await handleExistingClaim({
          pool,
          existing: existingLookup,
          suppliedToken: suppliedDeviceToken,
          marketingConsent,
          consentText: restaurant.consent_text,
          now,
        });
        res.status(200).json(body);
        return;
      }

      if (!restaurant.offer_active) {
        throw new AppError(409, 'OFFER_ENDED', 'This offer has ended.');
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        let insertedContact: ContactRow;
        try {
          const contactInsert = await client.query<ContactRow>(
            `INSERT INTO contacts (
              restaurant_id, name, phone_e164, email,
              birth_month, birth_day, birth_year,
              marketing_consent, consented_at, consent_text
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, name, phone_e164, email, birth_month, birth_day, birth_year,
                      marketing_consent, consented_at, consent_text, created_at`,
            [
              restaurant.id,
              parsed.data.name,
              phoneE164,
              email,
              birthday.birthMonth,
              birthday.birthDay,
              birthday.birthYear,
              marketingConsent,
              marketingConsent ? now : null,
              marketingConsent ? restaurant.consent_text : null,
            ]
          );
          insertedContact = contactInsert.rows[0]!;
        } catch (err: unknown) {
          if (isPgUniqueViolation(err)) {
            await client.query('ROLLBACK');
            const raceExisting = await findExistingContactWithReward(pool, restaurant.id, phoneE164, email);
            if (raceExisting) {
              const body = await handleExistingClaim({
                pool,
                existing: raceExisting,
                suppliedToken: suppliedDeviceToken,
                marketingConsent,
                consentText: restaurant.consent_text,
                now,
              });
              res.status(200).json(body);
              return;
            }
          }
          throw err;
        }

        const expiresAt =
          restaurant.reward_expiry_days !== null
            ? new Date(now.getTime() + restaurant.reward_expiry_days * 86_400_000)
            : null;

        const deviceToken = randomBytes(32).toString('base64url');
        const deviceTokenHash = hashDeviceToken(deviceToken);

        let insertedReward: RewardRow | null = null;
        for (let attempt = 0; attempt < 8; attempt++) {
          const code = generateRewardCode();
          try {
            const rewardInsert = await client.query<RewardRow>(
              `INSERT INTO rewards (restaurant_id, contact_id, code, title, expires_at, device_token_hash)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id, code, title, expires_at, redeemed_at, created_at`,
              [restaurant.id, insertedContact.id, code, restaurant.reward_title, expiresAt, deviceTokenHash]
            );
            insertedReward = rewardInsert.rows[0]!;
            break;
          } catch (err: unknown) {
            if (isPgUniqueViolation(err)) {
              continue;
            }
            throw err;
          }
        }

        if (!insertedReward) {
          throw new Error('Failed to generate unique reward code after retries');
        }

        await client.query('COMMIT');

        const body: PublicSignupResponse = {
          isExisting: false,
          alreadyClaimed: false,
          firstName: firstNameOf(insertedContact.name),
          deviceToken,
          reward: mapRewardSummary(insertedReward, now),
        };
        res.status(201).json(body);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      next(err);
    }
  });

  router.get('/claims/:deviceToken', limiters.publicRewardStatus, async (req, res, next) => {
    try {
      const rawToken = req.params.deviceToken;
      const token = typeof rawToken === 'string' ? rawToken.trim() : '';
      if (!token || token.length < 16 || token.length > 128) {
        throw new AppError(404, 'NOT_FOUND', 'Claim not found');
      }

      const tokenHash = hashDeviceToken(token);
      const result = await pool.query<{
        redeemed_at: Date | null;
        expires_at: Date | null;
      }>(
        `SELECT redeemed_at, expires_at
         FROM rewards
         WHERE device_token_hash = $1`,
        [tokenHash]
      );
      const row = result.rows[0];
      if (!row) {
        throw new AppError(404, 'NOT_FOUND', 'Claim not found');
      }

      const now = clock();
      const body: PublicClaimStatusResponse = {
        status: computeRewardStatus(row.redeemed_at, row.expires_at, now),
        redeemedAt: toIsoOrNull(row.redeemed_at),
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

async function findExistingContactWithReward(
  pool: Pool,
  restaurantId: string,
  phoneE164: string,
  email: string | null
): Promise<{ contact: ContactRow; reward: RewardWithHashRow } | null> {
  const res = await pool.query<
    ContactRow & {
      r_id: string;
      r_code: string;
      r_title: string;
      r_expires_at: Date | null;
      r_redeemed_at: Date | null;
      r_created_at: Date;
      r_device_token_hash: string | null;
    }
  >(
    `SELECT c.id, c.name, c.phone_e164, c.email, c.birth_month, c.birth_day, c.birth_year,
            c.marketing_consent, c.consented_at, c.consent_text, c.created_at,
            r.id AS r_id, r.code AS r_code, r.title AS r_title,
            r.expires_at AS r_expires_at, r.redeemed_at AS r_redeemed_at, r.created_at AS r_created_at,
            r.device_token_hash AS r_device_token_hash
     FROM contacts c
     JOIN rewards r ON r.contact_id = c.id
     WHERE c.restaurant_id = $1
       AND (c.phone_e164 = $2 OR ($3::text IS NOT NULL AND LOWER(c.email) = $3))
     ORDER BY (c.phone_e164 = $2) DESC
     LIMIT 1`,
    [restaurantId, phoneE164, email]
  );

  const row = res.rows[0];
  if (!row) return null;

  return {
    contact: {
      id: row.id,
      name: row.name,
      phone_e164: row.phone_e164,
      email: row.email,
      birth_month: row.birth_month,
      birth_day: row.birth_day,
      birth_year: row.birth_year,
      marketing_consent: row.marketing_consent,
      consented_at: row.consented_at,
      consent_text: row.consent_text,
      created_at: row.created_at,
    },
    reward: {
      id: row.r_id,
      code: row.r_code,
      title: row.r_title,
      expires_at: row.r_expires_at,
      redeemed_at: row.r_redeemed_at,
      created_at: row.r_created_at,
      device_token_hash: row.r_device_token_hash,
    },
  };
}

async function maybeUpgradeConsent(
  pool: Pool,
  contact: ContactRow,
  marketingConsent: boolean,
  consentText: string,
  now: Date
): Promise<ContactRow> {
  if (!marketingConsent || contact.marketing_consent) {
    return contact;
  }

  const updated = await pool.query<ContactRow>(
    `UPDATE contacts
     SET marketing_consent = true,
         consented_at = $2,
         consent_text = $3,
         updated_at = $2
     WHERE id = $1
     RETURNING id, name, phone_e164, email, birth_month, birth_day, birth_year,
               marketing_consent, consented_at, consent_text, created_at`,
    [contact.id, now, consentText]
  );
  return updated.rows[0] ?? contact;
}

function isPgUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '23505';
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}
