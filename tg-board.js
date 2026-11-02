// tg-board.js — TG site (FO_CONFIG.AIRLINE === "TG") only.
// 1. Aircraft types: the member ticks the types they are qualified on (saved on this device); the board hides
//    posts of other types. Posts whose type is unknown stay, labelled "ไม่ระบุแบบเครื่อง".
// 2. TCAR check: same rules as the TVJ site (tcar.js) but explained in plain words, without manual references.
// 3. Pay: each give post shows its TPI pay (PPB) and the difference against the viewer's own duties on those dates.
// 4. Two-way swap check: can I take their duty, and can they take mine back, without a clash (ccHint / ccCheckPanel).
// index.html calls window.ccPostFilter(post) and window.ccAcTag(post) while drawing the board.
(function () {
  "use strict";
  const C = window.FO_CONFIG || {};
  if (C.AIRLINE !== "TG") return;

  // ── aircraft types ──
  const TYPES = [
    ["350", "A350", /^(35|359|350|A35)/],
    ["330", "A330", /^(33|330|332|333|A33)/],
    ["777", "B777", /^(77|777|773|77W|B77)/],
    ["787", "B787", /^(78|787|788|789|B78)/],
    ["320", "A320", /^(320|32A|A320)$/],
    ["32W", "A321neo", /^(321|32N|32Q|32W|A321)/],
  ];
  const KEY = "cc_ac_types";
  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return Array.isArray(v) ? v : null; } catch { return null; } };
  const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };
  let mine = load();                       // null = not set yet → show everything
  const typeOf = (p) => {
    const raw = String(p?.ac || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!raw) return null;
    const t = TYPES.find((x) => x[2].test(raw));
    return t ? t[0] : null;
  };

  // ── TPI pay per duty (Summer TPI 2025, picture sent by the owner: "Ref: SCC ppb:650 /landing:300, Block time: apr 2025") ──
  // key = first flight number of the round trip; value = PPB in baht (null = "-" in the table, no figure)
  const TPI = {
    "900":14558,"910":17863,"916":17645,"920":16508,"922":16670,"924":16345,"930":17266,"934":17212,"940":16887,"950":16670,"954":17591,"960":17266,"970":16887,
    "481":10537,"483":11026,"461":14016,"465":14016,"471":14016,"475":14016,"648":8925,"622":9477,"672":8967,"644":9845,"646":null,"682":10333,"660":10333,
    "640":10333,"642":10441,"676":9833,"670":11037,"652":8912,
    "656":9412,"658":9412,"600":5121,"602":5121,"606":null,"612":4471,"614":8046,"618":5662,"620":6041,"624":5824,"628":5121,"630":6258,"632":6421,"634":6421,
    "636":6421,"638":5121,"662":7841,"664":7341,"668":5392,"674":null,"550":3496,"556":3496,"560":3984,"564":3984,"570":3279,"574":3388,"584":3279,"586":3279,
    "588":null,"431":7125,"433":6204,
    "435":6204,"439":7125,"401":4579,"403":4579,"407":4579,"409":4579,"413":4579,"415":4417,"417":4417,"425":3984,"301":3550,"303":3496,"307":6975,"309":6596,
    "313":5458,"315":7895,"317":7842,"319":6096,"321":4850,"323":7395,"325":6975,"327":null,"329":6704,"331":7895,"335":null,"337":6552,"339":5404,"341":8491,
    "343":7950,"345":8058,"347":7354,
    "349":8762,"351":7950,"002":3117,"008":3062,"020":3062,"028":3170,"040":2954,"042":3062,"044":3008,"046":2900,"102":3388,"110":3388,"112":3388,"120":3279,
    "130":3604,"132":3604,"136":3333,"201":3550,"203":3604,"205":3604,"207":3604,"211":3604,"215":3550,"217":3604,"221":3604,"225":3376,"241":3388,"249":3388,
    "259":3496,"263":3604,"267":3604,
  };
  const fltKey = (x) => { const n = String(x).replace(/\D/g, ""); return n ? String(+n).padStart(3, "0") : ""; };
  /** PPB of a duty code like "618/619" or "TG910/911" (sum of the round trips in it): {pay, keys} · pay null = not in the table */
  function ppbOf(code) {
    const keys = String(code || "").split(/[\/,+ ]+/).map(fltKey).filter((k) => k && k in TPI);
    if (!keys.length || keys.some((k) => TPI[k] == null)) return { pay: null, keys };
    return { pay: keys.reduce((a, k) => a + TPI[k], 0), keys };
  }
  const baht = (n) => "฿" + Math.round(n).toLocaleString("en-US");
  const prevIso = (d) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); };
  const nextIso = (d) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };
  const isIso = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
  const isMultiP = (e) => isIso(e?.until) && e.until > e.date;
  const h = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const TH_MS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const dShort = (iso) => isIso(iso) ? `${+iso.slice(8)} ${TH_MS[+iso.slice(5, 7) - 1]}` : String(iso || "");
  const DUTY = { SBY: "สแตนด์บาย", RSV: "Reserve", LVE: "วันลา", TRN: "ฝึก", OTH: "งานอื่น", FLT: "ไฟลต์" };
  const WORKT = new Set(["FLT", "SBY", "RSV", "TRN", "OTH"]);
  const codeOf = (d) => d.code || DUTY[d.type] || d.type;

  // ── trips: outbound TGn (odd) whose return TG(n+1) is on a later day; the days between are layovers, not days off ──
  // (rosters read before the reader linked trips, and the poster's roster from a LINE picture, are linked here)
  function linkDays(days) {
    const out = (days || []).filter((d) => d && isIso(d.date)).map((d) => ({ ...d }));
    const by = new Map(out.map((d) => [d.date, d]));
    const nums = (d) => String(d.code || "").split("/").map((x) => x.replace(/\D/g, "")).filter(Boolean);
    for (const d of [...out].sort((a, b) => a.date.localeCompare(b.date))) {
      if (d.type !== "FLT" || d.code === "-->") continue;
      const f = nums(d), last = f[f.length - 1];
      if (!last || +last % 2 !== 1) continue;
      const ret = String(+last + 1).padStart(last.length, "0");
      if (f.includes(ret)) continue;
      let day = d.date;
      for (let i = 1; i <= 6; i++) {
        day = nextIso(day);
        const x = by.get(day);
        if (!x || x.code === "-->") continue;               // no entry / already a layover: still inside the trip
        if (x.type !== "FLT" || nums(x)[0] !== ret) break;  // a day off or another flight first: not this trip
        for (let g = nextIso(d.date); g < day; g = nextIso(g)) {
          if (!by.has(g)) { const b = { date: g, type: "FLT", code: "-->", detail: "", report: "", release: "", block: "" }; out.push(b); by.set(g, b); }
        }
        if (nums(x).length === 1 && !x.report) { d.code = [...f, ret].join("/"); Object.assign(x, { code: "-->", detail: "", report: "", release: "" }); }
        break;
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  // a LINE-bot post that covers several days (posts.until_date): day 1 carries the duty, the rest are "-->"
  window.ccTripDays = (e) => {
    const out = [{ date: e.date, type: "FLT", code: e.code || "", detail: e.detail || "", report: e.report || "", release: e.release || "", block: "" }];
    for (let d = nextIso(e.date), k = 0; d <= e.until && k < 12; d = nextIso(d), k++) out.push({ date: d, type: "FLT", code: "-->", detail: "", report: "", release: "", block: "" });
    return out;
  };

  /**
   * Two-way check of someone else's give post, same-day swap:
   *   x = my roster if I take their duty and hand over my duties on those dates (whole trips)
   *   y = their roster (from the LINE picture, or a member's uploaded roster) if they take my duties back
   * TC.evalSwap reports a date clash ("conf:") and the rest/duty rules when report/release times are known.
   */
  const vcache = new Map();
  function verdict(r) {
    const S = window.FOSTATE;
    if (!S || !S.me || typeof TC === "undefined" || typeof postDays !== "function") return null;
    const me = S.rosters?.[S.me] || {};
    const key = [r.id, r.date, r.until, r.code, r.report, r.release, (r.giverDays || []).length, me.updatedAt, (me.days || []).length].join("|");
    if (vcache.has(key)) return vcache.get(key);
    const my = linkDays(me.days || []);
    const take = postDays(r).map((x) => ({ ...x }));
    const at = (iso) => my.find((y) => y.date === iso);
    const mineMap = new Map();
    for (const p of take) {
      let d = p.date, k = 0;
      while (at(d)?.code === "-->" && k++ < 6) d = prevIso(d);
      for (const x of TC.pairOf(my, d)) if (x.code === "-->" || WORKT.has(x.type) || x.type === "LVE") mineMap.set(x.date, x);
    }
    const mine = [...mineMap.values()].sort((a, b) => a.date.localeCompare(b.date));
    const x = TC.evalSwap(my, me.base || "BKK", mine.map((m) => m.date), take);
    let gr = typeof giverRoster === "function" ? giverRoster(r) : null;
    if (!gr && (S.rosters?.[r.author]?.days || []).length) gr = S.rosters[r.author].days;   // a member's own post
    gr = gr ? linkDays(gr) : null;
    const y = mine.length && gr ? TC.evalSwap(gr, S.rosters?.[r.author]?.base || "BKK", take.map((t) => t.date), mine) : null;
    const covered = my.length > 0 && take.some((t) => my[0].date <= t.date && my[my.length - 1].date >= t.date);
    const v = { take, mine, x, y, gr, covered };
    if (vcache.size > 400) vcache.clear();
    vcache.set(key, v);
    return v;
  }
  const bad = (e) => (e ? e.issues.filter((i) => i.level !== "appr") : []);
  const why = (i) => /^conf:/.test(i.key || "") ? `ติดงาน ${dShort(i.date)}` : fixText(String(i.msg || "")).slice(0, 70);
  const codesOf = (list) => list.filter((m) => m.code !== "-->").map(codeOf).join(", ");

  // chip under someone else's give post (replaces the board's own one-sided chip on TG)
  window.ccHint = (e) => {
    if (e.kind !== "give") return undefined;
    const S = window.FOSTATE;
    if (!(S?.rosters?.[S.me]?.days || []).length) return undefined;   // the board asks to upload a roster first
    const v = verdict(e);
    if (!v) return undefined;
    if (!v.covered) return "";
    const multi = isMultiP(e);
    const lbl = v.mine.length ? `คุณมี ${codesOf(v.mine) || "งาน"} ${multi ? "ในช่วงนั้น" : "วันนั้น"}` : multi ? "คุณว่างทั้งช่วง" : "คุณว่างวันนั้น";
    const a = bad(v.x), b = bad(v.y);
    if (a.length) return `<span class="hint bad">${h(lbl)} · คุณรับไม่ได้: ${h(why(a[0]))}</span>`;
    if (b.length) return `<span class="hint bad">${h(lbl)} · เขารับของคุณไม่ได้: ${h(why(b[0]))}</span>`;
    const tip = v.x.unknown || v.y?.unknown ? ' title="บางวันไม่มีเวลา report/release จึงตรวจได้แค่วันชนกัน ยังตรวจเวลาพักไม่ได้"' : "";
    if (!v.mine.length) return `<span class="hint good"${tip}>${h(lbl)} · รับได้ ไม่ติด</span>`;
    if (!v.y) return `<span class="hint warn">${h(lbl)} · คุณรับได้ · ฝั่งเขาไม่รู้ตาราง</span>`;
    return `<span class="hint good"${tip}>${h(lbl)} · แลกได้ ไม่ติดทั้งสองฝั่ง</span>`;
  };

  // "ตรวจ" panel: both sides in full
  window.ccCheckPanel = (r) => {
    const v = verdict(r);
    if (!v || typeof chkHtml !== "function") return "";
    const theirs = codesOf(v.take) || "ไฟลต์นี้", mineC = codesOf(v.mine) || "งานของคุณ";
    let out = chkHtml(v.x, v.mine.length ? `คุณ (รับ ${theirs} · ให้ ${mineC})` : `คุณ (รับ ${theirs})`);
    if (!v.mine.length) out += '<div class="chk"><div class="chk-h muted">คุณว่างช่วงนั้น ไม่ต้องให้งานคืน ฝั่งคนปล่อยจึงไม่ต้องตรวจ</div></div>';
    else if (v.y) out += chkHtml(v.y, `คนปล่อย (รับ ${mineC} ของคุณ)`) + '<div class="muted chk-note">ฝั่งคนปล่อยตรวจจากตารางในรูปที่เขาส่งมา (หรือตารางที่เขาอัปโหลด)</div>';
    else out += '<div class="chk"><div class="chk-h muted">คนปล่อย: ไม่มีตารางของเขาในรูป ตรวจไม่ได้ว่ารับงานคุณแล้วจะติดไหม</div></div>';
    return out;
  };

  /** money chip on someone else's give post: their trip's PPB against the duties I hand over on those dates */
  function payTag(p) {
    const S = window.FOSTATE;
    if (!p || p.kind !== "give" || !S || p.author === S.me) return "";
    const g = ppbOf(p.code);
    if (g.pay == null) return g.keys.length ? '<span class="pill pay unk">💰 ไม่มีตัวเลขในตาราง TPI</span>' : "";
    const v = verdict(p);
    if (!v || !v.covered) return `<span class="pill pay">💰 ${baht(g.pay)}</span>`;
    const work = v.mine.filter((m) => m.code !== "-->");
    if (!work.length) return `<span class="pill pay" title="ค่าเที่ยวของไฟลต์นี้ตามตาราง TPI">💰 ${baht(g.pay)} · วันนั้นคุณว่าง</span>`;
    let mine = 0;
    for (const m of work) {
      if (m.type !== "FLT") continue;   // standby / leave: no TPI figure
      const q = ppbOf(m.code);
      if (q.pay == null) return `<span class="pill pay">💰 ${baht(g.pay)} · ไฟลต์คุณ ${h(m.code)} ไม่มีในตาราง</span>`;
      mine += q.pay;
    }
    if (!mine) return `<span class="pill pay">💰 ${baht(g.pay)} · วันนั้นคุณมี ${h(codesOf(work))}</span>`;
    const diff = g.pay - mine, t = `ไฟลต์นี้ ${baht(g.pay)} · ของคุณ ${baht(mine)}`;
    return diff > 0 ? `<span class="pill pay get" title="${t}">💰 ${t} → คุณได้เงินเพิ่ม ${baht(diff)}</span>`
      : diff < 0 ? `<span class="pill pay add" title="${t}">💸 ${t} → คุณเสียเปรียบ ${baht(-diff)}</span>`
      : `<span class="pill pay" title="${t}">💰 ${t} → เท่ากัน</span>`;
  }
  window.ccPayTag = payTag;

  window.ccPostFilter = (p) => { if (!mine || !mine.length) return true; const t = typeOf(p); return !t || mine.includes(t); };
  const lineUrl = (p) => { const u = String(p?.contact || ""); return /^https:\/\/(line\.me|lin\.ee)\/[\w\/~@.%?=&+-]+$/i.test(u) ? u : ""; };
  window.ccAcTag = (p) => {
    const t = typeOf(p), u = lineUrl(p);
    const ac = t ? `<span class="pill ac">${TYPES.find((x) => x[0] === t)[1]}</span>` : '<span class="pill ac unk">ไม่ระบุแบบเครื่อง</span>';
    const pic = /^tg\/[0-9a-f]{16,64}\.jpg$/.test(String(p?.pic || "")) ? p.pic : "";
    return ac + (u ? `<a class="pill line" href="${u.replace(/"/g, "&quot;")}" target="_blank" rel="noopener">💬 ทักไลน์</a>` : "")
      + (pic ? `<button type="button" class="pill pic" data-tgpic="${pic}">🖼 ดูรูป</button>` : "")
      + payTag(p);
  };

  function bar() {
    const chips = document.querySelector('#tab-board .chips');
    if (!chips || document.getElementById("acBar")) return;
    const d = document.createElement("div");
    d.id = "acBar";
    d.className = "acbar";
    d.innerHTML = `<span class="muted">✈️ เครื่องที่ฉันบินได้:</span>` + TYPES.map(([k, n]) =>
      `<label><input type="checkbox" value="${k}"${!mine || mine.includes(k) ? " checked" : ""}> ${n}</label>`).join("") +
      `<span class="muted small">ไม่ติ๊ก = ซ่อนโพสต์เครื่องนั้น · โพสต์ที่ไม่ระบุแบบเครื่องจะแสดงเสมอ</span>`;
    chips.insertAdjacentElement("afterend", d);
    d.addEventListener("change", () => {
      mine = [...d.querySelectorAll("input:checked")].map((i) => i.value);
      save(mine);
      try { window.render && window.render(); } catch {}
      const all = document.querySelector('[data-filter][aria-pressed="true"]'); if (all) all.click();
    });
  }

  // ── TCAR in plain words ──
  const CH7 = "เกณฑ์เวลาบิน-พัก";
  const fixText = (s) => s
    .replace(/\s*\((?:แนวปฏิบัติบริษัท[^)]*|OM-A[^)]*|ตาม OM-A[^)]*|[^()]*หน้า 7-\d+[^()]*)\)/g, "")
    .replace(/OM-A Chapter 7|OM-A Ch\.7/g, CH7)
    .replace(/\s*·?\s*(?:ตาม\s*)?OM-A [0-9.]+[^·)\n]*/g, "")
    .replace(/Chief Pilot|CPO/g, "หัวหน้างาน")
    .replace(/Pilot's Swap Duty Form/g, "แบบฟอร์มแลกงาน")
    .replace(/นักบิน/g, "ลูกเรือ");
  function scrub(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const hit = [];
    for (let n = w.nextNode(); n; n = w.nextNode()) if (/OM-A|Chief Pilot|CPO|Swap Duty Form|หน้า 7-\d|นักบิน/.test(n.nodeValue)) hit.push(n);
    hit.forEach((n) => { const v = fixText(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; });
  }
  const css = document.createElement("style");
  css.textContent = `.chk li small{display:none!important}
.acbar{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin:6px 0 10px;font-size:13px}
.acbar label{display:inline-flex;gap:4px;align-items:center;white-space:nowrap}
.acbar .small{flex-basis:100%;font-size:11.5px}
.pill.ac{background:#e8eefc;color:#1d3f8f}.pill.line{background:#06c755;color:#fff;text-decoration:none}.pill.pic{background:#fff3d6;color:#7a5200;border:0;cursor:pointer;font:inherit}.pill.ac.unk{background:#f1f1f1;color:#777}
.pill.pay{background:#eef7ee;color:#22572a;white-space:normal}.pill.pay.add{background:#fdecec;color:#9b1c1c}.pill.pay.get{background:#e6f6ea;color:#14632b;font-weight:600}.pill.pay.unk{background:#f1f1f1;color:#777}`;
  document.head.appendChild(css);

  // the original LINE picture: a short-lived signed link (private bucket, TG members only)
  document.addEventListener("click", async (e) => {
    const b = e.target.closest && e.target.closest("[data-tgpic]");
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const w = window.open("", "_blank");
    try {
      const { data, error } = await window.SB.storage.from("tg-pics").createSignedUrl(b.dataset.tgpic, 600);
      if (error || !data?.signedUrl) throw error || new Error("no url");
      if (w) w.location.href = data.signedUrl; else location.href = data.signedUrl;
    } catch (err) { if (w) w.close(); alert("เปิดรูปไม่ได้ (รูปอาจถูกลบแล้วเพราะเลยวันไปแล้ว)"); }
  }, true);

  function start() {
    bar();
    scrub(document.body);
    new MutationObserver((ms) => {
      bar();
      ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) scrub(n); else if (n.nodeType === 3 && n.parentNode) scrub(n.parentNode); }));
    }).observe(document.body, { childList: true, subtree: true });
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
})();
