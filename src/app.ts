import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { env, allowedOrigins } from './config/env.js';
import { db } from './database/client.js';
import { AppError, errorHandler } from './middleware/errors.js';
import { apiLimit } from './middleware/limits.js';
import { authRouter } from './auth/auth.routes.js';
import { resourceRouter, adminRouter } from './resources/resource.routes.js';
import { favoriteRouter } from './favorites/favorite.routes.js';
import { categoryRouter } from './categories/category.routes.js';

export const openapi = JSON.parse(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8')) as object;
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-ID', req.requestId);
    next();
  });
  app.use(helmet({ contentSecurityPolicy: { directives: {
    'script-src': ["'self'"], 'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:'], 'upgrade-insecure-requests': env.NODE_ENV === 'production' ? [] : null,
  } } }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new AppError(403, 'CORS_FORBIDDEN', 'מקור הבקשה אינו מורשה'));
    },
    exposedHeaders: ['Content-Disposition', 'X-Request-ID'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', async (_req, res) => {
    try { await db.$queryRaw`SELECT 1`; res.json({ status: 'healthy', database: 'connected' }); }
    catch { res.status(503).json({ status: 'unhealthy', database: 'unavailable' }); }
  });
  // Raw document and Swagger assets are served by this app; no external CDN required.
  app.get('/openapi.json', (_req, res) => { res.json(openapi); });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(undefined, {
    swaggerOptions: { url: '/openapi.json', persistAuthorization: false },
    customSiteTitle: 'SkillShelf API',
  }));
  app.use('/api', apiLimit);
  app.use('/api/auth', authRouter);
  app.use('/api/categories', categoryRouter);
  app.use('/api/resources', resourceRouter);
  app.use('/api/favorites', favoriteRouter);
  app.use('/api/admin', adminRouter);
  app.use((_req, _res) => { throw new AppError(404, 'NOT_FOUND', 'הכתובת לא נמצאה'); });
  app.use(errorHandler);
  return app;
}
