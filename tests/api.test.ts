import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import SwaggerParser from '@apidevtools/swagger-parser';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createApp } from '../src/app.js';
import { db } from '../src/database/client.js';
import { seedDatabase } from '../src/database/seed-data.js';
import { env } from '../src/config/env.js';

const app = createApp();
// These credentials exist only in the dedicated, disposable test database.
const password = 'TestOnlyFixture812!';
const seed = { adminEmail: 'admin@test.example', adminPassword: password, userEmail: 'reader@test.example', userPassword: password };
let adminToken: string;
let userToken: string;
let secondToken: string;
let userId: string;
let secondId: string;
let categoryId: string;
let resourceId: string;
let createdId: string;
const fileText = '# Example rule\nUse clear variable names.\n';
function token(id: string, expiresIn = 3600, extra = {}) {
  return jwt.sign(extra, env.JWT_SECRET, { subject: id, expiresIn, issuer: 'skillshelf', audience: 'skillshelf-client', algorithm: 'HS256' });
}
function upload(tokenValue: string, fields: Record<string, string> = {}, name = 'example.md', file = Buffer.from(fileText)) {
  const req = request(app).post('/api/admin/resources').auth(tokenValue, { type: 'bearer' });
  for (const [key, value] of Object.entries({ title:'Example resource',description:'A useful example resource for developers.',type:'RULE',categoryId,supportedTool:'Claude Code',usageInstructions:'Save the downloaded file in .claude/rules/.',...fields })) req.field(key,value);
  return req.attach('file',file,name);
}
beforeAll(async () => {
  await db.favorite.deleteMany(); await db.resource.deleteMany(); await db.category.deleteMany(); await db.user.deleteMany();
  await seedDatabase(seed);
  const admin = await db.user.findUniqueOrThrow({ where: { email:seed.adminEmail } });
  const user = await db.user.findUniqueOrThrow({ where: { email:seed.userEmail } });
  const second = await db.user.create({ data:{ displayName:'Second test user',email:'second@test.example',passwordHash:await bcrypt.hash(password,12) } });
  adminToken = token(admin.id); userToken = token(user.id); secondToken = token(second.id);
  userId=user.id; secondId=second.id;
  categoryId=(await db.category.findFirstOrThrow()).id;
  resourceId=(await db.resource.findFirstOrThrow()).id;
});
afterAll(async () => { await db.$disconnect(); });

describe('Database and demo data', () => {
  it('applies the committed migration to real PostgreSQL', async () => {
    const migrations = await db.$queryRaw<Array<{finished_at:Date|null}>>`SELECT finished_at FROM "_prisma_migrations" WHERE migration_name='202610250001_initial'`;
    expect(migrations).toHaveLength(1); expect(migrations[0]?.finished_at).toBeTruthy();
    expect(await db.resource.count()).toBe(18); expect(await db.category.count()).toBe(6);
  });
  it('seeding twice preserves user edits and does not duplicate data', async () => {
    await db.resource.update({where:{id:resourceId},data:{description:'Edited by administrator; preserve this text.'}});
    const favorite = await db.favorite.findFirstOrThrow({where:{userId}});
    await db.favorite.delete({where:{userId_resourceId:{userId,resourceId:favorite.resourceId}}});
    await seedDatabase(seed);
    expect(await db.resource.count()).toBe(18);
    expect((await db.resource.findUniqueOrThrow({where:{id:resourceId}})).description).toContain('Edited by administrator');
    expect(await db.user.count()).toBe(3);
    expect(await db.favorite.count({where:{userId,resourceId:favorite.resourceId}})).toBe(0);
  });
  it('does not promote an existing regular account via seed', async () => {
    await expect(seedDatabase({...seed,adminEmail:seed.userEmail,userEmail:'another@test.example'})).rejects.toThrow('different role');
    expect((await db.user.findUniqueOrThrow({where:{id:userId}})).role).toBe('USER');
  });
  it('enforces database foreign keys and file-size integrity', async () => {
    await expect(db.resource.update({where:{id:resourceId},data:{categoryId:randomUUID()}})).rejects.toBeDefined();
    await expect(db.resource.update({where:{id:resourceId},data:{fileSize:0}})).rejects.toBeDefined();
  });
});

