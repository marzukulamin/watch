import { db, driver, close } from '../server/db.js';
const fields = {
  business_details: {
    tax_mode: "TEXT CHECK(tax_mode IN ('inclusive','exclusive','exempt'))",
    tax_rate_bps: 'INTEGER CHECK(tax_rate_bps>=0 AND tax_rate_bps<=10000)',
  },
  orders: {
    included_tax_minor: 'INTEGER NOT NULL DEFAULT 0',
    tax_mode: 'TEXT',
    tax_rate_bps: 'INTEGER',
  },
};
for (const [table, columns] of Object.entries(fields)) {
  const existing = await db.all(
    driver === 'mysql' ? `SHOW COLUMNS FROM ${table}` : `PRAGMA table_info(${table})`,
  );
  for (const [name, type] of Object.entries(columns)) {
    if (existing.some((c) => (c.name || c.Field) === name)) continue;
    const sqlType =
      driver === 'mysql' ? type.replace(/TEXT/g, 'VARCHAR(255)').replace(/INTEGER/g, 'INT') : type;
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${sqlType}`);
  }
}
console.log('Tax fields added without assuming a tax treatment. Existing records preserved.');
await close();
