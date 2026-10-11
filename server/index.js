import express from 'express';
import compression from 'compression';
import path from 'node:path';
import fs from 'node:fs/promises';
import { db, root, transaction, driver } from './db.js';
import {
  now,
  hashPassword,
  verifyPassword,
  tokenHash,
  randomToken,
  safeUser,
  HttpError,
  requireText,
  money,
  integer,
} from './security.js';
import { placeOrder, changeOrderStatus, audit } from './commerce.js';
const app = express();
app.disable('x-powered-by');
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) =>
      req.path === '/api/session' || req.path.startsWith('/api/auth/')
        ? false
        : compression.filter(req, res),
  }),
);
const production = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
const secure = process.env.SECURE_COOKIES === 'true';
if (production && !secure && (process.env.HOST || '127.0.0.1') !== '127.0.0.1')
  throw Error('Production deployment requires SECURE_COOKIES=true behind HTTPS.');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self' ${production ? '' : 'ws://localhost:* ws://127.0.0.1:*'}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`,
  );
  next();
});
app.use('/api', express.json({ limit: '40kb' }));
const limits = new Map();
const rateSalt = randomToken();
function limit(req, scope, max, minutes) {
  const key = tokenHash(`${rateSalt}:${req.ip}:${scope}`);
  const t = Date.now();
  let item = limits.get(key);
  if (!item || item.until < t) {
    item = { count: 0, until: t + minutes * 60000 };
    limits.set(key, item);
  }
  if (++item.count > max) throw new HttpError(429, 'Too many requests. Please try again later.');
}
const cleanup = setInterval(() => {
  for (const [key, item] of limits) if (item.until < Date.now()) limits.delete(key);
  db.run('DELETE FROM sessions WHERE expires_at<?', [now()]).catch(() => {});
}, 60000);
cleanup.unref();
app.use('/api', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    limit(req, 'api', 300, 1);
    const raw = req.headers.cookie
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('verse_session='))
      ?.slice(14);
    if (raw && /^[a-f0-9]{64}$/.test(raw)) {
      req.session = await db.get('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?', [
        tokenHash(raw),
        now(),
      ]);
    }
    if (!req.session) {
      const token = randomToken();
      req.session = {
        token_hash: tokenHash(token),
        user_id: null,
        csrf_token: randomToken(),
        analytics_consent: 0,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      };
      await db.run(
        'INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES(?,?,?,?)',
        [req.session.token_hash, null, req.session.csrf_token, req.session.expires_at],
      );
      res.cookie('verse_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        maxAge: 7 * 86400000,
        path: '/',
      });
    }
    req.user = req.session.user_id
      ? await db.get('SELECT * FROM users WHERE id=?', [req.session.user_id])
      : null;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin,
        expected = process.env.APP_ORIGIN || `http://${req.headers.host}`;
      if (origin && origin !== expected) throw new HttpError(403, 'Request origin not allowed.');
      if (req.headers['x-csrf-token'] !== req.session.csrf_token)
        throw new HttpError(403, 'Your session changed. Reload and try again.');
    }
    next();
  } catch (e) {
    next(e);
  }
});
const login = (req, res, next) =>
  req.user ? next() : next(new HttpError(401, 'Please sign in to continue.'));
const admin = (req, res, next) =>
  req.user?.role === 'admin' ? next() : next(new HttpError(403, 'Admin access required.'));
