import crypto from 'node:crypto';

function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function getSessionUser(req) {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) throw new Error('Missing APP_SESSION_SECRET');

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-snacc-session'];
  if (!token || typeof token !== 'string') return null;

  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;

  const expected = sign(payload, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const data = JSON.parse(b64urlDecode(payload));
  if (!data?.id || !data?.username || !data?.exp) return null;
  if (Date.now() > data.exp) return null;
  return { id: data.id, username: data.username };
}

export function requireSession(req, res) {
  let user = null;
  try {
    user = getSessionUser(req);
  } catch (e) {
    res.status(500).json({ error: e.message });
    return null;
  }
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return user;
}
