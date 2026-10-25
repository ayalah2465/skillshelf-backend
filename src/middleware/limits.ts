import { rateLimit } from 'express-rate-limit';
const message = { error: { code: 'RATE_LIMITED', message: 'בוצעו בקשות רבות מדי. יש לנסות שוב מאוחר יותר.' } };
export const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message });
export const apiLimit = rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, message });
export const uploadLimit = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message });