describe('Authentication and permissions', () => {
  it('registers a user, normalizes email and stores only a bcrypt hash', async () => {
    const res = await request(app).post('/api/auth/register').send({displayName:'New reader',email:' NEW@Test.Example ',password});
    expect(res.status).toBe(201); expect(res.body.user.role).toBe('USER'); expect(res.body.user.email).toBe('new@test.example');
    expect(res.body.accessToken).toBeTypeOf('string'); expect(res.body.user.passwordHash).toBeUndefined();
    const stored=await db.user.findUniqueOrThrow({where:{email:'new@test.example'}});
    expect(stored.passwordHash).not.toBe(password); expect(await bcrypt.compare(password,stored.passwordHash)).toBe(true);
  });
  it('rejects duplicate email', async () => {
    expect((await request(app).post('/api/auth/register').send({displayName:'Duplicate',email:seed.userEmail.toUpperCase(),password})).status).toBe(409);
  });
  it('rejects weak passwords and role injection', async () => {
    expect((await request(app).post('/api/auth/register').send({displayName:'Bad account',email:'bad@test.example',password:'short'})).status).toBe(400);
    expect((await request(app).post('/api/auth/register').send({displayName:'Bad account',email:'bad@test.example',password,role:'ADMIN'})).status).toBe(400);
    expect((await request(app).post('/api/auth/register').send({displayName:'Bad account',email:'bad@test.example',password:'Aa1'+ 'א'.repeat(40)})).status).toBe(400);
  });
  it('logs in and returns a usable limited-lifetime token', async () => {
    const res=await request(app).post('/api/auth/login').send({email:seed.userEmail,password});
    expect(res.status).toBe(200); expect(res.body.expiresIn).toBe(3600);
    const payload=jwt.verify(res.body.accessToken,env.JWT_SECRET) as jwt.JwtPayload;
    expect(payload.exp! - payload.iat!).toBe(3600);
    const me=await request(app).get('/api/auth/me').auth(res.body.accessToken,{type:'bearer'});
    expect(me.status).toBe(200); expect(me.body.id).toBe(userId); expect(me.body.passwordHash).toBeUndefined();
  });
  it('rejects incorrect credentials with the same generic response', async () => {
    const wrong=await request(app).post('/api/auth/login').send({email:seed.userEmail,password:'incorrect'});
    const absent=await request(app).post('/api/auth/login').send({email:'absent@test.example',password:'incorrect'});
    expect(wrong.status).toBe(401); expect(absent.status).toBe(401); expect(wrong.body.error.message).toBe(absent.body.error.message);
    expect((await request(app).post('/api/auth/login').send({email:seed.userEmail,password:'A'.repeat(73)})).status).toBe(400);
  });
  it('rejects missing, invalid and expired tokens', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    for (const value of ['invalid',token(userId,-1)]) expect((await request(app).get('/api/auth/me').auth(value,{type:'bearer'})).status).toBe(401);
  });
  it('rejects tokens for a different audience or deleted user', async () => {
    const wrong=jwt.sign({},env.JWT_SECRET,{subject:userId,audience:'other',issuer:'skillshelf'});
    for (const value of [wrong,token(randomUUID())]) expect((await request(app).get('/api/auth/me').auth(value,{type:'bearer'})).status).toBe(401);
  });
  it('checks administrator role from the database, not the client payload', async () => {
    expect((await request(app).get('/api/admin/resources')).status).toBe(401);
    const forgedRole=token(userId,3600,{role:'ADMIN'});
    expect((await request(app).get('/api/admin/resources').auth(forgedRole,{type:'bearer'})).status).toBe(403);
    expect((await request(app).get('/api/admin/resources').auth(adminToken,{type:'bearer'})).status).toBe(200);
    expect((await upload(userToken)).status).toBe(403);
  });
});

