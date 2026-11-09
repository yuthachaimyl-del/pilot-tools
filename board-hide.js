// Board "อ่านแล้ว" (read / not interested): tick someone else's post and it no longer shows on the board.
// Kept per person on this device (localStorage, key per signed-in user). A chip above the board shows how many
// are hidden and lets them be shown again; a toast right after hiding offers undo.
// index.html calls window.ccHideFilter(post) while filtering the board and window.ccHideBtn(post) for the
// card's button row. Loaded on both sites (TVJ coolcrew and TG tgcrew).
(function () {
  "use strict";
  const KEEP_DAYS = 45;                       // ids of posts dated longer ago than this are dropped
  const st = () => window.FOSTATE || (typeof S !== "undefined" ? S : null);
  const key = () => "cc_read_posts_" + (st()?.me || "anon");
  const today = () => new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
  let showHidden = false, lastHidden = null;

  function load() {
    try { const v = JSON.parse(localStorage.getItem(key()) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
    catch { return {}; }
  }
  function save(m) {
    const cut = new Date(Date.now() + 7 * 36e5 - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
    for (const [id, d] of Object.entries(m)) if (!d || d < cut) delete m[id];
    try { localStorage.setItem(key(), JSON.stringify(m)); } catch {}
  }
  const rerender = () => { try { typeof renderBoard === "function" && renderBoard(); } catch {} chip(); };

  function hide(id, date) { const m = load(); m[id] = date || today(); save(m); lastHidden = id; rerender(); toast(); }
  function unhide(id) { const m = load(); delete m[id]; save(m); rerender(); }

  window.ccHideFilter = (p) => {
    if (!p || showHidden) return true;
    const me = st()?.me;
    if (p.author === me) return true;           // own posts are never hidden
    return !load()[p.id];
  };

  window.ccHideBtn = (p) => {
    if (!p?.id || p.author === st()?.me) return "";
    const id = String(p.id).replace(/[^\w-]/g, "");
    return load()[p.id]
      ? `<button class="btn small ghost" type="button" data-unread="${id}">↩ เลิกซ่อน</button>`
      : `<button class="btn small ghost" type="button" data-read="${id}" data-date="${String(p.date || "").slice(0, 10)}" title="ไม่สนใจโพสต์นี้ ซ่อนจากบอร์ด">✓ อ่านแล้ว</button>`;
  };

  document.addEventListener("click", (ev) => {
    const b = ev.target.closest?.("[data-read],[data-unread],[data-readtoggle],[data-readundo]");
    if (!b) return;
    ev.preventDefault();
    if (b.dataset.read) hide(b.dataset.read, b.dataset.date);
    else if (b.dataset.unread) unhide(b.dataset.unread);
    else if (b.hasAttribute("data-readundo")) { if (lastHidden) unhide(lastHidden); lastHidden = null; document.getElementById("ccReadToast")?.remove(); }
    else if (b.hasAttribute("data-readtoggle")) { showHidden = !showHidden; rerender(); }
  }, true);

  // chip above the board: how many of the posts still ahead are hidden, tap to show them again
  function chip() {
    const board = document.getElementById("tab-board");
    const chips = board && board.querySelector(".chips");
    if (!chips) return;
    let c = document.getElementById("ccReadChip");
    const s = st(), m = load(), t = today();
    const n = (s?.posts || []).filter((p) => m[p.id] && String(p.until || p.date || "") >= t).length;
    if (!n && !showHidden) { c?.remove(); return; }
    if (!c) {
      c = document.createElement("div");
      c.id = "ccReadChip";
      c.className = "readbar";
      (document.getElementById("acBar") || chips).insertAdjacentElement("afterend", c);
    }
    c.innerHTML = showHidden
      ? `<button class="btn small" type="button" data-readtoggle>🙈 ซ่อนโพสต์ที่อ่านแล้วอีกครั้ง</button>`
      : `<button class="btn small ghost" type="button" data-readtoggle>👁 ดูโพสต์ที่อ่านแล้ว (${n})</button>`;
  }

  function toast() {
    document.getElementById("ccReadToast")?.remove();
    const d = document.createElement("div");
    d.id = "ccReadToast";
    d.className = "readtoast";
    d.innerHTML = `ซ่อนโพสต์แล้ว <button class="btn small" type="button" data-readundo>เลิกทำ</button>`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 5000);
  }

  const css = document.createElement("style");
  css.textContent = `.readbar{margin:6px 0 2px}.readtoast{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);
background:#222;color:#fff;padding:8px 10px 8px 14px;border-radius:12px;display:flex;gap:10px;align-items:center;z-index:9999;font-size:14px;box-shadow:0 4px 18px rgba(0,0,0,.25)}
.readtoast .btn{background:#fff;color:#222}`;
  document.head.appendChild(css);

  // keep the chip in step with the board (posts load after this script runs)
  const start = () => { const b = document.getElementById("boardList"); if (!b) return; chip(); new MutationObserver(() => chip()).observe(b, { childList: true }); };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
})();
