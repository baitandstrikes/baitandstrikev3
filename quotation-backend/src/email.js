const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));

export async function sendQuotationEmails(env, quotation) {
  if (!env.RESEND_API_KEY || !env.QUOTATION_FROM) return 'not_configured';
  const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: quotation.currency });
  const rows = quotation.items.map(item => `<tr><td>${escapeHtml(item.productTitle)} — ${escapeHtml(item.variantTitle)}<br>SKU: ${escapeHtml(item.sku || '—')}</td><td>${item.quantity}</td><td>${money.format(item.unitPriceMinor / 100)}</td><td>${money.format(item.subtotalMinor / 100)}</td></tr>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;max-width:720px;margin:auto"><h1>Permintaan Penawaran ${escapeHtml(quotation.id)}</h1><p>Permintaan sudah diterima dan menunggu pemeriksaan tim BAITANDSTRIKE. Harga, stok, pajak, diskon grosir, dan ongkir belum final.</p><table style="width:100%;border-collapse:collapse"><thead><tr><th align="left">Produk</th><th>Jumlah</th><th>Harga acuan</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table><p><strong>Total acuan: ${money.format(quotation.subtotalMinor / 100)}</strong></p><p>Perusahaan: ${escapeHtml(quotation.company || '—')}<br>Alamat pengiriman: ${escapeHtml(quotation.shippingAddress)}</p></div>`;
  const recipients = [...new Set([quotation.email, env.MERCHANT_EMAIL].filter(Boolean))];
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json', 'Idempotency-Key': quotation.id },
    body: JSON.stringify({ from: env.QUOTATION_FROM, to: recipients, subject: `Permintaan Penawaran ${quotation.id}`, html })
  });
  if (!response.ok) throw new Error(`Resend delivery failed (${response.status})`);
  return 'sent';
}

