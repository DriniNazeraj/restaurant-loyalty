import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRootEnv = path.resolve(__dirname, '../../.env');
const serverRootEnv = path.resolve(__dirname, '../.env');

dotenv.config({ path: repoRootEnv });
dotenv.config({ path: serverRootEnv });

export interface AppConfig {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  corsOrigins: string[];
  publicAppOrigin: string;
  nodeEnv: string;
}

export function loadConfig(): AppConfig {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required. Copy .env.example to .env first.');
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 16) {
    throw new Error('JWT_SECRET environment variable must be set (at least 16 characters).');
  }

  const port = Number(process.env.PORT || 3001);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }

  const corsOriginRaw = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const corsOrigins = corsOriginRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const publicAppOrigin = (process.env.PUBLIC_APP_ORIGIN || corsOrigins[0] || 'http://localhost:5173').replace(/\/+$/, '');

  return {
    port,
    databaseUrl,
    jwtSecret,
    corsOrigins,
    publicAppOrigin,
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}
