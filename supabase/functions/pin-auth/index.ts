import { createClient } from "jsr:@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const RATE_LIMIT = 5;      // max failed attempts
const LOCKOUT_MINUTES = 15;

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

  // --- register: new PIN-only user ---
  if (action === "register") {
    const { data: existing } = await sb.from("users").select("id").eq("username", lowerUser).maybeSingle();
    if (existing) return json({ error: "Username already taken — try another." }, 409);

    const hash = await bcrypt.hash(pin);
    const newId = crypto.randomUUID();
    const { error } = await sb.from("users").insert({ id: newId, username: lowerUser, pin_hash: hash });
    if (error) return json({ error: error.message }, 500);

    return json({ id: newId, username: lowerUser });
  }

  // --- add-pin: existing user adding PIN to passkey account ---
  if (action === "add-pin") {
    if (!userId) return json({ error: "Missing userId" }, 400);
    const hash = await bcrypt.hash(pin);
    const { data, error } = await sb.from("users").update({ pin_hash: hash }).eq("id", userId).select("id");
    if (error) return json({ error: error.message }, 500);
    if (!data || data.length === 0) return json({ error: "Could not save PIN — try again." }, 500);
    return json({ ok: true });
  }

  // --- login: verify PIN with rate limiting ---
  if (action === "login") {
    const { data: user, error } = await sb
      .from("users")
      .select("id, username, pin_hash, pin_attempts, pin_locked_until")
      .eq("username", lowerUser)
      .maybeSingle();

    if (error || !user || !user.pin_hash) return json({ error: "Wrong PIN — try again." }, 401);

    // check lockout
    if (user.pin_locked_until && new Date(user.pin_locked_until) > new Date()) {
      return json({ error: `Too many attempts — try again in ${LOCKOUT_MINUTES} minutes.` }, 429);
    }

    const valid = await bcrypt.compare(pin, user.pin_hash);

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

    // success — clear attempts
    await sb.from("users").update({ pin_attempts: 0, pin_locked_until: null }).eq("id", user.id);
    return json({ id: user.id, username: user.username });
  }

  return json({ error: "Unknown action" }, 400);
});
