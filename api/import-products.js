const IMPORT_QUERIES = {
  snack: ['chips', 'cookies', 'candy', 'chocolate', 'crackers', 'popcorn'],
  drink: ['sparkling water', 'soda', 'juice drink', 'energy drink', 'kombucha', 'tea'],
};

function requireAdmin(req, res) {
  if (!process.env.PRODUCT_IMPORT_SECRET) {
    res.status(500).json({ error: 'Missing PRODUCT_IMPORT_SECRET' });
    return false;
  }
  if (req.headers.authorization !== `Bearer ${process.env.PRODUCT_IMPORT_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

function normalizeOffProduct(product, kind) {
  const name = product.product_name || product.product_name_en || '';
  if (!name.trim()) return null;
  const sourceId = product.code || product._id;
  if (!sourceId) return null;

  const countries = (product.countries_tags || [])
    .map(tag => tag.replace(/^en:/, '').toUpperCase())
    .filter(code => /^[A-Z]{2}$/.test(code));

  return {
    source: 'open_food_facts',
    source_id: String(sourceId),
    barcode: product.code || null,
    kind,
    name: name.trim(),
    brand: (product.brands || '').split(',')[0].trim() || null,
    image: product.image_front_url || product.image_url || null,
    country: countries[0] || null,
    categories: (product.categories_tags || []).slice(0, 12),
    nutrition: product.nutriments || null,
    raw: product,
  };
}

async function fetchOpenFoodFacts(kind, limit) {
  const queries = IMPORT_QUERIES[kind] || IMPORT_QUERIES.snack;
  const perQuery = Math.max(4, Math.ceil(limit / queries.length));
  const batches = await Promise.allSettled(queries.map(async q => {
    const url = new URL('https://world.openfoodfacts.org/api/v2/search');
    url.searchParams.set('q', q);
    url.searchParams.set('page_size', String(perQuery));
    url.searchParams.set('sort_by', 'popularity_key');
    url.searchParams.set('fields', 'code,_id,product_name,product_name_en,brands,image_front_url,image_url,countries_tags,categories_tags,nutriments');
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.products || []).map(product => normalizeOffProduct(product, kind)).filter(Boolean);
  }));

  const seen = new Set();
  return batches
    .flatMap(batch => batch.status === 'fulfilled' ? batch.value : [])
    .filter(product => {
      const key = `${product.source}:${product.source_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

async function upsertProducts(products) {
  if (!products.length) return 0;

  const base = process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
  const res = await fetch(`${base}/products?on_conflict=source,source_id`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(products),
  });
  if (!res.ok) throw new Error(await res.text());
  return products.length;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase environment variables' });
  }

  const kind = req.body?.kind === 'drink' ? 'drink' : 'snack';
  const limit = Math.min(100, Math.max(10, Number(req.body?.limit || 50)));

  try {
    const products = await fetchOpenFoodFacts(kind, limit);
    const imported = await upsertProducts(products);
    res.status(200).json({ ok: true, kind, imported });
  } catch (e) {
    res.status(500).json({ error: 'Product import failed', detail: e.message });
  }
}
