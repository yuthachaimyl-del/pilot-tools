// board-welcome.js — first-run screen for the Pilot Swap Board + one upload place for both apps.
// An approved member whose roster is empty sees one card instead of the tabs: 3 short steps and a single
// "ใส่ roster →" button that opens Crew Brief's reader (brief.html?from=board). Crew Brief's reader keeps sector
// times, accommodation and release-day data and writes the same `rosters` row (brief + days), so the board
// gets the roster too; the board's own reader only keeps flight + route. Coming back (index.html?from=brief)
// opens ตารางฉัน with a short note. The board's own upload card stays in ตารางฉัน, folded, for monthly updates.
// Loaded with defer after the page script; hooks render() by name and reads S (window.FOSTATE).
(function(){
"use strict";
const $=s=>document.querySelector(s);
const BRIEF="brief.html?from=board";
const CSS=`
body.wl nav.tabs,body.wl #appView .section:not(#tab-welcome),body.wl #newPostBtn{display:none!important}
#tab-welcome .wl-hero{display:flex;flex-direction:column;gap:6px}
#tab-welcome .wl-kick{font:600 .74rem var(--f-display);letter-spacing:.14em;color:var(--accent)}
#tab-welcome .wl-h{font:700 1.3rem/1.3 var(--f-display);margin:0}
#tab-welcome .wl-sub{margin:0;font-size:.9rem;line-height:1.5;color:var(--muted)}
#tab-welcome .wl-steps{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:9px;counter-reset:wl}
#tab-welcome .wl-steps li{display:grid;grid-template-columns:26px 1fr;gap:10px;align-items:start;font-size:.92rem;line-height:1.45}
#tab-welcome .wl-steps li::before{counter-increment:wl;content:counter(wl);width:26px;height:26px;border-radius:50%;background:var(--accent-soft);color:var(--accent);font:700 .85rem/26px var(--f-display);text-align:center}
#tab-welcome .wl-pick{display:flex;align-items:center;justify-content:center;min-height:62px;font-size:1.12rem;border-radius:14px;box-shadow:0 8px 20px -10px var(--accent);width:100%;text-decoration:none}
#tab-welcome .wl-why{margin:0;font-size:.82rem;color:var(--muted);text-align:center}
#tab-welcome .wl-ex{display:flex;flex-direction:column;gap:8px;padding-top:4px;border-top:1px solid var(--line)}
#tab-welcome .wl-ex h3{margin:0;font-size:1rem}
#tab-welcome .wl-ex .gd-steps{display:none}
#tab-welcome .wl-ex .gd-legend{font-size:.84rem}
#tab-welcome .wl-alt{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.84rem}
#tab-welcome .wl-alt a{color:var(--muted);text-decoration:underline;text-underline-offset:3px}
#wlNote{border:1px solid var(--accent);background:var(--accent-soft)}
#wlNote .row{justify-content:space-between;align-items:center;gap:8px}
#wlUpHint{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
#wlUpHint .muted{font-size:13px}
.wlFold>.wlFoldHead{display:flex;width:100%;justify-content:space-between;align-items:center;gap:10px;background:none;border:0;color:inherit;font:inherit;text-align:left;padding:0;cursor:pointer}
.wlFold>.wlFoldHead b{font-family:var(--f-display);font-size:1.05rem}
.wlFold>.wlFoldHead small{display:block;color:var(--muted);font-size:12.5px;font-weight:400;margin-top:2px}
.wlFold>.wlFoldHead .wlChev{transition:transform .2s;color:var(--muted)}
.wlFold.open>.wlFoldHead .wlChev{transform:rotate(180deg)}
.wlFold>.wlFoldBody{display:none;flex-direction:column;gap:10px}
.wlFold.open>.wlFoldBody{display:flex}
`;
const SCREEN=`<div class="card">
<div class="wl-hero">
<div class="wl-kick">PILOT SWAP BOARD · เริ่มใช้งาน</div>
<h2 class="wl-h">ใส่ roster ครั้งเดียว แล้วเริ่มหาคู่แลกได้เลย</h2>
<p class="wl-sub">บอร์ดจะรู้ว่าคุณบินวันไหน ว่างวันไหน แลกกับใครได้ตามกฎ OM-A และกรอกฟอร์มขอแลกให้ · ตารางเดียวกันใช้ใน Crew Brief (เวลาปลุก brief FDP) ด้วย</p>
</div>
<ol class="wl-steps">
<li><span><b>แคปหน้าจอ roster</b> จาก vzportal.merlot.aero → Employee Roster Report (ยาวเกินจอให้แคปหลายรูปซ้อนกันเล็กน้อย)</span></li>
<li><span><b>แตะปุ่มด้านล่าง</b> จะเปิดหน้าใส่ roster ของ Crew Brief แล้วเลือกรูปที่แคปไว้ กด อ่านตาราง</span></li>
<li><span><b>อ่านเสร็จกด กลับไปบอร์ด</b> ตารางของคุณจะอยู่ที่แท็บ ตารางฉัน ทันที</span></li>
</ol>
<a class="btn primary wl-pick" id="wlPick" href="${BRIEF}">📷 ใส่ roster →</a>
<p class="wl-why">อ่านด้วยตัวอ่านของ Crew Brief ได้เวลา sector ครบ ใช้ได้ทั้งสองแอปโดยไม่ต้องอัปสองรอบ</p>
<div class="wl-ex" id="wlEx"><h3>หน้าที่ต้องแคป หน้าตาแบบนี้</h3></div>
<div class="wl-alt">ยังไม่มี roster? <a href="#" id="wlSkip">ดูบอร์ดก่อน</a><a href="#" id="wlManual">ใส่วันเองทีละวัน</a></div>
</div>`;
let sec=null,entered=false,exited=false,fromBrief=false;
try{fromBrief=new URLSearchParams(location.search).get("from")==="brief"}catch{}
const S=()=>window.FOSTATE;
function myDays(){try{const s=S();return (s&&s.me&&s.rosters&&s.rosters[s.me]&&s.rosters[s.me].days)||[]}catch{return[]}}
function ready(){try{const s=S();return !!(s&&s.me&&s.rostersLoaded&&s.membersLoaded&&(typeof isApproved!="function"||isApproved(s.me)))}catch{return false}}
let styled=false;
function styles(){if(styled)return;styled=true;const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st)}
function mount(){
  if(sec)return sec;
  styles();
  sec=document.createElement("section");sec.className="section";sec.id="tab-welcome";sec.hidden=true;
  const anchor=$("#tab-free")||$("#appView .wrap");anchor&&(anchor.id==="tab-free"?anchor.insertAdjacentElement("afterend",sec):anchor.appendChild(sec));
  return sec;
}
function enter(){
  if(entered)return;entered=true;
  mount();sec.innerHTML=SCREEN;sec.hidden=false;document.body.classList.add("wl");
  try{const g=window.CB_GUIDE&&window.CB_GUIDE.roster;g&&$("#wlEx").insertAdjacentHTML("beforeend",g)}catch{}
  $("#wlSkip").onclick=e=>{e.preventDefault();exit("board")};
  $("#wlManual").onclick=e=>{e.preventDefault();exit("roster");setTimeout(()=>{fold(true);$("#addRowBtn")?.click()},50)};
  try{window.scrollTo(0,0)}catch{}
}
function exit(tab){
  if(!entered||exited)return;exited=true;
  document.body.classList.remove("wl");sec.hidden=true;
  const b=tab&&document.querySelector('nav.tabs [data-tab="'+tab+'"]');b&&b.click();
}
function note(n){
  const home=$("#tab-roster");if(!home||$("#wlNote"))return;
  const d=document.createElement("div");d.className="card";d.id="wlNote";
  d.innerHTML=`<div class="row"><div><b>✅ ตารางของคุณพร้อมแล้ว · ${n} วัน</b><div class="muted" style="font-size:13px">แตะวันที่อยากปล่อยหรืออยากได้เพื่อประกาศบนบอร์ด · Crew Brief ใช้ตารางเดียวกันนี้</div></div><a class="btn ghost" href="brief.html">เปิด Crew Brief</a></div>`;
  home.prepend(d);
  document.querySelector("nav.tabs")?.addEventListener("click",()=>d.remove(),{once:true});
}
// ตารางฉัน: the board's own upload card folds away behind a header; a hint above it points to Crew Brief
let foldEl=null;
function fold(open){foldEl&&foldEl.classList.toggle("open",open)}
function layoutUpload(){
  const up=$("#rfile")?.closest(".card");if(!up||up.dataset.wlFold)return;up.dataset.wlFold="1";foldEl=up;
  const hint=document.createElement("div");hint.className="card";hint.id="wlUpHint";
  hint.innerHTML=`<div><b>อัปโหลด roster ใหม่</b><div class="muted">อ่านใน Crew Brief ได้เวลา sector ครบ แล้วใช้ได้ทั้งสองแอป</div></div><a class="btn primary" href="${BRIEF}">📷 ใส่ roster ใน Crew Brief →</a>`;
  up.insertAdjacentElement("beforebegin",hint);
  const body=document.createElement("div");body.className="wlFoldBody";
  [...up.children].forEach(c=>body.appendChild(c));
  const h2=body.querySelector("h2");h2&&(h2.style.display="none");
  const head=document.createElement("button");head.type="button";head.className="wlFoldHead";
  head.innerHTML='<span><b>หรืออัปโหลดที่นี่ (แบบย่อ)</b><small>เก็บเฉพาะไฟลต์และเส้นทาง · Crew Brief จะไม่มีเวลา sector</small></span><span class="wlChev">▾</span>';
  up.classList.add("wlFold");up.appendChild(head);up.appendChild(body);
  head.onclick=()=>fold(!up.classList.contains("open"));
  $("#rfile")?.addEventListener("change",()=>fold(true));
  const draft=$("#draftCard");draft&&new MutationObserver(()=>{draft.hidden||fold(true)}).observe(draft,{attributes:true,attributeFilter:["hidden"]});
}
function sync(){
  if(exited||!ready())return;
  const n=myDays().length;
  if(n>0){
    if(entered){exit("roster");note(n)}
    else{exited=true;if(fromBrief){fromBrief=false;try{history.replaceState(null,"",location.pathname+"#swap")}catch{}document.querySelector('nav.tabs [data-tab="roster"]')?.click();note(n)}}
    return;
  }
  enter();
}
if(typeof window.render=="function"){const r=window.render;window.render=function(){const x=r.apply(this,arguments);try{sync()}catch{}return x};window.FORENDER=window.render}
const boot=()=>{try{styles();layoutUpload()}catch{}try{sync()}catch{}};
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot):boot();
})();
