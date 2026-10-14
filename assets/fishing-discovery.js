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
      const viewSwitch = element('div', '', 'catalog-view-switch');
      viewSwitch.setAttribute('role','group');viewSwitch.setAttribute('aria-label',labels.grid_view);
      const setColumns = value => {
        grid.dataset.mobileColumns=String(value);
        viewSwitch.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.columns===String(value))));
      };
      [2,1].forEach(columns=>{
        const button=element('button','','catalog-view-button');button.type='button';button.dataset.columns=String(columns);
        button.setAttribute('aria-label',columns===1?labels.one_column:labels.two_columns);button.title=button.getAttribute('aria-label');
        const icon=element('span','','catalog-view-icon');icon.setAttribute('aria-hidden','true');
        for(let i=0;i<(columns===2?4:1);i++)icon.append(element('i'));
        button.append(icon);button.addEventListener('click',()=>{setColumns(columns);try{localStorage.setItem('bns.mobileColumns',String(columns));}catch{}});viewSwitch.append(button);
      });
      catalog.querySelector('.catalog-bar')?.append(viewSwitch);
      let savedColumns='2';try{savedColumns=localStorage.getItem('bns.mobileColumns')||'2';}catch{}
      setColumns(savedColumns==='1'?1:2);
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
      const mobile = window.matchMedia?.('(max-width: 749px)') || {matches:false,addEventListener(){}};
      const sidebar = panel.closest('.catalog-filters');
      const filterToggle = catalog.querySelector('[data-filter-toggle]');
      const nativeForm = sidebar?.querySelector('.filter-form');
      const facetFields = new Map();
      let mobileDialog, mobileApply, chips, matchingCount = null, nativeDirty = false;
      const updateMobile = () => {
        controls.querySelectorAll('.fishing-facet-group').forEach(group => {
          const active = [...group.querySelectorAll('select')].filter(select=>select.value).length;
          group.querySelector('summary small').textContent = active ? String(active) : '';
        });
        if(!chips)return;
        chips.replaceChildren();
        for(const [key,value] of selections) {
          if(!value)continue;
          const field=facetFields.get(key);if(!field)continue;
          const chip=element('button',field.label+': '+value+' ×','fishing-filter-chip');chip.type='button';
          chip.setAttribute('aria-label',labels.remove_filter+': '+field.label+' '+value);
          chip.addEventListener('click',()=>{field.select.value='';field.select.dispatchEvent(new Event('change',{bubbles:true}));});
          chips.append(chip);
        }
        chips.hidden=!chips.children.length;
        filterToggle.dataset.activeCount=chips.children.length?String(chips.children.length):'';
        mobileApply.textContent=labels.show_results+(matchingCount===null?'':' ('+matchingCount+')');
      };
      const render = () => {
        const selected = [...selections].filter(([, value]) => value !== '');
        const url = new URL(location.href);
        [...url.searchParams.keys()].filter(key => key.startsWith(paramPrefix)).forEach(key => url.searchParams.delete(key));
        selected.forEach(([key, value]) => url.searchParams.set(paramPrefix + key, value));
        if (!selected.length) {
          matchingCount=null;
          grid.replaceChildren(...originalCards.map(card => card.cloneNode(true)));
          nativePagination.hidden = false;
          pagination.hidden = true;
          count.hidden = true;
          history.replaceState({}, '', url.pathname + url.search);
          updateMobile();
          return;
        }
        const filtered = records.filter(record => {
          const brand = selections.get('brand');
          if (brand && record.brand !== brand) return false;
          const options = selected.filter(([key]) => key !== 'brand');
          return !options.length || record.variants.some(variant => options.every(([key, value]) => {
            if (key.startsWith('spec_')) return (record.specs[record.variants.indexOf(variant)]?.[key.slice(5)] || []).includes(value);
            if (key === '_length') return (record.specs[record.variants.indexOf(variant)]?.length || units(variant, 'm')).includes(value);
            if (key === '_weight') return units(variant, 'g').includes(value);
            const index = record.options.findIndex(name => normalize(name) === key);
            return index >= 0 && String(variant[index]) === value;
          }));
        });
        const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
        page = Math.min(page, pages);
        url.searchParams.set('bns.page', String(page));
        history.replaceState({}, '', url.pathname + url.search);
        matchingCount=filtered.length;
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
        updateMobile();
      };
      const buildControls = () => {
        const groups = new Map([['brand', {label: labels.brand, values: new Set()}]]);
        for (const key of ['length','action','line_weight','pe','size','ratio','drag','diameter','weight']) groups.set('spec_'+key, {label: labels[key], values: new Set()});
        for (const record of records) {
          if (record.brand) groups.get('brand').values.add(record.brand);
          record.specs.forEach(spec => {for (const [key, values] of Object.entries(spec)) {const group=groups.get('spec_'+key);if(group) values.forEach(value=>group.values.add(value));}});
          record.options.forEach((name, index) => {
            const key = normalize(name);
            if (key === 'title' || key === 'brand') return;
            if (!groups.has(key)) groups.set(key, {label: name, values: new Set()});
            record.variants.forEach(variant => { if (variant[index]) groups.get(key).values.add(String(variant[index])); });
          });
        }
        const aliases = {panjang:'length',length:'length',action:'action','line weight':'line_weight','line rating':'line_weight',pe:'pe','gear ratio':'ratio','gear rasio':'ratio',drag:'drag',diameter:'diameter',berat:'weight',weight:'weight'};
        for (const [key, target] of Object.entries(aliases)) if (groups.get('spec_'+target)?.values.size) groups.delete(key);
        const url = new URL(location.href);
        controls.replaceChildren(element('p', labels.hint, 'fishing-facet-hint'));
        facetFields.clear();
        const sections = new Map();
        const collectionPath=grid.dataset.firstUrl||location.pathname;
        const primary=/fishing-rods-joran/.test(collectionPath)?['length','action','line_weight','pe']:/\/reel(?:\?|$|\/)/.test(collectionPath)?['size','ratio','drag','weight']:/fishing-line/.test(collectionPath)?['pe','line_weight','length','diameter']:['length','action','line_weight','pe','size','ratio','drag','diameter','weight'];
        const destination = key => {
          if(key==='brand')return controls;
          const kind=key.startsWith('spec_')&&primary.includes(key.slice(5))?'specifications':'other_options';
          if(!sections.has(kind)) {
            const details=element('details','','fishing-facet-group');details.open=!mobile.matches;
            const summary=element('summary',labels[kind]);summary.append(element('small'));
            const body=element('div','','fishing-facet-fields');details.append(summary,body);controls.append(details);sections.set(kind,body);
          }
          return sections.get(kind);
        };
        let number = 0;
        for (const [key, group] of groups) {
          if (!group.values.size) continue;
          const label = element('label', group.label);
          const select = element('select');
          select.id = `FishingFacet-${grid.dataset.sectionId}-${number++}`;
          label.htmlFor = select.id;
          select.append(new Option(labels.all, ''));
          [...group.values].sort((a, b) => key.startsWith('_') ? parseFloat(a) - parseFloat(b) : a.localeCompare(b, undefined, {numeric: true})).forEach(value => select.append(new Option(value, value)));
          const selected = url.searchParams.get(paramPrefix + key) || (key === 'spec_length' ? url.searchParams.get('bns._length') : key === 'spec_weight' ? url.searchParams.get('bns._weight') : '') || '';
          if (group.values.has(selected)) select.value = selected;
          selections.set(key, select.value);
          select.addEventListener('change', () => { selections.set(key, select.value); page = 1; render(); });
          const field=element('div','','fishing-facet-field');field.append(label,select);
          destination(key).append(field);facetFields.set(key,{select,label:group.label});
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
          records = [...cards.values()].map(card => {let specs=[];try{const data=JSON.parse(card.querySelector('[data-tool-product]').textContent);specs=window.BnsSpecs.read(data).variants.map(v=>v.specs);}catch{}return ({card, specs, brand: (card.dataset.fishingBrand || '').trim().toLocaleUpperCase(), options: JSON.parse(card.dataset.fishingOptions || '[]'), variants: JSON.parse(card.dataset.fishingVariants || '[]')});});
          ready = true; status.textContent = ''; controls.hidden = false;
          trigger.setAttribute('aria-expanded', 'true');trigger.hidden=mobile.matches;buildControls();
        } catch (error) {
          if (error.name !== 'AbortError') status.textContent = labels.error;
        } finally { loading = false; trigger.disabled = false; }
      };
      trigger.addEventListener('click', load);
      if(sidebar&&filterToggle) {
        const anchor=element('span');anchor.hidden=true;sidebar.before(anchor);
        mobileDialog=element('dialog','','mobile-filter-dialog');mobileDialog.id='MobileFilters-'+grid.dataset.sectionId;
        const heading=element('div','','mobile-filter-heading'),title=element('h2',labels.filter);
        title.id=mobileDialog.id+'-title';mobileDialog.setAttribute('aria-labelledby',title.id);
        const close=element('button','×','icon-button');close.type='button';close.setAttribute('aria-label',labels.close);close.addEventListener('click',()=>mobileDialog.close());heading.append(title,close);
        const scroll=element('div','','mobile-filter-scroll'),footer=element('div','','mobile-filter-footer');
        const resetAll=element('button',labels.reset,'text-link');resetAll.type='button';
        resetAll.addEventListener('click',()=>{
          controls.querySelectorAll('select').forEach(select=>select.value='');selections.forEach((_,key)=>selections.set(key,''));page=1;render();
          if(nativeForm){nativeForm.querySelectorAll('input[type=checkbox]').forEach(input=>input.checked=false);nativeForm.querySelectorAll('input[type=number]').forEach(input=>input.value='');nativeDirty=true;}
        });
        mobileApply=element('button',labels.show_results,'button');mobileApply.type='button';
        mobileApply.addEventListener('click',()=>{if(nativeDirty&&nativeForm){nativeForm.requestSubmit();return;}mobileDialog.close();});
        footer.append(resetAll,mobileApply);mobileDialog.append(heading,scroll,footer);document.body.append(mobileDialog);
        chips=element('div','','fishing-active-filters');chips.hidden=true;chips.setAttribute('aria-label',labels.active_filters);count.before(chips);
        const nativeGroups=[...sidebar.querySelectorAll('.filter-group')].map(details=>({details,open:details.open}));
        const adapt = () => {
          if(!mobile.matches&&mobileDialog.open)mobileDialog.close();
          if(mobile.matches)sidebar.classList.remove('is-open');
          nativeGroups.forEach(({details,open})=>details.open=mobile.matches?false:open);
          controls.querySelectorAll('.fishing-facet-group').forEach(details=>details.open=!mobile.matches);
          filterToggle.setAttribute('aria-controls',mobile.matches?mobileDialog.id:sidebar.id);
          if(mobile.matches){filterToggle.setAttribute('aria-haspopup','dialog');filterToggle.setAttribute('aria-expanded',String(mobileDialog.open));}else filterToggle.removeAttribute('aria-haspopup');
          trigger.hidden=ready&&mobile.matches;
        };
        filterToggle.addEventListener('click',event=>{
          if(!mobile.matches)return;event.preventDefault();event.stopImmediatePropagation();
          document.querySelectorAll('dialog[open]').forEach(dialog=>{if(dialog!==mobileDialog)dialog.close();});
          scroll.append(sidebar);sidebar.classList.remove('is-open');mobileDialog.showModal();document.body.classList.add('dialog-open');filterToggle.setAttribute('aria-expanded','true');
          if(!ready&&!loading)load();
        },{capture:true,signal:controller.signal});
        nativeForm?.addEventListener('change',()=>nativeDirty=true,{signal:controller.signal});
        mobileDialog.addEventListener('close',()=>{anchor.after(sidebar);sidebar.classList.remove('is-open');filterToggle.setAttribute('aria-expanded','false');document.body.classList.toggle('dialog-open',Boolean(document.querySelector('dialog[open]')));});
        mobileDialog.addEventListener('click',event=>{if(event.target!==mobileDialog)return;const rect=mobileDialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)mobileDialog.close();});
        mobile.addEventListener('change',adapt,{signal:controller.signal});adapt();
      }
      document.addEventListener('shopify:section:unload', event => {if(event.target.contains(catalog)){mobileDialog?.close();mobileDialog?.remove();controller.abort();}}, {signal: controller.signal});
      if ([...new URL(location.href).searchParams.keys()].some(key => key.startsWith(paramPrefix))) {
        if(!mobile.matches){sidebar?.classList.add('is-open');filterToggle?.setAttribute('aria-expanded','true');}
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
