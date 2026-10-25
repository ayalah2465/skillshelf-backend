import { db } from '../database/client.js';
import { detail, resourceSelect } from '../resources/resource.service.js';
export async function list(userId: string) {
  const rows = await db.favorite.findMany({
    where: { userId, resource: { isActive: true } },
    select: { createdAt: true, resource: { select: resourceSelect } },
    orderBy: [{ createdAt: 'desc' }, { resourceId: 'asc' }],
  });
  return { items: rows.map(r => r.resource) };
}
export async function add(userId: string, resourceId: string) {
  await detail(resourceId);
  await db.favorite.upsert({ where: { userId_resourceId: { userId, resourceId } },
    create: { userId, resourceId }, update: {} });
}
export async function remove(userId: string, resourceId: string) {
  await db.favorite.deleteMany({ where: { userId, resourceId } });
}
