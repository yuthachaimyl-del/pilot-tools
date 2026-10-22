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

  const docCss = (mode) => `
#ccPrint{display:none}
@media print{
  @page{size:A4${mode === "fold-l" ? " landscape" : ""};margin:${mode === "fold-l" || mode === "fold-p" ? "0" : "8mm 9mm 10mm"}}
  #ccPrint .fold-l .sheet{height:209mm}#ccPrint .fold-p .sheet{height:296mm}
  :root,:root[data-theme]{color-scheme:light!important;--bg:#fff!important}
  html,body{background:#fff!important;color:#0B1117!important;padding:0!important;margin:0!important;-webkit-text-size-adjust:100%!important;text-size-adjust:100%!important}
  body>*:not(#ccPrint){display:none!important}
  #ccPrint{display:block!important}
}`;
  const DOC_CSS = docCss("a4");
  // chosen layout: "a4" (one full page), "fold-p" (A4 portrait folded twice), "fold-l" (A4 landscape folded twice)
  const LAYOUTS = [["a4", "A4 เต็มหน้า", "หน้าเดียว · NOTAM หน้า 2"], ["fold-p", "พับ 4 แนวตั้ง", "A4 ตั้ง พับ 2 ทบ"], ["fold-l", "พับ 4 แนวนอน", "A4 นอน พับ 2 ทบ"]];
  const layoutMode = () => { try { const v = localStorage.getItem("cb_printLayout"); return LAYOUTS.some((l) => l[0] === v) ? v : "a4"; } catch { return "a4"; } };
  const setDocCss = (mode) => { const st = document.getElementById("ccPrintCss"); if (st) st.textContent = docCss(mode); };
  // the report lives in a shadow root, so the app's own CSS (.card, table, .row, dark theme...) cannot leak in
  const CSS = `
#ccPrint{--ink:#0E1620;--text:#0B1117;--muted:#2F3A46;--line:#8E9AA6;--soft:#EDF0F3;--green:#1F6B3F;--green-soft:#E3F3EA;
  --amber:#7A4500;--amber-soft:#FCF0DA;--red:#9B1C12;--red-soft:#FDE8E6;--blue:#1B4F8C;--blue-soft:#E6EEF8;
  font-family:var(--f-body,"IBM Plex Sans Thai",sans-serif);font-size:9.9pt;line-height:1.3;font-weight:500;color:var(--text);background:#fff;-webkit-text-size-adjust:100%;text-size-adjust:100%;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
#ccPrint *{box-sizing:border-box}
#ccPrint .m{font-family:var(--f-mono,"IBM Plex Mono",monospace)}
#ccPrint .mu{color:var(--muted)}
#ccPrint .pg{display:flex;flex-direction:column;gap:1.5mm}
#ccPrint .hdr{background:var(--ink);color:#fff;border-radius:9px;padding:2mm 4.4mm;display:flex;justify-content:space-between;align-items:center;gap:4mm}
#ccPrint .kick{font-family:var(--f-mono,monospace);font-size:8pt;letter-spacing:.16em;color:#8FE0B2;font-weight:600}
#ccPrint .hl .row{display:flex;align-items:baseline;gap:3.5mm;flex-wrap:wrap}
#ccPrint .code{font-size:22.4pt;font-weight:600;line-height:1.1}
#ccPrint .route{font-size:11.5pt;color:#E6EDF3}
#ccPrint .hr{text-align:right}
#ccPrint .date{font-size:12.6pt;font-weight:600}
#ccPrint .dth,#ccPrint .who2{color:#D5DEE7;font-size:9.2pt}
#ccPrint .who{font-weight:600;font-size:9.9pt;margin-top:.6mm}
#ccPrint .tiles{display:grid;grid-template-columns:repeat(6,1fr);gap:1.6mm}
#ccPrint .tile{border:1px solid var(--line);border-radius:7px;padding:.8mm 2.2mm}
#ccPrint .tile span{display:block;font-size:8.5pt;color:var(--muted)}
#ccPrint .tile b{font-size:14.6pt;font-weight:600;font-family:var(--f-mono,monospace)}
#ccPrint .tile em{font-style:normal;font-size:8pt;color:var(--muted);margin-left:3px;font-family:var(--f-mono,monospace)}
#ccPrint .tile.key{background:var(--green-soft);border-color:var(--green)}
#ccPrint .tile.key b{color:var(--green)}
#ccPrint .fdp{border:1px solid var(--line);border-radius:7px;padding:1mm 2.6mm}
#ccPrint .fdp .t{display:flex;gap:5px;align-items:baseline;flex-wrap:wrap}
#ccPrint .fdp .r{margin-left:auto;color:var(--muted)}
#ccPrint .bar{height:5px;background:var(--soft);border-radius:4px;margin-top:1mm;overflow:hidden}
#ccPrint .bar i{display:block;height:100%;border-radius:4px}
#ccPrint .card{border:1px solid var(--line);border-radius:9px;padding:1.4mm 3mm}
#ccPrint .hdr,#ccPrint .tiles,#ccPrint .fdp,#ccPrint .thl li,#ccPrint .mel{break-inside:avoid}
#ccPrint h3{margin:0 0 1mm;font-size:11pt;font-weight:600;color:var(--ink);display:flex;align-items:baseline;gap:5px}
#ccPrint h3 small{font-weight:500;color:var(--muted);font-size:8.7pt}
#ccPrint table{width:100%;border-collapse:collapse}
#ccPrint th{font-size:8.4pt;font-weight:600;color:var(--muted);text-align:left;padding:.6mm 1.5mm;border-bottom:1.6px solid var(--ink)}
#ccPrint td{padding:.45mm 1.5mm;border-bottom:1px solid var(--line);vertical-align:top}
#ccPrint tr:last-child td{border-bottom:none}
#ccPrint tr{break-inside:avoid}
#ccPrint .z{font-size:8pt;color:var(--muted);margin-left:3px}
#ccPrint .pill{display:inline-block;font-size:8pt;font-weight:600;border-radius:20px;padding:0 6px;line-height:1.5;white-space:nowrap;background:var(--soft);color:var(--muted);border:1px solid transparent}
#ccPrint .bad{background:var(--red-soft);color:var(--red);border-color:var(--red)}
#ccPrint .warn{background:var(--amber-soft);color:var(--amber);border-color:var(--amber)}
#ccPrint .ok{background:var(--green-soft);color:var(--green);border-color:var(--green)}
#ccPrint .info{background:var(--blue-soft);color:var(--blue);border-color:var(--blue)}
#ccPrint td.tbad{color:var(--red);font-weight:600}
#ccPrint td.twarn{color:var(--amber);font-weight:600}
#ccPrint .thl{list-style:none;margin:0;padding:0;display:grid;gap:.7mm}
#ccPrint .thl li{border-left:3px solid #D99A2B;padding-left:2.2mm}
#ccPrint .thl li.b{border-color:var(--red)}
#ccPrint .thl li span{color:var(--muted)}
#ccPrint .ac{display:grid;grid-template-columns:auto 1fr;gap:3mm;align-items:start}
#ccPrint .acft{display:flex;gap:1.4mm}
#ccPrint .acft div{background:var(--soft);border-radius:6px;padding:.9mm 2mm}
#ccPrint .acft span{display:block;font-size:8pt;color:var(--muted)}
#ccPrint .acft b{font-size:11pt;font-family:var(--f-mono,monospace)}
#ccPrint .mel{padding:.4mm 0}
#ccPrint .note{white-space:pre-wrap;color:var(--muted);font-size:9pt;margin-top:.6mm}
#ccPrint .wx td{font-size:9.2pt}
#ccPrint .wx td.w{white-space:nowrap;font-weight:600}
#ccPrint .wx td.w small{display:block;font-weight:500;color:var(--muted);font-family:var(--f-mono,monospace);font-size:8pt}
#ccPrint .g{font-family:var(--f-mono,monospace);font-size:8.4pt;margin-right:4px}
#ccPrint .g.hot{color:var(--red)} #ccPrint .g.warm{color:var(--amber)}
#ccPrint .gl{padding:.15mm 0}
#ccPrint .raw{font-family:var(--f-mono,monospace);font-size:8pt;line-height:1.4;background:var(--soft);border-radius:5px;padding:.8mm 1.6mm;margin-top:1mm;color:#111A22;word-break:break-word}
#ccPrint .src{font-size:8pt;color:var(--muted);border-left:3px solid var(--green);padding-left:2.2mm;margin-top:1mm}
#ccPrint .src b{color:var(--text)}
#ccPrint .nt td{font-size:9.2pt}
#ccPrint .nt tr.off td{color:#55616D}
#ccPrint .nt tr.ad td{background:var(--soft);border-bottom:1.6px solid var(--ink);padding-top:1.2mm;font-size:9.4pt}
#ccPrint .nt td.nid{white-space:nowrap;font-size:8.6pt;width:1%}
#ccPrint .nt .pill{margin-left:2px}
#ccPrint .nt .nx{display:flex;flex-wrap:wrap;gap:1mm 3mm;font-size:8.2pt;margin-top:.3mm}
#ccPrint .nt .nleg{color:var(--blue)}
#ccPrint .nt .nleg .m{font-weight:600}
#ccPrint .ftr{display:flex;justify-content:space-between;gap:4mm;font-size:8pt;color:#3E4955;border-top:1px solid var(--line);padding-top:1.2mm;margin-top:.6mm}
#ccPrint .empty{color:var(--muted);font-size:9pt}
#ccPrint .p2h{display:flex;justify-content:space-between;gap:4mm;font-size:8.6pt;color:var(--muted);border-bottom:1px solid var(--line);padding-bottom:1mm;margin-bottom:.4mm}
#ccPrint .p2h b{color:var(--text)}
@media print{#ccPrint .p2{break-before:page}}
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

  function buildHtml(mel, mode) {
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
      const t = (v, ms) => (l.nt || !v ? '<span class="mu">—</span>' : `<span class="m"><b>${zt(ms)}</b></span><span class="z m">${H(v)} L</span>`);
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
          m.map((e) => `<div class="mel"><span class="pill warn">${H(e.cat && e.cat !== "NIL" ? "CAT " + e.cat : "MEL")}</span> <b class="m melref" data-copy="${H((e.ref || e.mr2 || "").replace(/^MEL\s*/i, "").trim())}" title="แตะเพื่อคัดลอกเลข MEL">${H(e.ref.replace(/^MEL\s*/i, "MEL ") || e.mr2)}</b> ${H(e.txt)}${e.exp && e.exp !== "-" ? ` <span class="mu">· exp ${H(e.exp)}</span>` : e.lim && e.lim !== "-" ? ` <span class="mu">· ${H(e.lim)}</span>` : ""}</div>`).join("");
      }
      melHtml += `<div class="mu" style="font-size:8.2pt">MEL dashboard อัปเดต ${H(mel.fetched_at ? new Date(mel.fetched_at).toLocaleString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }) : "")} · ตรวจกับ Tech Log จริงก่อนบิน</div>`;
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
    const allUncovered = merged.size && [...merged.values()].every((w) => !w.lines.length && /ไม่ครอบคลุม|ไม่มี TAF/.test(w.note || ""));
    const wxRows = allUncovered ? `<tr><td colspan="2"><div class="empty">TAF ที่มีตอนนี้ยังไม่ครอบคลุมช่วงบิน (${[...merged.values()].map((w) => `${H(w.label)} ${H(w.icao)} <span class="m">${zt(w.s)}–${zt(w.n)}</span>`).join(" · ")}) · TAF ออกล่วงหน้า ~30 ชม. เปิดแท็บนี้ใกล้วันบินจะดึงใหม่ให้เอง</div></td></tr>` : [...merged.values()].map((w) => {
      const st = w.label.startsWith("DEP") && !legs[0].nt ? hm(legs[0].dep, legs[0].s.dep) : "";
      const body = w.lines.map((x) => `<div class="gl"><span class="g ${x.cls}">${H(x.raw)}</span>${x.trans ? `<span class="mu" style="font-size:8.2pt">${H(x.trans)}</span> ` : ""}${x.v ? (x.v.c === "app" && /improvement/i.test(x.v.t) ? `<span class="pill ok">${H(x.v.lbl)} · ดีขึ้น</span>` : x.v.c === "app" && /wind\/other/i.test(x.v.t) ? `<span class="pill warn">${H(x.v.lbl)} · ลมเปลี่ยน</span>` : `<span class="pill ${vCls(x.v.c)}">${H(x.v.lbl)}</span>`) : ""}</div>`).join("");
      return `<tr><td class="w">${H(w.label)} <span class="m">${H(w.icao)}</span><small>${zt(w.s)}–${zt(w.n)}${st ? " · STD " + st : ""}</small></td>
