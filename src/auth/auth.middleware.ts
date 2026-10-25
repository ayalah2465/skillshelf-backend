import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../database/client.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errors.js';
import { userSelect } from './auth.service.js';

export const requireAuth: RequestHandler = async (req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AppError(401, 'UNAUTHORIZED', 'נדרשת התחברות');
  let userId: string;
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET, {
      algorithms: ['HS256'], issuer: 'skillshelf', audience: 'skillshelf-client',
    });
    if (typeof payload === 'string' || typeof payload.sub !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub)) throw new Error();
    userId = payload.sub;
  } catch { throw new AppError(401, 'UNAUTHORIZED', 'ההתחברות אינה תקפה או שפג תוקפה'); }
  const user = await db.user.findUnique({ where: { id: userId }, select: userSelect });
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'ההתחברות אינה תקפה');
  req.user = user;
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== 'ADMIN') throw new AppError(403, 'FORBIDDEN', 'הפעולה מיועדת למנהל בלבד');
  next();
};
