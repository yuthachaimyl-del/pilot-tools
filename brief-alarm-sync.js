// Crew Brief: "ปลุกอัตโนมัติบน iPhone" card (ตั้งเวลา tab).
// Makes a personal link that the Shortcut "CoolCrew Alarm Sync" reads twice a day to set iPhone alarms.
(() => {
  const FEED = "https://devbnbshwsibjupesywi.supabase.co/functions/v1/alarm-feed?t=";
  const H = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const sb = () => window.SB;
  let link = sessionStorage.getItem("cb_alarm_link") || "";   // shown once; kept for this tab session only

  const PROMPT = (url) => `Name it CoolCrew Alarm Sync. Do these steps in order and never ask me anything:
1. Find all alarms whose label is CoolCrew, then delete those alarms.
2. Get the contents of this URL as JSON: ${url}
3. If the "ok" field is not true, show a notification with the "message" field and stop.
4. Repeat with each item in the "alarms" list: create an alarm at that time with the label CoolCrew (the item is a date-time string; use only its time of day).
5. If the "summary" field is not empty, show a notification with the "summary" text; otherwise show a notification saying "CoolCrew: พรุ่งนี้ไม่มีปลุก".`;

  const STEPS = (url) => `
<ol class="small" style="margin:6px 0 0;padding-left:20px;line-height:1.7">
<li>กด <b>คัดลอกคำสั่ง</b> ด้านล่าง → เปิดแอป <b>Shortcuts</b> → แตะ <b>＋</b> → วางในช่อง <b>Describe a shortcut</b> แล้วส่ง<br><span class="muted">iOS 17 ขึ้นไป · ถ้าไม่มีช่องนี้ ให้สร้างเอง: Find Alarms (label is CoolCrew) → Delete Alarms → Get Contents of URL → Get Dictionary Value "alarms" → Repeat: Create Alarm (label CoolCrew)</span></li>
<li>เช็กว่าชื่อเป็น <b>CoolCrew Alarm Sync</b> แล้วกด <b>▶ ทดสอบ</b> 1 ครั้ง · iPhone จะถามสิทธิ์ ให้ตอบ <b>Always Allow</b> / <b>Delete Always</b></li>
<li>ให้รันเองทุกวัน: แท็บ <b>Automation</b> → <b>＋</b> → <b>Time of Day</b> → ตั้ง <b>08:00</b> · Daily → เลือก <b>Run Immediately</b> (ปิด Ask Before Running) → เลือก shortcut <b>CoolCrew Alarm Sync</b> → Done</li>
<li>ทำข้อ 3 ซ้ำอีกครั้งที่ <b>20:00</b> (รอบเย็นจับตารางที่เพิ่งเปลี่ยนในวันนั้น)</li>
</ol>
<div class="row" style="margin-top:8px;gap:8px"><button class="btn" type="button" id="al_copyPrompt">📋 คัดลอกคำสั่ง</button><a class="btn" href="shortcuts://" rel="noopener">เปิด Shortcuts ↗</a></div>
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
  const when = (s) => (s ? new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

  async function render(msg) {
    const c = card(); if (!c) return;
    let st = null, err = "";
    try { st = await status(); } catch (e) { err = String(e?.message || e); }
    const used = st?.last_used_at ? `ใช้ล่าสุด ${when(st.last_used_at)}` : st ? "ยังไม่เคยถูกเรียก · ทำข้อ 1–2 ด้านล่างให้เสร็จ" : "";
    c.innerHTML = `<h2>ปลุกอัตโนมัติบน iPhone</h2>
<p class="small muted" style="margin:0">Shortcut บน iPhone จะดึงเวลาปลุกของ duty ถัดไป (ตื่น + ปลุกซ้ำ) จากตารางของคุณวันละ 2 รอบ แล้วตั้งนาฬิกาปลุกให้เอง · วันที่ไม่มี duty จะลบปลุก CoolCrew ทิ้งเงียบๆ · ใช้ค่าในการ์ด "เวลาส่วนตัว" ด้านบน</p>
${err ? `<div class="note err small">${H(err)}</div>` : ""}
<div class="row" style="gap:8px;align-items:center">
<span class="small">${st ? `<b style="color:var(--green)">● ลิงก์ส่วนตัวพร้อมใช้</b> · สร้าง ${when(st.created_at)} · ${used}` : "<b>ยังไม่มีลิงก์ส่วนตัว</b>"}</span>
</div>
<div class="row" style="gap:8px">
<button class="btn primary" type="button" id="al_make">${st ? "🔄 สร้างลิงก์ใหม่ (ลิงก์เก่าใช้ไม่ได้ทันที)" : "🔗 สร้างลิงก์ส่วนตัว"}</button>
${st ? '<button class="btn ghost" type="button" id="al_revoke">ยกเลิกลิงก์</button>' : ""}
</div>
<div class="small" id="al_msg" style="min-height:1.2em">${msg || ""}</div>
${link ? `<div class="note ok small" style="word-break:break-all"><b>ลิงก์ของคุณ</b> (แสดงครั้งเดียว · อยู่ในคำสั่งด้านล่างแล้ว ไม่ต้องคัดลอกแยก)<br><span class="mono">${H(FEED + link)}</span></div>${STEPS(FEED + link)}`
      : st ? `<details class="more"><summary>วิธีตั้งค่า Shortcut (ต้องมีลิงก์เต็ม · ถ้าไม่ได้เก็บไว้ ให้กดสร้างลิงก์ใหม่แล้วทำตามขั้นตอน) ›</summary>${STEPS(FEED + "<ลิงก์ของคุณ>")}</details>` : ""}
<p class="small muted" style="margin:6px 0 0">ลิงก์นี้เปิดดูเวลาปลุกของคุณได้โดยไม่ต้องล็อกอิน อย่าส่งต่อ · ถ้าหลุด กดสร้างลิงก์ใหม่ ลิงก์เก่าจะใช้ไม่ได้ทันที · นาฬิกาปลุก iPhone ไม่มีวันที่ จึงตั้งล่วงหน้าได้ 24 ชม. และต้องรันทุกวัน</p>`;
  }

  async function onClick(e) {
    const t = e.target.closest("button"); if (!t) return;
    const m = document.getElementById("al_msg");
    if (t.id === "al_make") {
      if (t.dataset.arm !== "1" && t.textContent.includes("ใหม่")) { t.dataset.arm = "1"; t.textContent = "ยืนยันสร้างลิงก์ใหม่"; setTimeout(() => { if (t.isConnected) { t.dataset.arm = ""; render(); } }, 4000); return; }
      t.disabled = true;
      try {
        const { data, error } = await sb().rpc("create_alarm_token");
        if (error) throw error;
        link = data; sessionStorage.setItem("cb_alarm_link", link);
        await render('<span style="color:var(--green)">สร้างลิงก์แล้ว · ทำตามขั้นตอนด้านล่าง</span>');
      } catch (err) { t.disabled = false; if (m) m.innerHTML = `<span style="color:var(--red)">สร้างไม่ได้: ${H(err?.message || err)}</span>`; }
      return;
    }
    if (t.id === "al_revoke") {
      if (t.dataset.arm !== "1") { t.dataset.arm = "1"; t.textContent = "ยืนยันยกเลิก"; setTimeout(() => { if (t.isConnected) { t.dataset.arm = ""; t.textContent = "ยกเลิกลิงก์"; } }, 4000); return; }
      t.disabled = true;
      try { const { error } = await sb().rpc("revoke_alarm_token"); if (error) throw error; link = ""; sessionStorage.removeItem("cb_alarm_link"); await render("ยกเลิกลิงก์แล้ว · Shortcut บน iPhone จะหยุดตั้งปลุก (ลบ Automation ใน Shortcuts ด้วยถ้าไม่ใช้แล้ว)"); }
      catch (err) { t.disabled = false; if (m) m.innerHTML = `<span style="color:var(--red)">${H(err?.message || err)}</span>`; }
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
