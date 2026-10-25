import { Router } from 'express';
import { db } from '../database/client.js';
export const categoryRouter = Router();
categoryRouter.get('/', async (_req, res) => {
  res.json({ items: await db.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }) });
});
