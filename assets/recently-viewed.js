(() => {
  const KEY = 'bns-recent-products';
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  };
  const write = (items) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items.slice(0, 8)));
    } catch {}
  };
  const money = (cents) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format((Number(cents) || 0) / 100);
  const esc = (value) =>
    String(value || '').replace(/[&<>'"]/g, (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character],
    );
  const normalize = (value) => String(value || '').toLowerCase().replace(/[- ]/g, '_');
  const safeColor = (value) => (/^#[\da-f]{6}$/i.test(value || '') ? value : '');
  const getListing = (item) => {
    if (item.listingEnabled === false) return { type: '', badge: '', style: '' };

    const group = normalize(item.listingGroup);
    const tags = Array.isArray(item.tags) ? item.tags.map(normalize) : [];
    const hot =
      ['hot', 'hot_selling', 'best_seller', 'hot_deal', 'promotional', 'promotion', 'promo'].includes(group) ||
      tags.some((tag) =>
        ['listing:hot', 'listing:hot_selling', 'listing:best_seller', 'listing:hot_deal', 'listing:promo'].includes(tag),
      );
    const jemmy =
      group === 'jemmy' ||
      tags.includes('listing:jemmy') ||
      String(item.vendor || '').toLowerCase().includes('jemmy') ||
      String(item.title || '').toLowerCase().includes('jemmy');

    let type = '';
    const hasProductOverride = item.listingColor || item.listingBorderColor;
    const hasVariantOverride = item.listingVariantColor || item.listingVariantBorderColor;
    if (hasProductOverride || hasVariantOverride) type = 'custom';
    else if (hot) type = 'hot';
    else if (jemmy) type = 'jemmy';
    else if (['premium', 'new', 'new_arrival', 'clearance', 'limited_stock', 'featured'].includes(group)) {
      type = group;
    }

    let badge = item.listingBadge || (hasVariantOverride && item.listingVariantBadge) || '';
    if (!badge && hot) badge = 'HOT DEAL';
    if (!badge) {
      badge = {
        premium: 'PREMIUM',
        new: 'NEW',
        new_arrival: 'NEW',
        clearance: 'CLEARANCE',
        limited_stock: 'LIMITED STOCK',
        featured: 'FEATURED',
      }[type] || '';
    }

    const color = safeColor(hasProductOverride ? item.listingColor : item.listingVariantColor);
    const borderColor = safeColor(
      hasProductOverride ? item.listingBorderColor : item.listingVariantBorderColor,
    );
    const style = [
      color && `--listing-bg:${color}`,
      borderColor && `--listing-border:${borderColor}`,
    ]
      .filter(Boolean)
      .join(';');
    return { type, badge, style };
  };

  if (location.pathname.startsWith('/products/')) {
    fetch(`${location.pathname}.js`)
      .then((response) => (response.ok ? response.json() : null))
      .then((product) => {
        if (!product) return;
        const body = document.body;
        const item = {
          handle: product.handle,
          title: product.title,
          vendor: product.vendor,
          tags: product.tags,
          url: `/products/${product.handle}`,
          image: product.featured_image,
          price: product.price,
          listingColor: body.dataset.listingColor,
          listingBorderColor: body.dataset.listingBorderColor,
          listingBadge: body.dataset.listingBadge,
          listingGroup: body.dataset.listingGroup,
          listingVariantColor: body.dataset.listingVariantColor,
          listingVariantBorderColor: body.dataset.listingVariantBorderColor,
          listingVariantBadge: body.dataset.listingVariantBadge,
          listingEnabled: body.dataset.listingEnabled !== 'false',
        };
        write([item, ...read().filter((saved) => saved.handle !== item.handle)]);
      })
      .catch(() => {});
  }

  document.querySelectorAll('[data-recently-viewed]').forEach((section) => {
    const items = read();
    if (!items.length) return;
    const track = section.querySelector('[data-recent-track]');
    track.innerHTML = items
      .map((item) => {
        const listing = getListing(item);
        const typeClass = listing.type ? ` product-card--${esc(listing.type)}` : '';
        const style = listing.style ? ` style="${esc(listing.style)}"` : '';
        const badge = listing.badge
          ? `<span class="recently-viewed__badge">${esc(listing.badge)}</span>`
          : '';
        return `<a class="recently-viewed__card${typeClass}" href="${esc(item.url)}"${style}>${badge}<img src="${esc(item.image)}" width="120" height="120" loading="lazy" alt="${esc(item.title)}"><span>${esc(item.vendor)}</span><strong>${esc(item.title)}</strong><em>${money(item.price)}</em></a>`;
      })
      .join('');
    section.hidden = false;
    section.querySelector('[data-recent-clear]')?.addEventListener('click', () => {
      localStorage.removeItem(KEY);
      section.hidden = true;
    });
  });
})();
