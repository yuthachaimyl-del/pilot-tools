// Board "อ่านแล้ว" (read / not interested): tick someone else's post and it no longer shows on the board.
// Saved per account in Supabase (table post_reads, each member sees only their own rows), so hiding on one
// device hides on every device signed in to the same account; localStorage keeps a copy for a fast first paint
// and for ticks made while offline (sent up on the next load). A chip above the board shows how many are
// hidden and lets them be shown again; a toast right after hiding offers undo.
// index.html calls window.ccHideFilter(post) while filtering the board and window.ccHideBtn(post) for the
// card's button row. Loaded on both sites (TVJ coolcrew and TG tgcrew).
(function () {
  "use strict";
  const KEEP_DAYS = 45;                       // ids of posts dated longer ago than this are dropped
  const st = () => window.FOSTATE || (typeof S !== "undefined" ? S : null);
  const key = () => "cc_read_posts_" + (st()?.me || "anon");
  const today = () => new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
  let showHidden = false, lastHidden = null, syncedFor = null, syncing = false;
  const sb = () => window.SB || null;

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

  const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ""));
  // ticks not yet saved to the account (offline, or made before this was synced): sent on the next sync
  const pkey = () => key() + "_pending";
  const pending = () => { try { const v = JSON.parse(localStorage.getItem(pkey()) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
  const setPending = (a) => { try { localStorage.setItem(pkey(), JSON.stringify([...new Set(a)].slice(-500))); } catch {} };
  async function put(id) {
    if (!isUuid(id)) return;
    try {
      const { error } = await sb().from("post_reads").upsert({ post_id: id }, { onConflict: "user_id,post_id", ignoreDuplicates: true });
      if (!error) setPending(pending().filter((x) => x !== id));
    } catch {}
  }
  async function drop(id) { try { if (isUuid(id)) await sb()?.from("post_reads").delete().eq("post_id", id); } catch {} }

  // the account's list is the truth; this device only adds the ticks it has not sent yet
  async function sync() {
    const me = st()?.me, c = sb();
    if (!me || !c || syncing || syncedFor === me) return;
    syncing = true;
    try {
      const mkey = key() + "_moved";
      if (!localStorage.getItem(mkey)) { setPending([...pending(), ...Object.keys(load())]); try { localStorage.setItem(mkey, "1"); } catch {} }
      for (const id of pending()) await put(id);
      const { data, error } = await c.from("post_reads").select("post_id");
      if (error) return;
      const old = load(), dates = new Map((st()?.posts || []).map((p) => [p.id, String(p.date || "").slice(0, 10)]));
      const m = {};
      for (const r of data || []) m[r.post_id] = old[r.post_id] || dates.get(r.post_id) || today();
      for (const id of pending()) m[id] = old[id] || today();
      save(m);
      syncedFor = me;
      rerender();
    } finally { syncing = false; }
  }

  function hide(id, date) { const m = load(); m[id] = date || today(); save(m); setPending([...pending(), id]); lastHidden = id; rerender(); toast(); put(id); }
  function unhide(id) { const m = load(); delete m[id]; save(m); setPending(pending().filter((x) => x !== id)); rerender(); drop(id); }

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
    sync();
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
  // back to the app (e.g. after hiding on another device): fetch the account's list again
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { syncedFor = null; sync(); } });
})();
