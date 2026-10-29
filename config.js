// CoolCrew runtime config. One code base, two airlines ("tenants"), chosen by hostname:
//   coolcrew.web.app → TVJ (Thai VietJet pilots, the original app)
//   tgcrew.web.app   → TG  (Thai Airways cabin crew)
// On localhost / 127.0.0.1 / other hosts: ?tenant=TG|TVJ (remembered in localStorage) for testing; default TVJ.
// Data separation between airlines is enforced in the database (profiles.airline + row-level security);
// this file only decides labels, branding and which features are shown.
(function () {
  const COMMON = {
    SUPABASE_URL: "https://devbnbshwsibjupesywi.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRldmJuYnNod3NpYmp1cGVzeXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MDA3MDksImV4cCI6MjEwNzA3NjcwOX0.DDpTx8IPlGzgSkcWuAObXS7Y8AnBM8IihVuKy-7UFWo",
    GOOGLE_SIGNIN_CLIENT: "86407095520-p4dao358crts5r0f4alsr6s0h75k4ihk.apps.googleusercontent.com",
    GOOGLE_CAL_CLIENT: "152625331284-e0v1k98e3r4i4kiiafeeq6skkr8ol16a.apps.googleusercontent.com",
  };
  const TENANTS = {
    TVJ: {
      AIRLINE: "TVJ", AIRLINE_NAME: "Thai VietJet", SITE_URL: "https://coolcrew.web.app", LAUNCHED: true,
      BRAND: { app: "CoolCrew", tools: "Pilot Tools", board: "Pilot Swap Board", boardSub: "หาคู่แลกตารางบิน", brief: "Crew Brief", who: "นักบิน", group: "กลุ่มนักบิน" },
      FLIGHT_PREFIX: "VZ",
      STAFF_ID: { placeholder: "TVJ0000", re: "^[A-Z]{2,4}\\d{3,6}$", hint: "เช่น TVJ0000" },
      FLEETS: [["A320", "A320 / A321"], ["B737", "B737"]],
      RANKS: [["FO", "First Officer"], ["CPT", "Captain"]],
      ROOM_BY: "fleet+rank",
      ROSTER_SOURCE: "merlot",
      FEATURES: { tcar: true, swapForm: true, lineFeed: true, briefOps: true, pswm: true, mel: true, pilotDocs: true },
    },
    TG: {
      AIRLINE: "TG", AIRLINE_NAME: "Thai Airways", SITE_URL: "https://tgcrew.web.app", LAUNCHED: false,
      BRAND: { app: "CoolCrew TG", tools: "Cabin Tools", board: "Cabin Swap Board", boardSub: "หาคู่แลกตารางบิน ลูกเรือการบินไทย", brief: "Crew Roster", who: "ลูกเรือ", group: "กลุ่มลูกเรือการบินไทย" },
      FLIGHT_PREFIX: "TG",
      STAFF_ID: { placeholder: "รหัสพนักงาน", re: "^[A-Z0-9-]{3,12}$", hint: "ตัวเลข/ตัวอักษร 3–12 ตัว" },
      FLEETS: [["TG", "Thai Airways"]],
      RANKS: [["IM", "In-flight Manager"], ["AP", "Air Purser"], ["FA", "Flight Attendant"]],
      ROOM_BY: "rank",   // undecided with TG crew: "rank" (IM/AP/FA separate) or "all" (one room)
      ROSTER_SOURCE: "cabinconnect",
      FEATURES: { tcar: false, swapForm: false, lineFeed: false, briefOps: false, pswm: false, mel: false, pilotDocs: false },
    },
  };
  const HOSTS = { "coolcrew.web.app": "TVJ", "coolcrew.firebaseapp.com": "TVJ", "tgcrew.web.app": "TG", "tgcrew.firebaseapp.com": "TG" };
  let id = HOSTS[location.hostname];
  if (!id) {
    try {
      const q = new URLSearchParams(location.search).get("tenant");
      if (q && TENANTS[q.toUpperCase()]) localStorage.setItem("cc_tenant", q.toUpperCase());
      id = localStorage.getItem("cc_tenant") || "TVJ";
    } catch { id = "TVJ"; }
    if (!TENANTS[id]) id = "TVJ";
  }
  window.FO_CONFIG = Object.assign({}, COMMON, TENANTS[id], { TENANTS: Object.keys(TENANTS), TENANT_SITES: Object.fromEntries(Object.entries(TENANTS).map(([k, v]) => [k, v.SITE_URL])) });
  try { document.documentElement.dataset.airline = id; } catch {}
  // per-airline texts: <el data-t-TG="…"> shows that text on the TG site
  const apply = () => {
    try {
      document.querySelectorAll("[data-t-" + id + "]").forEach((el) => { el.textContent = el.getAttribute("data-t-" + id); });
      let preview = false;
      try { if (new URLSearchParams(location.search).get("preview") === "1") localStorage.setItem("cc_preview", "1"); preview = localStorage.getItem("cc_preview") === "1"; } catch {}
      if (!window.FO_CONFIG.LAUNCHED && !preview) {
        const n = document.getElementById("soonNote"); if (n) n.hidden = false;
        ["googleBtn", "emailForm"].forEach((k) => { const el = document.getElementById(k); if (el) { el.style.opacity = ".45"; el.style.pointerEvents = "none"; } });
      }
    } catch {}
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
})();
