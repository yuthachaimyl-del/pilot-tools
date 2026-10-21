// Crew Brief: printable one-page A4 report of the selected duty (button "พิมพ์ brief").
// Uses the page's own helpers (sorted, key, briefKey, brief, legsOf, BR, parseTAF, verdict, wxSeverity,
// V_STYLE, icao, local, zt, zd, fmtDur, stationName, STATE, S, ALTDEF), so the printed verdicts match the screen.
(() => {
  const MEL_URL = "https://raw.githubusercontent.com/yuthachaimyl-del/pilot-tools/main/mel.json";
  const H = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const MON_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const DOW_TH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const HR = 36e5;

  const DOC_CSS = `
#ccPrint{display:none}
@media print{
  @page{size:A4;margin:8mm 9mm 10mm}
  :root,:root[data-theme]{color-scheme:light!important;--bg:#fff!important}
  html,body{background:#fff!important;color:#15202B!important;padding:0!important;margin:0!important}
  body>*:not(#ccPrint){display:none!important}
  #ccPrint{display:block!important}
}`;
  // the report lives in a shadow root, so the app's own CSS (.card, table, .row, dark theme...) cannot leak in
  const CSS = `
#ccPrint{--ink:#0E1620;--text:#15202B;--muted:#5A6878;--line:#D9E0E7;--soft:#F3F6F9;--green:#2F7D4F;--green-soft:#E3F3EA;
  --amber:#9A5B00;--amber-soft:#FCF0DA;--red:#B42318;--red-soft:#FDE8E6;--blue:#245B9E;--blue-soft:#E6EEF8;
  font-family:var(--f-body,"IBM Plex Sans Thai",sans-serif);font-size:8.6pt;line-height:1.38;color:var(--text);background:#fff;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
#ccPrint *{box-sizing:border-box}
#ccPrint .m{font-family:var(--f-mono,"IBM Plex Mono",monospace)}
#ccPrint .mu{color:var(--muted)}
#ccPrint .pg{display:flex;flex-direction:column;gap:1.8mm}
#ccPrint .hdr{background:var(--ink);color:#fff;border-radius:9px;padding:2.6mm 4.4mm;display:flex;justify-content:space-between;align-items:center;gap:4mm}
#ccPrint .kick{font-family:var(--f-mono,monospace);font-size:7pt;letter-spacing:.16em;color:#5CC08A;font-weight:600}
#ccPrint .hl .row{display:flex;align-items:baseline;gap:3.5mm;flex-wrap:wrap}
#ccPrint .code{font-size:20pt;font-weight:600;line-height:1.1}
#ccPrint .route{font-size:10pt;color:#C9D4DF}
#ccPrint .hr{text-align:right}
#ccPrint .date{font-size:11pt;font-weight:600}
#ccPrint .dth,#ccPrint .who2{color:#AFC0D0;font-size:8pt}
#ccPrint .who{font-weight:600;font-size:8.6pt;margin-top:.6mm}
#ccPrint .tiles{display:grid;grid-template-columns:repeat(6,1fr);gap:1.6mm}
#ccPrint .tile{border:1px solid var(--line);border-radius:7px;padding:1.1mm 2.2mm}
#ccPrint .tile span{display:block;font-size:7.4pt;color:var(--muted)}
#ccPrint .tile b{font-size:13pt;font-weight:600;font-family:var(--f-mono,monospace)}
#ccPrint .tile em{font-style:normal;font-size:7pt;color:var(--muted);margin-left:3px;font-family:var(--f-mono,monospace)}
#ccPrint .tile.key{background:var(--green-soft);border-color:#B9DEC8}
#ccPrint .tile.key b{color:var(--green)}
#ccPrint .fdp{border:1px solid var(--line);border-radius:7px;padding:1.3mm 2.6mm}
#ccPrint .fdp .t{display:flex;gap:5px;align-items:baseline;flex-wrap:wrap}
#ccPrint .fdp .r{margin-left:auto;color:var(--muted)}
#ccPrint .bar{height:5px;background:var(--soft);border-radius:4px;margin-top:1mm;overflow:hidden}
#ccPrint .bar i{display:block;height:100%;border-radius:4px}
#ccPrint .card{border:1px solid var(--line);border-radius:9px;padding:1.7mm 3mm}
#ccPrint .hdr,#ccPrint .tiles,#ccPrint .fdp,#ccPrint .thl li,#ccPrint .mel{break-inside:avoid}
#ccPrint h3{margin:0 0 1mm;font-size:9.6pt;font-weight:600;color:var(--ink);display:flex;align-items:baseline;gap:5px}
#ccPrint h3 small{font-weight:400;color:var(--muted);font-size:7.6pt}
#ccPrint table{width:100%;border-collapse:collapse}
#ccPrint th{font-size:7.3pt;font-weight:600;color:var(--muted);text-align:left;padding:.6mm 1.5mm;border-bottom:1.3px solid var(--ink)}
#ccPrint td{padding:.7mm 1.5mm;border-bottom:1px solid var(--line);vertical-align:top}
#ccPrint tr:last-child td{border-bottom:none}
#ccPrint tr{break-inside:avoid}
#ccPrint .z{font-size:7pt;color:var(--muted);margin-left:3px}
#ccPrint .pill{display:inline-block;font-size:6.9pt;font-weight:600;border-radius:20px;padding:0 6px;line-height:1.6;white-space:nowrap;background:var(--soft);color:var(--muted)}
#ccPrint .bad{background:var(--red-soft);color:var(--red)}
#ccPrint .warn{background:var(--amber-soft);color:var(--amber)}
#ccPrint .ok{background:var(--green-soft);color:var(--green)}
#ccPrint .info{background:var(--blue-soft);color:var(--blue)}
#ccPrint td.tbad{color:var(--red);font-weight:600}
#ccPrint td.twarn{color:var(--amber);font-weight:600}
#ccPrint .thl{list-style:none;margin:0;padding:0;display:grid;gap:.7mm}
#ccPrint .thl li{border-left:3px solid #D99A2B;padding-left:2.2mm}
#ccPrint .thl li.b{border-color:var(--red)}
#ccPrint .thl li span{color:var(--muted)}
#ccPrint .ac{display:grid;grid-template-columns:auto 1fr;gap:3mm;align-items:start}
#ccPrint .acft{display:flex;gap:1.4mm}
#ccPrint .acft div{background:var(--soft);border-radius:6px;padding:.9mm 2mm}
#ccPrint .acft span{display:block;font-size:7pt;color:var(--muted)}
#ccPrint .acft b{font-size:9.6pt;font-family:var(--f-mono,monospace)}
#ccPrint .mel{padding:.4mm 0}
#ccPrint .note{white-space:pre-wrap;color:var(--muted);font-size:7.8pt;margin-top:.6mm}
#ccPrint .wx td{font-size:8pt}
#ccPrint .wx td.w{white-space:nowrap;font-weight:600}
#ccPrint .wx td.w small{display:block;font-weight:400;color:var(--muted);font-family:var(--f-mono,monospace);font-size:6.9pt}
#ccPrint .g{font-family:var(--f-mono,monospace);font-size:7.3pt;margin-right:4px}
#ccPrint .g.hot{color:var(--red)} #ccPrint .g.warm{color:var(--amber)}
#ccPrint .gl{padding:.15mm 0}
#ccPrint .raw{font-family:var(--f-mono,monospace);font-size:6.8pt;line-height:1.4;background:var(--soft);border-radius:5px;padding:.8mm 1.6mm;margin-top:1mm;color:#2C3A48;word-break:break-word}
#ccPrint .src{font-size:6.8pt;color:var(--muted);border-left:3px solid var(--green);padding-left:2.2mm;margin-top:1mm}
#ccPrint .src b{color:var(--text)}
#ccPrint .nt td{font-size:8pt}
#ccPrint .nt tr.off td{color:#93A0AE}
#ccPrint .ftr{display:flex;justify-content:space-between;gap:4mm;font-size:6.6pt;color:#8796A6;border-top:1px solid var(--line);padding-top:1.2mm;margin-top:.6mm}
#ccPrint .empty{color:var(--muted);font-size:7.8pt}
`;

  let melCache = null;
  async function melData() {
    if (melCache && Date.now() - melCache.at < 5 * 6e4) return melCache.d;
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
    try {
      const r = await fetch(MEL_URL + "?t=" + Math.floor(Date.now() / 6e4), { cache: "no-store", signal: ctl.signal });
      if (!r.ok) return null;
      const d = await r.json();
      melCache = { at: Date.now(), d };
      return d;
    } catch { return null; } finally { clearTimeout(t); }
  }
  const pick = (o, ...k) => { for (const x of k) if (o[x] != null && o[x] !== "") return String(o[x]); return ""; };
  const melRow = (e) => ({ ref: pick(e, "reference", "ref"), cat: pick(e, "mel_cat", "cat"), txt: pick(e, "deferred_defects", "defect", "description"),
    mr2: pick(e, "mr2_no", "mr2", "ref_no"), exp: pick(e, "expire_date", "expiry", "due"), lim: pick(e, "expire_limit", "limit") });
  const isMel = (e) => /^MEL\b/i.test(e.ref) || /^[ABCD]$/.test(e.cat.trim());
  const normReg = (s) => { const r = String(s || "").toUpperCase().replace(/\s+/g, ""); return /^HS-?[A-Z]{3}$/.test(r) ? r.replace(/^HS(?!-)/, "HS-") : ""; };

  const hm = (ms, st) => (ms == null ? "—" : local(ms, st).hm);

  function wxWindow(label, st, s, n, tafs, isDep) {
    const i = icao(st);
    if (!i) return null;
    const out = { label, st, icao: i, s, n, dep: isDep, lines: [], note: "" };
    const a = tafs[i];
    if (!a) { out.note = "ไม่มี TAF ของ " + i; return out; }
    if (n < a.vf || s > a.vt) { out.note = `TAF (valid ${zd(a.vf)}–${zd(a.vt)}) ไม่ครอบคลุมช่วงนี้`; return out; }
    const main = a.groups.filter((f) => f.kind === "BASE" || f.kind === "FM");
    const prev = (f) => main.filter((h) => h.from <= f.from).pop() || main[0];
    const inWin = (f) => f.from < n && f.to > s;
    const groups = [...main.filter(inWin), ...a.groups.filter((f) => !(f.kind === "BASE" || f.kind === "FM") && inWin(f))];
    for (const f of groups) {
      const sv = wxSeverity(f.text);
      let v = null;
      if (!isDep && f.kind !== "BASE") { const [c, t, y] = verdict(f, prev(f), s, n); v = { c, lbl: V_STYLE[c][1], t, y }; }
      out.lines.push({ raw: f.kind === "BASE" ? "Prevailing " + f.text : f.raw, cls: sv.cls, trans: sv.trans, v });
    }
    if (!groups.some((f) => f.kind !== "BASE" && f.kind !== "FM")) out.note = "ไม่มี TEMPO / PROB / BECMG ในช่วงนี้";
    return out;
  }
  const vCls = (c) => (c === "app" ? "bad" : c === "may" || c === "unk" ? "warn" : "ok");

  function buildHtml(mel) {
    const o = sorted().find((d) => key(d) === briefKey);
    if (!o) return null;
    const b = brief(o), r = BR[briefKey] || {}, legs = legsOf(o);
    const base = (STATE?.base || S.base || "BKK").toUpperCase();
    const from = (o.from || base).toUpperCase();
    const ops = Array.isArray(r.ops) ? r.ops : [];
    const opOf = (i) => ops.find((x) => x.i === i)?.f || null;

    // ----- times -----
    const nt = legs.some((l) => l.nt);
    const last = legs[legs.length - 1];
    const lastOn = last ? last.arr : null;
    const fdp = last && b.repAbs && !(last.nt && !b.relAbs) ? (lastOn - b.repAbs) / 6e4 : null;
    const left = fdp != null && b.fdpMax ? b.fdpMax - fdp : null;
    const lc = left == null ? "" : left < 60 ? "var(--red)" : left < 120 ? "#C98A1E" : "var(--green)";

    // ----- legs table -----
    const turns = [];
    const legRows = legs.map((l, k) => {
      const nx = legs[k + 1];
      let turn = null;
      if (nx && !l.nt && !nx.nt) turn = (nx.dep - l.arr) / 6e4;
      if (turn != null) turns.push({ at: l.s.arr, min: turn });
      const tc = turn == null ? "" : turn < 35 ? "tbad" : turn < 50 ? "twarn" : "";
      const f = opOf(l.i);
      const t = (v, ms) => (l.nt || !v ? '<span class="mu">—</span>' : `<span class="m">${H(v)}</span><span class="z m">${zt(ms)}</span>`);
      return `<tr><td class="mu">${k + 1}</td><td class="m"><b>VZ${H(l.s.flt)}</b></td><td class="m">${H(l.s.dep)} → ${H(l.s.arr)}</td>
<td>${t(l.s.std, l.dep)}</td><td>${t(l.s.sta, l.arr)}</td><td class="m">${l.nt ? "—" : fmtDur((l.arr - l.dep) / 6e4)}</td>
<td class="${tc}">${turn == null ? (nx ? '<span class="mu">—</span>' : "") : `<span class="m">${Math.round(turn)}</span> นาที ที่ <span class="m">${H(l.s.arr)}</span>`}</td>
<td class="m">${H(f?.gate || (k === 0 ? r.gate : "") || "")}</td></tr>`;
    }).join("");

    // ----- aircraft / MEL -----
    const regs = [...new Set([normReg(r.reg), ...ops.map((x) => normReg(x.f?.ac))].filter(Boolean))];
    const reg = regs[0] || "";
    const f0 = opOf(0), ib = ops.find((x) => x.i === 0)?.inbound;
    let melHtml = "", melCount = 0;
    if (regs.length && mel?.aircraft) {
      for (const g of regs) {
        const rows = (mel.aircraft?.[g] || []).map(melRow), m = rows.filter(isMel), other = rows.length - m.length;
        melCount += m.length;
        melHtml += `<div class="mel"><b class="m">${H(g)}</b> · ${m.length} MEL${other ? ` · ${other} deferred defect อื่น` : ""}${rows.length ? "" : ' <span class="pill ok">ไม่มีรายการค้าง</span>'}</div>` +
          m.map((e) => `<div class="mel"><span class="pill warn">${H(e.cat && e.cat !== "NIL" ? "CAT " + e.cat : "MEL")}</span> <b class="m">${H(e.ref.replace(/^MEL\s*/i, "MEL ") || e.mr2)}</b> ${H(e.txt)}${e.exp && e.exp !== "-" ? ` <span class="mu">· exp ${H(e.exp)}</span>` : e.lim && e.lim !== "-" ? ` <span class="mu">· ${H(e.lim)}</span>` : ""}</div>`).join("");
      }
      melHtml += `<div class="mu" style="font-size:7pt">MEL dashboard อัปเดต ${H(mel.fetched_at ? new Date(mel.fetched_at).toLocaleString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }) : "")} · ตรวจกับ Tech Log จริงก่อนบิน</div>`;
    } else if (regs.length) melHtml = '<div class="empty">ยังโหลด MEL dashboard ไม่ได้ · เปิด MEL Dashboard ดูแทน</div>';
    else melHtml = '<div class="empty">ยังไม่รู้ทะเบียนเครื่อง · กดดึงจากชีต OMC หรือพิมพ์ REG ในหน้า Brief</div>';
    const myNote = String(r.mel || "").trim();
    if (myNote && !myNote.startsWith("[MEL dashboard")) melHtml += `<div class="note">${H(myNote)}</div>`;
    let ibHtml = "";
    if (ib && f0) {
      const p = [ib.ata, ib.eta2, ib.eta, ib.sta].find((x) => /\d{1,2}:\d{2}/.test(x || "")) || "";
      const q = [f0.etd, f0.std].find((x) => /\d{1,2}:\d{2}/.test(x || "")) || "";
      const g = typeof gapMin === "function" ? gapMin(p, q) : null;
      ibHtml = `<div class="mel"><span class="pill ${g != null && g < 35 ? "bad" : g != null && g < 50 ? "warn" : "info"}">ขาเข้า</span> <b class="m">${H(ib.flt)}</b> ${H(ib.from)}→${H(ib.to)} ${ib.ata ? "ATA" : "ETA"} <b class="m">${H(p || "—")}</b>${g != null ? ` · บนพื้นก่อนขาแรก <b class="m">${Math.round(g)}</b> นาที` : ""}</div>`;
      if (g != null) turns.unshift({ at: "inbound " + ib.flt, min: g, ib: true });
    }

    // ----- weather -----
    const tafs = parseTAF(r.taf || "", (legs[0]?.arr) || Date.now());
    const alt = r.alt || {};
    const wins = [];
    legs.forEach((l, k) => {
      const s0 = l.nt ? l.dep : l.arr, s1 = l.arr; // legs without times use the whole duty window
      if (k === 0) wins.push(wxWindow(`DEP ขา 1`, l.s.dep, l.dep - HR, (l.nt ? l.arr : l.dep) + HR, tafs, true));
      wins.push(wxWindow(`ARR ขา ${k + 1}`, l.s.arr, s0 - HR, s1 + HR, tafs, false));
      const a = alt[l.i] ?? ALTDEF[l.s.arr];
      if (a) wins.push(wxWindow(`ALT ขา ${k + 1}`, a, s0 - HR, s1 + HR, tafs, false));
    });
    const merged = new Map();
    for (const w of wins.filter(Boolean)) {
      const k = w.icao + "|" + w.s + "|" + w.n, m = merged.get(k);
      if (!m) { merged.set(k, w); continue; }
      m.label += ", " + w.label;
      if (m.dep && !w.dep) { m.lines = w.lines; m.note = w.note; m.dep = false; }
    }
    const wxRows = [...merged.values()].map((w) => {
      const st = w.label.startsWith("DEP") && !legs[0].nt ? hm(legs[0].dep, legs[0].s.dep) : "";
      const body = w.lines.map((x) => `<div class="gl"><span class="g ${x.cls}">${H(x.raw)}</span>${x.trans ? `<span class="mu" style="font-size:7pt">${H(x.trans)}</span> ` : ""}${x.v ? (x.v.c === "app" && /improvement/i.test(x.v.t) ? `<span class="pill ok">${H(x.v.lbl)} · ดีขึ้น</span>` : x.v.c === "app" && /wind\/other/i.test(x.v.t) ? `<span class="pill warn">${H(x.v.lbl)} · ลมเปลี่ยน</span>` : `<span class="pill ${vCls(x.v.c)}">${H(x.v.lbl)}</span>`) : ""}</div>`).join("");
      return `<tr><td class="w">${H(w.label)} <span class="m">${H(w.icao)}</span><small>${zt(w.s)}–${zt(w.n)}${st ? " · STD " + st : ""}</small></td>
<td>${body || ""}${w.note ? `<div class="empty">${H(w.note)}</div>` : ""}</td></tr>`;
    }).join("");
    const usedIcao = [...new Set(wins.filter(Boolean).map((w) => w.icao))];
    const metars = r.metar || {};
    const rawWx = usedIcao.map((i) => {
      const t = (r.taf || "").split("\n").filter((x) => new RegExp("\\b" + i + "\\s+\\d{6}Z").test(x)).join(" ");
      return (metars[i]?.raw ? H(metars[i].raw) + "<br>" : "") + (t ? H(t) : "");
    }).filter(Boolean).join("<br>");

    // ----- NOTAM -----
    const ns = r.notamSum?.airports || [];
    const rank = (x) => ({ high: 0, medium: 1 }[x.impact] ?? 2);
    const nItems = ns.flatMap((a) => (a.items || []).map((x) => ({ ...x, icao: a.icao })))
      .sort((p, q) => (p.active_in_window === false) - (q.active_in_window === false) || rank(p) - rank(q));
    const ntRows = nItems.map((x) => `<tr class="${x.active_in_window === false ? "off" : ""}"><td class="m"><b>${H(x.icao)}</b></td><td class="m" style="font-size:7.4pt">${H(x.id || "")}</td><td>${H(x.summary || "")}</td>
<td>${x.active_in_window === true ? '<span class="pill info">ทับช่วงบิน</span>' : x.active_in_window === false ? '<span class="pill">ไม่ทับ</span>' : '<span class="pill warn">ตรวจเอง</span>'}</td>
<td><span class="pill ${x.impact === "high" ? "bad" : x.impact === "medium" ? "warn" : ""}">${H(x.impact || "low")}</span></td></tr>`).join("");

    // ----- threats (from the sections above) -----
    const th = [];
    [...merged.values()].forEach((w) => w.lines.forEach((x) => {
      if (x.v?.c === "app" && !/improvement|wind\/other/i.test(x.v.t) && (x.cls === "hot" || x.cls === "warm")) th.push(["b", `${w.icao} ${w.label}: ${x.raw}`, "APPLICABLE · เทียบ minima / alternate / fuel"]);
      else if (x.cls === "hot" && !/^Prevailing/.test(x.raw)) th.push(["w", `${w.icao} ${w.label}: ${x.raw}`, w.label.startsWith("DEP") ? "สภาพอากาศตอนออก · เช็ค take-off minima" : (x.trans ? x.trans + " · " : "") + "brief threat (CB / windshear / holding)"]);
    }));
    nItems.filter((x) => x.impact === "high" && x.active_in_window !== false).forEach((x) => th.push(["b", `${x.icao} ${x.id || ""}: ${x.summary || ""}`, "NOTAM ผลสูง ทับช่วงบิน"]));
    turns.filter((t) => t.min < 50).forEach((t) => th.push([t.min < 35 ? "b" : "w", t.ib ? `เครื่องขาเข้าอยู่บนพื้น ${Math.round(t.min)} นาทีก่อนขาแรก` : `Turnaround ${Math.round(t.min)} นาทีที่ ${t.at}`, "ถ้าเครื่องเข้าช้า ขาถัดไปจะถูกบีบ"]));
    if (left != null && left < 120) th.push([left < 60 ? "b" : "w", `FDP เหลือ ${fmtDur(left)} ก่อนต้องใช้ extension`, "ดีเลย์สะสมอาจเกิน max FDP"]);
    if (melCount) th.push(["w", `MEL ${melCount} รายการบน ${reg}`, "ดู (O)(M) procedure และผลต่อ performance"]);
    const thHtml = th.length ? `<ul class="thl">${th.slice(0, 7).map(([c, a, b2]) => `<li class="${c}"><b>${H(a)}</b> <span>— ${H(b2)}</span></li>`).join("")}</ul>`
      : '<div class="empty">ไม่พบ threat จากข้อมูลที่ใส่ในแอป · ยังต้องดู OFP, NOTAM และ weather ทางการ</div>';

    // ----- header -----
    const [Y, Mo, D] = o.date.split("-").map(Number), dw = new Date(Date.UTC(Y, Mo - 1, D)).getUTCDay();
    const route = (typeof stationName === "function" ? stationName(o) : "").split("–").map(H).join(' <span style="color:#5CC08A">→</span> ');
    const whoTxt = (document.getElementById("who")?.textContent || "").trim();
    const who = / · /.test(whoTxt) ? whoTxt : "";   // name · fleet · rank once signed in
    const tile = (lbl, ms, st, cls = "", extra = "") => `<div class="tile ${cls}"><span>${lbl}</span><b>${ms == null ? "—" : hm(ms, st)}</b>${ms == null ? "" : `<em>${extra || zt(ms)}</em>`}</div>`;
    const now = new Date();
    const gen = local(now.getTime(), base);

    return `<div class="pg">
<div class="hdr"><div class="hl"><div class="kick">CREW BRIEF · PRE-REPORT</div><div class="row"><span class="code m">${H(o.code || "")}</span><span class="route m">${route}</span></div></div>
<div class="hr"><div class="date m">${DOW[dw]} ${String(D).padStart(2, "0")} ${MON[Mo - 1]} ${Y}</div><div class="dth">${DOW_TH[dw]} ${D} ${MON_TH[Mo - 1]} ${Y + 543}</div><div class="who">${H(who)}</div></div></div>
<div class="tiles">${tile("ตื่น", b.wakeAbs, base, "", " ")}${tile("ออกจากบ้าน", b.leaveAbs, base, "", " ")}${tile("Report", b.repAbs, from, "key")}${tile("Off-block แรก", legs[0] && !legs[0].nt ? legs[0].dep : null, legs[0]?.s.dep)}${tile(last?.nt ? "On-block สุดท้าย ≈" : "On-block สุดท้าย", lastOn ?? null, last?.s.arr || base)}${tile("Release", b.relAbs, (o.to || last?.s.arr || base))}</div>
${fdp != null && b.fdpMax ? `<div class="fdp"><div class="t"><b>FDP ตามตาราง <span class="m">${fmtDur(fdp)}</span></b> จาก max <span class="m">${fmtDur(b.fdpMax)}</span> · เหลือ <b class="m" style="color:${lc}">${fmtDur(left)}</b> ก่อนต้องใช้ extension${last?.nt ? ' <span class="mu">(ประมาณจาก release − 30 นาที post-flight duty · OM-A 7.1.5 C)</span>' : ""}${o.block ? `<span class="r">Block รวม <b class="m" style="color:var(--text)">${H(o.block)}</b></span>` : ""}</div><div class="bar"><i style="width:${Math.max(0, Math.min(100, (fdp * 100) / b.fdpMax)).toFixed(1)}%;background:${lc}"></i></div></div>` : ""}
<div class="card"><h3>เที่ยวบิน <small>เวลาท้องถิ่น · Z${nt ? " · บางขายังไม่มีเวลา STD/STA (รอ Flight Detail)" : ""}</small></h3>
<table><thead><tr><th>#</th><th>Flight</th><th>Route</th><th>STD</th><th>STA</th><th>Block</th><th>Turnaround</th><th>Gate</th></tr></thead><tbody>${legRows}</tbody></table></div>
<div class="card"><h3>Threats วันนี้ <small>สรุปอัตโนมัติจากหัวข้อด้านล่าง</small></h3>${thHtml}</div>
<div class="card"><h3>1 · เครื่องและ MEL</h3><div class="ac"><div class="acft"><div><span>Registration</span><b>${H(reg || "—")}</b></div><div><span>Gate ขาแรก</span><b>${H(f0?.gate || r.gate || "—")}</b></div></div><div>${melHtml}${ibHtml}</div></div></div>
<div class="card"><h3>2 · Weather ที่ ETA ±1 ชม. <small>เวลา UTC</small></h3>${wxRows ? `<table class="wx"><tbody>${wxRows}</tbody></table>` : '<div class="empty">ยังไม่มี TAF / METAR · กด "ดึง TAF / METAR" หรือวางจาก AeroWeather ในหน้า Brief</div>'}
${rawWx ? `<div class="raw">${rawWx}</div>` : ""}
<div class="src"><b>OM-A 8.1.2.4.6 A · p.8-26</b> ±1 ชม. รอบ ETA ≥ landing minima · <b>OM-A 8.1.2.5 Table 1 · p.8-29</b> TEMPO/PROB transient (TS, SH) = Not applicable · persistent (BR, FG, HZ) = Applicable · ยังไม่เทียบ minima ราย approach (ดู Jeppesen)</div></div>
<div class="card"><h3>3 · NOTAM <small>${nItems.length ? "สรุปอัตโนมัติจากข้อความที่วาง · ตรวจกับต้นฉบับ" : ""}</small></h3>${ntRows ? `<table class="nt"><thead><tr><th>AD</th><th>NOTAM</th><th>เรื่อง</th><th>ช่วงบิน</th><th>ผล</th></tr></thead><tbody>${ntRows}</tbody></table>` : '<div class="empty">ยังไม่ได้สรุป NOTAM · วาง NOTAM แล้วกด "สรุป NOTAM ตามช่วงเวลาบิน" ในหน้า Brief</div>'}</div>
<div class="ftr"><span>CoolCrew · Crew Brief · พิมพ์ ${gen.date.split("-").reverse().join("/")} ${gen.hm} ${H(base)}</span><span>ช่วยเตรียม brief ไม่ใช่เอกสารทางการ · ใช้ OFP, NOTAM และ weather ทางการประกอบเสมอ</span></div>
</div>`;
  }

  const SHADOW_CSS = CSS.replace(/#ccPrint\{/g, ":host{display:block;").replace(/#ccPrint /g, "");
  const wrap = (h) => `<style>${SHADOW_CSS}</style><div id="ccPrintIn">${h}</div>`;
  function printBox() {
    let box = document.getElementById("ccPrint");
    if (!box) { box = document.createElement("div"); box.id = "ccPrint"; document.body.appendChild(box); }
    if (!box.shadowRoot) box.attachShadow({ mode: "open" });
    return box;
  }
  const cachedMel = () => melCache?.d || null;
  const msg = (t, color) => { const m = document.getElementById("b_printMsg"); if (m) { m.innerHTML = t; m.style.color = color || ""; } };
  // iPhone/iPad "Add to Home Screen" apps cannot reliably open the print sheet: use the PDF + share sheet there
  const standalone = () => navigator.standalone === true || !!window.matchMedia?.("(display-mode: standalone)").matches;
  const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // Safari only opens the print sheet if window.print() runs in the same tap, so nothing here may await
  function doPrint() {
    melData();   // refresh for next time
    let html;
    try { html = buildHtml(cachedMel()); } catch (e) { console.error("print brief", e); msg("สร้างรายงานไม่ได้ · ลองใหม่", "var(--red)"); return; }
    if (!html) { msg("ยังไม่มี flight duty ในตาราง", "var(--amber)"); return; }
    if (isIOS() && standalone()) { msg("แอปบนหน้าโฮมของ iPhone สั่งพิมพ์ตรงไม่ได้ · กำลังทำเป็น PDF ให้แทน…"); makePdf(); return; }
    printBox().shadowRoot.innerHTML = wrap(html);
    msg("");
    window.print();
  }

  // ---------- PDF (share sheet: print / save to Files / LINE) ----------
  const LIBS = [
    ["https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js", "sha512-BNaRQnYJYiPSqHHDb58B0yaPfCu+Wgds8Gp/gU33kqBtgNS4tSPHuGibyoeqMV/TJlSKda6FXzoEyYGjTe+vXA=="],
    ["https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "sha512-qZvrmS2ekKPF2mSznTQsxqPgnpkI4DNTlrdUmTzrDgektczlKNRRhy5X5AAOnx5S09ydFYWWNSfcEqDTTHgtNA=="],
  ];
  const FONTS = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap";
  let pdfFile = null, pdfBusy = false;
  function pdfName() {
    const o = sorted().find((d) => key(d) === briefKey);
    return `CrewBrief-${String(o?.code || "duty").replace(/[^\w-]+/g, "_")}-${o?.date || ""}.pdf`;
  }
  async function makePdf() {
    if (pdfBusy) return;
    pdfBusy = true; pdfFile = null;
    const btn = document.getElementById("b_pdf");
    if (btn) { btn.disabled = true; btn.textContent = "กำลังทำ PDF…"; }
    msg("กำลังทำ PDF… (ครั้งแรกใช้เวลาโหลดสักครู่)");
    let fr = null;
    try {
      const html = buildHtml((await melData()) || cachedMel());
      if (!html) throw new Error("ยังไม่มี flight duty ในตาราง");
      fr = document.createElement("iframe");
      fr.setAttribute("aria-hidden", "true");
      fr.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none";
      // A4 at 96 dpi = 794 px wide; 8 mm side margins as in print
      fr.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS}">
<style>:root{--f-body:"IBM Plex Sans Thai",sans-serif;--f-mono:"IBM Plex Mono",monospace}html,body{margin:0;background:#fff}#ccPrint{width:794px;padding:30px 34px 34px}${CSS}</style>
${LIBS.map(([u, h]) => `<script src="${u}" integrity="${h}" crossorigin="anonymous" referrerpolicy="no-referrer"><\/script>`).join("")}
</head><body><div id="ccPrint">${html}</div></body></html>`;
      document.body.appendChild(fr);
      await new Promise((res, rej) => { fr.onload = res; setTimeout(() => rej(new Error("โหลดตัวทำ PDF ไม่ทัน (เน็ตช้า?)")), 25000); });
      const w = fr.contentWindow;
      if (!w.html2canvas || !w.jspdf) throw new Error("โหลดตัวทำ PDF ไม่ได้");
      await (w.document.fonts?.ready || Promise.resolve());
      const el = w.document.getElementById("ccPrint");
      const canvas = await w.html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: 794 });
      const pdf = new w.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      const pw = 210, ph = 297, pxPerPage = Math.floor(canvas.width * ph / pw);
      for (let y = 0, n = 0; y < canvas.height; y += pxPerPage, n++) {
        const h = Math.min(pxPerPage, canvas.height - y), c = w.document.createElement("canvas");
        c.width = canvas.width; c.height = h;
        const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, h); g.drawImage(canvas, 0, -y);
        if (n) pdf.addPage();
        pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pw, (h * pw) / canvas.width);
      }
      pdfFile = new File([pdf.output("blob")], pdfName(), { type: "application/pdf" });
      if (btn) { btn.textContent = "📤 แชร์ / บันทึก PDF"; btn.classList.add("primary"); }
      msg(`PDF พร้อมแล้ว · กด <b>แชร์ / บันทึก PDF</b> แล้วเลือก "พิมพ์", "บันทึกไปยังไฟล์" หรือส่ง LINE`, "var(--green)");
    } catch (e) {
      console.error("brief pdf", e);
      if (btn) btn.textContent = "📄 PDF";
      msg("ทำ PDF ไม่ได้: " + esc(String(e?.message || e)), "var(--red)");
    } finally {
      fr?.remove();
      pdfBusy = false;
      if (btn) btn.disabled = false;
    }
  }
  // the share sheet also needs to open inside a tap, so the file is made first and shared on the next tap
  function sharePdf() {
    const f = pdfFile;
    if (!f) return makePdf();
    const done = () => { pdfFile = null; const b = document.getElementById("b_pdf"); if (b) { b.textContent = "📄 PDF"; b.classList.remove("primary"); } };
    if (navigator.canShare?.({ files: [f] })) {
      navigator.share({ files: [f], title: f.name }).then(() => { msg(""); done(); }).catch((e) => { if (e?.name !== "AbortError") msg("แชร์ไม่ได้: " + esc(e?.message || e), "var(--red)"); });
      return;
    }
    const u = URL.createObjectURL(f), a = document.createElement("a");
    a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 60000);
    msg("ดาวน์โหลด " + esc(f.name) + " แล้ว", "var(--green)"); done();
  }

  window.ccFillBriefPrint = async () => { const h = buildHtml(await melData()); if (!h) return false; printBox().shadowRoot.innerHTML = wrap(h); return true; };   // used by tests
  window.ccBuildBriefPrint = async () => buildHtml(await melData());   // used by tests
  window.ccMakeBriefPdf = async () => { await makePdf(); return pdfFile; };   // used by tests
  function init() {
    if (!document.getElementById("ccPrintCss")) {
      const st = document.createElement("style"); st.id = "ccPrintCss"; st.textContent = DOC_CSS; document.head.appendChild(st);
    }
    const btn = document.getElementById("b_print");
    if (btn && !btn.__cc) { btn.__cc = 1; btn.addEventListener("click", doPrint); }
    const pb = document.getElementById("b_pdf");
    if (pb && !pb.__cc) { pb.__cc = 1; pb.addEventListener("click", sharePdf); }
    document.getElementById("b_duty")?.addEventListener("change", () => { pdfFile = null; const b = document.getElementById("b_pdf"); if (b) { b.textContent = "📄 PDF"; b.classList.remove("primary"); } msg(""); });
    melData();   // warm the MEL cache so a tap can print straight away
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
