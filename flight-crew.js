// CoolCrew: CPT/FO from the LINE bot (table flight_crew) on the swap board.
// When a pilot has not added crew from their own Flight Detail screenshots, crewOf() falls back to the
// CPT/FO the LINE bot saved for the flights of that pairing, so posts still show "บินกับ ...".
(function () {
  let crew = new Map(); // "YYYY-MM-DD|306" -> row
  let loadedAt = 0;

  const digits = (s) => String(s || "").replace(/\D/g, "").slice(-4).padStart(4, "0");
  const nextDay = (iso) => new Date(Date.parse(iso + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);

  async function load() {
    loadedAt = Date.now(); // also on error, so a failing query is not retried every tick
    const from = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
    const { data, error } = await window.SB.from("flight_crew")
      .select("flight_date,flight_no,cpt_name,cpt_code,fo_name,fo_code").gte("flight_date", from);
    if (error) { console.warn("flight_crew", error); return false; }
    crew = new Map((data || []).map((r) => [r.flight_date + "|" + r.flight_no, r]));
    return true;
  }

  // "306 BKK-HKT, 307 HKT-BKK" on a roster day → bot crew of those flights (late legs may be dated the next day)
  function botCrew(user, days) {
    const me = digits(S.rosters[user]?.empId);
    const out = [];
    for (const d of days) {
      for (const m of String(d.detail || "").matchAll(/\b(\d{2,4})\s+[A-Z]{3}-[A-Z]{3}\b/g)) {
        const r = crew.get(d.date + "|" + m[1]) || crew.get(nextDay(d.date) + "|" + m[1]);
        if (!r) continue;
        if (r.cpt_code && digits(r.cpt_code) !== me) out.push("CPT " + r.cpt_name);
        if (r.fo_code && digits(r.fo_code) !== me) out.push("FO " + r.fo_name);
      }
    }
    return [...new Set(out)];
  }

  function install() {
    if (typeof window.crewOf !== "function" || typeof S === "undefined" || !window.SB) return false;
    if (window.crewOf.__flightCrew) return true;
    const own = window.crewOf;
    window.crewOf = Object.assign(function (user, date) {
      const list = own(user, date);
      if (list.length || !crew.size) return list;
      try { return botCrew(user, TC.pairOf(daysOf(user), date)); } catch (e) { console.warn(e); return list; }
    }, { __flightCrew: true });
    return true;
  }

  async function refresh() {
    if (!install() || !S.me) return;
    if (Date.now() - loadedAt < 10 * 6e4) return; // reload at most every 10 minutes
    if (await load()) { try { render(); } catch (e) { console.warn(e); } }
  }

  setInterval(refresh, 2000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { loadedAt = 0; refresh(); } });
})();
