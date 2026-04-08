export default async function handler(req, res) {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });

  const enc = encodeURIComponent(q);
  const fields = 'code,product_name,brands,image_front_url';

  const [v2, cgi] = await Promise.allSettled([
    fetch(`https://world.openfoodfacts.org/api/v2/search?q=${enc}&page_size=9&sort_by=popularity_key&fields=${fields}`)
      .then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${enc}&search_simple=1&action=process&json=1&page_size=9&fields=id,product_name,brands,image_front_url`)
      .then(r => r.ok ? r.json() : null).catch(() => null),
  ]);

  const v2data = v2.status === 'fulfilled' ? v2.value : null;
  const cgidata = cgi.status === 'fulfilled' ? cgi.value : null;

  res.setHeader('Cache-Control', 'no-store');
  res.json({ v2: v2data, cgi: cgidata });
}
