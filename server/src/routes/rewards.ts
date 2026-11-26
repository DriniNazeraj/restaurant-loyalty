import { Router, type RequestHandler } from 'express';
import type { Pool } from 'pg';
import { RewardCodeParamSchema, type StaffRewardResponse } from '../schemas.js';
import { requireOwnerRole } from '../middleware/auth.js';
import type { RateLimiters } from '../middleware/rateLimit.js';
import { AppError, formatZodDetails } from '../utils/errors.js';
import { mapStaffRewardDetail } from '../services/mappers.js';

interface RewardJoinedRow {
  id: string;
  code: string;
  title: string;
  expires_at: Date | null;
  redeemed_at: Date | null;
  created_at: Date;
  redeemed_by_name: string | null;
  c_id: string;
  c_name: string;
  c_phone_e164: string;
  c_email: string | null;
}

export function createRewardsRouter(
  pool: Pool,
  requireStaffAuth: RequestHandler,
  limiters: RateLimiters,
  clock: () => Date
): Router {
  const router = Router();
  router.use(requireStaffAuth);

  router.get('/:code', limiters.rewardLookup, async (req, res, next) => {
    try {
      const codeParsed = RewardCodeParamSchema.safeParse({ code: req.params.code });
      if (!codeParsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid reward code format', formatZodDetails(codeParsed.error));
      }

      const now = clock();
      const result = await pool.query<RewardJoinedRow>(
        `SELECT r.id, r.code, r.title, r.expires_at, r.redeemed_at, r.created_at,
                s.name AS redeemed_by_name,
                c.id AS c_id, c.name AS c_name, c.phone_e164 AS c_phone_e164, c.email AS c_email
         FROM rewards r
         JOIN contacts c ON c.id = r.contact_id
         LEFT JOIN staff_users s ON s.id = r.redeemed_by
         WHERE r.code = $1 AND r.restaurant_id = $2`,
        [codeParsed.data.code, req.auth!.restaurantId]
      );

      const row = result.rows[0];
      if (!row) {
        throw new AppError(404, 'NOT_FOUND', 'No reward with that code');
      }

      const body: StaffRewardResponse = {
        reward: mapStaffRewardDetail(row, now),
        contact: {
          id: row.c_id,
          name: row.c_name,
          phoneE164: row.c_phone_e164,
          email: row.c_email,
        },
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  router.post('/:code/redeem', limiters.rewardRedeem, async (req, res, next) => {
    try {
      const codeParsed = RewardCodeParamSchema.safeParse({ code: req.params.code });
      if (!codeParsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid reward code format', formatZodDetails(codeParsed.error));
      }

      const code = codeParsed.data.code;
      const restaurantId = req.auth!.restaurantId;
      const staffId = req.auth!.sub;
      const staffName = req.auth!.name;

      // Atomic conditional single-statement redeem
      const updated = await pool.query<{
        id: string;
        contact_id: string;
        code: string;
        title: string;
        expires_at: Date | null;
        redeemed_at: Date;
        created_at: Date;
      }>(
        `UPDATE rewards
         SET redeemed_at = now(),
             redeemed_by = $3
         WHERE code = $1
           AND restaurant_id = $2
           AND redeemed_at IS NULL
           AND (expires_at IS NULL OR expires_at > now())
         RETURNING id, contact_id, code, title, expires_at, redeemed_at, created_at`,
        [code, restaurantId, staffId]
      );

      const row = updated.rows[0];
      if (!row) {
        const existing = await pool.query<{
          id: string;
          redeemed_at: Date | null;
          expires_at: Date | null;
          redeemed_by_name: string | null;
        }>(
          `SELECT r.id, r.redeemed_at, r.expires_at, s.name AS redeemed_by_name
           FROM rewards r
           LEFT JOIN staff_users s ON s.id = r.redeemed_by
           WHERE r.code = $1 AND r.restaurant_id = $2`,
          [code, restaurantId]
        );
        const found = existing.rows[0];
        if (!found) {
          throw new AppError(404, 'NOT_FOUND', 'No reward with that code');
        }
        if (found.redeemed_at) {
          throw new AppError(409, 'ALREADY_REDEEMED', 'Reward has already been redeemed', {
            redeemedAt: found.redeemed_at.toISOString(),
            redeemedBy: found.redeemed_by_name,
          });
        }
        throw new AppError(409, 'REWARD_EXPIRED', 'Reward has expired', {
          expiresAt: found.expires_at ? found.expires_at.toISOString() : null,
        });
      }

      await pool.query(
        `INSERT INTO reward_audit_logs (restaurant_id, reward_id, action, actor_staff_id, actor_name)
         VALUES ($1, $2, 'redeem', $3, $4)`,
        [restaurantId, row.id, staffId, staffName]
      );

      const contactRes = await pool.query<{
        id: string;
        name: string;
        phone_e164: string;
        email: string | null;
      }>(`SELECT id, name, phone_e164, email FROM contacts WHERE id = $1`, [row.contact_id]);
      const contact = contactRes.rows[0]!;

      const body: StaffRewardResponse = {
        reward: mapStaffRewardDetail(
          {
            ...row,
            redeemed_by_name: staffName,
          },
          clock()
        ),
        contact: {
          id: contact.id,
          name: contact.name,
          phoneE164: contact.phone_e164,
          email: contact.email,
        },
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  router.post('/:code/undo-redeem', requireOwnerRole, async (req, res, next) => {
    try {
      const codeParsed = RewardCodeParamSchema.safeParse({ code: req.params.code });
      if (!codeParsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid reward code format', formatZodDetails(codeParsed.error));
      }

      const code = codeParsed.data.code;
      const restaurantId = req.auth!.restaurantId;
      const actorId = req.auth!.sub;
      const actorName = req.auth!.name;
      const now = clock();

      const updated = await pool.query<{
        id: string;
        contact_id: string;
        code: string;
        title: string;
        expires_at: Date | null;
        redeemed_at: Date | null;
        created_at: Date;
      }>(
        `UPDATE rewards
         SET redeemed_at = NULL,
             redeemed_by = NULL
         WHERE code = $1
           AND restaurant_id = $2
           AND redeemed_at IS NOT NULL
         RETURNING id, contact_id, code, title, expires_at, redeemed_at, created_at`,
        [code, restaurantId]
      );

      const row = updated.rows[0];
      if (!row) {
        const existing = await pool.query<{ id: string }>(
          `SELECT id FROM rewards WHERE code = $1 AND restaurant_id = $2`,
          [code, restaurantId]
        );
        if (!existing.rows[0]) {
          throw new AppError(404, 'NOT_FOUND', 'No reward with that code');
        }
        throw new AppError(409, 'NOT_REDEEMED', 'Reward is not currently redeemed');
      }

      await pool.query(
        `INSERT INTO reward_audit_logs (restaurant_id, reward_id, action, actor_staff_id, actor_name)
         VALUES ($1, $2, 'undo_redeem', $3, $4)`,
        [restaurantId, row.id, actorId, actorName]
      );

      console.info(
        JSON.stringify({
          event: 'reward.undo_redeem',
          restaurantId,
          rewardId: row.id,
          code: row.code,
          actorStaffId: actorId,
          actorName,
          at: now.toISOString(),
        })
      );

      const contactRes = await pool.query<{
        id: string;
        name: string;
        phone_e164: string;
        email: string | null;
      }>(`SELECT id, name, phone_e164, email FROM contacts WHERE id = $1`, [row.contact_id]);
      const contact = contactRes.rows[0]!;

      const body: StaffRewardResponse = {
        reward: mapStaffRewardDetail({ ...row, redeemed_by_name: null }, now),
        contact: {
          id: contact.id,
          name: contact.name,
          phoneE164: contact.phone_e164,
          email: contact.email,
        },
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
