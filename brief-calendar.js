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
      const ic = d.type === "FLT" ? "✈" : d.type === "SIM" ? "🎓" : "⏳";
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
    return `shortcuts://x-callback-url/run-shortcut?name=${encodeURIComponent(NAME)}&input=text&text=${encodeURIComponent(text)}&x-success=${encodeURIComponent(back)}`;
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
#calSetup .done{border-color:var(--green)!important}`;
  let flashMsg = "", flashT = 0;
  const flash = (m) => { flashMsg = m; clearTimeout(flashT); flashT = setTimeout(() => { flashMsg = ""; paint(); }, 5000); paint(); };
  function barHtml(s) {
    if (s.empty) return "";
    const rng = s.p.range.length ? `${fmtDay(s.p.range[0])} – ${fmtDay(s.p.range[1])}` : "";
    const st = !s.setup ? "ยังไม่ได้ตั้งค่า · ตั้งครั้งเดียวในเมนูตั้งเวลา"
      : s.sync ? (s.changed ? `⚠ ตารางเปลี่ยนหลังอัปเดตปฏิทินครั้งล่าสุด (${when(s.sync.at)})` : `✓ ปฏิทินตรงกับตาราง · อัปเดตล่าสุด ${when(s.sync.at)}`)
      : "ยังไม่เคยอัปเดตปฏิทิน";
    return `<div class="row"><b style="font-size:.92rem">📅 ปฏิทิน iPhone</b><button class="btn ${s.setup && (s.changed || !s.sync) ? "primary" : ""} small" type="button" data-cal="${s.setup ? "send" : "setup"}">${s.setup ? "อัปเดตปฏิทิน iPhone" : "ตั้งค่าปฏิทิน iPhone"}</button></div>
<div class="st">${H(flashMsg || st)}${!flashMsg && s.setup ? ` · ${s.p.events.length} duty${rng ? " · " + rng : ""} · ลบของเดิมช่วงนี้ในปฏิทิน CoolCrew ก่อนใส่ใหม่` : ""}</div>`;
  }
  function placeBar(id, anchor, where) {
    if (!anchor) return;
    let b = $(id);
    if (!b) { b = document.createElement("div"); b.id = id; b.className = "calbar"; anchor.insertAdjacentElement(where, b); }
    const s = state(), h = barHtml(s);
    b.hidden = !h; b.classList.toggle("hot", !!(s.setup && s.changed));
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
    const h = `<h2>ปฏิทิน iPhone</h2>
<p class="small" style="margin:0;line-height:1.6">ส่งตารางบินเข้าแอป <b>ปฏิทิน</b> บน iPhone <b>เฉพาะตอนคุณกด "อัปเดตปฏิทิน iPhone"</b> (หลังใส่ roster หรือที่แท็บตาราง) · ทุกครั้งที่อัปเดต จะลบ event เดิมของ CoolCrew ในช่วงวันที่ของตารางก่อน แล้วใส่ใหม่ ไม่มีซ้ำ · ไม่แตะปฏิทินอื่นและนัดส่วนตัว</p>
${isIOS() ? "" : '<div class="note warn small">ใช้ได้บน iPhone / iPad เท่านั้น · เปิดหน้านี้บน iPhone เพื่อตั้งค่า</div>'}
<ol class="alst">
<li><b>สร้างปฏิทินชื่อ ${CAL}</b><br>เปิดแอป <b>ปฏิทิน</b> → <span class="k">ปฏิทิน</span> ด้านล่าง → <span class="k">เพิ่มปฏิทิน</span> → ตั้งชื่อ <b>${CAL}</b> (ตัวพิมพ์ตามนี้) → เสร็จสิ้น<span class="why">event ของ CoolCrew จะอยู่ในปฏิทินนี้เท่านั้น ซ่อน/เปลี่ยนสีได้</span></li>
<li><b>สร้าง Shortcut</b><br>กด <button class="btn primary ib" type="button" data-cal="copy">📋 คัดลอกคำสั่ง</button> → <a class="btn ib" href="shortcuts://" rel="noopener">เปิด Shortcuts ↗</a> → แตะ <span class="k">＋</span> → วางลงช่อง <b>Describe a shortcut</b> → ส่ง<span class="why">ต้องได้ชื่อ <b>${NAME}</b> ตรงตัว · เช็คว่ามี Find Calendar Events → Remove Events → Repeat → Add New Event ในปฏิทิน ${CAL}</span></li>
<li><b>ทดสอบ</b> <button class="btn ib" type="button" data-cal="test">ส่ง event ทดสอบ</button><span class="why">iPhone จะถามสิทธิ์ปฏิทิน ตอบ <b>อนุญาตเสมอ</b> · ควรเห็น "✈ CoolCrew test" ในอีก 1 ชม. ข้างหน้า (ลบเองได้) · ถ้าถาม "Remove events?" ให้ตอบ <b>Always Allow</b></span></li>
<li class="${setup ? "done" : ""}"><b>${setup ? "✓ ตั้งค่าแล้ว" : "ใช้ได้แล้ว?"}</b> <button class="btn ${setup ? "ghost" : "primary"} ib" type="button" data-cal="${setup ? "unsetup" : "ok"}">${setup ? "ยกเลิกการตั้งค่า" : "✓ เห็น event ทดสอบแล้ว"}</button><span class="why">จากนั้นกด <b>อัปเดตปฏิทิน iPhone</b> ที่แท็บตารางได้เลย</span></li>
</ol>
${setup ? `<div class="row" style="margin-top:8px"><button class="btn primary" type="button" data-cal="send">📅 อัปเดตปฏิทิน iPhone ตอนนี้</button></div>` : ""}
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
    const a = t.dataset.cal;
    if (a === "send") send(false);
    else if (a === "test") send(true);
    else if (a === "copy") copy(t, PROMPT);
    else if (a === "ok") { set(LS_SETUP, { at: Date.now() }); paint(); }
    else if (a === "unsetup") { set(LS_SETUP, null); set(LS_SYNC, null); paint(); }
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
  try { const u = new URL(location.href); if (u.searchParams.get("cal") === "ok") { u.searchParams.delete("cal"); history.replaceState(null, "", u.pathname + u.search + u.hash); flash("✓ อัปเดตปฏิทิน iPhone แล้ว"); } } catch {}
  const start = () => { paint(); setInterval(paint, 2000); window.addEventListener("storage", paint); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
