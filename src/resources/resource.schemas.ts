import { z } from 'zod';
export const idSchema = z.string().uuid();
export const listSchema = z.object({
  search: z.string().trim().max(100).optional(),
  type: z.enum(['SKILL', 'RULE']).optional(), categoryId: idSchema.optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(24).default(12),
}).strict();
export const resourceSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  type: z.enum(['SKILL', 'RULE']),
  categoryId: idSchema,
  supportedTool: z.string().trim().min(2).max(100),
  usageInstructions: z.string().trim().min(10).max(10000),
}).strict();
export const updateResourceSchema = resourceSchema.partial().extend({
  isActive: z.preprocess(v => v === 'true' ? true : v === 'false' ? false : v, z.boolean()).optional(),
}).strict();
