import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../migrations');

async function ensureDatabaseExists(databaseUrl: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.end();
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code !== '3D000') {
      throw err;
    }

    const parsed = new URL(databaseUrl);
    const dbName = parsed.pathname.replace(/^\//, '');
    if (!dbName || !/^[a-zA-Z0-9_]+$/.test(dbName)) {
      throw new Error(`Cannot auto-create database with unsafe name: ${dbName}`);
    }

    parsed.pathname = '/postgres';
    const adminClient = new Client({ connectionString: parsed.toString() });
    await adminClient.connect();
    try {
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      console.info(`Created PostgreSQL database "${dbName}".`);
    } finally {
      await adminClient.end();
    }
  }
}

export async function runSetup(databaseUrl: string): Promise<void> {
  await ensureDatabaseExists(databaseUrl);

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const files = (await fs.readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const existing = await client.query<{ filename: string }>(
        `SELECT filename FROM schema_migrations WHERE filename = $1`,
        [file]
      );
      if (existing.rows.length > 0) {
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);
        await client.query('COMMIT');
        console.info(`Applied migration ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client.end();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required. Copy .env.example to .env first.');
    process.exit(1);
  }
  runSetup(databaseUrl)
    .then(() => {
      console.info('Database setup complete.');
    })
    .catch((err) => {
      console.error('Database setup failed:', err);
      process.exit(1);
    });
}
