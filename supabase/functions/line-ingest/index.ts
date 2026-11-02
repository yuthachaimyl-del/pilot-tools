// Supabase Edge Function: line-ingest (v15)
// Receives flights from the CoolCrew LINE bot (Google Apps Script):
//   - "Flight Detail" screens: one flight with its CPT/FO
//   - "Duty" screens: every flight of a duty, without crew
//   - duty-list screens: report/release per duty, plus the giver's duties around a released duty (giver_days)
// CPT/FO found on any flight of a duty are copied to the duty's other flights that have none yet.
// v12 adds the Thai Airways cabin-crew group (actions tg_seen / tg_post / tg_check): the bot reads a swap picture
// with Gemini and sends the released days; each becomes a "give" post of the TG bot account (app_keys
// "line_bot_author_TG"), so only TG members see it. The TVJ actions above are unchanged.
// The bot authenticates with the shared secret INGEST_SECRET (header x-ingest-secret); the service role
// key never leaves this function.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const FIELDS = [
  "flight_date", "flight_no", "route", "std", "sta", "equipment",
  "cpt_name", "cpt_code", "fo_name", "fo_code", "duty_date", "duty_code", "duty_report", "duty_release",
];
const CREW = ["cpt_name", "cpt_code", "fo_name", "fo_code"];
const MAX_ROWS = 20;
const AROUND = 2; // giver_days: this many days before and after the released duty

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s: unknown) => typeof s === "string" && /^\d{1,2}:\d{2}$/.test(s);
const str = (s: unknown, max = 60) => (typeof s === "string" ? s.trim().slice(0, max) : "");
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);

