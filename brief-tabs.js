// brief-tabs.js — 4 tabs instead of 7.
// ถัดไป · Brief · ตาราง · อื่นๆ fit a phone screen without scrolling; "อื่นๆ" is a menu panel (#p-more) that opens
// the seldom-used panels (ใส่ roster, ตั้งเวลา, PSWM, เอกสาร), each of which gets a "‹ อื่นๆ" bar at the top.
// showTab(name) keeps working for every old name (links inside the app still call showTab("settings") etc.):
// it is wrapped so the right tab lights up and #p-more shows or hides.
(function(){
"use strict";
const $=id=>document.getElementById(id);
const SUB=["roster","settings","fit","docs"];
const ICON={
  next:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M9 3h6"/></svg>',
  brief:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3.5h6v2H9zM8.5 10h7M8.5 13.5h7M8.5 17h4"/></svg>',
  month:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  more:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>'
};
const TABS=[["next","ถัดไป"],["brief","Brief"],["month","ตาราง"],["more","อื่นๆ"]];
const MENU=[
  ["roster","📷","ใส่ roster","อัปโหลดรูปตาราง Merlot · เพิ่มหรือแก้ duty เอง · ล้างตาราง"],
  ["settings","⏰","ตั้งเวลา","เวลาเดินทาง เตรียมตัว โรงแรม · iPhone ปลุกอัตโนมัติ · แจ้งเตือน"],
  ["fit","😴","PSWM","Prior Sleep–Wake score ก่อนออกจากบ้าน โดยเฉพาะ night duty"],
  ["docs","📄","เอกสาร","วันหมดอายุ license, medical, passport และเอกสารอื่น"]
];
// cabin crew (TG) site: no Brief / PSWM / pilot documents; roster comes from Cabin Connect
const FC=window.FO_CONFIG||{},FT=FC.FEATURES||{},CABIN=FC.ROSTER_SOURCE==="cabinconnect";
const HIDE=new Set([FT.briefOps===false&&"brief",FT.pswm===false&&"fit",FT.pilotDocs===false&&"docs"].filter(Boolean));
if(CABIN)MENU[0][3]="อัปโหลดรูป Roster จาก Cabin Connect · เพิ่มหรือแก้ duty เอง · ล้างตาราง";
const TABS_V=TABS.filter(([k])=>!HIDE.has(k)),MENU_V=MENU.filter(([k])=>!HIDE.has(k));
const CSS=`
nav.tabs{gap:2px;padding:4px}
nav.tabs button{flex:1 1 0;min-width:0;padding:6px 4px 5px;font-size:.74rem;line-height:1.2;display:flex;flex-direction:column;align-items:center;gap:2px}
nav.tabs button svg{width:20px;height:20px;display:block}
#p-more .menu{display:flex;flex-direction:column;gap:10px}
#p-more .tile{display:grid;grid-template-columns:38px 1fr auto;gap:12px;align-items:center;text-align:left;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;color:var(--ink);font:inherit;cursor:pointer;width:100%}
#p-more .tile .ic{font-size:24px;line-height:1;text-align:center}
#p-more .tile b{display:block;font-family:var(--f-display);font-size:1rem}
#p-more .tile small{display:block;color:var(--muted);font-size:.8rem;line-height:1.4;margin-top:2px}
#p-more .tile .chev{color:var(--muted);font-size:1.2rem}
#p-more .tile .badge{display:inline-block;margin-left:8px;font:600 .72rem var(--f-body);padding:2px 8px;border-radius:999px;background:var(--amber-soft);color:var(--amber);vertical-align:2px}#p-more .tile .badge.bad{background:var(--red-soft);color:var(--red)}#p-more .tile small.warn{color:var(--amber)}
.subBack{display:flex;align-items:center;gap:6px;margin:-4px 0 -4px}
.subBack button{appearance:none;background:none;border:0;padding:4px 0;color:var(--info);font:600 .9rem var(--f-body);cursor:pointer}
`;
let nav=null,more=null;
function build(){
  nav=document.querySelector("nav.tabs");if(!nav||nav.dataset.four)return false;nav.dataset.four="1";
  const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
  nav.innerHTML=TABS_V.map(([k,l])=>`<button role="tab" data-tab="${k}" aria-selected="false" type="button">${ICON[k]}<span>${l}</span></button>`).join("");
  nav.querySelectorAll("button").forEach(b=>b.onclick=()=>{typeof showTab=="function"&&showTab(b.dataset.tab)});
  more=document.createElement("section");more.className="panel";more.id="p-more";more.hidden=true;
  more.innerHTML=`<div class="menu">${MENU_V.map(([k,ic,t,d])=>`<button type="button" class="tile" data-open="${k}"><span class="ic">${ic}</span><span><b>${t}</b><small>${d}</small></span><span class="chev">›</span></button>`).join("")}</div>
<a class="tile" href="guide.html" style="text-decoration:none;margin-top:10px"><span class="ic">📖</span><span><b>วิธีใช้</b><small>สอนตั้งแต่เริ่ม: ใส่ roster · ตั้งปลุก · ปฏิทิน iPhone / Google</small></span><span class="chev">›</span></a>
<div class="small muted" style="text-align:center"><a href="index.html#menu" style="color:var(--muted)">เมนูหลัก · ${(FC.BRAND&&FC.BRAND.board)||"Pilot Swap Board"}</a></div>`;
  const last=$("p-docs")||$("p-settings");last?last.insertAdjacentElement("afterend",more):nav.insertAdjacentElement("afterend",more);
  more.addEventListener("click",e=>{const b=e.target.closest("[data-open]");b&&typeof showTab=="function"&&showTab(b.dataset.open)});
  SUB.forEach(k=>{const p=$("p-"+k);if(!p||p.querySelector(".subBack"))return;const d=document.createElement("div");d.className="subBack";d.innerHTML='<button type="button">‹ อื่นๆ</button>';d.querySelector("button").onclick=()=>showTab("more");p.prepend(d)});
  return true;
}
// "เอกสาร" tile: how many documents run out within 60 days (same rule as the checklist), red when one has already expired
function docBadge(){
  const tile=more?.querySelector('[data-open="docs"]');if(!tile)return;
  let soon=[];try{if(typeof DOCS==="object"&&Array.isArray(DOC_LIST)){const now=Date.now();soon=DOC_LIST.filter(([k])=>DOCS[k]).map(([k,n])=>({n,d:Math.floor((Date.parse(DOCS[k]+"T23:59:00+07:00")-now)/864e5)})).filter(x=>x.d<=60).sort((a,b)=>a.d-b.d)}}catch{}
  const b=tile.querySelector("b"),sm=tile.querySelector("small");if(!b||!sm)return;
  tile.querySelector(".badge")?.remove();
  if(!soon.length){sm.textContent=MENU.find(m=>m[0]==="docs")[3];sm.classList.remove("warn");return}
  const exp=soon.filter(x=>x.d<0).length,sp=document.createElement("span");sp.className="badge"+(exp?" bad":"");sp.textContent=exp?`⛔ หมดอายุ ${exp}`:`⚠ ใกล้หมดอายุ ${soon.length}`;b.appendChild(sp);
  sm.textContent=soon.map(x=>`${x.n} ${x.d<0?`หมดแล้ว ${-x.d} วัน`:x.d===0?"หมดวันนี้":`อีก ${x.d} วัน`}`).join(" · ");sm.classList.add("warn");
}
function light(e){
  const t=SUB.includes(e)?"more":e;
  if(e==="more")docBadge();
  nav.querySelectorAll("button").forEach(b=>b.setAttribute("aria-selected",b.dataset.tab===t?"true":"false"));
  more.hidden=e!=="more";
  if(e==="more")try{window.scrollTo(0,0)}catch{}
}
function init(){
  if(!build())return;
  docBadge();setTimeout(docBadge,1500);
  if(typeof window.showTab=="function"){const o=window.showTab;window.showTab=function(e){if(HIDE.has(e))e="next";const r=o.apply(this,[e]);try{light(e)}catch{}return r}}
  // light the tab the page opened on (the inline script restored it from localStorage before this ran)
  let cur="next";try{cur=localStorage.getItem("cb_tab")||"next"}catch{}
  const shown=["next","brief","month",...SUB].find(k=>{const p=$("p-"+k);return p&&!p.hidden});
  if(HIDE.has(shown||cur)){window.showTab("next");return}
  light(shown||cur);
  if(cur==="more"&&!shown)light("more");
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init):init();
})();
