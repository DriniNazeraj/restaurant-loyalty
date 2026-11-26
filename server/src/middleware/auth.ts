import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { StaffRole } from '../schemas.js';
import { sendError } from '../utils/errors.js';

export interface AuthTokenPayload {
  sub: string; // staff user id
  restaurantId: string;
  role: StaffRole;
  name: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export function signStaffToken(payload: AuthTokenPayload, jwtSecret: string): string {
  return jwt.sign(payload, jwtSecret, { expiresIn: '12h' });
}

export function createRequireStaffAuth(jwtSecret: string) {
  return function requireStaffAuth(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as Partial<AuthTokenPayload>;
      if (
        !decoded ||
        typeof decoded.sub !== 'string' ||
        typeof decoded.restaurantId !== 'string' ||
        (decoded.role !== 'owner' && decoded.role !== 'staff') ||
        typeof decoded.name !== 'string' ||
        typeof decoded.email !== 'string'
      ) {
        sendError(res, 401, 'UNAUTHORIZED', 'Invalid token payload');
        return;
      }

      req.auth = {
        sub: decoded.sub,
        restaurantId: decoded.restaurantId,
        role: decoded.role,
        name: decoded.name,
        email: decoded.email,
      };
      next();
    } catch {
      sendError(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
  };
}

export function requireOwnerRole(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
    return;
  }
  if (req.auth.role !== 'owner') {
    sendError(res, 403, 'FORBIDDEN', 'Owner access required');
    return;
  }
  next();
}
