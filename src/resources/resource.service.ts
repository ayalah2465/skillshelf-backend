import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { db } from '../database/client.js';
import { AppError } from '../middleware/errors.js';
import type { listSchema, resourceSchema, updateResourceSchema } from './resource.schemas.js';
import { validateFile } from './file.validation.js';

export const resourceSelect = {
  id: true, title: true, description: true, type: true, supportedTool: true,
  usageInstructions: true, categoryId: true, category: { select: { id: true, name: true } },
  fileName: true, fileSize: true, mimeType: true, isActive: true, downloadCount: true,
  createdAt: true, updatedAt: true,
} as const;

export async function list(input: z.infer<typeof listSchema>, admin = false) {
  const where: Prisma.ResourceWhereInput = {
    ...(admin ? {} : { isActive: true }),
    ...(input.type ? { type: input.type } : {}),
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.search ? { OR: [
      { title: { contains: input.search, mode: 'insensitive' } },
      { description: { contains: input.search, mode: 'insensitive' } },
    ] } : {}),
  };
  const [items, totalCount] = await db.$transaction([
    db.resource.findMany({ where, select: resourceSelect, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    db.resource.count({ where }),
  ], { isolationLevel: 'RepeatableRead' });
  return { items, totalCount, page: input.page, pageSize: input.pageSize, totalPages: Math.ceil(totalCount / input.pageSize) };
}
export async function detail(id: string) {
  const item = await db.resource.findFirst({ where: { id, isActive: true }, select: resourceSelect });
  if (!item) throw new AppError(404, 'NOT_FOUND', 'המשאב לא נמצא');
  return item;
}
async function checkCategory(categoryId: string) {
  if (!await db.category.findUnique({ where: { id: categoryId }, select: { id: true } })) {
    throw new AppError(400, 'INVALID_CATEGORY', 'הקטגוריה אינה קיימת');
  }
}
export async function create(input: z.infer<typeof resourceSchema>, file?: Express.Multer.File) {
  if (!file) throw new AppError(400, 'FILE_REQUIRED', 'יש לצרף קובץ בשדה file');
  const data = validateFile(file);
  await checkCategory(input.categoryId);
  return db.resource.create({ data: { ...input, ...data }, select: resourceSelect });
}
export async function update(id: string, input: z.infer<typeof updateResourceSchema>, file?: Express.Multer.File) {
  if (!Object.keys(input).length && !file) throw new AppError(400, 'EMPTY_UPDATE', 'יש לבחור לפחות שדה אחד לעדכון');
  const data = file ? validateFile(file) : {};
  if (input.categoryId) await checkCategory(input.categoryId);
  return db.resource.update({ where: { id }, data: { ...input, ...data }, select: resourceSelect });
}
export async function download(id: string) {
  // One statement: active-state check and atomic counter increment happen together.
  // A download must not change the resource's editorial updatedAt date.
  const rows = await db.$queryRaw<Array<{fileData: Uint8Array; fileName: string; mimeType: string; fileSize: number}>>`
    UPDATE "Resource" SET "downloadCount" = "downloadCount" + 1
    WHERE "id" = ${id}::uuid AND "isActive" = true
    RETURNING "fileData", "fileName", "mimeType", "fileSize"
  `;
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'המשאב לא נמצא');
  return rows[0];
}