function cleanRow(r: Record<string, unknown>) {
  if (!isDate(r.flight_date) || !/^\d{2,4}$/.test(str(r.flight_no))) return null;
  const row: Record<string, string> = {};
  for (const f of FIELDS) {
    const v = str(r[f]);
    if (v) row[f] = v; // leave out empty fields so a weak OCR read never blanks good data
  }
  for (const f of ["cpt_code", "fo_code"]) if (row[f] && !/^TVJ\d{4}$/.test(row[f])) delete row[f];
  for (const f of ["cpt_name", "fo_name"]) if (row[f] && !/^[A-Za-z .'-]+$/.test(row[f])) delete row[f];
  if (row.duty_date && !isDate(row.duty_date)) delete row.duty_date;
  if (row.duty_code && !/^[A-Za-z0-9_ -]+$/.test(row.duty_code)) delete row.duty_code;
  for (const f of ["std", "sta", "duty_report", "duty_release"]) if (row[f] && !isTime(row[f])) delete row[f];
  return row;
}

type ListRow = { duty_date: string; duty_code: string; type: "FLT" | "SBY"; route: string; report: string; release: string };
type List = { rows: ListRow[]; from: string; to: string };

/** The duty-list screen as the bot read it: every row (flights and standby) and the date span the screenshot covers. */
function cleanList(body: Record<string, unknown>): List | null {
  const rows = (Array.isArray(body.duties) ? body.duties : []).slice(0, 40).map((d: Record<string, unknown>) => ({
    duty_date: str(d?.duty_date), duty_code: str(d?.duty_code), route: str(d?.route, 40),
    type: (d?.type === "SBY" ? "SBY" : "FLT") as "FLT" | "SBY", report: str(d?.report), release: str(d?.release),
  })).filter((d) => isDate(d.duty_date) && /^[A-Za-z0-9_ -]+$/.test(d.duty_code) && isTime(d.report) && isTime(d.release));
  if (!rows.length) return null;
  const dates = rows.map((r) => r.duty_date).sort();
  const span = (body.span || {}) as Record<string, unknown>;
  return { rows, from: isDate(span.from) ? (span.from as string) : dates[0], to: isDate(span.to) ? (span.to as string) : dates[dates.length - 1] };
}

/** Copy CPT/FO to every flight of the duty that has none, from the most recently updated flight that has them. */
async function fillDutyCrew(db: SupabaseClient, dutyDate: string, dutyCode: string) {
  const { data } = await db.from("flight_crew").select(FIELDS.join(",") + ",updated_at")
    .eq("duty_date", dutyDate).eq("duty_code", dutyCode).order("updated_at", { ascending: false });
  const rows = (data ?? []) as Record<string, string>[];
  const src = rows.find((r) => r.cpt_code || r.fo_code);
  if (!src) return;
  for (const r of rows) {
    if (r.cpt_code || r.fo_code) continue;
    const crew = Object.fromEntries(CREW.map((f) => [f, src[f]]));
    await db.from("flight_crew").update(crew).eq("flight_date", r.flight_date).eq("flight_no", r.flight_no);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const secret = Deno.env.get("INGEST_SECRET");
  if (!secret || req.headers.get("x-ingest-secret") !== secret) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  if (body.action === "ping") return json({ ok: true });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (body.action === "upsert") {
    const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, MAX_ROWS).map(cleanRow)
      .filter(Boolean) as Record<string, string>[];
    if (!rows.length) return json({ error: "no_valid_rows" }, 400);
    for (const row of rows) {
      const { error } = await db.from("flight_crew")
        .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "flight_date,flight_no" });
      if (error) { console.error(error); return json({ error: "db_error" }, 500); }
    }
    // a Duty screen and a Flight Detail screen of the same day pair up on (flight_date, flight_no), in either order
    await fillDuties(db, await fetchRows(db, rows));
    // the duty-list screen of the same batch (sent earlier) gives the giver's days around the released duty
    const list = body.list && typeof body.list === "object" ? cleanList(body.list as Record<string, unknown>) : null;
    if (list) await applyGiverDays(db, list);
    return json({ ok: true, rows: await fetchRows(db, rows) });
  }

  // duty-list screen ("334-1: BKK-NST-BKK" / "Oct 26 (Mo) 11:40 L - 20:35 L"): report/release per duty,
  // and the giver's duties around any released duty that appears in the list
  if (body.action === "duty_times") {
    const list = cleanList(body);
    if (!list) return json({ error: "no_valid_duties" }, 400);
    const author = await botAuthor(db);
    for (const d of list.rows) {
      if (d.type !== "FLT") continue; // standby rows carry no flights to post
      const t = { duty_date: d.duty_date, duty_code: d.duty_code, report: d.report, release: d.release };
      await db.from("duty_times").upsert({ ...t, updated_at: new Date().toISOString() }, { onConflict: "duty_date,duty_code" });
      // flights already sent without report/release get them now; a Duty Detail read keeps priority
      await db.from("flight_crew").update({ duty_report: d.report, duty_release: d.release })
        .eq("duty_date", d.duty_date).eq("duty_code", d.duty_code).or("duty_report.is.null,duty_report.eq.");
      if (author) await upsertGivePost(db, author, d.duty_date, d.duty_code);
    }
    // a duty-list screen is a release of every flight duty on it (the taker picks the day); each becomes a give
    // post with what the list gives (route, report/release). A Duty/Flight Detail sent later fills in the rest.
    if (author) for (const r of list.rows) if (r.type === "FLT") await postFromList(db, author, r);
    const posts = await applyGiverDays(db, list);
    return json({ ok: true, duties: list.rows.length, posts });
  }

  // "/check": the flights of the latest batch of screenshots, crew filled in
  if (body.action === "get") {
    const keys = (Array.isArray(body.keys) ? body.keys : []).slice(0, 60)
      .filter((k) => isDate(k?.flight_date) && /^\d{2,4}$/.test(str(k?.flight_no))) as Record<string, string>[];
    await fillDuties(db, await fetchRows(db, keys));
    return json({ ok: true, rows: await fetchRows(db, keys) });
  }

  // ── Thai Airways cabin crew group ──
  if (body.action === "tg_seen") return json(await tgSeen(db, body));
  if (body.action === "tg_post") return json(await tgPost(db, body));
  if (body.action === "tg_check") return json(await tgCheck(db, body));

  return json({ error: "unknown_action" }, 400);
});

/**
 * giver_days: for every open bot "give" post whose duty appears in the list (same date + code, so the
 * list is the giver's own schedule), store the list's rows within ±AROUND days of the post.
 * Dates inside the screenshot's span with no row are OFF; dates outside the span are left out (unknown).
 */
async function applyGiverDays(db: SupabaseClient, list: List) {
  const author = await botAuthor(db);
  if (!author) return 0;
  const { data } = await db.from("posts").select("id,date,code")
    .eq("author", author).eq("kind", "give").eq("status", "open").gte("date", list.from).lte("date", list.to);
  let n = 0;
  for (const p of (data ?? []) as { id: string; date: string; code: string }[]) {
    if (!list.rows.some((r) => r.duty_date === p.date && r.duty_code === p.code)) continue;
    const days: Record<string, string>[] = [];
    for (let i = -AROUND; i <= AROUND; i++) {
      const d = addDays(p.date, i);
      if (d < list.from || d > list.to) continue;
      const rows = list.rows.filter((r) => r.duty_date === d);
      if (!rows.length) { days.push({ date: d, type: "OFF", code: "", route: "", report: "", release: "" }); continue; }
      for (const r of rows) days.push({ date: d, type: r.type, code: r.duty_code, route: r.route, report: r.report, release: r.release });
    }
    const { error } = await db.from("posts").update({ giver_days: days }).eq("id", p.id);
    if (error) console.error("giver_days", error); else n++;
  }
  return n;
}

