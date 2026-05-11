const SNACC_MONEY = {
  sponsorEmail: 'hello@snacc.app',
  amazonTag: 'snacc-20',
  sponsorSubject: 'Sponsor Snacc',
};

function snaccProductQuery(product) {
  return [product.brand, product.name]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function snaccTrackMoney(eventName, payload) {
  if (typeof window.va === 'function') window.va('event', eventName, payload);
}

function snaccBuyLinks(product) {
  const q = snaccProductQuery(product);
  const enc = encodeURIComponent(q);
  if (!q) return [];

  return [
    {
      label: 'Amazon',
      merchant: 'amazon',
      href: `https://www.amazon.com/s?k=${enc}&tag=${encodeURIComponent(SNACC_MONEY.amazonTag)}`,
    },
    {
      label: 'Walmart',
      merchant: 'walmart',
      href: `https://www.walmart.com/search?q=${enc}`,
    },
    {
      label: 'Instacart',
      merchant: 'instacart',
      href: `https://www.instacart.com/store/s?k=${enc}`,
    },
  ];
}

function snaccBuildBuyRail(product, context) {
  const wrap = document.createElement('div');
  wrap.className = 'money-rail';
  wrap.innerHTML = `
    <p class="money-label">Buy it</p>
    <div class="money-links"></div>
    <p class="money-note">Snacc may earn from shopping links.</p>`;

  const linksEl = wrap.querySelector('.money-links');
  snaccBuyLinks(product).forEach(link => {
    const a = document.createElement('a');
    a.className = 'money-link';
    a.href = link.href;
    a.target = '_blank';
    a.rel = 'noopener sponsored';
    a.textContent = link.label;
    a.addEventListener('click', () => snaccTrackMoney('affiliate_click', {
      merchant: link.merchant,
      context,
      name: product.name || '',
      brand: product.brand || '',
      kind: product.kind || '',
    }));
    a.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
    a.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
    linksEl.appendChild(a);
  });

  return wrap;
}

function snaccSponsorHref(product) {
  const subject = encodeURIComponent(SNACC_MONEY.sponsorSubject);
  const body = encodeURIComponent([
    'I want to sponsor Snacc.',
    product?.name ? `Product: ${snaccProductQuery(product)}` : '',
    '',
    'Tell me about pricing, placement, and audience fit.',
  ].filter(Boolean).join('\n'));
  return `mailto:${SNACC_MONEY.sponsorEmail}?subject=${subject}&body=${body}`;
}
