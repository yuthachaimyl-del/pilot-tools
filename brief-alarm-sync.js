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
  const STYLE = `<style>
.alst{counter-reset:s;list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}
.alst li{position:relative;padding:10px 12px 10px 44px;border:1px solid var(--line);border-radius:12px;line-height:1.55}
.alst li::before{counter-increment:s;content:counter(s);position:absolute;left:12px;top:10px;width:24px;height:24px;border-radius:50%;background:var(--green);color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center}
.alst b{color:var(--ink)}
.alst .k{display:inline-block;border:1px solid var(--line);border-radius:6px;padding:0 6px;font-size:.92em;white-space:nowrap}
.alst .why{display:block;color:var(--muted);font-size:.9em;margin-top:4px}
.alst .ok{color:var(--green);font-weight:600}
.alst li.done{border-color:var(--green)}
.alst li.done::before{content:"✓"}
.alst li.dim{opacity:.45}
.alst .seq{line-height:2.1}
.alst .btn.ib{display:inline-block;vertical-align:middle;padding:4px 12px;margin:2px 0;font-size:.95em}
</style>`;
  const STEPS = (url) => `
<li><b>สร้าง Shortcut</b><br><span class="seq">กด <button class="btn primary ib" type="button" id="al_copyPrompt">📋 คัดลอกคำสั่ง</button> → <a class="btn ib" href="shortcuts://" rel="noopener">เปิด Shortcuts ↗</a> → แตะ <span class="k">＋</span> → วางลงช่อง <b>Describe a shortcut</b> → ส่ง</span><span class="why">รอสักครู่ จะได้ Shortcut ชื่อ <b>CoolCrew Alarm Sync</b> · ถ้าขึ้นช่อง <b>Enter URL</b> ให้กด <a href="#" id="al_copyLink">คัดลอกลิงก์</a> แล้ววาง → Done</span></li>
<li><b>เช็คผล</b> แตะเปิดดู ต้องมี: Find Alarms → Delete → Get contents of <b>(มีลิงก์ยาวอยู่ในช่อง)</b> → Get Dictionary Value <b>alarms</b> → Repeat → Create Alarm <b>CoolCrew</b> → Show notification<span class="why">ถ้าเห็น <b>Use Cloud model</b> หรือ <b>Ask Each Time</b> = AI สร้างผิด ให้ลบ Shortcut ทิ้ง (กลับหน้ารวม → แตะค้าง → Delete) แล้วทำข้อ 2 ใหม่</span></li>
<li><b>ทดสอบ</b> ใน Shortcuts กด <span class="k">▶</span> 1 ครั้ง → iPhone ถามสิทธิ์ ตอบ <b>Always Allow</b> และ <b>Delete Always</b><span class="why">ควรเด้งแจ้งเตือน "ตั้งปลุก …" หรือเด้งว่างๆ ถ้า 24 ชม. นี้ไม่มี duty</span><span class="seq" style="display:block;margin-top:8px">แล้วกลับมากด <button class="btn ib" type="button" id="al_test">🔍 ทดสอบลิงก์</button> ที่นี่ สถานะด้านบนจะเปลี่ยนเป็น "iPhone เรียกล่าสุด …"</span><div class="small" id="al_testOut"></div></li>
<li><b>ตั้งให้รันเองทุกวัน</b><br><span class="seq">กด <button class="btn primary ib" type="button" id="al_copyAuto">📋 คัดลอกข้อความตั้งเวลา</button> → ในหน้า Shortcut แตะช่อง <b>Describe a change</b> ด้านล่าง → วาง → ส่ง</span><span class="why">สำเร็จเมื่อหัวการ์ดขึ้นว่า <b class="ok">"When it is 08:00 or 20:00 daily"</b> · จบแล้ว ไม่ต้องกดอะไรอีก</span></li>
`;

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
    const ready = !!(st && link);   // link made on this device: the steps can be followed
    const step0 = st
      ? (link ? `<li class="done"><b>ลิงก์ส่วนตัวของคุณพร้อมแล้ว</b> <span class="why">สร้าง ${when(st.created_at)} · ${st.last_used_at ? "iPhone เรียกล่าสุด " + when(st.last_used_at) : "iPhone ยังไม่เคยเรียก"}</span></li>`
              : `<li><b>ลิงก์นี้ถูกสร้างจากเครื่องอื่น</b><br><span class="seq">ถ้าจะตั้งบนเครื่องนี้ กด <button class="btn primary ib" type="button" id="al_make">🔗 สร้างลิงก์ใหม่</button></span><span class="why">Shortcut ที่ตั้งไว้บนเครื่องอื่นจะหยุดทำงาน</span></li>`)
      : `<li><b>สร้างลิงก์ส่วนตัว</b><br><span class="seq">กด <button class="btn primary ib" type="button" id="al_make">🔗 สร้างลิงก์ส่วนตัว</button></span><span class="why">ลิงก์นี้คือกุญแจให้ iPhone อ่านเวลาปลุกของคุณ (ไม่ต้องล็อกอิน) จะถูกฝังในคำสั่งข้อถัดไปให้เอง</span></li>`;
    const rest = ready ? STEPS(FEED + link) : `<li class="dim"><b>สร้าง Shortcut</b> <span class="why">ทำข้อก่อนหน้าให้เสร็จก่อน</span></li><li class="dim"><b>เช็คผล</b></li><li class="dim"><b>ทดสอบ</b></li><li class="dim"><b>ตั้งให้รันเองทุกวัน</b></li>`;
    c.innerHTML = `<h2>ปลุกอัตโนมัติบน iPhone</h2>
<p class="small" style="margin:0;line-height:1.6"><b>ไม่ต้องกดตั้งปลุกเองอีก</b> · iPhone ดึงเวลาปลุกของ duty ถัดไปจากตารางคุณ <b>ทุกวัน 08:00 และ 20:00</b> แล้วตั้งนาฬิกาปลุกให้ (ตื่น + ปลุกซ้ำ ตามค่าในการ์ด "เวลาส่วนตัว") · ทำครั้งเดียว ~3 นาที · iOS 17 ขึ้นไป</p>
${err ? `<div class="note err small">${H(err)}</div>` : ""}
<div class="small" id="al_msg" style="min-height:1.2em">${msg || ""}</div>
${STYLE}
<ol class="alst">${step0}${rest}</ol>
${st ? `<details class="more" style="margin-top:8px"><summary>อื่นๆ: สร้างลิงก์ใหม่ / ยกเลิก / iOS รุ่นเก่า / จอล็อก ›</summary>
<div class="small" style="margin-top:6px;line-height:1.7">
<div><b>ลิงก์หลุดหรือเปลี่ยนเครื่อง:</b> <button class="btn ghost ib" type="button" id="al_make2">🔄 สร้างลิงก์ใหม่</button> ลิงก์เก่าใช้ไม่ได้ทันที ต้องทำข้อ 2–5 ใหม่</div>
<div><b>เลิกใช้:</b> <button class="btn ghost ib" type="button" id="al_revoke">ยกเลิกลิงก์</button> แล้วลบ Shortcut ใน iPhone ด้วย</div>
<div><b>iOS รุ่นเก่าที่ยังมีแท็บ Automation:</b> Automation → ＋ → Time of Day 08:00 Daily → Run Immediately → เลือก CoolCrew Alarm Sync → ทำซ้ำที่ 20:00</div>
<div><b>รอบ 20:00 ไม่ทำงานตอนจอล็อก:</b> เปิด Shortcut → Edit → ⓘ → Privacy → เปิด Allow Running When Locked</div>
${ready ? `<div><b>ข้อความคำสั่ง (ข้อ 2):</b><textarea id="al_prompt" readonly rows="3" style="width:100%;margin-top:4px;font-family:var(--f-mono);font-size:11px">${H(PROMPT(FEED + link))}</textarea></div>` : ""}
</div></details>` : ""}
<p class="small muted" style="margin:6px 0 0">ลิงก์เปิดดูเวลาปลุกของคุณได้โดยไม่ต้องล็อกอิน อย่าส่งต่อ · นาฬิกาปลุก iPhone ไม่มีวันที่ จึงตั้งล่วงหน้าได้ 24 ชม. และต้องรันทุกวัน</p>`;
  }

  async function onClick(e) {
    const t = e.target.closest("button, a#al_copyLink"); if (!t) return;
    if (t.id === "al_copyLink") e.preventDefault();
    const m = document.getElementById("al_msg");
    if (t.id === "al_make" || t.id === "al_make2") {
      if (t.dataset.arm !== "1" && /ใหม่/.test(t.textContent)) { t.dataset.arm = "1"; t.textContent = "⚠️ Shortcut ที่ตั้งไว้จะหยุดทำงาน ต้องทำข้อ 2–5 ใหม่ · กดอีกครั้งเพื่อยืนยัน"; setTimeout(() => { if (t.isConnected) { t.dataset.arm = ""; render(); } }, 6000); return; }
      t.disabled = true;
      const hadLink = !!(await status().catch(() => null));
      try {
        const { data, error } = await sb().rpc("create_alarm_token");
        if (error) throw error;
        keep(data);
        await render('<span style="color:var(--green)">สร้างลิงก์แล้ว · ทำตามขั้นตอนด้านล่าง</span>' + (hadLink ? ' <span style="color:var(--amber)">· Shortcut เดิมใช้ลิงก์เก่าแล้วจะไม่ทำงาน ให้ลบ Shortcut เดิมใน iPhone แล้วทำข้อ 2–5 ใหม่</span>' : ""));
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
      const out = document.getElementById("al_testOut")?.innerHTML || ""; await render(); const o2 = document.getElementById("al_testOut"); if (o2) o2.innerHTML = out;
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
      const v = PROMPT(FEED + link), ok = () => { t.textContent = "✓ คัดลอกแล้ว"; setTimeout(() => (t.textContent = "📋 คัดลอกคำสั่ง"), 2500); };
      try { await navigator.clipboard.writeText(v); ok(); } catch { const ta = document.createElement("textarea"); ta.value = v; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); ok(); }
    }
  }

  function init() {
    if (!sb()) { setTimeout(init, 500); return; }   // supa.js loads first; SB appears once config is read
    render();
    document.querySelector('[data-tab="settings"]')?.addEventListener("click", () => render());
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