async function fetchRows(db: SupabaseClient, keys: Record<string, string>[]) {
  const out: Record<string, string>[] = [];
  for (const k of keys) {
    const { data } = await db.from("flight_crew").select(FIELDS.join(","))
      .eq("flight_date", k.flight_date).eq("flight_no", k.flight_no).maybeSingle();
    if (data) out.push(data as Record<string, string>);
  }
  return out;
}

async function fillDuties(db: SupabaseClient, rows: Record<string, string>[]) {
  const duties = new Set(rows.filter((r) => r.duty_date && r.duty_code).map((r) => r.duty_date + "|" + r.duty_code));
  const author = duties.size ? await botAuthor(db) : null;
  for (const key of duties) {
    const [dutyDate, dutyCode] = key.split("|");
    await fillDutyCrew(db, dutyDate, dutyCode);
    if (author) await upsertGivePost(db, author, dutyDate, dutyCode);
  }
}

/** A give post from a duty-list row alone (no flights known yet): "BKK-DYG-BKK" → detail "BKK-DYG, DYG-BKK". */
async function postFromList(db: SupabaseClient, author: string, r: ListRow) {
  const { data: existing } = await db.from("posts").select("id")
    .eq("author", author).eq("kind", "give").eq("date", r.duty_date).eq("code", r.duty_code).limit(1).maybeSingle();
  if (existing) return;
  const legs = r.route.split("-").filter(Boolean);
  const detail = legs.length > 1 ? legs.slice(1).map((b, i) => `${legs[i]}-${b}`).join(", ") : r.route;
  const { error } = await db.from("posts").insert({
    author, kind: "give", date: r.duty_date, code: r.duty_code, status: "open", detail, report: r.report, release: r.release,
    note: "📲 จาก LINE · จากหน้ารายการ Duty (ยังไม่มีเลขเที่ยวบิน/ลูกเรือ ส่งรูป Duty Detail เพิ่มได้)",
  });
  if (error) console.error("post(list)", error);
}

// The swap-board account that LINE screenshots are posted as (app_keys "line_bot_author" = its profile id).
async function botAuthor(db: SupabaseClient) {
  const { data } = await db.from("app_keys").select("value").eq("name", "line_bot_author").maybeSingle();
  return typeof data?.value === "string" ? data.value : null;
}

/** One open "give" post per duty on the swap board; sending the duty again updates it instead of adding another. */
async function upsertGivePost(db: SupabaseClient, author: string, dutyDate: string, dutyCode: string) {
  const { data } = await db.from("flight_crew").select(FIELDS.join(","))
    .eq("duty_date", dutyDate).eq("duty_code", dutyCode).order("flight_date").order("std");
  const flights = (data ?? []) as Record<string, string>[];
  if (!flights.length) return;
  const crew = flights.find((r) => r.cpt_code || r.fo_code);
  if (!flights[0].duty_report) {
    const { data: t } = await db.from("duty_times").select("report,release").eq("duty_date", dutyDate).eq("duty_code", dutyCode).maybeSingle();
    if (t?.report) { flights[0].duty_report = t.report; flights[0].duty_release = t.release; }
  }
  const fields = {
    detail: flights.map((r) => `${r.flight_no} ${r.route}`).join(", "),
    report: flights[0].duty_report || "",
    release: flights[0].duty_release || "",
    note: [
      "📲 จาก LINE",
      crew?.fo_code && `FO ${crew.fo_name} (${crew.fo_code})`,
      crew?.cpt_code && `CPT ${crew.cpt_name} (${crew.cpt_code})`,
      // the Duty screen was read without its Report/Release: show the flight times we do have instead of leaving them blank
      !flights[0].duty_report && flights[0].std && `🕒 STD ${flights[0].std} → STA ${flights[flights.length - 1].sta || "?"} (ยังไม่มีเวลา report)`,
    ].filter(Boolean).join(" · "),
  };
  const { data: existing } = await db.from("posts").select("id,status")
    .eq("author", author).eq("kind", "give").eq("date", dutyDate).eq("code", dutyCode).limit(1).maybeSingle();
  if (existing) {
    if (existing.status === "open") await db.from("posts").update(fields).eq("id", existing.id);
    return;
  }
  const { error } = await db.from("posts")
    .insert({ author, kind: "give", date: dutyDate, code: dutyCode, status: "open", ...fields });
  if (error) console.error("post", error);
}

