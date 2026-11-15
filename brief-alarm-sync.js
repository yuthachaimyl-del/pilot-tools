// Crew Brief: "ปลุกอัตโนมัติบน iPhone" card (ตั้งเวลา tab).
// Makes a personal link that the Shortcut "CoolCrew Alarm Sync" reads twice a day to set iPhone alarms.
(() => {
  const FEED = (window.FO_CONFIG?.SUPABASE_URL || "https://devbnbshwsibjupesywi.supabase.co") + "/functions/v1/alarm-feed?t=";
  // iCloud link of the ready-made "CoolCrew Alarm Sync" (asks for the personal link on install). Empty = use the Describe-a-shortcut path only.
  const SC_LINK = "https://www.icloud.com/shortcuts/60dcc6c5ef4c459da4eabc74240f4593";
  const H = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const sb = () => window.SB;
  // the plain link is kept on this device only (like the roster), so the setup steps stay usable; the server has just its hash
  const LS_KEY = "cb_alarm_link";
  let link = ""; try { link = localStorage.getItem(LS_KEY) || ""; } catch {}
  const keep = (v) => { link = v || ""; try { v ? localStorage.setItem(LS_KEY, v) : localStorage.removeItem(LS_KEY); } catch {} };

  const PROMPT = (url) => `Create a shortcut named exactly "CoolCrew Alarm Sync".
Use only these built-in Shortcuts actions, with these exact names, in this exact order, and nothing else:
1. "Find Alarms" with filter: Label is "CoolCrew".
2. "If" Alarms has any value: "Delete Alarms" using the Alarms from step 1. "End If".
3. "Get Contents of URL" with the URL typed in as a fixed text value (not a variable, not "Ask Each Time"): ${url}
4. "Get Dictionary Value" for key "alarms" in Contents of URL.
5. "Repeat with Each" item in Dictionary Value: "Create Alarm" at Repeat Item, with label "CoolCrew". "End Repeat".
6. "Get Dictionary Value" for key "summary" in Contents of URL.
7. "Show Notification" with the Dictionary Value from step 6.
Rules: do not add, remove, rename or reorder any action. Do not use "Use Model", "Cloud model", "Ask for Input", "Ask Each Time", or any AI, text-parsing, or variable-setting action. Nothing may ask the user anything when it runs.
Then add a personal automation for this shortcut: trigger "Time of Day", 08:00, repeat Daily, "Run Immediately" (not "Run After Confirmation"), notify when run off; and a second identical automation at 20:00.`;

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
  const AI_STEP = `<li><b>สร้าง Shortcut</b><br><span class="seq">กด <button class="btn primary ib" type="button" id="al_copyPrompt">📋 คัดลอกคำสั่ง</button> → <a class="btn ib" href="shortcuts://" rel="noopener">เปิด Shortcuts ↗</a> → แตะ <span class="k">＋</span> → วางลงช่อง <b>Describe a shortcut</b> → ส่ง</span><span class="why">รอสักครู่ จะได้ Shortcut ชื่อ <b>CoolCrew Alarm Sync</b> และหัวการ์ดขึ้น <b class="ok">"When it is 08:00 or 20:00 daily"</b> = ตั้งเวลาให้แล้ว · ถ้าขึ้นช่อง <b>Enter URL</b> ให้กด <a href="#" id="al_copyLink">คัดลอกลิงก์</a> แล้ววาง → Done</span></li>`;
  const EASY_STEPS = `
<li><b>คัดลอกลิงก์ของคุณ</b><br><span class="seq"><button class="btn primary ib" type="button" id="al_copyMine">📋 คัดลอกลิงก์ของฉัน</button></span><span class="why">ลิงก์นี้เป็นของบัญชีคุณ ใช้ดึงเวลาปลุกของคุณเอง</span></li>
<li><b>ติดตั้ง Shortcut</b><br><span class="seq"><a class="btn primary ib" href="${SC_LINK}" target="_blank" rel="noopener">⬇ ติดตั้ง Shortcut</a></span><span class="why">iPhone จะถามให้ใส่ลิงก์ → แตะช่อง → <b>วาง</b> → กด <b>Add Shortcut</b> (เพิ่มคำสั่งลัด)</span></li>
<li><b>ตั้งให้ทำงานเองทุกวัน</b><span class="why" style="color:var(--ink)">ในแอป Shortcuts:<br>• <b>iOS 26 หรือต่ำกว่า:</b> แท็บ <b>Automation</b> → ＋ → <b>Time of Day</b> → 08:00 · Daily → เลือก <b>Run Immediately</b> → Next → เลือก <b>CoolCrew Alarm Sync</b> → ทำซ้ำอีกอันที่ 20:00<br>• <b>iOS 27:</b> Shortcut นี้มีเวลา 08:00 และ 20:00 ใส่ไว้แล้ว → เปิด <b>CoolCrew Alarm Sync</b> → <b>Editor</b> → ถ้าการ์ด <b>At 08:00 / At 20:00</b> ขึ้น <b>Automation is turned off</b> ให้แตะเปิดทั้งสองอัน</span></li>`;
  const STEPS = (url) => `
${SC_LINK ? EASY_STEPS : AI_STEP}
${SC_LINK ? "" : `<li><b>เช็คผล</b> แตะเปิดดู ต้องมี: Find Alarms → Delete → Get contents of <b>(มีลิงก์ยาวอยู่ในช่อง)</b> → Get Dictionary Value <b>alarms</b> → Repeat → Create Alarm <b>CoolCrew</b> → Show notification<span class="why">ถ้าเห็น <b>Use Cloud model</b> หรือ <b>Ask Each Time</b> = AI สร้างผิด ให้ลบ Shortcut ทิ้ง (กลับหน้ารวม → แตะค้าง → Delete) แล้วทำข้อ 2 ใหม่</span></li>`}
<li><b>ทดสอบ</b> ใน Shortcuts กด <span class="k">▶</span> 1 ครั้ง → iPhone ถามสิทธิ์ ตอบ <b>Always Allow</b> และ <b>Delete Always</b><span class="why">ควรเด้งแจ้งเตือน "ตั้งปลุก …" หรือเด้งว่างๆ ถ้า 24 ชม. นี้ไม่มี duty</span><span class="seq" style="display:block;margin-top:8px">แล้วกลับมากด <button class="btn ib" type="button" id="al_test">🔍 ทดสอบลิงก์</button> ที่นี่ ข้อ 1 จะขึ้น "iPhone เรียกล่าสุด …" = <b class="ok">จบแล้ว ไม่ต้องกดอะไรอีก</b></span><div class="small" id="al_testOut"></div></li>

`;

  // fold: the card shows only its title + status until tapped (keeps ตั้งเวลา+ปฏิทิน tidy)
  if (!window.__ccFold) { window.__ccFold = 1;
    const st = document.createElement("style"); st.textContent = '.cc-fold>h2{cursor:pointer;display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:0}.cc-fold>h2::after{content:"›";margin-left:auto;transition:transform .2s;color:var(--muted)}.cc-fold.open>h2::after{transform:rotate(90deg)}.cc-fold>h2 small{font-size:.72rem;font-weight:500;color:var(--muted)}.cc-fold>h2 small.ok{color:var(--green)}.cc-fold:not(.open)>:not(h2){display:none!important}.cc-fold.open>h2{margin-bottom:8px}'; document.head.appendChild(st);
    document.addEventListener("click", (e) => { const h = e.target.closest(".cc-fold > h2"); if (h && !e.target.closest("button, a")) h.parentElement.classList.toggle("open"); }); }
  function card() {
    let c = document.getElementById("al_card");
    if (c) return c;
    const host = document.querySelector("#p-settings");
    if (!host) return null;
    c = document.createElement("div"); c.id = "al_card"; c.className = "card cc-fold";
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
    const rest = ready ? STEPS(FEED + link) : `<li class="dim"><b>สร้าง Shortcut</b> <span class="why">ทำข้อก่อนหน้าให้เสร็จก่อน</span></li><li class="dim"><b>เช็คผล</b></li><li class="dim"><b>ทดสอบ</b></li>`;
    c.innerHTML = `<h2>ปลุกอัตโนมัติบน iPhone ${st && st.last_used_at ? `<small class="ok">✓ ทำงานอยู่ · เรียกล่าสุด ${when(st.last_used_at)}</small>` : st ? "<small>ยังไม่เคยทำงาน</small>" : "<small>ยังไม่ได้ตั้ง</small>"}</h2>
<p class="small" style="margin:0;line-height:1.6"><b>ไม่ต้องกดตั้งปลุกเองอีก</b> · iPhone ดึงเวลาปลุกของ duty ถัดไปจากตารางคุณ <b>ทุกวัน 08:00 และ 20:00</b> แล้วตั้งนาฬิกาปลุกให้ (ตื่น + ปลุกซ้ำ ตามค่าในการ์ด "เวลาส่วนตัว") · ทำครั้งเดียว ~2 นาที</p>
${SC_LINK ? `<div class="note ok small" style="margin-top:8px">📱 ใช้ได้ทุก iPhone ที่เป็น <b>iOS 17 ขึ้นไป</b></div>` : `<div class="note info small" style="margin-top:8px;line-height:1.6"><b>📱 เครื่องที่ตั้งได้</b> (เพราะต้องใช้ช่อง <b>Describe a shortcut</b> ซึ่งเป็นฟีเจอร์ Apple Intelligence)<br>✅ iPhone 15 Pro / 15 Pro Max, iPhone 16 ทุกรุ่น (รวม 16e) และรุ่นใหม่กว่า · ต้องอัปเป็น <b>iOS 27</b> และเปิด <b>Apple Intelligence</b> ใน Settings → Apple Intelligence &amp; Siri<br>❌ iPhone 15 / 15 Plus, iPhone 14 และรุ่นเก่ากว่า จะไม่มีช่องนี้ แม้อัป iOS ล่าสุดแล้ว<br><span class="muted">รุ่นรองรับแต่ไม่เห็นช่อง Describe a shortcut: เช็คว่าเป็น iOS 27 และเปิด Apple Intelligence แล้ว (ถ้าเปิดไม่ได้ ลองตั้งภาษา Siri เป็น English)</span><br><span class="muted">เครื่องรุ่นเก่า: ใช้ปุ่ม <b>ดาวน์โหลดไฟล์ปฏิทิน (.ics)</b> ในแท็บ Brief แทน ไฟล์มีแจ้งเตือนปลุกในตัว ใช้ได้ทุกเครื่อง</span></div>`}
${err ? `<div class="note err small">${H(err)}</div>` : ""}
<div class="small" id="al_msg" style="min-height:1.2em">${msg || ""}</div>
${STYLE}
<ol class="alst">${step0}${rest}</ol>
${st ? `<details class="more" style="margin-top:8px"><summary>อื่นๆ: สร้างลิงก์ใหม่ / ยกเลิก / iOS รุ่นเก่า / จอล็อก ›</summary>
<div class="small" style="margin-top:6px;line-height:1.7">
${SC_LINK && ready ? `<div><b>ทางสำรอง (เครื่องที่มี Apple Intelligence):</b><ol class="alst" style="margin-top:4px">${AI_STEP}</ol></div>` : ""}
<div><b>ลิงก์หลุดหรือเปลี่ยนเครื่อง:</b> <button class="btn ghost ib" type="button" id="al_make2">🔄 สร้างลิงก์ใหม่</button> ลิงก์เก่าใช้ไม่ได้ทันที ต้องทำข้อ 2–4 ใหม่</div>
<div><b>เลิกใช้:</b> <button class="btn ghost ib" type="button" id="al_revoke">ยกเลิกลิงก์</button> แล้วลบ Shortcut ใน iPhone ด้วย</div>
<div><b>Shortcut ไม่ขึ้น "When it is 08:00 or 20:00 daily":</b> กด <button class="btn ghost ib" type="button" id="al_copyAuto">📋 คัดลอกข้อความตั้งเวลา</button> → ในหน้า Shortcut แตะช่อง Describe a change → วาง → ส่ง</div>
<div><b>iOS รุ่นเก่าที่ยังมีแท็บ Automation:</b> Automation → ＋ → Time of Day 08:00 Daily → Run Immediately → เลือก CoolCrew Alarm Sync → ทำซ้ำที่ 20:00</div>
<div><b>รอบ 20:00 ไม่ทำงานตอนจอล็อก:</b> เปิด Shortcut → Edit → ⓘ → Privacy → เปิด Allow Running When Locked</div>
${ready ? `<div><b>ข้อความคำสั่ง (ข้อ 2):</b><textarea id="al_prompt" readonly rows="3" style="width:100%;margin-top:4px;font-family:var(--f-mono);font-size:11px">${H(PROMPT(FEED + link))}</textarea></div>` : ""}
</div></details>` : ""}
<p class="small muted" style="margin:6px 0 0">ลิงก์เปิดดูเวลาปลุกของคุณได้โดยไม่ต้องล็อกอิน อย่าส่งต่อ · นาฬิกาปลุก iPhone ไม่มีวันที่ จึงตั้งล่วงหน้าได้ 24 ชม. และต้องรันทุกวัน</p>`;
    renderAndroid(st, err);
  }

  /* ---------- Android: a ready-made MacroDroid macro reads the same personal link at 08:00 and 20:00 and sets alarms in the Clock app ---------- */
  // alarm-macro.js holds the macro (tested on an Android 13 emulator, MacroDroid 6.1.5); we drop the user's link into it and offer it as a .macro file.
  function androidCard() {
    let c = document.getElementById("al_android");
    if (c) return c;
    const al = document.getElementById("al_card"); if (!al) return null;
    c = document.createElement("div"); c.id = "al_android"; c.className = "card cc-fold";
    al.insertAdjacentElement("afterend", c);
    c.addEventListener("click", onAndroidClick);
    return c;
  }
  function renderAndroid(st, err) {
    const c = androidCard(); if (!c) return;
    const open = c.classList.contains("open");
    const ready = !!(st && link);
    const fileStep = ready ? `<b>ดาวน์โหลดไฟล์ปลุกของคุณ</b><br><span class="seq"><button class="btn primary ib" type="button" id="ala_dl">⬇ ดาวน์โหลด CoolCrew_Alarm.macro</button></span><span class="why">ไฟล์นี้มีลิงก์ส่วนตัวของคุณอยู่ข้างในแล้ว ไม่ต้องวางอะไรเพิ่ม · อย่าส่งไฟล์ต่อให้คนอื่น</span>`
      : st ? `<b>ลิงก์ถูกสร้างจากเครื่องอื่น</b><span class="why">เปิดหน้านี้บนเครื่องที่สร้างลิงก์ หรือกด <button class="btn ib" type="button" id="ala_make">🔗 สร้างลิงก์ใหม่</button> (ถ้ามี iPhone ใช้ลิงก์เก่าอยู่ ต้องตั้ง Shortcut ใหม่ด้วย)</span>`
      : `<b>สร้างลิงก์ส่วนตัว</b><br><span class="seq"><button class="btn primary ib" type="button" id="ala_make">🔗 สร้างลิงก์ปลุก</button></span><span class="why">ลิงก์นี้คือกุญแจให้มือถืออ่านเวลาปลุกของคุณ</span>`;
    c.innerHTML = `<h2>ปลุกอัตโนมัติบน Android <small>${ready ? "ไฟล์พร้อมดาวน์โหลด" : "ยังไม่ได้ตั้ง"}</small></h2>
<p class="small" style="margin:0;line-height:1.6">แอป <b>MacroDroid</b> จะดึงเวลาปลุกของ duty ถัดไปจาก CoolCrew <b>ทุกวัน 08:00 และ 20:00</b> แล้วตั้งปลุกในแอปนาฬิกาให้ (ตื่น + ปลุกซ้ำ ชื่อ CoolCrew) · ตั้งครั้งเดียว ~3 นาที</p>
${err ? `<div class="note err small">${H(err)}</div>` : ""}
<div class="small" id="ala_msg" style="min-height:1.2em"></div>
<ol class="alst">
<li><b>ติดตั้ง MacroDroid</b><br><span class="seq"><a class="btn ib" href="https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid" target="_blank" rel="noopener">Play Store ↗</a></span><span class="why">เปิดแอป 1 ครั้ง กดผ่านหน้าแนะนำให้จบ</span></li>
<li>${fileStep}</li>
<li><b>เปิดไฟล์ด้วย MacroDroid</b><span class="why">แตะแจ้งเตือน "ดาวน์โหลดเสร็จ" (หรือแอป Files → Downloads → แตะไฟล์) → เลือก <b>MacroDroid</b> → จะเห็น macro <b>CoolCrew Alarm</b> → กดปุ่ม <b>✓</b> มุมขวาล่างเพื่อบันทึก</span></li>
<li><b>ให้สิทธิ์ 2 อย่าง</b> (สำคัญ ไม่งั้นปลุกไม่ถูกตั้งตอนปิดจอ)<span class="why">Settings → Apps → MacroDroid →<br>• <b>Display over other apps / แสดงทับแอปอื่น</b> → อนุญาต<br>• <b>Battery / แบตเตอรี่</b> → <b>Unrestricted / ไม่จำกัด</b></span></li>
<li><b>ทดสอบ</b> <button class="btn ib" type="button" id="ala_test" ${ready ? "" : "disabled"}>🔍 ตอนนี้จะตั้งปลุกกี่โมง</button><span class="why">ใน MacroDroid แตะ macro <b>CoolCrew Alarm</b> → <b>⋮</b> → <b>Test actions</b> → เปิดแอปนาฬิกา ต้องเห็นปลุกชื่อ CoolCrew ตรงกับที่ปุ่มนี้บอก (ถ้า 24 ชม. ข้างหน้าไม่มี duty จะไม่มีปลุก)</span><div class="small" id="ala_testOut" style="margin-top:4px"></div></li>
</ol>
<div class="small muted" style="margin-top:6px;line-height:1.6">• MacroDroid เวอร์ชันฟรีใช้ได้ทีละ 7 วัน ต่อเวลาได้ด้วยการกดดูโฆษณา (+3 วัน) หรือซื้อ Pro ครั้งเดียว · ถ้าหมดเวลา macro จะหยุดตั้งปลุก<br>• ถ้าตารางเปลี่ยน ปลุกเก่าจะยังอยู่ในแอปนาฬิกา (Android ลบให้ไม่ได้) ให้ปิดอันเก่าเอง · รันซ้ำเวลาเดิมจะไม่ซ้ำปลุก<br>• ลิงก์/ไฟล์เปิดดูเวลาปลุกของคุณได้โดยไม่ต้องล็อกอิน อย่าส่งต่อ</div>`;
    if (open) c.classList.add("open");
  }
  function loadMacro() {
    if (window.CC_ALARM_MACRO) return Promise.resolve(window.CC_ALARM_MACRO);
    return new Promise((ok, no) => { const s = document.createElement("script"); s.src = "alarm-macro.js"; s.onload = () => (window.CC_ALARM_MACRO ? ok(window.CC_ALARM_MACRO) : no(new Error("ไฟล์ macro เสีย"))); s.onerror = () => no(new Error("โหลดไฟล์ macro ไม่ได้")); document.head.appendChild(s); });
  }
  async function onAndroidClick(e) {
    const t = e.target.closest("button"); if (!t) return;
    const m = document.getElementById("ala_msg");
    if (t.id === "ala_copy") {
      const v = FEED + link, ok = () => { t.textContent = "✓ คัดลอกแล้ว"; setTimeout(() => (t.textContent = "📋 คัดลอกลิงก์ปลุก"), 2500); };
      try { await navigator.clipboard.writeText(v); ok(); } catch { const ta = document.createElement("textarea"); ta.value = v; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); ok(); }
      return;
    }
    if (t.id === "ala_dl") {
      t.disabled = true;
      try {
        const tpl = await loadMacro();
        if (!/^[0-9a-f]{20,}$/i.test(link)) throw new Error("ลิงก์ไม่ถูกต้อง สร้างใหม่ในการ์ด iPhone");
        const blob = new Blob([tpl.replace("__TOKEN__", link)], { type: "application/octet-stream" });
        const u = URL.createObjectURL(blob), aEl = document.createElement("a");
        aEl.href = u; aEl.download = "CoolCrew_Alarm.macro"; document.body.appendChild(aEl); aEl.click(); aEl.remove();
        setTimeout(() => URL.revokeObjectURL(u), 10000);
        if (m) m.innerHTML = '<span style="color:var(--green)">ดาวน์โหลดแล้ว · ทำข้อ 3 ต่อ</span>';
      } catch (err) { if (m) m.innerHTML = `<span style="color:var(--red)">${H(err?.message || err)}</span>`; }
      t.disabled = false;
      return;
    }
    if (t.id === "ala_make") {
      t.disabled = true;
      try { const { data, error } = await sb().rpc("create_alarm_token"); if (error) throw error; keep(data); await render(); const m2 = document.getElementById("ala_msg"); if (m2) m2.innerHTML = '<span style="color:var(--green)">สร้างลิงก์แล้ว · กดดาวน์โหลดในข้อ 2</span>'; }
      catch (err) { t.disabled = false; if (m) m.innerHTML = `<span style="color:var(--red)">สร้างไม่ได้: ${H(err?.message || err)}</span>`; }
      return;
    }
    if (t.id === "ala_test") {
      const o = document.getElementById("ala_testOut"); t.disabled = true; o.textContent = "กำลังเรียก…";
      try {
        const r = await fetch(FEED + link, { cache: "no-store" }); const j = await r.json();
        const p2 = (n) => String(n).padStart(2, "0");
        o.innerHTML = !j.ok ? `<span style="color:var(--red)">${H(j.message || "เรียกไม่ได้")}</span>`
          : j.n ? `<span style="color:var(--green)">✓ ลิงก์ใช้ได้ · MacroDroid จะตั้งปลุก <b class="mono">${p2(j.a1_h)}:${p2(j.a1_m)}</b>${j.n > 1 ? ` และ <b class="mono">${p2(j.a2_h)}:${p2(j.a2_m)}</b>` : ""}</span><br><span class="muted">${H(j.summary)}</span>`
          : '<span style="color:var(--green)">✓ ลิงก์ใช้ได้</span> · ไม่มี duty ใน 24 ชม. ข้างหน้า ตอนนี้จึงยังไม่มีปลุก (n = 0)';
      } catch (err) { o.innerHTML = `<span style="color:var(--red)">${H(err?.message || err)}</span>`; }
      t.disabled = false;
    }
  }

  async function onClick(e) {
    const t = e.target.closest("button, a#al_copyLink"); if (!t) return;
    if (t.id === "al_copyLink") e.preventDefault();
    const m = document.getElementById("al_msg");
    if (t.id === "al_make" || t.id === "al_make2") {
      if (t.dataset.arm !== "1" && /ใหม่/.test(t.textContent)) { t.dataset.arm = "1"; t.textContent = "⚠️ Shortcut ที่ตั้งไว้จะหยุดทำงาน ต้องทำข้อ 2–4 ใหม่ · กดอีกครั้งเพื่อยืนยัน"; setTimeout(() => { if (t.isConnected) { t.dataset.arm = ""; render(); } }, 6000); return; }
      t.disabled = true;
      const hadLink = !!(await status().catch(() => null));
      try {
        const { data, error } = await sb().rpc("create_alarm_token");
        if (error) throw error;
        keep(data);
        await render('<span style="color:var(--green)">สร้างลิงก์แล้ว · ทำตามขั้นตอนด้านล่าง</span>' + (hadLink ? ' <span style="color:var(--amber)">· Shortcut เดิมใช้ลิงก์เก่าแล้วจะไม่ทำงาน ให้ลบ Shortcut เดิมใน iPhone แล้วทำข้อ 2–4 ใหม่</span>' : ""));
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
    if (t.id === "al_copyMine") {
      const v = FEED + link, ok = () => { t.textContent = "✓ คัดลอกแล้ว ไปกดติดตั้งได้เลย"; setTimeout(() => (t.textContent = "📋 คัดลอกลิงก์ของฉัน"), 3000); };
      try { await navigator.clipboard.writeText(v); ok(); } catch { const ta = document.createElement("textarea"); ta.value = v; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); ok(); }
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
