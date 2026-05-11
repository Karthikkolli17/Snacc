import { requireSession } from './_session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireSession(req, res);
  if (!user) return;

  const { ratingId, vibe, nutrition } = req.body;
  if (!ratingId) return res.status(400).json({ error: 'Missing ratingId' });

  const updates = {};
  if (vibe !== undefined) {
    if (!['eat', 'mid', 'never'].includes(vibe)) return res.status(400).json({ error: 'Invalid vibe' });
    updates.vibe = vibe;
  }
  if (nutrition !== undefined) updates.nutrition = nutrition;
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });

  const base = process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
  const headers = {
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  // Verify ownership
  const check = await fetch(`${base}/ratings?id=eq.${ratingId}&select=user_id`, { headers });
  const rows = await check.json();
  if (!Array.isArray(rows)) return res.status(500).json({ error: 'DB error', detail: rows });
  if (!rows.length) return res.status(404).json({ error: 'Rating not found', ratingId });
  if (rows[0].user_id !== user.id) return res.status(403).json({ error: 'Not your log' });

  // Update
  const upd = await fetch(`${base}/ratings?id=eq.${ratingId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify(updates),
  });
  if (!upd.ok) return res.status(500).json({ error: 'Update failed' });

  res.json({ ok: true });
}
