import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url().refine(v => /^postgres(ql)?:/.test(v)),
  JWT_SECRET: z.string().min(32).refine(v => !/^(change|replace|example)/i.test(v)),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().min(60).max(86400).default(3600),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(2).default(0),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Field names only: validation must never print secret values.
  throw new Error(`Invalid environment fields: ${[...new Set(parsed.error.issues.map(i => i.path.join('.')))].join(', ')}`);
}
export const env = parsed.data;
export const allowedOrigins = env.CORS_ORIGINS.split(',').map(v => v.trim()).filter(Boolean);
for (const origin of allowedOrigins) {
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
    throw new Error('CORS_ORIGINS must contain exact HTTP(S) origins without paths');
  }
}
