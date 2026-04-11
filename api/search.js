async function fetchWithTimeout(url, ms = 4000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

function words(str) {
  return new Set(str.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2));
}

function bestImage(usdaName, offProducts) {
  const uw = words(usdaName);
  let best = null, bestScore = 0;
  for (const p of offProducts) {
    if (!p.image_front_url) continue;
    const ow = words(p.product_name || '');
    const shared = [...uw].filter(w => ow.has(w)).length;
    if (shared > bestScore) { bestScore = shared; best = p.image_front_url; }
  }
  return bestScore >= 2 ? best : null;
}

function cleanName(name) {
  return name.replace(/^\d*\.?\d+\s*OZ?\s*/i, '').trim();
}

export default async function handler(req, res) {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });

  const enc = encodeURIComponent(q);

  // Run USDA search + OFF name search in parallel
  const [usdaRes, offRes] = await Promise.allSettled([
    fetchWithTimeout(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${enc}&dataType=Branded&pageSize=8&api_key=${process.env.USDA_API_KEY}`)
      .then(r => r.ok ? r.json() : null).catch(() => null),
    fetchWithTimeout(`https://world.openfoodfacts.org/api/v2/search?q=${enc}&page_size=20&sort_by=popularity_key&fields=code,product_name,brands,image_front_url`)
      .then(r => r.ok ? r.json() : null).catch(() => null),
  ]);

  const foods = usdaRes.status === 'fulfilled' ? (usdaRes.value?.foods || []) : [];
  const offProducts = offRes.status === 'fulfilled' ? (offRes.value?.products || []) : [];

  if (!foods.length) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.json({ results: [] });
  }

  // Barcode lookup for products that have a GTIN
  const imageMap = {};
  await Promise.allSettled(
    foods.filter(f => f.gtinUpc).slice(0, 6).map(f => {
      const upc = f.gtinUpc.replace(/^0+/, '');
      return fetchWithTimeout(`https://world.openfoodfacts.org/api/v0/product/${upc}.json?fields=image_front_url`, 3000)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.product?.image_front_url) imageMap[upc] = d.product.image_front_url; })
        .catch(() => null);
    })
  );

  const results = foods.map(f => {
    const name = f.description || '';
    const upc = f.gtinUpc ? f.gtinUpc.replace(/^0+/, '') : null;
    const image = (upc && imageMap[upc]) || bestImage(name, offProducts);
    return {
      id: `usda-${f.fdcId}`,
      name: cleanName(name),
      brand: f.brandOwner || f.brandName || '',
      image,
      source: 'USDA',
    };
  });

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({ results });
}
