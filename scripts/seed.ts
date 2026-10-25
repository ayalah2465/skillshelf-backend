import 'dotenv/config';
import { db } from '../src/database/client.js';
import { seedDatabase, seedSchema } from '../src/database/seed-data.js';
try {
  const parsed = seedSchema.safeParse({
    adminEmail: process.env.SEED_ADMIN_EMAIL, adminPassword: process.env.SEED_ADMIN_PASSWORD,
    userEmail: process.env.SEED_USER_EMAIL, userPassword: process.env.SEED_USER_PASSWORD,
  });
  if (!parsed.success) throw new Error('Set valid, distinct SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_USER_EMAIL and SEED_USER_PASSWORD. Passwords: 10–72 UTF-8 bytes, uppercase, lowercase and digit.');
  const result = await seedDatabase(parsed.data);
  console.info(JSON.stringify({ event: 'seed_completed', ...result, accounts: 'Existing account passwords and user edits were preserved.' }));
} catch (error) {
  console.error(error instanceof Error && error.message.startsWith('Set valid') ? error.message : 'Seed failed. Check database availability and seed account role conflicts; credentials were not logged.');
  process.exitCode = 1;
} finally { await db.$disconnect(); }
