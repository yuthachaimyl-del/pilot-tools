// Extra stations for Crew Brief: IATA → [ICAO, lat, lon]. Extends the page's ST table (brief.html) so
// international legs (TAO, FUK, CTS, …) get weather, NOTAM and radar links instead of being silently skipped.
// Coordinates are only used to centre the radar maps.
(function () {
  if (typeof ST !== "object" || !ST) return;
  const X = {
    // Thailand (regional)
    ROI: ["VTUV", 16.117, 103.774], BFV: ["VTUO", 15.229, 103.253], SNO: ["VTUI", 17.195, 104.119], KOP: ["VTUW", 17.384, 104.643],
    LOE: ["VTUL", 17.439, 101.722], NAK: ["VTUQ", 14.950, 102.313], NNT: ["VTCN", 18.808, 100.783], PRH: ["VTCP", 18.132, 100.165],
    LPT: ["VTCL", 18.272, 99.504], HGN: ["VTCH", 19.301, 97.976], MAQ: ["VTPM", 16.700, 98.545], HHQ: ["VTPH", 12.636, 99.951],
    TDX: ["VTBO", 12.275, 102.319], CJM: ["VTSE", 10.711, 99.362], UNN: ["VTSR", 9.778, 98.585], TST: ["VTST", 7.509, 99.617],
    NAW: ["VTSC", 6.520, 101.743], PAN: ["VTSK", 6.785, 101.154], KBV: ["VTSG", 8.099, 98.986],
    // Vietnam · Laos · Cambodia · Myanmar
    CXR: ["VVCR", 11.998, 109.219], PQC: ["VVPQ", 10.172, 103.993], HPH: ["VVCI", 20.819, 106.725], HUI: ["VVPB", 16.402, 107.703],
    VII: ["VVVH", 18.738, 105.671], DLI: ["VVDL", 11.750, 108.367], VCA: ["VVCT", 10.085, 105.712], VDH: ["VVDH", 17.515, 106.591],
    VTE: ["VLVT", 17.988, 102.563], LPQ: ["VLLB", 19.898, 102.161], PKZ: ["VLPS", 15.132, 105.781],
    REP: ["VDSR", 13.411, 103.813], SAI: ["VDSA", 13.365, 104.222], KOS: ["VDSV", 10.580, 103.637], KTI: ["VDTI", 11.260, 104.980],
    MDL: ["VYMD", 21.702, 95.978], NYT: ["VYNT", 19.624, 96.201],
    // Malaysia · Singapore · Indonesia · Brunei · Philippines
    PEN: ["WMKP", 5.297, 100.277], LGK: ["WMKL", 6.330, 99.729], JHB: ["WMKJ", 1.641, 103.670], BKI: ["WBKK", 5.937, 116.051],
    KCH: ["WBGG", 1.485, 110.347], CGK: ["WIII", -6.126, 106.656], SUB: ["WARR", -7.380, 112.787], KNO: ["WIMM", 3.642, 98.885],
    BWN: ["WBSB", 4.944, 114.928], MNL: ["RPLL", 14.509, 121.020], CRK: ["RPLC", 15.186, 120.560], CEB: ["RPVM", 10.308, 123.979],
    // China
    TAO: ["ZSQD", 36.361, 120.088], TFU: ["ZUTF", 30.313, 104.445], CAN: ["ZGGG", 23.392, 113.299], SZX: ["ZGSZ", 22.639, 113.811],
    PVG: ["ZSPD", 31.143, 121.805], SHA: ["ZSSS", 31.198, 121.336], HGH: ["ZSHC", 30.230, 120.434], NKG: ["ZSNJ", 31.742, 118.862],
    XIY: ["ZLXY", 34.447, 108.752], CKG: ["ZUCK", 29.719, 106.642], WUH: ["ZHHH", 30.784, 114.208], CSX: ["ZGHA", 28.189, 113.220],
    NNG: ["ZGNN", 22.608, 108.172], KWL: ["ZGKL", 25.218, 110.039], HAK: ["ZJHK", 19.935, 110.459], SYX: ["ZJSY", 18.303, 109.412],
    FOC: ["ZSFZ", 25.935, 119.663], XMN: ["ZSAM", 24.544, 118.128], TSN: ["ZBTJ", 39.124, 117.346], PEK: ["ZBAA", 40.080, 116.585],
    PKX: ["ZBAD", 39.509, 116.411], HFE: ["ZSOF", 31.989, 116.978], WNZ: ["ZSWZ", 27.912, 120.852], NGB: ["ZSNB", 29.827, 121.462],
    TNA: ["ZSJN", 36.857, 117.216], SJW: ["ZBSJ", 38.281, 114.697], TYN: ["ZBYN", 37.747, 112.628], CGO: ["ZHCC", 34.520, 113.841],
    ZUH: ["ZGSD", 22.006, 113.376], LHW: ["ZLLL", 36.515, 103.620], HRB: ["ZYHB", 45.623, 126.250], SHE: ["ZYTX", 41.640, 123.483],
    DLC: ["ZYTL", 38.966, 121.539], CGQ: ["ZYCC", 43.996, 125.685], SWA: ["ZGOW", 23.552, 116.503], JJN: ["ZSQZ", 24.796, 118.590],
    YNT: ["ZSYT", 37.657, 120.987], WUX: ["ZSWX", 31.494, 120.429], CZX: ["ZSCG", 31.920, 119.779], KHN: ["ZSCN", 28.865, 115.900],
    LJG: ["ZPLJ", 26.680, 100.246], JHG: ["ZPJH", 21.974, 100.760], NNY: ["ZHNY", 32.981, 112.615], BHY: ["ZGBH", 21.539, 109.294],
    // Hong Kong · Macau · Taiwan
    MFM: ["VMMC", 22.150, 113.592], KHH: ["RCKH", 22.577, 120.350], RMQ: ["RCMQ", 24.265, 120.621], TSA: ["RCSS", 25.069, 121.552],
    // Japan
    HND: ["RJTT", 35.553, 139.781], FUK: ["RJFF", 33.586, 130.451], CTS: ["RJCC", 42.775, 141.692], NGO: ["RJGG", 34.858, 136.805],
    OKA: ["ROAH", 26.196, 127.646], KOJ: ["RJFK", 31.803, 130.719], KMJ: ["RJFT", 32.837, 130.855], HIJ: ["RJOA", 34.436, 132.919],
    OKJ: ["RJOB", 34.757, 133.855], SDJ: ["RJSS", 38.140, 140.917], ITM: ["RJOO", 34.785, 135.438], KIJ: ["RJSN", 37.956, 139.121],
    TAK: ["RJOT", 34.214, 134.016], MYJ: ["RJOM", 33.827, 132.700], NGS: ["RJFU", 32.917, 129.914], OIT: ["RJFO", 33.479, 131.737],
    KKJ: ["RJFR", 33.846, 131.035], HKD: ["RJCH", 41.770, 140.822], AOJ: ["RJSA", 40.735, 140.691], KMQ: ["RJNK", 36.394, 136.407],
    // Korea
    GMP: ["RKSS", 37.558, 126.791], PUS: ["RKPK", 35.179, 128.938], CJU: ["RKPC", 33.511, 126.493], TAE: ["RKTN", 35.894, 128.659],
    CJJ: ["RKTU", 36.717, 127.499], MWX: ["RKJB", 34.991, 126.383],
    // India · Nepal · Bangladesh · Sri Lanka · Maldives
    HYD: ["VOHS", 17.231, 78.430], MAA: ["VOMM", 12.990, 80.169], BLR: ["VOBL", 13.199, 77.706], AMD: ["VAAH", 23.077, 72.635],
    JAI: ["VIJP", 26.824, 75.812], LKO: ["VILK", 26.761, 80.889], ATQ: ["VIAR", 31.710, 74.797], BBI: ["VEBS", 20.244, 85.818],
    PAT: ["VEPT", 25.591, 85.088], GAU: ["VEGT", 26.106, 91.586], IXB: ["VEBD", 26.681, 88.329], PNQ: ["VAPO", 18.582, 73.920],
    GOI: ["VOGO", 15.381, 73.831], GOX: ["VOGA", 15.741, 73.864], COK: ["VOCI", 10.152, 76.402], TRV: ["VOTV", 8.482, 76.920],
    CCJ: ["VOCL", 11.137, 75.955], KTM: ["VNKT", 27.697, 85.359], CGP: ["VGEG", 22.249, 91.813], MLE: ["VRMM", 4.192, 73.529],
  };
  for (const k in X) if (!ST[k]) ST[k] = X[k];
  // local-time zones for the same stations (roster times are local at each station; unknown stations were treated as Bangkok)
  if (typeof TZ === "object" && typeof setTz === "function") {
    const add = (list, off, iana) => list.split(" ").forEach((k) => { if (!TZ[k]) TZ[k] = { off, iana }; });
    add("ROI BFV SNO KOP LOE NAK NNT PRH LPT HGN MAQ HHQ TDX CJM UNN TST NAW PAN UTP", 420, "Asia/Bangkok");
    add("HUI DLI VDH", 420, "Asia/Ho_Chi_Minh"); add("PKZ", 420, "Asia/Vientiane"); add("SAI KOS", 420, "Asia/Phnom_Penh"); add("NYT", 390, "Asia/Yangon");
    add("LGK JHB KCH", 480, "Asia/Kuala_Lumpur"); add("KNO", 420, "Asia/Jakarta"); add("BWN", 480, "Asia/Brunei"); add("CRK", 480, "Asia/Manila");
    add("TAO TSN TNA SJW TYN CGO ZUH LHW HRB SHE DLC CGQ SWA JJN YNT WUX CZX KHN LJG NNY BHY FOC XMN HFE WNZ NGB NNG KWL HAK SYX", 480, "Asia/Shanghai");
    add("RMQ TSA", 480, "Asia/Taipei"); add("OKA KOJ KMJ HIJ OKJ SDJ ITM KIJ TAK MYJ NGS OIT KKJ HKD AOJ KMQ", 540, "Asia/Tokyo"); add("TAE CJJ MWX", 540, "Asia/Seoul");
    add("ATQ PAT GAU IXB PNQ GOI GOX", 330, "Asia/Kolkata"); add("MLE", 300, "Indian/Maldives");
  }
  // the page already rendered once with the short tables: render again so foreign-station times use the right zone
  try { if (typeof renderAll === "function") renderAll(); } catch (e) { console.warn("stations rerender", e); }
})();
