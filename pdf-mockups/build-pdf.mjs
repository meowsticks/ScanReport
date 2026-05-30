// Renders a full multi-page ScanReport mock-up to a real PDF using the Pure-B
// letterhead. Manual pagination into fixed 8.5x11in sheets gives a guaranteed
// repeating letterhead + footer + page numbers on every page.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { baseCSS, logoData, CHROMIUM } from './content.mjs';

const OUT = path.resolve('.');
const PROJ = 'AKCC-2026-0017';

// ---- Pure-B letterhead, full (page 1) and compact (continuation pages) ------
const lhCSS = `
  .sheet{width:8.5in;height:11in;position:relative;background:#fff;overflow:hidden;
    padding:0.55in 0.6in 0.5in}
  .sheet + .sheet{page-break-before:always}
  .content{position:absolute;left:0.6in;right:0.6in;top:1.35in;bottom:0.55in}
  .content.tall{top:0.55in}   /* continuation pages have no header */
  /* full letterhead */
  .lh{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;
    border-bottom:3px solid var(--ink);padding-bottom:10px}
  .lh img{height:60px;width:auto}
  .lh .co .nm{font-size:15pt;font-weight:800;letter-spacing:.04em;text-transform:uppercase;line-height:1}
  .lh .co .sub{font-size:8.5pt;color:var(--red);letter-spacing:.14em;text-transform:uppercase;margin-top:3px}
  .lh .co .addr{font-size:7.5pt;color:var(--faint);margin-top:4px;line-height:1.4}
  .lh .box{font-size:8pt;text-align:right;line-height:1.5;border-left:1px solid var(--line);padding-left:12px}
  .lh .box b{display:block;color:var(--mut);font-size:7pt;letter-spacing:.08em;text-transform:uppercase}
  .lh .box .v{font-size:9.5pt;font-weight:700;margin-bottom:4px}
  /* compact running header */
  .rh{display:flex;align-items:center;gap:10px;border-bottom:2px solid var(--ink);padding-bottom:7px}
  .rh img{height:30px;width:auto}
  .rh .nm{font-size:10.5pt;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
  .rh .meta{margin-left:auto;font-size:7.5pt;color:var(--faint)}
  .rh .meta b{color:var(--mut)}
  /* footer */
  .foot{position:absolute;left:0.6in;right:0.6in;bottom:0.3in;display:flex;justify-content:space-between;
    align-items:center;border-top:1px solid var(--line);padding-top:5px;font-size:7.5pt;color:var(--faint)}
  .foot .c{letter-spacing:.1em;text-transform:uppercase}
  .sig{display:grid;grid-template-columns:1fr 1fr;gap:14px 28px;margin-top:14px;font-size:9pt}
  .sig .slot{border-top:1px solid #999;padding-top:5px}
  .sig .slot b{display:block;font-size:7.5pt;color:var(--mut);text-transform:uppercase;letter-spacing:.06em}
  .notes{font-size:8.5pt;line-height:1.5;color:#2a2a2a}
  .notes li{margin:0 0 4px 16px}
`;

const fullLH = `
  <div class="lh">
    <img src="${logoData}" alt="">
    <div class="co">
      <div class="nm">Aggarwal Kamikazes</div>
      <div class="sub">Cutting &amp; Coring Ltd.</div>
      <div class="addr">123 Industrial Way, Burnaby BC V5A 1A1 · (604) 555-0199 · scans@aggarwalkamikazes.ca</div>
    </div>
    <div class="box">
      <b>Project</b><div class="v">${PROJ}</div>
      <b>Operator</b><div class="v">D. Cunningham</div>
      <b>Date</b><div class="v">2026-05-28</div>
    </div>
  </div>`;

// Continuation pages (2+) carry no header — letterhead is page 1 only.

const foot = (n, total) => `<div class="foot">
  <span>Aggarwal Kamikazes Cutting &amp; Coring Ltd.</span>
  <span class="c">Confidential — for the named recipient</span>
  <span>Page ${n} of ${total} · ${PROJ}</span></div>`;

// reusable scan-location card (normal size)
const scard = (title, meta, rebars, hyp, note) => `
  <div class="scard">
    <div class="hd"><span class="t">${title}</span><span class="m">${meta}</span></div>
    <div class="bd">
      <div class="radar">
        <div class="scale"><span>0</span><span>100</span><span>200</span></div>
        ${rebars.map(([l, t]) => `<div class="reb" style="left:${l}px;top:${t}px"></div>`).join('')}
        ${hyp ? `<div class="hyp" style="left:${hyp.l}px;top:${hyp.t}px;width:${hyp.w}px;height:${hyp.h}px;border-top-color:${hyp.c}"></div>` : ''}
        <div class="cap">GPR B-scan · 1.6 GHz</div>
      </div>
      <div class="legend">
        <div><span class="k" style="background:#111"></span>Rebar — top mat, ~45 mm</div>
        <div><span class="k" style="background:#2b6cff"></span>Post-tension tendon</div>
        <div><span class="k" style="background:#c0282d"></span>Conduit / no-scan zone</div>
        <div style="margin-top:6px" class="faint">${note}</div>
      </div>
    </div>
  </div>`;

