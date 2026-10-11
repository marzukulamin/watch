import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
export const now = () => new Date().toISOString();
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password, stored) {
  try {
    const [salt, key] = stored.split(':');
    const hash = scryptSync(password, salt, 64);
    const buffer = Buffer.from(key, 'hex');
    return buffer.length === hash.length && timingSafeEqual(buffer, hash);
  } catch {
    return false;
  }
}
export const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
export const randomToken = () => randomBytes(32).toString('hex');
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function requireText(value, name, max = 255) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new HttpError(400, `Enter a valid ${name}.`);
  return value.trim();
}
export function money(value) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 1000000000)
    throw new HttpError(400, 'Enter a valid positive amount in paisa.');
  return value;
}
export function integer(value, name, max = 1000000) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max)
    throw new HttpError(400, `Invalid ${name}.`);
  return value;
}
export const safeUser = (u) =>
  u ? { id: u.id, name: u.name, email: u.email, role: u.role } : null;