<td>${body || ""}${w.note ? `<div class="empty">${H(w.note)}</div>` : ""}</td></tr>`;
    }).join("");
    const usedIcao = [...new Set(wins.filter(Boolean).map((w) => w.icao))];
    const metars = r.metar || {};
    // TAF groups are already listed per window above, so only the latest METARs are printed raw
    const rawWx = usedIcao.map((i) => (metars[i]?.raw ? H(metars[i].raw) : "")).filter(Boolean).join("<br>");

    // ----- NOTAM -----
    const ns = r.notamSum?.airports || [];
    const rank = (x) => ({ high: 0, medium: 1 }[x.impact] ?? 2);
    const nItems = ns.flatMap((a) => (a.items || []).map((x) => ({ ...x, icao: a.icao })))
      .sort((p, q) => (p.active_in_window === false) - (q.active_in_window === false) || rank(p) - rank(q));
    // one block per aerodrome, in the order it is used on the duty (DEP, ARR, ALT per leg), then any other
    const iataOf = {}; try { Object.keys(ST).forEach((k) => { iataOf[ST[k][0]] = k; }); } catch {}
    const roleOf = (i) => [...merged.values()].filter((w) => w.icao === i).map((w) => w.label).join(", ");
    const winByLabel = {}; wins.filter(Boolean).forEach((w) => { winByLabel[w.label] = w; });
    legs.forEach((l, k) => { const lbl = `DEP ขา ${k + 1}`; if (!winByLabel[lbl]) winByLabel[lbl] = { label: lbl, s: l.dep - HR, n: (l.nt ? l.arr : l.dep) + HR }; });   // the summariser also gets a DEP window for every leg
    const order = [...new Set([...usedIcao, ...nItems.map((x) => x.icao)])].filter((i) => nItems.some((x) => x.icao === i));
    const ntRows = order.map((i) => {
      const rows = nItems.filter((x) => x.icao === i), on = rows.filter((x) => x.active_in_window !== false).length;
      const head = `<tr class="ad"><td colspan="2"><b class="m">${H(i)}</b>${iataOf[i] ? ` <span class="mu">${H(iataOf[i])}</span>` : ""}${roleOf(i) ? ` <span class="mu">· ${H(roleOf(i))}</span>` : ""} <span class="mu">· ${rows.length} รายการ${on < rows.length ? ` · ทับช่วงบิน ${on}` : ""}</span></td></tr>`;
      return head + rows.map((x) => {
        // which leg windows it overlaps (from the summariser) → "ARR ขา 1 0025–0225Z"
        const legs = Array.isArray(x.legs) ? x.legs.map((l) => { const m = /^(DEP|ARR|ALT)\s*(\d+)/i.exec(String(l)); if (!m) return ""; const lbl = `${m[1].toUpperCase()} ขา ${m[2]}`; const w = winByLabel[lbl]; return w ? `${lbl} <span class="m">${zt(w.s)}–${zt(w.n)}</span>` : lbl; }).filter(Boolean) : [];
        const when = String(x.when || "").trim();
        const extra = (x.active_in_window === true && legs.length ? `<span class="mu nleg">${legs.join(" · ")}</span>` : "") + (when ? `<span class="mu nwhen">NOTAM ${H(when)}</span>` : "");
        return `<tr class="${x.active_in_window === false ? "off" : ""}"><td class="m nid">${H(x.id || "")}</td><td>${H(x.summary || "")} ${x.active_in_window === true ? '<span class="pill info">ทับช่วงบิน</span>' : x.active_in_window === false ? '<span class="pill">ไม่ทับ</span>' : '<span class="pill warn">ตรวจเอง</span>'} ${x.active_in_window === false ? "" : `<span class="pill ${x.impact === "high" ? "bad" : x.impact === "medium" ? "warn" : ""}">${H(x.impact || "low")}</span>`}${extra ? `<div class="nx">${extra}</div>` : ""}</td></tr>`;
      }).join("");
    }).join("");

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
    const route = (typeof stationName === "function" ? stationName(o) : "").split("–").map(H).join(' <span style="color:#8FE0B2">→</span> ');
    const whoTxt = (document.getElementById("who")?.textContent || "").trim();
    const who = / · /.test(whoTxt) ? whoTxt : "";   // name · fleet · rank once signed in
    const tile = (lbl, ms, st, cls = "", extra = "") => `<div class="tile ${cls}"><span>${lbl}</span><b>${ms == null ? "—" : extra ? hm(ms, st) : zt(ms)}</b>${ms == null ? "" : `<em>${extra ? "local" : hm(ms, st) + " L"}</em>`}</div>`;
    const now = new Date();
    const gen = local(now.getTime(), base);

    if (mode === "fold-p" || mode === "fold-l") return foldPage(mode, { o, b, r, legs, base, from, reg, f0, ib, melHtml, ibHtml, melCount, merged, nItems, winByLabel, usedIcao, th, fdp, left, lc, last, lastOn, nt, turns, who, Y, Mo, D, dw, gen, opOf, alt, iataOf });
    return `<div class="pg">
