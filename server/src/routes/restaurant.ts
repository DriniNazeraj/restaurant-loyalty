import { Router, type RequestHandler } from 'express';
import type { Pool } from 'pg';
import {
  UpdateRestaurantSettingsRequestSchema,
  type UpdateRestaurantSettingsResponse,
} from '../schemas.js';
import { requireOwnerRole } from '../middleware/auth.js';
import { AppError, formatZodDetails } from '../utils/errors.js';
import { mapStaffRestaurant, type RestaurantRow } from '../services/mappers.js';

export function createRestaurantRouter(pool: Pool, requireStaffAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireStaffAuth);

  router.patch('/settings', requireOwnerRole, async (req, res, next) => {
    try {
      const parsed = UpdateRestaurantSettingsRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid settings update', formatZodDetails(parsed.error));
      }

      const d = parsed.data;
      const sets: string[] = [];
      const params: unknown[] = [req.auth!.restaurantId];

      const addSet = (col: string, val: unknown) => {
        params.push(val);
        sets.push(`${col} = $${params.length}`);
      };

      if (d.name !== undefined) addSet('name', d.name);
      if (d.tagline !== undefined) addSet('tagline', d.tagline);
      if (d.rewardTitle !== undefined) addSet('reward_title', d.rewardTitle);
      if (d.rewardDescription !== undefined) addSet('reward_description', d.rewardDescription);
      if (d.brandColor !== undefined) addSet('brand_color', d.brandColor);
      if (d.consentText !== undefined) addSet('consent_text', d.consentText);
      if (d.offerActive !== undefined) addSet('offer_active', d.offerActive);
      if (d.rewardExpiryDays !== undefined) addSet('reward_expiry_days', d.rewardExpiryDays);

      const result = await pool.query<RestaurantRow>(
        `UPDATE restaurants
         SET ${sets.join(', ')}
         WHERE id = $1
         RETURNING id, slug, name, tagline, reward_title, reward_description, brand_color,
                   consent_text, timezone, reward_expiry_days, offer_active`,
        params
      );

      const row = result.rows[0];
      if (!row) {
        throw new AppError(404, 'NOT_FOUND', 'Restaurant not found');
      }

      const body: UpdateRestaurantSettingsResponse = {
        restaurant: mapStaffRestaurant(row),
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
