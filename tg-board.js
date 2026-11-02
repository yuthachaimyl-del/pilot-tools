// tg-board.js — TG site (FO_CONFIG.AIRLINE === "TG") only.
// 1. Aircraft types: the member ticks the types they are qualified on (saved on this device); the board hides
//    posts of other types. Posts whose type is unknown stay, labelled "ไม่ระบุแบบเครื่อง".
// 2. TCAR check: same rules as the TVJ site (tcar.js) but explained in plain words, without manual references.
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
  window.ccPostFilter = (p) => { if (!mine || !mine.length) return true; const t = typeOf(p); return !t || mine.includes(t); };
  window.ccAcTag = (p) => {
    const t = typeOf(p);
    if (t) return `<span class="pill ac">${TYPES.find((x) => x[0] === t)[1]}</span>`;
    return '<span class="pill ac unk">ไม่ระบุแบบเครื่อง</span>';
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
.pill.ac{background:#e8eefc;color:#1d3f8f}.pill.ac.unk{background:#f1f1f1;color:#777}`;
  document.head.appendChild(css);

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