describe('Catalog, validation and administration', () => {
  it('serves public categories and paginated metadata without file bytes', async () => {
    expect((await request(app).get('/api/categories')).body.items).toHaveLength(6);
    const res=await request(app).get('/api/resources?pageSize=5');
    expect(res.status).toBe(200); expect(res.body.items).toHaveLength(5); expect(res.body.totalCount).toBe(18);
    expect(res.body.items[0].fileData).toBeUndefined(); expect(res.body.items[0].category.name).toBeTypeOf('string');
  });
  it('searches case-insensitively and filters by type and category', async () => {
    const search=await request(app).get('/api/resources').query({search:'tYpEsCrIpT'});
    expect(search.body.totalCount).toBeGreaterThan(0);
    const res=await request(app).get('/api/resources').query({type:'RULE',categoryId});
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((r:{type:string;categoryId:string})=>r.type==='RULE' && r.categoryId===categoryId)).toBe(true);
  });
  it('returns a clear empty result and rejects invalid query parameters', async () => {
    expect((await request(app).get('/api/resources?search=unfindablexyz')).body.items).toEqual([]);
    for(const query of ['page=-1','pageSize=999','type=OTHER','categoryId=bad','userId=another']) expect((await request(app).get('/api/resources?'+query)).status).toBe(400);
  });
  it('validates identifiers and missing resources', async () => {
    expect((await request(app).get('/api/resources/not-an-id')).status).toBe(400);
    expect((await request(app).get('/api/resources/'+randomUUID())).status).toBe(404);
  });
  it('creates a resource with an actual file', async () => {
    const res=await upload(adminToken); expect(res.status).toBe(201); createdId=res.body.id;
    expect(res.body.fileName).toBe('example.md'); expect(res.body.fileData).toBeUndefined();
    const stored=await db.resource.findUniqueOrThrow({where:{id:createdId}});
    expect(Buffer.from(stored.fileData).toString('utf8')).toBe(fileText);
  });
  it('rejects a missing file and invalid category', async () => {
    expect((await request(app).post('/api/admin/resources').auth(adminToken,{type:'bearer'}).send({title:'A resource',description:'Long description',type:'RULE',categoryId,supportedTool:'Claude Code',usageInstructions:'Some long instructions.'})).status).toBe(400);
    expect((await upload(adminToken,{categoryId:randomUUID()})).status).toBe(400);
  });
  it('rejects unsupported, binary and malformed JSON uploads', async () => {
    expect((await upload(adminToken,{},'example.exe')).status).toBe(415);
    expect((await upload(adminToken,{},'example.txt',Buffer.from([0xff,0,0xff]))).status).toBe(415);
    expect((await upload(adminToken,{},'example.json',Buffer.from('{bad json'))).status).toBe(400);
  });
  it('rejects empty and oversized files', async () => {
    expect((await upload(adminToken,{},'empty.md',Buffer.alloc(0))).status).toBe(400);
    expect((await upload(adminToken,{},'large.md',Buffer.alloc(1048577,65))).status).toBe(413);
  });
  it('rejects multiple files in one resource', async () => {
    const req=request(app).post('/api/admin/resources').auth(adminToken,{type:'bearer'}).attach('file',Buffer.from(fileText),'one.md').attach('file',Buffer.from(fileText),'two.md');
    expect((await req).status).toBe(400);
  });
  it('edits metadata, rejects empty edits and replaces a file', async () => {
    expect((await request(app).patch('/api/admin/resources/'+createdId).auth(adminToken,{type:'bearer'}).send({title:'Updated example'})).status).toBe(200);
    expect((await request(app).patch('/api/admin/resources/'+createdId).auth(adminToken,{type:'bearer'}).send({})).status).toBe(400);
    const res=await request(app).patch('/api/admin/resources/'+createdId).auth(adminToken,{type:'bearer'}).attach('file',Buffer.from('{"strict":true}'),'config.json');
    expect(res.status).toBe(200); expect(res.body.fileName).toBe('config.json');
  });
});

describe('Protected downloads and personal favorites', () => {
  it('requires authentication for downloads and returns the exact stored bytes', async () => {
    const before=await db.resource.findUniqueOrThrow({where:{id:createdId}});
    expect((await request(app).get(`/api/resources/${createdId}/download`)).status).toBe(401);
    const res=await request(app).get(`/api/resources/${createdId}/download`).auth(userToken,{type:'bearer'});
    expect(res.status).toBe(200); expect(res.headers['content-disposition']).toBe('attachment; filename="config.json"');
    expect(res.body).toEqual({strict:true});
    expect((await db.resource.findUniqueOrThrow({where:{id:createdId}})).downloadCount).toBe(before.downloadCount+1);
    expect((await db.resource.findUniqueOrThrow({where:{id:createdId}})).updatedAt).toEqual(before.updatedAt);
  });
  it('counts concurrent authorized downloads without losing increments', async () => {
    const before=(await db.resource.findUniqueOrThrow({where:{id:createdId}})).downloadCount;
    const results=await Promise.all(Array.from({length:5},()=>request(app).get(`/api/resources/${createdId}/download`).auth(userToken,{type:'bearer'})));
    expect(results.every(r=>r.status===200)).toBe(true);
    expect((await db.resource.findUniqueOrThrow({where:{id:createdId}})).downloadCount).toBe(before+5);
  });
  it('stores a favorite once and isolates accounts', async () => {
    expect((await request(app).get('/api/favorites')).status).toBe(401);
    for(let i=0;i<2;i++) expect((await request(app).put('/api/favorites/'+createdId).auth(userToken,{type:'bearer'})).status).toBe(204);
    expect(await db.favorite.count({where:{userId,resourceId:createdId}})).toBe(1);
    const own=await request(app).get('/api/favorites').auth(userToken,{type:'bearer'});
    expect(own.body.items.some((r:{id:string})=>r.id===createdId)).toBe(true);
    expect((await request(app).get('/api/favorites').auth(secondToken,{type:'bearer'})).body.items).toEqual([]);
  });
  it('cannot remove another account favorite', async () => {
    await request(app).delete('/api/favorites/'+createdId).auth(secondToken,{type:'bearer'}).expect(204);
    expect(await db.favorite.count({where:{userId,resourceId:createdId}})).toBe(1);
    expect(await db.favorite.count({where:{userId:secondId}})).toBe(0);
  });
  it('hides resources from public views, downloads and favorites, and allows republishing', async () => {
    await request(app).patch('/api/admin/resources/'+createdId).auth(adminToken,{type:'bearer'}).send({isActive:false}).expect(200);
    await request(app).get('/api/resources/'+createdId).expect(404);
    await request(app).get(`/api/resources/${createdId}/download`).auth(userToken,{type:'bearer'}).expect(404);
    const favorites=await request(app).get('/api/favorites').auth(userToken,{type:'bearer'});
    expect(favorites.body.items.some((r:{id:string})=>r.id===createdId)).toBe(false);
    const list=await request(app).get('/api/admin/resources?search=Updated').auth(adminToken,{type:'bearer'});
    expect(list.body.items[0].isActive).toBe(false);
    await request(app).patch('/api/admin/resources/'+createdId).auth(adminToken,{type:'bearer'}).send({isActive:true}).expect(200);
    await request(app).get('/api/resources/'+createdId).expect(200);
  });
  it('removes a personal favorite idempotently', async () => {
    for(let i=0;i<2;i++) await request(app).delete('/api/favorites/'+createdId).auth(userToken,{type:'bearer'}).expect(204);
    expect(await db.favorite.count({where:{userId,resourceId:createdId}})).toBe(0);
  });
});

