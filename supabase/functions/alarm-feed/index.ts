// @ts-nocheck
// alarm-feed: wake-up alarms for the next ~24 h, read by the member's iPhone shortcut "CoolCrew Alarm Sync".
// GET ?t=<personal token>  (made in Crew Brief > ตั้งเวลา; only its SHA-256 is stored in public.alarm_tokens)
// -> {ok, alarms:["2026-11-01T03:35:00+07:00", ...], summary, duties:[...]}
// Wake times use the same rule and settings as the Crew Brief page and the push "tick" (wake = report - commute - buffer - prep,
// or report - hotel - buffer away from base; standby at home: no alarm). iPhone alarms have no date, so only times
// inside the next 23 h 50 min are returned; the shortcut runs twice a day.
// 2026-10-29: serves both sites (coolcrew = TVJ, tgcrew = TG): CORS echoes an allow-listed Origin; station time zones are
// IANA zones (same table as tz.js in the web app), so Europe/Australia daylight saving is handled.
// JWT verification is OFF on purpose: the shortcut has no session; the personal token is the credential.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ORIGINS = ["https://coolcrew.web.app", "https://tgcrew.web.app"];
const corsFor = (req) => {
  const o = req?.headers?.get?.("origin") || "";
  return { "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0], "Vary": "Origin", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "content-type" };
};
let cors = corsFor(null);
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

/* ---------- time helpers: station → IANA zone (copy of tz.js), offsets follow daylight saving ---------- */
const Z = {};
const set = (list, zone) => list.split(" ").forEach((c) => { Z[c] = zone; });
set("BKK DMK HKT CNX KBV URT HDY CEI UTH KKC UBP NST USM TST LOE NAW PHS SNO KOP NNT TDX ROI BFV NAK PRH LPT HGN MAQ HHQ CJM UNN PAN UTP", "Asia/Bangkok");
set("SGN HAN DAD CXR PQC HPH VCA VII HUI DLI VDH", "Asia/Ho_Chi_Minh");
set("PNH REP KTI SAI KOS", "Asia/Phnom_Penh"); set("VTE LPQ PKZ", "Asia/Vientiane");
set("CGK SUB KNO", "Asia/Jakarta"); set("DPS", "Asia/Makassar");
set("CCU DEL BOM MAA BLR HYD GAY VNS AMD COK JAI BBI LKO IXC TRV CCJ ATQ PAT GAU IXB PNQ GOI GOX", "Asia/Kolkata");
set("DAC CGP", "Asia/Dhaka"); set("RGN MDL NYT", "Asia/Yangon"); set("CMB", "Asia/Colombo"); set("KTM", "Asia/Kathmandu"); set("MLE", "Indian/Maldives");
set("KUL PEN BKI LGK JHB KCH", "Asia/Kuala_Lumpur"); set("SIN", "Asia/Singapore"); set("MNL CEB CRK", "Asia/Manila"); set("BWN", "Asia/Brunei");
set("HKG", "Asia/Hong_Kong"); set("MFM", "Asia/Macau"); set("TPE KHH RMQ TSA", "Asia/Taipei");
set("PEK PKX PVG SHA CAN SZX CTU TFU CKG KMG XIY HGH NKG WUH CSX JHG TAO TSN TNA SJW TYN CGO ZUH LHW HRB SHE DLC CGQ SWA JJN YNT WUX CZX KHN LJG NNY BHY FOC XMN HFE WNZ NGB NNG KWL HAK SYX", "Asia/Shanghai");
set("ICN GMP PUS CJU TAE CJJ MWX", "Asia/Seoul");
set("NRT HND KIX FUK NGO CTS OKA KOJ KMJ HIJ OKJ SDJ ITM KIJ TAK MYJ NGS OIT KKJ HKD AOJ KMQ", "Asia/Tokyo");
set("ISB KHI LHE", "Asia/Karachi"); set("DXB", "Asia/Dubai"); set("DOH", "Asia/Qatar"); set("MCT", "Asia/Muscat"); set("JED RUH", "Asia/Riyadh"); set("TLV", "Asia/Jerusalem");
set("LHR LGW MAN", "Europe/London"); set("CDG", "Europe/Paris"); set("FRA MUC", "Europe/Berlin"); set("ZRH", "Europe/Zurich");
set("CPH", "Europe/Copenhagen"); set("ARN", "Europe/Stockholm"); set("OSL", "Europe/Oslo"); set("BRU", "Europe/Brussels");
set("MXP FCO", "Europe/Rome"); set("VIE", "Europe/Vienna"); set("AMS", "Europe/Amsterdam"); set("IST", "Europe/Istanbul"); set("SVO DME", "Europe/Moscow");
set("SYD", "Australia/Sydney"); set("MEL", "Australia/Melbourne"); set("PER", "Australia/Perth"); set("BNE", "Australia/Brisbane"); set("AKL", "Pacific/Auckland");
const F = {};
const zone = (st) => Z[String(st || "").toUpperCase()] || "Asia/Bangkok";
function offAt(st, ms) {   // minutes east of UTC at that instant
  const z = zone(st);
  const f = F[z] || (F[z] = new Intl.DateTimeFormat("en-US", { timeZone: z, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }));
  const p = {}; for (const x of f.formatToParts(ms)) p[x.type] = x.value;
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - Math.floor(ms / 60000) * 60000) / 60000);
}
const hm2min = (s) => { const m = /(\d{1,2}):?(\d{2})/.exec(s || ""); return m ? +m[1] * 60 + +m[2] : null; };
function absT(date, hhmm, st) {
  const m = hm2min(hhmm); if (m == null || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return null;
  const [y, mo, d] = date.split("-").map(Number);
  const wall = Date.UTC(y, mo - 1, d, 0, m);
  const t = wall - offAt(st, wall) * 60000;
  return wall - offAt(st, t) * 60000;
}
const pad = (n) => String(n).padStart(2, "0");
function iso(ms, st) {   // local time of the station with its offset, e.g. 2026-11-01T03:35:00+07:00
  const o = offAt(st, ms), d = new Date(ms + o * 60000), a = Math.abs(o);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00${o < 0 ? "-" : "+"}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}
const hmOf = (ms, st) => { const d = new Date(ms + offAt(st, ms) * 60000); return pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()); };
const DEF = { base: "BKK", commute: 45, prep: 45, hotel: 75, snooze: 5, buffer: 15 };
const THM = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// pure: duties + settings -> alarms in (now, now + 23h50m]
export function computeAlarms(brief, settings, now) {
  const S = { ...DEF, ...(settings || {}) };
  const base = String(brief?.base || S.base || "BKK").toUpperCase();
  const duties = Array.isArray(brief?.duties) ? brief.duties : [];
  const from = now + 60000, to = now + (23 * 60 + 50) * 60000;
  const out = [], used = [];
  for (const d of duties) {
    if (!d || typeof d !== "object" || !["FLT", "SBY", "SIM"].includes(d.type) || typeof d.report !== "string" || !d.report) continue;
    const st = String(d.from || base).toUpperCase();
    const rep = absT(d.date, d.report, st);
    if (rep == null) continue;
    const away = st !== base;
    const repBaseMin = Math.floor((((rep + offAt(base, rep) * 60000) % 86400000) + 86400000) % 86400000 / 60000);
    const extra = repBaseMin >= 300 && repBaseMin < 420 ? +S.buffer || 0 : 0;
    let wake = null;
    if (away) wake = rep - ((+S.hotel || 0) + extra) * 60000;
    else if (!(d.type === "SBY" && !d.airportSby)) wake = rep - ((+S.commute || 0) + extra + (+S.prep || 0)) * 60000;
    if (wake == null) continue;
    const times = [wake];
    if ((+S.snooze || 0) > 0) times.push(wake + (+S.snooze) * 60000);
    const tz = away ? st : base;
    const mine = times.filter((t) => t > from && t <= to);
    if (!mine.length) continue;
    mine.forEach((t) => out.push({ t, at: iso(t, tz) }));
    const [y, m, dd] = d.date.split("-").map(Number);
    used.push({ date: d.date, code: d.code || d.type, report: d.report, from: st, wake: hmOf(wake, tz), label: `${hmOf(wake, tz)} · ${d.code || d.type} report ${d.report}${away ? " (" + st + ")" : ""} · ${dd} ${THM[m - 1]}` });
  }
  out.sort((a, b) => a.t - b.t);
  const uniq = [...new Set(out.map((x) => x.at))];
  return { alarms: uniq, duties: used, summary: used.length ? "ตั้งปลุก " + used.map((u) => u.label).join(" / ") : "" };
}

