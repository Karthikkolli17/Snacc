import { transformProduct } from './_product-etl.js';

const KINDS = new Set(['snack', 'drink']);

function words(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 1);
}

function hydrateProduct(row) {
  const transformed = row.processed_at
    ? {
        display_name: row.display_name,
        display_brand: row.display_brand,
        search_text: row.search_text,
        quality_score: row.quality_score,
        quality_notes: row.quality_notes || [],
        is_searchable: row.is_searchable,
      }
    : transformProduct(row);

  return {
    ...row,
    ...transformed,
  };
}

function searchScore(product, queryWords, queryText) {
  const name = String(product.display_name || product.name || '').toLowerCase();
  const brand = String(product.display_brand || product.brand || '').toLowerCase();
  const haystack = `${brand} ${name} ${product.search_text || ''}`.toLowerCase();

  let score = Number(product.quality_score || 0);
  if (name === queryText || brand === queryText) score += 100;
  if (name.startsWith(queryText) || brand.startsWith(queryText)) score += 60;
  if (name.includes(queryText) || brand.includes(queryText)) score += 35;
  for (const word of queryWords) {
    if (brand.includes(word)) score += 16;
    if (name.includes(word)) score += 14;
    if (haystack.includes(word)) score += 4;
  }
  return score;
}

async function fetchProducts() {
  const base = process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
  const params = new URLSearchParams({
    select: 'id,source,source_id,barcode,kind,name,brand,image,country,categories,nutrition,raw,display_name,display_brand,search_text,quality_score,quality_notes,is_searchable,processed_at',
    source: 'eq.usda',
    order: 'quality_score.desc.nullslast',
    limit: '1000',
  });

  const response = await fetch(`${base}/products?${params}`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export default async function handler(req, res) {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Missing query' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase environment variables' });
  }

  const kind = KINDS.has(req.query.kind) ? req.query.kind : null;
  const queryText = q.toLowerCase();
  const queryWords = words(q);

  try {
    const rows = await fetchProducts();
    const results = rows
      .map(hydrateProduct)
      .filter(product => !kind || product.kind === kind)
      .filter(product => product.is_searchable)
      .map(product => ({
        product,
        score: searchScore(product, queryWords, queryText),
      }))
      .filter(({ product, score }) => {
        if (score >= Number(product.quality_score || 0) + 12) return true;
        const haystack = `${product.display_brand || ''} ${product.display_name || ''} ${product.search_text || ''}`.toLowerCase();
        return queryWords.every(word => haystack.includes(word));
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(({ product }) => ({
        id: product.id,
        product_id: product.id,
        barcode: product.barcode || null,
        name: product.display_name || product.name,
        brand: product.display_brand || product.brand || '',
        image: product.image || null,
        source: 'Snacc Catalog',
        nutrition: product.nutrition || null,
        kind: product.kind,
        _catalog: true,
      }));

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(200).json({ results });
  } catch (e) {
    return res.status(500).json({ error: 'Search failed', detail: e.message });
  }
}
