(() => {
  'use strict';
  const unique = values => [...new Set(values.filter(Boolean))];
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const scan = text => {
    const result = {};
    const patterns = {
      length: /(?:panjang|length)\s*[:=]?\s*(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)\s*(cm|m)\b/gi,
      action: /\baction\s*[:=]?\s*((?:extra[ -]?)?fast|moderate(?:[ -]fast)?|regular(?:[ -]fast)?|slow)\b/gi,
      line_weight: /(?:line\s*(?:weight|rating)|kekuatan(?:\s*senar)?)\s*[:=]?\s*(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)\s*(lbs?)\b/gi,
      pe: /\bPE\s*[:=#]?\s*(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)/gi,
      ratio: /(?:gear\s*)?ra(?:tio|sio)\s*[:=]?\s*(\d+(?:[.,]\d+)?\s*:\s*1)\b/gi,
      drag: /\b(?:max\s*)?drag(?:\s*power)?\s*[:=]?\s*(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)\s*(kg)\b/gi,
      diameter: /(?:diameter|diam\.?|dia\.?)\s*[:=]?\s*(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)\s*(mm)\b/gi,
      size: /(?:size|ukuran)\s*[:=]?\s*(\d{3,5}[a-z]*)(?!\d)/gi,
      weight: /\b(?:berat(?:\s*reel)?|weight)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(gram|gr|g)\b/gi
    };
    for (const [key, pattern] of Object.entries(patterns)) {
      result[key] = unique([...text.matchAll(pattern)].map(match => clean(match[1]).replace(/\s*[-–]\s*/g, '–').replace(/,/g, '.').toUpperCase() + (match[2] ? ' ' + (match[2].toLowerCase().startsWith('lb') ? 'lb' : /^(gram|gr)$/.test(match[2].toLowerCase()) ? 'g' : match[2].toLowerCase()) : '')));
    }
    return result;
  };
  const read = data => {
    const doc = new DOMParser().parseFromString(data.description || '', 'text/html');
    doc.querySelectorAll('script,style,iframe').forEach(node => node.remove());
    const lines = [...doc.querySelectorAll('p,li,tr')].map(node => clean(node.textContent)).filter(Boolean);
    if (!lines.length) lines.push(clean(doc.body.textContent));
    const all = scan(lines.join(' / '));
    const shared = Object.fromEntries(Object.entries(all).map(([key, values]) => [key, values.length === 1 ? values : []]));
    const category = /\b(reel)\b/i.test(data.title) ? 'reel' : /joran|\brods?\b/i.test(data.title) ? 'rod' : /\b(line|senar|benang|braid)\b/i.test(data.title) ? 'line' : 'other';
    const variants = (data.variants || []).map(variant => {
      const specs = {...shared};
      const values = variant.options || [];
      const tokens = values.map(value => clean(value).toUpperCase());
      const lengths = tokens.flatMap(token => [...token.matchAll(/(?:^|[^A-Z\d.])(\d+(?:[.,]\d+)?)\s*(M|CM)(?![A-Z])/g)].map(match => Number(match[1].replace(',', '.')) * (match[2] === 'CM' ? .01 : 1)));
      const matching = lines.filter(line => tokens.some(token => (token.length >= 4 || /^\d{3}[A-Z]*$/.test(token)) && /\d/.test(token) && new RegExp((/^\d+$/.test(token)?'(?:^|[^0-9])':'(?:^|[^A-Z0-9])')+token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+(/^\d+$/.test(token)?'(?![0-9])':'(?![A-Z0-9])')).test(line.toUpperCase())) || scan(line).length.some(value => lengths.includes(parseFloat(value) * (value.endsWith('cm') ? .01 : 1))));
      if (matching.length === 1) Object.assign(specs, Object.fromEntries(Object.entries(scan(matching[0])).filter(([, values]) => values.length)));
      (data.options || []).forEach((name, index) => {
        const key = /action/i.test(name) ? 'action' : /gear|ratio|rasio/i.test(name) ? 'ratio' : /drag/i.test(name) ? 'drag' : /diameter/i.test(name) ? 'diameter' : /line.*weight|\blb/i.test(name) ? 'line_weight' : /\bpe\b/i.test(name) ? 'pe' : /panjang|length/i.test(name) ? 'length' : category === 'reel' && /size|ukuran/i.test(name) ? 'size' : null;
        if (key && values[index]) specs[key] = [clean(values[index])];
      });
      const variantText = values.join(' / ');
      const variantSpecs = scan(variantText);
      if (variantSpecs.pe.length) specs.pe = variantSpecs.pe;
      const length = [...variantText.matchAll(/(?:^|[^a-z\d.])(\d+(?:[.,]\d+)?)\s*(m|cm)(?![a-z])/gi)].map(m => Number(m[1].replace(',', '.')) + ' ' + m[2].toLowerCase());
      if (category !== 'reel' && length.length) specs.length = unique(length);
      const weights = [...variantText.matchAll(/(?:^|[^a-z\d.])(\d+(?:[.,]\d+)?)\s*g(?![a-z])/gi)].map(match => Number(match[1].replace(',', '.')) + ' g');
      if (weights.length) specs.weight = unique(weights);
      if (category === 'rod' && !specs.line_weight.length) {
        specs.line_weight = unique([...((matching.length === 1 ? matching[0] : all.pe.length <= 1 ? lines.join(' / ') : '')).matchAll(/(?:^|[^\d.])(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)\s*lbs?\b/gi)].map(m => m[1].replace(/\s*[-–]\s*/g, '–') + ' lb'));
      }
      if (category === 'line') {
        if (!specs.length.length) {const titleLengths=unique([...data.title.matchAll(/(?:^|[^a-z\d.])(\d+(?:[.,]\d+)?)\s*(m|cm)(?![a-z])/gi)].map(match=>Number(match[1].replace(',', '.'))+' '+match[2].toLowerCase()));if(titleLengths.length===1)specs.length=titleLengths;}
        if (!specs.diameter.length) specs.diameter = unique([...variantText.matchAll(/(\d+(?:[.,]\d+)?)\s*mm\b/gi)].map(m => m[1].replace(',', '.') + ' mm'));
        if (!specs.line_weight.length) specs.line_weight = unique([...variantText.matchAll(/(\d+(?:[.,]\d+)?)\s*lbs?\b/gi)].map(m => m[1] + ' lb'));
      }
      return {...variant, specs};
    });
    return {...data, category, variants};
  };
  window.BnsSpecs = {read, scan};
})();
