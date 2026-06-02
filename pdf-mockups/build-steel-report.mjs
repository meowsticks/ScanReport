// Mid-sized coring + scanning job mockup — realistic multi-level scope with
// VARIED, data-driven findings so we can judge how dynamic descriptions read
// across a longer report. Applies the agreed design tweaks:
//   • Caveat two-tone wordmark (Aggarwal Kamikazes = ink, Cutting & Coring
//     Ltd. = STEEL GRAY)      • red left-accent on section headings + cards
//   • gold-tinted shadow under the logo
//   • footer = page number only, bottom-right
//   • subtle No-go row tint in the findings table
// Regenerate:  npm i -D puppeteer  &&  node pdf-mockups/build-steel-report.mjs
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const PROJ = 'AKCC-2026-0431';
const b64 = (p) => fs.readFileSync(p).toString('base64');
const logoData = 'data:image/png;base64,' + b64(path.join(OUT, 'logo.png'));
const FONTS = OUT;
const caveat400 = b64(`${FONTS}/caveat-400.woff2`);
const caveat700 = b64(`${FONTS}/caveat-700.woff2`);

// ---------------- data: the mid-sized job ----------------
const cores = [
  { id:'A', size:'4″', level:'P1', verdict:'safe',
    rec:'<span class="num">65&nbsp;mm</span> clear of all targets. Cleared to drill as marked.' },
  { id:'B', size:'6″', level:'P1', verdict:'caution',
    rec:'PT tendon crosses within <span class="num">30&nbsp;mm</span> — relocate <span class="num">80&nbsp;mm&nbsp;S</span> and re-scan before drilling.' },
  { id:'C', size:'4″', level:'P1', verdict:'nogo',
    rec:'Directly over an <b>energised conduit</b> run. <b>Do not drill;</b> EOR redesign required.' },
  { id:'D', size:'8″', level:'P1', verdict:'safe',
    rec:'Large-diameter core clear at top mat; bottom mat at ~150&nbsp;mm noted — drill depth limited to <span class="num">130&nbsp;mm</span>.' },
  { id:'E', size:'4″', level:'L2', verdict:'caution',
    rec:'Two-way mat congestion — best gap is <span class="num">18&nbsp;mm</span>. Tight but workable; centre precisely on the mark.' },
  { id:'F', size:'5″', level:'L2', verdict:'safe',
    rec:'Hydronic radiant tubing mapped and avoided; <span class="num">55&nbsp;mm</span> clear. Cleared as marked.' },
  { id:'G', size:'4″', level:'L2', verdict:'nogo',
    rec:'Unidentified metallic object at ~90&nbsp;mm directly below. <b>No-go</b> pending intrusive verification.' },
  { id:'H', size:'6″', level:'L2', verdict:'caution',
    rec:'Within <span class="num">300&nbsp;mm</span> of slab edge; possible void beneath. Reduced confidence — proceed slowly, verify on site.' },
  { id:'J', size:'4″', level:'L3', verdict:'safe',
    rec:'Single top mat, generous spacing. <span class="num">70&nbsp;mm</span> clear in all directions. Cleared as marked.' },
];

const VERDICT = { safe:'Safe', caution:'Caution', nogo:'No-go' };
const tally = cores.reduce((a,c)=>(a[c.verdict]++,a),{safe:0,caution:0,nogo:0});

