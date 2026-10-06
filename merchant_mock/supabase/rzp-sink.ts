// Webhook receiver for testing. Deployed to Supabase as an Edge Function (verify_jwt off, because Razorpay cannot send a JWT).
// It logs every delivery and answers according to blindspot_webhook_mode: ok | 401 | 500 | ack_then_fail.
// Change the mode with SQL: update public.blindspot_webhook_mode set mode = '401', updated_at = now() where id = 1;
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MAX_BODY = 20000;
const KEEP_ROWS = 500;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });

  const raw = await req.text();
  let event: string | null = null;
  try { event = JSON.parse(raw).event ?? null; } catch { /* not JSON */ }

  const { data } = await db.from("blindspot_webhook_mode").select("mode").eq("id", 1).single();
  const mode = data?.mode ?? "ok";
  const reply =
    mode === "401" ? { status: 401, body: { error: "Unauthorized: missing session" } } :
    mode === "500" ? { status: 500, body: { error: "Internal Server Error" } } :
    { status: 200, body: mode === "ack_then_fail" ? { ok: true, note: "handler failed after ack" } : { ok: true } };

  const headers = Object.fromEntries(req.headers);
  for (const h of ["authorization", "cookie", "apikey"]) delete headers[h];
  await db.from("blindspot_webhook_log").insert({
    mode, status_returned: reply.status, event, event_id: req.headers.get("x-razorpay-event-id"),
    signature_present: req.headers.has("x-razorpay-signature"), headers, body_text: raw.slice(0, MAX_BODY),
  });

  const { data: last } = await db.from("blindspot_webhook_log").select("id").order("id", { ascending: false }).limit(1).single();
  if (last && last.id > KEEP_ROWS) await db.from("blindspot_webhook_log").delete().lt("id", last.id - KEEP_ROWS);

  return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { "content-type": "application/json" } });
});
