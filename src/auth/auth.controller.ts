import type { RequestHandler } from 'express';
import * as service from './auth.service.js';
import { registerSchema, loginSchema } from './auth.schemas.js';
export const register: RequestHandler = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(201).json(await service.register(registerSchema.parse(req.body)));
};
export const login: RequestHandler = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await service.login(loginSchema.parse(req.body)));
};
export const me: RequestHandler = (req, res) => { res.json(req.user); };
