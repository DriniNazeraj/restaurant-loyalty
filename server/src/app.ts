import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import type { Pool } from 'pg';
import { createRequireStaffAuth } from './middleware/auth.js';
import { createRateLimiters } from './middleware/rateLimit.js';
import { LogOnlyMessageProvider, type MessageProvider } from './providers/messageProvider.js';
import { createAuthRouter } from './routes/auth.js';
import { createCampaignsRouter } from './routes/campaigns.js';
import { createContactsRouter } from './routes/contacts.js';
import { createPublicRouter } from './routes/public.js';
import { createQrRouter } from './routes/qr.js';
import { createRestaurantRouter } from './routes/restaurant.js';
import { createRewardsRouter } from './routes/rewards.js';
import { AppError, sendError } from './utils/errors.js';

export interface CreateAppOptions {
  pool: Pool;
  jwtSecret: string;
  corsOrigins?: string[];
  publicAppOrigin?: string;
  messageProvider?: MessageProvider;
  clock?: () => Date;
  disableRateLimit?: boolean;
}

export function createApp(options: CreateAppOptions) {
  const {
    pool,
    jwtSecret,
    corsOrigins = ['http://localhost:5173'],
    publicAppOrigin = 'http://localhost:5173',
    messageProvider = new LogOnlyMessageProvider(),
    clock = () => new Date(),
    disableRateLimit = false,
  } = options;

  const app = express();

  // Set X-Robots-Tag: noindex on every API response (including errors and rate limits)
  app.use((_req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex');
    next();
  });

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: false,
    })
  );
  app.use(express.json({ limit: '16kb' }));

  const limiters = createRateLimiters(disableRateLimit);
  const requireStaffAuth = createRequireStaffAuth(jwtSecret);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/public', createPublicRouter(pool, limiters, clock));
  app.use('/api/auth', createAuthRouter(pool, jwtSecret, requireStaffAuth, limiters));
  app.use('/api/contacts', createContactsRouter(pool, requireStaffAuth, clock));
  app.use('/api/rewards', createRewardsRouter(pool, requireStaffAuth, limiters, clock));
  app.use('/api/qr', createQrRouter(pool, requireStaffAuth, publicAppOrigin));
  app.use('/api/restaurant', createRestaurantRouter(pool, requireStaffAuth));
  app.use('/api/campaigns', createCampaignsRouter(pool, requireStaffAuth, messageProvider, clock));

  app.use('/api', (_req, res) => {
    sendError(res, 404, 'NOT_FOUND', 'Endpoint not found');
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      sendError(res, err.status, err.code, err.message, err.details);
      return;
    }

    if (typeof err === 'object' && err !== null && 'type' in err) {
      const bodyErrType = (err as { type?: string }).type;
      if (bodyErrType === 'entity.too.large') {
        sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds 16kb limit');
        return;
      }
      if (bodyErrType === 'entity.parse.failed') {
        sendError(res, 400, 'INVALID_JSON', 'Malformed JSON body');
        return;
      }
    }

    console.error('Unhandled server error:', err);
    sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  });

  return app;
}
