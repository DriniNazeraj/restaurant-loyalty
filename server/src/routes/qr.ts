import { Router, type RequestHandler } from 'express';
import type { Pool } from 'pg';
import QRCode from 'qrcode';
import type { QrResponse } from '../schemas.js';
import { AppError } from '../utils/errors.js';

export function createQrRouter(
  pool: Pool,
  requireStaffAuth: RequestHandler,
  publicAppOrigin: string
): Router {
  const router = Router();
  router.use(requireStaffAuth);

  router.get('/', async (req, res, next) => {
    try {
      const result = await pool.query<{
        slug: string;
        name: string;
        tagline: string;
        reward_title: string;
        brand_color: string;
      }>(
        `SELECT slug, name, tagline, reward_title, brand_color
         FROM restaurants
         WHERE id = $1`,
        [req.auth!.restaurantId]
      );
      const row = result.rows[0];
      if (!row) {
        throw new AppError(404, 'NOT_FOUND', 'Restaurant not found');
      }

      const landingUrl = `${publicAppOrigin}/r/${row.slug}`;
      const [qrSvg, qrDataUrl] = await Promise.all([
        QRCode.toString(landingUrl, { type: 'svg', errorCorrectionLevel: 'M', margin: 4 }),
        QRCode.toDataURL(landingUrl, { errorCorrectionLevel: 'M', margin: 4, width: 600 }),
      ]);

      const body: QrResponse = {
        landingUrl,
        qrSvg,
        qrDataUrl,
        restaurant: {
          slug: row.slug,
          name: row.name,
          tagline: row.tagline,
          rewardTitle: row.reward_title,
          brandColor: row.brand_color,
        },
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
