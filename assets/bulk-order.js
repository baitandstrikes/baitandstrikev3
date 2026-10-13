(() => {
  'use strict';
  const node = document.getElementById('bns-config');
  if (!node) return;
  const config = JSON.parse(node.textContent);
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!form.matches('[data-bulk-order]')) return;
    event.preventDefault();
    if (form.dataset.busy === 'true') return;
    const error = form.querySelector('[data-bulk-error]');
    error.hidden = true;
    const items = [];
    for (const input of form.querySelectorAll('[data-bulk-quantity]:not(:disabled)')) {
      const quantity = Number(input.value);
      const min = Number(input.dataset.min || 1);
      const step = Number(input.dataset.step || 1);
      const max = input.dataset.max ? Number(input.dataset.max) : Infinity;
      if (!Number.isSafeInteger(quantity) || quantity < 0 || (quantity > 0 && (quantity < min || quantity > max || (quantity - min) % step !== 0))) {
        error.textContent = config.bulkInvalid;
        error.hidden = false;
        input.focus();
        return;
      }
      if (quantity > 0) items.push({id: input.dataset.variant, quantity});
    }
    if (!items.length) {error.textContent = config.bulkEmpty; error.hidden = false; return;}
    const button = form.querySelector('[type=submit]');
    form.dataset.busy = 'true';
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(config.add, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json', Accept: 'application/json'}, body: JSON.stringify({items})});
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.description === 'string' ? data.description : config.error);
      form.querySelectorAll('[data-bulk-quantity]').forEach(input => input.value = '0');
      document.dispatchEvent(new CustomEvent('bns:cart-refresh'));
    } catch (failure) {error.textContent = failure.message || config.error; error.hidden = false;}
    finally {form.dataset.busy = 'false'; button.disabled = false; form.removeAttribute('aria-busy');}
  });
})();
