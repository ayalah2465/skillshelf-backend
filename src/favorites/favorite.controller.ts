import type { RequestHandler } from 'express';
import { idSchema } from '../resources/resource.schemas.js';
import * as service from './favorite.service.js';
export const list: RequestHandler = async (req, res) => { res.json(await service.list(req.user!.id)); };
export const add: RequestHandler = async (req, res) => {
  await service.add(req.user!.id, idSchema.parse(req.params.resourceId)); res.sendStatus(204);
};
export const remove: RequestHandler = async (req, res) => {
  await service.remove(req.user!.id, idSchema.parse(req.params.resourceId)); res.sendStatus(204);
};