// scan-location cards — each carries a distinct target picture + observation,
// so the "dynamic descriptions" vary card to card.
const locations = [
  { core:'A', title:'Grid A · P1 Bay 1 mid-span', verdict:'safe',
    targets:['reb','reb','reb','reb'],
    legend:[['#111','Rebar — top mat, ~45 mm']],
    obs:'Clear cone at the proposed centre — no targets within 65&nbsp;mm in any direction. Uniform top mat at ~45&nbsp;mm cover. Safe to drill as marked.' },
  { core:'B', title:'Grid B · P1 Bay 2 column line', verdict:'caution',
    targets:['reb','reb','reb','reb','pt'],
    legend:[['#111','Rebar — top mat'],['#2b6cff','Post-tension tendon']],
    obs:'A post-tension tendon crosses on a diagonal within 30&nbsp;mm of the proposed centre. Relocate the core 80&nbsp;mm south, clear of the tendon envelope, and re-scan before drilling.' },
  { core:'C', title:'Grid C · P1 Bay 2 wall line', verdict:'nogo',
    targets:['reb','reb','conduit'],
    legend:[['#111','Rebar — top mat'],['#c0282d','Energised conduit / no-scan zone']],
    obs:'Energised electrical conduit detected directly beneath the proposed centre at ~110&nbsp;mm. No-go — do not drill; refer to the EOR for a redesigned core position.' },
  { core:'E', title:'Grid E · L2 Bay 4 mid-span', verdict:'caution',
    targets:['reb','reb','reb','reb','reb2','reb2','reb2','reb2'],
    legend:[['#111','Rebar — top mat, ~40 mm'],['#7a4', 'Rebar — second mat, ~95 mm']],
    obs:'Heavy two-way reinforcement — top and second mats both present. The best clear gap at the mark is 18&nbsp;mm. Workable for a 4″ core if centred precisely; flag the tight tolerance to the operator.' },
  { core:'F', title:'Grid F · L2 mechanical room', verdict:'safe',
    targets:['reb','reb','tube'],
    legend:[['#111','Rebar — top mat'],['#e08a00','Hydronic radiant tubing']],
    obs:'Radiant floor-heating tubing mapped along the south of the grid and avoided. Proposed centre is 55&nbsp;mm clear of both rebar and tubing. Cleared to drill as marked.' },
  { core:'G', title:'Grid G · L2 Bay 5 wall line', verdict:'nogo',
    targets:['reb','reb','obj'],
    legend:[['#111','Rebar — top mat'],['#c0282d','Unidentified metallic object']],
    obs:'A strong, isolated metallic reflection sits at ~90&nbsp;mm directly below the proposed centre — not consistent with rebar spacing. No-go until its nature is confirmed by intrusive verification (e.g. small inspection hole).' },
  { core:'H', title:'Grid H · L2 slab edge', verdict:'caution',
    targets:['reb','reb','void'],
    legend:[['#111','Rebar — top mat'],['#9a6cff','Suspected void / delamination']],
    obs:'Core sits ~300&nbsp;mm from a slab edge with a low-amplitude zone suggesting a void or delamination beneath. Confidence reduced. Proceed slowly with a pilot; stop and reassess if the bit breaks through.' },
];

