import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { hashPassword } from '../server/security.js';
const root = path.resolve(import.meta.dirname, '..'),
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'verse-api-test-')),
  file = path.join(tmp, 'isolated.sqlite');
const fixture = new DatabaseSync(file);
fixture.exec(await fs.readFile(path.join(root, 'database/schema.sql'), 'utf8'));
fixture
  .prepare('INSERT INTO users(name,email,password_hash,role,created_at) VALUES(?,?,?,?,?)')
  .run(
    'Isolated test admin',
    'admin@example.invalid',
    hashPassword('isolated-test-password-long'),
    'admin',
    '2026-10-09',
  );
fixture.exec(
  "INSERT INTO business_details(id,name,email,phone,source_url,source_checked_at) VALUES(1,'Test fixture','test@example.invalid','0000000000','test','2026-10-09')",
);
fixture.close();
const port = 3101,
  base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server/index.js', '--production'], {
  cwd: root,
  env: {
    ...process.env,
    DB_DRIVER: 'sqlite',
    DB_FILE: file,
    PORT: String(port),
    HOST: '127.0.0.1',
    APP_ORIGIN: base,
    SECURE_COOKIES: 'false',
  },
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stderr.on('data', (b) => {
  output += b;
});
await new Promise((resolve, reject) => {
  const timeout = setTimeout(
    () => reject(Error('Isolated server did not start: ' + output)),
    20000,
  );
  server.stdout.on('data', (b) => {
    output += b;
    if (output.includes('VERSE ·')) {
      clearTimeout(timeout);
      resolve();
    }
  });
  server.on('exit', (code) => {
    clearTimeout(timeout);
    reject(Error(`Isolated server exited ${code}: ${output}`));
  });
});
function client() {
  let cookie = '',
    csrf = '';
  return {
    async request(route, method = 'GET', body, extra = {}) {
      const r = await fetch(base + '/api' + route, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
          ...(method !== 'GET' ? { 'X-CSRF-Token': csrf, Origin: base } : {}),
          ...extra,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const set = r.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      const data = await r.json();
      if (data.csrf) csrf = data.csrf;
      return { status: r.status, data };
    },
  };
}
const customer = client(),
  admin = client();
test('API rejects missing CSRF and forged origins', async () => {
  await customer.request('/session');
  const missing = await customer.request('/auth/register', 'POST', {}, { 'X-CSRF-Token': '' });
  assert.equal(missing.status, 403);
  const forged = await customer.request(
    '/consent',
    'POST',
    { analytics: true },
    { Origin: 'https://untrusted.invalid' },
  );
  assert.equal(forged.status, 403);
});
test('registration ignores attempted admin escalation and customer cannot read admin data', async () => {
  const r = await customer.request('/auth/register', 'POST', {
    name: 'Isolated test customer',
    email: 'customer@example.invalid',
    password: 'isolated-test-password-long',
    role: 'admin',
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.role, 'customer');
  assert.equal((await customer.request('/admin/tables/users')).status, 403);
  assert.equal((await customer.request('/admin/business', 'POST', {})).status, 403);
});
test('analytics requires explicit consent and withdrawal stops collection', async () => {
  assert.equal((await customer.request('/analytics/view', 'POST', { route: 'home' })).status, 403);
  assert.equal((await customer.request('/consent', 'POST', { analytics: true })).status, 200);
  assert.equal((await customer.request('/analytics/view', 'POST', { route: 'home' })).status, 200);
  await customer.request('/consent', 'POST', { analytics: false });
  assert.equal((await customer.request('/analytics/view', 'POST', { route: 'home' })).status, 403);
});
test('admin login exposes business data without password hashes or session tables', async () => {
  await admin.request('/session');
  const login = await admin.request('/auth/login', 'POST', {
    email: 'admin@example.invalid',
    password: 'isolated-test-password-long',
  });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.role, 'admin');
  const rows = await admin.request('/admin/tables/users');
  assert.equal(rows.status, 200);
  assert.equal(rows.data.length, 2);
  assert.ok(rows.data.every((u) => !('password_hash' in u)));
  assert.equal((await admin.request('/admin/tables/sessions')).status, 404);
  const overview = await admin.request('/admin/overview');
  assert.equal(overview.status, 200);
  assert.equal(overview.data.received_minor, 0);
  assert.equal(overview.data.orders, 0);
});
test('unauthenticated customers and readiness gates cannot bypass checkout', async () => {
  const guest = client();
  await guest.request('/session');
  assert.equal((await guest.request('/orders', 'POST', {})).status, 401);
  const attempt = await customer.request('/orders', 'POST', {
    idempotency_key: 'isolated-api-checkout',
  });
  assert.equal(attempt.status, 409);
  assert.match(attempt.data.error, /awaiting business/);
});
test.after(async () => {
  server.kill();
  await new Promise((resolve) => server.once('exit', resolve));
  const resolved = path.resolve(tmp);
  if (
    !resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(resolved).startsWith('verse-api-test-')
  )
    throw Error('Unexpected test cleanup path.');
  await fs.rm(resolved, { recursive: true, force: true });
});
