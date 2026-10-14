(() => {
  'use strict';
  const unique = values => [...new Set(values.filter(Boolean))];
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const measure = (text, unit) => unique([...text.matchAll(new RegExp('(?:^|[^a-z\\d.])(\\d+(?:[.,]\\d+)?(?:\\s*[-–]\\s*\\d+(?:[.,]\\d+)?)?)\\s*('+unit+')(?![a-z])','gi'))].map(match => match[1].split(/[-–]/).map(value=>Number(value.trim().replace(',', '.'))).join('–')+' '+match[2].toLowerCase().replace(/^meters?$/, 'm').replace(/^(gram|gr)$/, 'g').replace(/^lbs$/, 'lb')));
  const scan = (text, category = '') => {
    const result = {};
    const patterns = {
      length: /(?:panjang(?:\s*(?:terpasang|joran|senar))?|length)\s*[:=]?\s*(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)\s*(cm|meters?|m)\b/gi,
      action: /\baction(?:\s*tap(?:p)?er)?\s*[:=]?\s*((?:extra[ -]?)?fast|moderate(?:[ -]fast)?|medium[ -]fast|regular(?:[ -]fast)?|slow)\b/gi,
      line_weight: /(?:line\s*(?:weight|rating)?|kekuatan(?:\s*senar)?)\s*[:=]?\s*(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)\s*(lbs?)\b/gi,
      pe: /\bPE\s*[:=#]?\s*(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)(?![\d.,])/gi,
      ratio: /(?:gear\s*)?ra(?:tio|sio)\s*[:=]?\s*(\d+(?:[.,]\d+)?\s*:\s*1)\b/gi,
      drag: /\b(?:max\s*)?drag(?:\s*power)?\s*[:=]?\s*(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)\s*(kg)\b/gi,
      diameter: /(?:diameter|diam\.?|dia\.?)\s*[:=]?\s*(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)\s*(mm)\b/gi,
      size: /(?:size|ukuran)\s*[:=]?\s*(\d{3,5}[a-z]*)(?!\d)/gi,
      weight: /\b(?:berat(?:\s*(?:reel|joran))?|weight)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(gram|gr|g)\b/gi
    };
    for (const [key, pattern] of Object.entries(patterns)) {
      result[key] = unique([...text.matchAll(pattern)].filter(match=>key!=='pe'||!/^\s*(?:lbs?\b|warna\b|colou?rs?\b|strands?\b|m(?:eters?)?\b|mm\b|kg\b|g\b)/i.test(text.slice(match.index+match[0].length))).map(match => clean(match[1]).replace(/\s*[-–]\s*/g, '–').replace(/,/g, '.').replace(/\s*:\s*/g, ':').toUpperCase() + (match[2] ? ' ' + match[2].toLowerCase().replace(/^lbs$/, 'lb').replace(/^(gram|gr)$/, 'g').replace(/^meters?$/, 'm') : '')));
    }
    if(category==='rod') {
      if(!result.length.length&&!/terlepas|transport|closed|collapsed|lipat|masing.masing|tip\s*dia|butt\s*dia/i.test(text))result.length=measure(text,'cm|meters?|m');
      if(!result.line_weight.length)result.line_weight=unique([...text.matchAll(/\bPE\s*[:=#]?\s*\d[^()]*\(\s*(\d+(?:[.,]\d+)?\s*[-–]\s*\d+(?:[.,]\d+)?)\s*lbs?\s*\)/gi)].map(match=>match[1].replace(/\s*[-–]\s*/g,'–')+' lb'));
    }
    if(category==='line') {
      if(!result.length.length)result.length=measure(text,'cm|meters?|m');
      if(!result.diameter.length)result.diameter=measure(text,'mm');
      if(!result.line_weight.length)result.line_weight=measure(text,'lbs?|lb');
    }
    return result;
  };
  const merge = specs => Object.fromEntries(Object.keys(scan('')).map(key=>[key,unique(specs.flatMap(spec=>spec[key]||[]))]));
  const single = specs => Object.fromEntries(Object.entries(specs).map(([key,values])=>[key,values.length===1?values:[]]));
  const read = data => {
    const doc = new DOMParser().parseFromString(data.description || '', 'text/html');
    doc.querySelectorAll('script,style,iframe').forEach(node=>node.remove());
    const context=data.title+' '+(data.type||data.productType||'');
    const collections=data.collections||[];
    const category=collections.includes('fishing-rods-joran')?'rod':collections.includes('reel')?'reel':collections.includes('fishing-line')?'line':collections.some(handle=>['fishing-accesories','fishing-bait','hook'].includes(handle))||/^(?:box|case|bag|tas|sarung)\b/i.test(data.title)?'other':/\breel\b/i.test(context)?'reel':/joran|\brods?\b/i.test(context)?'rod':/\b(line|senar|benang|braid)\b/i.test(context)?'line':'other';
    const lines=[...doc.querySelectorAll('p,li,tr')].map(node=>clean(node.textContent)).filter(Boolean);
    if(!lines.length)lines.push(clean(doc.body.textContent));
    const sizeHeading=text=>/^[^a-z\d]*(?:size|ukuran)\s*[:=]?\s*\d{3,5}\w*\s*:?\s*$/i.test(text);
    const entries=lines.map((text,index)=>{let block=text;if(sizeHeading(text)){for(let next=index+1;next<lines.length&&!sizeHeading(lines[next]);next++)block+=' / '+lines[next];}return {text,spec:scan(block,category)};});
    const tokensFor=variant=>unique((variant.options||[]).flatMap(value=>[clean(value).toUpperCase(),...String(value).split(/\|\||\//).map(part=>clean(part).toUpperCase())]));
    const matches=(text,variant)=>{
      const tokens=tokensFor(variant);
      if(tokens.some(token=>(token.length>=4||/^\d{3}[A-Z]*$/.test(token))&&/\d/.test(token)&&new RegExp((/^\d+$/.test(token)?'(?:^|[^0-9])':'(?:^|[^A-Z0-9])')+token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+(/^\d+$/.test(token)?'(?![0-9])':'(?![A-Z0-9])')).test(text.toUpperCase())))return true;
      if(category==='rod'&&tokens.some(token=>/^(CASTING|SPINNING)$/.test(token)&&text.toUpperCase().startsWith(token+' ')))return true;
      const lengths=tokens.flatMap(token=>measure(token,'cm|m')).filter(value=>!value.includes('–')).map(value=>parseFloat(value)*(value.endsWith('cm')?.01:1));
      return category==='rod'&&scan(text,category).length.some(value=>!value.includes('–')&&lengths.includes(parseFloat(value)*(value.endsWith('cm')?.01:1)));
    };
    const sourceVariants=data.variants||[];
    const globals=entries.filter(entry=>sourceVariants.length===1||!sourceVariants.some(variant=>matches(entry.text,variant)));
    const shared=single(merge(globals.map(entry=>entry.spec)));
    const variants=sourceVariants.map(variant=>{
      const matching=entries.filter(entry=>matches(entry.text,variant));
      const specific=merge(matching.map(entry=>entry.spec));
      const specs={...shared};
      for(const [key,values] of Object.entries(specific))if(values.length)specs[key]=values.length===1?values:[];
      const values=variant.options||[];
      (data.options||[]).forEach((name,index)=>{
        const key=/action/i.test(name)?'action':/gear|ratio|rasio/i.test(name)?'ratio':/drag/i.test(name)?'drag':/diameter/i.test(name)?'diameter':/line.*weight|\blb/i.test(name)?'line_weight':/\bpe\b/i.test(name)?'pe':/panjang|length/i.test(name)?'length':category==='reel'&&/size|ukuran/i.test(name)?'size':null;
        if(key&&values[index])specs[key]=[clean(values[index])];
      });
      const variantText=values.join(' / '),optionSpecs=scan(variantText);
      if(optionSpecs.pe.length)specs.pe=optionSpecs.pe;
      const lengths=measure(variantText,'cm|m');if(category!=='reel'&&lengths.length)specs.length=lengths;
      const weights=measure(variantText,'g');if(weights.length)specs.weight=weights;
      if(category==='reel'&&!specs.size.length){const sizes=values.filter(value=>/^\d{3,5}(?:S|HG|XG|H)?$/i.test(clean(value)));if(sizes.length===1)specs.size=[clean(sizes[0])];}
      if(category==='line') {
        if(!specs.length.length){const titleLengths=measure(data.title,'cm|m');if(titleLengths.length===1)specs.length=titleLengths;}
        const diameters=measure(variantText,'mm');if(diameters.length)specs.diameter=diameters;
        const lbs=measure(variantText,'lbs?|lb');if(lbs.length)specs.line_weight=lbs;
      }
      return {...variant,specs};
    });
    return {...data,category,variants};
  };
  window.BnsSpecs={read,scan};
})();
