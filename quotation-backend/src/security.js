const encoder = new TextEncoder();

export function timingSafeEqual(a, b) {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.byteLength !== right.byteLength) return false;
  let diff = 0;
  for (let index = 0; index < left.byteLength; index += 1) diff |= left[index] ^ right[index];
  return diff === 0;
}

export async function verifyAppProxy(url, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret) return false;
  const params = new URL(url).searchParams;
  const signature = params.get('signature') || '';
  const timestamp = Number(params.get('timestamp'));
  if (!signature || !Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > 300) return false;

  const grouped = new Map();
  for (const [key, value] of params) {
    if (key === 'signature') continue;
    const values = grouped.get(key) || [];
    values.push(value);
    grouped.set(key, values);
  }
  const message = [...grouped.keys()].sort().map(key => `${key}=${grouped.get(key).join(',')}`).join('');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const expected = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(expected, signature);
}

export function normalizeText(value, maxLength) {
  return String(value ?? '').trim().replace(/[\u0000-\u001F\u007F]/g, '').slice(0, maxLength);
}

