import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
export const root = path.resolve(import.meta.dirname, '..');
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
export const driver = process.env.DB_DRIVER || 'sqlite';
let sqlite, pool;
if (driver === 'mysql') {
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    database: process.env.MYSQL_DATABASE || 'verse',
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    connectionLimit: 6,
  });
} else {
  const file = process.env.DB_FILE || 'database/verse.sqlite';
  const location = file === ':memory:' ? file : path.resolve(root, file);
  if (location !== ':memory:') fs.mkdirSync(path.dirname(location), { recursive: true });
  sqlite = new DatabaseSync(location);
  sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
}
function wrapper(connection) {
  return {
    async all(sql, params = []) {
      if (sqlite) return sqlite.prepare(sql).all(...params);
      const [rows] = await connection.execute(sql, params);
      return rows;
    },
    async get(sql, params = []) {
      return (await this.all(sql, params))[0];
    },
    async run(sql, params = []) {
      if (sqlite) {
        const r = sqlite.prepare(sql).run(...params);
        return { id: Number(r.lastInsertRowid), changes: Number(r.changes) };
      }
      const [r] = await connection.execute(sql, params);
      return { id: r.insertId, changes: r.affectedRows };
    },
    async exec(sql) {
      if (sqlite) sqlite.exec(sql);
      else await connection.query(sql);
    },
  };
}
export const db = wrapper(pool);
let queue = Promise.resolve();
export async function transaction(fn) {
  if (pool) {
    const c = await pool.getConnection();
    try {
      await c.beginTransaction();
      const result = await fn(wrapper(c));
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  const previous = queue;
  let release;
  queue = new Promise((r) => {
    release = r;
  });
  await previous;
  try {
    sqlite.exec('BEGIN IMMEDIATE');
    const result = await fn(db);
    sqlite.exec('COMMIT');
    return result;
  } catch (e) {
    sqlite.exec('ROLLBACK');
    throw e;
  } finally {
    release();
  }
}
export async function close() {
  if (sqlite) sqlite.close();
  if (pool) await pool.end();
}
