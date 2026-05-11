import { requireSession } from './_session.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireSession(req, res);
  if (!user) return;

  const base = process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
  const headers = {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  };

  const url = `${base}/ratings?user_id=eq.${encodeURIComponent(user.id)}&select=*&order=logged_at.desc`;
  const response = await fetch(url, { headers });
  if (!response.ok) return res.status(500).json({ error: 'List failed', detail: await response.text() });

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ data: await response.json() });
}
