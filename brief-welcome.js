// brief-welcome.js — first-run screen for Crew Brief.
// A member with no roster sees one card: 3 short steps, one big "เลือกรูป roster" button and the Merlot example,
// with the tabs hidden. The existing upload card (#uploadCard: file picker, thumbnails, อ่านตาราง, progress) is moved
// into this screen so the whole reading flow keeps working; once a roster exists the card goes back to its tab and
// the full app opens. Loaded with defer after the inline app script; hooks renderAll/applyParsed by name.
(function(){
"use strict";
const $=id=>document.getElementById(id);
const CSS=`
body.wl nav.tabs,body.wl .panel:not(#p-welcome){display:none!important}
#p-welcome .wl-hero{display:flex;flex-direction:column;gap:6px}
#p-welcome .wl-kick{font:600 .74rem var(--f-display);letter-spacing:.14em;color:var(--amber)}
#p-welcome .wl-h{font:700 1.3rem/1.3 var(--f-display);margin:0}
#p-welcome .wl-sub{margin:0;font-size:.9rem;line-height:1.5;color:var(--muted)}
#p-welcome .wl-steps{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:9px;counter-reset:wl}
#p-welcome .wl-steps li{display:grid;grid-template-columns:26px 1fr;gap:10px;align-items:start;font-size:.92rem;line-height:1.45}
#p-welcome .wl-steps li::before{counter-increment:wl;content:counter(wl);width:26px;height:26px;border-radius:50%;background:var(--amber-soft);color:var(--amber);font:700 .85rem/26px var(--f-display);text-align:center}
#p-welcome #uploadCard{border:0;padding:0;gap:10px;background:none;box-shadow:none}
#p-welcome #uploadCard>.row:first-child,#p-welcome #uploadCard>p.small.muted,#p-welcome #uploadCard .gd-link,#p-welcome #addManual,#p-welcome #clearTopMsg{display:none!important}
#p-welcome #uploadCard .grid2{display:flex!important;flex-direction:column;gap:10px;align-items:stretch!important}
#p-welcome #uploadCard .grid2>label{width:100%}
#p-welcome .wl-droplbl{font-size:0!important;gap:0!important;order:-1}
#p-welcome #drop{width:100%}
#p-welcome #drop{min-height:62px!important;font-size:1.12rem;border-radius:14px;box-shadow:0 8px 20px -10px var(--amber)}
#p-welcome #drop .muted{color:inherit;opacity:.8}
#p-welcome #uploadCard [data-wl-row]{display:none}
#p-welcome.hasFiles #uploadCard [data-wl-row]{display:flex}
#p-welcome #parseBtn{min-height:52px;font-size:1.05rem;flex:1 1 auto;border-radius:12px}
#p-welcome #stopBtn{min-height:52px}
#p-welcome #thumbs:empty{display:none}
#p-welcome .wl-ex{display:flex;flex-direction:column;gap:8px;padding-top:4px;border-top:1px solid var(--line)}
#p-welcome .wl-ex h3{margin:0;font-size:1rem}
#p-welcome .wl-ex .gd-steps{display:none}
#p-welcome .wl-ex .gd-legend{font-size:.84rem}
#p-welcome .wl-alt{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.84rem}
#p-welcome .wl-alt a{color:var(--muted);text-decoration:underline;text-underline-offset:3px}
#p-welcome .wl-load{display:flex;align-items:center;gap:10px;color:var(--muted);min-height:120px;justify-content:center}
#wlNote{border-color:var(--amber);background:var(--amber-soft)}
#wlNote .row{justify-content:space-between;align-items:center;gap:8px}
`;
const LOADING=`<div class="card"><div class="wl-load"><span class="spin"></span> กำลังโหลดตารางของคุณ…</div></div>`;
const SCREEN=`<div class="card">
<div class="wl-hero">
<div class="wl-kick">CREW BRIEF · เริ่มใช้งาน</div>
<h2 class="wl-h">ใส่ roster ครั้งเดียว แล้วให้แอปเตรียมวันบินให้</h2>
<p class="wl-sub" id="wlSub">เวลาปลุกและเวลาออกจากบ้านตาม report · brief อากาศ NOTAM MEL ก่อนบิน · FDP · ตารางเดือน — ทั้งหมดอ่านจากรูป roster ที่แคปจาก Merlot</p>
</div>
<ol class="wl-steps">
<li><span><b>แคปหน้าจอ roster</b> จาก vzportal.merlot.aero → Employee Roster Report (ยาวเกินจอให้แคปหลายรูปซ้อนกันเล็กน้อย)</span></li>
<li><span><b>แตะปุ่มด้านล่าง</b> แล้วเลือกรูปที่แคปไว้ (เลือกหลายรูปพร้อมกันได้)</span></li>
<li><span><b>กด อ่านตาราง</b> รอประมาณ 1 นาที แล้วตรวจทานวันและเวลา</span></li>
</ol>
<div id="wlUpload"></div>
<div class="wl-ex" id="wlEx"><h3>หน้าที่ต้องแคป หน้าตาแบบนี้</h3></div>
<div class="wl-alt">ยังไม่มี roster? <a href="#" id="wlSample">ดูตัวอย่างด้วยข้อมูลสมมติ</a><a href="#" id="wlManual">ใส่ duty เองทีละวัน</a></div>
</div>`;
let sec=null,entered=false,exited=false,lastParse=0,dropLabel=null,dropText=null;
let fromBoard=false;try{fromBoard=new URLSearchParams(location.search).get("from")==="board"}catch{}
const hasRoster=()=>{try{return((typeof STATE!="undefined"&&STATE&&STATE.duties)||[]).length>0}catch{return false}};
function mount(){
  if(sec)return sec;
  const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
  sec=document.createElement("section");sec.className="panel";sec.id="p-welcome";sec.hidden=true;
  const nav=document.querySelector("nav.tabs");nav?nav.insertAdjacentElement("afterend",sec):document.body.appendChild(sec);
  return sec;
}
function enter(){
  if(entered)return;entered=true;
  mount();sec.innerHTML=SCREEN;sec.hidden=false;document.body.classList.add("wl");
  const up=$("uploadCard");
  if(up){
    $("wlUpload").appendChild(up);
    const row=up.querySelector("#parseBtn")?.closest(".row");row&&(row.dataset.wlRow="1");
    const drop=$("drop");dropLabel=drop?.closest("label.f");dropLabel&&dropLabel.classList.add("wl-droplbl");
    if(drop&&drop.firstChild&&drop.firstChild.nodeType===3){dropText=drop.firstChild.nodeValue;drop.firstChild.nodeValue="📷 เลือกรูป roster "}
    drop&&drop.classList.add("primary");
    const f=$("file");f&&f.addEventListener("change",markFiles);drop&&drop.addEventListener("drop",()=>setTimeout(markFiles,0));
    markFiles();
  }
  if(fromBoard){const h=sec.querySelector(".wl-h"),su=$("wlSub");h&&(h.textContent="ใส่ roster ครั้งเดียว ใช้ได้ทั้งบอร์ดแลกและ Crew Brief");su&&(su.textContent="อ่านเสร็จกด กลับไปบอร์ด ได้เลย · บอร์ดจะรู้ว่าคุณบินวันไหน ว่างวันไหน และ Crew Brief เตรียมเวลาปลุก brief FDP ให้จากตารางเดียวกัน")}
  try{const g=window.CB_GUIDE&&window.CB_GUIDE.roster;g&&$("wlEx").insertAdjacentHTML("beforeend",g)}catch{}
  $("wlSample").onclick=e=>{e.preventDefault();const b=$("loadSample");b?b.click():exit("next")};
  $("wlManual").onclick=e=>{e.preventDefault();exit("roster");setTimeout(()=>{$("addManual")?.click();$("editCard")?.scrollIntoView({behavior:"smooth",block:"start"})},50)};
  try{window.scrollTo(0,0)}catch{}
}
function markFiles(){const f=$("file");const n=(f&&f.files&&f.files.length)||document.querySelectorAll("#thumbs img").length;sec&&sec.classList.toggle("hasFiles",n>0);const d=$("drop");d&&!exited&&d.classList.toggle("primary",!(n>0))}
function exit(tab){
  if(!entered||exited)return;exited=true;
  const up=$("uploadCard"),roster=$("p-roster");
  if(up&&roster){
    up.querySelectorAll("[data-wl-row]").forEach(r=>delete r.dataset.wlRow);
    dropLabel&&dropLabel.classList.remove("wl-droplbl");
    const drop=$("drop");if(drop&&dropText!=null&&drop.firstChild&&drop.firstChild.nodeType===3)drop.firstChild.nodeValue=dropText;
    drop&&drop.classList.remove("primary");
    roster.insertBefore(up,roster.firstChild);
  }
  document.body.classList.remove("wl");sec.hidden=true;
  if(typeof showTab=="function"&&tab)showTab(tab);
}
function note(total){
  const nav=document.querySelector("nav.tabs");if(!nav)return;
  const n=document.createElement("div");n.className="card";n.id="wlNote";
  n.innerHTML=fromBoard
    ?`<div class="row"><div><b>✅ อ่าน roster ได้ ${total} รายการ</b><div class="small muted">ตรวจดูว่าวันและเวลาตรง ถ้าอ่านผิดแก้ได้ที่ปุ่ม "แก้" · ตารางนี้ใช้ในบอร์ดแลกด้วย กลับไปได้เลย</div></div><button class="btn primary" type="button" id="wlGoBoard">กลับไปบอร์ด →</button></div>`
    :`<div class="row"><div><b>✅ อ่าน roster ได้ ${total} รายการ</b><div class="small muted">ตรวจดูว่าวันและเวลาตรง ถ้าอ่านผิดแก้ได้ที่ปุ่ม "แก้" · เสร็จแล้วไปแท็บ <b>ถัดไป</b> เพื่อดูเวลาปลุกและ brief วันบินถัดไป</div></div><button class="btn primary" type="button" id="wlGoNext">ถัดไป →</button></div>`;
  nav.insertAdjacentElement("afterend",n);
  const gn=n.querySelector("#wlGoNext");gn&&(gn.onclick=()=>{n.remove();typeof showTab=="function"&&showTab("next")});
  const gb=n.querySelector("#wlGoBoard");gb&&(gb.onclick=async()=>{gb.disabled=true;gb.textContent="กำลังซิงก์…";try{await Promise.race([typeof window.cbRosterFlush=="function"?window.cbRosterFlush():Promise.resolve(),new Promise(r=>setTimeout(r,8000))])}catch{}location.href="index.html?from=brief#swap"});
  nav.addEventListener("click",()=>n.remove(),{once:true});
}
function sync(){
  if(exited)return;
  if(hasRoster()){
    const fromParse=Date.now()-lastParse<8000,total=(STATE.duties||[]).length;
    if(!entered){exited=true;return}        // had a roster from the start: nothing to do
    exit(fromParse?"month":"next");
    fromParse&&!STATE.sample&&note(total);
  }
}
// hooks (function declarations in the page script are writable window properties; callers resolve them by name)
if(typeof window.renderAll=="function"){const ra=window.renderAll;window.renderAll=function(){const r=ra.apply(this,arguments);try{sync()}catch{}return r}}
if(typeof window.applyParsed=="function"){const ap=window.applyParsed;window.applyParsed=function(){lastParse=Date.now();return ap.apply(this,arguments)}}
function init(){
  if(hasRoster()){exited=true;return}
  mount();
  // a member signing in on a new device: the roster is on the server → wait for the sync (max 5 s) before showing the welcome
  const cloud=!!window.SB&&!localStorage.getItem("cb_roster");
  if(cloud){
    sec.innerHTML=LOADING;sec.hidden=false;document.body.classList.add("wl");
    let done=false;const go=()=>{if(done)return;done=true;hasRoster()?(document.body.classList.remove("wl"),sec.hidden=true,exited=true):enter()};
    window.addEventListener("cb:rosterSynced",go,{once:true});setTimeout(go,5000);
  }else enter();
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init):init();
})();
