export default async function handler(req, res) {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });

  const apiKey = process.env.USDA_API_KEY;
  const enc = encodeURIComponent(q);

  // 1. Search USDA for reliable US branded food results
  const usdaData = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${enc}&dataType=Branded&pageSize=8&api_key=${apiKey}`
  ).then(r => r.ok ? r.json() : null).catch(() => null);

  const foods = usdaData?.foods || [];
  if (!foods.length) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.json({ results: [] });
  }

  // 2. For each result that has a UPC, fetch the image from OFF by barcode (much more reliable than name search)
  const imageMap = {};
  await Promise.allSettled(
    foods
      .filter(f => f.gtinUpc)
      .map(f =>
        fetch(`https://world.openfoodfacts.org/api/v2/product/${f.gtinUpc}?fields=image_front_url`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.product?.image_front_url) imageMap[f.gtinUpc] = d.product.image_front_url; })
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
