import { api, post, user, escapeHtml as e, currency as money, date } from './api.js';
import { panelMotion } from './motion.js';
let current = 'overview',
  storeData,
  productData,
  onRefresh,
  toast;
const formError = '<p class="form-error" role="alert" tabindex="-1" hidden></p>';
const field = (name, label, value = '', type = 'text', extra = '') =>
  `<div class="field"><label for="admin-${name}">${label}</label><input id="admin-${name}" name="${name}" type="${type}" value="${e(value)}" ${extra}></div>`;
const amount = (name, label) => field(name, label, '', 'number', 'required min="0.01" step="0.01"');
const select = (name, label, options) =>
  `<div class="field"><label for="admin-${name}">${label}</label><select id="admin-${name}" name="${name}" required>${options.map(([v, t]) => `<option value="${e(v)}">${e(t)}</option>`).join('')}</select></div>`;
const form = (id, html, submit = 'Save record') =>
  `<form class="form-panel admin-form" id="${id}">${html}${formError}<button class="button">${submit}</button></form>`;
function table(rows, columns) {
  if (!rows.length)
    return '<div class="empty-state compact"><h3>No records yet.</h3><p>This view will fill with actual business activity.</p></div>';
  const cols = columns || Object.keys(rows[0]);
  return `<div class="table-scroll" role="region" aria-label="Business data" tabindex="0"><table><thead><tr>${cols.map((c) => `<th scope="col">${e(c.replaceAll('_', ' '))}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${r[c] === null ? '—' : e(typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
export async function renderAdmin(store, products, account) {
  storeData = store;
  productData = products;
  if (account?.role !== 'admin')
    return `<main id="main" tabindex="-1" class="page-main section"><div class="empty-state"><p class="eyebrow accent">VERSE BUSINESS</p><h1 class="display medium">Business access.</h1><p>Sign in with an authorised admin account to manage the catalogue, inventory, delivery and financial records.</p><a class="button" href="/account?next=/admin">Admin sign in →</a></div></main>`;
  return `<main id="main" tabindex="-1" class="page-main admin-main"><section class="section admin-intro"><p class="eyebrow accent">VERSE / BUSINESS</p><h1 class="display small">The control room.</h1><p>Inventory. Delivery. The numbers that matter.</p></section><div class="admin-layout"><nav class="admin-nav" aria-label="Business dashboard">${[
    ['overview', 'Overview'],
    ['orders', 'Orders & delivery'],
    ['catalog', 'Catalogue'],
    ['inventory', 'Stock & warehouses'],
    ['finance', 'Payments & expenses'],
    ['refunds', 'Refund requests'],
    ['policies', 'Policies'],
    ['business', 'Business details'],
    ['data', 'Database explorer'],
  ]
    .map(
      ([id, text]) =>
        `<button data-admin-view="${id}" ${current === id ? 'aria-current="page"' : ''}>${text}</button>`,
    )
    .join(
      '',
    )}</nav><section class="admin-content" id="admin-content" aria-live="polite">${await view(current)}</section></div></main>`;
}
async function view(name) {
  if (name === 'overview') {
    const d = await api('/admin/overview');
    return `<h2>Business overview</h2><div class="metrics-grid">${[
      ['Orders', String(d.orders)],
      ['Customers', String(d.customers)],
      ['Delivered sales', money(d.delivered_minor)],
      ['Payments collected', money(d.received_minor)],
      ['Outstanding', money(d.outstanding_minor)],
      ['Refunds paid', money(d.refunded_minor)],
      ['Expenses', money(d.expenses_minor)],
      ['Recorded margin', d.margin_minor === null ? 'Cost data incomplete' : money(d.margin_minor)],
    ]
      .map(
        ([label, value]) =>
          `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`,
      )
      .join(
        '',
      )}</div><p class="form-hint">Delivered sales reflect completed deliveries. Payments collected reflect actual receipts. Recorded margin uses delivered item costs, refunds, expenses and carrier costs; it is not a statutory profit statement.${d.missing_costs ? ` ${d.missing_costs} delivered item records need costs.` : ''}</p><h3>Inventory readiness</h3>${table(d.inventory, ['model', 'name', 'stock_verified', 'available'])}<h3>Consented page visits</h3><p class="form-hint">Aggregate first-party counters only. No consent means no page-view record.</p>${table(d.analytics, ['day', 'route', 'views'])}`;
  }
  if (name === 'business') {
    const b = storeData.business;
    return `<h2>Business details</h2><p>Enter the real registered operator before activating live orders.</p>${form(
      'admin-business',
      field('name', 'Trading name', b.name, 'text', 'required') +
        field('email', 'Customer service email', b.email, 'email', 'required') +
        field('phone', 'Online phone', b.phone, 'tel', 'required') +
        field('complaint_phone', 'Customer care phone', b.complaint_phone, 'tel') +
        field('legal_name', 'Registered operator', b.legal_name, 'text', 'required') +
        field(
          'registration_number',
          'Business registration number',
          b.registration_number,
          'text',
          'required',
        ) +
        field(
          'registered_address',
          'Registered address',
          b.registered_address,
          'text',
          'required maxlength="600"',
        ) +
        select('tax_mode', 'Confirmed product tax treatment', [
          ['', 'Select the actual tax treatment'],
          ['inclusive', 'Listed prices include tax'],
          ['exclusive', 'Add tax to listed prices'],
          ['exempt', 'No product tax applies'],
        ]) +
        field(
          'tax_rate',
          'Applicable product tax rate (%)',
          b.tax_rate_bps === null ? '' : b.tax_rate_bps / 100,
          'number',
          'min="0" max="100" step="0.01"',
        ) +
        '<p class="form-hint">Use the business’s confirmed tax treatment; do not infer an exemption. Shipping fees are final charges under the published zone terms.</p>',
      'Save business details',
    )}<h3>Store contacts</h3>${table(storeData.locations, ['name', 'address', 'phone'])}<p class="form-hint">Manage additional source-backed store and zone records in phpMyAdmin. Never expose phpMyAdmin publicly.</p>`;
  }
  if (name === 'catalog') {
    productData = (await api('/admin/tables/products')).map((p) => ({
      ...p,
      brand: storeData.brands.find((b) => b.id === p.brand_id)?.name || '',
    }));
    return `<h2>Catalogue</h2><p>Product descriptions and prices are source-backed; make changes only from confirmed brand records.</p><div class="admin-catalog">${productData.map((p) => `<div class="admin-product"><div><strong>${e(p.brand)} · ${e(p.name)}</strong><span>${e(p.model)} · ${money(p.price_minor)}</span></div><button class="button button-outline" data-edit-product="${p.id}">Edit</button></div>`).join('')}</div>`;
  }
  if (name === 'inventory') {
    const [warehouses, inventory] = await Promise.all([
      api('/admin/tables/warehouses'),
      api('/admin/tables/inventory'),
    ]);
    return `<h2>Inventory & warehouses</h2><p>Imported availability is separate from verified physical stock. Record the real stock count and purchase cost.</p><div class="admin-form-grid">${form('admin-warehouse', '<h3>Add warehouse</h3>' + field('name', 'Warehouse name', '', 'text', 'required') + field('address', 'Warehouse address', '', 'text', 'required'), 'Add warehouse')}${form(
      'admin-inventory',
      '<h3>Verify stock</h3>' +
        select(
          'product_id',
          'Watch',
          productData.map((p) => [p.id, `${p.brand} ${p.model}`]),
        ) +
        select(
          'warehouse_id',
          'Warehouse',
          warehouses.length
            ? warehouses.map((w) => [w.id, w.name])
            : [['', 'Add a warehouse first']],
        ) +
        field('on_hand', 'Physical quantity', '', 'number', 'required min="0" step="1"') +
        field('cost', 'Unit purchase cost in BDT (optional)', '', 'number', 'min="0" step="0.01"') +
        field('reason', 'Reason for adjustment', '', 'text', 'required'),
      'Record verified stock',
    )}</div><h3>Warehouse balances</h3>${table(inventory)}<h3>Warehouses</h3>${table(warehouses)}`;
  }
  if (name === 'orders') {
    const orders = await api('/admin/orders');
    return `<h2>Orders & delivery</h2><p>Confirm, pack, and dispatch only after inventory and payment requirements are met.</p>${orders.length ? orders.map((o) => `<article class="order-card"><div class="order-heading"><strong>${e(o.reference)}</strong><span class="status-pill">${e(o.status)}</span><strong>${money(o.total_minor)}</strong></div><p>${e(o.recipient_name)} · ${e(o.phone)}</p><p>${e(o.address)}, ${e(o.city)}</p>${o.items.map((i) => `<p>${e(i.product_name)} / ${e(i.model)} × ${i.quantity}</p>`).join('')}<p>Payment received: ${money(o.paid_minor)} · ${e(o.payment_method)}</p>${o.shipment ? `<p>${e(o.shipment.carrier)} / ${e(o.shipment.tracking_number)}</p>` : ''}<div class="order-actions">${({ placed: ['confirmed', 'cancelled'], confirmed: ['packed', 'cancelled'], packed: ['shipped', 'cancelled'], shipped: ['delivered'] }[o.status] || []).map((status) => `<button class="button button-outline" data-order-status="${status}" data-order-id="${o.id}">${status === 'shipped' ? 'Dispatch with tracking' : status === 'cancelled' ? 'Cancel' : `Mark ${status}`}</button>`).join('')}</div></article>`).join('') : '<div class="empty-state compact"><h3>No orders yet.</h3><p>Real customer orders will appear here.</p></div>'}`;
  }
  if (name === 'finance') {
    const [orders, payments, expenses] = await Promise.all([
      api('/admin/orders'),
      api('/admin/tables/payments'),
      api('/admin/tables/expenses'),
    ]);
    return `<h2>Payments & expenses</h2><p>Record transactions after money actually changes hands. No payment gateway or automatic collection is active.</p><div class="admin-form-grid">${form(
      'admin-payment',
      '<h3>Record a receipt</h3>' +
        select(
          'order_id',
          'Order',
          orders.length
            ? orders
                .filter((o) => o.status !== 'cancelled')
                .map((o) => [
                  o.id,
                  `${o.reference} · ${money(o.total_minor - o.paid_minor)} outstanding`,
                ])
            : [['', 'No orders yet']],
        ) +
        amount('amount', 'Amount received in BDT') +
        select('method', 'Method', [
          ['cod', 'Cash on delivery'],
          ['bank_transfer', 'Bank transfer'],
          ['mobile_transfer', 'Mobile transfer'],
          ['cash', 'Cash'],
        ]) +
        field('reference', 'Actual receipt / transaction reference', '', 'text', 'required'),
      'Record received payment',
    )}${form('admin-expense', '<h3>Record an expense</h3>' + field('category', 'Category', '', 'text', 'required') + field('description', 'Description', '', 'text', 'required') + amount('amount', 'Amount in BDT') + field('reference', 'Actual invoice / expense reference', '', 'text', 'required'), 'Record expense')}</div><h3>Receipts</h3>${table(payments)}<h3>Expenses</h3>${table(expenses)}`;
  }
  if (name === 'refunds') {
    const rows = await api('/admin/tables/refund_requests');
    return `<h2>Refund requests</h2><p>Review eligibility against the published policy. Record a refund only after it has been paid.</p>${rows.length ? rows.map((r) => `<article class="order-card"><div class="order-heading"><strong>Request ${r.id} · Order ${r.order_id}</strong><span class="status-pill">${e(r.status)}</span></div><p>${e(r.reason)}</p><p>${date(r.requested_at)}</p>${r.decision_note ? `<p>${e(r.decision_note)}</p>` : ''}<div class="order-actions">${r.status === 'requested' ? `<button class="button button-outline" data-refund-decision="approved" data-refund-id="${r.id}">Approve</button><button class="button button-outline" data-refund-decision="declined" data-refund-id="${r.id}">Decline with explanation</button>` : ''}${r.status === 'approved' ? `<button class="button" data-refund-decision="paid" data-refund-id="${r.id}">Record paid refund</button>` : ''}</div></article>`).join('') : '<div class="empty-state compact"><h3>No refund requests.</h3></div>'}`;
  }
  if (name === 'policies') {
    const policies = await api('/admin/tables/policies');
    return `<h2>Policy management</h2><p>Confirm consistent terms and refund conditions before publishing. Use a new version for every revision; orders retain the version accepted at purchase.</p>${policies.map((p) => `<div class="admin-product"><div><strong>${e(p.title)}</strong><span>${e(p.status)} / ${e(p.version)}</span></div><button class="button button-outline" data-edit-policy="${e(p.slug)}">Review & edit</button></div>`).join('')}`;
  }
  if (name === 'data') {
    const tables = await api('/admin/tables');
    return `<h2>Database explorer</h2><p>Read operational records across all business tables. Password hashes and session secrets are excluded from the application UI.</p>${select(
      'database-table',
      'Table',
      tables.map((t) => [t, t.replaceAll('_', ' ')]),
    )}<div id="database-rows">${table(await api('/admin/tables/business_details'))}</div><p class="form-hint">Showing up to 300 records per table. Full database management is available through your local phpMyAdmin installation; connection instructions are in the project README.</p>`;
  }
}
function dialog(html) {
  document.querySelector('#admin-dialog')?.remove();
  const d = document.createElement('dialog');
  d.id = 'admin-dialog';
  d.className = 'admin-dialog';
  d.innerHTML = `<button class="dialog-close icon-button" aria-label="Close">×</button>${html}`;
  document.body.append(d);
  d.querySelector('.dialog-close').onclick = () => d.close();
  d.addEventListener('close', () => d.remove());
  d.showModal();
  panelMotion(d);
  return d;
}
async function load(name) {
  current = name;
  const area = document.querySelector('#admin-content');
  if (!area) return;
  area.setAttribute('aria-busy', 'true');
  try {
    area.innerHTML = await view(name);
    document.querySelectorAll('[data-admin-view]').forEach((b) => {
      if (b.dataset.adminView === name) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    panelMotion(area);
  } catch (err) {
    toast(err.message);
  } finally {
    area.removeAttribute('aria-busy');
  }
}
async function editProduct(id) {
  const p = productData.find((p) => p.id === id);
  dialog(
    `<h2>Edit ${e(p.model)}</h2>${form('admin-edit-product', field('id', 'Product ID', p.id, 'hidden') + field('name', 'Collection name', p.name, 'text', 'required') + `<div class="field"><label for="product-description">Description</label><textarea id="product-description" name="description" required rows="5" maxlength="5000">${e(p.description)}</textarea></div>` + field('amount', 'Price in BDT', p.price_minor / 100, 'number', 'required min="0.01" step="0.01"') + `<label class="checkbox-row"><input type="checkbox" name="published" ${p.published ? 'checked' : ''}> Published in collection</label><label class="checkbox-row"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}> Featured in the edit</label>`, 'Save product')}`,
  );
}
async function editPolicy(slug) {
  const p = await api(`/policies/${slug}`);
  dialog(
    `<h2>${e(p.title)}</h2>${form(
      'admin-edit-policy',
      field('slug', 'Policy', p.slug, 'hidden') +
        field(
          'version',
          'New policy version',
          `${new Date().toISOString().slice(0, 10)}.${Date.now().toString(36)}`,
          'text',
          'required',
        ) +
        select('status', 'Publication status', [
          ['draft', 'Draft — awaiting confirmation'],
          ['published', 'Publish confirmed policy'],
        ]) +
        `<div class="field"><label for="policy-sections">Sections (JSON array of heading and body)</label><textarea id="policy-sections" name="sections" rows="16" required spellcheck="false">${e(JSON.stringify(p.sections, null, 2))}</textarea></div><p class="form-hint">Publishing makes this version visible at checkout. Confirm facts, retention periods and refund conditions before saving.</p>`,
      'Save reviewed policy',
    )}`,
  );
}
export function bindAdmin(refresh, notify) {
  onRefresh = refresh;
  toast = notify;
  if (user?.role !== 'admin') return;
  const tax = document.querySelector('[name="tax_mode"]');
  if (tax) tax.value = storeData.business.tax_mode || '';
}
document.addEventListener('click', async (ev) => {
  if (user?.role !== 'admin') return;
  const b = ev.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.adminView) await load(b.dataset.adminView);
    if (b.dataset.editProduct) await editProduct(Number(b.dataset.editProduct));
    if (b.dataset.editPolicy) await editPolicy(b.dataset.editPolicy);
    if (b.dataset.orderStatus) {
      const status = b.dataset.orderStatus,
        id = Number(b.dataset.orderId);
      if (status === 'shipped')
        dialog(
          `<h2>Dispatch order</h2>${form('admin-dispatch', field('order_id', 'Order', id, 'hidden') + field('carrier', 'Carrier', '', 'text', 'required') + field('tracking_number', 'Tracking number', '', 'text', 'required') + field('shipping_cost', 'Actual carrier cost in BDT', 0, 'number', 'required min="0" step="0.01"'), 'Record shipment')}`,
        );
      else
        dialog(
          `<h2>${status === 'cancelled' ? 'Cancel order?' : `Mark ${e(status)}?`}</h2><p>This will update the real order and stock records.</p>${form('admin-status', field('order_id', 'Order', id, 'hidden') + field('status', 'Status', status, 'hidden'), 'Confirm status change')}`,
        );
    }
    if (b.dataset.refundDecision) {
      const status = b.dataset.refundDecision;
      dialog(
        `<h2>${status === 'paid' ? 'Record paid refund' : 'Review refund'}</h2>${form('admin-refund', field('request_id', 'Request', b.dataset.refundId, 'hidden') + field('status', 'Decision', status, 'hidden') + field('decision_note', 'Decision explanation', '', 'text', 'required maxlength="1200"') + (status === 'paid' ? amount('amount', 'Amount refunded in BDT') + field('reference', 'Actual refund transaction reference', '', 'text', 'required') : ''), status === 'paid' ? 'Record paid refund' : 'Save decision')}`,
      );
    }
  } catch (err) {
    toast?.(err.message);
  }
});
document.addEventListener('change', async (ev) => {
  if (ev.target.name === 'database-table' && user?.role === 'admin') {
    try {
      document.querySelector('#database-rows').innerHTML = table(
        await api(`/admin/tables/${ev.target.value}`),
      );
    } catch (err) {
      toast(err.message);
    }
  }
});
document.addEventListener('submit', async (ev) => {
  const f = ev.target;
  if (!f.id.startsWith('admin-') || user?.role !== 'admin') return;
  ev.preventDefault();
  const b = Object.fromEntries(new FormData(f)),
    button = f.querySelector('.button'),
    error = f.querySelector('.form-error');
  button.disabled = true;
  f.setAttribute('aria-busy', 'true');
  error.hidden = true;
  try {
    if (f.id === 'admin-business') {
      if (b.tax_mode !== 'exempt' && b.tax_rate === '')
        throw Error('Enter the confirmed tax rate.');
      await post('/admin/business', { ...b, tax_rate_bps: Math.round(Number(b.tax_rate) * 100) });
    }
    if (f.id === 'admin-warehouse') await post('/admin/warehouses', b);
    if (f.id === 'admin-inventory')
      await post('/admin/inventory', {
        product_id: Number(b.product_id),
        warehouse_id: Number(b.warehouse_id),
        on_hand: Number(b.on_hand),
        cost_minor: b.cost === '' ? null : Math.round(Number(b.cost) * 100),
        reason: b.reason,
      });
    if (f.id === 'admin-payment')
      await post('/admin/payments', {
        ...b,
        order_id: Number(b.order_id),
        amount_minor: Math.round(Number(b.amount) * 100),
      });
    if (f.id === 'admin-expense')
      await post('/admin/expenses', { ...b, amount_minor: Math.round(Number(b.amount) * 100) });
    if (f.id === 'admin-edit-product')
      await post(`/admin/products/${b.id}`, {
        ...b,
        price_minor: Math.round(Number(b.amount) * 100),
        published: b.published === 'on',
        featured: b.featured === 'on',
      });
    if (f.id === 'admin-edit-policy') {
      let sections;
      try {
        sections = JSON.parse(b.sections);
      } catch {
        throw Error('The sections must be valid JSON with heading and body for every section.');
      }
      await post(`/admin/policies/${b.slug}`, { sections, version: b.version, status: b.status });
    }
    if (f.id === 'admin-status')
      await post(`/admin/orders/${b.order_id}/status`, { status: b.status });
    if (f.id === 'admin-dispatch')
      await post(`/admin/orders/${b.order_id}/status`, {
        status: 'shipped',
        shipment: {
          carrier: b.carrier,
          tracking_number: b.tracking_number,
          shipping_cost_minor: Math.round(Number(b.shipping_cost) * 100),
        },
      });
    if (f.id === 'admin-refund')
      await post(`/admin/refunds/${b.request_id}`, {
        status: b.status,
        decision_note: b.decision_note,
        amount_minor: b.amount ? Math.round(Number(b.amount) * 100) : undefined,
        reference: b.reference,
      });
    document.querySelector('#admin-dialog')?.close();
    toast('Business record saved.');
    await onRefresh();
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
    error.focus();
  } finally {
    button.disabled = false;
    f.removeAttribute('aria-busy');
  }
});