<div class="hdr"><div class="hl"><div class="kick">CREW BRIEF · PRE-REPORT</div><div class="row"><span class="code m">${H(o.code || "")}</span><span class="route m">${route}</span></div></div>
<div class="hr"><div class="date m">${DOW[dw]} ${String(D).padStart(2, "0")} ${MON[Mo - 1]} ${Y}</div><div class="dth">${DOW_TH[dw]} ${D} ${MON_TH[Mo - 1]} ${Y + 543}</div><div class="who">${H(who)}</div></div></div>
<div class="tiles">${tile("ตื่น", b.wakeAbs, base, "", " ")}${tile("ออกจากบ้าน", b.leaveAbs, base, "", " ")}${tile("Report", b.repAbs, from, "key")}${tile("Off-block แรก", legs[0] && !legs[0].nt ? legs[0].dep : null, legs[0]?.s.dep)}${tile(last?.nt ? "On-block สุดท้าย ≈" : "On-block สุดท้าย", lastOn ?? null, last?.s.arr || base)}${tile("Release", b.relAbs, (o.to || last?.s.arr || base))}</div>
${fdp != null && b.fdpMax ? `<div class="fdp"><div class="t"><b>FDP ตามตาราง <span class="m">${fmtDur(fdp)}</span></b> จาก max <span class="m">${fmtDur(b.fdpMax)}</span> · เหลือ <b class="m" style="color:${lc}">${fmtDur(left)}</b> ก่อนต้องใช้ extension${last?.nt ? ' <span class="mu">(≈ release − 30 นาที · OM-A 7.1.5 C)</span>' : ""}${o.block ? `<span class="r">Block รวม <b class="m" style="color:var(--text)">${H(o.block)}</b></span>` : ""}</div><div class="bar"><i style="width:${Math.max(0, Math.min(100, (fdp * 100) / b.fdpMax)).toFixed(1)}%;background:${lc}"></i></div></div>` : ""}
<div class="card"><h3>เที่ยวบิน <small>UTC ใหญ่ · local เล็ก${nt ? " · บางขายังไม่มีเวลา STD/STA (รอ Flight Detail)" : ""}</small></h3>
<table><thead><tr><th>#</th><th>Flight</th><th>Route</th><th>STD</th><th>STA</th><th>Block</th><th>Turnaround</th><th>Gate</th></tr></thead><tbody>${legRows}</tbody></table></div>
<div class="card"><h3>Threats วันนี้ <small>สรุปอัตโนมัติจากหัวข้อด้านล่าง</small></h3>${thHtml}</div>
<div class="card"><h3>1 · เครื่องและ MEL</h3><div class="ac"><div class="acft"><div><span>Registration</span><b>${H(reg || "—")}</b></div><div><span>Gate ขาแรก</span><b>${H(f0?.gate || r.gate || "—")}</b></div></div><div>${melHtml}${ibHtml}</div></div></div>
<div class="card"><h3>2 · Weather ที่ ETA ±1 ชม. <small>เวลา UTC</small></h3>${wxRows ? `<table class="wx"><tbody>${wxRows}</tbody></table>` : '<div class="empty">ยังไม่มี TAF / METAR · กด "ดึง TAF / METAR" หรือวางจาก AeroWeather ในหน้า Brief</div>'}
${rawWx ? `<div class="raw"><b>METAR ล่าสุด</b><br>${rawWx}</div>` : ""}
<div class="src"><b>OM-A 8.1.2.4.6 A (p.8-26)</b> ±1 ชม. รอบ ETA ≥ landing minima · <b>8.1.2.5 Table 1 (p.8-29)</b> · ยังไม่เทียบ minima ราย approach (ดู Jeppesen)</div></div>
${ntRows ? `<div class="p2"><div class="p2h"><span><b>${H(o.code || "")}</b> · ${DOW[dw]} ${String(D).padStart(2, "0")} ${MON[Mo - 1]} ${Y} · ${route.replace(/<[^>]+>/g, "")}</span><span>หน้า 2 · NOTAM</span></div>` : ""}<div class="card"><h3>3 · NOTAM <small>${nItems.length ? "สรุปอัตโนมัติจากข้อความที่วาง · ตรวจกับต้นฉบับ" : ""}</small></h3>${ntRows ? `<table class="nt"><tbody>${ntRows}</tbody></table>` : '<div class="empty">ยังไม่ได้สรุป NOTAM · วาง NOTAM แล้วกด "สรุป NOTAM ตามช่วงเวลาบิน" ในหน้า Brief</div>'}</div>${ntRows ? "</div>" : ""}
<div class="ftr"><span>CoolCrew · Crew Brief · พิมพ์ ${gen.date.split("-").reverse().join("/")} ${gen.hm} ${H(base)}</span><span>ช่วยเตรียม brief ไม่ใช่เอกสารทางการ · ใช้ OFP, NOTAM และ weather ทางการประกอบเสมอ</span></div>
</div>`;
  }


  // ---------- folded A4 (4 panels, A6 each): "fold-p" portrait sheet, "fold-l" landscape sheet ----------
  const FOLD_CSS = `
