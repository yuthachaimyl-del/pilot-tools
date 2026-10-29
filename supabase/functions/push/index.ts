// @ts-nocheck
// Push notifications for CoolCrew (Web Push, VAPID). JWT verification is OFF; this function checks callers itself:
//   members (Authorization: user JWT)  -> key, subscribe, unsubscribe, test, join
//   database jobs (body.k / x-job-key) -> offer, post, tick
// 2026-10-29: two airlines in one project (profiles.airline: TVJ = coolcrew.web.app pilots, TG = tgcrew.web.app cabin crew).
//   Each push links to the recipient's own site; post/join pushes stay inside one airline; OMC delay alerts are TVJ only;
//   station time zones are IANA zones (daylight saving aware, same table as tz.js in the web app).
//   Works before the airline column exists (missing airline = TVJ).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
// SEC-004 (2026-10-19): SheetJS 0.20.3 (fixes CVE-2023-30533 prototype pollution, CVE-2024-22363 ReDoS); @e965/xlsx is a byte-identical npm mirror of the official cdn.sheetjs.com build
import * as XLSX from "npm:@e965/xlsx@0.20.3";

const SUBJECT = "mailto:yuthachai.myl@gmail.com";
const SITES: Record<string, string> = { TVJ: "https://coolcrew.web.app", TG: "https://tgcrew.web.app" };
const APP: Record<string, string> = { TVJ: "CoolCrew", TG: "CoolCrew TG" };
const airOf = (p: any) => (p && SITES[p.airline] ? p.airline : "TVJ");
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const MONTHS = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
const cache = new Map<string, { at: number; text: string; date: string | null }>();

/* ---------- Web Push (RFC 8291 / 8292) ---------- */
// Minimal Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) on WebCrypto. Works in Deno and Node 20+.
const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();

const b64u = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); },
};
const cat = (...a) => { const n = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(n); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function hmac(key, data) {
  const k = await subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await subtle.sign("HMAC", k, data));
}

async function generateVapidKeys() {
  const kp = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await subtle.exportKey("jwk", kp.privateKey);
  const pub = new Uint8Array(await subtle.exportKey("raw", kp.publicKey));
  return { privateJwk: jwk, publicKey: b64u.enc(pub) };
}

async function vapidHeader(endpoint, keys, subject) {
  const aud = new URL(endpoint).origin;
  const head = b64u.enc(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u.enc(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await subtle.importKey("jwk", keys.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(head + "." + body)));
  return `vapid t=${head}.${body}.${b64u.enc(sig)}, k=${keys.publicKey}`;
}

// derive CEK + nonce shared by both directions
async function derive(shared, authSecret, uaPub, asPub, salt) {
  const prkKey = await hmac(authSecret, shared);
  const ikm = (await hmac(prkKey, cat(te.encode("WebPush: info\0"), uaPub, asPub, new Uint8Array([1])))).slice(0, 32);
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(te.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, cat(te.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  return { cek, nonce };
}

async function encrypt(sub, payload) {
  const uaPub = b64u.dec(sub.keys.p256dh), authSecret = b64u.dec(sub.keys.auth);
  const as = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await subtle.exportKey("raw", as.publicKey));
  const uaKey = await subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const { cek, nonce } = await derive(shared, authSecret, uaPub, asPub, salt);
  const key = await subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const record = cat(typeof payload === "string" ? te.encode(payload) : payload, new Uint8Array([2]));
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, record));
  const rs = new Uint8Array([0, 0, 16, 0]);   // 4096
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

// 2026-10-12 hardening: only real Web Push services, never other hosts (server-side request guard)
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^(web\.push|[a-z0-9-]+\.push)\.apple\.com$/,
  /^updates\.push\.services\.mozilla\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/];
function okEndpoint(u: unknown) {
  try { const x = new URL(String(u)); return x.protocol === "https:" && !x.port && PUSH_HOSTS.some((re) => re.test(x.hostname)); } catch { return false; }
}
const MAX_SUBS_PER_USER = 10;

