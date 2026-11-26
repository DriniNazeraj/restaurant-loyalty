import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

function makeLimiter(windowMs: number, max: number, message: string): RequestHandler {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message,
        },
      });
    },
  });
}

export interface RateLimiters {
  publicSignup: RequestHandler;
  publicRewardStatus: RequestHandler;
  login: RequestHandler;
  rewardLookup: RequestHandler;
  rewardRedeem: RequestHandler;
}

export function createRateLimiters(disabled = false): RateLimiters {
  if (disabled) {
    const pass: RequestHandler = (_req, _res, next) => next();
    return {
      publicSignup: pass,
      publicRewardStatus: pass,
      login: pass,
      rewardLookup: pass,
      rewardRedeem: pass,
    };
  }

  return {
    publicSignup: makeLimiter(60_000, 15, 'Too many tries, wait a minute and try again.'),
    publicRewardStatus: makeLimiter(60_000, 120, 'Too many status checks, wait a moment.'),
    login: makeLimiter(15 * 60_000, 20, 'Too many login attempts. Try again in a few minutes.'),
    rewardLookup: makeLimiter(60_000, 120, 'Too many code lookups, wait a moment.'),
    rewardRedeem: makeLimiter(60_000, 60, 'Too many redeem attempts, wait a moment.'),
  };
}
