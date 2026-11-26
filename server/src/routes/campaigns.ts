import { Router, type RequestHandler } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import {
  CreateCampaignRequestSchema,
  UpdateCampaignRequestSchema,
  type AudienceCountsResponse,
  type AudiencePreviewResponse,
  type CampaignResponse,
  type DeleteCampaignResponse,
  type ListCampaignsResponse,
  type SendCampaignResponse,
} from '../schemas.js';
import { requireOwnerRole } from '../middleware/auth.js';
import type { MessageProvider } from '../providers/messageProvider.js';
import { getConsentedAudience } from '../services/audience.js';
import { mapCampaign, type CampaignRow } from '../services/mappers.js';
import { AppError, formatZodDetails } from '../utils/errors.js';

const UuidSchema = z.string().uuid();

function parseUuidOrThrow(raw: unknown): string {
  const parsed = UuidSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(404, 'NOT_FOUND', 'Campaign not found');
  }
  return parsed.data;
}

export function createCampaignsRouter(
  pool: Pool,
  requireStaffAuth: RequestHandler,
  messageProvider: MessageProvider,
  clock: () => Date
): Router {
  const router = Router();
  router.use(requireStaffAuth);

  router.get('/audience-counts', async (req, res, next) => {
    try {
      const restaurantId = req.auth!.restaurantId;
      const restRes = await pool.query<{ timezone: string }>(
        `SELECT timezone FROM restaurants WHERE id = $1`,
        [restaurantId]
      );
      const timeZone = restRes.rows[0]?.timezone ?? 'Europe/Tirane';
      const now = clock();

      const [allConsented, birthdays] = await Promise.all([
        getConsentedAudience(pool, restaurantId, 'all_consented', timeZone, now),
        getConsentedAudience(pool, restaurantId, 'birthdays_this_week', timeZone, now),
      ]);

      const body: AudienceCountsResponse = {
        timezone: timeZone,
        weekRange: birthdays.weekRange,
        counts: {
          all_consented: allConsented.recipients.length,
          birthdays_this_week: birthdays.recipients.length,
        },
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      const result = await pool.query<CampaignRow>(
        `SELECT id, restaurant_id, title, message, audience_type, status, last_attempted_at, created_at, updated_at
         FROM campaigns
         WHERE restaurant_id = $1
         ORDER BY updated_at DESC`,
        [req.auth!.restaurantId]
      );
      const body: ListCampaignsResponse = {
        campaigns: result.rows.map(mapCampaign),
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', requireOwnerRole, async (req, res, next) => {
    try {
      const parsed = CreateCampaignRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid campaign data', formatZodDetails(parsed.error));
      }

      const now = clock();
      const result = await pool.query<CampaignRow>(
        `INSERT INTO campaigns (restaurant_id, title, message, audience_type, status, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         RETURNING id, restaurant_id, title, message, audience_type, status, last_attempted_at, created_at, updated_at`,
        [
          req.auth!.restaurantId,
          parsed.data.title,
          parsed.data.message,
          parsed.data.audienceType,
          parsed.data.status,
          req.auth!.sub,
          now,
        ]
      );

      const body: CampaignResponse = { campaign: mapCampaign(result.rows[0]!) };
      res.status(201).json(body);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', requireOwnerRole, async (req, res, next) => {
    try {
      const id = parseUuidOrThrow(req.params.id);
      const parsed = UpdateCampaignRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid campaign update', formatZodDetails(parsed.error));
      }

      const now = clock();
      const sets: string[] = ['updated_at = $3'];
      const params: unknown[] = [id, req.auth!.restaurantId, now];

      if (parsed.data.title !== undefined) {
        params.push(parsed.data.title);
        sets.push(`title = $${params.length}`);
      }
      if (parsed.data.message !== undefined) {
        params.push(parsed.data.message);
        sets.push(`message = $${params.length}`);
      }
      if (parsed.data.audienceType !== undefined) {
        params.push(parsed.data.audienceType);
        sets.push(`audience_type = $${params.length}`);
      }
      if (parsed.data.status !== undefined) {
        params.push(parsed.data.status);
        sets.push(`status = $${params.length}`);
      }

      const result = await pool.query<CampaignRow>(
        `UPDATE campaigns
         SET ${sets.join(', ')}
         WHERE id = $1 AND restaurant_id = $2
         RETURNING id, restaurant_id, title, message, audience_type, status, last_attempted_at, created_at, updated_at`,
        params
      );

      const row = result.rows[0];
      if (!row) {
        throw new AppError(404, 'NOT_FOUND', 'Campaign not found');
      }

      const body: CampaignResponse = { campaign: mapCampaign(row) };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', requireOwnerRole, async (req, res, next) => {
    try {
      const id = parseUuidOrThrow(req.params.id);
      const result = await pool.query<{ id: string }>(
        `DELETE FROM campaigns WHERE id = $1 AND restaurant_id = $2 RETURNING id`,
        [id, req.auth!.restaurantId]
      );
      if (!result.rows[0]) {
        throw new AppError(404, 'NOT_FOUND', 'Campaign not found');
      }
      const body: DeleteCampaignResponse = { deleted: true, id };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/audience-preview', async (req, res, next) => {
    try {
      const id = parseUuidOrThrow(req.params.id);
      const restaurantId = req.auth!.restaurantId;

      const campRes = await pool.query<CampaignRow & { timezone: string }>(
        `SELECT c.id, c.restaurant_id, c.title, c.message, c.audience_type, c.status,
                c.last_attempted_at, c.created_at, c.updated_at, r.timezone
         FROM campaigns c
         JOIN restaurants r ON r.id = c.restaurant_id
         WHERE c.id = $1 AND c.restaurant_id = $2`,
        [id, restaurantId]
      );
      const campaign = campRes.rows[0];
      if (!campaign) {
        throw new AppError(404, 'NOT_FOUND', 'Campaign not found');
      }

      const now = clock();
      const audience = await getConsentedAudience(
        pool,
        restaurantId,
        campaign.audience_type,
        campaign.timezone,
        now
      );

      const body: AudiencePreviewResponse = {
        campaignId: campaign.id,
        audienceType: campaign.audience_type,
        timezone: campaign.timezone,
        weekRange: audience.weekRange,
        count: audience.recipients.length,
        sample: audience.sample,
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/send', requireOwnerRole, async (req, res, next) => {
    try {
      const id = parseUuidOrThrow(req.params.id);
      const restaurantId = req.auth!.restaurantId;

      const campRes = await pool.query<CampaignRow & { restaurant_name: string; timezone: string }>(
        `SELECT c.id, c.restaurant_id, c.title, c.message, c.audience_type, c.status,
                c.last_attempted_at, c.created_at, c.updated_at,
                r.name AS restaurant_name, r.timezone
         FROM campaigns c
         JOIN restaurants r ON r.id = c.restaurant_id
         WHERE c.id = $1 AND c.restaurant_id = $2`,
        [id, restaurantId]
      );
      const campaign = campRes.rows[0];
      if (!campaign) {
        throw new AppError(404, 'NOT_FOUND', 'Campaign not found');
      }

      const now = clock();
      const audience = await getConsentedAudience(
        pool,
        restaurantId,
        campaign.audience_type,
        campaign.timezone,
        now
      );

      const dispatch = await messageProvider.sendCampaign({
        restaurantId,
        restaurantName: campaign.restaurant_name,
        campaignId: campaign.id,
        title: campaign.title,
        message: campaign.message,
        recipients: audience.recipients.map((r) => ({
          contactId: r.id,
          name: r.name,
          phoneE164: r.phone_e164,
        })),
        now,
      });

      const updated = await pool.query<CampaignRow>(
        `UPDATE campaigns
         SET status = 'sending_not_connected',
             last_attempted_at = $3,
             updated_at = $3
         WHERE id = $1 AND restaurant_id = $2
         RETURNING id, restaurant_id, title, message, audience_type, status, last_attempted_at, created_at, updated_at`,
        [id, restaurantId, now]
      );

      const body: SendCampaignResponse = {
        campaign: mapCampaign(updated.rows[0]!),
        dispatch,
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
