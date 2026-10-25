import type { RequestHandler } from 'express';
import { idSchema, listSchema, resourceSchema, updateResourceSchema } from './resource.schemas.js';
import * as service from './resource.service.js';
export const list: RequestHandler = async (req, res) => { res.json(await service.list(listSchema.parse(req.query))); };
export const adminList: RequestHandler = async (req, res) => { res.json(await service.list(listSchema.parse(req.query), true)); };
export const detail: RequestHandler = async (req, res) => { res.json(await service.detail(idSchema.parse(req.params.id))); };
export const create: RequestHandler = async (req, res) => {
  res.status(201).json(await service.create(resourceSchema.parse(req.body), req.file));
};
export const update: RequestHandler = async (req, res) => {
  res.json(await service.update(idSchema.parse(req.params.id), updateResourceSchema.parse(req.body), req.file));
};
export const download: RequestHandler = async (req, res) => {
  const item = await service.download(idSchema.parse(req.params.id));
  res.set({
    'Content-Type': item.mimeType,
    'Content-Disposition': `attachment; filename="${item.fileName}"`,
    'Content-Length': String(item.fileSize),
    'Cache-Control': 'private, no-store',
  });
  res.send(Buffer.from(item.fileData));
};