async function sha256hex(s) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}

if (typeof Deno !== "undefined") Deno.serve(async (req) => {
  cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET" && req.method !== "POST") return json({ ok: false, message: "method not allowed" }, 405);
  const t = new URL(req.url).searchParams.get("t") || "";
  if (!/^[0-9a-f]{48}$/.test(t)) return json({ ok: false, message: "ลิงก์ไม่ถูกต้อง · สร้างลิงก์ใหม่ในหน้า ตั้งเวลา" }, 404);
  const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  try {
    const { data: tok } = await admin.from("alarm_tokens").select("user_id").eq("token_hash", await sha256hex(t)).maybeSingle();
    if (!tok) return json({ ok: false, message: "ลิงก์นี้ถูกยกเลิกแล้ว · สร้างลิงก์ใหม่ในหน้า ตั้งเวลา" }, 404);
    const { data: prof } = await admin.from("profiles").select("status").eq("id", tok.user_id).maybeSingle();
    if (prof?.status !== "approved") return json({ ok: false, message: "บัญชียังไม่ได้รับอนุมัติ" }, 403);
    const [{ data: r }, { data: p }] = await Promise.all([
      admin.from("rosters").select("brief").eq("user_id", tok.user_id).maybeSingle(),
      admin.from("member_prefs").select("prefs").eq("user_id", tok.user_id).maybeSingle(),
    ]);
    const now = Date.now();
    const res = computeAlarms(r?.brief, p?.prefs?.settings, now);
    await admin.from("alarm_tokens").update({ last_used_at: new Date(now).toISOString() }).eq("user_id", tok.user_id);
    return json({ ok: true, generated_at: new Date(now).toISOString(), ...res });
  } catch (e) {
    console.error("alarm-feed", String(e?.message || e));
    return json({ ok: false, message: "ระบบขัดข้อง ลองใหม่อีกครั้ง" }, 502);
  }
});