// ───────────────────────── Thai Airways cabin crew group (v12) ─────────────────────────

const TG_SEEN_DAYS = 7;      // the same picture (or the same roster) within this many days is not read again
const TG_MAX_OFFERS = 31;    // duties one picture may release (a whole-month roster with no marks = every flight)
const isHex = (s: unknown) => typeof s === "string" && /^[0-9a-f]{16,64}$/.test(s);

async function botAuthorTG(db: SupabaseClient) {
  const { data } = await db.from("app_keys").select("value").eq("name", "line_bot_author_TG").maybeSingle();
  return typeof data?.value === "string" ? data.value : null;
}

/**
 * tg_seen {fp}: claims a picture fingerprint. new = true the first time (or after TG_SEEN_DAYS); the bot then reads
 * the picture. A claimed fingerprint stays claimed even if the read later fails, so a burst of reposts costs one read.
 */
async function tgSeen(db: SupabaseClient, body: Record<string, unknown>) {
  if (!isHex(body.fp)) return { error: "bad_fp" };
  const fp = body.fp as string;
  const now = new Date();
  const { data: row } = await db.from("line_seen").select("seen_at,result").eq("fp", fp).maybeSingle();
  if (row && now.getTime() - Date.parse(row.seen_at) < TG_SEEN_DAYS * 864e5) return { ok: true, new: false, result: row.result ?? null };
  const { error } = await db.from("line_seen").upsert({ fp, airline: "TG", seen_at: now.toISOString(), result: null }, { onConflict: "fp" });
  if (error) { console.error("seen", error); return { error: "db_error" }; }
  if (Math.random() < 0.02) await db.from("line_seen").delete().lt("seen_at", new Date(now.getTime() - 30 * 864e5).toISOString());
  return { ok: true, new: true };
}

type TgFlight = { flt: string; dep: string; std: string; arr: string; sta: string };
type TgOffer = { date: string; until: string; code: string; type: string; route: string; report: string; release: string; flights: TgFlight[]; note: string; ac: string };

function cleanOffer(o: Record<string, unknown>): TgOffer | null {
  if (!o || !isDate(o.date)) return null;
  const type = ["FLT", "SBY", "OFF"].includes(String(o.type)) ? String(o.type) : "FLT";
  const flights = (Array.isArray(o.flights) ? o.flights : []).slice(0, 8).map((f: Record<string, unknown>) => ({
    flt: str(f?.flt, 6).replace(/\D/g, "").replace(/^0+(?=\d{3})/, ""), dep: str(f?.dep, 3).toUpperCase(), std: isTime(f?.std) ? str(f?.std) : "",
    arr: str(f?.arr, 3).toUpperCase(), sta: isTime(f?.sta) ? str(f?.sta) : "",
  })).filter((f) => /^\d{2,4}$/.test(f.flt));
  const code = flights.length ? flights.map((f) => f.flt).join("/") : str(o.code, 20).replace(/[^A-Za-z0-9/ -]/g, "") || (type === "SBY" ? "SBY" : type === "OFF" ? "OFF" : "");
  if (!code) return null;
  return {
    date: o.date as string, code, type,
    // multi-day trip (outbound … layover … return): until = the return day, at most 10 days on
    until: isDate(o.until) && (o.until as string) > (o.date as string) && (o.until as string) <= addDays(o.date as string, 10) ? (o.until as string) : "", route: str(o.route, 40).toUpperCase().replace(/[^A-Z-]/g, ""),
    report: isTime(o.report) ? str(o.report) : "", release: isTime(o.release) ? str(o.release) : "",
    flights, note: str(o.note, 80), ac: str(o.ac, 6).toUpperCase().replace(/[^A-Z0-9]/g, ""),
  };
}

