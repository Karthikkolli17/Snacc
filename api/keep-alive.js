export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.CRON_SECRET) {
    return res.status(500).json({ error: 'Missing CRON_SECRET' });
  }

  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase environment variables' });
  }

  const base = process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
  const url = `${base}/ratings?select=id&limit=1`;
  const response = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    },
  });

  if (!response.ok) {
    return res.status(response.status).json({
      error: 'Supabase keep-alive failed',
      detail: await response.text(),
    });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: true, checkedAt: new Date().toISOString() });
}
