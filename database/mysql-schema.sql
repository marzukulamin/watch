-- Import into an empty verse database with phpMyAdmin. MySQL 8.0+ / MariaDB 10.6+.


CREATE TABLE IF NOT EXISTS site_content (id INT PRIMARY KEY AUTO_INCREMENT, section VARCHAR(255) NOT NULL UNIQUE, content_json TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS business_details (
 id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL, phone VARCHAR(255) NOT NULL,
 complaint_phone VARCHAR(255), legal_name VARCHAR(255), registration_number VARCHAR(255), registered_address TEXT,
 tax_mode VARCHAR(255) CHECK(tax_mode IN ('inclusive','exclusive','exempt')), tax_rate_bps INT CHECK(tax_rate_bps>=0 AND tax_rate_bps<=10000),
 source_url TEXT NOT NULL, source_checked_at VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS locations (
 id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL, address TEXT NOT NULL, phone VARCHAR(255) NOT NULL,
 source_url TEXT NOT NULL, active INT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS users (
 id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
 role VARCHAR(255) NOT NULL CHECK(role IN ('admin','customer')), created_at VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS sessions (
 token_hash VARCHAR(64) PRIMARY KEY, user_id INT, csrf_token VARCHAR(255) NOT NULL,
 analytics_consent INT NOT NULL DEFAULT 0, expires_at VARCHAR(255) NOT NULL,
 FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS brands (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS products (
 id INT PRIMARY KEY AUTO_INCREMENT, source_id VARCHAR(255) UNIQUE, slug VARCHAR(255) NOT NULL UNIQUE, brand_id INT NOT NULL,
 name VARCHAR(255) NOT NULL, full_name TEXT NOT NULL, model VARCHAR(255) NOT NULL, description TEXT NOT NULL,
 gender VARCHAR(255) NOT NULL, category VARCHAR(255) NOT NULL, price_minor INT NOT NULL CHECK(price_minor>=0),
 currency VARCHAR(255) NOT NULL DEFAULT 'BDT', published INT NOT NULL DEFAULT 1,
 source_available INT NOT NULL DEFAULT 0, stock_verified INT NOT NULL DEFAULT 0,
 source_url TEXT NOT NULL, source_checked_at VARCHAR(255) NOT NULL, featured INT NOT NULL DEFAULT 0,
 FOREIGN KEY (brand_id) REFERENCES brands(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS product_specs (
 id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL, label VARCHAR(255) NOT NULL, value VARCHAR(255) NOT NULL,
 FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS product_images (
 id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL, path VARCHAR(255) NOT NULL,
 alt VARCHAR(255) NOT NULL, source_url TEXT NOT NULL, position INT NOT NULL DEFAULT 0,
 FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS warehouses (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL UNIQUE, address TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS inventory (
 id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL, warehouse_id INT NOT NULL,
 on_hand INT NOT NULL DEFAULT 0 CHECK(on_hand>=0), reserved INT NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=on_hand),
 cost_minor INT CHECK(cost_minor>=0), UNIQUE(product_id,warehouse_id),
 FOREIGN KEY (product_id) REFERENCES products(id),
 FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS inventory_movements (
 id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL, warehouse_id INT NOT NULL,
 quantity INT NOT NULL, reason VARCHAR(255) NOT NULL, actor_id INT NOT NULL, created_at VARCHAR(255) NOT NULL,
 FOREIGN KEY (product_id) REFERENCES products(id),
 FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
 FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS shipping_zones (
 id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL, fee_minor INT NOT NULL CHECK(fee_minor>=0),
 free_over_minor INT, cod_limit_minor INT, delivery_note TEXT NOT NULL,
 advance_required INT NOT NULL DEFAULT 0, active INT NOT NULL DEFAULT 1, source_url TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS policies (
 id INT PRIMARY KEY AUTO_INCREMENT, slug VARCHAR(255) NOT NULL UNIQUE, title VARCHAR(255) NOT NULL, sections_json TEXT NOT NULL,
 version VARCHAR(255) NOT NULL, source_url TEXT, status VARCHAR(255) NOT NULL CHECK(status IN ('draft','published')), updated_at VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS orders (
 id INT PRIMARY KEY AUTO_INCREMENT, reference VARCHAR(255) NOT NULL UNIQUE, user_id INT NOT NULL,
 status VARCHAR(255) NOT NULL CHECK(status IN ('placed','confirmed','packed','shipped','delivered','cancelled')),
 recipient_name VARCHAR(255) NOT NULL, phone VARCHAR(255) NOT NULL, address TEXT NOT NULL, city VARCHAR(255) NOT NULL,
 postal_code VARCHAR(255), shipping_zone_id INT NOT NULL,
 subtotal_minor INT NOT NULL, shipping_minor INT NOT NULL, tax_minor INT NOT NULL DEFAULT 0,
 included_tax_minor INT NOT NULL DEFAULT 0, tax_mode VARCHAR(255), tax_rate_bps INT,
 total_minor INT NOT NULL CHECK(total_minor=subtotal_minor+shipping_minor+tax_minor),
 payment_method VARCHAR(255) NOT NULL, idempotency_key VARCHAR(255) NOT NULL UNIQUE,
 terms_version VARCHAR(255) NOT NULL, refund_version VARCHAR(255) NOT NULL, created_at VARCHAR(255) NOT NULL,
 FOREIGN KEY (user_id) REFERENCES users(id),
 FOREIGN KEY (shipping_zone_id) REFERENCES shipping_zones(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS order_items (
 id INT PRIMARY KEY AUTO_INCREMENT, order_id INT NOT NULL, product_id INT NOT NULL,
 product_name VARCHAR(255) NOT NULL, model VARCHAR(255) NOT NULL, quantity INT NOT NULL CHECK(quantity>0),
 unit_price_minor INT NOT NULL CHECK(unit_price_minor>=0), unit_cost_minor INT, warehouse_id INT NOT NULL,
 FOREIGN KEY (order_id) REFERENCES orders(id),
 FOREIGN KEY (product_id) REFERENCES products(id),
 FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS order_status_history (
 id INT PRIMARY KEY AUTO_INCREMENT, order_id INT NOT NULL, status VARCHAR(255) NOT NULL,
 actor_id INT NOT NULL, note TEXT, created_at VARCHAR(255) NOT NULL,
 FOREIGN KEY (order_id) REFERENCES orders(id),
 FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS shipments (
 id INT PRIMARY KEY AUTO_INCREMENT, order_id INT NOT NULL UNIQUE REFERENCES orders(id), carrier VARCHAR(255) NOT NULL,
 tracking_number VARCHAR(255) NOT NULL, shipped_at VARCHAR(255) NOT NULL, delivered_at VARCHAR(255), shipping_cost_minor INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS payments (
 id INT PRIMARY KEY AUTO_INCREMENT, order_id INT NOT NULL, amount_minor INT NOT NULL CHECK(amount_minor>0),
 method VARCHAR(255) NOT NULL, reference VARCHAR(255) NOT NULL UNIQUE, actor_id INT NOT NULL, created_at VARCHAR(255) NOT NULL,
 FOREIGN KEY (order_id) REFERENCES orders(id),
 FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS refund_requests (
 id INT PRIMARY KEY AUTO_INCREMENT, order_id INT NOT NULL, user_id INT NOT NULL,
 reason VARCHAR(255) NOT NULL, status VARCHAR(255) NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','declined','paid')),
 requested_at VARCHAR(255) NOT NULL, decision_note TEXT,
 FOREIGN KEY (order_id) REFERENCES orders(id),
 FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS refunds (
 id INT PRIMARY KEY AUTO_INCREMENT, request_id INT NOT NULL UNIQUE REFERENCES refund_requests(id), order_id INT NOT NULL,
 amount_minor INT NOT NULL CHECK(amount_minor>0), reference VARCHAR(255) NOT NULL UNIQUE, actor_id INT NOT NULL, created_at VARCHAR(255) NOT NULL,
 FOREIGN KEY (order_id) REFERENCES orders(id),
 FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS expenses (
 id INT PRIMARY KEY AUTO_INCREMENT, category VARCHAR(255) NOT NULL, description TEXT NOT NULL, amount_minor INT NOT NULL CHECK(amount_minor>0),
 reference VARCHAR(255) NOT NULL UNIQUE, actor_id INT NOT NULL, created_at VARCHAR(255) NOT NULL,
 FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS consent_records (
 id INT PRIMARY KEY AUTO_INCREMENT, user_id INT, purpose VARCHAR(255) NOT NULL,
 granted INT NOT NULL, policy_version VARCHAR(255) NOT NULL, created_at VARCHAR(255) NOT NULL,
 FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS analytics_daily (
 day VARCHAR(10) NOT NULL, route VARCHAR(160) NOT NULL, views INT NOT NULL DEFAULT 0, PRIMARY KEY(day,route)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS audit_log (
 id INT PRIMARY KEY AUTO_INCREMENT, actor_id INT NOT NULL, action VARCHAR(255) NOT NULL,
 entity_type VARCHAR(255) NOT NULL, entity_id VARCHAR(255) NOT NULL, created_at VARCHAR(255) NOT NULL,
 FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX idx_products_brand ON products(brand_id,published);
CREATE INDEX idx_orders_user ON orders(user_id,created_at);
CREATE INDEX idx_orders_status ON orders(status,created_at);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX idx_items_order ON order_items(order_id);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_refunds_order ON refunds(order_id);
