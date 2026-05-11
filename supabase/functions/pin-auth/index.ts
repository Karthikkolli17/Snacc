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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { action: string; username: string; pin: string; userId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  const { action, username, pin, userId } = body;
  if (!action || !username || !pin) return json({ error: "Missing fields" }, 400);

  const lowerUser = username.toLowerCase();

  if (action === "register") {
    const { data: existing } = await sb.from("users").select("id").eq("username", lowerUser).maybeSingle();
    if (existing) return json({ error: "Username already taken — try another." }, 409);
    const hash = await hashPin(pin);
    const newId = crypto.randomUUID();
    const { error } = await sb.from("users").insert({ id: newId, username: lowerUser, pin_hash: hash });
    if (error) return json({ error: error.message }, 500);
    return json({ id: newId, username: lowerUser, session_token: await signSession(newId, lowerUser) });
  }

  if (action === "add-pin") {
    if (!userId) return json({ error: "Missing userId" }, 400);
    const hash = await hashPin(pin);
    const { data, error } = await sb.from("users").update({ pin_hash: hash }).eq("id", userId).select("id");
    if (error) return json({ error: error.message }, 500);
    if (!data || data.length === 0) return json({ error: "Could not save PIN — try again." }, 500);
    return json({ ok: true });
  }

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

  return json({ error: "Unknown action" }, 400);
});