#ccPrint .sheet{position:relative;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;background:#fff;color:var(--text);font-size:9pt;line-height:1.3;font-weight:500;break-after:page}
#ccPrint .sheet:last-child{break-after:auto}
#ccPrint .fold-p .sheet{width:210mm;height:297mm}
#ccPrint .fold-l .sheet{width:297mm;height:210mm}
#ccPrint .fv{position:absolute;left:50%;top:0;height:100%;border-left:1px dashed #9AA6B2}
#ccPrint .fh{position:absolute;left:0;top:50%;width:100%;border-top:1px dashed #9AA6B2}
#ccPrint .fl{position:absolute;font-size:7pt;color:#9AA6B2;background:#fff;padding:0 2px}
#ccPrint .pn{padding:7mm 7mm 6mm;display:flex;flex-direction:column;gap:1.8mm;min-height:0;overflow:hidden;position:relative}
#ccPrint .fold-p .pn{padding:8mm 7mm 7mm}
#ccPrint .pn .pno{position:absolute;top:2.6mm;left:7mm;font-size:6.6pt;color:#9AA6B2}
#ccPrint .fcard{display:flex;flex-direction:column;height:100%}
#ccPrint .fch{background:var(--ink);color:#fff;border-radius:3mm;padding:2mm 3.5mm;display:flex;justify-content:space-between;align-items:center;gap:3mm}
#ccPrint .fch .kick{font-size:6.6pt;letter-spacing:.16em;color:#8FE0B2;font-weight:600;font-family:var(--f-mono,monospace)}
#ccPrint .fch .reg{font-size:18pt;font-weight:700;line-height:1;font-family:var(--f-mono,monospace)}
#ccPrint .fch .typ{font-size:9pt;color:#C9D4DF;margin-top:1mm}
#ccPrint .fch .gate{text-align:right}#ccPrint .fch .gate small{display:block;font-size:6.6pt;color:#C9D4DF;letter-spacing:.12em}#ccPrint .fch .gate b{font-size:18pt;line-height:1;font-family:var(--f-mono,monospace)}
#ccPrint .fdl{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:0 2mm;padding:1.2mm 1mm .8mm;border-bottom:1.4px solid var(--ink);font-size:8.4pt;color:var(--muted)}
#ccPrint .fdl b{font-size:11pt;color:var(--text)}#ccPrint .fdl .rp{font-family:var(--f-mono,monospace);font-weight:700;color:var(--green);font-size:10.5pt}
#ccPrint .flegs{display:flex;flex-direction:column;flex:1;justify-content:space-evenly}
#ccPrint .fleg{display:grid;grid-template-columns:24mm 40mm 1fr;align-items:center;gap:2.5mm;padding:.5mm 1mm;border-bottom:1px solid var(--line)}
#ccPrint .fold-p .fleg{grid-template-columns:30mm 1fr;gap:2mm;padding:1mm 1mm}
#ccPrint .fleg:last-child{border-bottom:0}
#ccPrint .fleg .fno{font-size:25pt;line-height:1;font-weight:700;color:var(--ink);font-family:var(--f-mono,monospace);white-space:nowrap}
#ccPrint .fold-p .fleg .fno{font-size:32pt}
#ccPrint .flegs.n5 .fno{font-size:21pt}#ccPrint .flegs.n6 .fno{font-size:18pt}#ccPrint .fold-p .flegs.n5 .fno{font-size:26pt}#ccPrint .fold-p .flegs.n6 .fno{font-size:22pt}
#ccPrint .fleg .fno small{font-size:9pt;color:var(--muted);font-weight:600;margin-right:.5mm;vertical-align:11pt}
#ccPrint .fleg .frt{font-size:13pt;font-weight:700;letter-spacing:.02em;font-family:var(--f-mono,monospace);white-space:nowrap}
#ccPrint .fleg .frt i{font-style:normal;color:var(--muted);padding:0 .8mm;font-weight:500}
#ccPrint .fleg .frt small{font-size:7.6pt;color:var(--muted);font-weight:500;letter-spacing:0;margin-left:1.2mm}
#ccPrint .fleg .ftm{font-size:12.5pt;font-weight:700;white-space:nowrap;font-family:var(--f-mono,monospace)}
#ccPrint .fleg .ftm small{font-size:8.6pt;color:var(--muted);font-weight:500;margin-left:1.6mm}
#ccPrint .fleg .fta{font-size:7pt;color:var(--muted);grid-column:2/4;margin-top:-1.4mm;line-height:1.2}
#ccPrint .fold-p .fleg .fr{display:flex;flex-direction:column;gap:.4mm}
#ccPrint .fold-p .fleg .fta{grid-column:auto;margin-top:0}
#ccPrint .fleg .fta b{color:var(--red)}
#ccPrint .fcf{display:flex;justify-content:space-between;gap:2mm;font-size:7pt;color:var(--muted);padding-top:1.2mm;border-top:1.4px solid var(--ink);margin-top:auto}
#ccPrint .pn h3{margin:0 0 1mm;font-size:10pt}
#ccPrint .ftiles{display:grid;grid-template-columns:repeat(6,1fr);gap:1.2mm}
#ccPrint .fold-p .ftiles{grid-template-columns:repeat(3,1fr);gap:1.6mm}
#ccPrint .ftiles .tile{padding:1mm 1.6mm;min-width:0}
#ccPrint .ftiles .tile b{font-size:12.5pt;display:block;font-family:var(--f-mono,monospace)}#ccPrint .fold-p .ftiles .tile b{font-size:14pt}
#ccPrint .ftiles .tile em{display:block;margin:-.4mm 0 0;font-size:6.6pt}
#ccPrint .ffdp{border:1px solid var(--line);border-radius:2mm;padding:1.2mm 2.4mm;font-size:8.4pt}
#ccPrint .ffdp .bar{height:4px;margin-top:1mm}
#ccPrint .fbox{border:1px solid var(--line);border-radius:2.4mm;padding:1.8mm 2.6mm;min-height:0}
#ccPrint .ftwo{display:grid;grid-template-columns:1.25fr 1fr;grid-template-rows:minmax(0,1fr);gap:2mm;flex:1;min-height:0}
#ccPrint .ftwo>.fbox{min-height:0;overflow:hidden}
#ccPrint .fold-p .ftwo{grid-template-columns:1fr;flex:0 0 auto}
#ccPrint .pn .thl li{font-size:8pt}#ccPrint .fold-l .thl li{font-size:7.5pt;line-height:1.25}
#ccPrint .chk{display:grid;gap:1mm;font-size:8pt}
#ccPrint .chk div::before{content:"☐";margin-right:1.6mm;color:var(--muted)}
#ccPrint .fwx{display:grid;grid-template-columns:1fr 1fr;gap:1mm 4mm}
#ccPrint .fold-p .fwx{grid-template-columns:1fr}
#ccPrint .fwx .w{display:grid;grid-template-columns:22mm 1fr;gap:1.2mm;font-size:7.6pt;border-bottom:1px solid var(--line);padding-bottom:.8mm}
#ccPrint .fwx .lbl b{display:block;font-size:8.4pt}#ccPrint .fwx .lbl small{color:var(--muted);font-family:var(--f-mono,monospace)}
#ccPrint .fwx .g{font-family:var(--f-mono,monospace);font-size:7pt;display:block}
#ccPrint .fwx .g.hot{color:var(--red)}#ccPrint .fwx .g.warm{color:var(--amber)}
#ccPrint .pn .pill{font-size:6.6pt;white-space:normal}
#ccPrint .pn .mel{font-size:8pt}
#ccPrint .fnt{display:grid;grid-template-columns:1fr 1fr;gap:.6mm 4mm;font-size:7.3pt;line-height:1.25;align-content:start}
#ccPrint .fold-p .fnt{grid-template-columns:1fr}
#ccPrint .fnt .col{display:grid;gap:.6mm;align-content:start;min-width:0}
#ccPrint .fnt .ad{background:var(--soft);font-weight:700;padding:.7mm 2mm;border-radius:1.5mm;margin-top:.4mm}
#ccPrint .fnt .ad span{font-weight:500;color:var(--muted)}
#ccPrint .fnt .it{display:grid;grid-template-columns:16mm 1fr;gap:1.2mm;padding:0 1mm}
#ccPrint .fnt .it .id{font-family:var(--f-mono,monospace);font-size:7.2pt}
#ccPrint .fnt .it .x{color:var(--blue);font-size:7pt}
#ccPrint .fftr{font-size:6.8pt;color:var(--muted);border-top:1px solid var(--line);padding-top:1mm;margin-top:auto;display:flex;justify-content:space-between;gap:2mm}
#ccPrint .fblank{flex:1;border:1px dashed var(--line);border-radius:2.4mm;display:flex;align-items:center;justify-content:center;color:#9AA6B2;font-size:8.5pt;text-align:center}
`;
  const MM = 96 / 25.4;   // CSS px per mm
  // measure the NOTAM rows at the real column width (offscreen, synchronously) and pack them into columns
  // measure the NOTAM rows at the real column width and the free height of each panel (offscreen, synchronously), then pack
  function packNotams(groups, mode, perPanel, skel) {
    const meas = document.createElement("div");
    meas.id = "ccPrint";
    meas.style.cssText = "position:fixed;left:-9999px;top:0;display:block;visibility:hidden;pointer-events:none";
    meas.innerHTML = `<style>${CSS}${FOLD_CSS}</style><div class="${mode}"><div class="sheet">${skel.p4}${skel.pH}${skel.pP}${skel.pL}</div></div>`;
    document.body.appendChild(meas);
    const free = [...meas.querySelectorAll(".sheet > .pn")].map((pn) => {
      const box = pn.querySelector(".fbox"), f = pn.querySelector(".fnt"), cs = getComputedStyle(box);
      return Math.max(0, box.getBoundingClientRect().bottom - parseFloat(cs.paddingBottom) - f.getBoundingClientRect().top);
    });   // [panel 4, page-2 header panel, plain panel, last panel with footer]
    const col = meas.querySelector(".fnt .col");
    const items = [];
    for (const g of groups) {
      items.push({ html: g.head, h: 0, group: g, isHead: true });
      g.rows.forEach((row) => items.push({ html: row, h: 0, group: g }));
    }
    col.innerHTML = items.map((it) => it.html).join("");
    [...col.children].forEach((el, i) => { items[i].h = el.getBoundingClientRect().height + 0.6 * MM; });
    meas.remove();
    // column k capacity: panel 4 columns first, then page-2 panels (header panel, plain, plain, last-with-footer; repeating per page)
    const cap = (k) => {
      if (k < perPanel) return free[0];
      const pk = Math.floor((k - perPanel) / perPanel) % 4;
      return pk === 0 && k < perPanel * 5 ? free[1] : pk === 3 ? free[3] : free[2];
    };
    const cols = [];
    let k = 0, used = 0, lastGroup = null;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.isHead) lastGroup = it.group;
      const need = it.isHead ? it.h + (items[i + 1] && !items[i + 1].isHead ? items[i + 1].h : 0) : it.h;   // keep a header with its first row
      if (used + need > cap(k) && used > 0) {
        k++; used = 0;
        if (!it.isHead && lastGroup) { cols[k] = (cols[k] || "") + lastGroup.head.replace("</div>", " <span>ต่อ</span></div>"); used += lastGroup.headH || 0; }
      }
      cols[k] = (cols[k] || "") + it.html; used += it.h;
      if (it.isHead) it.group.headH = it.h;
    }
    return cols;
  }
  function foldPage(mode, d) {
    const { o, b, r, legs, base, from, reg, f0, melHtml, ibHtml, melCount, merged, nItems, winByLabel, th, fdp, left, lc, last, lastOn, who, Y, Mo, D, dw, gen, opOf, alt, iataOf } = d;
    const P = mode === "fold-p";
    const zr = (ms) => (ms == null ? "—" : zt(ms).replace("Z", "")), lt = (ms, st) => (ms == null ? "—" : hm(ms, st));
    const icaoOf = (st) => (typeof icao === "function" ? icao(st) : "") || st;
    // --- panel 1: the card ---
    const nLegs = legs.length;
    const legRows = legs.map((l, k) => {
      const nx = legs[k + 1]; let turn = null; if (nx && !l.nt && !nx.nt) turn = Math.round((nx.dep - l.arr) / 6e4);
      const f = opOf(l.i), gate = f?.gate || (k === 0 ? r.gate : "") || "";
      const ta = [l.nt ? "" : `block ${fmtDur((l.arr - l.dep) / 6e4)}`, gate ? `gate ${H(gate)}` : "", turn != null ? `turnaround <b>${turn} นาที</b> ที่ ${H(icaoOf(l.s.arr))}` : (k === nLegs - 1 && b.relAbs ? `release ${zr(b.relAbs)}Z (${lt(b.relAbs, o.to || l.s.arr)} L)` : "")].filter(Boolean).join(" · ");
      const times = l.nt ? `<div class="ftm">—<small>ยังไม่มีเวลา STD/STA</small></div>` : `<div class="ftm">${zr(l.dep)}–${zr(l.arr)}Z<small>${lt(l.dep, l.s.dep)} – ${lt(l.arr, l.s.arr)} L</small></div>`;
      const route = `<div class="frt">${H(icaoOf(l.s.dep))}<i>→</i>${H(icaoOf(l.s.arr))}<small>${H(l.s.dep)}–${H(l.s.arr)}</small></div>`;
      return P ? `<div class="fleg"><div class="fno"><small>VZ</small>${H(l.s.flt)}</div><div class="fr">${route}${times}<div class="fta">${ta}</div></div></div>`
               : `<div class="fleg"><div class="fno"><small>VZ</small>${H(l.s.flt)}</div>${route}${times}<div class="fta">${ta}</div></div>`;
    }).join("");
    const altList = legs.map((l) => { const a = alt[l.i] ?? ALTDEF[l.s.arr]; return a ? `ขา ${l.i + 1}: ${H(icaoOf(a))}` : ""; }).filter(Boolean).join(" · ");
    const dateL = `${DOW[dw]} ${String(D).padStart(2, "0")} ${MON[Mo - 1]} ${Y}`;
    const panel1 = `<section class="pn"><span class="pno">1 · ด้านนอกเมื่อพับ</span><div class="fcard">
