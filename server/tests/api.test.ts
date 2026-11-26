import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import '../src/config.js';
import { createPool } from '../src/db/pool.js';
import { runReset } from '../src/db/reset.js';
import { createApp } from '../src/app.js';
import type { MessageProvider } from '../src/providers/messageProvider.js';

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://loyalty:loyalty_dev_password@localhost:5432/restaurant_loyalty_test';
const JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long';
const SEED_PASSWORD = process.env.SEED_STAFF_PASSWORD || 'dev-staff-password-change-me';

let pool: Pool;
let app: ReturnType<typeof createApp>;
let spyProvider: MessageProvider;
let sentPayloads: Array<{ campaignId: string; recipientCount: number; phones: string[] }>;

// Fixed clock: Thursday 2026-11-26 12:00 UTC (Mon Nov 23 .. Sun Nov 29 in Europe/Tirane)
const fixedNow = new Date('2026-11-26T12:00:00Z');

async function loginAs(email: string, password = SEED_PASSWORD): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

describe('Restaurant QR Loyalty API', () => {
  beforeAll(async () => {
    pool = createPool(TEST_DB_URL);
  });

  beforeEach(async () => {
    await runReset(TEST_DB_URL, SEED_PASSWORD);
    sentPayloads = [];
    spyProvider = {
      name: 'log-only',
      async sendCampaign(input) {
        sentPayloads.push({
          campaignId: input.campaignId,
          recipientCount: input.recipients.length,
          phones: input.recipients.map((r) => r.phoneE164),
        });
        return {
          status: 'sending_not_connected',
          code: 'SENDING_NOT_CONNECTED',
          message: 'sending not connected yet',
          provider: 'log-only',
          recipientCount: input.recipients.length,
          loggedAt: input.now.toISOString(),
        };
      },
    };
    app = createApp({
      pool,
      jwtSecret: JWT_SECRET,
      messageProvider: spyProvider,
      clock: () => fixedNow,
      disableRateLimit: true,
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('sets X-Robots-Tag: noindex on all API responses and defaults reward_expiry_days to 30', async () => {
    const okRes = await request(app).get('/api/health');
    expect(okRes.status).toBe(200);
    expect(okRes.headers['x-robots-tag']).toBe('noindex');

    const restRes = await request(app).get('/api/public/restaurants/demo-bistro');
    expect(restRes.status).toBe(200);
    expect(restRes.body.restaurant.rewardExpiryDays).toBe(30);

    const unauthRes = await request(app).get('/api/contacts');
    expect(unauthRes.status).toBe(401);
    expect(unauthRes.headers['x-robots-tag']).toBe('noindex');

    const notFoundRes = await request(app).get('/api/public/restaurants/non-existent');
    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.headers['x-robots-tag']).toBe('noindex');
  });

  it('requires valid staff JWT on all protected endpoints (401 without or with bad token)', async () => {
    const protectedCalls = [
      () => request(app).get('/api/auth/me'),
      () => request(app).get('/api/contacts'),
      () => request(app).get('/api/contacts/export.csv'),
      () => request(app).get('/api/rewards/ABC234'),
      () => request(app).post('/api/rewards/ABC234/redeem'),
      () => request(app).post('/api/rewards/ABC234/undo-redeem'),
      () => request(app).get('/api/qr'),
      () => request(app).patch('/api/restaurant/settings').send({ name: 'X' }),
      () => request(app).get('/api/campaigns'),
      () => request(app).get('/api/campaigns/audience-counts'),
      () => request(app).post('/api/campaigns').send({ title: 'T', message: 'M', audienceType: 'all_consented' }),
    ];

    for (const call of protectedCalls) {
      const noAuth = await call();
      expect(noAuth.status).toBe(401);
      expect(noAuth.body.error.code).toBe('UNAUTHORIZED');
    }

    const badJwt = await request(app)
      .get('/api/contacts')
      .set('Authorization', 'Bearer invalid.jwt.token');
    expect(badJwt.status).toBe(401);
    expect(badJwt.body.error.code).toBe('UNAUTHORIZED');
  });

  it('validates signup, stores sha256 deviceToken hash only, defaults consent false, and upgrades consent on repeat', async () => {
    const bad = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({ name: '', phone: '123' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');

    // Omitting marketingConsent -> false, consentedAt null, returns deviceToken once
    const noConsent = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({ name: 'Sara Kola', phone: '0695550001' });
    expect(noConsent.status).toBe(201);
    expect(noConsent.body.isExisting).toBe(false);
    expect(noConsent.body.alreadyClaimed).toBe(false);
    expect(noConsent.body.firstName).toBe('Sara');
    expect(typeof noConsent.body.deviceToken).toBe('string');
    expect(noConsent.body.deviceToken.length).toBeGreaterThanOrEqual(32);
    expect(Object.keys(noConsent.body).sort()).toEqual([
      'alreadyClaimed',
      'deviceToken',
      'firstName',
      'isExisting',
      'reward',
    ]);
    expect(noConsent.body.reward.code).toHaveLength(6);

    const tokenHash = createHash('sha256').update(noConsent.body.deviceToken, 'utf8').digest('hex');
    const dbCheck = await pool.query<{
      marketing_consent: boolean;
      consented_at: Date | null;
      device_token_hash: string | null;
    }>(
      `SELECT c.marketing_consent, c.consented_at, r.device_token_hash
       FROM contacts c JOIN rewards r ON r.contact_id = c.id
       WHERE c.phone_e164 = '+355695550001'`
    );
    expect(dbCheck.rows[0]?.marketing_consent).toBe(false);
    expect(dbCheck.rows[0]?.consented_at).toBeNull();
    expect(dbCheck.rows[0]?.device_token_hash).toBe(tokenHash);
    expect(dbCheck.rows[0]?.device_token_hash).not.toBe(noConsent.body.deviceToken);

    // Repeat by phone (no token) with marketingConsent: true -> MUST NOT upgrade consent
    const phoneAttack = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({ name: 'Attacker', phone: '+355695550001', email: 'sara@example.com', marketingConsent: true });
    expect(phoneAttack.status).toBe(200);
    expect(phoneAttack.body.alreadyClaimed).toBe(true);

    // Repeat with wrong token and marketingConsent: true -> MUST NOT upgrade consent
    const wrongTokenAttack = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({ name: 'Attacker', phone: '0695550001', marketingConsent: true, deviceToken: 'wrong-token-123456' });
    expect(wrongTokenAttack.status).toBe(200);
    expect(wrongTokenAttack.body.alreadyClaimed).toBe(true);

    const afterAttack = await pool.query<{ marketing_consent: boolean; consented_at: Date | null }>(
      `SELECT marketing_consent, consented_at FROM contacts WHERE phone_e164 = '+355695550001'`
    );
    expect(afterAttack.rows[0]?.marketing_consent).toBe(false);
    expect(afterAttack.rows[0]?.consented_at).toBeNull();

    // Repeat with matching deviceToken and marketingConsent: true -> upgrades consent with timestamp + text
    const rightTokenUpgrade = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({
        name: 'Sara Kola',
        phone: '0695550001',
        marketingConsent: true,
        deviceToken: noConsent.body.deviceToken,
      });
    expect(rightTokenUpgrade.status).toBe(200);
    expect(rightTokenUpgrade.body.alreadyClaimed).toBe(false);
    const afterUpgrade = await pool.query<{ marketing_consent: boolean; consented_at: Date | null; consent_text: string | null }>(
      `SELECT marketing_consent, consented_at, consent_text FROM contacts WHERE phone_e164 = '+355695550001'`
    );
    expect(afterUpgrade.rows[0]?.marketing_consent).toBe(true);
    expect(afterUpgrade.rows[0]?.consented_at).toBeTruthy();
    expect(afterUpgrade.rows[0]?.consent_text).toContain('[PH] Demo Bistro');

    // Also test email-match without token with marketingConsent: true does NOT upgrade consent
    const emailClaimNoConsent = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({ name: 'Ema', phone: '0695550003', email: 'ema@example.com', marketingConsent: false });
    expect(emailClaimNoConsent.status).toBe(201);
    const emailAttack = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({ name: 'Attacker', phone: '0695550004', email: 'EMA@example.com', marketingConsent: true });
    expect(emailAttack.status).toBe(200);
    expect(emailAttack.body.alreadyClaimed).toBe(true);
    const emaRow = await pool.query<{ marketing_consent: boolean; consented_at: Date | null }>(
      `SELECT marketing_consent, consented_at FROM contacts WHERE phone_e164 = '+355695550003'`
    );
    expect(emaRow.rows[0]?.marketing_consent).toBe(false);
    expect(emaRow.rows[0]?.consented_at).toBeNull();

    // Explicit marketingConsent: true on signup -> consentedAt & consent_text saved
    const withConsent = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({
        name: 'Luan',
        phone: '0695550002',
        email: 'LUAN@Example.com',
        birthday: '1992-11-28',
        marketingConsent: true,
      });
    expect(withConsent.status).toBe(201);
    expect(withConsent.body.firstName).toBe('Luan');
    const dbRow = await pool.query<{ consent_text: string | null; email: string; marketing_consent: boolean; consented_at: Date | null }>(
      `SELECT consent_text, email, marketing_consent, consented_at FROM contacts WHERE phone_e164 = '+355695550002'`
    );
    expect(dbRow.rows[0]?.email).toBe('luan@example.com');
    expect(dbRow.rows[0]?.marketing_consent).toBe(true);
    expect(dbRow.rows[0]?.consented_at).toBeTruthy();
    expect(dbRow.rows[0]?.consent_text).toContain('[PH] Demo Bistro');
  });

  it('handles anti-leak deviceToken matching, phone/email matching, and phone-wins tie-break', async () => {
    const first = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({ name: 'Arben Hoxha', phone: '0697778888', email: 'Arben@Example.com' });
    expect(first.status).toBe(201);
    const originalCode = first.body.reward.code as string;
    const deviceToken = first.body.deviceToken as string;
    const last2 = originalCode.slice(-2);

    // 1. Same device (with deviceToken) + phone format variant -> 200 full code, never overwrites stored email
    const sameDevice = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({
        name: 'Different Name',
        phone: '+355697778888',
        email: 'other@example.com',
        deviceToken,
      });
    expect(sameDevice.status).toBe(200);
    expect(sameDevice.body).toMatchObject({
      isExisting: true,
      alreadyClaimed: false,
      firstName: 'Arben',
      deviceToken,
    });
    expect(sameDevice.body.reward.code).toBe(originalCode);
    const stored = await pool.query<{ email: string; name: string }>(
      `SELECT email, name FROM contacts WHERE phone_e164 = '+355697778888'`
    );
    expect(stored.rows[0]).toEqual({ email: 'arben@example.com', name: 'Arben Hoxha' });

    // 2. Other device by phone (no deviceToken or wrong deviceToken) -> 200 masked response, no PII/full code
    const otherDevicePhone = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({ name: 'Attacker', phone: '00355 69 777 8888', deviceToken: 'wrong-token' });
    expect(otherDevicePhone.status).toBe(200);
    expect(otherDevicePhone.body).toEqual({
      isExisting: true,
      alreadyClaimed: true,
      maskedCode: `••••${last2}`,
      last2,
      status: 'active',
      message: 'Already claimed — ask your waiter',
    });
    expect(JSON.stringify(otherDevicePhone.body)).not.toContain(originalCode);
    expect(JSON.stringify(otherDevicePhone.body)).not.toContain('Arben');

    // 3. Other device by EMAIL with a NEW phone -> masked response and NO second contact/reward created
    const countBefore = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM rewards`);
    const otherDeviceEmail = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({ name: 'Arben 2', phone: '0697779999', email: 'ARBEN@example.com' });
    expect(otherDeviceEmail.status).toBe(200);
    expect(otherDeviceEmail.body).toEqual({
      isExisting: true,
      alreadyClaimed: true,
      maskedCode: `••••${last2}`,
      last2,
      status: 'active',
      message: 'Already claimed — ask your waiter',
    });
    const countAfter = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM rewards`);
    expect(countAfter.rows[0]?.n).toBe(countBefore.rows[0]?.n);

    // 4. Phone match wins over email match if both hit different existing contacts
    const second = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({ name: 'Dona', phone: '0697770000', email: 'dona@example.com' });
    expect(second.status).toBe(201);
    const secondCode = second.body.reward.code as string;

    const tieBreak = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({ name: 'Tie', phone: '0697770000', email: 'arben@example.com' });
    expect(tieBreak.status).toBe(200);
    expect(tieBreak.body.last2).toBe(secondCode.slice(-2));
  });

  it('polls status by deviceToken with exact keys [redeemedAt, status] and removes old code status route', async () => {
    const signup = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({ name: 'Guest', phone: '0694443333', email: 'guest@example.com' });
    const code = signup.body.reward.code as string;
    const deviceToken = signup.body.deviceToken as string;

    // Old route removed
    const oldRoute = await request(app).get(`/api/public/restaurants/demo-bistro/rewards/${code}`);
    expect(oldRoute.status).toBe(404);

    // Unknown token -> 404
    const unknownToken = await request(app).get('/api/public/claims/unknown_device_token_1234567890');
    expect(unknownToken.status).toBe(404);

    const status1 = await request(app).get(`/api/public/claims/${deviceToken}`);
    expect(status1.status).toBe(200);
    expect(Object.keys(status1.body).sort()).toEqual(['redeemedAt', 'status']);
    expect(status1.body.status).toBe('active');
    expect(status1.body.redeemedAt).toBeNull();

    const staffToken = await loginAs('staff@demo-bistro.local');
    const redeemRes = await request(app)
      .post(`/api/rewards/${code}/redeem`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(redeemRes.status).toBe(200);

    const status2 = await request(app).get(`/api/public/claims/${deviceToken}`);
    expect(status2.status).toBe(200);
    expect(Object.keys(status2.body).sort()).toEqual(['redeemedAt', 'status']);
    expect(status2.body.status).toBe('redeemed');
    expect(status2.body.redeemedAt).toBeTruthy();

    // Staff lookup shows redeemedBy staff display name
    const lookup = await request(app)
      .get(`/api/rewards/${code}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(lookup.status).toBe(200);
    expect(lookup.body.reward.redeemedBy).toBe('Besa Waiter');
  });

  it('supports staff Find-by-phone search on GET /api/contacts?q= in any phone format', async () => {
    const staffToken = await loginAs('staff@demo-bistro.local');

    // Seeded contact Elena Kola has +355691001001
    for (const q of ['0691001001', '069 100 1001', '+355691001001', '00355691001001']) {
      const res = await request(app)
        .get(`/api/contacts?q=${encodeURIComponent(q)}`)
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
      expect(res.body.contacts).toHaveLength(1);
      expect(res.body.contacts[0].name).toBe('Elena Kola');
      expect(res.body.contacts[0].reward.code).toHaveLength(6);
      expect(res.body.contacts[0].reward.status).toBe('active');
    }
  });

  it('redeems atomically: sequential double redeem returns 409, and parallel double redeem gives one 200 and one 409', async () => {
    const staffToken = await loginAs('staff@demo-bistro.local');

    const s1 = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({ name: 'Seq Guest', phone: '0691110001' });
    const seqCode = s1.body.reward.code as string;

    const r1 = await request(app)
      .post(`/api/rewards/${seqCode}/redeem`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(r1.status).toBe(200);

    const r2 = await request(app)
      .post(`/api/rewards/${seqCode}/redeem`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(r2.status).toBe(409);
    expect(r2.body.error.code).toBe('ALREADY_REDEEMED');

    const s2 = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({ name: 'Race Guest', phone: '0691110002' });
    const raceCode = s2.body.reward.code as string;

    const [p1, p2] = await Promise.all([
      request(app).post(`/api/rewards/${raceCode}/redeem`).set('Authorization', `Bearer ${staffToken}`),
      request(app).post(`/api/rewards/${raceCode}/redeem`).set('Authorization', `Bearer ${staffToken}`),
    ]);

    const statuses = [p1.status, p2.status].sort();
    expect(statuses).toEqual([200, 409]);
    const conflict = p1.status === 409 ? p1 : p2;
    expect(conflict.body.error.code).toBe('ALREADY_REDEEMED');
  });

  it('enforces owner vs staff roles (staff gets 403 on all owner-only routes) and handles expired rewards', async () => {
    const staffToken = await loginAs('staff@demo-bistro.local');
    const ownerToken = await loginAs('owner@demo-bistro.local');

    // Find seeded expired reward for Genti Leka
    const expiredRes = await request(app)
      .get('/api/contacts?reward=expired')
      .set('Authorization', `Bearer ${staffToken}`);
    const expiredCode = expiredRes.body.contacts[0].reward.code as string;

    const expRedeem = await request(app)
      .post(`/api/rewards/${expiredCode}/redeem`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(expRedeem.status).toBe(409);
    expect(expRedeem.body.error.code).toBe('REWARD_EXPIRED');

    // Find seeded redeemed reward & seeded campaign
    const redeemedRes = await request(app)
      .get('/api/contacts?reward=redeemed')
      .set('Authorization', `Bearer ${staffToken}`);
    const redeemedCode = redeemedRes.body.contacts[0].reward.code as string;

    const campaignsRes = await request(app)
      .get('/api/campaigns')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(campaignsRes.status).toBe(200);
    const campId = campaignsRes.body.campaigns[0].id as string;

    // Staff can access QR, audience-counts, audience-preview
    expect((await request(app).get('/api/qr').set('Authorization', `Bearer ${staffToken}`)).status).toBe(200);
    expect(
      (await request(app).get('/api/campaigns/audience-counts').set('Authorization', `Bearer ${staffToken}`)).status
    ).toBe(200);
    expect(
      (await request(app).get(`/api/campaigns/${campId}/audience-preview`).set('Authorization', `Bearer ${staffToken}`))
        .status
    ).toBe(200);

    // Staff gets 403 FORBIDDEN on ALL 7 owner-only endpoints
    const ownerOnlyAttempts = [
      () => request(app).post(`/api/rewards/${redeemedCode}/undo-redeem`).set('Authorization', `Bearer ${staffToken}`),
      () => request(app).get('/api/contacts/export.csv').set('Authorization', `Bearer ${staffToken}`),
      () =>
        request(app)
          .patch('/api/restaurant/settings')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ tagline: 'Hacked' }),
      () =>
        request(app)
          .post('/api/campaigns')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ title: 'X', message: 'Y', audienceType: 'all_consented' }),
      () =>
        request(app)
          .patch(`/api/campaigns/${campId}`)
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ title: 'X' }),
      () => request(app).delete(`/api/campaigns/${campId}`).set('Authorization', `Bearer ${staffToken}`),
      () => request(app).post(`/api/campaigns/${campId}/send`).set('Authorization', `Bearer ${staffToken}`),
    ];

    for (const attempt of ownerOnlyAttempts) {
      const r = await attempt();
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe('FORBIDDEN');
    }

    // Owner undo-redeem succeeds and logs audit record
    const ownerUndo = await request(app)
      .post(`/api/rewards/${redeemedCode}/undo-redeem`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(ownerUndo.status).toBe(200);
    expect(ownerUndo.body.reward.status).toBe('active');
    expect(ownerUndo.body.reward.redeemedAt).toBeNull();

    const audit = await pool.query<{ action: string; actor_name: string }>(
      `SELECT action, actor_name FROM reward_audit_logs ORDER BY created_at DESC LIMIT 1`
    );
    expect(audit.rows[0]).toEqual({ action: 'undo_redeem', actor_name: 'Ardian Owner' });
  });

  it('enforces strict cross-restaurant isolation with 404 (not 403)', async () => {
    const bistroToken = await loginAs('owner@demo-bistro.local');
    const pizzeriaToken = await loginAs('owner@demo-pizzeria.local');

    const pizzeriaContacts = await request(app)
      .get('/api/contacts')
      .set('Authorization', `Bearer ${pizzeriaToken}`);
    expect(pizzeriaContacts.body.contacts).toHaveLength(1);
    const pizzeriaCode = pizzeriaContacts.body.contacts[0].reward.code as string;
    const pizzeriaPhone = pizzeriaContacts.body.contacts[0].phoneE164 as string;

    const bistroContacts = await request(app)
      .get('/api/contacts')
      .set('Authorization', `Bearer ${bistroToken}`);
    expect(bistroContacts.body.contacts.some((c: { phoneE164: string }) => c.phoneE164 === pizzeriaPhone)).toBe(false);

    const bistroCsv = await request(app)
      .get('/api/contacts/export.csv')
      .set('Authorization', `Bearer ${bistroToken}`);
    expect(bistroCsv.text).not.toContain(pizzeriaPhone);

    expect(
      (await request(app).get(`/api/rewards/${pizzeriaCode}`).set('Authorization', `Bearer ${bistroToken}`)).status
    ).toBe(404);
    expect(
      (await request(app).post(`/api/rewards/${pizzeriaCode}/redeem`).set('Authorization', `Bearer ${bistroToken}`))
        .status
    ).toBe(404);
    expect(
      (await request(app).post(`/api/rewards/${pizzeriaCode}/undo-redeem`).set('Authorization', `Bearer ${bistroToken}`))
        .status
    ).toBe(404);

    const bistroCampaigns = await request(app)
      .get('/api/campaigns')
      .set('Authorization', `Bearer ${bistroToken}`);
    const bistroCampaignId = bistroCampaigns.body.campaigns[0].id as string;

    expect(
      (
        await request(app)
          .get(`/api/campaigns/${bistroCampaignId}/audience-preview`)
          .set('Authorization', `Bearer ${pizzeriaToken}`)
      ).status
    ).toBe(404);
  });

  it('excludes non-consented contacts from campaign audiences & send, and returns sending_not_connected', async () => {
    const ownerToken = await loginAs('owner@demo-bistro.local');

    const countsRes = await request(app)
      .get('/api/campaigns/audience-counts')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(countsRes.status).toBe(200);
    expect(countsRes.body.counts.all_consented).toBe(4);
    expect(countsRes.body.counts.birthdays_this_week).toBe(1);

    const createCamp = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Birthday Treat',
        message: 'Happy birthday {first name}!',
        audienceType: 'birthdays_this_week',
      });
    expect(createCamp.status).toBe(201);
    const campId = createCamp.body.campaign.id as string;

    const preview = await request(app)
      .get(`/api/campaigns/${campId}/audience-preview`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(preview.status).toBe(200);
    expect(preview.body.count).toBe(1);
    expect(preview.body.sample[0].name).toBe('Elena Kola');

    const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const sendRes = await request(app)
      .post(`/api/campaigns/${campId}/send`)
      .set('Authorization', `Bearer ${ownerToken}`);
    logSpy.mockRestore();

    expect(sendRes.status).toBe(200);
    expect(sendRes.body.campaign.status).toBe('sending_not_connected');
    expect(sendRes.body.dispatch).toMatchObject({
      status: 'sending_not_connected',
      code: 'SENDING_NOT_CONNECTED',
      message: 'sending not connected yet',
      provider: 'log-only',
      recipientCount: 1,
    });
    expect(sentPayloads[0]?.phones).toEqual(['+355691001001']);
  });

  it('guards CSV export against formula injection and supports the same filters as contacts list', async () => {
    const ownerToken = await loginAs('owner@demo-bistro.local');

    const evilSignup = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({
        name: '=HYPERLINK("http://evil.example","Click")',
        phone: '0698887777',
        email: 'evil@example.com',
        marketingConsent: true,
      });
    expect(evilSignup.status).toBe(201);

    const csvRes = await request(app)
      .get('/api/contacts/export.csv?consent=consented&q=HYPERLINK')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text).toContain('"\'=HYPERLINK(""http://evil.example"",""Click"")"');
    expect(csvRes.text).toContain('marketing_consent,consented_at');
  });

  it('enforces rate limiting on public signup when enabled', async () => {
    const limitedApp = createApp({
      pool,
      jwtSecret: JWT_SECRET,
      disableRateLimit: false,
    });

    let hit429 = false;
    for (let i = 0; i < 18; i++) {
      const res = await request(limitedApp)
        .post('/api/public/restaurants/demo-bistro/signups')
        .send({ name: 'Tester', phone: `06900010${String(i).padStart(2, '0')}` });
      if (res.status === 429) {
        hit429 = true;
        expect(res.body.error.code).toBe('RATE_LIMITED');
        break;
      }
    }
    expect(hit429).toBe(true);
  });

  it('maps oversized bodies (>16kb) to 413 PAYLOAD_TOO_LARGE and malformed JSON to 400 INVALID_JSON', async () => {
    const bigPayload = JSON.stringify({ name: 'Big', phone: '0691234567', pad: 'x'.repeat(1_100_000) });
    const tooLarge = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .set('Content-Type', 'application/json')
      .send(bigPayload);
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.body.error.code).toBe('PAYLOAD_TOO_LARGE');

    const badJson = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .set('Content-Type', 'application/json')
      .send('{"name": "broken"');
    expect(badJson.status).toBe(400);
    expect(badJson.body.error.code).toBe('INVALID_JSON');
  });

  it('normalizes reward code params by stripping whitespace and dashes and uppercasing across lookup/redeem/undo', async () => {
    const signup = await request(app)
      .post('/api/public/restaurants/demo-bistro/signups')
      .send({ name: 'Code Guest', phone: '0693334444' });
    expect(signup.status).toBe(201);
    const code = signup.body.reward.code as string;
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    const dashedLower = `${code.slice(0, 3).toLowerCase()}-${code.slice(3).toLowerCase()}`;

    const staffToken = await loginAs('staff@demo-bistro.local');
    const ownerToken = await loginAs('owner@demo-bistro.local');

    const lookupRes = await request(app)
      .get(`/api/rewards/${encodeURIComponent(spaced)}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body.reward.code).toBe(code);

    const redeemRes = await request(app)
      .post(`/api/rewards/${encodeURIComponent(dashedLower)}/redeem`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(redeemRes.status).toBe(200);
    expect(redeemRes.body.reward.status).toBe('redeemed');

    const undoRes = await request(app)
      .post(`/api/rewards/${encodeURIComponent(spaced)}/undo-redeem`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(undoRes.status).toBe(200);
    expect(undoRes.body.reward.status).toBe('active');
  });
});
