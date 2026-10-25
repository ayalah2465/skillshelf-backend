import { Router } from 'express';
import * as controller from './auth.controller.js';
import { requireAuth } from './auth.middleware.js';
import { authLimit } from '../middleware/limits.js';
export const authRouter = Router();
authRouter.post('/register', authLimit, controller.register);
authRouter.post('/login', authLimit, controller.login);
authRouter.get('/me', requireAuth, controller.me);