<div class="fch"><div><div class="kick">CREW BRIEF · ${H(o.code || "")}</div><div class="reg">${H(reg || "ยังไม่รู้ทะเบียน")}</div><div class="typ">${H(reg ? "A320/A321" : "")}${nLegs ? ` · ${nLegs} ขา` : ""}${who ? ` · ${H(who.split(" · ")[0])}` : ""}</div></div><div class="gate"><small>GATE ขาแรก</small><b>${H(f0?.gate || r.gate || "—")}</b></div></div>
<div class="fdl"><b>${dateL}</b><span>Report <span class="rp">${zr(b.repAbs)}Z</span> · ${lt(b.repAbs, from)} L${b.relAbs ? ` · release ${zr(b.relAbs)}Z` : ""}</span></div>
<div class="flegs n${nLegs}">${legRows}</div>
<div class="fcf"><span>${altList ? "ALT " + altList : "ยังไม่ได้ใส่ ALT"}</span><span>${fdp != null && b.fdpMax ? `FDP ${fmtDur(fdp)} / max ${fmtDur(b.fdpMax)} · เหลือ ${fmtDur(left)}` : ""}</span><span>${melCount ? `MEL ${melCount} (ช่อง 3)` : reg ? "ไม่มี MEL ค้าง" : ""}</span></div>
</div></section>`;
    // --- panel 2: times, threats, checklist ---
    const tileZ = (lbl, ms, st, cls = "") => `<div class="tile ${cls}"><span>${lbl}</span><b>${ms == null ? "—" : zr(ms) + "Z"}</b><em>${ms == null ? "" : lt(ms, st) + " L"}</em></div>`;
    const tileL = (lbl, ms, st) => `<div class="tile"><span>${lbl}</span><b>${ms == null ? "—" : lt(ms, st)}</b><em>local</em></div>`;
    const tiles = tileL("ตื่น", b.wakeAbs, base) + tileL("ออกจากบ้าน", b.leaveAbs, base) + tileZ("Report", b.repAbs, from, "key") + tileZ("Off-block แรก", legs[0] && !legs[0].nt ? legs[0].dep : null, legs[0]?.s.dep) + tileZ(last?.nt ? "On-block ≈" : "On-block สุดท้าย", lastOn ?? null, last?.s.arr || base) + tileZ("Release", b.relAbs, o.to || last?.s.arr || base);
    const alco = b.repAbs ? lt(b.repAbs - 8 * HR, from) : "";
    const thHtml = th.length ? `<ul class="thl">${th.slice(0, P ? 6 : 5).map(([c, a, b2]) => `<li class="${c}"><b>${H(a)}</b> <span>— ${H(b2)}</span></li>`).join("")}</ul>` : '<div class="empty">ไม่พบ threat จากข้อมูลที่ใส่ในแอป</div>';
    const panel2 = `<section class="pn"><span class="pno">2</span>
