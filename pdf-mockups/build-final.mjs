// FINAL deliverable: a polished, client-ready Pure-B scan report PDF.
// Locked decisions: full letterhead on page 1 ONLY (no header on continuation
// pages), normal card size, Bebas company wordmark embedded, US Letter.
// Emphasis pass: important words noticeable but NOT bloated — verdict pills,
// bold clearance numbers, a quiet key-callout, restrained brand red.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { CHROMIUM } from './content.mjs';

const OUT = path.resolve('.');
const PROJ = 'AKCC-2026-0017';
const logoData = 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, 'logo.png')).toString('base64');
const bebas = fs.readFileSync('/tmp/node_modules/@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2').toString('base64');

// ---------- styles ----------
const CSS = `
  @font-face{font-family:'AKBebas';src:url(data:font/woff2;base64,${bebas}) format('woff2');font-weight:400;font-display:block}
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--ink:#141414;--mut:#555;--faint:#777;--line:#cfcfcf;--red:#c0282d;
    --safe:#1d7a3a;--caution:#b8770a;--nogo:#c0282d;--hl:#fff7e6;}
  html,body{background:#fff}
  body{font-family:'Inter','Segoe UI',-apple-system,system-ui,sans-serif;color:var(--ink);
    -webkit-font-smoothing:antialiased;font-feature-settings:"kern" 1,"liga" 1,"tnum" 1;
    font-variant-numeric:tabular-nums;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:letter;margin:0}
  .sheet{width:8.5in;height:11in;position:relative;overflow:hidden;padding:0.55in 0.6in 0.5in;background:#fff}
  .sheet + .sheet{page-break-before:always}
  .content{position:absolute;left:0.6in;right:0.6in;top:2.0in;bottom:0.55in}
  .content.tall{top:0.6in}

  /* letterhead (page 1) */
  .lh{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;
    border-bottom:3px solid var(--ink);padding-bottom:11px}
  .lh img{height:74px;width:auto}
  .lh .nm{font-family:'AKBebas','Arial Narrow',sans-serif;font-size:30pt;letter-spacing:.04em;
    line-height:.9;color:var(--ink)}
  .lh .sub{font-size:8.5pt;color:var(--red);letter-spacing:.18em;text-transform:uppercase;margin-top:4px;font-weight:600}
  .lh .addr{font-size:7.5pt;color:var(--faint);margin-top:5px;line-height:1.45}
  .lh .box{font-size:8pt;text-align:right;line-height:1.5;border-left:1px solid var(--line);padding-left:13px}
  .lh .box b{display:block;color:var(--mut);font-size:6.8pt;letter-spacing:.09em;text-transform:uppercase;font-weight:700}
  .lh .box .v{font-size:10pt;font-weight:700;margin-bottom:5px}

  .foot{position:absolute;left:0.6in;right:0.6in;bottom:0.3in;display:flex;justify-content:space-between;
    align-items:center;border-top:1px solid var(--line);padding-top:5px;font-size:7.5pt;color:var(--faint)}
  .foot .c{letter-spacing:.1em;text-transform:uppercase}

  h2.sec{font-size:10.5pt;letter-spacing:.13em;text-transform:uppercase;color:var(--ink);font-weight:700;
    border-bottom:1px solid var(--line);padding-bottom:4px;margin:0 0 10px}
  .block{margin-bottom:15px}
  .faint{color:var(--faint)}

  /* key callout — quiet, single line, draws the eye without a heavy box */
  .keyline{display:flex;gap:10px;align-items:baseline;font-size:9.5pt;margin:0 0 4px}
  .keyline .k{font-size:7pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);
    border-left:3px solid var(--red);padding-left:7px}
  .keyline .v{color:var(--ink)} .keyline .v b{font-weight:700}

  .pgrid{display:grid;grid-template-columns:1fr 1fr;gap:5px 30px;font-size:9.5pt}
  .pgrid .r{display:flex;justify-content:space-between;border-bottom:1px dotted #e4e4e4;padding:3px 0}
  .pgrid .r b{color:var(--mut);font-weight:600}
  .pgrid .r span{font-weight:500}
  .summary{font-size:9.5pt;line-height:1.55;color:#222}
  .summary strong{font-weight:700;color:var(--ink)}

  table.find{width:100%;border-collapse:collapse;font-size:9pt}
  table.find th{background:#f0f0f0;text-transform:uppercase;font-size:7.3pt;letter-spacing:.08em;
    text-align:left;padding:6px 9px;border:1px solid #ccc;color:#333;font-weight:700}
  table.find td{padding:6px 9px;border:1px solid #d8d8d8;vertical-align:top}
  table.find td.core{font-weight:700;font-size:10pt;text-align:center}
  table.find .num{font-weight:700}
  .pill{display:inline-block;font-size:7.3pt;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
    padding:2px 9px;border-radius:10px;color:#fff;white-space:nowrap}
  .pill.safe{background:var(--safe)} .pill.caution{background:var(--caution)} .pill.nogo{background:var(--nogo)}

  .scard{border:1px solid #cfcfcf;border-radius:4px;overflow:hidden;page-break-inside:avoid}
  .scard .hd{display:flex;justify-content:space-between;align-items:center;background:#fafafa;
    border-bottom:1px solid #e3e3e3;padding:7px 10px}
  .scard .hd .t{font-weight:700;font-size:10pt}
  .scard .hd .m{font-size:8pt;color:var(--faint)}
  .scard .bd{display:grid;grid-template-columns:1.45fr 1fr;gap:10px;padding:10px}
  .radar{height:150px;border:1px solid #888;border-radius:2px;position:relative;overflow:hidden;
    background:repeating-linear-gradient(0deg,#0b0b0b 0 2px,#1b1b1b 2px 5px,#0f0f0f 5px 9px),
      linear-gradient(180deg,#222,#000)}
  .radar .scale{position:absolute;left:0;top:0;bottom:0;width:26px;background:#111;color:#bbb;font-size:6.5pt;
    border-right:1px solid #444;display:flex;flex-direction:column;justify-content:space-between;padding:3px 2px;text-align:center}
  .radar .reb{position:absolute;width:9px;height:9px;border-radius:50%;
    background:radial-gradient(circle,#fff 0 30%,#ffd23f 45%,transparent 70%)}
  .radar .hyp{position:absolute;border:2px solid transparent;border-radius:50%}
  .radar .cap{position:absolute;bottom:3px;right:5px;color:#9aa;font-size:6.5pt}
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

// ---------- fragments ----------
const fullLH = `
  <div class="lh">
    <img src="${logoData}" alt="">
    <div>
      <div class="nm">Aggarwal Kamikazes</div>
      <div class="sub">Cutting &amp; Coring Ltd · GPR Scan Report</div>
      <div class="addr">123 Industrial Way, Burnaby BC V5A 1A1 · (604) 555-0199 · scans@aggarwalkamikazes.ca</div>
    </div>
    <div class="box">
      <b>Project</b><div class="v">${PROJ}</div>
      <b>Operator</b><div class="v">D. Cunningham</div>
      <b>Date</b><div class="v">2026-05-28</div>
    </div>
  </div>`;

const foot = (n, total) => `<div class="foot">
  <span>Aggarwal Kamikazes Cutting &amp; Coring Ltd.</span>
  <span class="c">Confidential — for the named recipient</span>
  <span>Page ${n} of ${total} · ${PROJ}</span></div>`;

const rebRow = [[70,42],[120,40],[170,43],[220,41]];
const scard = (title, meta, hyp, verdictPill, obs) => `
  <div class="scard">
    <div class="hd"><span class="t">${title}</span><span class="m">${meta}</span></div>
    <div class="bd">
      <div class="radar"><div class="scale"><span>0</span><span>100</span><span>200</span></div>
        ${rebRow.map(([l,t])=>`<div class="reb" style="left:${l}px;top:${t}px"></div>`).join('')}
        ${hyp?`<div class="hyp" style="left:${hyp.l}px;top:64px;width:${hyp.w}px;height:${hyp.h}px;border-top-color:${hyp.c}"></div>`:''}
        <div class="cap">GPR B-scan · 1.6 GHz</div></div>
      <div class="legend">
        <div><span class="k" style="background:#111"></span>Rebar — top mat, ~45 mm</div>
        <div><span class="k" style="background:#2b6cff"></span>Post-tension tendon</div>
        <div><span class="k" style="background:#c0282d"></span>Conduit / no-scan zone</div>
        <div class="verdict">${verdictPill}</div>
      </div>
    </div>
    <div class="cobs"><b>Observation.</b> ${obs}</div>
  </div>`;

const page1 = `
  ${fullLH}
  <div class="content">
    <div class="keyline"><span class="k">Bottom line</span>
      <span class="v"><b>2 of 3 cores cleared.</b> Core&nbsp;B caution (relocate 75&nbsp;mm S); Core&nbsp;C is a <b>no-go</b> over live conduit.</span></div>

    <h2 class="sec">Project Information</h2>
    <div class="pgrid">
      <div>
        <div class="r"><b>Site</b><span>1450 Industrial Way, Burnaby BC</span></div>
        <div class="r"><b>Client</b><span>Pinnacle Structural Eng.</span></div>
        <div class="r"><b>Structure</b><span>Level-2 parkade suspended deck</span></div>
        <div class="r"><b>Scan date</b><span>2026-05-28</span></div>
      </div>
      <div>
        <div class="r"><b>Equipment</b><span>GSSI StructureScan Mini XT</span></div>
        <div class="r"><b>Slab type</b><span>200 mm two-way, post-tensioned</span></div>
        <div class="r"><b>Operator</b><span>D. Cunningham</span></div>
        <div class="r"><b>Project no.</b><span>${PROJ}</span></div>
      </div>
    </div>

    <h2 class="sec">Scan Summary</h2>
    <p class="summary">Ground-penetrating radar survey performed on the level-2 suspended deck to locate
    embedded reinforcement, post-tension cables and electrical conduit prior to core drilling at three
    proposed locations. Top-mat rebar identified at <strong>~45&nbsp;mm cover</strong> on
    <strong>200&nbsp;mm centres</strong>; a single post-tension tendon crosses Grid&nbsp;B on a diagonal;
    an electrical conduit run was detected beneath Grid&nbsp;C. Cores were assessed against a
    <strong>50&nbsp;mm minimum standoff</strong> to any marked target.</p>

    <h2 class="sec">Core Clearance Findings</h2>
    <table class="find">
      <thead><tr><th style="width:48px">Core</th><th style="width:46px">Size</th>
        <th style="width:90px">Verdict</th><th>Clearance &amp; recommendation</th></tr></thead>
      <tbody>
        <tr><td class="core">A</td><td>4&Prime;</td><td><span class="pill safe">Safe</span></td>
          <td><span class="num">60&nbsp;mm</span> clear of all targets. Cleared to drill as marked.</td></tr>
        <tr><td class="core">B</td><td>6&Prime;</td><td><span class="pill caution">Caution</span></td>
          <td>PT tendon within <span class="num">25&nbsp;mm</span> — relocate <span class="num">75&nbsp;mm south</span> and re-scan before drilling.</td></tr>
        <tr><td class="core">C</td><td>4&Prime;</td><td><span class="pill nogo">No-go</span></td>
          <td>Directly over conduit run. <b>Do not drill;</b> redesign required.</td></tr>
      </tbody>
    </table>
  </div>
  ${foot(1,3)}`;

const page2 = `
  <div class="content tall">
    <h2 class="sec">Scan Location — Grid A (Core A)</h2>
    ${scard('Grid A · Bay 1 mid-span','0.9 m × 0.9 m · depth scale 0–200 mm', null,
      '<span class="pill safe">Safe</span>',
      'Clear cone at the proposed core centre — no targets within 60&nbsp;mm in any direction. Top mat consistent at ~45&nbsp;mm cover. Safe to drill as marked.')}
    <h2 class="sec">Scan Location — Grid B (Core B)</h2>
    ${scard('Grid B · Bay 2 column line','0.9 m × 0.9 m · depth scale 0–200 mm',{l:150,w:90,h:46,c:'#5aa0ff'},
      '<span class="pill caution">Caution</span>',
      'Post-tension tendon crosses on a diagonal within 25&nbsp;mm of the proposed centre. Relocate the core 75&nbsp;mm south, clear of the tendon envelope, and re-scan before drilling.')}
  </div>
  ${foot(2,3)}`;

const page3 = `
  <div class="content tall">
    <h2 class="sec">Scan Location — Grid C (Core C)</h2>
    ${scard('Grid C · Bay 2 wall line','0.9 m × 0.9 m · depth scale 0–200 mm',{l:120,w:130,h:30,c:'#ff5a5a'},
      '<span class="pill nogo">No-go</span>',
      'Energised electrical conduit detected directly beneath the proposed centre at ~110&nbsp;mm. No-go — do not drill at this location; refer back to the EOR for a redesigned core position.')}

    <h2 class="sec">Methodology &amp; Standard Notes</h2>
    <ol class="notes">
      <li>Survey performed with a GSSI StructureScan Mini XT (1.6&nbsp;GHz) on orthogonal 50&nbsp;mm line spacing.</li>
      <li>Depths are estimates based on an assumed dielectric for cured concrete and are <b>±15%</b>.</li>
      <li>Targets marked on the slab supersede this report where any discrepancy exists.</li>
      <li>Clearances reference the marked grid origin; verify on site before cutting.</li>
    </ol>

    <div class="disc"><b>Limitations.</b> GPR results are interpretive and depend on moisture, cover and
    congestion. Non-metallic and deeply embedded targets may not be detected. Aggarwal Kamikazes Cutting
    &amp; Coring Ltd. accepts no liability for drilling outside the cleared zones described above. Report
    valid for the slab, locations and date stated.</div>

    <div class="sig">
      <div class="slot"><b>Scanned by</b>D. Cunningham · GPR Technician</div>
      <div class="slot"><b>Date</b>2026-05-28</div>
      <div class="slot"><b>Reviewed by</b>________________________</div>
      <div class="slot"><b>Project no.</b>${PROJ}</div>
    </div>
  </div>
  ${foot(3,3)}`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
  <div class="sheet">${page1}</div>
  <div class="sheet">${page2}</div>
  <div class="sheet">${page3}</div>
</body></html>`;

const file = path.join(OUT, 'ScanReport-final.html');
fs.writeFileSync(file, html);

const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await browser.newPage();
await page.goto('file://' + file);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(250);
await page.pdf({ path: path.join(OUT, 'ScanReport-final.pdf'),
  width: '8.5in', height: '11in', printBackground: true, margin: { top:0, bottom:0, left:0, right:0 } });
await browser.close();
console.log('wrote ScanReport-final.pdf');
