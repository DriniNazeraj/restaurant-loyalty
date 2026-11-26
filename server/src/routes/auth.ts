import { Router, type RequestHandler } from 'express';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { LoginRequestSchema, type LoginResponse, type AuthMeResponse, type StaffRole } from '../schemas.js';
import { signStaffToken } from '../middleware/auth.js';
import type { RateLimiters } from '../middleware/rateLimit.js';
import { AppError, formatZodDetails } from '../utils/errors.js';
import { mapStaffRestaurant, type RestaurantRow } from '../services/mappers.js';

interface StaffWithRestaurantRow extends RestaurantRow {
  staff_id: string;
  staff_email: string;
  staff_name: string;
  staff_role: StaffRole;
  password_hash: string;
  restaurant_id: string;
}

export function createAuthRouter(
  pool: Pool,
  jwtSecret: string,
  requireStaffAuth: RequestHandler,
  limiters: RateLimiters
): Router {
  const router = Router();

  router.post('/login', limiters.login, async (req, res, next) => {
    try {
      const parsed = LoginRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid login request', formatZodDetails(parsed.error));
      }

      const email = parsed.data.email.trim().toLowerCase();
      const result = await pool.query<StaffWithRestaurantRow>(
        `SELECT s.id AS staff_id, s.email AS staff_email, s.name AS staff_name,
                s.role AS staff_role, s.password_hash, s.restaurant_id,
                r.id, r.slug, r.name, r.tagline, r.reward_title, r.reward_description,
                r.brand_color, r.consent_text, r.timezone, r.reward_expiry_days, r.offer_active
         FROM staff_users s
         JOIN restaurants r ON r.id = s.restaurant_id
         WHERE LOWER(s.email) = $1`,
        [email]
      );

      const row = result.rows[0];
      if (!row) {
        throw new AppError(401, 'UNAUTHORIZED', 'Email or password is wrong');
      }

      const valid = await bcrypt.compare(parsed.data.password, row.password_hash);
      if (!valid) {
        throw new AppError(401, 'UNAUTHORIZED', 'Email or password is wrong');
      }

      const token = signStaffToken(
        {
          sub: row.staff_id,
          restaurantId: row.restaurant_id,
          role: row.staff_role,
          name: row.staff_name,
          email: row.staff_email,
        },
        jwtSecret
      );

      const body: LoginResponse = {
        token,
        staff: {
          id: row.staff_id,
          email: row.staff_email,
          name: row.staff_name,
          role: row.staff_role,
          restaurantId: row.restaurant_id,
        },
        restaurant: mapStaffRestaurant(row),
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', requireStaffAuth, async (req, res, next) => {
    try {
      const auth = req.auth!;
      const result = await pool.query<StaffWithRestaurantRow>(
        `SELECT s.id AS staff_id, s.email AS staff_email, s.name AS staff_name,
                s.role AS staff_role, s.password_hash, s.restaurant_id,
                r.id, r.slug, r.name, r.tagline, r.reward_title, r.reward_description,
                r.brand_color, r.consent_text, r.timezone, r.reward_expiry_days, r.offer_active
         FROM staff_users s
         JOIN restaurants r ON r.id = s.restaurant_id
         WHERE s.id = $1 AND s.restaurant_id = $2`,
        [auth.sub, auth.restaurantId]
      );

      const row = result.rows[0];
      if (!row) {
        throw new AppError(401, 'UNAUTHORIZED', 'Account no longer exists');
      }

      const body: AuthMeResponse = {
        staff: {
          id: row.staff_id,
          email: row.staff_email,
          name: row.staff_name,
          role: row.staff_role,
          restaurantId: row.restaurant_id,
        },
        restaurant: mapStaffRestaurant(row),
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
