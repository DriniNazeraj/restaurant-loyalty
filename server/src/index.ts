import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { createApp } from './app.js';

const config = loadConfig();
const pool = createPool(config.databaseUrl);
const app = createApp({
  pool,
  jwtSecret: config.jwtSecret,
  corsOrigins: config.corsOrigins,
  publicAppOrigin: config.publicAppOrigin,
});

const server = app.listen(config.port, () => {
  console.info(`Restaurant Loyalty API listening on http://localhost:${config.port}`);
});

function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
