import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { z } from 'zod';
import { db } from '../database/client.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errors.js';
import type { registerSchema, loginSchema } from './auth.schemas.js';

export const userSelect = { id: true, displayName: true, email: true, role: true } as const;
const dummyHash = await bcrypt.hash('non-user-comparison-only', 12);
function session(user: { id: string; displayName: string; email: string; role: string }) {
  return {
    user,
    accessToken: jwt.sign({}, env.JWT_SECRET, {
      algorithm: 'HS256', subject: user.id, issuer: 'skillshelf', audience: 'skillshelf-client',
      expiresIn: env.JWT_EXPIRES_IN_SECONDS,
    }),
    tokenType: 'Bearer', expiresIn: env.JWT_EXPIRES_IN_SECONDS,
  };
}
export async function register(input: z.infer<typeof registerSchema>) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await db.user.create({
    data: { displayName: input.displayName, email: input.email, passwordHash, role: 'USER' },
    select: userSelect,
  });
  return session(user);
}
export async function login(input: z.infer<typeof loginSchema>) {
  const user = await db.user.findUnique({ where: { email: input.email } });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? dummyHash);
  if (!user || !valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'הדוא״ל או הסיסמה אינם נכונים');
  return session({ id: user.id, displayName: user.displayName, email: user.email, role: user.role });
}