<h3>เวลาวันนี้ <small>UTC ใหญ่ · local เล็ก</small></h3><div class="ftiles">${tiles}</div>
${fdp != null && b.fdpMax ? `<div class="ffdp"><b>FDP ตามตาราง <span class="m">${fmtDur(fdp)}</span></b> จาก max <span class="m">${fmtDur(b.fdpMax)}</span> · เหลือ <b class="m" style="color:${lc}">${fmtDur(left)}</b> ก่อนต้องใช้ extension<div class="bar"><i style="width:${Math.max(0, Math.min(100, (fdp * 100) / b.fdpMax)).toFixed(1)}%;background:${lc}"></i></div></div>` : ""}
<div class="ftwo"><div class="fbox"><h3>Threats วันนี้</h3>${thHtml}</div><div class="fbox"><h3>เช็คก่อนออกจากบ้าน</h3><div class="chk">${alco ? `<div>ไม่ดื่มแอลกอฮอล์หลัง ${alco} (8 ชม. ก่อน report)</div>` : ""}<div>License · medical · passport (OM-A 5.1.1 B)</div><div>iPad / EFB ชาร์จแล้ว · headset</div><div>เช็คข้อความ OMC ก่อนออกจากบ้าน</div></div></div></div>
<div class="fftr"><span>CoolCrew · Crew Brief</span><span>ช่วยเตรียม brief ไม่ใช่เอกสารทางการ</span></div></section>`;
    // --- panel 3: aircraft / MEL + weather ---
    const allUncovered = merged.size && [...merged.values()].every((w) => !w.lines.length && /ไม่ครอบคลุม|ไม่มี TAF/.test(w.note || ""));
    const wxHtml = !merged.size ? '<div class="empty">ยังไม่มี TAF / METAR</div>' : allUncovered ? `<div class="empty">TAF ที่มีตอนนี้ยังไม่ครอบคลุมช่วงบิน · ${[...merged.values()].map((w) => `${H(w.label)} ${H(w.icao)} ${zt(w.s)}–${zt(w.n)}`).join(" · ")}</div>`
      : `<div class="fwx">${[...merged.values()].map((w) => `<div class="w"><div class="lbl"><b>${H(w.label)} ${H(w.icao)}</b><small>${zt(w.s)}–${zt(w.n)}</small></div><div>${w.lines.map((x) => `<span class="g ${x.cls}">${H(x.raw)}${x.v ? ` <span class="pill ${x.v.c === "app" && /improvement/i.test(x.v.t) ? "ok" : x.v.c === "app" && /wind\/other/i.test(x.v.t) ? "warn" : vCls(x.v.c)}">${H(x.v.lbl)}${x.trans ? " · " + H(x.trans) : ""}</span>` : ""}</span>`).join("")}${w.note ? `<span class="empty">${H(w.note)}</span>` : ""}</div></div>`).join("")}</div>`;
    const panel3 = `<section class="pn"><span class="pno">3</span>
