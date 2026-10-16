(() => {
'use strict';
const node = document.getElementById('bns-config');
if (!node) return;
const config = JSON.parse(node.textContent);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const productRequests = new WeakMap();
let toastTimer, quickRequest, cartBusy = false;
const toast = (message) => {
 const el = document.getElementById('BnsStatus');
 el.textContent = message; el.classList.add('is-visible');
 clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('is-visible'), 4500);
};
const errorText = (data) => typeof data.description === 'string' ? data.description : typeof data.message === 'string' ? data.message : config.error;
const request = async (url, options = {}) => {
 const response = await fetch(url, { credentials: 'same-origin', ...options });
 let data; try { data = await response.json(); } catch { throw new Error(config.error); }
 if (!response.ok || data.status >= 400) throw new Error(errorText(data));
 return data;
};
const parseHTML = (html) => new DOMParser().parseFromString(html, 'text/html');
const lockBody = () => document.body.classList.toggle('dialog-open', Boolean(document.querySelector('dialog[open]')));
const openDialog = (dialog) => {
 if (!dialog) return;
 document.querySelectorAll('dialog[open]').forEach(el => { if (el !== dialog) el.close(); });
 if (!dialog.open) dialog.showModal(); lockBody();
};
const displayError = (root, message, selector = '[data-form-error]') => {
 const el = root.querySelector(selector);
 if (el) { el.textContent = message; el.hidden = false; } else toast(message);
};
const refreshCart = async () => {
 const url = new URL(config.cart, window.location.origin); url.searchParams.set('section_id', 'cart-drawer');
 const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
 if (!response.ok) throw new Error(config.error);
 const incoming = parseHTML(await response.text()).querySelector('#CartDrawer');
 const current = document.getElementById('CartDrawer');
 if (!incoming || !current) throw new Error(config.error);
 const focused = document.activeElement;
 const lineKey = focused?.closest('[data-cart-line]')?.dataset.cartLine;
 const focusType = focused?.matches('[data-cart-quantity]') ? '[data-cart-quantity]' : focused?.matches('[data-cart-remove]') ? '[data-cart-remove]' : null;
 current.querySelector('[data-cart-content]').replaceWith(incoming.querySelector('[data-cart-content]'));
 current.querySelector('#CartDrawerTitle').innerHTML = incoming.querySelector('#CartDrawerTitle').innerHTML;
 const count = current.querySelector('[data-cart-content]').dataset.count;
 document.querySelectorAll('[data-cart-count]').forEach(el => el.textContent = count);
 if (lineKey && focusType) {
 const line = [...current.querySelectorAll('[data-cart-line]')].find(el => el.dataset.cartLine === lineKey);
 (line?.querySelector(focusType) || current.querySelector('[data-close-dialog]')).focus();
 }
};
const mutateCart = async (line, quantity) => {
 const drawer = line.closest('#CartDrawer');
 if (!drawer || cartBusy || !Number.isSafeInteger(quantity) || quantity < 0) return;
 cartBusy = true; drawer.setAttribute('aria-busy', 'true');
 drawer.querySelectorAll('[data-cart-delta], [data-cart-quantity], [data-cart-remove], .checkout-button').forEach(el => { if ('disabled' in el) el.disabled = true; });
 const err = drawer.querySelector('[data-cart-error]'); err.hidden = true;
 try {
 await request(config.change, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: line.dataset.cartLine, quantity }) });
 try { await refreshCart(); } catch { window.location.assign(config.cart); }
 } catch (error) { displayError(drawer, error.message, '[data-cart-error]'); }
 finally { cartBusy = false; drawer.removeAttribute('aria-busy'); drawer.querySelectorAll('[data-cart-delta], [data-cart-quantity], .checkout-button').forEach(el => el.disabled = false); }
};
const addProduct = async (form) => {
 if (form.dataset.busy === 'true' || !form.reportValidity()) return;
 const button = form.querySelector('[type=submit]');
 if (button.disabled) return;
 const error = form.querySelector('[data-form-error]'); if (error) error.hidden = true;
 const body = new FormData(form); form.dataset.busy = 'true'; button.disabled = true;
 try {
 await request(config.add, { method: 'POST', body, headers: { Accept: 'application/json' } });
 try { await refreshCart(); openDialog(document.getElementById('CartDrawer')); toast(config.added); }
 catch { window.location.assign(config.cart); }
 } catch (err) { displayError(form, err.message); }
 finally { form.dataset.busy = 'false'; button.disabled = false; }
};
const changeVariant = async (select) => {
 const root = select.closest('[data-product-root]'); if (!root) return;
 const prior = productRequests.get(root); if (prior) prior.abort();
 const controller = new AbortController(); productRequests.set(root, controller);
 const options = [...root.querySelectorAll('[data-option-select]')].map(el => el.value);
 const chosen = select.selectedOptions[0];
 const url = new URL(chosen?.dataset.productUrl || root.dataset.productUrl, window.location.origin);
 url.searchParams.set('option_values', options.join(',')); url.searchParams.set('section_id', root.dataset.sectionId);
 root.setAttribute('aria-busy', 'true');
 const quantity = Number(root.querySelector('[name=quantity]')?.value || 1);
 try {
 const response = await fetch(url, { signal: controller.signal, credentials: 'same-origin' });
 if (!response.ok) throw new Error(config.error);
 const replacement = parseHTML(await response.text()).querySelector('[data-product-root]');
 if (!replacement) throw new Error(config.error);
 if (controller.signal.aborted) return;
 const input = replacement.querySelector('[name=quantity]');
 if (input) { const min = Number(input.min || 1), step = Number(input.step || 1), max = Number(input.max || Infinity); input.value = Math.min(max, Math.max(min, min + Math.round((quantity - min) / step) * step)); }
 root.replaceWith(replacement);
 const focus = [...replacement.querySelectorAll('[data-option-select]')].find(el => el.dataset.optionPosition === select.dataset.optionPosition); focus?.focus();
 if (!replacement.closest('#QuickView')) {
 url.searchParams.delete('section_id');
 const variant = replacement.querySelector('[name=id]')?.value;
 if (variant) { url.searchParams.delete('option_values'); url.searchParams.set('variant', variant); }
 history.replaceState({}, '', url.pathname + url.search);
 }
 } catch (error) { if (error.name !== 'AbortError') { displayError(root, error.message); const add = root.querySelector('.add-button'); if (add) add.disabled = true; } }
 finally { root.removeAttribute('aria-busy'); }
};
const quickView = async (link) => {
 if (quickRequest) quickRequest.abort(); quickRequest = new AbortController();
 const dialog = document.getElementById('QuickView'); const content = dialog.querySelector('[data-quick-content]');
 const pending = document.createElement('p'); pending.className = 'section wrap'; pending.textContent = config.loading; content.replaceChildren(pending);
 openDialog(dialog);
 try {
 const url = new URL(link.dataset.quickView, window.location.origin); url.searchParams.set('section_id', 'main-product');
 const response = await fetch(url, { signal: quickRequest.signal, credentials: 'same-origin' });
 if (!response.ok) throw new Error(config.error);
 const product = parseHTML(await response.text()).querySelector('[data-product-root]');
 if (!product) throw new Error(config.error);
 content.replaceChildren(product);
 } catch (error) { if (error.name !== 'AbortError') { dialog.close(); lockBody(); window.location.assign(link.href); } }
};
const gallery = (button) => {
 const root = button.closest('[data-product-root]');
 root.querySelectorAll('[data-media-id]').forEach(el => {
 const active = el.dataset.mediaId === button.dataset.gallerySelect; el.classList.toggle('is-active', active);
 if (!active) { el.querySelectorAll('video').forEach(video => video.pause()); el.querySelectorAll('iframe').forEach(frame => { const src = frame.getAttribute('src'); frame.setAttribute('src', src); }); }
 });
 root.querySelectorAll('[data-gallery-select]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
};
const initCountries = (scope) => {
 scope.querySelectorAll('[data-country]').forEach(select => {
 if (select.dataset.ready) return; select.dataset.ready = 'true';
 const match = [...select.options].find(opt => opt.value === select.dataset.default || opt.text === select.dataset.default); if (match) select.value = match.value;
 updateProvince(select, true);
 });
};
const updateProvince = (country, initial = false) => {
 const province = document.getElementById(country.dataset.province); if (!province) return;
 let values = []; try { values = JSON.parse(country.selectedOptions[0]?.dataset.provinces || '[]'); } catch { values = []; }
 province.replaceChildren(...values.map(([value, label]) => new Option(label, value)));
 province.closest('[data-province-wrapper]').hidden = values.length === 0; province.disabled = values.length === 0;
 if (initial && province.dataset.default) { const matching = [...province.options].find(opt => opt.value === province.dataset.default || opt.text === province.dataset.default); if (matching) province.value = matching.value; }
};
const initSlideshow = (el) => {
 if (el.dataset.ready) return; el.dataset.ready = 'true';
 const slides = [...el.querySelectorAll('[data-slide]')]; const dots = [...el.querySelectorAll('[data-slide-to]')];
 if (!slides.length) return;
 let index = 0, timer, paused = reduced, hovering = false, focused = false;
 const change = (next) => {
 index = (next + slides.length) % slides.length;
 slides.forEach((slide, i) => { const active = i === index; slide.classList.toggle('is-active', active); slide.inert = !active; slide.setAttribute('aria-hidden', String(!active)); });
 dots.forEach((dot, i) => { dot.classList.toggle('is-active', i === index); if (i === index) dot.setAttribute('aria-current', 'true'); else dot.removeAttribute('aria-current'); });
 };
 const start = () => { clearInterval(timer); if (el.dataset.autoplay === 'true' && !paused && !hovering && !focused && !document.hidden && slides.length > 1 && el.isConnected) timer = setInterval(() => change(index + 1), Number(el.dataset.delay) || 7000); };
 el.addEventListener('click', event => { const dot = event.target.closest('[data-slide-to]'); if (dot) change(Number(dot.dataset.slideTo)); if (event.target.closest('[data-slide-next]')) change(index + 1); if (event.target.closest('[data-slide-prev]')) change(index - 1); const pause = event.target.closest('[data-slide-pause]'); if (pause) { paused = !paused; pause.setAttribute('aria-label', paused ? pause.dataset.play : pause.dataset.pause); pause.textContent = paused ? '▶' : 'Ⅱ'; } start(); });
 el.addEventListener('mouseenter', () => { hovering = true; start(); }); el.addEventListener('mouseleave', () => { hovering = false; start(); });
 el.addEventListener('focusin', () => { focused = true; start(); }); el.addEventListener('focusout', () => { focused = el.contains(document.activeElement); setTimeout(() => { focused = el.contains(document.activeElement); start(); }, 0); });
 document.addEventListener('visibilitychange', start);
 el.addEventListener('bns:slide', event => { change(Number(event.detail)); paused = true; start(); });
 el.addEventListener('bns:unload', () => clearInterval(timer), { once: true });
 if (reduced) { const pause = el.querySelector('[data-slide-pause]'); if (pause) { pause.setAttribute('aria-label', pause.dataset.play); pause.textContent = '▶'; } }
 change(0); start();
};
const initCategoryMenu = (menu) => {
 if (menu.dataset.categoryReady) return;
 menu.dataset.categoryReady = 'true';
 const shell = menu.querySelector('.product-category-shell');
 const triggers = [...menu.querySelectorAll('[data-category-trigger]')];
 const panels = [...menu.querySelectorAll('[data-category-panel]')];
 const activate = (index, openMobile = false) => {
   triggers.forEach(trigger => trigger.classList.toggle('is-active', trigger.dataset.categoryTrigger === index));
   panels.forEach(panel => panel.classList.toggle('is-active', panel.dataset.categoryPanel === index));
   if (openMobile && window.matchMedia('(max-width: 749px)').matches) {
     shell.classList.add('is-detail-open');
     menu.querySelector(`[data-category-panel="${index}"] [data-category-back]`)?.focus();
   }
 };
 triggers.forEach(trigger => {
   trigger.addEventListener('mouseenter', () => { if (window.matchMedia('(min-width: 750px)').matches) activate(trigger.dataset.categoryTrigger); });
   trigger.addEventListener('focusin', () => { if (window.matchMedia('(min-width: 750px)').matches) activate(trigger.dataset.categoryTrigger); });
   trigger.querySelector('a')?.addEventListener('click', event => {
     if (!window.matchMedia('(max-width: 749px)').matches) return;
     event.preventDefault(); activate(trigger.dataset.categoryTrigger, true);
   });
 });
 menu.querySelectorAll('[data-category-back]').forEach(button => button.addEventListener('click', () => {
   shell.classList.remove('is-detail-open');
   menu.querySelector('[data-category-trigger].is-active a')?.focus();
 }));
 menu.closest('details')?.addEventListener('toggle', event => {
   if (!event.currentTarget.open) shell.classList.remove('is-detail-open');
 });
 menu.querySelector('.product-mega-tabs a[href*="#shop-by-brand"]')?.addEventListener('click', () => {
   menu.closest('details')?.removeAttribute('open');
   const header = menu.closest('[data-header]');
   header?.classList.remove('menu-open');
   header?.querySelectorAll('[data-menu-toggle]').forEach(button => button.setAttribute('aria-expanded', 'false'));
 });
};
const init = (scope = document) => {
 scope.querySelectorAll('[data-slideshow]').forEach(initSlideshow); initCountries(scope);
 scope.querySelectorAll('[data-category-menu]').forEach(initCategoryMenu);
 scope.querySelectorAll('.reveal:not([data-revealed])').forEach(el => {
 el.dataset.revealed = 'true';
 if (reduced || !('IntersectionObserver' in window)) return;
 el.classList.add('is-pending'); const observer = new IntersectionObserver(entries => { entries.forEach(entry => { if (entry.isIntersecting) { el.classList.remove('is-pending'); el.classList.add('is-visible'); observer.disconnect(); } }); }, { threshold: .08 }); observer.observe(el);
 });
 scope.querySelectorAll('[data-recommendations]:not([data-ready])').forEach(el => {
 el.dataset.ready = 'true';
 const load = async () => { try { const response = await fetch(el.dataset.url, { credentials: 'same-origin' }); if (!response.ok) return; const incoming = parseHTML(await response.text()).querySelector('[data-recommendations]'); if (incoming) el.innerHTML = incoming.innerHTML; } catch {} };
 if ('IntersectionObserver' in window) { const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); } }, { rootMargin: '300px' }); observer.observe(el); } else load();
 });
};
document.addEventListener('click', async event => {
 const trigger = event.target.closest('[data-open-cart], [data-open-account], [data-close-dialog], [data-quick-view], [data-menu-toggle], [data-search-toggle], [data-quantity], [data-cart-delta], [data-cart-remove], [data-gallery-select], [data-zoom], [data-carousel-prev], [data-carousel-next], [data-share]');
 if (!trigger) return;
 if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
 if (trigger.matches('[data-open-cart]')) { event.preventDefault(); const drawer = document.getElementById('CartDrawer'); openDialog(drawer); try { await refreshCart(); } catch { displayError(drawer, config.error, '[data-cart-error]'); } }
 if (trigger.matches('[data-open-account]')) { event.preventDefault(); openDialog(document.getElementById('AccountDialog')); }
 if (trigger.matches('[data-close-dialog]')) { trigger.closest('dialog').close(); lockBody(); }
 if (trigger.matches('[data-quick-view]')) { event.preventDefault(); await quickView(trigger); }
 if (trigger.matches('[data-menu-toggle]')) { const header = trigger.closest('[data-header]'); const opened = header.classList.toggle('menu-open'); trigger.setAttribute('aria-expanded', String(opened)); }
 if (trigger.matches('[data-search-toggle]')) { const panel = document.getElementById('HeaderSearch'); panel.hidden = !panel.hidden; document.querySelectorAll('[data-search-toggle]').forEach(el => el.setAttribute('aria-expanded', String(!panel.hidden))); if (!panel.hidden) panel.querySelector('input[type=search]').focus(); else { const launchers = [...document.querySelectorAll('[data-search-toggle]')]; const visibleLauncher = launchers.find(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'); visibleLauncher?.focus(); } }
 if (trigger.matches('[data-quantity]')) { const input = trigger.parentElement.querySelector('input'); const min = Number(input.min || 1), max = Number(input.max || Infinity), step = Number(input.step || 1); const current = Number(input.value); input.value = Math.min(max, Math.max(min, (Number.isFinite(current) ? current : min) + Number(trigger.dataset.quantity) * step)); input.dispatchEvent(new Event('change', { bubbles: true })); }
 if (trigger.matches('[data-cart-delta]')) { const line = trigger.closest('[data-cart-line]'), input = line.querySelector('[data-cart-quantity]'), delta = Number(trigger.dataset.cartDelta) * Number(input.step || 1), quantity = Math.max(0, Number(input.value) + delta); if (line.closest('#CartDrawer')) await mutateCart(line, quantity); else input.value = quantity; }
 if (trigger.matches('[data-cart-remove]') && trigger.closest('#CartDrawer')) { event.preventDefault(); await mutateCart(trigger.closest('[data-cart-line]'), 0); }
 if (trigger.matches('[data-gallery-select]')) gallery(trigger);
 if (trigger.matches('[data-zoom]')) { const dialog = document.getElementById('ImageZoom'), img = dialog.querySelector('[data-zoom-image]'); img.src = trigger.dataset.zoom; img.alt = trigger.querySelector('img')?.alt || ''; openDialog(dialog); }
 if (trigger.matches('[data-carousel-prev], [data-carousel-next]')) { const track = trigger.closest('[data-carousel]').querySelector('[data-carousel-track]'); track.scrollBy({ left: track.clientWidth * (trigger.matches('[data-carousel-next]') ? 1 : -1), behavior: reduced ? 'auto' : 'smooth' }); }
 if (trigger.matches('[data-share]')) { try { if (navigator.share) await navigator.share({ url: trigger.dataset.share }); else { await navigator.clipboard.writeText(trigger.dataset.share); toast(config.copied); } } catch (err) { if (err.name !== 'AbortError') toast(config.error); } }
});
document.addEventListener('submit', event => {
 const form = event.target;
 if (form.matches('[data-product-form]')) { event.preventDefault(); addProduct(form); }
 if (form.matches('[data-confirm-delete]') && !window.confirm(config.deleteConfirm)) event.preventDefault();
});
document.addEventListener('change', event => {
 const target = event.target;
 if (target.matches('[data-option-select]')) changeVariant(target);
 if (target.matches('[data-cart-quantity]') && target.closest('#CartDrawer')) mutateCart(target.closest('[data-cart-line]'), Number(target.value));
 if (target.matches('[data-country]')) updateProvince(target);
});
document.addEventListener('keydown', event => {
 if (event.key !== 'Escape') return;
 const header = document.querySelector('[data-header]'); header?.classList.remove('menu-open'); header?.querySelector('[data-menu-toggle]')?.setAttribute('aria-expanded', 'false');
 const search = document.getElementById('HeaderSearch'); if (search && !search.hidden) { search.hidden = true; header?.querySelector('[data-search-toggle]')?.setAttribute('aria-expanded', 'false'); }
});
document.querySelectorAll('dialog').forEach(dialog => {
 dialog.addEventListener('close', () => { if (dialog.id === 'QuickView' && quickRequest) quickRequest.abort(); dialog.querySelectorAll('video').forEach(video => video.pause()); lockBody(); });
 dialog.addEventListener('click', event => { if (event.target !== dialog) return; const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { dialog.close(); lockBody(); } });
});
let scrollQueued = false;
const updateHeader = () => { document.querySelector('[data-header]')?.classList.toggle('scrolled', window.scrollY > 80); scrollQueued = false; };
window.addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateHeader); } }, { passive: true });
document.addEventListener('shopify:section:load', event => init(event.target));
document.addEventListener('shopify:section:unload', event => event.target.querySelector('[data-slideshow]')?.dispatchEvent(new Event('bns:unload')));
document.addEventListener('shopify:block:select', event => { const slide = event.target.closest('[data-slide]'); if (slide) { const hero = slide.closest('[data-slideshow]'); hero.dispatchEvent(new CustomEvent('bns:slide', { detail: [...hero.querySelectorAll('[data-slide]')].indexOf(slide) })); } });
document.addEventListener('bns:cart-refresh', async () => { try { await refreshCart(); openDialog(document.getElementById('CartDrawer')); toast(config.added); } catch { window.location.assign(config.cart); } });
updateHeader(); init();
})();
