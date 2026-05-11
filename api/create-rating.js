import { requireSession } from './_session.js';

const VIBES = new Set(['eat', 'mid', 'never']);
const KINDS = new Set(['snack', 'drink']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireSession(req, res);
  if (!user) return;

  const body = req.body || {};
  const name = String(body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Missing name' });
  if (!VIBES.has(body.vibe)) return res.status(400).json({ error: 'Invalid vibe' });
  if (!KINDS.has(body.kind)) return res.status(400).json({ error: 'Invalid kind' });

  const base = process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
  const headers = {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };

  const response = await fetch(`${base}/ratings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name,
      brand: String(body.brand || '').trim(),
      vibe: body.vibe,
      image: body.image || null,
      source: String(body.source || '').trim(),
      logged_at: new Date().toISOString(),
      user_id: user.id,
      barcode: body.barcode || null,
      nutrition: body.nutrition || null,
      kind: body.kind,
      country: body.country || null,
    }),
  });

  if (!response.ok) return res.status(500).json({ error: 'Create failed', detail: await response.text() });
  res.status(200).json({ ok: true });
}
