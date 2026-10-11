import { db, close } from '../server/db.js';
import { hashPassword, now } from '../server/security.js';
import readline from 'node:readline/promises';
const cli = readline.createInterface({ input: process.stdin, output: process.stdout });
const email = process.env.ADMIN_EMAIL || (await cli.question('Your admin email: '));
const name = process.env.ADMIN_NAME || (await cli.question('Your name: '));
// Prefer environment input so the password is not echoed at the terminal.
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 12) {
  console.error(
    'Set ADMIN_PASSWORD to a unique password of at least 12 characters, then run this script.',
  );
  cli.close();
  await close();
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name.trim())
  throw Error('Valid email and name required');
await db.run('INSERT INTO users(name,email,password_hash,role,created_at) VALUES(?,?,?,?,?)', [
  name.trim(),
  email.toLowerCase().trim(),
  hashPassword(password),
  'admin',
  now(),
]);
console.log('Admin created. Sign in through /account, then open /admin.');
cli.close();
await close();
