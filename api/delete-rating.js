import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ratingId, userId } = req.body;
  if (!ratingId || !userId) return res.status(400).json({ error: 'Missing ratingId or userId' });

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  const { data, error: fetchErr } = await sb
    .from('ratings')
    .select('user_id')
    .eq('id', ratingId)
    .single();

  if (fetchErr || !data) return res.status(404).json({ error: 'Rating not found' });
  if (data.user_id !== userId) return res.status(403).json({ error: 'Not your log' });

  const { error } = await sb.from('ratings').delete().eq('id', ratingId);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true });
}
