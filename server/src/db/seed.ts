import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import '../config.js';
import { getWeekRangeInTimezone } from '../utils/birthday.js';
import { generateRewardCode } from '../utils/rewardCode.js';

export async function runSeed(databaseUrl: string, seedStaffPassword: string): Promise<void> {
  if (!seedStaffPassword || seedStaffPassword.length < 6) {
    throw new Error('SEED_STAFF_PASSWORD must be set in .env (see .env.example).');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('BEGIN');

    const bistroConsentText =
      'Send me offers from [PH] Demo Bistro by message or email. I can stop anytime.';
    const pizzeriaConsentText =
      'Send me offers from [PH] Demo Pizzeria by message or email. I can stop anytime.';

    // Omit reward_expiry_days on insert so DB DEFAULT 30 [PH] applies
    const bistroRes = await client.query<{ id: string }>(
      `INSERT INTO restaurants (
         slug, name, tagline, reward_title, reward_description, brand_color,
         consent_text, timezone, offer_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Europe/Tirane', true)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         tagline = EXCLUDED.tagline,
         reward_title = EXCLUDED.reward_title,
         reward_description = EXCLUDED.reward_description,
         brand_color = EXCLUDED.brand_color,
         consent_text = EXCLUDED.consent_text
       RETURNING id`,
      [
        'demo-bistro',
        '[PH] Demo Bistro',
        'Warm wood-fired plates & fresh seasonal starters',
        'Free House Appetizer',
        'Show this code to your waiter for a complimentary appetizer.',
        '#B83A22',
        bistroConsentText,
      ]
    );
    const bistroId = bistroRes.rows[0]!.id;

    const pizzeriaRes = await client.query<{ id: string }>(
      `INSERT INTO restaurants (
         slug, name, tagline, reward_title, reward_description, brand_color,
         consent_text, timezone, offer_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Europe/Tirane', true)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         tagline = EXCLUDED.tagline,
         reward_title = EXCLUDED.reward_title,
         reward_description = EXCLUDED.reward_description,
         brand_color = EXCLUDED.brand_color,
         consent_text = EXCLUDED.consent_text
       RETURNING id`,
      [
        'demo-pizzeria',
        '[PH] Demo Pizzeria',
        'Neapolitan sourdough pies baked to order',
        'Free Garlic Bruschetta',
        'Show this code to your waiter for a complimentary garlic bruschetta.',
        '#1E7A46',
        pizzeriaConsentText,
      ]
    );
    const pizzeriaId = pizzeriaRes.rows[0]!.id;

    const passwordHash = await bcrypt.hash(seedStaffPassword, 10);

    const staffSeeds = [
      { restaurantId: bistroId, email: 'owner@demo-bistro.local', name: 'Ardian Owner', role: 'owner' },
      { restaurantId: bistroId, email: 'staff@demo-bistro.local', name: 'Besa Waiter', role: 'staff' },
      { restaurantId: pizzeriaId, email: 'owner@demo-pizzeria.local', name: 'Dritan Owner', role: 'owner' },
      { restaurantId: pizzeriaId, email: 'staff@demo-pizzeria.local', name: 'Lira Waiter', role: 'staff' },
    ];

    const staffIds = new Map<string, string>();
    for (const s of staffSeeds) {
      const res = await client.query<{ id: string }>(
        `INSERT INTO staff_users (restaurant_id, email, name, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET
           restaurant_id = EXCLUDED.restaurant_id,
           name = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role
         RETURNING id`,
        [s.restaurantId, s.email, s.name, passwordHash, s.role]
      );
      staffIds.set(s.email, res.rows[0]!.id);
    }

    const now = new Date();
    const week = getWeekRangeInTimezone(now, 'Europe/Tirane');
    const bdayThisWeek = week.days[2]!;
    const bistroWaiterId = staffIds.get('staff@demo-bistro.local')!;
    const bistroOwnerId = staffIds.get('owner@demo-bistro.local')!;

    async function ensureContactWithReward(opts: {
      restaurantId: string;
      name: string;
      phoneE164: string;
      email: string | null;
      birthMonth: number | null;
      birthDay: number | null;
      birthYear: number | null;
      marketingConsent: boolean;
      consentText: string;
      rewardTitle: string;
      expiresAt: Date | null;
      redeemedAt: Date | null;
      redeemedBy: string | null;
    }) {
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM contacts WHERE restaurant_id = $1 AND phone_e164 = $2`,
        [opts.restaurantId, opts.phoneE164]
      );
      if (existing.rows.length > 0) return;

      const cRes = await client.query<{ id: string }>(
        `INSERT INTO contacts (
           restaurant_id, name, phone_e164, email,
           birth_month, birth_day, birth_year,
           marketing_consent, consented_at, consent_text
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          opts.restaurantId,
          opts.name,
          opts.phoneE164,
          opts.email,
          opts.birthMonth,
          opts.birthDay,
          opts.birthYear,
          opts.marketingConsent,
          opts.marketingConsent ? now : null,
          opts.marketingConsent ? opts.consentText : null,
        ]
      );
      const contactId = cRes.rows[0]!.id;

      const tokenHash = createHash('sha256')
        .update(randomBytes(32).toString('base64url'), 'utf8')
        .digest('hex');

      const rRes = await client.query<{ id: string }>(
        `INSERT INTO rewards (restaurant_id, contact_id, code, title, expires_at, redeemed_at, redeemed_by, device_token_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          opts.restaurantId,
          contactId,
          generateRewardCode(),
          opts.rewardTitle,
          opts.expiresAt,
          opts.redeemedAt,
          opts.redeemedBy,
          tokenHash,
        ]
      );

      if (opts.redeemedAt && opts.redeemedBy) {
        await client.query(
          `INSERT INTO reward_audit_logs (restaurant_id, reward_id, action, actor_staff_id, actor_name)
           VALUES ($1, $2, 'redeem', $3, 'Besa Waiter')`,
          [opts.restaurantId, rRes.rows[0]!.id, opts.redeemedBy]
        );
      }
    }

    const thirtyDaysLater = new Date(now.getTime() + 30 * 86_400_000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000);

    await ensureContactWithReward({
      restaurantId: bistroId,
      name: 'Elena Kola',
      phoneE164: '+355691001001',
      email: 'elena.kola@example.com',
      birthMonth: bdayThisWeek.month,
      birthDay: bdayThisWeek.day,
      birthYear: 1995,
      marketingConsent: true,
      consentText: bistroConsentText,
      rewardTitle: 'Free House Appetizer',
      expiresAt: thirtyDaysLater,
      redeemedAt: null,
      redeemedBy: null,
    });

    await ensureContactWithReward({
      restaurantId: bistroId,
      name: 'Marko Dervishi',
      phoneE164: '+355691001002',
      email: 'marko.dervishi@example.com',
      birthMonth: (bdayThisWeek.month % 12) + 1,
      birthDay: 15,
      birthYear: 1991,
      marketingConsent: true,
      consentText: bistroConsentText,
      rewardTitle: 'Free House Appetizer',
      expiresAt: thirtyDaysLater,
      redeemedAt: null,
      redeemedBy: null,
    });

    await ensureContactWithReward({
      restaurantId: bistroId,
      name: 'Era Berisha',
      phoneE164: '+355691001003',
      email: 'era.berisha@example.com',
      birthMonth: null,
      birthDay: null,
      birthYear: null,
      marketingConsent: true,
      consentText: bistroConsentText,
      rewardTitle: 'Free House Appetizer',
      expiresAt: thirtyDaysLater,
      redeemedAt: new Date(now.getTime() - 3600_000),
      redeemedBy: bistroWaiterId,
    });

    await ensureContactWithReward({
      restaurantId: bistroId,
      name: 'Noel Shehu',
      phoneE164: '+355691001004',
      email: 'noel.shehu@example.com',
      birthMonth: bdayThisWeek.month,
      birthDay: bdayThisWeek.day,
      birthYear: 1998,
      marketingConsent: false,
      consentText: bistroConsentText,
      rewardTitle: 'Free House Appetizer',
      expiresAt: thirtyDaysLater,
      redeemedAt: null,
      redeemedBy: null,
    });

    await ensureContactWithReward({
      restaurantId: bistroId,
      name: 'Genti Leka',
      phoneE164: '+355691001005',
      email: 'genti.leka@example.com',
      birthMonth: null,
      birthDay: null,
      birthYear: null,
      marketingConsent: true,
      consentText: bistroConsentText,
      rewardTitle: 'Free House Appetizer',
      expiresAt: twoDaysAgo,
      redeemedAt: null,
      redeemedBy: null,
    });

    await ensureContactWithReward({
      restaurantId: pizzeriaId,
      name: 'Suela Meta',
      phoneE164: '+355692002001',
      email: 'suela.meta@example.com',
      birthMonth: bdayThisWeek.month,
      birthDay: bdayThisWeek.day,
      birthYear: 1993,
      marketingConsent: true,
      consentText: pizzeriaConsentText,
      rewardTitle: 'Free Garlic Bruschetta',
      expiresAt: thirtyDaysLater,
      redeemedAt: null,
      redeemedBy: null,
    });

    const existingCampaign = await client.query<{ id: string }>(
      `SELECT id FROM campaigns WHERE restaurant_id = $1 LIMIT 1`,
      [bistroId]
    );
    if (existingCampaign.rows.length === 0) {
      await client.query(
        `INSERT INTO campaigns (restaurant_id, title, message, audience_type, status, created_by)
         VALUES ($1, $2, $3, 'all_consented', 'draft', $4)`,
        [
          bistroId,
          'Monday 4pm Buy One Get One',
          'Hi {first name}! Stop by [PH] Demo Bistro this Monday at 4pm for buy-one-get-one starters.',
          bistroOwnerId,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const databaseUrl = process.env.DATABASE_URL;
  const seedPassword = process.env.SEED_STAFF_PASSWORD;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }
  if (!seedPassword) {
    console.error('SEED_STAFF_PASSWORD is required in .env (see .env.example).');
    process.exit(1);
  }
  runSeed(databaseUrl, seedPassword)
    .then(() => {
      console.info('Database seed complete.');
    })
    .catch((err) => {
      console.error('Database seed failed:', err);
      process.exit(1);
    });
}
