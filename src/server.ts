import { createApp } from './app.js';
import { db } from './database/client.js';
import { env } from './config/env.js';
await db.$connect();
const server = createApp().listen(env.PORT, '0.0.0.0', () => {
  console.info(JSON.stringify({ level: 'info', event: 'server_started', port: env.PORT }));
});
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close(() => { void db.$disconnect().finally(() => process.exit(0)); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
