import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
// Fixtures are isolated in memory and never enter the storefront database.
process.env.DB_DRIVER = 'sqlite';
process.env.DB_FILE = ':memory:';
const { db, transaction, close } = await import('../server/db.js');
const { placeOrder, changeOrderStatus, shippingFee, calculateTax } = await import(
  '../server/commerce.js'
);
const { hashPassword, verifyPassword } = await import('../server/security.js');
await db.exec(await fs.readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'));
await db.run(
  "INSERT INTO business_details(id,name,email,phone,legal_name,registration_number,registered_address,source_url,source_checked_at) VALUES(1,'Test only','test@example.invalid','0000000000','Test fixture','TEST','Isolated test database','test','2026-10-09')",
);
await db.run("UPDATE business_details SET tax_mode='exempt',tax_rate_bps=0 WHERE id=1");
for (const slug of ['terms', 'refund'])
  await db.run(
    'INSERT INTO policies(slug,title,sections_json,version,status,updated_at) VALUES(?,?,?,?,?,?)',
    [slug, slug, '[]', 'test.1', 'published', '2026-10-09'],
  );
await db.run(
  "INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES(1,'Test customer','customer@example.invalid','none','customer','2026-10-09'),(2,'Test admin','admin@example.invalid','none','admin','2026-10-09'),(3,'Other customer','other@example.invalid','none','customer','2026-10-09')",
);
await db.run("INSERT INTO brands(id,name) VALUES(1,'Test fixture')");
await db.run(
  "INSERT INTO products(id,brand_id,slug,name,full_name,model,description,gender,category,price_minor,stock_verified,source_url,source_checked_at) VALUES(1,1,'test','Test watch','Test watch','TEST','Test fixture','unisex','dress',100000,1,'test','2026-10-09')",
);
await db.run("INSERT INTO warehouses(id,name) VALUES(1,'Test warehouse')");
await db.run(
  'INSERT INTO inventory(product_id,warehouse_id,on_hand,cost_minor) VALUES(1,1,3,50000)',
);
await db.run(
  "INSERT INTO shipping_zones(id,name,fee_minor,free_over_minor,cod_limit_minor,delivery_note,source_url) VALUES(1,'Test Dhaka',7000,500000,10000000,'Test only','test')",
);
const customer = { id: 1 },
  base = {
    idempotency_key: 'isolated-test-order-001',
    recipient_name: 'Test only',
    phone: '0000000000',
    address: 'Isolated fixture',
    city: 'Test',
    shipping_zone_id: 1,
    payment_method: 'cod',
    terms_consent: true,
    items: [{ product_id: 1, quantity: 1 }],
  };
test('password hashes are salted and verified without storing plaintext', () => {
  const a = hashPassword('test-password-long'),
    b = hashPassword('test-password-long');
  assert.notEqual(a, b);
  assert.equal(verifyPassword('test-password-long', a), true);
  assert.equal(verifyPassword('wrong', a), false);
});
test('free shipping uses the published above-threshold condition', () => {
  const zone = { fee_minor: 7000, free_over_minor: 500000 };
  assert.equal(shippingFee(zone, 500000), 7000);
  assert.equal(shippingFee(zone, 500001), 0);
});
test('tax treatment is explicit and handles inclusive/exclusive prices in integer paisa', () => {
  assert.deepEqual(calculateTax({ tax_mode: 'exclusive', tax_rate_bps: 1500 }, 100000), {
    added: 15000,
    included: 0,
  });
  assert.deepEqual(calculateTax({ tax_mode: 'inclusive', tax_rate_bps: 1500 }, 115000), {
    added: 0,
    included: 15000,
  });
  assert.deepEqual(calculateTax({ tax_mode: 'exempt', tax_rate_bps: 0 }, 100000), {
    added: 0,
    included: 0,
  });
});
test('checkout uses server prices, reserves stock and handles retries idempotently', async () => {
  const o = await transaction((t) => placeOrder(t, customer, { ...base, total_minor: 1 }));
  assert.equal(o.total_minor, 107000);
  const inv = await db.get('SELECT * FROM inventory WHERE id=1');
  assert.equal(inv.reserved, 1);
  const retry = await transaction((t) => placeOrder(t, customer, base));
  assert.equal(retry.id, o.id);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM orders')).count, 1);
  assert.equal((await db.get('SELECT * FROM inventory WHERE id=1')).reserved, 1);
});
test('another customer cannot reuse a request key or cancel an order', async () => {
  await assert.rejects(() => transaction((t) => placeOrder(t, { id: 3 }, base)), /already used/);
  await assert.rejects(
    () => transaction((t) => changeOrderStatus(t, 1, 'cancelled', 3, false)),
    /not found/,
  );
});
test('overselling rolls back all mutations', async () => {
  await assert.rejects(
    () =>
      transaction((t) =>
        placeOrder(t, customer, {
          ...base,
          idempotency_key: 'isolated-oversell-001',
          items: [{ product_id: 1, quantity: 3 }],
        }),
      ),
    /unavailable/,
  );
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM orders')).count, 1);
  assert.equal((await db.get('SELECT * FROM inventory WHERE id=1')).reserved, 1);
});
test('shipment requires tracking and deducts reserved stock exactly once', async () => {
  await transaction((t) => changeOrderStatus(t, 1, 'confirmed', 2, true));
  await transaction((t) => changeOrderStatus(t, 1, 'packed', 2, true));
  await assert.rejects(
    () => transaction((t) => changeOrderStatus(t, 1, 'shipped', 2, true)),
    /tracking/,
  );
  assert.equal((await db.get('SELECT * FROM inventory WHERE id=1')).reserved, 1);
  await transaction((t) =>
    changeOrderStatus(t, 1, 'shipped', 2, true, {
      carrier: 'Test fixture',
      tracking_number: 'TEST-ONLY',
      shipping_cost_minor: 0,
    }),
  );
  const inv = await db.get('SELECT * FROM inventory WHERE id=1');
  assert.equal(inv.on_hand, 2);
  assert.equal(inv.reserved, 0);
  await assert.rejects(
    () => transaction((t) => changeOrderStatus(t, 1, 'shipped', 2, true, {})),
    /not available/,
  );
  await assert.rejects(
    () => transaction((t) => changeOrderStatus(t, 1, 'cancelled', 1, false)),
    /not available/,
  );
});
test('cancellation releases inventory without claiming a refund', async () => {
  const o = await transaction((t) =>
    placeOrder(t, customer, { ...base, idempotency_key: 'isolated-cancel-order' }),
  );
  await transaction((t) => changeOrderStatus(t, o.id, 'cancelled', 1, false));
  const inv = await db.get('SELECT * FROM inventory WHERE id=1');
  assert.equal(inv.on_hand, 2);
  assert.equal(inv.reserved, 0);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM refunds')).count, 0);
});
test('checkout snapshots tax and applies delivery thresholds to pre-tax product value', async () => {
  await db.run("UPDATE business_details SET tax_mode='inclusive',tax_rate_bps=1500 WHERE id=1");
  await db.run('UPDATE products SET price_minor=550000 WHERE id=1');
  const inclusive = await transaction((t) =>
    placeOrder(t, customer, { ...base, idempotency_key: 'isolated-inclusive-tax' }),
  );
  assert.equal(inclusive.included_tax_minor, 71739);
  assert.equal(inclusive.tax_minor, 0);
  assert.equal(inclusive.shipping_minor, 7000);
  assert.equal(inclusive.total_minor, 557000);
  await db.run("UPDATE business_details SET tax_mode='exclusive' WHERE id=1");
  const exclusive = await transaction((t) =>
    placeOrder(t, customer, { ...base, idempotency_key: 'isolated-exclusive-tax' }),
  );
  assert.equal(exclusive.tax_minor, 82500);
  assert.equal(exclusive.shipping_minor, 0);
  assert.equal(exclusive.total_minor, 632500);
});
test('unpublished policies prevent checkout', async () => {
  await db.run("UPDATE policies SET status='draft' WHERE slug='terms'");
  await assert.rejects(
    () =>
      transaction((t) =>
        placeOrder(t, customer, { ...base, idempotency_key: 'isolated-policy-gate' }),
      ),
    /awaiting business/,
  );
});
test.after(async () => close());
