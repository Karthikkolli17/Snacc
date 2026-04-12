export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ratingId, userId } = req.body;
  if (!ratingId || !userId) return res.status(400).json({ error: 'Missing ratingId or userId' });

  const base = process.env.SUPABASE_URL + '/rest/v1';
  const headers = {
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  // Verify ownership
  const check = await fetch(`${base}/ratings?id=eq.${ratingId}&select=user_id`, { headers });
  const rows = await check.json();
  if (!rows?.length) return res.status(404).json({ error: 'Rating not found' });
  if (rows[0].user_id !== userId) return res.status(403).json({ error: 'Not your log' });

  // Delete
  const del = await fetch(`${base}/ratings?id=eq.${ratingId}`, {
    method: 'DELETE',
    headers: { ...headers, 'Prefer': 'return=minimal' },
  });
  if (!del.ok) return res.status(500).json({ error: 'Delete failed' });

  res.json({ ok: true });
}
