(() => {
  'use strict';
  const labelsNode = document.getElementById('fishing-discovery-labels');
  if (!labelsNode) return;
  const labels = JSON.parse(labelsNode.textContent);
  const normalize = value => value.trim().toLocaleLowerCase();
  const paramPrefix = 'bns.';
  const units = (variant, unit) => {
    const pattern = new RegExp('(?:^|[^a-z\\d.])(\\d+(?:[.,]\\d+)?)\\s*' + unit + '(?![a-z])', 'gi');
    return [...new Set(variant.flatMap(value => [...String(value).matchAll(pattern)].map(match => String(Number(match[1].replace(',', '.'))) + ' ' + unit)))];
  };
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const init = (scope = document) => {
    scope.querySelectorAll('[data-fishing-grid]').forEach(grid => {
      if (grid.dataset.facetsReady) return;
      grid.dataset.facetsReady = 'true';
      const catalog = grid.closest('.catalog');
      const panel = catalog.querySelector('[data-fishing-facets]');
      if (!panel) return;
      const trigger = panel.querySelector('[data-load-facets]');
      const status = panel.querySelector('[data-facet-status]');
      const controls = panel.querySelector('[data-facet-controls]');
      const nativePagination = catalog.querySelector('.pagination');
      const originalCards = [...grid.children].map(card => card.cloneNode(true));
      const count = element('p', '', 'fishing-facet-count');
      count.setAttribute('role', 'status');
      count.setAttribute('aria-live', 'polite');
      count.hidden = true;
      grid.before(count);
      const pagination = element('nav', '', 'fishing-pagination');
      pagination.setAttribute('aria-label', labels.results.replace('COUNT', ''));
      pagination.hidden = true;
      grid.after(pagination);
      let records = [], ready = false, loading = false, page = 1;
      const pageSize = Number(grid.dataset.pageSize) || 24;
      const selections = new Map();
      const controller = new AbortController();
      const render = () => {
        const selected = [...selections].filter(([, value]) => value !== '');
        const url = new URL(location.href);
        [...url.searchParams.keys()].filter(key => key.startsWith(paramPrefix)).forEach(key => url.searchParams.delete(key));
        selected.forEach(([key, value]) => url.searchParams.set(paramPrefix + key, value));
        if (!selected.length) {
          grid.replaceChildren(...originalCards.map(card => card.cloneNode(true)));
          nativePagination.hidden = false;
          pagination.hidden = true;
          count.hidden = true;
          history.replaceState({}, '', url.pathname + url.search);
          return;
        }
        const filtered = records.filter(record => {
          const brand = selections.get('brand');
          if (brand && record.brand !== brand) return false;
          const options = selected.filter(([key]) => key !== 'brand');
          return !options.length || record.variants.some(variant => options.every(([key, value]) => {
            if (key === '_length') return units(variant, 'm').includes(value);
            if (key === '_weight') return units(variant, 'g').includes(value);
            const index = record.options.findIndex(name => normalize(name) === key);
            return index >= 0 && String(variant[index]) === value;
          }));
        });
        const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
        page = Math.min(page, pages);
        url.searchParams.set('bns.page', String(page));
        history.replaceState({}, '', url.pathname + url.search);
        count.textContent = labels.results.replace('COUNT', String(filtered.length));
        count.hidden = false;
        nativePagination.hidden = true;
        const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
        grid.replaceChildren(...(slice.length ? slice.map(record => record.card.cloneNode(true)) : [element('p', labels.empty)]));
        pagination.replaceChildren();
        if (pages > 1) {
          const previous = element('button', labels.previous, 'text-link');
          previous.type = 'button'; previous.disabled = page === 1;
          const next = element('button', labels.next, 'text-link');
          next.type = 'button'; next.disabled = page === pages;
          previous.addEventListener('click', () => { page--; render(); grid.scrollIntoView({block: 'start'}); });
          next.addEventListener('click', () => { page++; render(); grid.scrollIntoView({block: 'start'}); });
          pagination.append(previous, element('span', `${page} / ${pages}`), next);
        }
        pagination.hidden = pages <= 1;
      };
      const buildControls = () => {
        const groups = new Map([['brand', {label: labels.brand, values: new Set()}], ['_length', {label: labels.length, values: new Set()}], ['_weight', {label: labels.weight, values: new Set()}]]);
        for (const record of records) {
          if (record.brand) groups.get('brand').values.add(record.brand);
          record.variants.forEach(variant => {units(variant, 'm').forEach(value => groups.get('_length').values.add(value)); units(variant, 'g').forEach(value => groups.get('_weight').values.add(value));});
          record.options.forEach((name, index) => {
            const key = normalize(name);
            if (key === 'title' || key === 'brand') return;
            if (!groups.has(key)) groups.set(key, {label: name, values: new Set()});
            record.variants.forEach(variant => { if (variant[index]) groups.get(key).values.add(String(variant[index])); });
          });
        }
        const url = new URL(location.href);
        controls.replaceChildren(element('p', labels.hint));
        let number = 0;
        for (const [key, group] of groups) {
          if (!group.values.size) continue;
          const label = element('label', group.label);
          const select = element('select');
          select.id = `FishingFacet-${grid.dataset.sectionId}-${number++}`;
          label.htmlFor = select.id;
          select.append(new Option(labels.all, ''));
          [...group.values].sort((a, b) => key.startsWith('_') ? parseFloat(a) - parseFloat(b) : a.localeCompare(b, undefined, {numeric: true})).forEach(value => select.append(new Option(value, value)));
          const selected = url.searchParams.get(paramPrefix + key) || '';
          if (group.values.has(selected)) select.value = selected;
          selections.set(key, select.value);
          select.addEventListener('change', () => { selections.set(key, select.value); page = 1; render(); });
          controls.append(label, select);
        }
        const reset = element('button', labels.reset, 'text-link');
        reset.type = 'button';
        reset.addEventListener('click', () => {
          controls.querySelectorAll('select').forEach(select => select.value = '');
          selections.forEach((_, key) => selections.set(key, ''));
          page = 1; render();
        });
        controls.append(reset);
        page = Math.max(1, Number(url.searchParams.get('bns.page')) || 1);
        render();
      };
      const load = async () => {
        if (loading) return;
        if (ready) {
          controls.hidden = !controls.hidden;
          trigger.setAttribute('aria-expanded', String(!controls.hidden));
          return;
        }
        loading = true; trigger.disabled = true; status.textContent = labels.loading;
        const cards = new Map();
        const seen = new Set();
        try {
          let url = new URL(location.href);
          [...url.searchParams.keys()].filter(key => key.startsWith(paramPrefix)).forEach(key => url.searchParams.delete(key));
          url.searchParams.set('page', '1');
          while (url) {
            if (seen.has(url.href)) throw new Error('Repeated collection page');
            seen.add(url.href);
            url.searchParams.set('section_id', grid.dataset.sectionId);
            const response = await fetch(url, {credentials: 'same-origin', signal: controller.signal});
            if (!response.ok) throw new Error('Collection unavailable');
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            const incoming = doc.querySelector('[data-fishing-grid]');
            if (!incoming) throw new Error('Collection missing');
            incoming.querySelectorAll('[data-fishing-card]').forEach(card => {
              const href = card.querySelector('h3 a')?.getAttribute('href');
              if (href) cards.set(href, card);
            });
            url = incoming.dataset.nextUrl ? new URL(incoming.dataset.nextUrl, location.origin) : null;
          }
          records = [...cards.values()].map(card => ({card, brand: (card.dataset.fishingBrand || '').trim().toLocaleUpperCase(), options: JSON.parse(card.dataset.fishingOptions || '[]'), variants: JSON.parse(card.dataset.fishingVariants || '[]')}));
          ready = true; status.textContent = ''; controls.hidden = false;
          trigger.setAttribute('aria-expanded', 'true'); buildControls();
        } catch (error) {
          if (error.name !== 'AbortError') status.textContent = labels.error;
        } finally { loading = false; trigger.disabled = false; }
      };
      trigger.addEventListener('click', load);
      catalog.addEventListener('shopify:section:unload', () => controller.abort(), {once: true});
      if ([...new URL(location.href).searchParams.keys()].some(key => key.startsWith(paramPrefix))) {
        catalog.querySelector('.catalog-filters')?.classList.add('is-open');
        catalog.querySelector('[data-filter-toggle]')?.setAttribute('aria-expanded', 'true');
        load();
      }
    });
  };
  const preserve = form => {
    form.querySelectorAll('[data-fishing-preserve]').forEach(node => node.remove());
    for (const [name, value] of new URL(location.href).searchParams) {
      if (!name.startsWith(paramPrefix)) continue;
      const input = element('input'); input.type = 'hidden'; input.name = name; input.value = value;
      input.dataset.fishingPreserve = ''; form.append(input);
    }
  };
  document.addEventListener('change', event => { if (event.target.matches('#SortBy')) preserve(event.target.form); }, true);
  document.addEventListener('submit', event => { if (event.target.matches('.sort-form,.filter-form')) preserve(event.target); }, true);
  document.addEventListener('shopify:section:load', event => init(event.target));
  init();
})();
