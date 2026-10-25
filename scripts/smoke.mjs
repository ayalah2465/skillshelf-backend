const base = process.env.API_BASE_URL || 'http://127.0.0.1:3000';
function check(condition, message) { if (!condition) throw new Error(message); }
async function json(path, options) {
  const res = await fetch(base + path, options);
  check(res.ok, `${path}: HTTP ${res.status}`);
  return res.json();
}
const health = await json('/api/health');
check(health.status === 'healthy' && health.database === 'connected', 'Health check failed');
const spec = await json('/openapi.json');
check(spec.openapi === '3.0.3', 'OpenAPI version mismatch');
const page = await json('/api/resources');
check(page.items.length > 0, 'Run the explicit seed before this smoke test');
const ui = await fetch(base + '/api-docs/');
check(ui.ok && (await ui.text()).includes('swagger-ui'), 'Swagger UI failed');
check((await fetch(base + '/api/auth/me')).status === 401, 'Missing token should return 401');
const email = process.env.SEED_USER_EMAIL;
const password = process.env.SEED_USER_PASSWORD;
check(email && password, 'Set SEED_USER_EMAIL and SEED_USER_PASSWORD to run the authenticated smoke test');
const session = await json('/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
});
const headers = { Authorization: `Bearer ${session.accessToken}` };
const me = await json('/api/auth/me', { headers });
check(me.role === 'USER', 'Expected the regular demonstration user');
check((await fetch(base + '/api/admin/resources', { headers })).status === 403, 'Regular user should receive 403');
const resource = page.items[0];
const download = await fetch(base + `/api/resources/${resource.id}/download`, { headers });
check(download.ok && download.headers.get('content-disposition')?.startsWith('attachment;'), 'Download failed');
check((await download.arrayBuffer()).byteLength === resource.fileSize, 'Downloaded file length mismatch');
console.info('Passed: live health, PostgreSQL catalog, Swagger UI, OpenAPI, login, JWT, 401, 403 and actual file download. Tokens and credentials withheld.');