// ---------------- styles ----------------
const CSS = `
  @font-face{font-family:'Caveat';src:url(data:font/woff2;base64,${caveat400}) format('woff2');font-weight:400;font-display:block}
  @font-face{font-family:'Caveat';src:url(data:font/woff2;base64,${caveat700}) format('woff2');font-weight:700;font-display:block}
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--ink:#141414;--mut:#555;--faint:#777;--line:#cfcfcf;--red:#c0282d;
    --steel:#6b7682;--gold:#c9a227;
    --safe:#1d7a3a;--caution:#b8770a;--nogo:#c0282d;--nogo-tint:#fbecec;}
  html,body{background:#fff}
  body{font-family:'Inter','Segoe UI',-apple-system,system-ui,sans-serif;color:var(--ink);
    -webkit-font-smoothing:antialiased;font-feature-settings:"kern" 1,"liga" 1,"tnum" 1;
    font-variant-numeric:tabular-nums;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:letter;margin:0}
  .sheet{width:8.5in;height:11in;position:relative;overflow:hidden;padding:0.55in 0.6in 0.5in;background:#fff}
  .sheet + .sheet{page-break-before:always}
  .content{position:absolute;left:0.6in;right:0.6in;top:1.95in;bottom:0.5in}
  .content.tall{top:0.6in}

  /* letterhead — Caveat two-tone wordmark */
  .lh{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;
    border-bottom:3px solid var(--ink);padding-bottom:11px}
  .lh img{height:78px;width:auto;filter:drop-shadow(0 2px 3px rgba(176,138,30,.45))}
  .lh .nm1{font-family:'Caveat',cursive;font-weight:700;font-size:34pt;line-height:.82;color:var(--ink)}
  .lh .nm2{font-family:'Caveat',cursive;font-weight:700;font-size:22pt;line-height:.9;color:var(--steel)}
  .lh .sub{font-size:8pt;color:var(--mut);letter-spacing:.16em;text-transform:uppercase;margin-top:6px;font-weight:600}
  .lh .addr{font-size:7.5pt;color:var(--faint);margin-top:4px;line-height:1.45}
  .lh .box{font-size:8pt;text-align:right;line-height:1.5;border-left:1px solid var(--line);padding-left:13px}
  .lh .box b{display:block;color:var(--mut);font-size:6.8pt;letter-spacing:.09em;text-transform:uppercase;font-weight:700}
  .lh .box .v{font-size:10pt;font-weight:700;margin-bottom:5px}

  /* footer — page number only, bottom-right */
  .pageno{position:absolute;right:0.6in;bottom:0.32in;font-size:8pt;color:var(--faint);letter-spacing:.04em}

  h2.sec{font-size:10.5pt;letter-spacing:.13em;text-transform:uppercase;color:var(--ink);font-weight:700;
    border-bottom:1px solid var(--line);border-left:3px solid var(--red);padding-bottom:4px;padding-left:8px;margin:0 0 10px}
  .block{margin-bottom:15px}
  .faint{color:var(--faint)}

  .pgrid{display:grid;grid-template-columns:1fr 1fr;gap:5px 30px;font-size:9.5pt}
  .pgrid .r{display:flex;justify-content:space-between;border-bottom:1px dotted #e4e4e4;padding:3px 0}
  .pgrid .r b{color:var(--mut);font-weight:600}
  .pgrid .r span{font-weight:500;text-align:right}
  .summary{font-size:9.5pt;line-height:1.55;color:#222}
  .summary strong{font-weight:700;color:var(--ink)}

  table.find{width:100%;border-collapse:collapse;font-size:9pt}
  table.find th{background:#f0f0f0;text-transform:uppercase;font-size:7.3pt;letter-spacing:.08em;
    text-align:left;padding:6px 9px;border:1px solid #ccc;color:#333;font-weight:700}
  table.find td{padding:6px 9px;border:1px solid #d8d8d8;vertical-align:top}
  table.find td.core{font-weight:700;font-size:10pt;text-align:center}
  table.find td.ctr{text-align:center}
  table.find .num{font-weight:700}
  table.find tr.nogo-row td{background:var(--nogo-tint)}
  .pill{display:inline-block;font-size:7.3pt;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
    padding:2px 9px;border-radius:10px;color:#fff;white-space:nowrap}
  .pill.safe{background:var(--safe)} .pill.caution{background:var(--caution)} .pill.nogo{background:var(--nogo)}
  .talbox{display:flex;gap:14px;margin:9px 0 2px;font-size:8.5pt}
  .tal{display:flex;align-items:center;gap:6px;font-weight:600;color:var(--mut)}
  .tal .dot{width:10px;height:10px;border-radius:50%}

  .scard{border:1px solid #cfcfcf;border-left:3px solid var(--red);border-radius:4px;overflow:hidden;page-break-inside:avoid;margin-bottom:6px;box-shadow:0 1px 5px rgba(201,162,39,.30)}
  .scard .hd{display:flex;justify-content:space-between;align-items:center;background:#fafafa;
    border-bottom:1px solid #e3e3e3;padding:7px 10px}
  .scard .hd .t{font-weight:700;font-size:10pt}
  .scard .hd .m{font-size:8pt;color:var(--faint)}
  .scard .bd{display:grid;grid-template-columns:1.45fr 1fr;gap:10px;padding:10px}
  .radar{height:140px;border:1px solid #888;border-radius:2px;position:relative;overflow:hidden;
    background:repeating-linear-gradient(0deg,#0b0b0b 0 2px,#1b1b1b 2px 5px,#0f0f0f 5px 9px),
      linear-gradient(180deg,#222,#000)}
  .radar .scale{position:absolute;left:0;top:0;bottom:0;width:26px;background:#111;color:#bbb;font-size:6.5pt;
    border-right:1px solid #444;display:flex;flex-direction:column;justify-content:space-between;padding:3px 2px;text-align:center}
  .radar .reb{position:absolute;width:9px;height:9px;border-radius:50%;
    background:radial-gradient(circle,#fff 0 30%,#ffd23f 45%,transparent 70%)}
  .radar .reb2{position:absolute;width:8px;height:8px;border-radius:50%;
    background:radial-gradient(circle,#fff 0 30%,#88dd66 50%,transparent 75%)}
  .radar .hyp{position:absolute;border:2px solid transparent;border-radius:50%}
  .radar .bar{position:absolute;height:6px;border-radius:3px}
  .radar .blob{position:absolute;border-radius:50%}
  .radar .cap{position:absolute;bottom:3px;right:5px;color:#9aa;font-size:6.5pt}
  .radar .xmark{position:absolute;left:118px;top:60px;width:14px;height:14px;color:#fff;font-weight:700;font-size:13px}
  .legend{font-size:8.5pt;line-height:1.7}
  .legend .k{display:inline-block;width:11px;height:11px;border:1px solid #333;vertical-align:-1px;margin-right:6px;border-radius:2px}
  .legend .verdict{margin-top:7px;font-weight:700}
  .cobs{padding:7px 10px;border-top:1px solid #eee;font-size:8.5pt;color:#333;line-height:1.45}
  .cobs b{color:#000}

  .notes{font-size:8.5pt;line-height:1.55;color:#2a2a2a}
  .notes li{margin:0 0 4px 16px}
  .disc{border-top:1px solid #bbb;padding-top:8px;font-size:8pt;line-height:1.55;color:#444}
  .disc b{color:#222}
  .sig{display:grid;grid-template-columns:1fr 1fr;gap:14px 30px;font-size:9pt;margin-top:14px}
  .sig .slot{border-top:1px solid #999;padding-top:5px}
  .sig .slot b{display:block;font-size:7.3pt;color:var(--mut);text-transform:uppercase;letter-spacing:.07em}
`;