const rebRow = [[70,42],[120,40],[170,43],[220,41]];

// ---- Pages ------------------------------------------------------------------
const page1 = `
  ${fullLH}
  <div class="content">
    <h2 class="sec">Project Information</h2>
    <div class="pgrid">
      <div>
        <div class="row"><b>Site</b><span>1450 Industrial Way, Burnaby BC</span></div>
        <div class="row"><b>Client</b><span>Pinnacle Structural Eng.</span></div>
        <div class="row"><b>Structure</b><span>Level-2 parkade suspended deck</span></div>
        <div class="row"><b>Scan date</b><span>2026-05-28</span></div>
      </div>
      <div>
        <div class="row"><b>Equipment</b><span>GSSI StructureScan Mini XT</span></div>
        <div class="row"><b>Slab type</b><span>200 mm two-way, post-tensioned</span></div>
        <div class="row"><b>Coverage</b><span>3 grids · 6.2 m²</span></div>
        <div class="row"><b>Project no.</b><span>${PROJ}</span></div>
      </div>
    </div>

    <h2 class="sec">Scan Summary</h2>
    <p class="summary">Ground-penetrating radar survey performed on the level-2 suspended deck to locate
    embedded reinforcement, post-tension cables and electrical conduit prior to core drilling at three
    proposed locations. Top-mat rebar identified at ~45&nbsp;mm cover on 200&nbsp;mm centres; a single
    post-tension tendon crosses Grid&nbsp;B on a diagonal; an electrical conduit run was detected beneath
    Grid&nbsp;C. Cores were assessed against a 50&nbsp;mm minimum standoff to any marked target.</p>

    <h2 class="sec">Core Clearance Findings</h2>
    <table class="find">
      <thead><tr><th style="width:54px">Core</th><th style="width:48px">Size</th>
        <th style="width:92px">Verdict</th><th>Clearance &amp; recommendation</th></tr></thead>
      <tbody>
        <tr><td><b>A</b></td><td>4&Prime;</td><td><span class="pill safe">Safe</span></td>
          <td>60&nbsp;mm clear of all targets. Cleared to drill as marked.</td></tr>
        <tr><td><b>B</b></td><td>6&Prime;</td><td><span class="pill caution">Caution</span></td>
          <td>PT tendon within 25&nbsp;mm — relocate 75&nbsp;mm south and re-scan before drilling.</td></tr>
        <tr><td><b>C</b></td><td>4&Prime;</td><td><span class="pill nogo">No-go</span></td>
          <td>Directly over conduit run. Do not drill; redesign required.</td></tr>
      </tbody>
    </table>

    <h2 class="sec">Marked-up Layout</h2>
    <p class="summary">All targets were chalk-marked on the slab in the legend colours below. Proposed core
    centres are marked with their letter and verdict. A photographic record of each marked grid is
    included on the following pages.</p>
  </div>
  ${foot(1,3)}`;

const page2 = `
  <div class="content tall">
    <h2 class="sec">Scan Location — Grid A (Core A)</h2>
    ${scard('Grid A · Bay 1 mid-span', '0.9 m × 0.9 m · depth scale 0–200 mm', rebRow, null,
      'Clear cone at core centre. No targets within 60 mm. Safe to drill as marked.')}
    <h2 class="sec">Scan Location — Grid B (Core B)</h2>
    ${scard('Grid B · Bay 2 column line', '0.9 m × 0.9 m · depth scale 0–200 mm', rebRow,
      {l:150,t:70,w:90,h:46,c:'#5aa0ff'},
      'Post-tension tendon crosses within 25 mm of the proposed centre. Relocate 75 mm south and re-scan.')}
  </div>
  ${foot(2,3)}`;

const page3 = `
  <div class="content tall">
    <h2 class="sec">Scan Location — Grid C (Core C)</h2>
    ${scard('Grid C · Bay 2 wall line', '0.9 m × 0.9 m · depth scale 0–200 mm', rebRow,
      {l:120,t:96,w:130,h:30,c:'#ff5a5a'},
      'Energised conduit detected directly beneath the proposed centre. No-go — redesign required.')}

    <h2 class="sec">Methodology &amp; Standard Notes</h2>
    <ol class="notes">
      <li>Survey performed with a GSSI StructureScan Mini XT (1.6 GHz) on orthogonal 50 mm line spacing.</li>
      <li>Depths are estimates based on an assumed dielectric for cured concrete and are ±15%.</li>
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

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  ${baseCSS}${lhCSS}
  @page{size:letter;margin:0}
  html,body{background:#fff}
</style></head><body>
  <div class="sheet">${page1}</div>
  <div class="sheet">${page2}</div>
  <div class="sheet">${page3}</div>
</body></html>`;

const file = path.join(OUT, 'ScanReport-mockup.html');
fs.writeFileSync(file, html);

const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await browser.newPage();
await page.goto('file://' + file);
await page.waitForTimeout(200);
await page.pdf({ path: path.join(OUT, 'ScanReport-mockup.pdf'),
  width: '8.5in', height: '11in', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
await browser.close();
console.log('wrote ScanReport-mockup.pdf');
