async function fetchWithTimeout(url, ms = 4000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

export default async function handler(req, res) {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });

  const apiKey = process.env.USDA_API_KEY;
  const enc = encodeURIComponent(q);

  // 1. Search USDA
  const usdaData = await fetchWithTimeout(
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${enc}&dataType=Branded&pageSize=8&api_key=${apiKey}`
  ).then(r => r.ok ? r.json() : null).catch(() => null);

  const foods = usdaData?.foods || [];
  if (!foods.length) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.json({ results: [] });
  }

  // 2. Look up images from OFF by UPC (v0 API, faster than v2)
  const imageMap = {};
  await Promise.allSettled(
    foods
      .filter(f => f.gtinUpc)
      .slice(0, 6)
      .map(f =>
        fetchWithTimeout(`https://world.openfoodfacts.org/api/v0/product/${f.gtinUpc}.json?fields=image_front_url`, 3000)
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            const img = d?.product?.image_front_url;
            if (img) imageMap[f.gtinUpc] = img;
          })
          .catch(() => null)
      )
  );

  const results = foods.map(f => ({
    id: `usda-${f.fdcId}`,
    name: f.description || '',
    brand: f.brandOwner || f.brandName || '',
    image: (f.gtinUpc && imageMap[f.gtinUpc]) || null,
  }));

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({ results });
}