<div class="fbox"><h3>เครื่องและ MEL <small>${H(reg || "—")}</small></h3>${melHtml}${ibHtml}</div>
<div class="fbox" style="flex:1"><h3>Weather ที่ ETA ±1 ชม. <small>UTC</small></h3>${wxHtml}<div class="src" style="margin-top:1.2mm"><b>OM-A 8.1.2.4.6 A (p.8-26)</b> ±1 ชม. รอบ ETA ≥ landing minima · <b>8.1.2.5 Table 1 (p.8-29)</b> · ยังไม่เทียบ minima ราย approach</div></div></section>`;
    // --- panel 4 (+ page 2): NOTAMs that overlap the duty, grouped per aerodrome, packed into columns ---
    const rank = (x) => ({ high: 0, medium: 1 }[x.impact] ?? 2);
    const on = nItems.filter((x) => x.active_in_window !== false), offN = nItems.length - on.length;
    const order = [...new Set([...d.usedIcao, ...on.map((x) => x.icao)])].filter((i) => on.some((x) => x.icao === i));
    const roleOf = (i) => [...merged.values()].filter((w) => w.icao === i).map((w) => w.label.replace(/ขา /g, "")).join(", ");
    const groups = order.map((i) => {
      const rows = on.filter((x) => x.icao === i).sort((p2, q) => rank(p2) - rank(q));
      return { head: `<div class="ad">${H(i)} <span>${iataOf[i] ? H(iataOf[i]) + " · " : ""}${H(roleOf(i))} · ${rows.length} รายการ</span></div>`,
        rows: rows.map((x) => { const legsX = Array.isArray(x.legs) ? x.legs.map((l) => { const m = /^(DEP|ARR|ALT)\s*(\d+)/i.exec(String(l)); if (!m) return ""; const lbl = `${m[1].toUpperCase()} ขา ${m[2]}`; const w = winByLabel[lbl]; return w ? `${lbl} ${zt(w.s)}–${zt(w.n)}` : lbl; }).filter(Boolean) : [];
          const x2 = x.impact === "low" ? "" : [legsX.join(" · "), x.when ? "NOTAM " + x.when : ""].filter(Boolean).join(" · ");
          return `<div class="it"><span class="id">${H(x.id || "")}</span><div>${H(x.summary || "")} <span class="pill ${x.impact === "high" ? "bad" : x.impact === "medium" ? "warn" : ""}">${H(x.impact || "low")}</span>${x2 ? `<div class="x">${H(x2)}</div>` : ""}</div></div>`; }) };
    });
    const perPanel = P ? 1 : 2;
    const colsHtml = (cs) => `<div class="fnt">${Array.from({ length: perPanel }, (_, i) => `<div class="col">${(cs && cs[i]) || ""}</div>`).join("")}</div>`;
    const printed = `พิมพ์ ${gen.date.split("-").reverse().join("/")} ${gen.hm} ${H(base)}`;
    const offTxt = offN ? `ไม่ทับช่วงบินอีก ${offN} รายการ ไม่พิมพ์` : "";
    const panel4 = (cs, more, pages) => `<section class="pn"><span class="pno">4</span>
