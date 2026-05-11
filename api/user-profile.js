function validUsername(username) {
  return /^[a-z0-9_]{1,20}$/.test(username);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase environment variables' });
  }

  const username = String(req.query.username || '').toLowerCase().trim();
  if (!validUsername(username)) return res.status(400).json({ error: 'Invalid username' });

  try {
    const base = process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
    const params = new URLSearchParams({
      select: 'id,username,credential_id,pin_hash',
      username: `eq.${username}`,
      limit: '1',
    });
    const response = await fetch(`${base}/users?${params}`, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
    });
    if (!response.ok) throw new Error(await response.text());

    const [user] = await response.json();
    res.setHeader('Cache-Control', 'no-store');
    if (!user) return res.status(200).json({ user: null });
    return res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        has_passkey: Boolean(user.credential_id),
        has_pin: Boolean(user.pin_hash),
      },
    });
  } catch (e) {
    return res.status(500).json({ error: 'Profile lookup failed', detail: e.message });
  }
}
