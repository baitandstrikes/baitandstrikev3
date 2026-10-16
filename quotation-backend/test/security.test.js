import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAppProxy, normalizeText } from '../src/security.js';

test('rejects missing and stale app proxy signatures', async () => {
  assert.equal(await verifyAppProxy('https://example.com/apps/quotation?timestamp=100', 'secret', 100), false);
  assert.equal(await verifyAppProxy('https://example.com/apps/quotation?timestamp=100&signature=00', 'secret', 1000), false);
});

test('accepts a valid app proxy signature', async () => {
  const secret = 'hush';
  const message = 'logged_in_customer_id=1shop=example.myshopify.comtimestamp=100';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const signature = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const url = `https://example.com/apps/quotation?shop=example.myshopify.com&logged_in_customer_id=1&timestamp=100&signature=${signature}`;
  assert.equal(await verifyAppProxy(url, secret, 100), true);
});

test('normalizes control characters and length', () => {
  assert.equal(normalizeText('  A\u0000B  ', 2), 'AB');
});