describe('Documentation, operational behavior and safety', () => {
  it('validates the complete OpenAPI document with Bearer authorization', async () => {
    const spec=await SwaggerParser.validate('openapi.json');
    const expected = [
      ['post','/api/auth/register'], ['post','/api/auth/login'], ['get','/api/auth/me'],
      ['get','/api/categories'], ['get','/api/resources'], ['get','/api/resources/{id}'],
      ['get','/api/resources/{id}/download'], ['get','/api/favorites'],
      ['put','/api/favorites/{resourceId}'], ['delete','/api/favorites/{resourceId}'],
      ['get','/api/admin/resources'], ['post','/api/admin/resources'],
      ['patch','/api/admin/resources/{id}'], ['get','/api/health'],
    ];
    for (const [method,path] of expected) expect(spec.paths?.[path!]?.[method as 'get']).toBeDefined();
    const raw=JSON.parse(readFileSync('openapi.json','utf8'));
    expect(raw.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
    expect(raw.paths['/api/admin/resources'].post.requestBody.content['multipart/form-data']).toBeDefined();
  });
  it('serves Swagger UI, its initialization and raw document', async () => {
    const res=await request(app).get('/api-docs/'); expect(res.status).toBe(200); expect(res.text).toContain('swagger-ui');
    const init=await request(app).get('/api-docs/swagger-ui-init.js'); expect(init.status).toBe(200); expect(init.text).toContain('/openapi.json');
    expect((await request(app).get('/openapi.json')).body.openapi).toBe('3.0.3');
  });
  it('checks real database availability in health responses', async () => {
    expect((await request(app).get('/api/health')).body).toEqual({status:'healthy',database:'connected'});
    const spy=vi.spyOn(db,'$queryRaw').mockRejectedValueOnce(new Error('private database details'));
    const res=await request(app).get('/api/health'); expect(res.status).toBe(503); expect(JSON.stringify(res.body)).not.toContain('private');
    spy.mockRestore();
  });
  it('sets CORS and security headers and rejects unapproved browser origins', async () => {
    const res=await request(app).get('/api/resources').set('Origin','http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-expose-headers']).toContain('Content-Disposition');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toBeTruthy(); expect(res.headers['x-powered-by']).toBeUndefined();
    expect((await request(app).get('/api/resources').set('Origin','https://unapproved.example')).status).toBe(403);
  });
  it('returns safe uniform errors and never logs the original failure', async () => {
    const spy=vi.spyOn(db.resource,'findFirst').mockRejectedValueOnce(new Error('SECRET_PASSWORD_TOKEN'));
    const log=vi.spyOn(console,'error').mockImplementation(()=>{});
    const res=await request(app).get('/api/resources/'+resourceId);
    expect(res.status).toBe(500); expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('SECRET_PASSWORD_TOKEN');
    expect(JSON.stringify(log.mock.calls)).not.toContain('SECRET_PASSWORD_TOKEN');
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
    spy.mockRestore(); log.mockRestore();
  });
  it('handles unknown routes and malformed request JSON', async () => {
    expect((await request(app).get('/api/missing')).status).toBe(404);
    const res=await request(app).post('/api/auth/login').set('Content-Type','application/json').send('{invalid');
    expect(res.status).toBe(400); expect(res.body.error.code).toBe('INVALID_JSON');
  });
  it('limits repeated authentication attempts', async () => {
    let status=0;
    for(let i=0;i<25 && status!==429;i++) status=(await request(app).post('/api/auth/login').send({email:'bad'})).status;
    expect(status).toBe(429);
  });
});