// ---------------- fragments ----------------
const lh = `
  <div class="lh">
    <img src="${logoData}" alt="">
    <div>
      <div class="nm1">Aggarwal Kamikazes</div>
      <div class="nm2">Cutting &amp; Coring Ltd.</div>
      <div class="sub">GPR Concrete Scanning · Core Clearance Report</div>
      <div class="addr">123 Industrial Way, Burnaby BC V5A 1A1 · (604) 555-0199 · scans@aggarwalkamikazes.ca</div>
    </div>
    <div class="box">
      <b>Project</b><div class="v">${PROJ}</div>
      <b>Operator</b><div class="v">D. Cunningham</div>
      <b>Date</b><div class="v">2026-05-29</div>
    </div>
  </div>`;

const pageno = (n,total)=>`<div class="pageno">Page ${n} of ${total} · ${PROJ}</div>`;

// radar with a variable set of targets
const baseReb = [[70,40],[120,38],[170,41],[220,39]];
const baseReb2 = [[95,86],[150,88],[205,85],[250,87]];
function radar(targets){
  let dots='';
  let ri=0, r2i=0;
  for(const t of targets){
    if(t==='reb'){ const [l,top]=baseReb[ri++%baseReb.length]; dots+=`<div class="reb" style="left:${l}px;top:${top}px"></div>`; }
    else if(t==='reb2'){ const [l,top]=baseReb2[r2i++%baseReb2.length]; dots+=`<div class="reb2" style="left:${l}px;top:${top}px"></div>`; }
    else if(t==='pt'){ dots+=`<div class="hyp" style="left:150px;top:58px;width:96px;height:46px;border-top-color:#5aa0ff"></div>`; }
    else if(t==='conduit'){ dots+=`<div class="hyp" style="left:120px;top:62px;width:130px;height:30px;border-top-color:#ff5a5a"></div>`; }
    else if(t==='tube'){ dots+=`<div class="bar" style="left:60px;top:104px;width:170px;background:linear-gradient(90deg,#e08a00,#ffb84d)"></div>`; }
    else if(t==='obj'){ dots+=`<div class="blob" style="left:120px;top:70px;width:18px;height:18px;background:radial-gradient(circle,#fff,#ff7a7a 60%,transparent)"></div>`; }
    else if(t==='void'){ dots+=`<div class="blob" style="left:150px;top:80px;width:60px;height:26px;background:radial-gradient(ellipse,rgba(154,108,255,.7),transparent 70%);border:1px dashed #9a6cff"></div>`; }
  }
  return `<div class="radar"><div class="scale"><span>0</span><span>100</span><span>200</span></div>
    ${dots}<div class="cap">GPR B-scan · 1.6 GHz</div></div>`;
}
function scard(loc){
  const leg = loc.legend.map(([c,t])=>`<div><span class="k" style="background:${c}"></span>${t}</div>`).join('');
  return `<div class="scard">
    <div class="hd"><span class="t">${loc.title}</span><span class="m">0.9 m × 0.9 m · depth 0–200 mm · Core ${loc.core}</span></div>
    <div class="bd">${radar(loc.targets)}
      <div class="legend">${leg}<div class="verdict"><span class="pill ${loc.verdict}">${VERDICT[loc.verdict]}</span></div></div></div>
    <div class="cobs"><b>Observation.</b> ${loc.obs}</div></div>`;
}

