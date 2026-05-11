function getUser() {
  try { return JSON.parse(localStorage.getItem('snacc_user')); } catch { return null; }
}

function getSessionToken() {
  return getUser()?.sessionToken || '';
}

function authHeaders(extra = {}) {
  const token = getSessionToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

function requireAuth() {
  const user = getUser();
  if (!user) { window.location.replace('auth.html'); return null; }
  return user;
}

function logout() {
  localStorage.removeItem('snacc_user');
  window.location.replace('auth.html');
}

function _bufToB64(buf) {
  return btoa(Array.from(new Uint8Array(buf), b => String.fromCharCode(b)).join(''));
}

async function registerPasskey(username) {
  const { data: existing } = await sb.from('users').select('id').eq('username', username).maybeSingle();
  if (existing) throw new Error('Username already taken — try another.');

  const userId = crypto.randomUUID();

  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Snacc', id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(userId),
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'required',
      },
      timeout: 60000,
    }
  });

  const credentialId = _bufToB64(cred.rawId);
  const { error } = await sb.from('users').insert({ id: userId, username, credential_id: credentialId });
  if (error) throw new Error(error.message);

  const user = { id: userId, username };
  localStorage.setItem('snacc_user', JSON.stringify(user));
  return user;
}

async function loginPasskey() {
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      userVerification: 'required',
      timeout: 60000,
    }
  });

  const credentialId = _bufToB64(assertion.rawId);
  const { data, error } = await sb.from('users').select('id, username').eq('credential_id', credentialId).maybeSingle();
  if (error || !data) throw new Error('No account found for this passkey.');

  const user = { id: data.id, username: data.username };
  localStorage.setItem('snacc_user', JSON.stringify(user));
  return user;
}

const PIN_AUTH_URL = `${SUPABASE_URL}/functions/v1/pin-auth`;

async function _pinRequest(body) {
  const res = await fetch(PIN_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

async function registerPin(username, pin) {
  const data = await _pinRequest({ action: 'register', username, pin });
  const user = { id: data.id, username: data.username, sessionToken: data.session_token };
  localStorage.setItem('snacc_user', JSON.stringify(user));
  return user;
}

async function addPinToAccount(userId, username, pin) {
  await _pinRequest({ action: 'add-pin', username, pin, userId });
}

async function loginPin(username, pin) {
  const data = await _pinRequest({ action: 'login', username, pin });
  const user = { id: data.id, username: data.username, sessionToken: data.session_token };
  localStorage.setItem('snacc_user', JSON.stringify(user));
  return user;
}