async function renew(req, res, user) {
  await db.run('DELETE FROM sessions WHERE token_hash=?', [req.session.token_hash]);
  const token = randomToken(),
    csrf = randomToken();
  await db.run(
    'INSERT INTO sessions(token_hash,user_id,csrf_token,analytics_consent,expires_at) VALUES(?,?,?,?,?)',
    [
      tokenHash(token),
      user.id,
      csrf,
      req.session.analytics_consent,
      new Date(Date.now() + 7 * 86400000).toISOString(),
    ],
  );
  res.cookie('verse_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: 7 * 86400000,
    path: '/',
  });
  return { user: safeUser(user), csrf };
}
const asyncRoute = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    next(e);
  }
};
app.get(
  '/api/session',
  asyncRoute(async (req, res) =>
    res.json({
      user: safeUser(req.user),
      csrf: req.session.csrf_token,
      analytics_consent: !!req.session.analytics_consent,
    }),
  ),
);
app.get(
  '/api/store',
  asyncRoute(async (req, res) => {
    const [business, locations, brands, zones, policies, content] = await Promise.all([
      db.get('SELECT * FROM business_details WHERE id=1'),
      db.all('SELECT * FROM locations WHERE active=1'),
      db.all('SELECT * FROM brands ORDER BY name'),
      db.all('SELECT * FROM shipping_zones WHERE active=1'),
      db.all('SELECT slug,title,version,status FROM policies'),
      db.all('SELECT * FROM site_content'),
    ]);
    res.json({
      business,
      locations,
      brands,
      zones,
      policies,
      content: Object.fromEntries(content.map((c) => [c.section, JSON.parse(c.content_json)])),
      checkout_ready:
        !!business?.legal_name &&
        !!business.registration_number &&
        !!business.registered_address &&
        !!business.tax_mode &&
        business.tax_rate_bps !== null &&
        ['terms', 'refund'].every(
          (s) => policies.find((p) => p.slug === s)?.status === 'published',
        ),
    });
  }),
);
app.get(
  '/api/products',
  asyncRoute(async (req, res) => {
    const rows = await db.all(
      'SELECT p.*,b.name AS brand,(SELECT path FROM product_images WHERE product_id=p.id ORDER BY position LIMIT 1) AS image,COALESCE((SELECT SUM(on_hand-reserved) FROM inventory WHERE product_id=p.id),0) AS stock FROM products p JOIN brands b ON b.id=p.brand_id WHERE p.published=1 ORDER BY p.featured DESC,p.id',
    );
    res.json(rows);
  }),
);
app.get(
  '/api/products/:slug',
  asyncRoute(async (req, res) => {
    const p = await db.get(
      'SELECT p.*,b.name AS brand,COALESCE((SELECT SUM(on_hand-reserved) FROM inventory WHERE product_id=p.id),0) AS stock FROM products p JOIN brands b ON b.id=p.brand_id WHERE p.slug=? AND p.published=1',
      [req.params.slug],
    );
    if (!p) throw new HttpError(404, 'Watch not found.');
    p.images = await db.all('SELECT * FROM product_images WHERE product_id=? ORDER BY position', [
      p.id,
    ]);
    p.specs = await db.all('SELECT label,value FROM product_specs WHERE product_id=? ORDER BY id', [
      p.id,
    ]);
    res.json(p);
  }),
);
app.get(
  '/api/policies/:slug',
  asyncRoute(async (req, res) => {
    const p = await db.get('SELECT * FROM policies WHERE slug=?', [req.params.slug]);
    if (!p) throw new HttpError(404, 'Policy not found.');
    res.json({ ...p, sections: JSON.parse(p.sections_json) });
  }),
);
app.post(
  '/api/auth/register',
  asyncRoute(async (req, res) => {
    limit(req, 'auth', 10, 15);
    const name = requireText(req.body.name, 'name', 120),
      email = requireText(req.body.email, 'email').toLowerCase(),
      password = requireText(req.body.password, 'password', 256);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new HttpError(400, 'Enter a valid email address.');
    if (password.length < 12) throw new HttpError(400, 'Use a password of at least 12 characters.');
    const policy = await db.get("SELECT version FROM policies WHERE slug='privacy'");
    const result = await transaction(async (t) => {
      if (await t.get('SELECT id FROM users WHERE email=?', [email]))
        throw new HttpError(409, 'An account already uses this email. Sign in instead.');
      const r = await t.run(
        'INSERT INTO users(name,email,password_hash,role,created_at) VALUES(?,?,?,?,?)',
        [name, email, hashPassword(password), 'customer', now()],
      );
      return t.get('SELECT * FROM users WHERE id=?', [r.id]);
    });
    res.status(201).json(await renew(req, res, result));
  }),
);
app.post(
  '/api/auth/login',
  asyncRoute(async (req, res) => {
    limit(req, 'auth', 10, 15);
    const email = requireText(req.body.email, 'email').toLowerCase(),
      password = requireText(req.body.password, 'password', 256);
    const user = await db.get('SELECT * FROM users WHERE email=?', [email]);
    const dummy = '7d2bb0738e72a9a6e240f28fb368a38f:00'.padEnd(161, '0');
    if (!verifyPassword(password, user?.password_hash || dummy) || !user)
      throw new HttpError(401, 'Email or password is incorrect.');
    res.json(await renew(req, res, user));
  }),
);
app.post(
  '/api/auth/logout',
  asyncRoute(async (req, res) => {
    await db.run('DELETE FROM sessions WHERE token_hash=?', [req.session.token_hash]);
    res.clearCookie('verse_session', { path: '/', httpOnly: true, sameSite: 'lax', secure });
    res.json({ ok: true });
  }),
);
app.post(
  '/api/consent',
  asyncRoute(async (req, res) => {
    if (typeof req.body.analytics !== 'boolean')
      throw new HttpError(400, 'Choose an analytics preference.');
    await transaction(async (t) => {
      await t.run('UPDATE sessions SET analytics_consent=? WHERE token_hash=?', [
        req.body.analytics ? 1 : 0,
        req.session.token_hash,
      ]);
      if (req.user) {
        const cookiePolicy = await t.get('SELECT version FROM policies WHERE slug=?', ['cookies']);
        await t.run(
          'INSERT INTO consent_records(user_id,purpose,granted,policy_version,created_at) VALUES(?,?,?,?,?)',
          [
            req.user.id,
            'analytics',
            req.body.analytics ? 1 : 0,
            cookiePolicy?.version || 'unpublished',
            now(),
          ],
        );
      }
    });
    res.json({ ok: true });
  }),
);
app.post(
  '/api/analytics/view',
  asyncRoute(async (req, res) => {
    if (!req.session.analytics_consent) throw new HttpError(403, 'Analytics consent is required.');
    limit(req, 'analytics', 30, 1);
    const route = String(req.body.route);
    if (!['home', 'collection', 'product', 'stores', 'policy'].includes(route))
      throw new HttpError(400, 'Invalid route category.');
    const day = now().slice(0, 10);
    const sql =
      driver === 'mysql'
        ? 'INSERT INTO analytics_daily(day,route,views) VALUES(?,?,1) ON DUPLICATE KEY UPDATE views=views+1'
        : 'INSERT INTO analytics_daily(day,route,views) VALUES(?,?,1) ON CONFLICT(day,route) DO UPDATE SET views=views+1';
    await db.run(sql, [day, route]);
    res.json({ ok: true });
  }),
);
async function ordersFor(user, all = false) {
  const orders = await db.all(
    `SELECT o.*,COALESCE((SELECT SUM(amount_minor) FROM payments WHERE order_id=o.id),0) AS paid_minor,COALESCE((SELECT SUM(amount_minor) FROM refunds WHERE order_id=o.id),0) AS refunded_minor FROM orders o ${all ? '' : 'WHERE user_id=?'} ORDER BY o.id DESC LIMIT 100`,
    all ? [] : [user.id],
  );
  for (const o of orders) {
    o.items = await db.all('SELECT * FROM order_items WHERE order_id=?', [o.id]);
    o.shipment = await db.get('SELECT * FROM shipments WHERE order_id=?', [o.id]);
    o.history = await db.all(
      'SELECT status,note,created_at FROM order_status_history WHERE order_id=? ORDER BY id',
      [o.id],
    );
    o.refund_requests = await db.all('SELECT * FROM refund_requests WHERE order_id=?', [o.id]);
  }
  return orders;
}
app.get(
  '/api/orders',
  login,
  asyncRoute(async (req, res) => res.json(await ordersFor(req.user))),
);
app.post(
  '/api/orders',
  login,
  asyncRoute(async (req, res) => {
    limit(req, 'orders', 15, 15);
    res.status(201).json(await transaction((t) => placeOrder(t, req.user, req.body)));
  }),
);
app.post(
  '/api/orders/:id/cancel',
  login,
  asyncRoute(async (req, res) =>
    res.json(
      await transaction((t) =>
        changeOrderStatus(
          t,
          integer(Number(req.params.id), 'order'),
          'cancelled',
          req.user.id,
          false,
        ),
      ),
    ),
  ),
);
app.post(
  '/api/orders/:id/refund',
  login,
  asyncRoute(async (req, res) => {
    const id = integer(Number(req.params.id), 'order'),
      reason = requireText(req.body.reason, 'reason', 1200);
    const r = await transaction(async (t) => {
      const order = await t.get('SELECT * FROM orders WHERE id=? AND user_id=?', [id, req.user.id]);
      if (!order) throw new HttpError(404, 'Order not found.');
      if (
        await t.get(
          "SELECT id FROM refund_requests WHERE order_id=? AND status IN ('requested','approved')",
          [id],
        )
      )
        throw new HttpError(409, 'A refund request is already under review.');
      return t.run(
        'INSERT INTO refund_requests(order_id,user_id,reason,requested_at) VALUES(?,?,?,?)',
        [id, req.user.id, reason, now()],
      );
    });
    res.status(201).json({ id: r.id });
  }),
);
// Admin endpoints expose operational records; password hashes and session secrets never leave the server.
app.use('/api/admin', admin);
const tables = [
  'business_details',
  'locations',
  'site_content',
  'users',
  'brands',
  'products',
  'product_specs',
  'product_images',
  'warehouses',
  'inventory',
  'inventory_movements',
  'shipping_zones',
  'policies',
  'orders',
  'order_items',
  'order_status_history',
  'shipments',
  'payments',
  'refund_requests',
  'refunds',
  'expenses',
  'consent_records',
  'analytics_daily',
  'audit_log',
];
app.get('/api/admin/tables', (req, res) => res.json(tables));
app.get(
  '/api/admin/tables/:table',
  asyncRoute(async (req, res) => {
    const table = req.params.table;
    if (!tables.includes(table)) throw new HttpError(404, 'Table not found.');
    const columns = table === 'users' ? 'id,name,email,role,created_at' : '*';
    res.json(await db.all(`SELECT ${columns} FROM ${table} LIMIT 300`));
  }),
);
app.get(
  '/api/admin/orders',
  asyncRoute(async (req, res) => res.json(await ordersFor(req.user, true))),
);
app.get(
  '/api/admin/overview',
  asyncRoute(async (req, res) => {
    const scalar = async (sql) => Number((await db.get(sql)).value || 0);
    const [
      orders,
      delivered,
      outstanding,
      received,
      refunded,
      expenses,
      shipmentCosts,
      customers,
      unknownCosts,
      costs,
      inventory,
    ] = await Promise.all([
      scalar('SELECT COUNT(*) AS value FROM orders'),
      scalar(
        "SELECT COALESCE(SUM(total_minor-tax_minor-included_tax_minor),0) AS value FROM orders WHERE status='delivered'",
      ),
      scalar(
        "SELECT COALESCE(SUM(total_minor-COALESCE((SELECT SUM(amount_minor) FROM payments WHERE order_id=orders.id),0)),0) AS value FROM orders WHERE status!='cancelled'",
      ),
      scalar('SELECT COALESCE(SUM(amount_minor),0) AS value FROM payments'),
      scalar('SELECT COALESCE(SUM(amount_minor),0) AS value FROM refunds'),
      scalar('SELECT COALESCE(SUM(amount_minor),0) AS value FROM expenses'),
      scalar('SELECT COALESCE(SUM(shipping_cost_minor),0) AS value FROM shipments'),
      scalar("SELECT COUNT(*) AS value FROM users WHERE role='customer'"),
      scalar(
        "SELECT COUNT(*) AS value FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status='delivered' AND i.unit_cost_minor IS NULL",
      ),
      scalar(
        "SELECT COALESCE(SUM(i.unit_cost_minor*i.quantity),0) AS value FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status='delivered'",
      ),
      db.all(
        'SELECT p.model,p.name,p.stock_verified,COALESCE(SUM(i.on_hand-i.reserved),0) AS available FROM products p LEFT JOIN inventory i ON p.id=i.product_id GROUP BY p.id,p.model,p.name,p.stock_verified',
      ),
    ]);
    res.json({
      orders,
      delivered_minor: delivered,
      outstanding_minor: outstanding,
      received_minor: received,
      refunded_minor: refunded,
      expenses_minor: expenses,
      shipping_costs_minor: shipmentCosts,
      customers,
      margin_minor: unknownCosts ? null : delivered - refunded - costs - expenses - shipmentCosts,
      missing_costs: unknownCosts,
      inventory,
      analytics: await db.all('SELECT * FROM analytics_daily ORDER BY day DESC LIMIT 90'),
    });
  }),
);
app.post(
  '/api/admin/business',
  asyncRoute(async (req, res) => {
    const b = req.body;
    await transaction(async (t) => {
      await t.run(
        'UPDATE business_details SET name=?,email=?,phone=?,complaint_phone=?,legal_name=?,registration_number=?,registered_address=?,tax_mode=?,tax_rate_bps=? WHERE id=1',
        [
          requireText(b.name, 'trading name'),
          requireText(b.email, 'email'),
          requireText(b.phone, 'phone'),
          b.complaint_phone || null,
          requireText(b.legal_name, 'registered business name'),
          requireText(b.registration_number, 'registration number'),
          requireText(b.registered_address, 'registered address', 600),
          ['inclusive', 'exclusive', 'exempt'].includes(b.tax_mode)
            ? b.tax_mode
            : (() => {
                throw new HttpError(400, 'Confirm a tax treatment.');
              })(),
          b.tax_mode === 'exempt' ? 0 : integer(b.tax_rate_bps, 'tax rate', 10000),
        ],
      );
      await audit(t, req.user.id, 'update', 'business', 1);
    });
    res.json({ ok: true });
  }),
);
app.post(
  '/api/admin/warehouses',
  asyncRoute(async (req, res) => {
    const r = await transaction(async (t) => {
      const r = await t.run('INSERT INTO warehouses(name,address) VALUES(?,?)', [
        requireText(req.body.name, 'warehouse name'),
        requireText(req.body.address, 'warehouse address', 600),
      ]);
      await audit(t, req.user.id, 'create', 'warehouse', r.id);
      return r;
    });
    res.status(201).json(r);
  }),
);
app.post(
  '/api/admin/inventory',
  asyncRoute(async (req, res) => {
    const p = integer(req.body.product_id, 'product'),
      w = integer(req.body.warehouse_id, 'warehouse'),
      onHand = integer(req.body.on_hand, 'stock'),
      cost =
        req.body.cost_minor === null ? null : integer(req.body.cost_minor, 'unit cost', 1000000000),
      reason = requireText(req.body.reason, 'adjustment reason');
    await transaction(async (t) => {
      const old = await t.get(
        'SELECT * FROM inventory WHERE product_id=? AND warehouse_id=?' +
          (driver === 'mysql' ? ' FOR UPDATE' : ''),
        [p, w],
      );
      if (
        !(await t.get('SELECT id FROM products WHERE id=?', [p])) ||
        !(await t.get('SELECT id FROM warehouses WHERE id=?', [w]))
      )
        throw new HttpError(400, 'Choose an existing product and warehouse.');
      if (old && onHand < old.reserved)
        throw new HttpError(409, 'Stock cannot be lower than reserved quantity.');
      if (old)
        await t.run('UPDATE inventory SET on_hand=?,cost_minor=? WHERE id=?', [
          onHand,
          cost,
          old.id,
        ]);
      else
        await t.run(
          'INSERT INTO inventory(product_id,warehouse_id,on_hand,cost_minor) VALUES(?,?,?,?)',
          [p, w, onHand, cost],
        );
      await t.run('UPDATE products SET stock_verified=1 WHERE id=?', [p]);
      await t.run(
        'INSERT INTO inventory_movements(product_id,warehouse_id,quantity,reason,actor_id,created_at) VALUES(?,?,?,?,?,?)',
        [p, w, onHand - (old?.on_hand || 0), reason, req.user.id, now()],
      );
      await audit(t, req.user.id, 'verify-stock', 'product', p);
    });
    res.json({ ok: true });
  }),
);
app.post(
  '/api/admin/products/:id',
  asyncRoute(async (req, res) => {
    const id = integer(Number(req.params.id), 'product'),
      b = req.body;
    await transaction(async (t) => {
      if (!(await t.get('SELECT id FROM products WHERE id=?', [id])))
        throw new HttpError(404, 'Watch not found.');
      await t.run(
        'UPDATE products SET name=?,description=?,price_minor=?,published=?,featured=? WHERE id=?',
        [
          requireText(b.name, 'product name'),
          requireText(b.description, 'description', 5000),
          money(b.price_minor),
          b.published ? 1 : 0,
          b.featured ? 1 : 0,
          id,
        ],
      );
      await audit(t, req.user.id, 'update', 'product', id);
    });
    res.json({ ok: true });
  }),
);
app.post(
  '/api/admin/policies/:slug',
  asyncRoute(async (req, res) => {
    const b = req.body;
    const policy = await db.get('SELECT * FROM policies WHERE slug=?', [req.params.slug]);
    if (!policy) throw new HttpError(404, 'Policy not found.');
    if (!Array.isArray(b.sections) || !b.sections.length || b.sections.length > 20)
      throw new HttpError(400, 'Add policy sections.');
    const sections = b.sections.map((s) => ({
      heading: requireText(s.heading, 'section heading'),
      body: requireText(s.body, 'section text', 6000),
    }));
    if (!['draft', 'published'].includes(b.status))
      throw new HttpError(400, 'Choose draft or published.');
    const version = requireText(b.version, 'policy version', 80);
    if (version === policy.version)
      throw new HttpError(400, 'Use a new policy version when editing.');
    await transaction(async (t) => {
      await t.run(
        'UPDATE policies SET sections_json=?,version=?,status=?,updated_at=? WHERE id=?',
        [JSON.stringify(sections), version, b.status, now(), policy.id],
      );
      await audit(t, req.user.id, `policy:${b.status}`, 'policy', policy.id);
    });
    res.json({ ok: true });
  }),
);
app.post(
  '/api/admin/orders/:id/status',
  asyncRoute(async (req, res) =>
    res.json(
      await transaction((t) =>
        changeOrderStatus(
          t,
          integer(Number(req.params.id), 'order'),
          req.body.status,
          req.user.id,
          true,
          req.body.shipment,
        ),
      ),
    ),
  ),
);
app.post(
  '/api/admin/payments',
  asyncRoute(async (req, res) => {
    const b = req.body,
      id = integer(b.order_id, 'order'),
      amount = money(b.amount_minor);
    await transaction(async (t) => {
      const o = await t.get(
        'SELECT * FROM orders WHERE id=?' + (driver === 'mysql' ? ' FOR UPDATE' : ''),
        [id],
      );
      if (!o) throw new HttpError(404, 'Order not found.');
      if (o.status === 'cancelled')
        throw new HttpError(409, 'Cannot collect payment for a cancelled order.');
      const paid = Number(
        (
          await t.get(
            'SELECT COALESCE(SUM(amount_minor),0) AS value FROM payments WHERE order_id=?',
            [id],
          )
        ).value,
      );
      if (paid + amount > o.total_minor)
        throw new HttpError(409, 'Payment exceeds the outstanding amount.');
      const r = await t.run(
        'INSERT INTO payments(order_id,amount_minor,method,reference,actor_id,created_at) VALUES(?,?,?,?,?,?)',
        [
          id,
          amount,
          requireText(b.method, 'payment method'),
          requireText(b.reference, 'actual transaction reference'),
          req.user.id,
          now(),
        ],
      );
      await audit(t, req.user.id, 'record', 'payment', r.id);
    });
    res.json({ ok: true });
  }),
);
app.post(
  '/api/admin/expenses',
  asyncRoute(async (req, res) => {
    const b = req.body;
    await transaction(async (t) => {
      const r = await t.run(
        'INSERT INTO expenses(category,description,amount_minor,reference,actor_id,created_at) VALUES(?,?,?,?,?,?)',
        [
          requireText(b.category, 'category'),
          requireText(b.description, 'description', 600),
          money(b.amount_minor),
          requireText(b.reference, 'expense reference'),
          req.user.id,
          now(),
        ],
      );
      await audit(t, req.user.id, 'record', 'expense', r.id);
    });
    res.json({ ok: true });
  }),
);
app.post(
  '/api/admin/refunds/:id',
  asyncRoute(async (req, res) => {
    const id = integer(Number(req.params.id), 'refund request'),
      b = req.body;
    if (!['approved', 'declined', 'paid'].includes(b.status))
      throw new HttpError(400, 'Choose a valid decision.');
    await transaction(async (t) => {
      const r = await t.get(
        'SELECT * FROM refund_requests WHERE id=?' + (driver === 'mysql' ? ' FOR UPDATE' : ''),
        [id],
      );
      if (!r) throw new HttpError(404, 'Refund request not found.');
      if (r.status === 'paid' || r.status === 'declined')
        throw new HttpError(409, 'This refund decision is final.');
      if (b.status === 'paid' && r.status !== 'approved')
        throw new HttpError(409, 'Approve the request before recording a refund.');
      if (b.status === 'paid') {
        await t.get(
          'SELECT id FROM orders WHERE id=?' + (driver === 'mysql' ? ' FOR UPDATE' : ''),
          [r.order_id],
        );
        const paid = Number(
            (
              await t.get(
                'SELECT COALESCE(SUM(amount_minor),0) AS value FROM payments WHERE order_id=?',
                [r.order_id],
              )
            ).value,
          ),
          refunded = Number(
            (
              await t.get(
                'SELECT COALESCE(SUM(amount_minor),0) AS value FROM refunds WHERE order_id=?',
                [r.order_id],
              )
            ).value,
          );
        const amount = money(b.amount_minor);
        if (amount > paid - refunded)
          throw new HttpError(409, 'Refund exceeds the unrefunded payment balance.');
        await t.run(
          'INSERT INTO refunds(request_id,order_id,amount_minor,reference,actor_id,created_at) VALUES(?,?,?,?,?,?)',
          [
            id,
            r.order_id,
            amount,
            requireText(b.reference, 'actual refund reference'),
            req.user.id,
            now(),
          ],
        );
      }
      await t.run('UPDATE refund_requests SET status=?,decision_note=? WHERE id=?', [
        b.status,
        requireText(b.decision_note, 'decision note', 1200),
        id,
      ]);
      await audit(t, req.user.id, `refund:${b.status}`, 'refund_request', id);
    });
    res.json({ ok: true });
  }),
);
app.get(
  '/api/health',
  asyncRoute(async (req, res) => {
    await db.get('SELECT id FROM business_details LIMIT 1');
    res.json({ ok: true });
  }),
);
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
if (production) {
  const dist = path.join(root, 'dist');
  await fs.access(path.join(dist, 'index.html'));
  app.use('/assets', express.static(path.join(dist, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('/{*path}', async (req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root,
    server: { middlewareMode: true, fs: { allow: [root] }, hmr: { host: 'localhost' } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const duplicate = /UNIQUE|Duplicate entry/i.test(err.message || '');
  const status = err.status || (duplicate ? 409 : 500);
  if (status === 500) console.error('Server error:', err.message);
  res.status(status).json({
    error:
      status === 500
        ? 'The request could not be completed. Please try again.'
        : duplicate
          ? 'This reference is already recorded.'
          : err.message,
  });
});
const port = Number(process.env.PORT || 3000),
  host = process.env.HOST || '127.0.0.1';
app.listen(port, host, () =>
  console.log(
    `VERSE · http://${host}:${port} · ${driver} · ${production ? 'production' : 'development'}`,
  ),
);
