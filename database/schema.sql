-- Canonical schema. Monetary values are integer minor units (BDT paisa).
-- MySQL/phpMyAdmin import is generated as database/mysql-schema.sql.
CREATE TABLE IF NOT EXISTS site_content (id INTEGER PRIMARY KEY, section TEXT NOT NULL UNIQUE, content_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS business_details (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
 complaint_phone TEXT, legal_name TEXT, registration_number TEXT, registered_address TEXT,
 tax_mode TEXT CHECK(tax_mode IN ('inclusive','exclusive','exempt')), tax_rate_bps INTEGER CHECK(tax_rate_bps>=0 AND tax_rate_bps<=10000),
 source_url TEXT NOT NULL, source_checked_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS locations (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL, phone TEXT NOT NULL,
 source_url TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','customer')), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), csrf_token TEXT NOT NULL,
 analytics_consent INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS brands (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY, source_id TEXT UNIQUE, slug TEXT NOT NULL UNIQUE, brand_id INTEGER NOT NULL REFERENCES brands(id),
 name TEXT NOT NULL, full_name TEXT NOT NULL, model TEXT NOT NULL, description TEXT NOT NULL,
 gender TEXT NOT NULL, category TEXT NOT NULL, price_minor INTEGER NOT NULL CHECK(price_minor>=0),
 currency TEXT NOT NULL DEFAULT 'BDT', published INTEGER NOT NULL DEFAULT 1,
 source_available INTEGER NOT NULL DEFAULT 0, stock_verified INTEGER NOT NULL DEFAULT 0,
 source_url TEXT NOT NULL, source_checked_at TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS product_specs (
 id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), label TEXT NOT NULL, value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS product_images (
 id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), path TEXT NOT NULL,
 alt TEXT NOT NULL, source_url TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS warehouses (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, address TEXT);
CREATE TABLE IF NOT EXISTS inventory (
 id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
 on_hand INTEGER NOT NULL DEFAULT 0 CHECK(on_hand>=0), reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=on_hand),
 cost_minor INTEGER CHECK(cost_minor>=0), UNIQUE(product_id,warehouse_id)
);
CREATE TABLE IF NOT EXISTS inventory_movements (
 id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
 quantity INTEGER NOT NULL, reason TEXT NOT NULL, actor_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shipping_zones (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, fee_minor INTEGER NOT NULL CHECK(fee_minor>=0),
 free_over_minor INTEGER, cod_limit_minor INTEGER, delivery_note TEXT NOT NULL,
 advance_required INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, source_url TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS policies (
 id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, sections_json TEXT NOT NULL,
 version TEXT NOT NULL, source_url TEXT, status TEXT NOT NULL CHECK(status IN ('draft','published')), updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY, reference TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL REFERENCES users(id),
 status TEXT NOT NULL CHECK(status IN ('placed','confirmed','packed','shipped','delivered','cancelled')),
 recipient_name TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL, city TEXT NOT NULL,
 postal_code TEXT, shipping_zone_id INTEGER NOT NULL REFERENCES shipping_zones(id),
 subtotal_minor INTEGER NOT NULL, shipping_minor INTEGER NOT NULL, tax_minor INTEGER NOT NULL DEFAULT 0,
 included_tax_minor INTEGER NOT NULL DEFAULT 0, tax_mode TEXT, tax_rate_bps INTEGER,
 total_minor INTEGER NOT NULL CHECK(total_minor=subtotal_minor+shipping_minor+tax_minor),
 payment_method TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE,
 terms_version TEXT NOT NULL, refund_version TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
 id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id),
 product_name TEXT NOT NULL, model TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity>0),
 unit_price_minor INTEGER NOT NULL CHECK(unit_price_minor>=0), unit_cost_minor INTEGER, warehouse_id INTEGER NOT NULL REFERENCES warehouses(id)
);
CREATE TABLE IF NOT EXISTS order_status_history (
 id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), status TEXT NOT NULL,
 actor_id INTEGER NOT NULL REFERENCES users(id), note TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shipments (
 id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id), carrier TEXT NOT NULL,
 tracking_number TEXT NOT NULL, shipped_at TEXT NOT NULL, delivered_at TEXT, shipping_cost_minor INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS payments (
 id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
 method TEXT NOT NULL, reference TEXT NOT NULL UNIQUE, actor_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS refund_requests (
 id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), user_id INTEGER NOT NULL REFERENCES users(id),
 reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','declined','paid')),
 requested_at TEXT NOT NULL, decision_note TEXT
);
CREATE TABLE IF NOT EXISTS refunds (
 id INTEGER PRIMARY KEY, request_id INTEGER NOT NULL UNIQUE REFERENCES refund_requests(id), order_id INTEGER NOT NULL REFERENCES orders(id),
 amount_minor INTEGER NOT NULL CHECK(amount_minor>0), reference TEXT NOT NULL UNIQUE, actor_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS expenses (
 id INTEGER PRIMARY KEY, category TEXT NOT NULL, description TEXT NOT NULL, amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
 reference TEXT NOT NULL UNIQUE, actor_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS consent_records (
 id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), purpose TEXT NOT NULL,
 granted INTEGER NOT NULL, policy_version TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS analytics_daily (
 day TEXT NOT NULL, route TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,route)
);
CREATE TABLE IF NOT EXISTS audit_log (
 id INTEGER PRIMARY KEY, actor_id INTEGER NOT NULL REFERENCES users(id), action TEXT NOT NULL,
 entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id,published);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status,created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
