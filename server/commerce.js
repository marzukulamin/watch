import { HttpError, integer, requireText, now } from './security.js';
import { driver } from './db.js';
import { randomBytes } from 'node:crypto';
const lock = driver === 'mysql' ? ' FOR UPDATE' : '';
export function shippingFee(zone, subtotal) {
  return zone.free_over_minor !== null && subtotal > Number(zone.free_over_minor)
    ? 0
    : Number(zone.fee_minor);
}
export function calculateTax(business, subtotal) {
  const rate = business.tax_rate_bps || 0;
  return {
    added: business.tax_mode === 'exclusive' ? Math.round((subtotal * rate) / 10000) : 0,
    included:
      business.tax_mode === 'inclusive' ? Math.round((subtotal * rate) / (10000 + rate)) : 0,
  };
}
export async function audit(t, actor, action, entity, id) {
  await t.run(
    'INSERT INTO audit_log(actor_id,action,entity_type,entity_id,created_at) VALUES(?,?,?,?,?)',
    [actor, action, entity, String(id), now()],
  );
}
export async function placeOrder(t, user, body) {
  const key = requireText(body.idempotency_key, 'request key', 80);
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(key)) throw new HttpError(400, 'Invalid request key.');
  const existing = await t.get('SELECT * FROM orders WHERE idempotency_key=?', [key]);
  if (existing) {
    if (existing.user_id !== user.id) throw new HttpError(409, 'Request key already used.');
    return existing;
  }
  const business = await t.get('SELECT * FROM business_details WHERE id=1');
  const policies = await t.all(
    "SELECT slug,version,status FROM policies WHERE slug IN ('terms','refund')",
  );
  if (
    !business?.legal_name ||
    !business.registration_number ||
    !business.registered_address ||
    !business.tax_mode ||
    business.tax_rate_bps === null ||
    policies.length !== 2 ||
    policies.some((p) => p.status !== 'published')
  )
    throw new HttpError(
      409,
      'Ordering is awaiting business and policy confirmation. Please contact VERSE.',
    );
  if (body.terms_consent !== true)
    throw new HttpError(400, 'Please read and accept the terms and refund policy.');
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30)
    throw new HttpError(400, 'Your bag must contain 1–30 different products.');
  const zone = await t.get('SELECT * FROM shipping_zones WHERE id=? AND active=1', [
    integer(body.shipping_zone_id, 'delivery zone'),
  ]);
  if (!zone) throw new HttpError(400, 'Select a delivery zone.');
  const recipient = requireText(body.recipient_name, 'recipient name', 120),
    phone = requireText(body.phone, 'phone', 30),
    address = requireText(body.address, 'delivery address', 600),
    city = requireText(body.city, 'city', 120);
  if (!/^[+\d\s()-]{8,30}$/.test(phone)) throw new HttpError(400, 'Enter a valid phone number.');
  if (!['cod', 'manual_transfer'].includes(body.payment_method))
    throw new HttpError(400, 'Select a payment method.');
  let subtotal = 0;
  const items = [],
    seen = new Set();
  for (const item of [...body.items].sort((a, b) => a.product_id - b.product_id)) {
    const id = integer(item.product_id, 'product'),
      quantity = integer(item.quantity, 'quantity', 10);
    if (!quantity || seen.has(id)) throw new HttpError(400, 'Invalid bag quantities.');
    seen.add(id);
    const product = await t.get('SELECT * FROM products WHERE id=? AND published=1' + lock, [id]);
    if (!product || !product.stock_verified)
      throw new HttpError(409, 'Stock needs confirmation. Please contact VERSE.');
    const inv = await t.get(
      'SELECT * FROM inventory WHERE product_id=? AND on_hand-reserved>=? ORDER BY warehouse_id LIMIT 1' +
        lock,
      [id, quantity],
    );
    if (!inv) throw new HttpError(409, `${product.name} is unavailable in the requested quantity.`);
    subtotal += product.price_minor * quantity;
    items.push({ product, inv, quantity });
  }
  const tax = calculateTax(business, subtotal),
    netSubtotal = subtotal - tax.included,
    shipping = shippingFee(zone, netSubtotal),
    total = subtotal + shipping + tax.added;
  if (
    body.payment_method === 'cod' &&
    (netSubtotal > zone.cod_limit_minor || (zone.advance_required && shipping > 0))
  )
    throw new HttpError(
      400,
      'This delivery requires a manually confirmed transfer. Choose manual transfer or contact VERSE.',
    );
  const stamp = now(),
    reference = `VR-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const terms = policies.find((p) => p.slug === 'terms').version,
    refund = policies.find((p) => p.slug === 'refund').version;
  const result = await t.run(
    'INSERT INTO orders(reference,user_id,status,recipient_name,phone,address,city,postal_code,shipping_zone_id,subtotal_minor,shipping_minor,tax_minor,included_tax_minor,tax_mode,tax_rate_bps,total_minor,payment_method,idempotency_key,terms_version,refund_version,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [
      reference,
      user.id,
      'placed',
      recipient,
      phone,
      address,
      city,
      body.postal_code?.trim().slice(0, 20) || null,
      zone.id,
      subtotal,
      shipping,
      tax.added,
      tax.included,
      business.tax_mode,
      business.tax_rate_bps,
      total,
      body.payment_method,
      key,
      terms,
      refund,
      stamp,
    ],
  );
  for (const { product, inv, quantity } of items) {
    const changed = await t.run(
      'UPDATE inventory SET reserved=reserved+? WHERE id=? AND on_hand-reserved>=?',
      [quantity, inv.id, quantity],
    );
    if (!changed.changes) throw new HttpError(409, 'Stock has changed. Please try again.');
    await t.run(
      'INSERT INTO order_items(order_id,product_id,product_name,model,quantity,unit_price_minor,unit_cost_minor,warehouse_id) VALUES(?,?,?,?,?,?,?,?)',
      [
        result.id,
        product.id,
        product.name,
        product.model,
        quantity,
        product.price_minor,
        inv.cost_minor,
        inv.warehouse_id,
      ],
    );
  }
  await t.run(
    'INSERT INTO order_status_history(order_id,status,actor_id,created_at) VALUES(?,?,?,?)',
    [result.id, 'placed', user.id, stamp],
  );
  await t.run(
    'INSERT INTO consent_records(user_id,purpose,granted,policy_version,created_at) VALUES(?,?,?,?,?)',
    [user.id, 'order_terms', 1, `${terms};${refund}`, stamp],
  );
  return await t.get('SELECT * FROM orders WHERE id=?', [result.id]);
}
const next = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};
export async function changeOrderStatus(t, orderId, status, actor, isAdmin, shipment) {
  const order = await t.get('SELECT * FROM orders WHERE id=?' + lock, [orderId]);
  if (!order || (!isAdmin && order.user_id !== actor)) throw new HttpError(404, 'Order not found.');
  if (!isAdmin && status !== 'cancelled') throw new HttpError(403, 'Admin access required.');
  if (!next[order.status]?.includes(status))
    throw new HttpError(409, 'This status transition is not available.');
  if (status === 'shipped') {
    const zone = await t.get('SELECT * FROM shipping_zones WHERE id=?', [order.shipping_zone_id]);
    const paid = Number(
      (
        await t.get(
          'SELECT COALESCE(SUM(amount_minor),0) AS value FROM payments WHERE order_id=?',
          [order.id],
        )
      ).value,
    );
    const required =
      order.payment_method === 'manual_transfer'
        ? order.total_minor
        : zone.advance_required
          ? order.shipping_minor
          : 0;
    if (paid < required) throw new HttpError(409, 'Record the required payment before dispatch.');
    if (!shipment) throw new HttpError(400, 'Carrier and tracking details are required.');
    await t.run(
      'INSERT INTO shipments(order_id,carrier,tracking_number,shipped_at,shipping_cost_minor) VALUES(?,?,?,?,?)',
      [
        order.id,
        requireText(shipment.carrier, 'carrier'),
        requireText(shipment.tracking_number, 'tracking number'),
        now(),
        integer(shipment.shipping_cost_minor || 0, 'shipping cost'),
      ],
    );
  }
  if (status === 'cancelled' || status === 'shipped') {
    const items = await t.all('SELECT * FROM order_items WHERE order_id=? ORDER BY product_id', [
      order.id,
    ]);
    for (const item of items) {
      const inv = await t.get(
        'SELECT * FROM inventory WHERE product_id=? AND warehouse_id=?' + lock,
        [item.product_id, item.warehouse_id],
      );
      if (!inv || inv.reserved < item.quantity)
        throw new HttpError(
          409,
          'Inventory reservation is inconsistent; reconcile it before continuing.',
        );
      await t.run('UPDATE inventory SET reserved=reserved-?,on_hand=on_hand-? WHERE id=?', [
        item.quantity,
        status === 'shipped' ? item.quantity : 0,
        inv.id,
      ]);
      if (status === 'shipped')
        await t.run(
          'INSERT INTO inventory_movements(product_id,warehouse_id,quantity,reason,actor_id,created_at) VALUES(?,?,?,?,?,?)',
          [
            item.product_id,
            item.warehouse_id,
            -item.quantity,
            `Dispatch ${order.reference}`,
            actor,
            now(),
          ],
        );
    }
  }
  if (status === 'delivered')
    await t.run('UPDATE shipments SET delivered_at=? WHERE order_id=?', [now(), order.id]);
  await t.run('UPDATE orders SET status=? WHERE id=?', [status, order.id]);
  await t.run(
    'INSERT INTO order_status_history(order_id,status,actor_id,created_at) VALUES(?,?,?,?)',
    [order.id, status, actor, now()],
  );
  await audit(t, actor, `status:${status}`, 'order', order.id);
  return { ...order, status };
}
