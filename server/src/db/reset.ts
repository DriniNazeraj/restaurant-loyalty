import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import '../config.js';
import { runSetup } from './setup.js';
import { runSeed } from './seed.js';

export async function runReset(databaseUrl: string, seedPassword: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`
      DROP TABLE IF EXISTS
        reward_audit_logs,
        campaigns,
        rewards,
        contacts,
        staff_users,
        restaurants,
        schema_migrations
      CASCADE;
    `);
  } finally {
    await client.end();
  }

  await runSetup(databaseUrl);
  await runSeed(databaseUrl, seedPassword);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const databaseUrl = process.env.DATABASE_URL;
  const seedPassword = process.env.SEED_STAFF_PASSWORD;
  if (!databaseUrl || !seedPassword) {
    console.error('DATABASE_URL and SEED_STAFF_PASSWORD are required in .env.');
    process.exit(1);
  }
  runReset(databaseUrl, seedPassword)
    .then(() => {
      console.info('Database reset complete.');
    })
    .catch((err) => {
      console.error('Database reset failed:', err);
      process.exit(1);
    });
}
