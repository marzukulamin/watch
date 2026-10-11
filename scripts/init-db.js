import fs from 'node:fs/promises';
import { db, driver, close } from '../server/db.js';
const sql = await fs.readFile(
  new URL(`../database/${driver === 'mysql' ? 'mysql-schema.sql' : 'schema.sql'}`, import.meta.url),
  'utf8',
);
if (driver === 'sqlite') await db.exec(sql);
else for (const statement of sql.split(';').filter((s) => s.trim())) await db.exec(statement);
console.log(`Initialized ${driver} schema; no invented customers, orders or sales.`);
await close();
