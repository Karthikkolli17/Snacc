import { createClient } from "jsr:@supabase/supabase-js@2";

const RATE_LIMIT = 5;
const LOCKOUT_MINUTES = 15;
const SESSION_DAYS = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeUsername(username: unknown): string | null {
  if (typeof username !== "string") return null;
  const u = username.trim().toLowerCase();
  return /^[a-z0-9_]{1,20}$/.test(u) ? u : null;
}

function isValidPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}

function isValidEmail(email: unknown): boolean {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlText(text: string): string {
  return b64url(new TextEncoder().encode(text));
}

async function signSession(id: string, username: string): Promise<string> {
  const secret = Deno.env.get("APP_SESSION_SECRET");
  if (!secret) throw new Error("Missing APP_SESSION_SECRET");
  const payload = b64urlText(JSON.stringify({
    id,
    username,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  }));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${b64url(new Uint8Array(sig))}`;
}

async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:${saltHex}:${hashHex}`;
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "pbkdf2") return false;
  const salt = new Uint8Array(parts[1].match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256);
  const newHash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  return newHash === parts[2];
}

async function sha256hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sendResetEmail(to: string, username: string, code: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("Email service not configured.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Snacc <onboarding@resend.dev>",
      to: [to],
      subject: `${code} is your Snacc reset code`,
      text: `Hi @${username},\n\nYour PIN reset code is: ${code}\n\nExpires in 10 minutes. If you didn't request this, ignore this email.\n\n— Snacc`,
    }),
  });
  if (!res.ok) throw new Error(`Email send failed: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : null;
  if (!action) return json({ error: "Missing action" }, 400);

  const lowerUser = normalizeUsername(body.username);
  if (!lowerUser) return json({ error: "Letters, numbers, underscores only. Max 20 characters." }, 400);

  // ── send-reset ─────────────────────────────────────────────────────────────
  if (action === "send-reset") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
    if (!email || !isValidEmail(email)) return json({ error: "Valid email required." }, 400);

    const { data: user } = await sb.from("users").select("id, email").eq("username", lowerUser).maybeSingle();

    // Always return ok — don't reveal if username/email matches
    if (!user || user.email !== email) return json({ ok: true });

    const raw = crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000;
    const code = String(raw);
    const codeHash = await sha256hex(code);
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await sb.from("users").update({ reset_code_hash: codeHash, reset_code_expires_at: expires }).eq("id", user.id);

    try {
      await sendResetEmail(email, lowerUser, code);
    } catch (e) {
      return json({ error: (e as Error).message }, 500);
    }

    return json({ ok: true });
  }

  // ── verify-reset ───────────────────────────────────────────────────────────
  if (action === "verify-reset") {
    const code = typeof body.code === "string" ? body.code.trim() : null;
    if (!code || !/^\d{6}$/.test(code)) return json({ error: "Enter the 6-digit code from your email." }, 400);

    const { data: user } = await sb.from("users")
      .select("id, reset_code_hash, reset_code_expires_at")
      .eq("username", lowerUser)
      .maybeSingle();

    if (!user || !user.reset_code_hash) return json({ error: "Invalid or expired code." }, 401);
    if (new Date(user.reset_code_expires_at) < new Date()) return json({ error: "Code expired — request a new one." }, 401);

    const codeHash = await sha256hex(code);
    if (codeHash !== user.reset_code_hash) return json({ error: "Wrong code — try again." }, 401);

    // Issue a one-time reset token (UUID, hashed, 5-min TTL) reusing the same columns
    const resetToken = crypto.randomUUID();
    const tokenHash = await sha256hex(resetToken);
    await sb.from("users").update({
      reset_code_hash: tokenHash,
      reset_code_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }).eq("id", user.id);

    return json({ reset_token: resetToken });
  }

  // ── Actions below require a valid PIN ──────────────────────────────────────
  if (!isValidPin(body.pin)) return json({ error: "PIN must be exactly 4 digits." }, 400);
  const pin = body.pin as string;

  // ── register ───────────────────────────────────────────────────────────────
  if (action === "register") {
    const { data: existing } = await sb.from("users").select("id").eq("username", lowerUser).maybeSingle();
    if (existing) return json({ error: "Username already taken — try another." }, 409);
    const hash = await hashPin(pin);
    const newId = crypto.randomUUID();
    const { error } = await sb.from("users").insert({ id: newId, username: lowerUser, pin_hash: hash });
    if (error) return json({ error: error.message }, 500);
    return json({ id: newId, username: lowerUser, session_token: await signSession(newId, lowerUser) });
  }

  // ── add-pin ────────────────────────────────────────────────────────────────
  if (action === "add-pin") {
    const userId = typeof body.userId === "string" ? body.userId : null;
    if (!userId) return json({ error: "Missing userId" }, 400);
    const hash = await hashPin(pin);
    const { data, error } = await sb.from("users").update({ pin_hash: hash }).eq("id", userId).select("id");
    if (error) return json({ error: error.message }, 500);
    if (!data || data.length === 0) return json({ error: "Could not save PIN — try again." }, 500);
    return json({ ok: true });
  }

  // ── login ──────────────────────────────────────────────────────────────────
  if (action === "login") {
    const { data: user, error } = await sb
      .from("users")
      .select("id, username, pin_hash, pin_attempts, pin_locked_until")
      .eq("username", lowerUser)
      .maybeSingle();

    if (error || !user || !user.pin_hash) return json({ error: "Wrong PIN — try again." }, 401);

    if (user.pin_locked_until && new Date(user.pin_locked_until) > new Date()) {
      return json({ error: `Too many attempts — try again in ${LOCKOUT_MINUTES} minutes.` }, 429);
    }

    const valid = await verifyPin(pin, user.pin_hash);

    if (!valid) {
      const attempts = (user.pin_attempts || 0) + 1;
      const update: Record<string, unknown> = { pin_attempts: attempts };
      if (attempts >= RATE_LIMIT) {
        update.pin_locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
        update.pin_attempts = 0;
      }
      await sb.from("users").update(update).eq("id", user.id);
      return json({ error: "Wrong PIN — try again." }, 401);
    }

    await sb.from("users").update({ pin_attempts: 0, pin_locked_until: null }).eq("id", user.id);
    return json({ id: user.id, username: user.username, session_token: await signSession(user.id, user.username) });
  }

  // ── reset (requires verified reset token) ─────────────────────────────────
  if (action === "reset") {
    const resetToken = typeof body.reset_token === "string" ? body.reset_token : null;
    if (!resetToken) return json({ error: "Reset token required." }, 400);

    const { data: user } = await sb.from("users")
      .select("id, username, reset_code_hash, reset_code_expires_at")
      .eq("username", lowerUser)
      .maybeSingle();

    if (!user || !user.reset_code_hash) return json({ error: "Invalid reset token." }, 401);
    if (new Date(user.reset_code_expires_at) < new Date()) return json({ error: "Reset token expired — start over." }, 401);

    const tokenHash = await sha256hex(resetToken);
    if (tokenHash !== user.reset_code_hash) return json({ error: "Invalid reset token." }, 401);

    const hash = await hashPin(pin);
    const { error } = await sb.from("users").update({
      pin_hash: hash,
      pin_attempts: 0,
      pin_locked_until: null,
      reset_code_hash: null,
      reset_code_expires_at: null,
    }).eq("id", user.id);
    if (error) return json({ error: error.message }, 500);
    return json({ id: user.id, username: user.username, session_token: await signSession(user.id, user.username) });
  }

  return json({ error: "Unknown action" }, 400);
});
