(() => {
  'use strict';
  const root = document.querySelector('[data-quotation-builder]');
  const form = root?.querySelector('[data-quotation-details]');
  if (!form || root.dataset.initialized) return;
  root.dataset.initialized = 'true';
  const same = form.querySelector('[data-quotation-same-address]');
  const shipping = form.elements.shipping;
  const billing = form.elements.billing;
  const cartData = (() => {
    try { return JSON.parse(document.querySelector('#cart-quote-data')?.textContent || '[]'); }
    catch { return []; }
  })();
  const copyAddress = () => { billing.readOnly = same.checked; if (same.checked) billing.value = shipping.value; };
  same.addEventListener('change', copyAddress);
  shipping.addEventListener('input', copyAddress);
  form.addEventListener('input', () => {
    root.querySelector('[data-quotation-output]').hidden = true;
    root.querySelector('[data-quotation-output-actions]').hidden = true;
  });
  let reference;
  form.addEventListener('submit', event => {
    event.preventDefault();
    copyAddress();
    if (!form.reportValidity()) return;
    reference ||= 'DRAF-BNS-' + crypto.randomUUID();
    root.querySelector('[data-quotation-reference]').textContent = 'Referensi draf: ' + reference;
    root.querySelector('[data-quotation-date]').textContent = 'Dibuat: ' + new Date().toLocaleString('id-ID', {timeZone:'Asia/Jakarta'}) + ' WIB';
    const details = root.querySelector('[data-quotation-customer]');
    details.replaceChildren();
    for (const [label, name] of [['Penerima','recipient'],['Perusahaan / toko','company'],['Email','email'],['Telepon / WhatsApp','phone'],['Alamat pengiriman','shipping'],['Alamat penagihan','billing'],['Catatan','notes']]) {
      const term = document.createElement('dt'); term.textContent = label;
      const value = document.createElement('dd'); value.textContent = form.elements[name].value.trim() || '—';
      details.append(term, value);
    }
    root.querySelector('[data-quotation-output]').hidden = false;
    root.querySelector('[data-quotation-output-actions]').hidden = false;
    root.querySelector('[data-quotation-output]').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block:'start'});
  });
  root.querySelector('[data-quotation-print]').addEventListener('click', () => window.print());
  const submitButton = root.querySelector('[data-cart-to-quote]');
  const submitStatus = root.querySelector('[data-quotation-submit-status]');
  submitButton.addEventListener('click', async () => {
    copyAddress();
    if (!form.reportValidity()) return;
    if (!cartData.length) return;
    const idempotencyKey = reference ||= 'DRAF-BNS-' + crypto.randomUUID();
    submitButton.disabled = true;
    submitStatus.hidden = false;
    submitStatus.textContent = 'Mengirim permintaan penawaran…';
    try {
      const response = await fetch(root.dataset.quotationEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
        body: JSON.stringify({
          items: cartData.map(item => ({ variantId: item.id, quantity: item.quantity })),
          recipient: form.elements.recipient.value,
          company: form.elements.company.value,
          email: form.elements.email.value,
          phone: form.elements.phone.value,
          shippingAddress: form.elements.shipping.value,
          billingAddress: form.elements.billing.value,
          notes: form.elements.notes.value
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Permintaan belum dapat dikirim');
      submitStatus.textContent = `Berhasil diajukan. Nomor referensi resmi: ${result.quotation.id}. Status: menunggu review tim BNS.`;
      root.querySelector('[data-quotation-reference]').textContent = 'Nomor quotation: ' + result.quotation.id;
      submitButton.textContent = 'Sudah diajukan';
    } catch (error) {
      submitStatus.textContent = `${error.message}. Draf tetap aman dan masih dapat dicetak.`;
      submitButton.disabled = false;
    }
  });
})();

