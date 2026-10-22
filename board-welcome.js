// board-welcome.js — first-run screen for the Pilot Swap Board.
// An approved member whose roster is empty sees one card instead of the tabs: 3 short steps, one big
// "เลือกรูป roster" button and the Merlot example. The board's own upload card (#rfile, thumbnails, อ่านตาราง,
// status) and the review card (#draftCard → บันทึกตาราง) are moved into it so the existing reading/saving flow
// is unchanged; once the saved roster arrives the cards go back to "ตารางฉัน" and the full app opens.
// Loaded with defer after the page script; hooks render() by name and reads S (window.FOSTATE).
(function(){
"use strict";
const $=s=>document.querySelector(s);
const CSS=`
body.wl #appView nav.tabs,body.wl #appView .section:not(#tab-welcome),body.wl #newPostBtn{display:none!important}
#tab-welcome .wl-hero{display:flex;flex-direction:column;gap:6px}
#tab-welcome .wl-kick{font:600 .74rem var(--f-display);letter-spacing:.14em;color:var(--accent)}
#tab-welcome .wl-h{font:700 1.3rem/1.3 var(--f-display);margin:0}
#tab-welcome .wl-sub{margin:0;font-size:.9rem;line-height:1.5;color:var(--muted)}
#tab-welcome .wl-steps{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:9px;counter-reset:wl}
#tab-welcome .wl-steps li{display:grid;grid-template-columns:26px 1fr;gap:10px;align-items:start;font-size:.92rem;line-height:1.45}
#tab-welcome .wl-steps li::before{counter-increment:wl;content:counter(wl);width:26px;height:26px;border-radius:50%;background:var(--accent-soft);color:var(--accent);font:700 .85rem/26px var(--f-display);text-align:center}
#tab-welcome .wl-up{border:0;padding:0;gap:10px;background:none;box-shadow:none}
#tab-welcome .wl-up>h2,#tab-welcome .wl-up>p.muted,#tab-welcome .wl-up label[for=rfile],#tab-welcome .wl-up .gd-link,#tab-welcome #addRowBtn{display:none!important}
#tab-welcome .wl-up .grid2{display:flex;flex-direction:column;gap:10px}
#tab-welcome .wl-pick{min-height:62px;font-size:1.12rem;border-radius:14px;box-shadow:0 8px 20px -10px var(--accent);width:100%}
#tab-welcome .wl-pick small{font-weight:400;opacity:.8;margin-left:6px}
#tab-welcome .wl-up>.row{display:none}
#tab-welcome.hasFiles .wl-up>.row{display:flex}
#tab-welcome #readBtn{min-height:52px;font-size:1.05rem;flex:1 1 auto;border-radius:12px}
#tab-welcome #stopBtn{min-height:52px}
#tab-welcome #thumbs:empty{display:none}
#tab-welcome #draftCard{border:1px solid var(--accent);border-radius:12px}
#tab-welcome .wl-ex{display:flex;flex-direction:column;gap:8px;padding-top:4px;border-top:1px solid var(--line)}
#tab-welcome .wl-ex h3{margin:0;font-size:1rem}
#tab-welcome .wl-ex .gd-steps{display:none}
#tab-welcome .wl-ex .gd-legend{font-size:.84rem}
#tab-welcome .wl-alt{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.84rem}
#tab-welcome .wl-alt a{color:var(--muted);text-decoration:underline;text-underline-offset:3px}
#wlNote{border:1px solid var(--accent);background:var(--accent-soft)}
#wlNote .row{justify-content:space-between;align-items:center;gap:8px}
`;
const SCREEN=`<div class="card">
<div class="wl-hero">
<div class="wl-kick">PILOT SWAP BOARD · เริ่มใช้งาน</div>
<h2 class="wl-h">ใส่ roster ครั้งเดียว แล้วเริ่มหาคู่แลกได้เลย</h2>
<p class="wl-sub">บอร์ดจะรู้ว่าคุณบินวันไหน ว่างวันไหน แลกกับใครได้ตามกฎ OM-A และกรอกฟอร์มขอแลกให้ · ตารางเดียวกันใช้ใน Crew Brief ได้เลย</p>
</div>
<ol class="wl-steps">
<li><span><b>แคปหน้าจอ roster</b> จาก vzportal.merlot.aero → Employee Roster Report (ยาวเกินจอให้แคปหลายรูปซ้อนกันเล็กน้อย)</span></li>
<li><span><b>แตะปุ่มด้านล่าง</b> แล้วเลือกรูปที่แคปไว้ (เลือกหลายรูปพร้อมกันได้)</span></li>
<li><span><b>กด อ่านตาราง</b> รอประมาณ 1 นาที ตรวจทาน แล้วกด บันทึกตาราง</span></li>
</ol>
<div id="wlUpload"></div>
<div class="wl-ex" id="wlEx"><h3>หน้าที่ต้องแคป หน้าตาแบบนี้</h3></div>
<div class="wl-alt">ยังไม่มี roster? <a href="#" id="wlSkip">ดูบอร์ดก่อน</a><a href="#" id="wlManual">ใส่วันเองทีละวัน</a></div>
</div>`;
let sec=null,entered=false,exited=false,up=null,upNext=null,draft=null,draftNext=null,pick=null;
const S=()=>window.FOSTATE;
function myDays(){try{const s=S();return (s&&s.me&&s.rosters&&s.rosters[s.me]&&s.rosters[s.me].days)||[]}catch{return[]}}
function ready(){try{const s=S();return !!(s&&s.me&&s.rostersLoaded&&s.membersLoaded&&(typeof isApproved!="function"||isApproved(s.me)))}catch{return false}}
function mount(){
  if(sec)return sec;
  const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
  sec=document.createElement("section");sec.className="section";sec.id="tab-welcome";sec.hidden=true;
  const anchor=$("#tab-free")||$("#appView .wrap");anchor&&(anchor.id==="tab-free"?anchor.insertAdjacentElement("afterend",sec):anchor.appendChild(sec));
  return sec;
}
function enter(){
  if(entered)return;entered=true;
  mount();sec.innerHTML=SCREEN;sec.hidden=false;document.body.classList.add("wl");
  up=$("#rfile")?.closest(".card");draft=$("#draftCard");
  if(up){
    upNext=up.nextElementSibling;up.classList.add("wl-up");$("#wlUpload").appendChild(up);
    pick=document.createElement("button");pick.type="button";pick.className="btn primary wl-pick";pick.id="wlPick";
    pick.innerHTML='📷 เลือกรูป roster<small id="wlCount"></small>';
    const grid=up.querySelector(".grid2");grid?grid.insertAdjacentElement("beforebegin",pick):up.prepend(pick);
    pick.onclick=()=>$("#rfile")?.click();
    $("#rfile")?.addEventListener("change",markFiles);markFiles();
  }
  if(draft){draftNext=draft.nextElementSibling;$("#wlUpload").appendChild(draft)}
  try{const g=window.CB_GUIDE&&window.CB_GUIDE.roster;g&&$("#wlEx").insertAdjacentHTML("beforeend",g)}catch{}
  $("#wlSkip").onclick=e=>{e.preventDefault();exit("board")};
  $("#wlManual").onclick=e=>{e.preventDefault();exit("roster");setTimeout(()=>$("#addRowBtn")?.click(),50)};
  try{window.scrollTo(0,0)}catch{}
}
function markFiles(){const f=$("#rfile"),n=(f&&f.files&&f.files.length)||0;sec&&sec.classList.toggle("hasFiles",n>0);const c=$("#wlCount");c&&(c.textContent=n?" · "+n+" รูป":"");pick&&pick.classList.toggle("primary",!(n>0))}
function exit(tab){
  if(!entered||exited)return;exited=true;
  const home=$("#tab-roster");
  if(home){
    if(up){up.classList.remove("wl-up");pick&&pick.remove();home.insertBefore(up,upNext&&upNext.parentElement===home?upNext:home.firstChild)}
    if(draft)home.insertBefore(draft,draftNext&&draftNext.parentElement===home?draftNext:null);
  }
  document.body.classList.remove("wl");sec.hidden=true;
  const b=tab&&document.querySelector('nav.tabs [data-tab="'+tab+'"]');b&&b.click();
}
function note(n){
  const nav=$("#tab-roster");if(!nav)return;
  const d=document.createElement("div");d.className="card";d.id="wlNote";
  d.innerHTML=`<div class="row"><div><b>✅ บันทึกตาราง ${n} วันแล้ว</b><div class="muted" style="font-size:13px">นี่คือตารางของคุณ แตะวันที่อยากปล่อยหรืออยากได้เพื่อประกาศบนบอร์ด · Crew Brief ใช้ตารางนี้ได้เลย</div></div><a class="btn primary" href="brief.html">เปิด Crew Brief</a></div>`;
  nav.prepend(d);
  document.querySelector("nav.tabs")?.addEventListener("click",()=>d.remove(),{once:true});
}
function sync(){
  if(exited||!ready())return;
  const n=myDays().length;
  if(n>0){if(entered){exit("roster");note(n)}else exited=true;return}
  enter();
}
if(typeof window.render=="function"){const r=window.render;window.render=function(){const x=r.apply(this,arguments);try{sync()}catch{}return x};window.FORENDER=window.render}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{try{sync()}catch{}}):(()=>{try{sync()}catch{}})();
})();
