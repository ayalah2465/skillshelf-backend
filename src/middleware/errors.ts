import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import multer from 'multer';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'אירעה שגיאה פנימית. ניתן לנסות שוב.';
  let details: Record<string, string[]> | undefined;
  if (error instanceof AppError) {
    ({ status, code, message } = error);
  } else if (error instanceof ZodError) {
    status = 400; code = 'VALIDATION_ERROR'; message = 'יש לבדוק את השדות שסומנו';
    details = {};
    for (const issue of error.issues) {
      const field = issue.path.join('.') || 'request';
      (details[field] ??= []).push(issue.message);
    }
  } else if (error instanceof multer.MulterError) {
    status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'INVALID_UPLOAD';
    message = status === 413 ? 'גודל הקובץ המרבי הוא 1 MB' : 'יש לצרף קובץ אחד בשדה file';
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') { status = 409; code = 'CONFLICT'; message = 'הרשומה כבר קיימת'; }
    if (error.code === 'P2003') { status = 400; code = 'INVALID_REFERENCE'; message = 'הרשומה המקושרת אינה קיימת'; }
    if (error.code === 'P2025') { status = 404; code = 'NOT_FOUND'; message = 'הרשומה לא נמצאה'; }
  } else if (typeof error === 'object' && error !== null && 'type' in error) {
    if (error.type === 'entity.parse.failed') { status = 400; code = 'INVALID_JSON'; message = 'גוף הבקשה אינו JSON תקין'; }
    if (error.type === 'entity.too.large') { status = 413; code = 'BODY_TOO_LARGE'; message = 'הבקשה גדולה מדי'; }
  }
  // Deliberately log no request bodies, URLs, tokens, SQL, exception messages or credentials.
  if (status >= 500) console.error(JSON.stringify({ level: 'error', event: 'request_failed', requestId: req.requestId, status, code }));
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}), requestId: req.requestId } });
};
