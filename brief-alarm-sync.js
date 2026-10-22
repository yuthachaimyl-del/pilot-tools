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

  const STEPS = (url) => `
<ol class="small" style="margin:6px 0 0;padding-left:20px;line-height:1.7">
<li>กด <b>คัดลอกคำสั่ง</b> ด้านล่าง → เปิดแอป <b>Shortcuts</b> → แตะ <b>＋</b> → วางในช่อง <b>Describe a shortcut</b> แล้วส่ง<br><span class="muted">ถ้า Shortcuts ถาม <b>Enter URL</b>: <a href="#" id="al_copyLink">คัดลอกลิงก์</a> แล้ววาง → Done · ถ้าผลที่ได้มีขั้น "Use Cloud model" หรือ "Ask Each Time" ให้ลบ shortcut นั้นทิ้ง (แตะค้าง → Delete) แล้วสั่งใหม่ด้วยคำสั่งเดิม · iOS 17 ขึ้นไป</span></li>
<li>เช็กว่าชื่อเป็น <b>CoolCrew Alarm Sync</b> แล้วกด <b>▶ ทดสอบ</b> 1 ครั้ง · iPhone จะถามสิทธิ์ ให้ตอบ <b>Always Allow</b> / <b>Delete Always</b></li>
<li>ให้รันเองทุกวัน: แท็บ <b>Automation</b> → <b>＋</b> → <b>Time of Day</b> → ตั้ง <b>08:00</b> · Daily → เลือก <b>Run Immediately</b> (ปิด Ask Before Running) → เลือก shortcut <b>CoolCrew Alarm Sync</b> → Done</li>
<li>ทำข้อ 3 ซ้ำอีกครั้งที่ <b>20:00</b> (รอบเย็นจับตารางที่เพิ่งเปลี่ยนในวันนั้น)</li>
</ol>
<div class="row" style="margin-top:8px;gap:8px"><button class="btn primary" type="button" id="al_copyPrompt">📋 คัดลอกคำสั่ง</button><a class="btn" href="shortcuts://" rel="noopener">เปิด Shortcuts ↗</a><button class="btn" type="button" id="al_test">🔍 ทดสอบลิงก์</button></div><div class="small" id="al_testOut"></div>
<textarea id="al_prompt" readonly rows="4" class="small" style="width:100%;margin-top:6px;font-family:var(--f-mono);font-size:12px">${H(PROMPT(url))}</textarea>`;

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
  const statusLine = (st) => `<b style="color:var(--green)">● ลิงก์ส่วนตัวพร้อมใช้</b> · สร้าง ${when(st.created_at)} · ${st.last_used_at ? "ถูกเรียกล่าสุด " + when(st.last_used_at) : "ยังไม่เคยถูกเรียก · ทำข้อ 1–2 ด้านล่างให้เสร็จ"}`;
  const when = (s) => (s ? new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

  async function render(msg) {
    const c = card(); if (!c) return;
    let st = null, err = "";
    try { st = await status(); if (!st && link) keep(""); } catch (e) { err = String(e?.message || e); }

    c.innerHTML = `<h2>ปลุกอัตโนมัติบน iPhone</h2>
<p class="small muted" style="margin:0">Shortcut บน iPhone จะดึงเวลาปลุกของ duty ถัดไป (ตื่น + ปลุกซ้ำ) จากตารางของคุณวันละ 2 รอบ แล้วตั้งนาฬิกาปลุกให้เอง · วันที่ไม่มี duty จะลบปลุก CoolCrew ทิ้งเงียบๆ · ใช้ค่าในการ์ด "เวลาส่วนตัว" ด้านบน</p>
${err ? `<div class="note err small">${H(err)}</div>` : ""}
<div class="row" style="gap:8px;align-items:center">
<span class="small al_status">${st ? statusLine(st) : "<b>ยังไม่มีลิงก์ส่วนตัว</b>"}</span>
</div>
<div class="row" style="gap:8px">
<button class="btn primary" type="button" id="al_make">${st ? "🔄 สร้างลิงก์ใหม่ (ลิงก์เก่าใช้ไม่ได้ทันที)" : "🔗 สร้างลิงก์ส่วนตัว"}</button>
${st ? '<button class="btn ghost" type="button" id="al_revoke">ยกเลิกลิงก์</button>' : ""}
</div>
<div class="small" id="al_msg" style="min-height:1.2em">${msg || ""}</div>
${st && link ? `<details class="more" ${st.last_used_at ? "" : "open"}><summary>วิธีตั้งค่า Shortcut บน iPhone (ลิงก์ของคุณอยู่ในคำสั่งแล้ว) ›</summary>${STEPS(FEED + link)}</details>`
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
