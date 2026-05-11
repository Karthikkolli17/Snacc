const GENERIC_NAMES = new Set([
  'beverage',
  'drink',
  'juice',
  'kombucha',
  'snack',
  'tea',
  'water',
]);

const BRAND_FIXES = new Map([
  ['welchs', "Welch's"],
  ['m&ms', "M&M's"],
  ['m & ms', "M&M's"],
  ['coca cola lightdiet coke', 'Diet Coke'],
  ['sprite zerodietlight', 'Sprite Zero'],
]);

const ICONIC_SHORT_NAMES = new Set([
  'coca-cola',
  'coke',
  'diet coke',
  'sprite',
  'sprite zero',
  'pepsi',
  'dr pepper',
  'fanta',
  'fresca',
  'pringles',
  'doritos',
  'fritos',
  'tostitos',
  'oreo',
  'ritz',
]);

function decodeText(value) {
  return String(value || '')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/_x[0-9a-f]{4}_/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanBrand(brand) {
  return decodeText(brand)
    .replace(/^\[\[/, '')
    .replace(/\]\]$/, '')
    .trim() || null;
}

function titleCase(value) {
  const minor = new Set(['a', 'an', 'and', 'for', 'of', 'the', 'to', 'with']);
  return value
    .toLowerCase()
    .split(/(\s+|[-/])/)
    .map((part, index) => {
      if (!/[a-z0-9]/.test(part)) return part;
      if (index > 0 && minor.has(part)) return part;
      if (/^\d/.test(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

function readableCase(value) {
  const letters = value.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 8 && letters === letters.toUpperCase()) return titleCase(value);
  return value;
}

function normalizeBrandCase(value) {
  const brand = cleanBrand(value);
  if (!brand) return null;

  const key = brand.toLowerCase().replace(/[^a-z0-9& ]/g, '').replace(/\s+/g, ' ').trim();
  const compactKey = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (BRAND_FIXES.has(key)) return BRAND_FIXES.get(key);
  if (BRAND_FIXES.has(compactKey)) return BRAND_FIXES.get(compactKey);
  if (/^[A-Z][A-Z'&.\s-]{3,}$/.test(brand) && !/^(V8|KOE)$/i.test(brand)) return titleCase(brand);
  if (/(inc|llc|company|corporation|foods|sales|stores|markets|products|beverages)\.?$/i.test(brand)) {
    return readableCase(brand);
  }
  return readableCase(brand);
}

function pickDisplayBrand(product) {
  const raw = product.raw || {};
  const name = decodeText(product.name || raw.description).toLowerCase();
  if (/\bgoldfish\b/.test(name)) return 'Goldfish';
  if (/\bsun\s?chips\b/.test(name)) return 'Sun Chips';
  if (/\bdiet coke\b/.test(name)) return 'Diet Coke';
  if (/\bsprite zero\b/.test(name)) return 'Sprite Zero';
  if (/\bsprite\b/.test(name)) return 'Sprite';
  if (/\bcoca-cola\b|\bcoke\b/.test(name)) return 'Coca-Cola';
  if (/\bpringles\b/.test(name)) return 'Pringles';
  if (/\bdoritos\b/.test(name)) return 'Doritos';
  if (/\blay'?s\b/.test(name)) return "Lay's";
  if (/\bfritos\b/.test(name)) return 'Fritos';
  if (/\btostitos\b/.test(name)) return 'Tostitos';
  if (/\boreo\b/.test(name)) return 'Oreo';
  if (/\britz\b/.test(name)) return 'Ritz';

  return normalizeBrandCase(raw.brandName)
    || normalizeBrandCase(raw.subbrandName)
    || normalizeBrandCase(product.brand)
    || normalizeBrandCase(raw.brandOwner);
}

function stripPackageClutter(value) {
  return value
    .replace(/\b\d+\s+\d+\/\d+\s*(fl\.?\s*)?(oz|oza|onz|ounce|ounces|lb|lbr|pound|pounds|ml|mlt|qt|qtl|liters?|l)\b\.?/gi, ' ')
    .replace(/\b\d+(\.\d+)?\s*(fl\.?\s*)?(oz|oza|onz|ounce|ounces|lb|lbr|pound|pounds|ml|mlt|qt|qtl)\b\.?/gi, ' ')
    .replace(/\b\d+(\.\d+)?\s*(liters?|l)\b\.?/gi, ' ')
    .replace(/\b\d+\/\d+\s*(fl\.?\s*)?(oz|oza|onz|ounce|ounces|lb|lbr|pound|pounds|ml|mlt|qt|qtl|liters?|l)\b\.?/gi, ' ')
    .replace(/\b\d+\s*(ct|count|pack|packs|pk|box|boxes|bag|bags|can|cans|pouch|pouches|bottle|bottles)\b\.?/gi, ' ')
    .replace(/\b\d+\s*(packet|packets)\b\.?/gi, ' ')
    .replace(/\b\d+\s*x\s*\d+(\.\d+)?\b/gi, ' ')
    .replace(/\bsharing size\b/gi, ' ')
    .replace(/\btheater box\b/gi, ' ')
    .replace(/\bindividually wrapped\b/gi, ' ')
    .replace(/\b(box|boxes|bag|bags|pack|packs|packet|packets|pouch|pouches|bottle|bottles|can|cans)\b/gi, ' ')
    .replace(/\b(fridge pack|family size|plastic bag)\b/gi, ' ')
    .replace(/\s*[-,]\s*(packets?|pouches?|bags?|boxes?|bottles?|cans?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collapseRepeatedCommaName(value) {
  const parts = value.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length < 2) return value;

  const deduped = [];
  const seen = new Set();
  for (const part of parts) {
    const key = part.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(part);
  }

  if (deduped.length === 2) {
    const [first, second] = deduped.map(part => part.toLowerCase());
    if (first.includes(second)) return deduped[0];
    if (second.includes(first)) return deduped[1];
  }

  if (deduped.length > 2) return deduped.slice(0, 2).join(' ');
  return deduped.join(' ');
}

function cleanDisplayName(name) {
  return readableCase(
    collapseRepeatedCommaName(
      stripPackageClutter(
        decodeText(name)
          .replace(/^\d*\.?\d+\s*OZ?\s*/i, '')
          .replace(/\(S\)/gi, 's')
          .replace(/\bM\s*&\s*M'?S\b/gi, "M&M's")
          .replace(/\bHERSHEYS\b/gi, "Hershey's")
      )
    )
  )
    .replace(/\s+([,;:])/g, '$1')
    .replace(/\(\s*\)/g, ' ')
    .replace(/,\s*,+/g, ',')
    .replace(/\s+[,\-;:]+/g, ',')
    .replace(/[,\-;:.\s]+$/g, '')
    .replace(/\b(?:mix|drink mix)\s+\d+$/i, match => match.replace(/\s+\d+$/, ''))
    .replace(/\b1\s+1\/?$/g, '')
    .replace(/\b\d+\/?$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(value) {
  return decodeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function searchText(...values) {
  return [...new Set(words(values.filter(Boolean).join(' ')))].join(' ');
}

export function transformProduct(product) {
  const raw = product.raw || {};
  const displayName = cleanDisplayName(product.name || raw.description);
  const displayBrand = pickDisplayBrand(product);
  const nutrition = product.nutrition || {};
  const notes = [];

  if (!displayName) notes.push('missing_display_name');
  if (!displayBrand) notes.push('missing_display_brand');
  if (!product.barcode) notes.push('missing_barcode');
  if (!product.image) notes.push('missing_image');
  if (nutrition.calories == null) notes.push('missing_calories');
  if (displayName && displayName.length < 12) notes.push('weak_display_name');
  if (displayName && GENERIC_NAMES.has(displayName.toLowerCase())) notes.push('generic_display_name');
  if (/\b\d+\s*(lb|lbr|pound|pounds)\b/i.test(`${raw.packageWeight || ''} ${product.name || ''}`)) notes.push('bulk_or_foodservice');
  if (product.kind === 'snack' && /\bbreakfast cereal\b|\bcereal\b/i.test(displayName)) notes.push('cereal_not_snack');

  const canonicalDisplayName = displayName.toLowerCase();
  const isIconicShortName = ICONIC_SHORT_NAMES.has(canonicalDisplayName);

  let qualityScore = 100;
  qualityScore -= notes.includes('missing_display_name') ? 40 : 0;
  qualityScore -= notes.includes('missing_display_brand') ? 20 : 0;
  qualityScore -= notes.includes('missing_barcode') ? 20 : 0;
  qualityScore -= notes.includes('missing_image') ? 10 : 0;
  qualityScore -= notes.includes('missing_calories') ? 10 : 0;
  qualityScore -= notes.includes('weak_display_name') ? 20 : 0;
  qualityScore -= notes.includes('generic_display_name') ? 35 : 0;
  qualityScore -= notes.includes('bulk_or_foodservice') ? 15 : 0;
  qualityScore -= notes.includes('cereal_not_snack') ? 40 : 0;
  qualityScore = Math.max(0, qualityScore);

  const isSearchable = Boolean(displayName && displayBrand && product.barcode)
    && !notes.includes('generic_display_name')
    && (!notes.includes('weak_display_name') || isIconicShortName)
    && !notes.includes('bulk_or_foodservice')
    && !notes.includes('cereal_not_snack')
    && qualityScore >= 55;

  return {
    display_name: displayName || null,
    display_brand: displayBrand,
    search_text: searchText(displayName, displayBrand, product.name, product.brand, raw.brandName),
    quality_score: qualityScore,
    quality_notes: notes,
    is_searchable: isSearchable,
    processed_at: new Date().toISOString(),
  };
}
