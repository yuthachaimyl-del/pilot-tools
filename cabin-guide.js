// cabin-guide.js — TG site (FO_CONFIG.ROSTER_SOURCE === "cabinconnect"): the "what to capture" example and the
// first-run welcome cards show Thai Airways Cabin Connect instead of the TVJ Merlot / crew-app pages.
// Loaded after the inline guide script on index.html and brief.html; board-welcome.js / brief-welcome.js call
// window.ccWelcomeCabin(section) right after they draw their card.
(function () {
  "use strict";
  const C = window.FO_CONFIG || {};
  if (C.ROSTER_SOURCE !== "cabinconnect") return;
  const css = `<style>
.cc2{background:#fff;color:#222;font:12px/1.35 Arial,Helvetica,sans-serif;padding:10px 8px 8px}
.cc2 .ttl{color:#3d1d7a;font-weight:700;text-align:center;font-size:15px;margin-bottom:4px}
.cc2 .hd{text-align:center;font-size:13px;margin:2px 0 6px}
.cc2 .g{display:grid;grid-template-columns:repeat(7,1fr);gap:3px 4px;text-align:center}
.cc2 .w{color:#555;font-size:10.5px}.cc2 .d{font-weight:600;font-size:13px}.cc2 .x{color:#bbb}
.cc2 .c{border-radius:4px;color:#fff;background:#8a4fe0;font-size:10.5px;padding:1px 0}.cc2 .o{background:#a6d9a8;color:#1b4d1e}
.cc2 .ln{display:flex;justify-content:space-between;font-weight:700;margin:8px 2px 4px}.cc2 .ln span:first-child{color:#666;font-weight:400}
.cc2 .fc{background:#8a4fe0;color:#fff;border-radius:8px;padding:7px 8px;display:grid;grid-template-columns:34px 1fr auto 1fr;gap:6px;align-items:center;margin-top:5px}
.cc2 .fc b{font-size:13px}.cc2 .fc small{display:block;opacity:.85;font-size:10px}
.cc2 .rel{position:relative;padding-right:22px}
.gd-legend .gd-n,.cc-leg .gd-n{position:static}
</style>`;
  const n = (k) => `<span class="gd-n">${k}</span>`;
  const GUIDE = css + `
<div class="gd-way"><span class="gd-n gd-w" style="position:static">1</span><div><b>แอป Cabin Connect → Roster: หน้าปฏิทินทั้งเดือน</b> <span class="gd-tag">1 รูป</span></div></div>
<div class="gd-phone" aria-label="ตัวอย่างหน้าปฏิทิน Roster ของ Cabin Connect (ข้อมูลสมมติ)"><div class="cc2">
<div class="ttl">Roster</div><div class="hd gd-hl rel">‹ 11-2026 ›${n(1)}</div>
<div class="g"><span class="w">MON</span><span class="w">TUE</span><span class="w">WED</span><span class="w">THU</span><span class="w">FRI</span><span class="w">SAT</span><span class="w">SUN</span>
<span class="d x">26</span><span class="d x">27</span><span class="d x">28</span><span class="d x">29</span><span class="d x">30</span><span class="d x">31</span><span class="d">1</span>
<span></span><span></span><span></span><span></span><span></span><span></span><span class="c">663</span>
<span class="d">2</span><span class="d">3</span><span class="d">4</span><span class="d">5</span><span class="d">6</span><span class="d">7</span><span class="d">8</span>
<span class="c o">OFF</span><span class="c o">OFF</span><span class="c o">OFF</span><span class="c gd-hl rel">245${n(2)}</span><span class="c">425</span><span></span><span class="c">426</span>
<span></span><span></span><span></span><span class="c">246</span><span></span><span></span><span></span>
</div></div></div>
<div class="gd-way"><span class="gd-n gd-w" style="position:static">2</span><div><b>แตะวันที่บินทีละวัน แล้วแคปรายละเอียด</b> <span class="gd-tag">วันละ 1 รูป</span></div></div>
<div class="gd-phone" aria-label="ตัวอย่างรายละเอียดวันบินของ Cabin Connect (ข้อมูลสมมติ)"><div class="cc2">
<div class="ln gd-hl rel"><span>05-Nov-2026</span><span>05-Nov 09:00~05-Nov 14:40</span>${n(3)}</div>
<div class="fc gd-hl rel"><b>FLY</b><span><b>BKK</b> <small>10:45L</small></span><b>TG245</b><span><b>KBV</b> <small>12:05L</small></span>${n(4)}</div>
<div class="fc"><b>FLY</b><span><b>KBV</b> <small>12:45L</small></span><b>TG246</b><span><b>BKK</b> <small>14:10L</small></span></div>
</div></div>
<div class="gd-legend cc-leg">
<div>${n(1)}<span>หัวเดือน (เช่น 11-2026) ใช้หาปีและเดือน</span></div>
<div>${n(2)}<span>ช่องสีม่วงคือเลขไฟลต์ ช่องเขียว OFF คือวันหยุด · วันที่ว่างเปล่าคือค้างคืน/พัก</span></div>
<div>${n(3)}<span>บรรทัดเวลา = เวลา report และเวลาเลิกงาน ใช้คำนวณเวลาปลุก (ต้องเห็นในรูป)</span></div>
<div>${n(4)}<span>การ์ดเที่ยวบินทุกใบ: เลขไฟลต์ สนามบิน และเวลาออก/ถึง</span></div>
</div>
<p class="gd-note">เลือกทุกรูปพร้อมกันได้ · ไฟลต์ข้ามคืนแคปทั้งสองวัน แอปรวมเป็น duty เดียว · ตัวอย่างเป็นข้อมูลสมมติ</p>`;
  if (window.CB_GUIDE) window.CB_GUIDE.roster = GUIDE; else window.CB_GUIDE = { roster: GUIDE };

  const STEPS = `<li><span><b>แคปหน้าจอจาก Cabin Connect</b> หน้า Roster: ปฏิทินทั้งเดือน 1 รูป แล้วแตะวันที่บินทีละวันแคปรายละเอียด</span></li>
<li><span><b>แตะปุ่มด้านล่าง</b> แล้วเลือกรูปที่แคปไว้ทั้งหมดพร้อมกัน</span></li>
<li><span><b>กด อ่านตาราง</b> รอสักครู่ แล้วตรวจทานวันและเวลาในแท็บ ตาราง</span></li>`;
  window.ccWelcomeCabin = function (sec) {
    try {
      const q = (s) => sec.querySelector(s);
      const brand = (C.BRAND && C.BRAND.board) || "Cabin Swap Board";
      const onBoard = !!q("#wlSkip");
      if (q(".wl-kick")) q(".wl-kick").textContent = (onBoard ? brand.toUpperCase() : "ECONOMY TG CREW") + " · เริ่มใช้งาน";
      if (q(".wl-sub")) q(".wl-sub").textContent = onBoard
        ? "บอร์ดจะรู้ว่าคุณบินวันไหน ว่างวันไหน และหาคู่แลกในห้อง Economy TG Crew ได้ · ตารางเดียวกันใช้ตั้งปลุกและใส่ปฏิทินด้วย"
        : "เวลาปลุกและเวลาออกจากบ้านตาม report · ตารางเดือน · ปฏิทิน iPhone / Google — อ่านจากรูปที่แคปจาก Cabin Connect";
      const h = q(".wl-h"); if (h) h.textContent = h.textContent.replace("Crew Brief", "หน้าตารางบิน");
      if (q(".wl-steps")) q(".wl-steps").innerHTML = STEPS;
      if (q(".wl-why")) q(".wl-why").textContent = "อ่านครั้งเดียว ใช้ได้ทั้งบอร์ดแลกและหน้าตารางบิน · ปลุก · ปฏิทิน ไม่ต้องอัปสองรอบ";
      const sample = q("#wlSample"); if (sample) sample.style.display = "none";   // the sample roster is a pilot roster
    } catch (e) { /* keep the default card */ }
  };
})();
