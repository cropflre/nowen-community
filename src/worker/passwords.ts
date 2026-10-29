/**
 * Cloudflare Workers caps a single PBKDF2 call at 100,000 iterations.
 * A secret HMAC pepper mitigates offline attacks against a D1-only leak.
 * Preserve the pepper across releases; losing it invalidates passwords.
 */
export const PASSWORD_ROUNDS = 100_000;
const FORMAT = 'pbkdf2-sha256-hmac-pepper';
const encoder = new TextEncoder();
const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
function validPepper(pepper: string) { return /^[A-Za-z0-9_-]{43,128}$/.test(pepper); }
async function keyedPassword(password: string, pepper: string) {
  if (!validPepper(pepper)) throw new Error('Missing or invalid PASSWORD_PEPPER');
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', key, encoder.encode(password));
}
async function derive(password: string, pepper: string, salt: Uint8Array) {
  const prehash = await keyedPassword(password, pepper);
  const key = await crypto.subtle.importKey('raw', prehash, 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({
    name: 'PBKDF2', salt, iterations: PASSWORD_ROUNDS, hash: 'SHA-256'
  }, key, 256));
}
export async function passwordHash(password: string, pepper: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt, b => b.toString(16).padStart(2, '0')).join('');
  return [FORMAT, PASSWORD_ROUNDS, saltHex, await derive(password, pepper, salt)].join(':');
}
export async function verifyPassword(password: string, stored: string, pepper: string) {
  if (!validPepper(pepper)) throw new Error('Missing or invalid PASSWORD_PEPPER');
  const parts = stored.split(':');
  // Before switching schemes, both D1 databases were checked empty.
  // Fail closed on legacy PBKDF2-600k hashes unsupported by Workers.
  if (parts.length !== 4 || parts[0] !== FORMAT || parts[1] !== String(PASSWORD_ROUNDS)
      || !/^[0-9a-f]{32}$/.test(parts[2]) || !/^[0-9a-f]{64}$/.test(parts[3])) return false;
  const salt = Uint8Array.from(parts[2].match(/../g)!, byte => parseInt(byte, 16));
  const actual = await derive(password, pepper, salt);
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= actual.charCodeAt(i) ^ parts[3].charCodeAt(i);
  return diff === 0;
}
