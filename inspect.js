// inspect.js — "inspection mode" for the owner on the other airline's site (e.g. the TVJ owner account on tgcrew).
// Every page and button works so the owner can check the TG app, but nothing is written to the database:
// writes to rosters, member_prefs, posts, offers, alarm_tokens and push_subs are answered locally with "ok" and dropped.
// This keeps the owner's real pilot roster and settings untouched and keeps him out of the TG swap board data.
// Loaded right after supa.js (needs window.SB). Members of the site's own airline are not affected at all.
(function () {
  "use strict";
  const C = window.FO_CONFIG || {}, SB = window.SB;
  if (!SB || typeof SB.from !== "function" || SB.__ccInspect) return;
  SB.__ccInspect = true;
  const SITE = C.AIRLINE || "TVJ";
  const GUARD = new Set(["rosters", "member_prefs", "posts", "offers", "alarm_tokens", "push_subs"]);
  const WRITE = new Set(["insert", "upsert", "update", "delete"]);
  const origFrom = SB.from.bind(SB);
  let me = null;
  async function inspecting() {
    if (me === null) {
      me = (async () => {
        try {
          const { data: { session } } = await SB.auth.getSession();
          if (!session) return false;
          const { data } = await origFrom("profiles").select("*").eq("id", session.user.id).maybeSingle();
          return !!(data && data.is_owner && (data.airline || "TVJ") !== SITE);
        } catch { return false; }
      })();
    }
    return me;
  }
  function deferred(table, calls) {   // records the builder chain; on await decides: drop (inspection) or replay for real
    const p = new Proxy(function () {}, {
      get(_, k) {
        if (k === "then") return (res, rej) => inspecting().then((ins) => {
          if (ins) { console.info("[inspect] skipped write to", table); return { data: [], error: null, status: 200 }; }
          let b = origFrom(table);
          for (const [m, a] of calls) b = b[m](...a);
          return b;
        }).then(res, rej);
        return (...a) => { calls.push([k, a]); return p; };
      },
    });
    return p;
  }
  SB.from = function (table) {
    const real = origFrom(table);
    if (!GUARD.has(table)) return real;
    return new Proxy(real, {
      get(t, k) {
        if (typeof k === "string" && WRITE.has(k)) return (...a) => deferred(table, [[k, a]]);
        const v = t[k];
        return typeof v === "function" ? v.bind(t) : v;
      },
    });
  };
  // a small banner so it is obvious nothing is saved
  const banner = () => inspecting().then((ins) => {
    window.__ccInspect = ins;
    if (!ins || document.getElementById("ccInspect")) return;
    const d = document.createElement("div"); d.id = "ccInspect";
    d.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:30;background:#b86e00;color:#fff;font:600 12.5px/1.3 system-ui,sans-serif;padding:7px 12px;border-radius:999px;box-shadow:0 2px 10px #0006;max-width:calc(100% - 24px);text-align:center;pointer-events:none";
    d.textContent = "👀 โหมดตรวจงาน · ดูได้ทุกหน้า แต่ไม่บันทึกอะไรลงระบบ";
    document.body.appendChild(d);
  });
  SB.auth.onAuthStateChange(() => { me = null; banner(); });
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", banner) : banner();
})();