// ---------------- pages ----------------
const findingsRows = cores.map(c=>`
  <tr class="${c.verdict==='nogo'?'nogo-row':''}">
    <td class="core">${c.id}</td><td class="ctr">${c.size}</td><td class="ctr">${c.level}</td>
    <td><span class="pill ${c.verdict}">${VERDICT[c.verdict]}</span></td>
    <td>${c.rec}</td></tr>`).join('');

const page1 = `${lh}
  <div class="content">
    <h2 class="sec">Project Information</h2>
    <div class="pgrid">
      <div>
        <div class="r"><b>Site</b><span>Cedar Crossing podium, 8800 Cambie, Vancouver BC</span></div>
        <div class="r"><b>Client</b><span>Northpoint Construction Ltd.</span></div>
        <div class="r"><b>Engineer of record</b><span>Pinnacle Structural Eng.</span></div>
        <div class="r"><b>Scan date</b><span>2026-05-29</span></div>
      </div>
      <div>
        <div class="r"><b>Equipment</b><span>GSSI StructureScan Mini XT (1.6 GHz)</span></div>
        <div class="r"><b>Structure</b><span>P1 / L2 / L3 suspended decks</span></div>
        <div class="r"><b>Coverage</b><span>9 grids · 22.4 m² scanned</span></div>
        <div class="r"><b>Project no.</b><span>${PROJ}</span></div>
      </div>
    </div>

    <h2 class="sec" style="margin-top:16px">Scan Summary</h2>
    <p class="summary">GPR survey across three suspended decks to locate embedded reinforcement,
    post-tension tendons, electrical conduit and other services ahead of <strong>nine proposed cores</strong>
    (4″–8″). Reinforcement runs as a top mat at <strong>~40–45&nbsp;mm cover</strong>; localized second-mat
    congestion was found on L2. Cores were assessed against a <strong>50&nbsp;mm minimum standoff</strong>
    to any marked target. Results: <strong>${tally.safe} cleared</strong>, <strong>${tally.caution} caution</strong>,
    <strong>${tally.nogo} no-go</strong>.</p>

    <h2 class="sec" style="margin-top:16px">Core Clearance Findings</h2>
    <div class="talbox">
      <span class="tal"><span class="dot" style="background:var(--safe)"></span>${tally.safe} Safe</span>
      <span class="tal"><span class="dot" style="background:var(--caution)"></span>${tally.caution} Caution</span>
      <span class="tal"><span class="dot" style="background:var(--nogo)"></span>${tally.nogo} No-go</span>
    </div>
    <table class="find">
      <thead><tr><th style="width:44px">Core</th><th style="width:44px">Size</th><th style="width:44px">Level</th>
        <th style="width:84px">Verdict</th><th>Clearance &amp; recommendation</th></tr></thead>
      <tbody>${findingsRows}</tbody>
    </table>
  </div>`;

