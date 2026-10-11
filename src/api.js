export let csrf = '',
  user = null;
export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.method ? { 'X-CSRF-Token': csrf } : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(data.error || 'Something went wrong.'), {
      status: response.status,
    });
  return data;
}
export async function session() {
  const s = await api('/session');
  csrf = s.csrf;
  user = s.user;
  return s;
}
export function setSession(s) {
  csrf = s.csrf;
  user = s.user;
}
export const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
export const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const currency = (value) =>
  new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 })
    .format(Number(value) / 100)
    .replace('BDT', '৳');
export function localImage(value) {
  return typeof value === 'string' &&
    /^\/media\/[a-zA-Z0-9/_\-.]+\.(webp|png|jpg|mp4|webm)$/.test(value)
    ? value
    : '/favicon.svg';
}
export const date = (value) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Asia/Dhaka' }).format(
    new Date(value),
  );
