// tz.js — station (IATA) → IANA time zone, and UTC offsets that follow daylight saving (Europe, Australia, NZ, …).
// Used by the browser (Crew Brief, calendar) and copied verbatim into the Edge Functions push / alarm-feed.
// offAt(st, ms): minutes east of UTC at station st at instant ms. absAt(date, "HH:MM", st, dayOff): that local time as UTC ms.
// Unknown stations fall back to Asia/Bangkok (and known(st) tells the caller).
(function (G) {
  const Z = {};
  const set = (list, zone) => list.split(" ").forEach((c) => { Z[c] = zone; });
  set("BKK DMK HKT CNX KBV URT HDY CEI UTH KKC UBP NST USM TST LOE NAW PHS SNO KOP NNT TDX ROI BFV NAK PRH LPT HGN MAQ HHQ CJM UNN PAN UTP", "Asia/Bangkok");
  set("SGN HAN DAD CXR PQC HPH VCA VII HUI DLI VDH", "Asia/Ho_Chi_Minh");
  set("PNH REP KTI SAI KOS", "Asia/Phnom_Penh"); set("VTE LPQ PKZ", "Asia/Vientiane");
  set("CGK SUB KNO", "Asia/Jakarta"); set("DPS", "Asia/Makassar");
  set("CCU DEL BOM MAA BLR HYD GAY VNS AMD COK JAI BBI LKO IXC TRV CCJ ATQ PAT GAU IXB PNQ GOI GOX", "Asia/Kolkata");
  set("DAC CGP", "Asia/Dhaka"); set("RGN MDL NYT", "Asia/Yangon"); set("CMB", "Asia/Colombo"); set("KTM", "Asia/Kathmandu"); set("MLE", "Indian/Maldives");
  set("KUL PEN BKI LGK JHB KCH", "Asia/Kuala_Lumpur"); set("SIN", "Asia/Singapore"); set("MNL CEB CRK", "Asia/Manila"); set("BWN", "Asia/Brunei");
  set("HKG", "Asia/Hong_Kong"); set("MFM", "Asia/Macau"); set("TPE KHH RMQ TSA", "Asia/Taipei");
  set("PEK PKX PVG SHA CAN SZX CTU TFU CKG KMG XIY HGH NKG WUH CSX JHG TAO TSN TNA SJW TYN CGO ZUH LHW HRB SHE DLC CGQ SWA JJN YNT WUX CZX KHN LJG NNY BHY FOC XMN HFE WNZ NGB NNG KWL HAK SYX", "Asia/Shanghai");
  set("ICN GMP PUS CJU TAE CJJ MWX", "Asia/Seoul");
  set("NRT HND KIX FUK NGO CTS OKA KOJ KMJ HIJ OKJ SDJ ITM KIJ TAK MYJ NGS OIT KKJ HKD AOJ KMQ", "Asia/Tokyo");
  set("ISB KHI LHE", "Asia/Karachi"); set("DXB", "Asia/Dubai"); set("DOH", "Asia/Qatar"); set("MCT", "Asia/Muscat"); set("JED RUH", "Asia/Riyadh"); set("TLV", "Asia/Jerusalem");
  set("LHR LGW MAN", "Europe/London"); set("CDG", "Europe/Paris"); set("FRA MUC", "Europe/Berlin"); set("ZRH", "Europe/Zurich");
  set("CPH", "Europe/Copenhagen"); set("ARN", "Europe/Stockholm"); set("OSL", "Europe/Oslo"); set("BRU", "Europe/Brussels");
  set("MXP FCO", "Europe/Rome"); set("VIE", "Europe/Vienna"); set("AMS", "Europe/Amsterdam"); set("IST", "Europe/Istanbul"); set("SVO DME", "Europe/Moscow");
  set("SYD", "Australia/Sydney"); set("MEL", "Australia/Melbourne"); set("PER", "Australia/Perth"); set("BNE", "Australia/Brisbane"); set("AKL", "Pacific/Auckland");
  const F = {};
  const zone = (st) => Z[String(st || "").toUpperCase()] || "Asia/Bangkok";
  function offAt(st, ms) {
    const z = zone(st);
    const f = F[z] || (F[z] = new Intl.DateTimeFormat("en-US", { timeZone: z, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }));
    const p = {}; for (const x of f.formatToParts(ms)) p[x.type] = x.value;
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - Math.floor(ms / 60000) * 60000) / 60000);
  }
  function absAt(date, hhmm, st, dayOff) {
    const m = /(\d{1,2}):?(\d{2})/.exec(hhmm || ""); if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return null;
    const [y, mo, d] = date.split("-").map(Number);
    const wall = Date.UTC(y, mo - 1, d + (dayOff || 0), +m[1], +m[2]);
    let t = wall - offAt(st, wall) * 60000;
    t = wall - offAt(st, t) * 60000;   // second pass settles DST edges
    return t;
  }
  const known = (st) => !!Z[String(st || "").toUpperCase()];
  G.CCTZ = { zone, offAt, absAt, known, ZONES: Z };
})(typeof window !== "undefined" ? window : globalThis);