async function sendPush(sub, payload, keys, subject, ttl = 86400) {
  const body = await encrypt(sub, payload);
  if (!okEndpoint(sub.endpoint)) return { status: 410, text: "endpoint not allowed" };   // 410 -> row is removed
  const r = await fetch(sub.endpoint, {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    headers: { "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: String(ttl), Urgency: "high", Authorization: await vapidHeader(sub.endpoint, keys, subject) },
    body,
  });
  return { status: r.status, text: r.ok ? "" : (await r.text()).slice(0, 200) };
}

/* ---------- OMC sheet loader (same as the omc function; TVJ only) ---------- */
async function load(id: string) {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < 120_000) return hit;
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`, { redirect: "follow" });
  const type = r.headers.get("content-type") || "";
  if (!r.ok || type.includes("text/html")) throw new Error("เปิดชีตไม่ได้ (ต้องแชร์แบบ Anyone with the link)");
  const wb = XLSX.read(new Uint8Array(await r.arrayBuffer()), { type: "array", cellDates: true });
  const name = wb.SheetNames.find((n) => /GATE\s*&\s*BAY/i.test(n))
    || wb.SheetNames.find((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n]).includes("AC,FLIGHT,FROM,TO"));
  if (!name) throw new Error("ไม่ใช่ชีต GATE & ACFT STATUS ของ OMC");
  const ws = wb.Sheets[name];
  const text = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
  // the sheet date sits in the first column, row 2 (e.g. "09 Oct 2026" or a date cell)
  let date: string | null = null;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, blankrows: false }).slice(0, 6);
  for (const row of rows) {
    const v = (row as unknown[])[0];
    if (v instanceof Date) { date = new Date(v.getTime() + 12 * 3600_000).toISOString().slice(0, 10); break; }
    const m = typeof v === "string" && /(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})/.exec(v);
    if (m) { const mi = MONTHS.findIndex((x) => x.startsWith(m[2].toUpperCase())); if (mi >= 0) { date = `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`; break; } }
  }
  const out = { at: Date.now(), text, date };
  cache.set(id, out);
  return out;
}

/* ---------- time helpers: station → IANA zone (copy of tz.js), offsets follow daylight saving ---------- */
const Z: Record<string, string> = {};
const set = (list: string, zone: string) => list.split(" ").forEach((c) => { Z[c] = zone; });
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
const F: Record<string, Intl.DateTimeFormat> = {};
const zone = (st: string) => Z[String(st || "").toUpperCase()] || "Asia/Bangkok";
function offAt(st: string, ms: number) {   // minutes east of UTC at that instant
  const z = zone(st);
  const f = F[z] || (F[z] = new Intl.DateTimeFormat("en-US", { timeZone: z, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }));
  const p: Record<string, string> = {}; for (const x of f.formatToParts(ms)) p[x.type] = x.value;
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - Math.floor(ms / 60000) * 60000) / 60000);
}
const hm2min = (s: string) => { const m = /(\d{1,2}):?(\d{2})/.exec(s || ""); return m ? +m[1] * 60 + +m[2] : null; };
function absT(date: string, hhmm: string, st: string, dayOff = 0) {
  const m = hm2min(hhmm); if (m == null || !date) return null;
  const [y, mo, d] = date.split("-").map(Number);
  const wall = Date.UTC(y, mo - 1, d + dayOff, 0, m);
  const t = wall - offAt(st, wall) * 60000;
  return wall - offAt(st, t) * 60000;
}
const fmtL = (ms: number, st: string) => { const d = new Date(ms + offAt(st, ms) * 60000); return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0"); };
const DEF = { base: "BKK", commute: 45, prep: 45, hotel: 75, snooze: 5, buffer: 15 };
// swap-board rooms: TVJ = same fleet and Captain vs First Officer; TG = same rank (change here if TG crew prefer one room)
const ROOM_BY: Record<string, string> = { TVJ: "fleet+rank", TG: "rank" };
function sameRoom(a: any, b: any) {
  const air = airOf(a);
  if (air !== airOf(b)) return false;
  const by = ROOM_BY[air] || "all";
  if (by === "rank") return a.rank === b.rank;
  if (by === "fleet+rank") return (a.fleet || "A320") === (b.fleet || "A320") && ((a.rank === "CPT") === (b.rank === "CPT"));
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const q = new URL(req.url).searchParams;
  let body: Record<string, any> = {};
  if (req.method === "POST") { try { body = await req.json(); } catch { /* empty */ } }
  const action = body.action || q.get("action") || "";

  async function vapid() {
    const { data } = await admin.from("app_keys").select("value").eq("name", "vapid").maybeSingle();
    if (data?.value) return data.value as { privateJwk: JsonWebKey; publicKey: string };
    const k = await generateVapidKeys();
    await admin.from("app_keys").upsert({ name: "vapid", value: k });
    const { data: again } = await admin.from("app_keys").select("value").eq("name", "vapid").maybeSingle();   // keep the winner if two calls raced
    return (again?.value || k) as { privateJwk: JsonWebKey; publicKey: string };
  }
  async function member() {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return null;
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return null;
    const { data: p } = await admin.from("profiles").select("status").eq("id", u.user.id).maybeSingle();
    return p?.status === "approved" ? u.user.id : null;
  }
  async function isJob() {
    const k = body.k || req.headers.get("x-job-key") || "";   // never from the URL (2026-10-12)
    const { data } = await admin.rpc("check_omc_key", { k });
    return data === true;
  }
  const profs = new Map<string, any>();
  async function profilesOf(ids: string[]) {   // select * so this also works before the airline column exists
    const need = ids.filter((x) => x && !profs.has(x));
    if (need.length) { const { data } = await admin.from("profiles").select("*").in("id", need); for (const p of data || []) profs.set(p.id, p); }
    return ids.map((x) => profs.get(x)).filter(Boolean);
  }
  // msg.path is relative to the recipient's site ("/#board", "/brief.html"); each recipient gets the link of their own airline
  async function notify(userIds: string[], msg: { title: string; body: string; path?: string; tag?: string }) {
    if (!userIds.length) return { sent: 0 };
    const keys = await vapid();
    const ids = [...new Set(userIds)];
    await profilesOf(ids);
    const { data: subs } = await admin.from("push_subs").select("endpoint,sub,user_id").in("user_id", ids);
    let sent = 0;
    await Promise.allSettled((subs || []).map(async (s) => {
      try {
        const url = SITES[airOf(profs.get(s.user_id))] + (msg.path || "");
        const r = await sendPush(s.sub, JSON.stringify({ title: msg.title, body: msg.body, tag: msg.tag, url }), keys, SUBJECT);
        if (r.status === 404 || r.status === 410) await admin.from("push_subs").delete().eq("endpoint", s.endpoint);
        else if (r.status < 300) { sent++; await admin.from("push_subs").update({ last_ok: new Date().toISOString() }).eq("endpoint", s.endpoint); }
        else console.warn("push", r.status, r.text);
      } catch (e) { console.warn("push error", String(e)); }   // includes the 10 s timeout
    }));
    return { sent };
  }
  async function once(uid: string, key: string) {   // true the first time a key is seen for a user
    const { error } = await admin.from("push_log").insert({ user_id: uid, key });
    return !error;
  }

  try {
    if (action === "key") return json({ publicKey: (await vapid()).publicKey });

    if (action === "join") {   // a signed-in user just asked to join -> push to the admins of the same airline
      const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: null };
      if (!u?.user) return json({ message: "session expired" }, 401);
      const [me] = await profilesOf([u.user.id]);
      if (!me || me.status === "approved" || !me.employee_code) return json({ sent: 0 });
      if (!(await once(u.user.id, "join:" + u.user.id + ":" + me.employee_code))) return json({ sent: 0 });
      const { data: admins } = await admin.from("profiles").select("*").eq("is_admin", true);
      const ids = (admins || []).filter((x) => airOf(x) === airOf(me) && x.id !== u.user.id).map((x) => x.id);
      const what = airOf(me) === "TVJ" ? `${me.fleet || ""} ${me.rank || ""}` : `${me.rank || ""}`;
      return json(await notify(ids, { title: "มีคนขอเข้ากลุ่มใหม่ · รออนุมัติ", body: `${me.display_name || "สมาชิกใหม่"} · ${me.employee_code} · ขอเป็น ${what}`.replace(/\s+/g, " ").trim(), path: "/#stats", tag: "join-" + u.user.id }));
    }

    if (["subscribe", "unsubscribe", "test"].includes(action)) {
      const uid = await member();
      if (!uid) return json({ message: "session expired" }, 401);
      if (action === "subscribe") {
        const sub = body.sub;
        if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return json({ message: "bad subscription" }, 422);
        if (!okEndpoint(sub.endpoint)) return json({ message: "unsupported push service" }, 422);
        const { data: mine } = await admin.from("push_subs").select("endpoint").eq("user_id", uid).neq("endpoint", sub.endpoint).order("created_at", { ascending: true });
        const extra = (mine || []).length - (MAX_SUBS_PER_USER - 1);
        if (extra > 0) await admin.from("push_subs").delete().in("endpoint", (mine || []).slice(0, extra).map((x) => x.endpoint));   // drop the oldest devices
        await admin.from("push_subs").upsert({ endpoint: sub.endpoint, user_id: uid, sub, ua: String(body.ua || "").slice(0, 200), created_at: new Date().toISOString() });
        return json({ ok: true });
      }
      if (action === "unsubscribe") { await admin.from("push_subs").delete().eq("endpoint", body.endpoint || "").eq("user_id", uid); return json({ ok: true }); }
      const [me] = await profilesOf([uid]);
      return json(await notify([uid], { title: APP[airOf(me)], body: "แจ้งเตือนใช้งานได้แล้ว ✈️", tag: "test" }));
    }

    // offer / accepted / post: either a database job (body.k) or the member who just did it
    const job = await isJob();
    const actor = job ? null : await member();
    if (!job && !actor) return json({ message: "forbidden" }, 403);
    if (!job && !["offer", "accepted", "post"].includes(action)) return json({ message: "forbidden" }, 403);

    if (action === "offer") {   // someone offered on a post -> tell the post's author
      const { data: o } = await admin.from("offers").select("id,post_id,offered_by,date,code").eq("id", body.offer_id).maybeSingle();
      if (!o) return json({ sent: 0 });
      const { data: p } = await admin.from("posts").select("author,kind,date,code").eq("id", o.post_id).maybeSingle();
      if (!(await once(o.offered_by, "offer:" + o.id))) return json({ sent: 0 });
      if (!p || p.author === o.offered_by || (actor && actor !== o.offered_by)) return json({ sent: 0 });
      const [who, au] = await profilesOf([o.offered_by, p.author]);
      if (!who || !au || airOf(who) !== airOf(au)) return json({ sent: 0 });
      return json(await notify([p.author], { title: "มีคนเสนอแลกกับโพสต์ของคุณ", body: `${who?.display_name || "สมาชิก"} เสนอ ${o.code || o.date || ""} สำหรับ ${p.code || ""} วันที่ ${p.date}`, path: "/#board", tag: "offer-" + o.id }));
    }

    if (action === "accepted") {   // post author accepted an offer -> tell the person who offered
      const { data: o } = await admin.from("offers").select("id,post_id,offered_by").eq("id", body.offer_id).maybeSingle();
      if (!o) return json({ sent: 0 });
      const { data: p } = await admin.from("posts").select("author,date,code").eq("id", o.post_id).maybeSingle();
      if (actor && actor !== p?.author) return json({ sent: 0 });
      if (!(await once(o.offered_by, "acc:" + o.id))) return json({ sent: 0 });
      const [who] = await profilesOf([p?.author]);
      const [to] = await profilesOf([o.offered_by]);
      const tail = airOf(to) === "TVJ" ? " · อย่าลืมส่งฟอร์มขออนุมัติแลก" : "";
      return json(await notify([o.offered_by], { title: "ข้อเสนอแลกของคุณถูกรับแล้ว", body: `${who?.display_name || "สมาชิก"} รับข้อเสนอ ${p?.code || ""} วันที่ ${p?.date || ""}${tail}`, path: "/#board", tag: "acc-" + o.id }));
    }

    if (action === "post") {   // new post -> members in the same room (same airline) whose roster fits that day
      const { data: p } = await admin.from("posts").select("id,author,kind,date,until_date,code").eq("id", body.post_id).maybeSingle();
      if (!p || (actor && actor !== p.author)) return json({ sent: 0 });
      if (!(await once(p.author, "post:" + p.id))) return json({ sent: 0 });
      const [me] = await profilesOf([p.author]);
      if (!me) return json({ sent: 0 });
      const { data: peers } = await admin.from("profiles").select("*").eq("status", "approved").neq("id", p.author);
      const ids = (peers || []).filter((x) => sameRoom(me, x)).map((x) => x.id);
      if (!ids.length) return json({ sent: 0 });
      const { data: rs } = await admin.from("rosters").select("user_id,days").in("user_id", ids);
      const WORK = new Set(["FLT", "SBY", "TRN", "OTH"]);
      const fit = (rs || []).filter((r) => {
        const d = Array.isArray(r.days) ? r.days.find((x: any) => x && x.date === p.date) : null;
        if (!d) return false;
        return p.kind === "give" ? d.type === "OFF" : WORK.has(d.type) || d.code === "-->";
      }).map((r) => r.user_id);
      const txt = p.kind === "give" ? `${me?.display_name || "สมาชิก"} ปล่อย ${p.code || "ไฟลท์"} วันที่ ${p.date} · คุณว่างวันนั้น` : `${me?.display_name || "สมาชิก"} อยากได้งานวันที่ ${p.date} · คุณมีงานวันนั้น`;
      return json(await notify(fit, { title: "โพสต์ใหม่ที่เข้ากับตารางคุณ", body: txt, path: "/#board", tag: "post-" + p.id }));
    }

    if (action === "tick") {   // every few minutes: wake-up reminders + inbound delay alerts (TVJ)
      const now = Date.now();
      const { data: subs } = await admin.from("push_subs").select("user_id");
      const uids = [...new Set((subs || []).map((s) => s.user_id))];
      if (!uids.length) return json({ users: 0 });
      await profilesOf(uids);
      const { data: rs } = await admin.from("rosters").select("user_id,brief").in("user_id", uids);
      const { data: ps } = await admin.from("member_prefs").select("user_id,prefs").in("user_id", uids);
      const prefOf = (u: string) => ({ ...DEF, ...((ps || []).find((x) => x.user_id === u)?.prefs?.settings || {}) });
      let wakes = 0, delays = 0;
      const sheets = new Map<string, any[] | null>();
      async function flightsOn(date: string) {
        if (sheets.has(date)) return sheets.get(date);
        let list: any[] | null = null;
        try {
          const { data: f } = await admin.from("omc_files").select("file_id").eq("date", date).maybeSingle();
          if (f?.file_id) {
            const { text } = await load(f.file_id);
            list = text.split("\n").map((l) => l.split(",")).filter((c) => /^HS-?[A-Z]{3}$/.test(c[0]) && /^VZ\d+/.test(c[1]))
              .map((c) => ({ ac: c[0], flt: c[1].replace(/[^A-Z0-9]/g, ""), from: c[2], to: c[3], std: c[4], sta: c[5], etd: c[6], eta: c[7], atd: c[10], ata: c[11], eta2: c[13], gate: c[16] }));
          }
        } catch (e) { console.warn("sheet", String(e)); }
        sheets.set(date, list); return list;
      }
      // housekeeping first, so it runs even if a member below fails: close posts whose day has passed (Bangkok date)
      const today = new Date(now + 7 * 3600e3).toISOString().slice(0, 10);
      await admin.from("posts").update({ status: "done" }).eq("status", "open").lt("date", today).is("until_date", null);
      await admin.from("posts").update({ status: "done" }).eq("status", "open").lt("until_date", today);
      let failed = 0;
      for (const r of rs || []) {
       try {   // one member's bad roster must never stop alerts for everyone else
        const air = airOf(profs.get(r.user_id));
        const S = prefOf(r.user_id), duties = (Array.isArray(r.brief?.duties) ? r.brief.duties : []) as any[];
        const base = String(r.brief?.base || S.base || "BKK").toUpperCase();
        for (const d of duties) {
          if (!d || typeof d !== "object" || typeof d.date !== "string" || typeof d.report !== "string") continue;
          if (!["FLT", "SBY", "SIM"].includes(d.type) || !d.report || !d.date) continue;
          const from = String(d.from || d.sectors?.[0]?.dep || base).toUpperCase();
          const rep = absT(d.date, d.report, from); if (!rep || rep < now - 3600e3 || rep > now + 30 * 3600e3) continue;
          const away = from !== base;
          const repBaseMin = Math.floor((((rep + offAt(base, rep) * 60000) % 86400000) + 86400000) % 86400000 / 60000);
          const extra = repBaseMin >= 300 && repBaseMin < 420 ? +S.buffer || 0 : 0;
          let wake: number | null = null;
          if (away) wake = rep - ((+S.hotel || 0) + extra) * 60000;
          else if (!(d.type === "SBY" && !d.airportSby)) wake = rep - ((+S.commute || 0) + extra + (+S.prep || 0)) * 60000;
          // wake-up push: in the 10 minutes up to the wake time
          if (wake && now >= wake - 10 * 60000 && now < wake + 5 * 60000 && await once(r.user_id, `wake:${d.date}:${d.report}`)) {
            const res = await notify([r.user_id], { title: `⏰ ถึงเวลาตื่น · report ${d.report} (${from})`, body: `${d.code || d.type}${Array.isArray(d.sectors) && d.sectors.length ? " · " + d.sectors.map((s: any) => s.dep + "-" + s.arr).join(" ") : ""}${away ? "" : " · ออกจากบ้าน " + fmtL(rep - ((+S.commute || 0) + extra) * 60000, base)}`, path: "/brief.html", tag: "wake-" + d.date });
            wakes += res.sent;
          }
          // inbound delay alert (TVJ OMC sheet): from 4 h before report until the first departure
          if (air !== "TVJ") continue;
          const s0 = Array.isArray(d.sectors) ? d.sectors[0] : null;
          if (d.type !== "FLT" || !s0 || now < rep - 4 * 3600e3) continue;
          const std = absT(d.date, s0.std, s0.dep); if (!std || now > std) continue;
          const list = await flightsOn(d.date); if (!list) continue;
          const want = "VZ" + String(s0.flt).replace(/\D/g, "");
          const f = list.find((x) => x.flt === want && x.from === s0.dep) || list.find((x) => x.flt === want);
          if (!f) continue;
          const mine = list.filter((x) => x.ac === f.ac), i = mine.indexOf(f), ib = i > 0 ? mine[i - 1] : null;
          const depT = hm2min(f.etd) ?? hm2min(f.std);
          let lateBy = 0, msg = "";
          if (ib) {
            const arr = hm2min(ib.ata) ?? hm2min(ib.eta2) ?? hm2min(ib.eta) ?? hm2min(ib.sta), sta = hm2min(ib.sta);
            if (arr != null && sta != null) { lateBy = ((arr - sta + 1440 + 720) % 1440) - 720; }
            const gnd = depT != null && arr != null ? ((depT - arr + 1440 + 720) % 1440) - 720 : null;
            if (lateBy >= 15 || (gnd != null && gnd < 35)) msg = `เครื่องขาเข้า ${ib.flt} ${ib.from}→${ib.to} ${ib.ata ? "ลง" : "ETA"} ${ib.ata || ib.eta2 || ib.eta || ib.sta} (ช้า ${lateBy} นาที)${gnd != null ? ` · บนพื้นก่อนเรา ${gnd} นาที` : ""}`;
          }
          const etdLate = f.etd && f.std && hm2min(f.etd)! - hm2min(f.std)! >= 15 ? hm2min(f.etd)! - hm2min(f.std)! : 0;
          if (etdLate) msg = `${f.flt} ETD ${f.etd} (เลื่อน ${etdLate} นาที)` + (msg ? " · " + msg : "");
          if (!msg) continue;
          const bucket = Math.floor(Math.max(lateBy, etdLate) / 15);
          if (await once(r.user_id, `delay:${d.date}:${f.flt}:${bucket}`)) {
            const res = await notify([r.user_id], { title: `✈️ ${f.flt} ${f.ac} · Bay/Gate ${f.gate || "-"}`, body: msg, path: "/brief.html", tag: "delay-" + f.flt });
            delays += res.sent;
          }
        }
       } catch (e) { failed++; console.warn("tick member skipped", String(e)); }
      }
      return json({ users: uids.length, wakes, delays, failed });
    }
    return json({ message: "unknown action" }, 422);
  } catch (e) {
    return json({ message: String((e as Error)?.message || e) }, 502);
  }
});
