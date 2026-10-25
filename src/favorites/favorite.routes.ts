import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import * as controller from './favorite.controller.js';
export const favoriteRouter = Router();
favoriteRouter.use(requireAuth);
favoriteRouter.get('/', controller.list);
favoriteRouter.put('/:resourceId', controller.add);
favoriteRouter.delete('/:resourceId', controller.remove);
