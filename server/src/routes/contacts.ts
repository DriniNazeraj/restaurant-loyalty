import { Router, type RequestHandler } from 'express';
import type { Pool } from 'pg';
import {
  ContactsFilterQuerySchema,
  ListContactsQuerySchema,
  type ContactsFilterQuery,
  type ListContactsResponse,
} from '../schemas.js';
import { requireOwnerRole } from '../middleware/auth.js';
import { AppError, formatZodDetails } from '../utils/errors.js';
import { buildCsv } from '../utils/csv.js';
import { normalizePhoneE164 } from '../utils/phone.js';
import {
  computeRewardStatus,
  mapContactPublic,
  mapRewardSummary,
  toIso,
  toIsoOrNull,
} from '../services/mappers.js';

interface ContactJoinedRow {
  id: string;
  name: string;
  phone_e164: string;
  email: string | null;
  birth_month: number | null;
  birth_day: number | null;
  birth_year: number | null;
  marketing_consent: boolean;
  consented_at: Date | null;
  consent_text: string | null;
  created_at: Date;
  r_id: string;
  r_code: string;
  r_title: string;
  r_expires_at: Date | null;
  r_redeemed_at: Date | null;
  r_created_at: Date;
  redeemed_by_name: string | null;
}

function buildPhoneSearchPatterns(q: string): { exactE164: string | null; likePatterns: string[] } {
  const exactE164 = normalizePhoneE164(q);
  const compact = q.trim().replace(/[\s\-().]/g, '');
  const patterns = new Set<string>();

  if (compact && /^[+\d]+$/.test(compact)) {
    patterns.add(`%${compact}%`);
    if (compact.startsWith('00') && compact.length > 2) {
      patterns.add(`%+${compact.slice(2)}%`);
    } else if (compact.startsWith('0') && compact.length >= 2) {
      patterns.add(`%+355${compact.slice(1)}%`);
    } else if (/^6\d+$/.test(compact)) {
      patterns.add(`%+355${compact}%`);
    } else if (compact.startsWith('355')) {
      patterns.add(`%+${compact}%`);
    }
  }

  return { exactE164, likePatterns: Array.from(patterns) };
}

function buildFilterWhere(
  restaurantId: string,
  filters: ContactsFilterQuery,
  now: Date
): { whereSql: string; params: unknown[]; orderBySql: string } {
  const params: unknown[] = [restaurantId];
  const conditions: string[] = ['c.restaurant_id = $1'];

  if (filters.q) {
    params.push(`%${filters.q}%`);
    const qIdx = params.length;
    const orParts = [
      `c.name ILIKE $${qIdx}`,
      `c.phone_e164 ILIKE $${qIdx}`,
      `COALESCE(c.email, '') ILIKE $${qIdx}`,
    ];

    const phoneSearch = buildPhoneSearchPatterns(filters.q);
    if (phoneSearch.exactE164) {
      params.push(phoneSearch.exactE164);
      orParts.push(`c.phone_e164 = $${params.length}`);
    }
    for (const pat of phoneSearch.likePatterns) {
      params.push(pat);
      orParts.push(`c.phone_e164 ILIKE $${params.length}`);
    }

    conditions.push(`(${orParts.join(' OR ')})`);
  }

  if (filters.consent === 'consented') {
    conditions.push('c.marketing_consent = true');
  } else if (filters.consent === 'not_consented') {
    conditions.push('c.marketing_consent = false');
  }

  if (filters.reward === 'active') {
    params.push(now);
    const idx = params.length;
    conditions.push(`r.redeemed_at IS NULL AND (r.expires_at IS NULL OR r.expires_at > $${idx})`);
  } else if (filters.reward === 'redeemed') {
    conditions.push('r.redeemed_at IS NOT NULL');
  } else if (filters.reward === 'expired') {
    params.push(now);
    const idx = params.length;
    conditions.push(`r.redeemed_at IS NULL AND r.expires_at IS NOT NULL AND r.expires_at <= $${idx}`);
  }

  const orderBySql =
    filters.sort === 'name'
      ? 'ORDER BY LOWER(c.name) ASC, c.created_at DESC'
      : 'ORDER BY c.created_at DESC';

  return {
    whereSql: conditions.join(' AND '),
    params,
    orderBySql,
  };
}

