import { db, close } from '../server/db.js';
console.log(
  JSON.stringify(
    {
      products: await db.all(
        'SELECT p.id,b.name AS brand,p.model,p.name FROM products p JOIN brands b ON b.id=p.brand_id',
      ),
      realActivity: await db.get(
        'SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM orders) AS orders,(SELECT COUNT(*) FROM payments) AS payments,(SELECT COUNT(*) FROM inventory) AS inventory,(SELECT COUNT(*) FROM analytics_daily) AS analytics',
      ),
    },
    null,
    2,
  ),
);
await close();
