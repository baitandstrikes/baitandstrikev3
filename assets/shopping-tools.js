(() => {
  'use strict';
  const labelsNode = document.getElementById('shopping-tools-labels');
  if (!labelsNode || !window.BnsSpecs) return;
  const L = JSON.parse(labelsNode.textContent);
  const dialog = document.getElementById('ShoppingTools');
  const content = dialog.querySelector('[data-tools-content]');
  const status = dialog.querySelector('[data-tools-status]');
  const error = dialog.querySelector('[data-tools-error]');
  const retry = dialog.querySelector('[data-tools-retry]');
  const config = JSON.parse(document.getElementById('bns-config').textContent);
  const root = config.root || '/';
  const storageKey = 'bns.shopping.v1';
  const handleOK = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,200}$/.test(value);
  const normalize = value => ({wishlist: [...new Set((Array.isArray(value?.wishlist) ? value.wishlist : []).filter(handleOK))].slice(0,100), compare: [...new Set((Array.isArray(value?.compare) ? value.compare : []).filter(handleOK))].slice(0,3)});
  let state = normalize({}), persistent = true, mode = 'wishlist', version = 0;
  let products = new Map();
  let requests;
  const selected = new Map();
  try { state = normalize(JSON.parse(localStorage.getItem(storageKey) || '{}')); } catch { persistent = false; }
  const node = (tag, text, cls) => {
    const el = document.createElement(tag); if (text) el.textContent = text; if (cls) el.className = cls; return el;
  };
  const button = (text, action) => {const el = node('button',text,'text-link'); el.type='button'; el.addEventListener('click',action); return el;};
  const announce = message => {const toast = document.getElementById('BnsStatus'); toast.textContent=message; toast.classList.add('is-visible'); setTimeout(()=>toast.classList.remove('is-visible'),4500);};
  const sync = () => {
    document.querySelectorAll('[data-tools-count]').forEach(el => el.textContent = state[el.dataset.toolsCount].length);
    document.querySelectorAll('[data-tool-handle]').forEach(group => {
      const handle=group.dataset.toolHandle;
      for(const [key,attr] of [['wishlist','data-wishlist-toggle'],['compare','data-compare-toggle']]) {
        const control=group.querySelector(`[${attr}]`); if(!control) continue;
        control.setAttribute('aria-pressed',String(state[key].includes(handle)));
        if(key==='wishlist') {const span=control.querySelector('span');if(span) span.textContent=state[key].includes(handle)?L.saved:L.save;}
      }
    });
  };
  const save = () => {try {localStorage.setItem(storageKey,JSON.stringify(state));} catch {persistent=false;} sync();};
  const readData = scope => {
    const script=scope.querySelector('[data-tool-product]');
    if(!script) throw new Error(L.unavailable);
    return window.BnsSpecs.read(JSON.parse(script.textContent));
  };
  const loadProduct = async (handle,signal) => {
    const url = new URL(root+'products/'+handle,location.origin); url.searchParams.set('section_id','product-tools-data');
    const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal});
    if(!response.ok) throw new Error(L.error);
    const data=readData(new DOMParser().parseFromString(await response.text(),'text/html'));
    if(data.handle!==handle) throw new Error(L.error);
    return data;
  };
  const choice = product => product.variants.find(v=>v.id===selected.get(product.handle)) || product.variants.find(v=>v.available) || product.variants[0];
  const picker = (product,callback) => {
    const select=node('select'); select.setAttribute('aria-label',L.variant+': '+product.title);
    for(const v of product.variants) select.append(new Option(v.title+(v.available?'':' · '+L.sold_out),v.id));
    select.value=choice(product)?.id || '';
    select.addEventListener('change',()=>{selected.set(product.handle,select.value);callback();}); return select;
  };
  const productHead = product => {
    const article=node('article','','tools-item');
    if(product.image) {const img=node('img');img.src=product.image;img.alt=product.title;img.width=360;img.height=240;img.loading='lazy';article.append(img);}
    const heading=node('h3');const link=node('a',product.title);link.href=product.url;heading.append(link);article.append(heading,node('p',product.vendor));return article;
  };
  const priceLink = product => {const link=node('a',L.view_price,'text-link');const url=new URL(product.url,location.origin);if(choice(product))url.searchParams.set('variant',choice(product).id);link.href=url.pathname+url.search;return link;};
  const toggle = (key,handle) => {
    const index=state[key].indexOf(handle);
    if(index>=0) state[key].splice(index,1);
    else {if(state[key].length>=(key==='compare'?3:100)){announce(L.limit);return;}state[key].push(handle);}
    save(); if(dialog.open && mode===key) show(key);
  };
  const render = () => {
    content.replaceChildren();
    status.textContent=!persistent?L.storage_note:mode==='compare'?L.compare_hint:'';
    const handles=state[mode];
    if(!handles.length){content.append(node('p',L.empty));return;}
    if(mode==='compare') {
      const scroll=node('div','','compare-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',L.compare);
      const table=node('table','','compare-table'),caption=node('caption',L.compare_hint,'visually-hidden');table.append(caption);
      const head=node('thead'),header=node('tr');const label=node('th',L.product);label.scope='col';header.append(label);
      handles.forEach(handle=>{const product=products.get(handle),cell=node('th');cell.scope='col';if(product){cell.append(productHead(product),picker(product,render));}else cell.append(node('p',L.unavailable));cell.append(button(L.remove,()=>toggle('compare',handle)));header.append(cell);});head.append(header);table.append(head);
      const body=node('tbody');
      const categories=uniqueCategories(handles.map(handle=>products.get(handle)?.category));
      const rows=['brand','price','stock','sku',...(categories.includes('rod')?['length','action','line_weight','pe']:[]),...(categories.includes('reel')?['size','ratio','drag']:[]),...(categories.includes('line')?['pe','line_weight','length','diameter']:[]),'weight'];
      const cards=node('div','','compare-cards');
      handles.forEach(handle=>{
        const product=products.get(handle),variant=product&&choice(product),card=node('article','','compare-card');
        if(product){card.append(productHead(product),picker(product,render));}
        else card.append(node('p',L.unavailable));
        const specs=node('dl','','compare-card-specs');
        [...new Set(rows)].forEach(key=>{
          const detail=node('div','','compare-card-spec'),value=node('dd');
          detail.append(node('dt',L[key]));
          if(key==='price'&&product)value.append(priceLink(product));
          else {
            let text='—';
            if(product&&variant)text=key==='brand'?product.vendor:key==='stock'?(variant.available?L.ready:L.sold_out):key==='sku'?(variant.sku||'—'):(variant.specs[key]?.join(' / ')||L.not_available);
            value.textContent=text;
          }
          detail.append(value);specs.append(detail);
        });
        card.append(specs);
        const actions=node('div','','compare-card-actions');
        actions.append(button(L.remove,()=>toggle('compare',handle)));card.append(actions);cards.append(card);
      });
      [...new Set(rows)].forEach(key=>{const row=node('tr'),th=node('th',L[key]);th.scope='row';row.append(th);handles.forEach(handle=>{const p=products.get(handle),v=p&&choice(p);const cell=node('td');if(key==='price'&&p)cell.append(priceLink(p));else{let value='—';if(p&&v)value=key==='brand'?p.vendor:key==='stock'?(v.available?L.ready:L.sold_out):key==='sku'?(v.sku||'—'):(v.specs[key]?.join(' / ')||L.not_available);cell.textContent=value;}row.append(cell);});body.append(row);});
      table.append(body);scroll.append(table);content.append(cards,scroll);
    } else {
      const list=node('div','','tools-list');handles.forEach(handle=>{const p=products.get(handle);if(!p){const missing=node('article',L.unavailable,'tools-item');missing.append(button(L.remove,()=>toggle('wishlist',handle)));list.append(missing);return;}
        const article=productHead(p),v=choice(p);article.append(picker(p,render),priceLink(p),node('p',v?.available?L.ready:L.sold_out));const actions=node('div','','shopping-actions');actions.append(button(L.compare,()=>{toggle('compare',handle);}),button(L.remove,()=>toggle('wishlist',handle)));article.append(actions);list.append(article);});content.append(list);
    }
  };
  const uniqueCategories=values=>[...new Set(values)];
  const show = async key => {
    mode=key;const requestVersion=++version;
    requests?.abort();requests=new AbortController();const signal=requests.signal;
    document.querySelectorAll('dialog[open]').forEach(other=>{if(other!==dialog)other.close();});
    if(!dialog.open) dialog.showModal();document.body.classList.add('dialog-open');
    const title=dialog.querySelector('h2');title.textContent=L[key];title.tabIndex=-1;title.focus();dialog.querySelectorAll('[data-tools-open]').forEach(button=>button.setAttribute('aria-current',String(button.dataset.toolsOpen===key)));
    content.replaceChildren();status.textContent=L.loading;error.hidden=true;retry.hidden=true;
    const handles=state[key];
    products=new Map();
    const results=[];let index=0;
    await Promise.all(Array.from({length:Math.min(4,handles.length)},async()=>{while(index<handles.length&&!signal.aborted){const handle=handles[index++];try{results.push({status:'fulfilled',value:[handle,await loadProduct(handle,signal)]});}catch(reason){results.push({status:'rejected',reason});}}}));
    if(requestVersion!==version||!dialog.open)return;
    results.forEach(result=>{if(result.status==='fulfilled')products.set(...result.value);});
    render();
    if(results.some(result=>result.status==='rejected')){error.textContent=L.error;error.hidden=false;retry.hidden=false;}
  };
  retry.addEventListener('click',()=>show(mode));
  document.addEventListener('click',event=>{
    const open=event.target.closest('[data-tools-open]');if(open){show(open.dataset.toolsOpen);return;}
    const action=event.target.closest('[data-wishlist-toggle],[data-compare-toggle]');if(!action)return;
    const handle=action.closest('[data-tool-handle]')?.dataset.toolHandle;if(!handleOK(handle))return;
    if(action.matches('[data-wishlist-toggle]'))toggle('wishlist',handle);
    else if(action.matches('[data-compare-toggle]'))toggle('compare',handle);
  });
  dialog.addEventListener('close',()=>{version++;requests?.abort();});
  window.addEventListener('storage',event=>{if(event.key!==storageKey)return;try{state=normalize(JSON.parse(event.newValue||'{}'));sync();if(dialog.open)show(mode);}catch{}});
  const init = (scope=document) => {
    scope.querySelectorAll('[data-fishing-card]').forEach(card=>{
      if(card.dataset.specsReady)return;card.dataset.specsReady='true';
      try {const p=readData(card),order=p.category==='reel'?['size','ratio','drag']:p.category==='rod'?['length','action','line_weight']:['pe','line_weight','length','diameter'];
        const lines=order.map(key=>{const values=[...new Set(p.variants.flatMap(v=>v.specs[key]||[]))];return values.length?L[key]+': '+values.slice(0,3).join(' / ')+(values.length>3?' …':''):'';}).filter(Boolean).slice(0,3);
        if(lines.length){const specs=node('div','','card-spec-details');lines.forEach(line=>specs.append(node('p',line)));card.querySelector('.card-specs')?.replaceWith(specs);}
      }catch{}
    });sync();
  };
  new MutationObserver(records=>{if(records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&(node.matches('[data-fishing-card],[data-product-root]')||node.querySelector('[data-fishing-card],[data-product-root]')))))init();}).observe(document.getElementById('MainContent'),{childList:true,subtree:true});
  document.addEventListener('shopify:section:load',event=>init(event.target));
  init();
})();