export function createContactsRouter(
  pool: Pool,
  requireStaffAuth: RequestHandler,
  clock: () => Date
): Router {
  const router = Router();
  router.use(requireStaffAuth);

  router.get('/', async (req, res, next) => {
    try {
      const parsed = ListContactsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid query parameters', formatZodDetails(parsed.error));
      }

      const now = clock();
      const { page, limit, ...filters } = parsed.data;
      const { whereSql, params, orderBySql } = buildFilterWhere(req.auth!.restaurantId, filters, now);

      const countRes = await pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM contacts c
         JOIN rewards r ON r.contact_id = c.id
         WHERE ${whereSql}`,
        params
      );
      const total = Number(countRes.rows[0]?.total ?? 0);
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const offset = (page - 1) * limit;

      const listParams = [...params, limit, offset];
      const limitIdx = listParams.length - 1;
      const offsetIdx = listParams.length;

      const rowsRes = await pool.query<ContactJoinedRow>(
        `SELECT c.id, c.name, c.phone_e164, c.email, c.birth_month, c.birth_day, c.birth_year,
                c.marketing_consent, c.consented_at, c.consent_text, c.created_at,
                r.id AS r_id, r.code AS r_code, r.title AS r_title,
                r.expires_at AS r_expires_at, r.redeemed_at AS r_redeemed_at, r.created_at AS r_created_at,
                s.name AS redeemed_by_name
         FROM contacts c
         JOIN rewards r ON r.contact_id = c.id
         LEFT JOIN staff_users s ON s.id = r.redeemed_by
         WHERE ${whereSql}
         ${orderBySql}
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        listParams
      );

      const body: ListContactsResponse = {
        contacts: rowsRes.rows.map((row) => ({
          ...mapContactPublic(row),
          consentText: row.consent_text,
          createdAt: toIso(row.created_at),
          reward: {
            ...mapRewardSummary(
              {
                id: row.r_id,
                code: row.r_code,
                title: row.r_title,
                expires_at: row.r_expires_at,
                redeemed_at: row.r_redeemed_at,
                created_at: row.r_created_at,
              },
              now
            ),
            redeemedBy: row.redeemed_by_name ?? null,
          },
        })),
        pagination: { page, limit, total, totalPages },
      };

      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  router.get('/export.csv', requireOwnerRole, async (req, res, next) => {
    try {
      const parsed = ContactsFilterQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid query parameters', formatZodDetails(parsed.error));
      }

      const now = clock();
      const { whereSql, params, orderBySql } = buildFilterWhere(req.auth!.restaurantId, parsed.data, now);

      const rowsRes = await pool.query<ContactJoinedRow>(
        `SELECT c.id, c.name, c.phone_e164, c.email, c.birth_month, c.birth_day, c.birth_year,
                c.marketing_consent, c.consented_at, c.consent_text, c.created_at,
                r.id AS r_id, r.code AS r_code, r.title AS r_title,
                r.expires_at AS r_expires_at, r.redeemed_at AS r_redeemed_at, r.created_at AS r_created_at,
                NULL::text AS redeemed_by_name
         FROM contacts c
         JOIN rewards r ON r.contact_id = c.id
         WHERE ${whereSql}
         ${orderBySql}`,
        params
      );

      const headers = [
        'name',
        'phone',
        'email',
        'birthday',
        'marketing_consent',
        'consented_at',
        'reward_code',
        'reward_status',
        'reward_redeemed_at',
        'reward_expires_at',
        'created_at',
      ];

      const csvRows = rowsRes.rows.map((row) => {
        const birthday =
          row.birth_month && row.birth_day
            ? `${row.birth_year ? `${row.birth_year}-` : ''}${String(row.birth_month).padStart(2, '0')}-${String(row.birth_day).padStart(2, '0')}`
            : '';
        return [
          row.name,
          row.phone_e164,
          row.email ?? '',
          birthday,
          row.marketing_consent ? 'true' : 'false',
          toIsoOrNull(row.consented_at) ?? '',
          row.r_code,
          computeRewardStatus(row.r_redeemed_at, row.r_expires_at, now),
          toIsoOrNull(row.r_redeemed_at) ?? '',
          toIsoOrNull(row.r_expires_at) ?? '',
          toIso(row.created_at),
        ];
      });

      const csv = buildCsv(headers, csvRows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
      res.send(csv);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