<div class="fbox" style="flex:1"><h3>NOTAM ที่ทับช่วงบิน <small>${on.length} จาก ${nItems.length}${pages > 1 ? ` · หน้า 1/${pages}` : ""} · ตรวจกับต้นฉบับ</small></h3>${on.length ? colsHtml(cs) : '<div class="empty">ยังไม่ได้สรุป NOTAM</div>'}</div>
<div class="fftr"><span>${printed}</span><span>${more ? `<b>ต่อหน้า 2 อีก ${more} รายการ</b> · ` : ""}${offTxt}</span></div></section>`;
    const panelHead = (n, pi, cs, more) => `<section class="pn"><span class="pno">${n} · หน้า ${pi + 2}</span><div class="fch" style="margin-bottom:1.5mm"><div><div class="kick">CREW BRIEF · ${H(o.code || "")} · หน้า ${pi + 2}</div><div class="reg" style="font-size:14pt">NOTAM ต่อ</div><div class="typ">${dateL} · ${H(reg || "")}</div></div><div class="gate"><small>ต่อจากหน้า 1</small><b style="font-size:12pt">${more} รายการ</b></div></div><div class="fbox" style="flex:1">${colsHtml(cs)}</div></section>`;
    const panelPlain = (n, cs) => `<section class="pn"><span class="pno">${n}</span><div class="fbox" style="flex:1">${colsHtml(cs)}</div></section>`;
    const panelLast = (n, pi, cs) => `<section class="pn"><span class="pno">${n}</span><div class="fbox" style="flex:1">${colsHtml(cs)}</div><div class="fftr"><span>หน้า ${pi + 2}</span><span>${offN ? `ไม่ทับช่วงบินอีก ${offN} รายการ ดูในแอป` : ""}</span></div></section>`;
    let cols = [];
    try { cols = groups.length ? packNotams(groups, mode, perPanel, { p4: panel4(null, 99, 2), pH: panelHead(5, 0, null, 99), pP: panelPlain(6, null), pL: panelLast(8, 0, null) }) : []; }
    catch (e) { console.warn("fold notam pack", e); cols = [groups.map((g) => g.head + g.rows.join("")).join("")]; }
    const p4cols = cols.slice(0, perPanel), rest = cols.slice(perPanel);
    const more = rest.reduce((a, c) => a + (c.match(/class="it"/g) || []).length, 0);
    const pages = []; for (let i = 0; i < rest.length; i += perPanel * 4) pages.push(rest.slice(i, i + perPanel * 4));
    const guides = `<div class="fv"></div><div class="fh"></div><span class="fl" style="left:calc(50% - 6mm);bottom:1mm">พับ ①</span><span class="fl" style="left:1.5mm;top:calc(50% - 2mm)">พับ ②</span>`;
    let html = `<div class="${mode}"><div class="sheet">${guides}${panel1}${panel2}${panel3}${panel4(p4cols, more, pages.length + 1)}</div>`;
    pages.forEach((pg, pi) => {
      const pans = [];
      for (let k = 0; k < 4; k++) {
        const cs = pg.slice(k * perPanel, (k + 1) * perPanel), n = 5 + pi * 4 + k;
        if (k === 0 && pi === 0) pans.push(panelHead(n, pi, cs, more));
        else if (cs.some(Boolean)) pans.push(k === 3 ? panelLast(n, pi, cs) : panelPlain(n, cs));
        else pans.push(`<section class="pn"><span class="pno">${n}</span><div class="fblank">ช่องว่าง — จดเพิ่มระหว่าง brief</div></section>`);
      }
      html += `<div class="sheet">${guides}${pans.join("")}</div>`;
    });
    return html + "</div>";
  }
  const SHADOW_CSS = CSS.replace(/#ccPrint\{/g, ":host{display:block;").replace(/#ccPrint /g, "");
  const SHADOW_FOLD = FOLD_CSS.replace(/#ccPrint /g, "");
  const wrap = (h, mode) => `<style>${SHADOW_CSS}${mode && mode !== "a4" ? SHADOW_FOLD : ""}</style><div id="ccPrintIn">${h}</div>`;
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
    const mode = layoutMode();
    try { html = buildHtml(cachedMel(), mode); } catch (e) { console.error("print brief", e); msg("สร้างรายงานไม่ได้ · ลองใหม่", "var(--red)"); return; }
    if (!html) { msg("ยังไม่มี flight duty ในตาราง", "var(--amber)"); return; }
    if (isIOS() && standalone()) { msg("แอปบนหน้าโฮมของ iPhone สั่งพิมพ์ตรงไม่ได้ · กำลังทำเป็น PDF ให้แทน…"); makePdf(); return; }
    setDocCss(mode);
    printBox().shadowRoot.innerHTML = wrap(html, mode);
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
      const mode = layoutMode(), fold = mode !== "a4", land = mode === "fold-l";
      const html = buildHtml((await melData()) || cachedMel(), mode);
      if (!html) throw new Error("ยังไม่มี flight duty ในตาราง");
      const W = land ? 1123 : 794, Hh = land ? 794 : 1123;   // A4 at 96 dpi
      fr = document.createElement("iframe");
      fr.setAttribute("aria-hidden", "true");
      fr.style.cssText = `position:fixed;left:-10000px;top:0;width:${W}px;height:${Hh}px;border:0;opacity:0;pointer-events:none`;
      // full page: 8 mm side margins as in print · folded: the sheet is the page, no margins
      fr.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS}">
<style>:root{--f-body:"IBM Plex Sans Thai",sans-serif;--f-mono:"IBM Plex Mono",monospace}html,body{margin:0;background:#fff;-webkit-text-size-adjust:100%;text-size-adjust:100%}#ccPrint{width:${W}px;padding:${fold ? "0" : "30px 34px 34px"}}${CSS}${fold ? FOLD_CSS : ""}</style>
${LIBS.map(([u, h]) => `<script src="${u}" integrity="${h}" crossorigin="anonymous" referrerpolicy="no-referrer"><\/script>`).join("")}
</head><body><div id="ccPrint">${html}</div></body></html>`;
      document.body.appendChild(fr);
      await new Promise((res, rej) => { fr.onload = res; setTimeout(() => rej(new Error("โหลดตัวทำ PDF ไม่ทัน (เน็ตช้า?)")), 25000); });
      const w = fr.contentWindow;
      if (!w.html2canvas || !w.jspdf) throw new Error("โหลดตัวทำ PDF ไม่ได้");
      await (w.document.fonts?.ready || Promise.resolve());
      const el = w.document.getElementById("ccPrint");
      // NOTAM block starts on page 2 (same rule as @media print break-before): pad it down to the next page top
      try {
        const p2 = el.querySelector(".p2");
        if (p2) {
          const pageH = el.offsetWidth * 297 / 210, pad0 = 30;
          const top = p2.getBoundingClientRect().top - el.getBoundingClientRect().top;
          const target = Math.ceil((top - pad0 - 1) / pageH) * pageH + pad0;
          if (target - top > 1) p2.style.marginTop = (target - top) + "px";
        }
      } catch {}
      const canvas = await w.html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: W });
      const pdf = new w.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: land ? "landscape" : "portrait", compress: true });
      const pw = land ? 297 : 210, ph = land ? 210 : 297, pxPerPage = Math.floor(canvas.width * ph / pw);
      const total = fold ? el.querySelectorAll(".sheet").length * pxPerPage : canvas.height - 6;   // folded: one page per sheet; full: drop a rounding sliver
      for (let y = 0, n = 0; y < total; y += pxPerPage, n++) {
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

  window.ccFillBriefPrint = async (mode) => { mode = mode || layoutMode(); const h = buildHtml(await melData(), mode); if (!h) return false; setDocCss(mode); printBox().shadowRoot.innerHTML = wrap(h, mode); return true; };   // used by tests
  window.ccBuildBriefPrint = async (mode) => buildHtml(await melData(), mode || layoutMode());   // used by tests
  window.ccSetBriefLayout = (m) => { try { localStorage.setItem("cb_printLayout", m); } catch {} pdfFile = null; paintLayout(); };
  window.ccMakeBriefPdf = async () => { await makePdf(); return pdfFile; };   // used by tests
  window.ccBrief = { build: buildHtml, mel: melData, cached: cachedMel, css: CSS };   // on-screen summary card (brief-summary.js)
  // ---------- layout picker (A4 เต็มหน้า · พับ 4 แนวตั้ง · พับ 4 แนวนอน) ----------
  const PICK_CSS = `#b_layout{display:flex;gap:6px;width:100%;margin:2px 0 6px}#b_layout button{flex:1;appearance:none;border:1px solid var(--line);background:var(--surface);color:var(--muted);font:600 .82rem var(--f-body);padding:7px 4px;border-radius:9px;cursor:pointer;line-height:1.15}
#b_layout button small{display:block;font-weight:500;font-size:.68rem;opacity:.8;margin-top:2px}#b_layout button[aria-pressed=true]{background:var(--green);border-color:var(--green);color:#fff}#b_layout button[aria-pressed=true] small{opacity:.85}
#b_layout button svg{display:block;margin:0 auto 3px;width:22px;height:18px}`;
  function paintLayout() {
    const m = layoutMode();
    document.querySelectorAll("#b_layout button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
    const pb = document.getElementById("b_pdf"); if (pb) { pb.textContent = "📄 PDF"; pb.classList.remove("primary"); }
    const pr = document.getElementById("b_print"); if (pr) pr.title = m === "a4" ? "พิมพ์ A4 เต็มหน้า (NOTAM หน้า 2)" : m === "fold-p" ? "พิมพ์ A4 แนวตั้ง แล้วพับ 2 ทบ" : "พิมพ์ A4 แนวนอน แล้วพับ 2 ทบ";
  }
  const ICON = { a4: '<svg viewBox="0 0 22 18" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="6" y="1" width="10" height="16" rx="1"/><path d="M8.5 5h5M8.5 8h5M8.5 11h3"/></svg>',
    "fold-p": '<svg viewBox="0 0 22 18" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="1" width="12" height="16" rx="1"/><path d="M11 1v16M5 9h12" stroke-dasharray="1.6 1.6"/></svg>',
    "fold-l": '<svg viewBox="0 0 22 18" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1" y="3" width="20" height="12" rx="1"/><path d="M11 3v12M1 9h20" stroke-dasharray="1.6 1.6"/></svg>' };
  function mountLayoutPicker(row) {
    if (!row || document.getElementById("b_layout")) return;
    if (!document.getElementById("ccPickCss")) { const st = document.createElement("style"); st.id = "ccPickCss"; st.textContent = PICK_CSS; document.head.appendChild(st); }
    const d = document.createElement("div"); d.id = "b_layout"; d.setAttribute("role", "group"); d.setAttribute("aria-label", "รูปแบบกระดาษ");
    d.innerHTML = LAYOUTS.map(([m, t, sub]) => `<button type="button" data-mode="${m}" aria-pressed="false">${ICON[m]}${t}<small>${sub}</small></button>`).join("");
    d.addEventListener("click", (e) => { const b = e.target.closest("button[data-mode]"); if (b) window.ccSetBriefLayout(b.dataset.mode); });
    row.parentElement.insertBefore(d, row);
    paintLayout();
  }
  function init() {
    if (!document.getElementById("ccPrintCss")) {
      const st = document.createElement("style"); st.id = "ccPrintCss"; st.textContent = DOC_CSS; document.head.appendChild(st);
    }
    const btn = document.getElementById("b_print");
    if (btn && !btn.__cc) { btn.__cc = 1; btn.addEventListener("click", doPrint); mountLayoutPicker(btn.parentElement); }
    const pb = document.getElementById("b_pdf");
    if (pb && !pb.__cc) { pb.__cc = 1; pb.addEventListener("click", sharePdf); }
    document.getElementById("b_duty")?.addEventListener("change", () => { pdfFile = null; const b = document.getElementById("b_pdf"); if (b) { b.textContent = "📄 PDF"; b.classList.remove("primary"); } msg(""); });
    melData();   // warm the MEL cache so a tap can print straight away
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
