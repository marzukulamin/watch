import { db, transaction, close } from '../server/db.js';
await transaction(async (t) => {
  const rows = await t.all(
    "SELECT p.*,b.name AS brand FROM products p JOIN brands b ON b.id=p.brand_id WHERE b.name LIKE 'VERSE%'",
  );
  for (const p of rows) {
    const brand = p.full_name.match(/^(Emporio Armani|Timex|Casio|Fossil|Seiko|Orient)\b/i)?.[1];
    if (!brand) continue;
    const row = await t.get('SELECT id FROM brands WHERE name=?', [brand]);
    if (!row) continue;
    await t.run('UPDATE products SET brand_id=?,model=? WHERE id=?', [
      row.id,
      p.model.replace(new RegExp('^' + brand + '\\s+', 'i'), ''),
      p.id,
    ]);
  }
  await t.run('DELETE FROM brands WHERE id NOT IN (SELECT brand_id FROM products)');
});
await close();
console.log('Catalogue manufacturer labels reconciled with source product titles.');
