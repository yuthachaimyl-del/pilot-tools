// brief-cabin.js — cabin-crew mode of Crew Brief (TG tenant, FO_CONFIG.ROSTER_SOURCE === "cabinconnect").
// 1. PROMPT_CABIN: how to read Thai Airways "Cabin Connect" Roster screenshots (month grid + one selected day's details).
// 2. cabinMerge(parsed): joins the pieces before applyParsed(): a duty that runs past midnight is shown on two days
//    (13-Nov TG307 and 14-Nov TG308 share "13-Nov 19:55~14-Nov 06:40") and becomes one duty with both sectors;
//    calendar-grid chips are kept only for days no detail screenshot covers.
// 3. Pilot-only parts of the page (Brief/PSWM tabs, OMC, FDP) are hidden by brief-tabs.js and the CSS below.
(function () {
  "use strict";
  const C = window.FO_CONFIG || {};
  if (C.ROSTER_SOURCE !== "cabinconnect") return;

  window.PROMPT_CABIN = `You are reading screenshots of the Thai Airways cabin crew app "Cabin Connect", screen "Roster". Each image is one whole phone screenshot (ignore any note below about slices).
A screenshot shows (1) a month calendar grid, often scrolled so only some weeks are visible, with a header "MM-YYYY" or "DD-MM-YYYY" (day-month-year), and often (2) the details of the selected day below the legend "Normal / Delay / Cancel".
CALENDAR GRID: under each day number there are 0, 1 or 2 chips. Green "OFF" = day off. Purple digits (e.g. "245") = Thai Airways flight TG245. No chip = no duty that day (layover or rest): output nothing for it. Grey day numbers belong to the previous or next month: ignore them.
DAY DETAILS: a line "DD-Mon-YYYY" (the selected day); a bold line "DD-Mon HH:MM~DD-Mon HH:MM" = duty start (report, local time at the first departure station) and duty end (release, local time at the last arrival station); then one purple card per flight: "FLY | DEP +offset HH:MML | TGnnn | VIRTUAL-n | aircraft | ARR +offset HH:MML" (a small "+1" after the arrival time means it arrives the next day).
OUTPUT
- For every day-details section visible: one duty. "date" = the START date of the bold line (it is the day BEFORE the selected day when the duty began the evening before: selected 14-Nov with "13-Nov 19:55~14-Nov 06:40" gives date 13-Nov). type "FLT"; report and release from the bold line; releaseDayOffset 1 when the end date is after the start date, else 0; sectors from the cards: flt = digits only ("426"), dep, std, arr, sta exactly as printed without the "L" (24 h, "HH:MM"); from = first dep; to = last arr; accom = the last arrival station if it is not BKK, else ""; code = the flight numbers joined with "/" ("245/246"). If the bold line is visible but no flight card is, still output the duty with report/release, code = that day's chip numbers, sectors [].
- For every day of the month named in the header that has a chip in the grid: one entry with "grid": true, that date, type "OFF" for an OFF chip, otherwise "FLT" with code = the chip numbers joined with "/", report "", release "", sectors [].
- Output what you see; repeated days across screenshots are merged by the app.
Return ONLY JSON:
{"name":"","base":"BKK","period":"Nov 2026","duties":[{"date":"YYYY-MM-DD","code":"245/246","type":"FLT","grid":false,"from":"BKK","to":"BKK","report":"09:00","release":"14:40","releaseDayOffset":0,"accom":"","sectors":[{"flt":"245","dep":"BKK","std":"10:45","arr":"KBV","sta":"12:05"}]}]}
Do not include names, staff numbers, crew lists or anything about other people. Never invent values; use "" when unreadable.`;

  const addDays = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); };
  const hm = (s) => { const m = /(\d{1,2}):?(\d{2})/.exec(s || ""); return m ? String(+m[1]).padStart(2, "0") + ":" + m[2] : ""; };

  window.cabinMerge = function (parsed) {
    if (!parsed || !Array.isArray(parsed.duties)) return parsed;
    const base = String(parsed.base || "BKK").toUpperCase();
    const ok = (d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.date || "");
    const grid = [], detail = new Map();
    for (const d of parsed.duties.filter(ok)) {
      const secs = Array.isArray(d.sectors) ? d.sectors : [];
      if (d.grid || (!hm(d.report) && !secs.length)) { grid.push(d); continue; }
      const k = d.date + "|" + hm(d.report);
      const cur = detail.get(k);
      if (!cur) { detail.set(k, { ...d, grid: false, sectors: [...secs] }); continue; }
      for (const s of secs) {   // the other half of an overnight duty: add its sectors
        if (!cur.sectors.some((x) => String(x.flt) === String(s.flt) && String(x.dep).toUpperCase() === String(s.dep).toUpperCase())) cur.sectors.push(s);
      }
      if (!cur.release && d.release) { cur.release = d.release; cur.releaseDayOffset = d.releaseDayOffset; }
    }
    const out = [];
    const covered = new Set();
    for (const d of detail.values()) {
      const secs = d.sectors.filter((s) => s && (s.flt || s.dep));
      // order sectors by departure time within the duty (a second-day sector departs after midnight)
      const start = hm(d.report) ? +hm(d.report).slice(0, 2) * 60 + +hm(d.report).slice(3) : 0;
      const at = (s) => { const t = hm(s.std); if (!t) return 9999; let m = +t.slice(0, 2) * 60 + +t.slice(3); if (m < start - 180) m += 1440; return m; };
      secs.sort((a, b) => at(a) - at(b));
      const first = secs[0], last = secs[secs.length - 1];
      const to = String((last && last.arr) || d.to || "").toUpperCase();
      out.push({
        ...d,
        code: secs.length ? secs.map((s) => String(s.flt).replace(/\D/g, "")).filter(Boolean).join("/") : String(d.code || ""),
        from: String((first && first.dep) || d.from || base).toUpperCase(),
        to,
        accom: to && to !== base ? to : "",
        sectors: secs,
      });
      for (let i = 0; i <= (d.releaseDayOffset ? 1 : 0); i++) covered.add(addDays(d.date, i));
    }
    const gridSeen = new Set();
    for (const g of grid) {
      if (covered.has(g.date) || gridSeen.has(g.date)) continue;
      gridSeen.add(g.date);
      out.push({ date: g.date, code: g.type === "OFF" ? "OFF" : String(g.code || ""), type: g.type === "OFF" ? "OFF" : "FLT", from: "", to: "", report: "", release: "", releaseDayOffset: 0, accom: "", sectors: [] });
    }
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return { ...parsed, duties: out };
  };

  // an account from another airline (the owner's pilot account) only gets the admin page here, not the roster tools
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      if (!window.SB) return;
      const { data: { session } } = await window.SB.auth.getSession();
      if (!session) return;
      const { data: p } = await window.SB.from("profiles").select("*").eq("id", session.user.id).single();
      if (p && (p.airline || "TVJ") !== C.AIRLINE) location.replace("index.html#stats");
    } catch (e) { /* stay */ }
  });

  // pilot-only parts of the page
  const css = document.createElement("style");
  css.textContent = `#p-brief,#p-fit,#goBrief,#e_omc,#e_omcDate,#e_omcList,#e_omcLoad,#e_omcMsg,[data-guide="roster"]{display:none!important}`;
  document.head.appendChild(css);
})();
