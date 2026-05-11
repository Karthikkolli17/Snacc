import { transformProduct } from './_product-etl.js';

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

function supabaseBase() {
  return process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function fetchProducts(limit) {
  const params = new URLSearchParams({
    select: 'id,source,source_id,barcode,kind,name,brand,image,country,categories,nutrition,raw',
    source: 'eq.usda',
    order: 'imported_at.asc',
    limit: String(limit),
  });

  const response = await fetch(`${supabaseBase()}/products?${params}`, {
    headers: supabaseHeaders(),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function updateProduct(id, transformed) {
  const response = await fetch(`${supabaseBase()}/products?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: supabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(transformed),
  });
  if (!response.ok) throw new Error(await response.text());
}

function summarize(products, transformedRows) {
  const summary = {
    processed: products.length,
    searchable: 0,
    notSearchable: 0,
    missingImage: 0,
    genericName: 0,
    weakName: 0,
    bulkOrFoodservice: 0,
    missingCalories: 0,
    notes: {},
    samples: [],
  };

  transformedRows.forEach(({ product, transformed }) => {
    if (transformed.is_searchable) summary.searchable += 1;
    else summary.notSearchable += 1;

    transformed.quality_notes.forEach(note => {
      summary.notes[note] = (summary.notes[note] || 0) + 1;
    });

    if (transformed.quality_notes.includes('missing_image')) summary.missingImage += 1;
    if (transformed.quality_notes.includes('generic_display_name')) summary.genericName += 1;
    if (transformed.quality_notes.includes('weak_display_name')) summary.weakName += 1;
    if (transformed.quality_notes.includes('bulk_or_foodservice')) summary.bulkOrFoodservice += 1;
    if (transformed.quality_notes.includes('missing_calories')) summary.missingCalories += 1;

    if (summary.samples.length < 12) {
      summary.samples.push({
        kind: product.kind,
        name: product.name,
        brand: product.brand,
        display_name: transformed.display_name,
        display_brand: transformed.display_brand,
        is_searchable: transformed.is_searchable,
        quality_score: transformed.quality_score,
        quality_notes: transformed.quality_notes,
      });
    }
  });

  return summary;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase environment variables' });
  }

  const limit = Math.min(1000, Math.max(1, Number(req.body?.limit || 250)));
  const apply = req.body?.apply === true;

  try {
    const products = await fetchProducts(limit);
    const transformedRows = products.map(product => ({
      product,
      transformed: transformProduct(product),
    }));

    if (apply) {
      for (const row of transformedRows) {
        await updateProduct(row.product.id, row.transformed);
      }
    }

    res.status(200).json({
      ok: true,
      mode: apply ? 'applied' : 'dry_run',
      ...summarize(products, transformedRows),
    });
  } catch (e) {
    res.status(500).json({ error: 'Product processing failed', detail: e.message });
  }
}
