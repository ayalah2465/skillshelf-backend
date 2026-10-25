import { z } from 'zod';
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(10).max(72)
  .refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'הסיסמה ארוכה מדי בקידוד UTF-8')
  .refine(v => /[a-z]/.test(v) && /[A-Z]/.test(v) && /[0-9]/.test(v), 'נדרשות אות קטנה באנגלית, אות גדולה וספרה');
export const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(80), email: emailSchema, password: passwordSchema,
}).strict();
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72).refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'הסיסמה ארוכה מדי בקידוד UTF-8'),
}).strict();
