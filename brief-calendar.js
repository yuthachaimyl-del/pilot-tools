// brief-calendar.js — "📅 อัปเดตปฏิทิน iPhone".
// The page sends the roster straight to the iPhone Shortcut "CoolCrew Calendar" (no server): the Shortcut removes the events
// it made before in the "CoolCrew" calendar for the same date range, then adds the duties again. Nothing changes in the
// calendar unless the member taps the button, other calendars and personal events are never touched, and an empty roster
// is never sent (so a bad read cannot wipe a month).
// Places: after uploading a roster (ใส่ roster), top of ตาราง, and the setup card in ตั้งเวลา.
(() => {
  const $ = (id) => document.getElementById(id);
  const H = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const NAME = "CoolCrew Calendar", CAL = "CoolCrew";
  // iCloud link of the ready-made "CoolCrew Calendar" Shortcut. Empty = use the Describe-a-shortcut path only.
  const SC_LINK = "";
  const IC_CAL = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" stroke-width="2.4" stroke-linecap="round"/></svg>';
  const IC_BOX = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 2h6l1-2h5"/></svg>';
  const IC_ADD = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" style="vertical-align:-2px"><rect x="3" y="5" width="15" height="14" rx="2"/><path d="M3 9h15"/><circle cx="18" cy="17" r="4" fill="currentColor"/><path d="M18 15v4M16 17h4" stroke="#1c1c1e"/></svg>';
  const LS_SYNC = "cb_cal_sync", LS_SETUP = "cb_cal_setup";
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  /* ---------- payload: the duties of the current roster ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  function isoAt(ms, st) {   // 2026-11-01T05:20:00+07:00 in the station's local time
    const o = (typeof tzOf === "function" ? tzOf(st).off : 420), d = new Date(ms + o * 6e4), a = Math.abs(o);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00${o < 0 ? "-" : "+"}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
  }
  const dayIso = (date, h) => `${date}T${h}:00+07:00`;
  function payload() {
    const all = (typeof sorted === "function" ? sorted() : []).filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.date || ""));
    if (!all.length) return null;
    const base = (STATE?.base || S?.base || "BKK").toUpperCase();
    const ev = [];
    for (const d of all) {
      if (!["FLT", "SBY", "SIM"].includes(d.type) || !d.report) continue;
      const b = brief(d); if (!b.repAbs) continue;
      const st = (d.from || base).toUpperCase(), to = (d.to || st).toUpperCase();
      const end = b.relAbs || b.repAbs + 36e5;
      const route = typeof stationName === "function" ? stationName(d) : "";
      const ic = d.type === "FLT" ? "✈️" : d.type === "SIM" ? "🎓" : "⏳";
      const notes = [
        `Report ${d.report} ${st}${d.release ? ` · Release ${d.release} ${to}` : ""}`,
        b.wakeAbs ? `Wake ${local(b.wakeAbs, b.away ? st : base).hm}` : "",
        ...(d.sectors || []).map((x) => `${x.flt ? "VZ" + x.flt + " " : ""}${x.dep || ""} ${x.std || ""} > ${x.arr || ""} ${x.sta || ""}`.replace(/\s+/g, " ").trim()),
        "CoolCrew",
      ].filter(Boolean).join("\n");
      ev.push({ t: `${ic} ${d.code || d.type}${route && route !== st ? " " + route : ""} · R ${d.report}`, s: isoAt(b.repAbs, st), e: isoAt(end, to), n: notes });
    }
    const first = all[0].date, last = all[all.length - 1].date;
    const nx = (() => { const [y, m, dd] = last.split("-").map(Number); return new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10); })();
    return { from: dayIso(first, "00:00"), to: dayIso(nx, "06:00"), range: [first, last], events: ev };
  }
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const body = (p) => JSON.stringify({ from: p.from, to: p.to, events: p.events });
  const fmtDay = (iso) => { const [, m, d] = iso.split("-").map(Number); return `${d} ${["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."][m - 1]}`; };
  const when = (t) => new Date(t).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  function runUrl(text) {
    const back = location.origin + location.pathname + "?cal=ok";
    return `shortcuts://x-callback-url/run-shortcut?name=${encodeURIComponent(NAME)}&input=text&text=${encodeURIComponent(text)}&x-success=${encodeURIComponent(back)}&x-error=${encodeURIComponent(back.replace("cal=ok", "cal=err"))}`;
  }
  function send(test) {
    const p = test ? testPayload() : payload();
    if (!p || (!test && !p.events.length)) { flash("ไม่มี duty ในตาราง · ไม่ได้ส่งอะไรไปที่ปฏิทิน"); return; }
    const text = body(p);
    if (!test) set(LS_SYNC, { at: Date.now(), h: hash(text), n: p.events.length, range: p.range });
    location.href = runUrl(text);
    setTimeout(paint, 500);
  }
  function testPayload() {
    const t = Date.now() + 36e5, e = t + 18e5;
    return { from: isoAt(t - 6e4, "BKK"), to: isoAt(e + 6e4, "BKK"), range: [], events: [{ t: "✈ CoolCrew test · ลบได้", s: isoAt(t, "BKK"), e: isoAt(e, "BKK"), n: "ทดสอบจาก CoolCrew · จะถูกลบเมื่ออัปเดตปฏิทินครั้งถัดไปในช่วงเวลานี้" }] };
  }


  /* ---------- Google Calendar (Android / anyone): Sign in with Google, then the page writes the events itself ----------
     Scope calendar.app.created: the app can only see and change calendars it created (the "CoolCrew" calendar). */
  const GCLIENT = window.CC_GOOGLE_CLIENT_ID || "152625331284-e0v1k98e3r4i4kiiafeeq6skkr8ol16a.apps.googleusercontent.com";   // OAuth client "CoolCrew Calendar" (project crew-brief), public id
  const GSCOPE = "https://www.googleapis.com/auth/calendar.app.created";
  const LS_GID = "cb_gcal_id", LS_GSYNC = "cb_gcal_sync";
  let gTok = null, gTokExp = 0, gClient = null, gBusy = false, gMsg = "";
  function gLoad() {
    if (!GCLIENT || window.google?.accounts?.oauth2 || $("gsiJs")) return;
    const sc = document.createElement("script"); sc.id = "gsiJs"; sc.src = "https://accounts.google.com/gsi/client"; sc.async = true; sc.onload = gInit; document.head.appendChild(sc);
  }
  function gInit() {
    if (gClient || !window.google?.accounts?.oauth2) return;
    gClient = google.accounts.oauth2.initTokenClient({ client_id: GCLIENT, scope: GSCOPE, callback: () => {} });
  }
  const gApi = async (path, opt = {}) => {
    const r = await fetch("https://www.googleapis.com/calendar/v3" + path, { ...opt, headers: { Authorization: "Bearer " + gTok, "Content-Type": "application/json", ...(opt.headers || {}) } });
    if (r.status === 204) return null;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j?.error?.message || "HTTP " + r.status); e.status = r.status; throw e; }
    return j;
  };
  function gToken() {
    return new Promise((res, rej) => {
      if (gTok && Date.now() < gTokExp - 60000) return res(gTok);
      gInit(); if (!gClient) return rej(new Error("โหลดระบบ Google ไม่ทัน ลองกดอีกครั้ง"));
      gClient.callback = (t) => { if (t?.error || !t?.access_token) return rej(new Error(t?.error_description || t?.error || "ยกเลิกการเข้าสู่ระบบ")); gTok = t.access_token; gTokExp = Date.now() + (+t.expires_in || 3000) * 1000; res(gTok); };
      gClient.error_callback = (e) => rej(new Error(e?.type === "popup_closed" ? "ปิดหน้าต่าง Google ก่อนเสร็จ · กดใหม่ได้เลย" : e?.type === "popup_failed_to_open" ? "เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ Google · อนุญาต pop-up ของ coolcrew.web.app แล้วกดใหม่" : e?.message || "เข้าสู่ระบบไม่สำเร็จ"));
      gClient.requestAccessToken({ prompt: gTok ? "" : "" });
    });
  }
  async function gCalendarId() {
    let id = get(LS_GID, null);
    if (id) { try { await gApi("/calendars/" + encodeURIComponent(id)); return id; } catch (e) { if (e.status !== 404 && e.status !== 403) throw e; } }
    try { const l = await gApi("/users/me/calendarList?minAccessRole=owner"); const f = (l.items || []).find((c) => c.summary === CAL); if (f) { set(LS_GID, f.id); return f.id; } } catch {}
    const c = await gApi("/calendars", { method: "POST", body: JSON.stringify({ summary: CAL, description: "ตารางบินจาก CoolCrew · อัปเดตเมื่อกดในแอป", timeZone: "Asia/Bangkok" }) });
    set(LS_GID, c.id); return c.id;
  }
  async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } })); }
  async function gSend() {
    if (gBusy) return;
    const p = payload();
    if (!p || !p.events.length) { gMsg = "ไม่มี duty ในตาราง · ไม่ได้ส่งอะไรไปที่ปฏิทิน"; paint(); return; }
    gBusy = true; gMsg = "กำลังเข้าสู่ระบบ Google…"; paint();
    try {
      await gToken();
      gMsg = "กำลังอัปเดต Google Calendar…"; paint();
      const id = await gCalendarId(), cid = encodeURIComponent(id);
      // remove the old CoolCrew events in the roster's range
      let old = [], tok = "";
      do {
        const q = new URLSearchParams({ timeMin: new Date(p.from).toISOString(), timeMax: new Date(p.to).toISOString(), singleEvents: "true", maxResults: "2500", privateExtendedProperty: "src=coolcrew" });
        if (tok) q.set("pageToken", tok);
        const j = await gApi(`/calendars/${cid}/events?` + q); old = old.concat(j.items || []); tok = j.nextPageToken || "";
      } while (tok);
      await pool(old, 4, (e) => gApi(`/calendars/${cid}/events/${encodeURIComponent(e.id)}`, { method: "DELETE" }).catch((x) => { if (x.status !== 410 && x.status !== 404) throw x; }));
      let done = 0;
      await pool(p.events, 4, async (e) => {
        await gApi(`/calendars/${cid}/events`, { method: "POST", body: JSON.stringify({ summary: e.t, description: e.n, start: { dateTime: e.s }, end: { dateTime: e.e }, reminders: { useDefault: false, overrides: [] }, extendedProperties: { private: { src: "coolcrew" } } }) });
        done++; if (done % 5 === 0) { gMsg = `กำลังใส่ ${done}/${p.events.length}…`; paint(); }
      });
      set(LS_GSYNC, { at: Date.now(), h: hash(body(p)), n: p.events.length, range: p.range });
      gMsg = `✓ อัปเดต Google Calendar แล้ว · ${p.events.length} duty (ลบของเดิม ${old.length})`;
    } catch (e) {
      gMsg = "⚠ " + (e?.message || e);
      if (e?.status === 401) { gTok = null; }
    } finally { gBusy = false; paint(); setTimeout(() => { if (!gBusy) { gMsg = ""; paint(); } }, 15000); }
  }
  function gRowHtml(s) {
    if (!GCLIENT) return "";
    const sync = get(LS_GSYNC, null);
    const cur = s.p && s.p.events.length ? hash(body(s.p)) : null, changed = !!(cur && (!sync || sync.h !== cur));
    const st = gMsg || (sync ? (changed ? `⚠ ตารางเปลี่ยนหลังอัปเดตครั้งล่าสุด (${when(sync.at)})` : `✓ ตรงกับตาราง · อัปเดตล่าสุด ${when(sync.at)}`) : "กดครั้งแรกจะให้เข้าสู่ระบบ Google แล้วสร้างปฏิทิน CoolCrew ให้เอง");
    return `<div class="row"><b style="font-size:.92rem">📅 Google Calendar</b><button class="btn ${changed ? "primary" : ""} small" type="button" data-cal="gsend" ${gBusy ? "disabled" : ""}>${gBusy ? "กำลังอัปเดต…" : "อัปเดต Google Calendar"}</button></div>
<div class="st">${H(st)}</div>`;
  }
  /* ---------- status + bars ---------- */
  function state() {
    const p = payload(), sync = get(LS_SYNC, null), setup = get(LS_SETUP, null);
    const cur = p && p.events.length ? hash(body(p)) : null;
    return { p, sync, setup, changed: !!(cur && (!sync || sync.h !== cur)), empty: !cur };
  }
  const CSS = `.calbar{display:flex;flex-direction:column;gap:6px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--surface)}
.calbar.hot{border-color:var(--amber);background:var(--amber-soft)}
.calbar .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:space-between}
.calbar .st{font-size:.82rem;color:var(--muted);line-height:1.45}.calbar.hot .st{color:var(--amber)}
.calbar .btn{white-space:nowrap}
#calSetup .alst{counter-reset:s;list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}
#calSetup .alst li{position:relative;padding:10px 12px 10px 44px;border:1px solid var(--line);border-radius:12px;line-height:1.55}
#calSetup .alst li::before{counter-increment:s;content:counter(s);position:absolute;left:12px;top:10px;width:24px;height:24px;border-radius:50%;background:var(--green);color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center}
#calSetup .alst .why{display:block;color:var(--muted);font-size:.9em;margin-top:4px}
#calSetup .k{display:inline-block;border:1px solid var(--line);border-radius:6px;padding:0 6px;font-size:.92em;white-space:nowrap}
#calSetup .ib{display:inline-block;vertical-align:middle;padding:4px 12px;margin:2px 0;font-size:.95em}
#calSetup .done{border-color:var(--green)!important}
#calSetup .cg{display:grid;gap:10px;margin-top:8px}
#calSetup .cg-s{display:grid;gap:6px}
#calSetup .cg-t{line-height:1.55}#calSetup .cg-t .n{display:inline-flex;width:20px;height:20px;border-radius:50%;background:var(--sunk);border:1px solid var(--line);align-items:center;justify-content:center;font-size:.78em;font-weight:700;margin-right:6px}
#calSetup .ph{background:#1c1c1e;color:#f2f2f7;border-radius:14px;padding:10px 12px;font:500 13px -apple-system,system-ui,sans-serif;display:grid;gap:6px;max-width:300px;border:1px solid #3a3a3c}
#calSetup .ph-days{display:flex;justify-content:space-around;font-weight:600;color:#f2f2f7}
#calSetup .ph-bar{display:flex;justify-content:space-between;align-items:center}
#calSetup .ph .pill{background:#2c2c2e;border-radius:999px;padding:6px 14px}
#calSetup .ph .pill2{display:flex;gap:16px;background:#3a3a3c;border-radius:999px;padding:6px 14px}
#calSetup .ph .ico{display:inline-flex;border-radius:8px;padding:2px}
#calSetup .ph .hl{outline:2.5px solid #ff9f0a;outline-offset:2px;border-radius:10px}
#calSetup .ph-h{font-weight:700;text-align:center;font-size:14px}
#calSetup .ph-h2{display:flex;justify-content:space-between;align-items:center}
#calSetup .ph-h2 .hl2{outline:2.5px solid #ff9f0a;outline-offset:2px;border-radius:50%;padding:0 5px}
#calSetup .ph-row{display:flex;gap:8px;align-items:center;background:#2c2c2e;border-radius:10px;padding:7px 10px}
#calSetup .ph .dot{width:12px;height:12px;border-radius:50%;display:inline-block;flex:none}
#calSetup .ph-btn{background:#2c2c2e;border-radius:10px;padding:8px 10px}
#calSetup .ph-menu{display:grid;gap:2px;background:#2c2c2e;border-radius:12px;padding:6px}
#calSetup .ph-menu div{padding:7px 8px;border-radius:8px}
#calSetup .ph-in{background:#2c2c2e;border-radius:10px;padding:8px 10px;font-weight:600}
#calSetup .ph .cur{display:inline-block;width:2px;height:14px;background:#0a84ff;vertical-align:-2px;margin-left:1px}`;
  let flashMsg = "", flashT = 0, redo = false;
  const flash = (m, ms = 5000) => { flashMsg = m; clearTimeout(flashT); flashT = setTimeout(() => { flashMsg = ""; paint(); }, ms); paint(); };
  function barHtml(s) {
    if (s.empty) return "";
    const ios = isIOS() || s.setup, g = gRowHtml(s);
    return (ios ? iosRow(s) : "") + (ios && g ? '<div style="border-top:1px solid var(--line);margin:4px 0"></div>' : "") + g;
  }
  function iosRow(s) {
    const rng = s.p.range.length ? `${fmtDay(s.p.range[0])} – ${fmtDay(s.p.range[1])}` : "";
    const st = !s.setup ? "ยังไม่ได้ตั้งค่า · ตั้งครั้งเดียวในเมนูตั้งเวลา"
      : s.sync ? (s.changed ? `⚠ ตารางเปลี่ยนหลังอัปเดตปฏิทินครั้งล่าสุด (${when(s.sync.at)})` : `✓ ปฏิทินตรงกับตาราง · อัปเดตล่าสุด ${when(s.sync.at)}`)
      : "ยังไม่เคยอัปเดตปฏิทิน";
    return `<div class="row"><b style="font-size:.92rem">📅 ปฏิทิน iPhone</b><button class="btn ${s.setup && (s.changed || !s.sync) ? "primary" : ""} small" type="button" data-cal="${s.setup ? "send" : "setup"}">${s.setup ? "อัปเดตปฏิทิน iPhone" : "ตั้งค่าปฏิทิน iPhone"}</button></div>
<div class="st">${H(flashMsg || st)}${s.setup ? ' · <a href="#" data-cal="setup" style="color:inherit">Shortcut หาย / ตั้งใหม่</a>' : ""}${!flashMsg && s.setup ? ` · ${s.p.events.length} duty${rng ? " · " + rng : ""} · ลบของเดิมช่วงนี้ในปฏิทิน CoolCrew ก่อนใส่ใหม่` : ""}</div>`;
  }
  function placeBar(id, anchor, where) {
    if (!anchor) return;
    let b = $(id);
    if (!b) { b = document.createElement("div"); b.id = id; b.className = "calbar"; anchor.insertAdjacentElement(where, b); }
    const s = state(), h = barHtml(s);
    const gs = get(LS_GSYNC, null), gch = GCLIENT && gs && s.p && gs.h !== hash(body(s.p));
    b.hidden = !h; b.classList.toggle("hot", !!((s.setup && s.changed && (isIOS() || s.setup)) || gch));
    if (b.dataset.h !== h) { b.innerHTML = h; b.dataset.h = h; }
  }

  /* ---------- setup card (ตั้งเวลา) ---------- */
  const PROMPT = `Create a shortcut named exactly "${NAME}".
In the shortcut details, set it to receive Text input (Receive Text input; if there is no input: Continue).
The input is text that is a JSON dictionary with keys "from", "to" and "events". It is sent from a web page through the shortcuts:// URL.
Use only these built-in Shortcuts actions, in this exact order, and nothing else:
0. "If" Shortcut Input does not have any value: "Show Notification" with text "CoolCrew: no data. Open CoolCrew and tap the calendar button there.", then "Stop This Shortcut". "End If".
1. "Get Dictionary from Input" using Shortcut Input.
2. "Get Dictionary Value" for key "from" in Dictionary. Then "Get Dates from Input" using that value; name it Start Range.
3. "Get Dictionary Value" for key "to" in Dictionary. Then "Get Dates from Input" using that value; name it End Range.
4. "Find Calendar Events" where Calendar is "${CAL}" and Start Date is between Start Range and End Range. No limit.
5. "If" Calendar Events has any value: "Remove Events" using the Calendar Events from step 4, with "Confirm Before Removing" turned off. "End If".
6. "Get Dictionary Value" for key "events" in Dictionary.
7. "Repeat with Each" item in that value:
   a. "Get Dictionary Value" for key "s" in Repeat Item, then "Get Dates from Input" on it (start).
   b. "Get Dictionary Value" for key "e" in Repeat Item, then "Get Dates from Input" on it (end).
   c. "Get Dictionary Value" for key "t" in Repeat Item (title) and for key "n" in Repeat Item (notes).
   d. "Add New Event" in calendar "${CAL}" with Title = title, Start Date = start, End Date = end, Notes = notes, All Day off, no alert.
   "End Repeat".
8. "Count" the items in the "events" value, then "Show Notification" with text "CoolCrew: updated calendar, " followed by the Count, followed by " duties".
Rules: do not add, remove, rename or reorder any action. Do not use "Use Model", "Cloud model", "Ask for Input", "Ask Each Time", or any AI action. Nothing may ask the user anything when it runs. Do not add any automation.`;

  function setupCard() {
    const host = $("p-settings"); if (!host) return null;
    let c = $("calSetup");
    if (!c) {
      c = document.createElement("div"); c.id = "calSetup"; c.className = "card";
      const al = $("al_card"); al ? al.insertAdjacentElement("afterend", c) : host.appendChild(c);
    }
    return c;
  }
  function paintSetup() {
    const c = setupCard(); if (!c) return;
    const setup = get(LS_SETUP, null);
    const h = `<h2 id="calSetupTop">ปฏิทิน iPhone</h2>
<p class="small" style="margin:0;line-height:1.6">ส่งตารางบินเข้าแอป <b>ปฏิทิน</b> บน iPhone <b>เฉพาะตอนคุณกด "อัปเดตปฏิทิน iPhone"</b> (หลังใส่ roster หรือที่แท็บตาราง) · ทุกครั้งที่อัปเดต จะลบ event เดิมของ CoolCrew ในช่วงวันที่ของตารางก่อน แล้วใส่ใหม่ ไม่มีซ้ำ · ไม่แตะปฏิทินอื่นและนัดส่วนตัว</p>
${SC_LINK ? `<div class="note ok small" style="margin-top:8px">📱 ใช้ได้ทุก iPhone ที่เป็น <b>iOS 17 ขึ้นไป</b></div>` : `<div class="note info small" style="margin-top:8px;line-height:1.6"><b>📱 เครื่องที่ตั้งได้</b> (เพราะต้องใช้ช่อง <b>Describe a shortcut</b> ซึ่งเป็นฟีเจอร์ Apple Intelligence)<br>✅ iPhone 15 Pro / 15 Pro Max, iPhone 16 ทุกรุ่น (รวม 16e) และรุ่นใหม่กว่า · ต้องอัปเป็น <b>iOS 27</b> และเปิด <b>Apple Intelligence</b> ใน Settings → Apple Intelligence &amp; Siri<br>❌ iPhone 15 / 15 Plus, iPhone 14 และรุ่นเก่ากว่า จะไม่มีช่องนี้ แม้อัป iOS ล่าสุดแล้ว<br><span class="muted">รุ่นรองรับแต่ไม่เห็นช่อง Describe a shortcut: เช็คว่าเป็น iOS 27 และเปิด Apple Intelligence แล้ว (ถ้าเปิดไม่ได้ ลองตั้งภาษา Siri เป็น English)</span><br><span class="muted">เครื่องรุ่นเก่า: ใช้ปุ่ม <b>ดาวน์โหลดไฟล์ปฏิทิน (.ics)</b> ในแท็บ Brief แทน (ต้องโหลดใหม่เองทุกครั้งที่ตารางเปลี่ยน)</span></div>`}
${isIOS() ? "" : '<div class="note warn small">ใช้ได้บน iPhone / iPad เท่านั้น · เปิดหน้านี้บน iPhone เพื่อตั้งค่า</div>'}
${setup ? `<div class="note ok small" style="margin-top:8px">✓ ตั้งค่าแล้ว · กด <b>อัปเดตปฏิทิน iPhone</b> ได้เลย</div>
<div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap"><button class="btn primary" type="button" data-cal="send">📅 อัปเดตปฏิทิน iPhone ตอนนี้</button><button class="btn" type="button" data-cal="redo">🔧 ตั้ง Shortcut ใหม่</button></div>
<div class="small muted" style="margin-top:4px">เผลอลบ Shortcut, ลบปฏิทิน ${CAL}, หรือเปลี่ยน iPhone → กด <b>ตั้ง Shortcut ใหม่</b> แล้วทำตามขั้นตอนอีกครั้ง</div>` : ""}
<details id="calSteps" class="more" style="margin-top:8px" ${setup && !redo ? "" : "open"}><summary>${setup ? "ขั้นตอนตั้งค่า (ทำใหม่ได้ทุกเมื่อ) ›" : "ขั้นตอนตั้งค่า ›"}</summary>
<ol class="alst">
<li><b>สร้างปฏิทินชื่อ ${CAL}</b> <span class="why">ทำครั้งเดียว · event ของ CoolCrew จะอยู่ในปฏิทินนี้เท่านั้น แยกจากนัดส่วนตัว ซ่อนหรือเปลี่ยนสีได้ทีหลัง</span>
<div class="cg">
<div class="cg-s"><div class="cg-t"><span class="n">ก</span>เปิดแอป <b>ปฏิทิน</b> ที่มุมล่างขวามีปุ่มกลมยาว 2 ไอคอน แตะไอคอน<b>รูปปฏิทิน</b> (อันซ้าย)</div>
<div class="ph"><div class="ph-days"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div><div class="ph-bar"><span class="pill">Today</span><span class="pill2"><span class="ico hl">${IC_CAL}</span><span class="ico">${IC_BOX}</span></span></div></div></div>
<div class="cg-s"><div class="cg-t"><span class="n">ข</span>จะขึ้นหน้า <b>Calendars</b> รายชื่อปฏิทินทั้งหมด เลื่อน<b>ลงล่างสุด</b> แตะ <b>Add Calendar</b></div>
<div class="ph"><div class="ph-h">Calendars</div><div class="ph-row"><i class="dot" style="background:#5ac8fa"></i>iCloud / Gmail ของคุณ</div><div class="ph-row"><i class="dot" style="background:#34c759"></i>วันหยุดไทย</div><div class="ph-row"><i class="dot" style="background:#8e8e93"></i>Birthdays</div><div class="ph-btn hl">${IC_ADD} Add Calendar</div></div></div>
<div class="cg-s"><div class="cg-t"><span class="n">ค</span>มีเมนูเด้งขึ้น 4 อย่าง เลือก <b>Add Calendar</b> อันล่างสุด<span class="why">ไม่ใช่ Add Subscription / Holiday / Family Calendar</span></div>
<div class="ph"><div class="ph-menu"><div>${IC_ADD} Add Holiday Calendar</div><div>((·)) Add Subscription Calendar</div><div>☁ Add Family Calendar</div><div class="hl">${IC_ADD} Add Calendar</div></div></div></div>
<div class="cg-s"><div class="cg-t"><span class="n">ง</span>ตั้งชื่อ <b>${CAL}</b> พิมพ์ตามนี้ตรงตัว (C ใหญ่ทั้ง 2 ตัว ไม่มีเว้นวรรค) เลือกสีได้ตามชอบ ถ้าถามว่าเก็บที่บัญชีไหนให้เลือก <b>iCloud</b> แล้วแตะ <b>Done</b> / ✓ มุมขวาบน</div>
<div class="ph"><div class="ph-h2"><span>✕</span><b>New Calendar</b><span class="hl2">✓</span></div><div class="ph-in">${CAL}<i class="cur"></i></div><div class="ph-row"><i class="dot" style="background:#ffcc00"></i>Colour</div><div class="ph-row">Account <span style="margin-left:auto;color:#8e8e93">iCloud ›</span></div></div></div>
</div><span class="why">เสร็จแล้วกลับมาหน้านี้ ทำข้อ 2 ต่อ · ถ้ามีปฏิทินชื่อ ${CAL} อยู่แล้ว ข้ามข้อนี้ได้</span></li>
<li><b>สร้าง Shortcut "${NAME}"</b> <span class="why">Shortcut คือตัวกลางที่รับตารางจากหน้านี้ไปใส่ปฏิทิน (เว็บเขียนปฏิทิน iPhone เองไม่ได้) · ทำครั้งเดียว</span>
${SC_LINK ? `<div class="cg"><div class="cg-s"><div class="cg-t"><span class="n">ก</span>กด <a class="btn primary ib" href="${SC_LINK}" target="_blank" rel="noopener">⬇ ติดตั้ง Shortcut</a></div></div><div class="cg-s"><div class="cg-t"><span class="n">ข</span>iPhone เปิดหน้า Shortcut ขึ้นมา กด <b>Add Shortcut</b> (เพิ่มคำสั่งลัด) แล้วกลับมาหน้านี้ ทำข้อ 3 ต่อ</div></div></div><details class="more" style="margin-top:6px"><summary>ทางสำรอง: ให้ AI สร้าง (เครื่องที่มี Apple Intelligence) ›</summary><div class="cg"><div class="cg-s"><div class="cg-t"><span class="n">ก</span>กด <button class="btn primary ib" type="button" data-cal="copy">📋 คัดลอกคำสั่ง</button> ข้อความคำสั่งยาวๆ จะถูกคัดลอกไว้</div></div>
<div class="cg-s"><div class="cg-t"><span class="n">ข</span>กด <a class="btn ib" href="shortcuts://" rel="noopener">เปิด Shortcuts ↗</a> → แตะ <span class="k">＋</span> มุมขวาบน → แตะช่อง <b>Describe a shortcut</b> ด้านล่าง → <b>วาง</b> → กดส่ง แล้วรอให้ iPhone สร้างเสร็จ</div></div>
<div class="cg-s"><div class="cg-t"><span class="n">ค</span>เช็คชื่อด้านบนต้องเป็น <b>${NAME}</b> ตรงตัว (ถ้าไม่ตรง แตะชื่อแล้วแก้) · การ์ดควรเขียนประมาณ <i>Get dictionary from input · Find and remove old events · Add new events · Show notification</i></div></div></div></details>` : `<div class="cg"><div class="cg-s"><div class="cg-t"><span class="n">ก</span>กด <button class="btn primary ib" type="button" data-cal="copy">📋 คัดลอกคำสั่ง</button> ข้อความคำสั่งยาวๆ จะถูกคัดลอกไว้</div></div>
<div class="cg-s"><div class="cg-t"><span class="n">ข</span>กด <a class="btn ib" href="shortcuts://" rel="noopener">เปิด Shortcuts ↗</a> → แตะ <span class="k">＋</span> มุมขวาบน → แตะช่อง <b>Describe a shortcut</b> ด้านล่าง → <b>วาง</b> → กดส่ง แล้วรอให้ iPhone สร้างเสร็จ</div></div>
<div class="cg-s"><div class="cg-t"><span class="n">ค</span>เช็คชื่อด้านบนต้องเป็น <b>${NAME}</b> ตรงตัว (ถ้าไม่ตรง แตะชื่อแล้วแก้) · การ์ดควรเขียนประมาณ <i>Get dictionary from input · Find and remove old events · Add new events · Show notification</i></div></div></div>`}
<span class="why">⚠ อย่ากด ▶ ใน Shortcuts เพื่อทดสอบ จะได้ "0 duties" เพราะไม่มีตารางส่งเข้าไป ให้ทดสอบจากปุ่มในข้อ 3</span></li>
<li><b>ทดสอบจากหน้านี้</b> <button class="btn ib" type="button" data-cal="test">ส่ง event ทดสอบ</button><span class="why">หน้านี้จะเปิด Shortcuts ให้เอง · ครั้งแรก iPhone ถามสิทธิ์เข้าถึงปฏิทิน ตอบ <b>อนุญาต / Always Allow</b> และถ้าถามเรื่องลบ event ตอบ <b>Always Allow</b> · ควรขึ้นแจ้งเตือน "updated calendar, 1 duties" และเห็น "✈️ CoolCrew test" ในปฏิทิน ${CAL} อีกราว 1 ชม. ข้างหน้า (ลบทิ้งได้)</span></li>
<li class="${setup ? "done" : ""}"><b>${setup ? "✓ ตั้งค่าแล้ว" : "ใช้ได้แล้ว?"}</b> <button class="btn ${setup ? "ghost" : "primary"} ib" type="button" data-cal="${setup ? "unsetup" : "ok"}">${setup ? "ยกเลิกการตั้งค่า" : "✓ เห็น event ทดสอบแล้ว"}</button><span class="why">จากนั้นกด <b>อัปเดตปฏิทิน iPhone</b> ที่แท็บตารางได้เลย</span></li>
</ol></details>
<details class="more" style="margin-top:8px"><summary>ข้อความคำสั่ง / ถ้าไม่ทำงาน ›</summary><div class="small" style="margin-top:6px;line-height:1.7">
<div>ถ้ากดแล้วขึ้น "ไม่พบ Shortcut" = ชื่อ Shortcut ไม่ตรง <b>${NAME}</b> · ถ้า event ไม่เข้า = ชื่อปฏิทินไม่ตรง <b>${CAL}</b></div>
<div>อยากลบทั้งหมด: ลบปฏิทิน ${CAL} ในแอปปฏิทิน</div>
<textarea readonly rows="4" style="width:100%;margin-top:4px;font-family:var(--f-mono);font-size:11px">${H(PROMPT)}</textarea></div></details>`;
    if (c.dataset.h !== h) { c.innerHTML = h; c.dataset.h = h; }
  }

  async function copy(t, v) {
    const ok = () => { const o = t.textContent; t.textContent = "✓ คัดลอกแล้ว"; setTimeout(() => (t.textContent = o), 2500); };
    try { await navigator.clipboard.writeText(v); ok(); } catch { const ta = document.createElement("textarea"); ta.value = v; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); ok(); }
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-cal]"); if (!t) return;
    if (t.tagName === "A") e.preventDefault();
    const a = t.dataset.cal;
    if (a === "send") send(false);
    else if (a === "test") send(true);
    else if (a === "copy") copy(t, PROMPT);
    else if (a === "ok") { set(LS_SETUP, { at: Date.now() }); paint(); }
    else if (a === "unsetup") { set(LS_SETUP, null); set(LS_SYNC, null); paint(); }
    else if (a === "gsend") gSend();
    else if (a === "redo") { set(LS_SETUP, null); redo = true; paint(); setTimeout(() => $("calSteps")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100); }
    else if (a === "setup") { if (typeof showTab === "function") showTab("settings"); setTimeout(() => $("calSetup")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150); }
  });

  function paint() {
    try {
      const st = document.createElement("style");
      if (!$("calCss")) { st.id = "calCss"; st.textContent = CSS; document.head.appendChild(st); }
      placeBar("calBarRoster", $("uploadCard"), "afterend");
      placeBar("calBarMonth", $("monthTitle")?.closest(".card"), "afterend");
      const wl = $("wlNote"); if (wl && !wl.hidden) placeBar("calBarWl", wl, "afterend"); else if ($("calBarWl")) $("calBarWl").hidden = true;
      paintSetup();
    } catch (e) { console.warn("calendar", e); }
  }
  // back from the Shortcut (x-success): confirm and clean the URL
  try { const u = new URL(location.href); const cv = u.searchParams.get("cal"); if (cv === "ok" || cv === "err") { u.searchParams.delete("cal"); history.replaceState(null, "", u.pathname + u.search + u.hash);
      if (cv === "ok") flash("✓ อัปเดตปฏิทิน iPhone แล้ว");
      else { set(LS_SYNC, null); flash("⚠ Shortcut ทำงานไม่สำเร็จ หรือหา Shortcut \"" + NAME + "\" ไม่เจอ · กด 🔧 ตั้ง Shortcut ใหม่ ในอื่นๆ → ตั้งเวลา", 30000); } } } catch {}
  const start = () => { gLoad(); paint(); setInterval(paint, 2000); window.addEventListener("storage", paint); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
