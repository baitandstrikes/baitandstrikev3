import { sendQuotationEmails } from './email.js';
import { normalizeText, verifyAppProxy } from './security.js';
import { fetchAuthoritativeItems } from './shopify.js';

const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders }
});

function quotationId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `BNS-Q-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function parseItems(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new Error('Pilih 1–100 produk');
  return value.map(item => {
    const variantId = String(item.variantId ?? item.id ?? '').replace(/^gid:\/\/shopify\/ProductVariant\//, '');
    const quantity = Number(item.quantity);
    if (!/^\d+$/.test(variantId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new Error('Produk atau jumlah tidak valid');
    return { variantId, quantity };
  });
}

async function authenticate(request, env) {
  if (!(await verifyAppProxy(request.url, env.SHOPIFY_API_SECRET))) return null;
  const url = new URL(request.url);
  const shop = url.searchParams.get('shop');
  const customerId = url.searchParams.get('logged_in_customer_id');
  if (shop !== env.SHOPIFY_SHOP || !/^\d+$/.test(customerId || '')) return null;
  return { shop, customerId };
}

async function createQuotation(request, env, ctx, identity) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 50_000) return json({ error: 'Data terlalu besar' }, 413);
  const body = await request.json();
  const requestedItems = parseItems(body.items);
  const recipient = normalizeText(body.recipient, 120);
  const email = normalizeText(body.email, 254).toLowerCase();
  const shippingAddress = normalizeText(body.shippingAddress, 1000);
  const billingAddress = normalizeText(body.billingAddress, 1000);
  const idempotencyKey = normalizeText(request.headers.get('idempotency-key'), 100);
  if (!recipient || !email.includes('@') || !shippingAddress || !billingAddress || idempotencyKey.length < 16) return json({ error: 'Data customer belum lengkap' }, 422);

  const recent = await env.DB.prepare("SELECT COUNT(*) AS total FROM quotations WHERE shop = ? AND customer_id = ? AND created_at >= datetime('now', '-1 minute')").bind(identity.shop, identity.customerId).first();
  if (Number(recent?.total || 0) >= 3) return json({ error: 'Terlalu banyak permintaan. Coba lagi satu menit lagi.' }, 429, { 'retry-after': '60' });

  const existing = await env.DB.prepare('SELECT id, status, email_status FROM quotations WHERE shop = ? AND customer_id = ? AND idempotency_key = ?').bind(identity.shop, identity.customerId, idempotencyKey).first();
  if (existing) return json({ quotation: existing, duplicate: true }, 200);

  const verified = await fetchAuthoritativeItems(env, requestedItems);
  const subtotalMinor = verified.items.reduce((total, item) => total + item.subtotalMinor, 0);
  const now = new Date().toISOString();
  const record = {
    id: quotationId(), shop: identity.shop, customerId: identity.customerId,
    status: 'pending_review', createdAt: now, currency: verified.currency,
    recipient, company: normalizeText(body.company, 160), email,
    phone: normalizeText(body.phone, 40), shippingAddress, billingAddress,
    notes: normalizeText(body.notes, 2000), subtotalMinor, items: verified.items
  };
  await env.DB.prepare(`INSERT INTO quotations (id, shop, customer_id, status, created_at, updated_at, currency, recipient, company, email, phone, shipping_address, billing_address, notes, subtotal_minor, line_items_json, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(record.id, record.shop, record.customerId, record.status, now, now, record.currency, record.recipient, record.company, record.email, record.phone, record.shippingAddress, record.billingAddress, record.notes, record.subtotalMinor, JSON.stringify(record.items), idempotencyKey).run();

  ctx.waitUntil((async () => {
    try {
      const state = await sendQuotationEmails(env, record);
      await env.DB.prepare('UPDATE quotations SET email_status = ?, updated_at = ? WHERE id = ?').bind(state, new Date().toISOString(), record.id).run();
    } catch (error) {
      console.error(JSON.stringify({ event: 'quotation_email_failed', quotationId: record.id, message: error.message }));
      await env.DB.prepare('UPDATE quotations SET email_status = ?, updated_at = ? WHERE id = ?').bind('failed', new Date().toISOString(), record.id).run();
    }
  })());
  return json({ quotation: { id: record.id, status: record.status, emailStatus: 'pending', currency: record.currency, subtotalMinor } }, 201);
}

async function listQuotations(env, identity) {
  const result = await env.DB.prepare('SELECT id, status, created_at, currency, subtotal_minor, email_status FROM quotations WHERE shop = ? AND customer_id = ? ORDER BY created_at DESC LIMIT 50').bind(identity.shop, identity.customerId).all();
  return json({ quotations: result.results });
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true });
      const identity = await authenticate(request, env);
      if (!identity) return json({ error: 'Login Shopify diperlukan' }, 401);
      if (request.method === 'POST' && url.pathname.endsWith('/api/quotations')) return await createQuotation(request, env, ctx, identity);
      if (request.method === 'GET' && url.pathname.endsWith('/api/quotations')) return await listQuotations(env, identity);
      return json({ error: 'Not found' }, 404);
    } catch (error) {
      console.error(JSON.stringify({ event: 'quotation_request_failed', message: error.message }));
      const clientError = /tidak valid|Pilih 1/.test(error.message);
      return json({ error: clientError ? error.message : 'Layanan quotation sedang bermasalah' }, clientError ? 422 : 500);
    }
  }
};

