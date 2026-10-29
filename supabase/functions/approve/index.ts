// Supabase Edge Function: approve
// One-tap member approval from the owner's notification link (<site>/approve.html?t=TOKEN), for both airlines
// (coolcrew.web.app = TVJ pilots, tgcrew.web.app = TG cabin crew). The token is single-use and expires after 7 days.
// Approves only if rank/fleet/staff code/airline are unchanged since the link was sent (409 "changed"),
// only while the application is still pending (409 "not_pending"), and claims the token atomically.
// "Verify JWT" must be OFF for this function: the link works without signing in. Secrets come from env only.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const DAY = 86400000;
const APPROVE = new Set(["approve", "FO", "CPT"]);   // FO/CPT kept for links/pages from before the TG release

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: { t?: string; do?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const t = String(body.t ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(t)) return json({ error: "bad_token" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: tok } = await db.from("approval_tokens").select("*").eq("token", t).maybeSingle();
  if (!tok) return json({ error: "not_found" }, 404);
  const { data: p } = await db.from("profiles").select("*").eq("id", tok.profile_id).maybeSingle();
  if (!p) return json({ error: "not_found" }, 404);
  const { data: u } = await db.auth.admin.getUserById(p.id);
  const airline = p.airline || "TVJ";
  const info = { name: p.display_name, code: p.employee_code, rank: p.rank, fleet: p.fleet, airline, status: p.status, email: u?.user?.email ?? "" };
  const expired = Date.now() - Date.parse(tok.created_at) > 7 * DAY;

  if (!body.do) return json({ ...info, used: !!tok.used_at, expired });
  if (tok.used_at) return json({ error: "used", ...info }, 410);
  if (expired) return json({ error: "expired", ...info }, 410);

  const act = String(body.do);
  let upd: Record<string, string>;
  // the member may not change rank, fleet, staff code or airline after the link was sent (links made before 2026-10-10 have no snapshot)
  const changed = tok.req_rank != null &&
    (tok.req_rank !== p.rank || (tok.req_fleet || "A320") !== (p.fleet || "A320") || (tok.req_code || "") !== (p.employee_code || "") ||
     (tok.req_airline != null && tok.req_airline !== airline));
  if (APPROVE.has(act) && changed)
    return json({ error: "changed", message: "ข้อมูลผู้สมัครเปลี่ยนหลังส่งลิงก์ ให้ตรวจและอนุมัติในหน้าแอดมิน", ...info }, 409);
  if (APPROVE.has(act)) upd = { status: "approved" };   // approves exactly the rank and fleet the member asked for
  else if (act === "reject") upd = { status: "rejected" };
  else return json({ error: "bad_action" }, 400);

  // only a pending application can be decided by link: a later decision in the admin page always wins
  if (p.status !== "pending")
    return json({ error: "not_pending", message: "คำขอนี้ถูกตัดสินแล้วในหน้าแอดมิน (" + p.status + ")", ...info }, 409);

  // claim the token atomically so two taps cannot both act
  const now = new Date().toISOString();
  const { data: claimed } = await db.from("approval_tokens").update({ used_at: now }).eq("token", t).is("used_at", null).select("token");
  if (!claimed || claimed.length === 0) return json({ error: "used", ...info }, 410);

  const { data: done, error } = await db.from("profiles").update(upd).eq("id", p.id).eq("status", "pending").select("id");
  if (error || !done || done.length === 0) {
    await db.from("approval_tokens").update({ used_at: null }).eq("token", t);   // give the link back
    return json(error ? { error: "update_failed", message: error.message } : { error: "not_pending", message: "คำขอนี้ถูกตัดสินแล้วในหน้าแอดมิน", ...info }, error ? 500 : 409);
  }
  await db.from("approval_tokens").update({ used_at: now }).eq("profile_id", p.id).is("used_at", null);   // retire older links
  return json({ ok: true, ...info, ...upd });
});
