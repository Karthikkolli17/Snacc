export default async function handler(req, res) {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });

  const apiKey = process.env.USDA_API_KEY;
  const enc = encodeURIComponent(q);

  // USDA FoodData Central — US branded foods, reliable coverage
  const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${enc}&dataType=Branded&pageSize=8&api_key=${apiKey}`;

  // Open Food Facts US — for images only, best-effort
  const offUrl = `https://us.openfoodfacts.org/api/v2/search?q=${enc}&page_size=8&sort_by=popularity_key&fields=code,product_name,brands,image_front_url`;

  const [usdaRes, offRes] = await Promise.allSettled([
    fetch(usdaUrl).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(offUrl).then(r => r.ok ? r.json() : null).catch(() => null),
  ]);

  const usdaData = usdaRes.status === 'fulfilled' ? usdaRes.value : null;
  const offData  = offRes.status  === 'fulfilled' ? offRes.value  : null;

  // Build image map from OFF: lowercase name → image url
  const imageMap = {};
  if (offData?.products) {
    for (const p of offData.products) {
      if (p.product_name && p.image_front_url) {
        imageMap[p.product_name.toLowerCase().slice(0, 40)] = p.image_front_url;
      }
    }
  }

  // Build results from USDA, attach images where names match
  const results = (usdaData?.foods || []).map(f => {
    const name = f.description || '';
    const key = name.toLowerCase().slice(0, 40);
    return {
      id: `usda-${f.fdcId}`,
      name,
      brand: f.brandOwner || f.brandName || '',
      image: imageMap[key] || null,
    };
  });

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({ results });
}
