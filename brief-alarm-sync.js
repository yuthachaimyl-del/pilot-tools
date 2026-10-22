// Crew Brief: "ปลุกอัตโนมัติบน iPhone" card (ตั้งเวลา tab).
// Makes a personal link that the Shortcut "CoolCrew Alarm Sync" reads twice a day to set iPhone alarms.
(() => {
  const FEED = "https://devbnbshwsibjupesywi.supabase.co/functions/v1/alarm-feed?t=";
  const H = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const sb = () => window.SB;
  // the plain link is kept on this device only (like the roster), so the setup steps stay usable; the server has just its hash
  const LS_KEY = "cb_alarm_link";
  let link = ""; try { link = localStorage.getItem(LS_KEY) || ""; } catch {}
  const keep = (v) => { link = v || ""; try { v ? localStorage.setItem(LS_KEY, v) : localStorage.removeItem(LS_KEY); } catch {} };

  const PROMPT = (url) => `Create a shortcut named CoolCrew Alarm Sync with exactly these actions, in this order, using only built-in Shortcuts actions. Do not use any AI model, Cloud model, or "Ask Each Time" anywhere.
1. Find Alarms where Label is CoolCrew.
2. If Alarms has any value: Delete Alarms (the found alarms). End If.
3. Get Contents of URL with this exact URL typed in as a fixed value: ${url}
4. Get Dictionary Value for key "alarms" in Contents of URL.
5. Repeat with each item in Dictionary Value: Create Alarm at Repeat Item with label CoolCrew. End Repeat.
6. Get Dictionary Value for key "summary" in Contents of URL.
7. Show Notification with the text from step 6.
No action may ask the user for input when the shortcut runs.`;

  const AUTO_TEXT = "Add an automation so this shortcut runs by itself every day at 08:00 and again at 20:00, run immediately without asking for confirmation";
  const STEPS = (url) => `
<style>
.alst{counter-reset:s;list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}
.alst li{position:relative;padding:10px 12px 10px 44px;border:1px solid var(--line);border-radius:12px;line-height:1.55}
.alst li::before{counter-increment:s;content:counter(s);position:absolute;left:12px;top:10px;width:24px;height:24px;border-radius:50%;background:var(--green);color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center}
.alst b{color:var(--ink)}
.alst .k{display:inline-block;border:1px solid var(--line);border-radius:6px;padding:0 6px;font-size:.92em;white-space:nowrap}
.alst .why{display:block;color:var(--muted);font-size:.9em;margin-top:4px}
.alst .ok{color:var(--green);font-weight:600}
</style>
<p class="small muted" style="margin:6px 0 0">ทำครั้งเดียว ประมาณ 3 นาที · ต้องการ iOS 17 ขึ้นไป · หน้าจอ Shortcuts รุ่นใหม่ <b>ไม่มีแท็บ Automation</b> ตั้งเวลาด้วยการพิมพ์บอกในข้อ 4</p>
<ol class="alst">
<li><b>สร้าง Shortcut</b><br>กดปุ่ม <span class="k">📋 คัดลอกคำสั่ง</span> ด้านล่าง → เปิดแอป <b>Shortcuts</b> → แตะ <span class="k">＋</span> → วางลงช่อง <b>Describe a shortcut</b> → ส่ง<span class="why">รอสักครู่ จะได้ Shortcut ชื่อ <b>CoolCrew Alarm Sync</b> · ถ้าขึ้นช่อง <b>Enter URL</b> ให้กด <a href="#" id="al_copyLink">คัดลอกลิงก์</a> แล้ววาง → Done</span></li>
<li><b>เช็คผล</b> แตะเปิดดู ต้องมี: Find Alarms → Delete → Get contents of <b>(มีลิงก์ยาวอยู่ในช่อง)</b> → Get Dictionary Value <b>alarms</b> → Repeat → Create Alarm <b>CoolCrew</b> → Show notification<span class="why">ถ้าเห็น <b>Use Cloud model</b> หรือ <b>Ask Each Time</b> = AI สร้างผิด ให้ลบ Shortcut ทิ้ง (กลับหน้ารวม → แตะค้าง → Delete) แล้วทำข้อ 1 ใหม่</span></li>
<li><b>ทดสอบ</b> กด <span class="k">▶</span> 1 ครั้ง → iPhone ถามสิทธิ์ ตอบ <b>Always Allow</b> และ <b>Delete Always</b><span class="why">ควรเด้งแจ้งเตือน "ตั้งปลุก …" หรือเด้งว่างๆ ถ้า 24 ชม. นี้ไม่มี duty · กลับมาหน้านี้กด <span class="k">🔍 ทดสอบลิงก์</span> สถานะด้านบนจะเปลี่ยนเป็น "ถูกเรียกล่าสุด …"</span></li>
<li><b>ตั้งให้รันเองทุกวัน</b> ในหน้า Shortcut แตะช่อง <b>Describe a change</b> ด้านล่าง → วางข้อความนี้ → ส่ง<br><div class="row" style="gap:8px;margin-top:6px;align-items:center"><button class="btn" type="button" id="al_copyAuto">📋 คัดลอกข้อความตั้งเวลา</button></div><span class="why">สำเร็จเมื่อหัวการ์ดขึ้นว่า <b class="ok">"When it is 08:00 or 20:00 daily"</b> · จบแล้ว ไม่ต้องกดอะไรอีก</span></li>
</ol>
<details class="more" style="margin-top:8px"><summary>ถ้า Shortcuts ของคุณยังมีแท็บ Automation (iOS รุ่นเก่ากว่า) ›</summary><div class="small" style="margin-top:6px;line-height:1.6">แท็บ <b>Automation</b> ด้านล่าง → ＋ → <b>Time of Day</b> → 08:00 · Daily → <b>Run Immediately</b> → เลือก CoolCrew Alarm Sync → Done · ทำซ้ำอีกอันที่ 20:00</div></details>
<details class="more" style="margin-top:6px"><summary>ถ้ารอบ 20:00 ไม่ทำงานตอนจอล็อก ›</summary><div class="small" style="margin-top:6px;line-height:1.6">เปิด Shortcut → <b>Edit</b> → <b>ⓘ</b> → <b>Privacy</b> → เปิด <b>Allow Running When Locked</b></div></details>
<div class="row" style="margin-top:10px;gap:8px"><button class="btn primary" type="button" id="al_copyPrompt">📋 คัดลอกคำสั่ง (ข้อ 1)</button><a class="btn" href="shortcuts://" rel="noopener">เปิด Shortcuts ↗</a><button class="btn" type="button" id="al_test">🔍 ทดสอบลิงก์</button></div>
<details class="more" style="margin-top:6px"><summary>ดูข้อความคำสั่ง ›</summary><textarea id="al_prompt" readonly rows="4" class="small" style="width:100%;margin-top:6px;font-family:var(--f-mono);font-size:11px">${H(PROMPT(url))}</textarea></details>`;

  function card() {
    let c = document.getElementById("al_card");
    if (c) return c;
    const host = document.querySelector("#p-settings");
    if (!host) return null;
    c = document.createElement("div"); c.id = "al_card"; c.className = "card";
    host.appendChild(c);
    c.addEventListener("click", onClick);
    return c;
  }

  async function status() {
    const u = sb(); if (!u) return null;
    const { data, error } = await u.rpc("alarm_token_status");
    if (error) throw error;
    return data;   // null when no link, else {created_at,last_used_at}
  }
  const statusLine = (st) => `<b style="color:var(--green)">● ลิงก์ส่วนตัวพร้อมใช้</b> · สร้าง ${when(st.created_at)} · ${st.last_used_at ? "iPhone เรียกล่าสุด " + when(st.last_used_at) : "iPhone ยังไม่เคยเรียก · ทำขั้นตอนด้านล่างให้ครบ"}`;
  const when = (s) => (s ? new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

  async function render(msg) {
    const c = card(); if (!c) return;
    let st = null, err = "";
    try { st = await status(); if (!st && link) keep(""); } catch (e) { err = String(e?.message || e); }

    c.innerHTML = `<h2>ปลุกอัตโนมัติบน iPhone</h2>
<p class="small" style="margin:0;line-height:1.6"><b>ไม่ต้องกดตั้งปลุกเองอีก</b> · iPhone จะดึงเวลาปลุกของ duty ถัดไปจากตารางของคุณเอง <b>ทุกวัน 08:00 และ 20:00</b> แล้วตั้งนาฬิกาปลุก (ตื่น + ปลุกซ้ำ) ให้ · วันไหนไม่มี duty จะลบปลุก CoolCrew ทิ้งเงียบๆ · เวลาคำนวณจากการ์ด "เวลาส่วนตัว" ด้านบน</p>
${err ? `<div class="note err small">${H(err)}</div>` : ""}
<div class="row" style="gap:8px;align-items:center">
<span class="small al_status">${st ? statusLine(st) : "<b>ยังไม่มีลิงก์ส่วนตัว</b>"}</span>
</div>
<div class="row" style="gap:8px">
<button class="btn primary" type="button" id="al_make">${st ? "🔄 สร้างลิงก์ใหม่ (ลิงก์เก่าใช้ไม่ได้ทันที)" : "🔗 สร้างลิงก์ส่วนตัว"}</button>
${st ? '<button class="btn ghost" type="button" id="al_revoke">ยกเลิกลิงก์</button>' : ""}
</div>
<div class="small" id="al_msg" style="min-height:1.2em">${msg || ""}</div>
${st && link ? `<details class="more" ${st.last_used_at ? "" : "open"}><summary><b>ขั้นตอนตั้งค่าบน iPhone</b> (ลิงก์ของคุณฝังในคำสั่งแล้ว ไม่ต้องคัดลอกแยก) ›</summary>${STEPS(FEED + link)}</details>`
      : st ? `<div class="note warn small">ลิงก์นี้ถูกสร้างจากเครื่องอื่น · ถ้าจะตั้ง Shortcut บนเครื่องนี้ ให้กด "สร้างลิงก์ใหม่" (เครื่องเก่าจะหยุดทำงาน)</div>` : ""}
<p class="small muted" style="margin:6px 0 0">ลิงก์นี้เปิดดูเวลาปลุกของคุณได้โดยไม่ต้องล็อกอิน อย่าส่งต่อ · ถ้าหลุด กดสร้างลิงก์ใหม่ ลิงก์เก่าจะใช้ไม่ได้ทันที · นาฬิกาปลุก iPhone ไม่มีวันที่ จึงตั้งล่วงหน้าได้ 24 ชม. และต้องรันทุกวัน</p>`;
  }

  async function onClick(e) {
    const t = e.target.closest("button, a#al_copyLink"); if (!t) return;
    if (t.id === "al_copyLink") e.preventDefault();
    const m = document.getElementById("al_msg");
    if (t.id === "al_make") {
      if (t.dataset.arm !== "1" && t.textContent.includes("ใหม่")) { t.dataset.arm = "1"; t.textContent = "ยืนยันสร้างลิงก์ใหม่"; setTimeout(() => { if (t.isConnected) { t.dataset.arm = ""; render(); } }, 4000); return; }
      t.disabled = true;
      try {
        const { data, error } = await sb().rpc("create_alarm_token");
        if (error) throw error;
        keep(data);
        await render('<span style="color:var(--green)">สร้างลิงก์แล้ว · ทำตามขั้นตอนด้านล่าง</span>');
      } catch (err) { t.disabled = false; if (m) m.innerHTML = `<span style="color:var(--red)">สร้างไม่ได้: ${H(err?.message || err)}</span>`; }
      return;
    }
    if (t.id === "al_revoke") {
      if (t.dataset.arm !== "1") { t.dataset.arm = "1"; t.textContent = "ยืนยันยกเลิก"; setTimeout(() => { if (t.isConnected) { t.dataset.arm = ""; t.textContent = "ยกเลิกลิงก์"; } }, 4000); return; }
      t.disabled = true;
      try { const { error } = await sb().rpc("revoke_alarm_token"); if (error) throw error; keep(""); await render("ยกเลิกลิงก์แล้ว · Shortcut บน iPhone จะหยุดตั้งปลุก (ลบ Automation ใน Shortcuts ด้วยถ้าไม่ใช้แล้ว)"); }
      catch (err) { t.disabled = false; if (m) m.innerHTML = `<span style="color:var(--red)">${H(err?.message || err)}</span>`; }
      return;
    }
    if (t.id === "al_test") {
      const o = document.getElementById("al_testOut"); t.disabled = true; o.textContent = "กำลังเรียก…";
      try {
        const r = await fetch(FEED + link, { cache: "no-store" }); const j = await r.json();
        o.innerHTML = j.ok ? (j.alarms.length ? `<span style="color:var(--green)">✓ ลิงก์ใช้ได้ · ${H(j.summary)}<br>iPhone จะตั้งปลุก: <b class="mono">${j.alarms.map((a) => a.slice(11, 16)).join(", ")}</b></span>` : '<span style="color:var(--green)">✓ ลิงก์ใช้ได้</span> · ไม่มี duty ใน 24 ชม. ข้างหน้า จึงไม่มีปลุก (Shortcut จะลบปลุก CoolCrew เก่าทิ้ง)') : `<span style="color:var(--red)">${H(j.message || "error")}</span>`;
      } catch (e) { o.innerHTML = `<span style="color:var(--red)">เรียกไม่ได้: ${H(e?.message || e)}</span>`; }
      t.disabled = false;
      const st = await status().catch(() => null); const line = card().querySelector(".al_status"); if (line && st) line.innerHTML = statusLine(st);
      return;
    }
    if (t.id === "al_copyLink") {
      const v = FEED + link, ok = () => { t.textContent = "✓ คัดลอกแล้ว"; setTimeout(() => (t.textContent = "คัดลอกลิงก์"), 2500); };
      try { await navigator.clipboard.writeText(v); ok(); } catch { const ta = document.createElement("textarea"); ta.value = v; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); ok(); }
      return;
    }
    if (t.id === "al_copyAuto") {
      const ok = () => { t.textContent = "✓ คัดลอกแล้ว ไปวางใน Describe a change"; setTimeout(() => (t.textContent = "📋 คัดลอกข้อความตั้งเวลา"), 3000); };
      try { await navigator.clipboard.writeText(AUTO_TEXT); ok(); } catch { const ta = document.createElement("textarea"); ta.value = AUTO_TEXT; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); ok(); }
      return;
    }
    if (t.id === "al_copyPrompt") {
      const ta = document.getElementById("al_prompt"); const ok = () => { t.textContent = "✓ คัดลอกแล้ว"; setTimeout(() => (t.textContent = "📋 คัดลอกคำสั่ง"), 2500); };
      try { await navigator.clipboard.writeText(ta.value); ok(); } catch { ta.select(); document.execCommand("copy"); ok(); }
    }
  }

  function init() {
    if (!sb()) { setTimeout(init, 500); return; }   // supa.js loads first; SB appears once config is read
    render();
    document.querySelector('[data-tab="settings"]')?.addEventListener("click", () => render());
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
