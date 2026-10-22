// brief-summary.js — the Brief tab shows the result first.
// Top of the tab: duty picker, one "⚡ เตรียม brief" button that fetches aircraft/gate (OMC sheet), TAF/METAR and
// NOTAM together, three status chips, and the same one-page summary the print button makes (brief-print.js
// buildHtml, rendered in a shadow root with screen colours). The five detail cards (MEL text, paste TAF/METAR,
// paste NOTAM, radar, inbound) move under one folded "แก้เอง" section. The page's own auto-fetch on opening the
// tab (fetchOps/fetchWx quiet, NOTAM auto timer in brief-shim) is unchanged; this only changes what is shown.
(function(){
"use strict";
const $=id=>document.getElementById(id);
const CSS=`
#b_prep{display:flex;flex-direction:column;gap:10px}
#b_prepRow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#b_prepBtn{min-height:48px;font-size:1rem;flex:1 1 auto;border-radius:12px}
#b_prepBtn.quiet{flex:0 0 auto;min-height:40px;font-size:.88rem}
#b_prepWhen{font-size:.82rem;color:var(--muted)}
#b_chips{display:flex;gap:6px;flex-wrap:wrap}
#b_chips button{appearance:none;border:1px solid var(--line);background:var(--sunk);color:var(--ink);font:500 .8rem var(--f-body);padding:5px 10px;border-radius:999px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;max-width:100%}
#b_chips button b{font-weight:600}
#b_chips button.ok{border-color:var(--green);background:var(--green-soft)}
#b_chips button.busy{border-color:var(--info);background:var(--info-soft)}
#b_chips button.bad{border-color:var(--amber);background:var(--amber-soft)}
#b_chips button .spin{width:11px;height:11px;border-width:2px}
#b_opsPaste{display:none;flex-direction:column;gap:6px;border:1px solid var(--amber);background:var(--amber-soft);border-radius:12px;padding:10px 12px}
#b_opsPaste.on{display:flex}
#b_opsPaste .lead{font-size:.84rem;line-height:1.45}
#b_opsPaste .omcPaste>summary{display:none}
#b_opsPaste .omcPasteIn{margin-top:0}
#b_opsPaste .omcPasteIn input{flex:1 1 200px;min-width:0;padding:9px 10px;font-size:.9rem}
#b_opsPaste .omcPasteIn .btn{min-height:40px}
#b_altRow{display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap;font-size:.82rem}
#b_altRow .lbl{font-weight:600;color:var(--muted);padding-top:7px;white-space:nowrap}
#b_altRow .grid2{display:flex!important;flex-wrap:wrap;gap:6px 12px;flex:1 1 auto}
#b_altRow label.f{flex-direction:row;align-items:center;gap:6px;font-size:.8rem;font-weight:500;white-space:nowrap}
#b_altRow label.f small{display:none}
#b_altRow input{width:72px;padding:5px 6px;font-size:.88rem;text-transform:uppercase;font-family:var(--f-mono)}
#b_altHint{font-size:.76rem;color:var(--muted);width:100%;margin-top:-4px}
#b_sum{display:block;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--surface)}
#b_sumEmpty{color:var(--muted);font-size:.88rem}
#b_legs{display:none}
#b_tools{border:1px solid var(--line);border-radius:12px;padding:0;background:var(--surface)}
#b_tools>summary{padding:12px 14px;font-size:.95rem;color:var(--ink);font-weight:600;display:flex;justify-content:space-between;align-items:center;gap:10px}
#b_tools>summary small{display:block;font-weight:400;color:var(--muted);font-size:.8rem;margin-top:2px}
#b_tools>summary .chev{transition:transform .2s;color:var(--muted)}
#b_tools[open]>summary .chev{transform:rotate(180deg)}
#b_melAuto,#b_tafOut,#b_tools .srcbox,#b_wxM1,#b_wxM2,#b_wxM2+.small,#b_notamM1,#b_notamM2,#b_notamM2+.small,#b_opsOut>.small.muted,#b_notamOut>.leg,#b_notamOut>.note.warn,#b_tools .card>p.small.muted{display:none!important}
#p-next label.row{flex-wrap:nowrap}#p-next label.row>span{flex:1 1 auto;min-width:0}
#b_tools details.sub{border:1px dashed var(--line);border-radius:10px;padding:8px 10px;display:grid;gap:8px}#b_tools details.sub>summary{font-size:.86rem;font-weight:600;color:var(--info)}#b_tools details.sub:not([open])>summary{margin:0}
#b_tools>.card{border-radius:0;border:0;border-top:1px solid var(--line)}
#b_tools>.card:last-child{border-radius:0 0 12px 12px}
`;
// screen version of the report stylesheet: page colours via --p-* copied onto the host element
const SCREEN=`
:host{display:block;background:var(--p-surface);color:var(--p-ink);font-size:13.5px;line-height:1.4;padding:10px;
  --ink:var(--p-ink);--text:var(--p-ink);--muted:var(--p-muted);--line:var(--p-line);--soft:var(--p-sunk);
  --green:var(--p-green);--green-soft:var(--p-green-soft);--amber:var(--p-amber);--amber-soft:var(--p-amber-soft);
  --red:var(--p-red);--red-soft:var(--p-red-soft);--blue:var(--p-info);--blue-soft:var(--p-info-soft)}
.pg{gap:8px}
.hdr{background:#0E1620;color:#fff;padding:10px 12px;border-radius:10px}
.code{font-size:20px}.route{font-size:13px}.date{font-size:14px}
.tiles{grid-template-columns:repeat(3,1fr);gap:6px}
.tile{padding:5px 8px;min-width:0}.tile span{font-size:11px}.tile b{font-size:17px}.tile em{font-size:10.5px;display:block;margin:0}
.fdp{padding:6px 10px}
.card{padding:8px 10px;overflow-x:auto}
h3{font-size:14px;margin-bottom:4px;flex-wrap:wrap;row-gap:0}h3 small{font-size:11px;flex-basis:100%}
table{min-width:100%}
.lg table{min-width:0}
@media (max-width:520px){.lg th:nth-child(1),.lg td:nth-child(1),.lg th:nth-child(6),.lg td:nth-child(6),.lg th:nth-child(8),.lg td:nth-child(8){display:none}.lg .z{display:block;margin:0;white-space:nowrap}.lg td{white-space:normal}.hdr .who,.hdr .who2{display:none}.hdr .hr{min-width:0}}
.nt tr.off{display:none}.nt.showoff tr.off{display:table-row}.nt tr.fold{display:none!important}.nt tr.ad td{cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none}.nt tr.ad .chev{float:right;color:var(--p-muted);transition:transform .2s;margin-left:6px}.nt tr.ad.open .chev{transform:rotate(180deg)}.nt tr.ad .hi{color:var(--p-red);font-weight:600}.nt tr.ad .offbtn{display:block;margin:4px 0 0}
.nt tr.ad td{position:relative}.nt .offbtn{appearance:none;border:1px solid var(--p-line);background:transparent;color:var(--p-muted);font:500 11px var(--f-body);border-radius:999px;padding:2px 8px;margin-left:6px;cursor:pointer}
th{font-size:11px;padding:3px 5px}td{padding:3px 5px;font-size:12.5px}
.wx td{font-size:12.5px}.nt td{font-size:12.5px}
.pill{font-size:11px}
.melref{cursor:pointer;background:var(--soft);border:1px solid var(--line);border-radius:6px;padding:1px 6px;white-space:nowrap;-webkit-tap-highlight-color:transparent}.melref::after{content:" ⧉";font-weight:400;color:var(--muted)}.melref.ok{background:var(--green-soft);border-color:var(--green);color:var(--green)}.melref.ok::after{content:" ✓"}.melhint{font-size:11px;color:var(--muted);margin-top:4px}.fr24{display:block;text-align:center;text-decoration:none;font-weight:600;font-size:13px;color:#fff;background:var(--blue);border-radius:9px;padding:8px 10px}#b_radarCard h3{font-size:1rem}
.thl li{font-size:12.5px;padding-left:8px}
.acft b{font-size:14px;white-space:nowrap}.acft span{font-size:10.5px}.acft div{padding:4px 8px}.acl .mel{font-size:12.5px;max-width:none;background:var(--soft);border-radius:8px;padding:5px 8px}
@media (max-width:640px){.ac{grid-template-columns:1fr;gap:8px}.acl{grid-template-columns:1fr 1fr;gap:6px;align-items:stretch}.acl .acft{grid-column:1/-1}.acl .mel{margin:0}.acl .fr24{grid-column:1/-1}.acl .mel:only-of-type{grid-column:1/-1}.ac>div:last-child .mel{padding:3px 0}}
.mel{font-size:12.5px}.note{font-size:12px}.raw{font-size:11px;color:var(--p-ink)}.src{font-size:11px}
.nt tr.off td{color:var(--p-muted)}
.empty{font-size:12.5px}
.ftr{display:none}
.p2h{display:none}
`;
const VARS=["surface","ink","muted","line","sunk","green","green-soft","amber","amber-soft","red","red-soft","info","info-soft"];
let box=null,root=null,tmr=null,tick=null,layoutDone=false;
const cur=()=>{try{return sorted().find(d=>key(d)===briefKey)}catch{return null}};
const rec=()=>{try{return BR[briefKey]||{}}catch{return{}}};
const hm=ms=>{try{const o=cur();return local(ms,(o?.from||S.base||"BKK").toUpperCase()).hm}catch{return""}};

function layout(){
  if(layoutDone)return;const p=$("p-brief");if(!p)return;layoutDone=true;
  const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
  const cards=[...p.querySelectorAll(":scope > .card")];const top=cards[0];if(!top)return;
  // prep block: button + chips + summary, placed after the duty picker row
  const prep=document.createElement("div");prep.id="b_prep";
  prep.innerHTML=`<div id="b_prepRow"><button class="btn primary" type="button" id="b_prepBtn">⚡ เตรียม brief อัตโนมัติ</button><span id="b_prepWhen"></span></div>
<div id="b_chips"><button type="button" data-go="b_ops">เครื่อง / gate <b>—</b></button><button type="button" data-go="b_fetch">TAF / METAR <b>—</b></button><button type="button" data-go="b_notamAuto">NOTAM <b>—</b></button></div>
<div id="b_opsPaste"><div class="lead"><b>ชีตวันบินนี้ยังไม่มีในระบบ</b> · วางลิงก์ชีต <b>GATE &amp; ACFT STATUS</b> ของวันบินจากกลุ่ม LINE AIRBUS TVJ Operations ตรงนี้ คนแรกคนเดียวแล้วทุกคนใช้ได้ (ชีตของแต่ละวันออกช่วงบ่ายของวันก่อน)</div></div>
<div id="b_altRow"></div><div id="b_altHint">ALT ตาม OFP (เช่น UTP หรือ VTBU) · ใส่แล้วดึงอากาศ/NOTAM ของ ALT ให้ · จำไว้ต่อปลายทาง</div>
<div id="b_sum"></div><div id="b_sumEmpty" hidden></div>`;
  const legs=$("b_legs");legs?legs.insertAdjacentElement("beforebegin",prep):top.appendChild(prep);
  const alts=$("b_alts");if(alts){$("b_altRow").appendChild(alts);alts.addEventListener("change",e=>{const v=String(e.target.value||"").trim();if(!cur())return;setTimeout(()=>{try{typeof fetchWx=="function"&&fetchWx(false)}catch{}const na=$("b_notamAuto");na&&!na.disabled&&v&&na.click();chips()},350)})}
  // print / PDF buttons go under the summary
  const pr=$("b_print")?.parentElement;if(pr){const lay=$("b_layout");lay&&prep.appendChild(lay);prep.appendChild(pr);const m=$("b_printMsg");m&&prep.appendChild(m)}
  // weather radar links stay in view, right after the print buttons
  const rad=$("b_radar")?.closest(".card");if(rad){rad.id="b_radarCard";prep.appendChild(rad)}
  // the five detail cards fold away
  const det=document.createElement("details");det.id="b_tools";det.className="more";
  det.innerHTML=`<summary><span>🔧 แก้เอง / ใส่ข้อมูลเพิ่ม<small>ดึงเครื่อง/gate · TAF/METAR · NOTAM · วางเองจาก AeroWeather · โน้ต MEL</small></span><span class="chev">▾</span></summary>`;
  top.insertAdjacentElement("afterend",det);
  cards.slice(1).filter(c=>c.id!=="b_radarCard").forEach(c=>det.appendChild(c));
  tidyTools(det);
  $("b_prepBtn").onclick=prep_;
  $("b_chips").addEventListener("click",e=>{const b=e.target.closest("button[data-go]");if(!b)return;if(b.dataset.go==="b_ops"&&$("b_opsPaste")?.classList.contains("on")){$("b_opsPaste").querySelector("input")?.focus();return}det.open=true;const t=$(b.dataset.go);if(t){const d2=t.closest("details.more");d2&&d2!==det&&(d2.open=true)}t&&setTimeout(()=>t.closest(".card")?.scrollIntoView({behavior:"smooth",block:"start"}),50)});
  box=$("b_sum");root=box.attachShadow({mode:"open"});
  // MEL number: tap to copy (search it in the MEL / tech log)
  root.addEventListener("click",e=>{const el=e.target.closest(".melref");if(!el)return;const v=el.dataset.copy||el.textContent.trim();if(!v)return;
    const done=ok=>{root.querySelectorAll(".melref.ok").forEach(x=>x.classList.remove("ok"));if(ok){el.classList.add("ok");setTimeout(()=>el.classList.remove("ok"),1800)}};
    const fb=()=>{try{const t=document.createElement("textarea");t.value=v;t.style.cssText="position:fixed;opacity:0";document.body.appendChild(t);t.select();const ok=document.execCommand("copy");t.remove();done(ok)}catch{done(false)}};
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(v).then(()=>done(true),fb);else fb()});
}
// the folded cards: everything the summary already shows is hidden, the manual AeroWeather paste flows fold once more
function tidyTools(det){
  const cardOf=id=>$(id)?.closest(".card");
  const fold=(fromEl,toEl,title)=>{if(!fromEl||fromEl.closest("details.sub"))return;const d=document.createElement("details");d.className="more sub";d.innerHTML=`<summary>${title}</summary>`;
    let n=fromEl;const list=[];while(n){list.push(n);if(n===toEl)break;n=n.nextElementSibling}fromEl.before(d);list.forEach(x=>d.appendChild(x));return d};
  // brief-shim opens the closest <details> around #b_melAuto when a MEL is about to expire (the summary shows that
  // itself now): give the hidden block its own wrapper so the whole tools section does not pop open
  const ma=$("b_melAuto");if(ma&&!ma.closest("details.sub")){const w=document.createElement("details");w.hidden=true;ma.before(w);w.appendChild(ma)}
  // 1 · aircraft: per-flight FR24 links join this card (card 5 goes)
  const ops=$("b_opsOut"),fr=$("b_fr24");if(fr&&ops){const c5=fr.closest(".card");const lab=document.createElement("div");lab.className="small muted";lab.textContent="FR24 รายไฟลท์:";ops.after(lab,fr);c5&&c5!==fr.closest(".card")&&c5.remove()}
  // the "วิธี 1 / วิธี 2" blocks are added by brief-shim a moment later: once they exist, the manual flows fold
  let tries=0;const late=()=>{
    const w2=$("b_wxM2"),n2=$("b_notamM2");
    if(!w2||!n2){if(tries++<20)setTimeout(late,400);return}
    fold(w2,$("b_wxImgMsg")||$("b_taf")?.closest("label"),"📋 วาง METAR/TAF เองจาก AeroWeather (แม่นยำกว่า) ›");
    const c3=cardOf("b_notamAuto"),faa=c3?.querySelector(":scope > .row"),autoRow=$("b_notamAuto")?.closest(".row"),sumRow=$("b_notamBtn")?.closest(".row");
    const d=fold(n2,sumRow||$("b_notamImgMsg"),"📋 ค้นเอง / วาง NOTAM เองจาก AeroWeather หรือ FAA ›");
    if(d&&faa&&faa!==autoRow)d.insertBefore(faa,d.children[1]||null);
  };late();
}
function hostVars(){const cs=getComputedStyle(document.documentElement);VARS.forEach(v=>box.style.setProperty("--p-"+v,cs.getPropertyValue("--"+v).trim()||""))}

let melWaiting=false;const ntOpen=new Set();
function relabelAlts(){document.querySelectorAll("#b_altRow #b_alts label.f").forEach(l=>{const t=l.firstChild;t&&t.nodeType===3&&(t.nodeValue=t.nodeValue.replace(/^\s*ALT ขา (\d+) \(ปลายทาง ([A-Z]{3})\)\s*$/,"ขา $1 → $2 · ALT"));const i=l.querySelector("input");i&&(i.placeholder="เช่น UTP")})}
function render(){
  relabelAlts();
  if(!root||!window.ccBrief)return;
  let html=null;
  try{html=window.ccBrief.build(window.ccBrief.cached())}catch(e){console.warn("brief summary",e)}
  const empty=$("b_sumEmpty");
  if(!html){box.hidden=true;empty.hidden=false;empty.textContent="ยังไม่มี flight duty ในตาราง · ใส่ roster ก่อน";return}
  box.hidden=false;empty.hidden=true;hostVars();
  root.innerHTML=`<style>${window.ccBrief.css.replace(/#ccPrint\{/g,":host{").replace(/#ccPrint /g,"")}${SCREEN}</style>${html}`;
  const t=root.querySelector("table");t&&t.closest(".card")?.classList.add("lg");
  {const acl=root.querySelector(".acl");if(acl){const reg=String(((typeof BR!=="undefined"&&BR[briefKey])||{}).reg||"").trim().toUpperCase().replace(/^HS-?/,"HS-");const a=document.createElement("a");a.className="fr24";a.target="_blank";a.rel="noopener";
    a.href=reg?"https://www.flightradar24.com/data/aircraft/"+encodeURIComponent(reg.toLowerCase()):"https://www.flightradar24.com/data/airlines/vz-tvj";a.textContent=reg?`✈️ เครื่อง ${reg} ตอนนี้อยู่ไหน (FR24) ↗`:"✈️ ฝูงบิน TVJ ตอนนี้ (FR24) ↗";acl.appendChild(a)}}
  {const last=[...root.querySelectorAll(".mel")].filter(m=>m.querySelector(".melref")).pop();if(last){const h=document.createElement("div");h.className="melhint";h.textContent="แตะเลข MEL เพื่อคัดลอก แล้วไปค้นในคู่มือ MEL (GoodReader)";last.after(h)}}
  // NOTAMs that do not overlap the duty window stay folded per aerodrome; a small button shows them
  // NOTAM: one aerodrome at a time — headers are tap-to-open, rows start folded (open ones stay open across re-renders)
  root.querySelectorAll(".nt tr.ad").forEach(h=>{const icao=h.querySelector("b")?.textContent.trim()||"";const rows=[];let n=0,hi=0,r=h.nextElementSibling;
    while(r&&!r.classList.contains("ad")){rows.push(r);r.classList.contains("off")?n++:r.querySelector(".pill.bad")&&hi++;r=r.nextElementSibling}
    const td=h.querySelector("td");if(hi){const x=document.createElement("span");x.className="hi";x.textContent=` · high ${hi}`;td.appendChild(x)}
    const ch=document.createElement("span");ch.className="chev";ch.textContent="▾";td.appendChild(ch);
    let b=null;if(n){b=document.createElement("button");b.type="button";b.className="offbtn";b.textContent="+"+n+" ไม่ทับช่วงบิน";td.appendChild(b);
      b.onclick=ev=>{ev.stopPropagation();const on=b.dataset.on!=="1";rows.forEach(x=>x.classList.contains("off")&&(x.style.display=on?"table-row":""));b.dataset.on=on?"1":"";b.textContent=on?"− ซ่อนที่ไม่ทับช่วงบิน":"+"+n+" ไม่ทับช่วงบิน"}}
    const apply=()=>{const open=ntOpen.has(icao);h.classList.toggle("open",open);rows.forEach(x=>x.classList.toggle("fold",!open));if(!open&&b){b.dataset.on="";b.textContent="+"+n+" ไม่ทับช่วงบิน";rows.forEach(x=>x.classList.contains("off")&&(x.style.display=""))}b&&(b.style.display=open?"":"none")};
    apply();h.addEventListener("click",()=>{ntOpen.has(icao)?ntOpen.delete(icao):ntOpen.add(icao);apply()})});
  if(!window.ccBrief.cached()&&!melWaiting){melWaiting=true;window.ccBrief.mel().then(()=>{melWaiting=false;schedule()}).catch(()=>{melWaiting=false})}
}
function schedule(){clearTimeout(tmr);tmr=setTimeout(()=>{try{render();chips()}catch{}},250)}

// the shim adds a "วางลิ้ง OMC" row under #b_opsOut (folded tools); when the day's sheet is missing it is pulled up here
function pasteBlock(show){
  const box=$("b_opsPaste");if(!box)return;
  if(show&&!box.querySelector(".omcPaste")){const row=$("b_opsOut")?.nextElementSibling;row&&row.classList.contains("omcPaste")&&(row.open=true,box.appendChild(row))}
  box.classList.toggle("on",show&&!!box.querySelector(".omcPaste"));
}
function chips(){
  const c=$("b_chips");if(!c)return;const r=rec(),o=cur();
  const set=(i,cls,txt)=>{const b=c.children[i];if(!b)return;b.className=cls;b.querySelector("b").innerHTML=txt};
  const busy=id=>!!$(id)?.disabled;
  // aircraft / gate
  const regs=[String(r.reg||"")].concat((r.ops||[]).map(x=>x.f?.ac||"")).filter(Boolean);
  const gate=(r.ops||[]).find(x=>x.i===0)?.f?.gate||r.gate||"";
  let opsState="";
  if(busy("b_ops"))set(0,"busy",'<span class="spin"></span> กำลังหา');
  else if(regs.length)set(0,"ok",esc(regs[0])+(gate?" · gate "+esc(gate):""));
  else if(r.opsAt){set(0,"bad","ยังไม่มีในชีต OMC");opsState="missing"}
  else set(0,"","—");
  pasteBlock(opsState==="missing");
  // weather
  if(busy("b_fetch"))set(1,"busy",'<span class="spin"></span> กำลังดึง');
  else if(r.wxAt||r.taf)set(1,"ok",r.wxAt?hm(r.wxAt):"วางเอง");
  else set(1,"","—");
  // notam
  const n=(r.notamSum?.airports||[]).reduce((a,x)=>a+(x.items||[]).length,0);
  if(busy("b_notamAuto")||busy("b_notamBtn"))set(2,"busy",'<span class="spin"></span> กำลังดึง');
  else if(r.notamSum)set(2,"ok",n+" รายการ");
  else if(r.notam)set(2,"bad","ยังไม่สรุป");
  else set(2,"","—");
  const btn=$("b_prepBtn"),when=$("b_prepWhen");
  const anyBusy=busy("b_ops")||busy("b_fetch")||busy("b_notamAuto")||busy("b_notamBtn");
  const done=!!(r.opsAt||r.wxAt||r.notamSum);
  if(btn){btn.disabled=anyBusy;btn.textContent=anyBusy?"กำลังเตรียม…":done?"↻ ดึงใหม่":"⚡ เตรียม brief อัตโนมัติ";btn.classList.toggle("quiet",done&&!anyBusy);btn.classList.toggle("primary",!done)}
  if(when){const ts=Math.max(r.opsAt||0,r.wxAt||0,r.notamAutoAt||0);when.textContent=anyBusy?"ดึงเครื่อง/gate · TAF/METAR · NOTAM พร้อมกัน":ts?"อัปเดตล่าสุด "+hm(ts)+" · เปิดแท็บนี้ใกล้วันบินจะดึงให้เอง":o?"ดึงเครื่อง/gate · TAF/METAR · NOTAM ให้ในครั้งเดียว":""}
}
async function prep_(){
  if(!cur())return;
  const det=$("b_tools");
  try{typeof fetchOps=="function"&&fetchOps(false)}catch{}
  try{typeof fetchWx=="function"&&fetchWx(false)}catch{}
  const na=$("b_notamAuto");if(na&&!na.disabled)na.click();
  else if(!na&&det){det.open=true}
  chips();
}
// re-render when anything about the brief changes: the page saves BR to localStorage (cb_brief) on every change
function hooks(){
  if(typeof window.renderBrief=="function"){const rb=window.renderBrief;window.renderBrief=function(){const x=rb.apply(this,arguments);schedule();return x}}
  const d=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){d.call(this,k,v);if(this===localStorage&&(k==="cb_brief"||k==="cb_altdef"))schedule()};
  const mo=new MutationObserver(schedule);
  ["b_opsOut","b_tafOut","b_metarOut","b_notamOut","b_legs","b_opsMsg","b_fetchMsg","b_notamAutoMsg"].forEach(id=>{const e=$(id);e&&mo.observe(e,{childList:true,subtree:true,characterData:true})});
  const p=$("p-brief");
  const vis=()=>{clearInterval(tick);if(p&&!p.hidden){chips();tick=setInterval(chips,1000)}};
  p&&new MutationObserver(vis).observe(p,{attributes:true,attributeFilter:["hidden"]});vis();
  window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change",schedule);
  new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
}
function init(){
  layout();if(!layoutDone)return;
  hooks();
  // b_notamAutoMsg is added by brief-shim after load; observe it once it exists
  setTimeout(()=>{const e=$("b_notamAutoMsg");e&&new MutationObserver(schedule).observe(e,{childList:true,characterData:true,subtree:true})},1500);
  schedule();
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init):init();
})();