const cardPages = [];
for (let i=0;i<locations.length;i+=2){
  const slice = locations.slice(i,i+2);
  cardPages.push(`<div class="content tall">
    <h2 class="sec">Scan Locations${slice.length===2?` — ${slice[0].core} &amp; ${slice[1].core}`:` — ${slice[0].core}`}</h2>
    ${slice.map(scard).join('')}
  </div>`);
}

const lastPage = `<div class="content tall">
    <h2 class="sec">Methodology &amp; Standard Notes</h2>
    <ol class="notes">
      <li>Survey performed with a GSSI StructureScan Mini XT (1.6&nbsp;GHz) on orthogonal 50&nbsp;mm line spacing.</li>
      <li>Depths are estimates based on an assumed dielectric for cured concrete and are <b>±15%</b>.</li>
      <li>Targets marked on the slab in matching colours supersede this report where any discrepancy exists.</li>
      <li>Clearances reference the marked grid origin; verify on site before cutting.</li>
      <li>"No-go" locations require resolution with the engineer of record before any drilling.</li>
    </ol>
    <h2 class="sec" style="margin-top:16px">Limitations</h2>
    <div class="disc"><b>Limitations.</b> GPR results are interpretive and depend on moisture, cover and
    congestion. Non-metallic and deeply embedded targets, and objects shadowed by dense upper steel, may
    not be detected. Aggarwal Kamikazes Cutting &amp; Coring Ltd. accepts no liability for drilling outside
    the cleared zones described above. This report is valid for the slabs, locations and date stated.</div>
    <div class="sig">
      <div class="slot"><b>Scanned by</b>D. Cunningham · GPR Technician</div>
      <div class="slot"><b>Date</b>2026-05-29</div>
      <div class="slot"><b>Reviewed by</b>________________________</div>
      <div class="slot"><b>Project no.</b>${PROJ}</div>
    </div>
  </div>`;

const sheets = [page1, ...cardPages, lastPage];
const total = sheets.length;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
${sheets.map((s,i)=>`<div class="sheet">${s}${pageno(i+1,total)}</div>`).join('\n')}
</body></html>`;

const htmlFile = path.join(OUT, 'ScanReport-midjob.html');
fs.writeFileSync(htmlFile, html);

const browser = await puppeteer.launch({ args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width:816, height:1056, deviceScaleFactor:2 });
await page.goto('file://' + htmlFile);
await page.evaluate(() => document.fonts.ready);
await new Promise(r=>setTimeout(r,400));
await page.pdf({ path: path.join(OUT,'ScanReport-midjob.pdf'),
  width:'8.5in', height:'11in', printBackground:true, margin:{top:0,bottom:0,left:0,right:0} });
// per-page PNGs for quick on-screen review
const sheetEls = await page.$$('.sheet');
for (let i=0;i<sheetEls.length;i++){
  await sheetEls[i].screenshot({ path: path.join(OUT, `ScanReport-midjob-p${i+1}.png`) });
}
await browser.close();
console.log(`wrote ScanReport-midjob.pdf (${total} pages) + ${sheetEls.length} PNGs`);
