const IMPORT_QUERIES = {
  snack: ['chips', 'cookies', 'candy', 'chocolate', 'crackers', 'popcorn', 'pretzels', 'granola bar'],
  drink: ['sparkling water', 'soda', 'juice drink', 'energy drink', 'kombucha', 'tea', 'coffee drink'],
};

const ALLOWED_CATEGORIES = {
  snack: [
    'biscuits/cookies',
    'confectionery products',
    'processed cereal products',
    'snacks',
  ],
  drink: [
    'non alcoholic beverages - not ready to drink',
    'non alcoholic beverages - ready to drink',
    'other drinks',
    'tea and infusions/tisanes',
  ],
};

const REQUIRED_TERMS = {
  snack: [
    'bar',
    'candy',
    'chip',
    'chocolate',
    'cookie',
    'cracker',
    'crisp',
    'granola',
    'gummi',
    'gummy',
    'popcorn',
    'pretzel',
    'snack',
    'wafer',
  ],
  drink: [
    'beverage',
    'coffee',
    'drink',
    'energy',
    'juice',
    'kombucha',
    'latte',
    'lemonade',
    'seltzer',
    'soda',
    'sparkling',
    'tea',
    'water',
  ],
};

const DENY_TERMS = [
  'baby',
  'cheddar',
  'cheese',
  'chicken',
  'condensed milk',
  'creamer',
  'cream cheese',
  'frozen',
  'infant',
  'keto friendly',
  'meal',
  'milk substitute',
  'pickle',
  'relish',
  'sauce',
  'spreadable',
  'topping',
  'yogurt',
];

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

function cleanName(name) {
  return String(name || '')
    .replace(/^\d*\.?\d+\s*OZ?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanBrand(brand) {
  return String(brand || '')
    .replace(/^\[\[/, '')
    .replace(/\]\]$/, '')
    .trim() || null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesTerm(text, term) {
  const escaped = escapeRegExp(term);
  const wordPattern = term.endsWith('y')
    ? `${escapeRegExp(term.slice(0, -1))}(?:y|ies)`
    : `${escaped}(?:s|es)?`;
  const pattern = `(^|[^a-z0-9])${/^[a-z0-9]+$/i.test(term) ? wordPattern : escaped}([^a-z0-9]|$)`;
  return new RegExp(pattern, 'i').test(text);
}

function matchesAny(text, terms) {
  return terms.some(term => matchesTerm(text, term));
}

function isAllowedUsdaProduct(food, kind) {
  const name = cleanName(food.description);
  const category = String(food.foodCategory || '').toLowerCase();
  const text = [name, food.brandOwner, food.brandName, category].join(' ').toLowerCase();

  if (!name || !food.fdcId) return false;
  if (!food.gtinUpc) return false;
  if (matchesAny(text, DENY_TERMS)) return false;

  const categoryAllowed = ALLOWED_CATEGORIES[kind].includes(category);
  const termAllowed = matchesAny(text, REQUIRED_TERMS[kind]);

  if (kind === 'snack') {
    const looksLikeDrink = matchesAny(text, REQUIRED_TERMS.drink);
    return categoryAllowed && termAllowed && !looksLikeDrink;
  }

  return categoryAllowed && termAllowed;
}

function nutrientValue(food, names) {
  const wanted = new Set(names.map(name => name.toLowerCase()));
  const nutrient = (food.foodNutrients || []).find(n => wanted.has(String(n.nutrientName || '').toLowerCase()));
  return nutrient?.value ?? null;
}

function normalizeUsdaProduct(food, kind) {
  const name = cleanName(food.description);
  if (!name) return null;
  if (!food.fdcId) return null;

  return {
    source: 'usda',
    source_id: String(food.fdcId),
    barcode: food.gtinUpc || null,
    kind,
    name,
    brand: cleanBrand(food.brandOwner) || cleanBrand(food.brandName),
    image: null,
    country: food.marketCountry || 'US',
    categories: [food.foodCategory].filter(Boolean),
    nutrition: {
      calories: nutrientValue(food, ['Energy']),
      protein: nutrientValue(food, ['Protein']),
      fat: nutrientValue(food, ['Total lipid (fat)', 'Total Fat']),
      carbs: nutrientValue(food, ['Carbohydrate, by difference', 'Carbohydrate']),
      sugars: nutrientValue(food, ['Sugars, total including NLEA', 'Total Sugars']),
      fiber: nutrientValue(food, ['Fiber, total dietary', 'Dietary Fiber']),
      sodium: nutrientValue(food, ['Sodium, Na', 'Sodium']),
    },
    raw: food,
  };
}

async function fetchUsda(kind, limit) {
  if (!process.env.USDA_API_KEY) throw new Error('Missing USDA_API_KEY');

  const queries = IMPORT_QUERIES[kind] || IMPORT_QUERIES.snack;
  const perQuery = Math.min(200, Math.max(25, Math.ceil(limit / queries.length) * 4));
  const batches = await Promise.allSettled(queries.map(async query => {
    const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
    url.searchParams.set('query', query);
    url.searchParams.set('dataType', 'Branded');
    url.searchParams.set('pageSize', String(perQuery));
    url.searchParams.set('sortBy', 'publishedDate');
    url.searchParams.set('sortOrder', 'desc');
    url.searchParams.set('api_key', process.env.USDA_API_KEY);

    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return data.foods || [];
  }));

  const seen = new Set();
  const fetched = batches.flatMap(batch => batch.status === 'fulfilled' ? batch.value : []);
  const matched = fetched
    .filter(food => isAllowedUsdaProduct(food, kind))
    .map(food => normalizeUsdaProduct(food, kind))
    .filter(Boolean)
    .filter(product => {
      const key = `${product.source}:${product.source_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const products = matched.slice(0, limit);

  return {
    products,
    fetched: fetched.length,
    accepted: products.length,
    rejected: Math.max(0, fetched.length - matched.length),
  };
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
  const limit = Math.min(1000, Math.max(10, Number(req.body?.limit || 100)));

  try {
    const { products, fetched, accepted, rejected } = await fetchUsda(kind, limit);
    const imported = await upsertProducts(products);
    res.status(200).json({ ok: true, source: 'usda', kind, fetched, accepted, rejected, imported });
  } catch (e) {
    res.status(500).json({ error: 'Product import failed', detail: e.message });
  }
}
