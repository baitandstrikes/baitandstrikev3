(() => {
  'use strict';
  const configNode = document.getElementById('bns-config');
  if (!configNode) return;
  const config = JSON.parse(configNode.textContent);
  let pending, debounce, searchVersion = 0;
  document.addEventListener('input', event => {
    if (!event.target.matches('[data-predictive-input]')) return;
    const input = event.target;
    const results = document.getElementById('PredictiveResults');
    const query = input.value.trim();
    const version = ++searchVersion;
    clearTimeout(debounce);
    pending?.abort();
    results.hidden = true;
    results.removeAttribute('aria-busy');
    if (query.length < 2) return;
    debounce = setTimeout(async () => {
      const controller = new AbortController();
      pending = controller;
      results.setAttribute('aria-busy', 'true');
      try {
        const url = new URL(config.predictive, location.origin);
        url.searchParams.set('q', query);
        url.searchParams.set('section_id', 'predictive-search');
        url.searchParams.set('resources[type]', 'product,collection,page');
        url.searchParams.set('resources[limit]', '6');
        url.searchParams.set('resources[options][fields]', 'title,vendor,variants.title,variants.sku');
        const response = await fetch(url, {signal: controller.signal, credentials: 'same-origin'});
        if (!response.ok) throw new Error('Search unavailable');
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const content = doc.querySelector('[data-predictive-response]');
        if (version !== searchVersion || !content) return;
        results.replaceChildren(content);
        results.hidden = false;
      } catch (error) {
        if (error.name !== 'AbortError' && version === searchVersion) results.hidden = true;
      } finally {
        if (version === searchVersion) results.removeAttribute('aria-busy');
      }
    }, 220);
  });
  document.addEventListener('click', event => {
    const filter = event.target.closest('[data-filter-toggle]');
    if (filter) {
      const panel = document.getElementById(filter.getAttribute('aria-controls'));
      filter.setAttribute('aria-expanded', String(panel.classList.toggle('is-open')));
    }
    const control = event.target.closest('[data-testimonial-prev], [data-testimonial-next]');
    if (control) {
      const slides = [...control.closest('[data-testimonials]').querySelectorAll('[data-testimonial]')];
      const index = slides.findIndex(slide => !slide.hidden);
      const next = (index + (control.matches('[data-testimonial-next]') ? 1 : -1) + slides.length) % slides.length;
      slides.forEach((slide, i) => slide.hidden = i !== next);
    }
    if (event.target.closest('[data-menu-toggle]')) {
      const header = document.querySelector('[data-header]');
      const opened = header.classList.contains('menu-open');
      document.querySelectorAll('[data-menu-toggle]').forEach(button => button.setAttribute('aria-expanded', String(opened)));
    }
    if (event.target.closest('[data-search-toggle]')) {
      if (document.getElementById('HeaderSearch').hidden) {
        ++searchVersion; pending?.abort(); clearTimeout(debounce);
      }
    }
  });
  document.addEventListener('change', event => {
    if (event.target.matches('#SortBy')) event.target.form.requestSubmit();
  });
  const timers = new Map();
  const init = (scope = document) => {
    scope.querySelectorAll('[data-countdown]').forEach(section => {
      if (timers.has(section)) return;
      const raw = section.dataset.countdown;
      const end = raw && /T.*(Z|[+-]\d\d:\d\d)$/.test(raw) ? Date.parse(raw) : NaN;
      const clock = section.querySelector('[data-countdown-clock]');
      if (!Number.isFinite(end)) return;
      const update = () => {
        const seconds = Math.max(0, Math.floor((end - Date.now()) / 1000));
        clock.hidden = seconds === 0;
        const values = {days: Math.floor(seconds / 86400), hours: Math.floor(seconds / 3600) % 24, minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60};
        for (const [unit, value] of Object.entries(values)) clock.querySelector(`[data-time="${unit}"]`).textContent = String(value).padStart(2, '0');
        if (!section.isConnected || seconds === 0) {clearInterval(timers.get(section)); timers.delete(section);}
      };
      timers.set(section, setInterval(update, 1000));
      update();
    });
  };
  document.addEventListener('shopify:section:load', event => init(event.target));
  document.addEventListener('shopify:section:unload', event => {
    for (const [section, timer] of timers) if (event.target.contains(section)) {clearInterval(timer); timers.delete(section);}
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {++searchVersion; pending?.abort(); clearTimeout(debounce);}
  });
  init();
})();