/** tg_post {fp, from, name, offers[], wants, avoid}: one open give post per released day of this sender. */
async function tgPost(db: SupabaseClient, body: Record<string, unknown>) {
  const author = await botAuthorTG(db);
  if (!author) return { error: "no_tg_bot" };
  const from = isHex(body.from) ? (body.from as string) : "";
  const name = str(body.name, 40).replace(/[<>]/g, "");
  const wants = str(body.wants, 120), avoid = str(body.avoid, 80);
  // LINE link of the poster: the QR code's URL (line.me / lin.ee only) or a LINE ID written on the picture
  const qr = str(body.qr, 200), lid = str(body.line_id, 40).replace(/^@?\s*/, "");
  const contact = /^https:\/\/(line\.me|lin\.ee)\/[\w\/~@.%?=&+-]+$/i.test(qr) ? qr
    : /^[A-Za-z0-9._-]{3,30}$/.test(lid) ? "https://line.me/R/ti/p/~" + encodeURIComponent(lid) : "";
  const offers = (Array.isArray(body.offers) ? body.offers : []).slice(0, TG_MAX_OFFERS).map(cleanOffer).filter(Boolean) as TgOffer[];
  const today = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);   // Bangkok date
  const done: Record<string, string>[] = [];
  // the original picture (QR code, notes on it): stored once per picture while it has a post still ahead
  const pic = offers.some((o) => o.date >= today) ? await tgSavePic(db, body) : "";
  if (Math.random() < 0.05) await tgCleanPics(db, today);
  for (const o of offers) {
    if (o.date < today) continue;
    const detail = o.flights.length
      ? o.flights.map((f) => `TG${f.flt} ${f.dep}-${f.arr}${f.std ? " " + f.std : ""}${f.sta ? "→" + f.sta : ""}`).join(", ")
      : (o.route || (o.type === "SBY" ? "Standby" : o.type === "OFF" ? "วันหยุด" : ""));
    const note = [
      "📲 จาก LINE" + (name ? " · " + name : ""),
      o.note,
      wants && "ขอ: " + wants,
      avoid && "❌ " + avoid,
      contact ? "" : "ติดต่อในกลุ่ม LINE",
    ].filter(Boolean).join(" · ").slice(0, 300);
    const fields: Record<string, string> = { detail: detail.slice(0, 200), report: o.report, release: o.release, note };
    if (o.ac) fields.ac_type = o.ac;
    if (o.until) fields.until_date = o.until;
    if (contact) fields.contact = contact;
    if (pic) fields.pic = pic;   // aircraft type when the picture shows it (Cabin Connect "789"); unknown stays null
    let q = db.from("posts").select("id,status").eq("author", author).eq("kind", "give").eq("date", o.date).eq("code", o.code);
    q = from ? q.eq("line_from", from) : q.is("line_from", null);
    const { data: existing } = await q.limit(1).maybeSingle();
    if (existing) {
      if (existing.status === "open") await db.from("posts").update(fields).eq("id", existing.id);
    } else {
      const { error } = await db.from("posts").insert({ author, kind: "give", date: o.date, code: o.code, status: "open", line_from: from || null, ...fields });
      if (error) { console.error("tg post", error); continue; }
    }
    done.push({ date: o.date, code: o.code, detail: fields.detail, report: o.report, release: o.release });
  }
  const result = { posts: done, wants, avoid, at: new Date().toISOString() };
  if (isHex(body.fp)) await db.from("line_seen").update({ result }).eq("fp", body.fp as string);
  return { ok: true, ...result };
}

/** tg_check {from}: this sender's open TG posts from today on. */
async function tgCheck(db: SupabaseClient, body: Record<string, unknown>) {
  const author = await botAuthorTG(db);
  if (!author || !isHex(body.from)) return { ok: true, posts: [] };
  const today = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
  const { data } = await db.from("posts").select("date,code,detail,report,release,status,note")
    .eq("author", author).eq("line_from", body.from as string).gte("date", today).order("date").limit(20);
  return { ok: true, posts: data ?? [] };
}

/** Upload the picture (base64 jpeg, up to ~4 MB) to the private bucket tg-pics; returns its path or "". */
async function tgSavePic(db: SupabaseClient, body: Record<string, unknown>) {
  const b64 = typeof body.image === "string" ? body.image.replace(/^data:[^,]*,/, "").replace(/\s+/g, "") : "";
  if (!isHex(body.fp) || b64.length < 1000 || b64.length > 6e6) return "";
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = "tg/" + (body.fp as string) + ".jpg";
    const { error } = await db.storage.from("tg-pics").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (error) { console.error("pic", error); return ""; }
    return path;
  } catch (e) { console.error("pic", e); return ""; }
}

/** Remove pictures whose posts are all in the past (and clear posts.pic). */
async function tgCleanPics(db: SupabaseClient, today: string) {
  const { data } = await db.from("posts").select("pic,date").not("pic", "is", null).limit(2000);
  const last = new Map<string, string>();
  for (const r of (data ?? []) as { pic: string; date: string }[]) if (!last.has(r.pic) || r.date > last.get(r.pic)!) last.set(r.pic, r.date);
  const old = [...last].filter(([, d]) => d < today).map(([p]) => p).slice(0, 100);
  if (!old.length) return;
  const { error } = await db.storage.from("tg-pics").remove(old);
  if (error) { console.error("clean", error); return; }
  await db.from("posts").update({ pic: null }).in("pic", old);
}
