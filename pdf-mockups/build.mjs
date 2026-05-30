// Generates three clean engineer-facing PDF letterhead concepts for ScanReport
// and renders each to PNG (and a 2-page PDF for the repeating-header concept).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('.');
const logoData = 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, 'logo.png')).toString('base64');

// ---- Shared brand + page chrome ---------------------------------------------
const baseCSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --ink:#111; --mut:#555; --faint:#777; --line:#cfcfcf;
    --red:#c0282d; --red-soft:#f7e9ea; --paper:#fff;
    --safe:#1d7a3a; --caution:#b8770a; --nogo:#c0282d;
  }
  html,body{background:#6a6a6a}
  body{font-family:'Inter','Segoe UI',-apple-system,system-ui,sans-serif;
    -webkit-font-smoothing:antialiased;color:var(--ink);
    font-feature-settings:"kern" 1,"liga" 1,"tnum" 1;font-variant-numeric:tabular-nums}
  .page{width:8.5in;min-height:11in;background:var(--paper);margin:28px auto;
    padding:0.6in 0.65in 0.7in;position:relative;box-shadow:0 10px 40px rgba(0,0,0,.45)}
  h2.sec{font-size:10.5pt;letter-spacing:.12em;text-transform:uppercase;color:var(--ink);
    border-bottom:1px solid var(--line);padding-bottom:4px;margin:18px 0 10px}
  .muted{color:var(--mut)} .faint{color:var(--faint)}
  /* project info grid */
  .pgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px 28px;font-size:9.5pt}
  .pgrid .row{display:flex;justify-content:space-between;border-bottom:1px dotted #e2e2e2;padding:3px 0}
  .pgrid .row b{color:var(--mut);font-weight:600;letter-spacing:.02em}
  /* findings table */
  table.find{width:100%;border-collapse:collapse;font-size:9pt;margin-top:4px}
  table.find th{background:#f0f0f0;text-transform:uppercase;font-size:7.5pt;letter-spacing:.08em;
    text-align:left;padding:6px 8px;border:1px solid #ccc;color:#333}
  table.find td{padding:6px 8px;border:1px solid #d8d8d8;vertical-align:top}
  .pill{display:inline-block;font-size:7.5pt;font-weight:700;letter-spacing:.05em;
    text-transform:uppercase;padding:2px 8px;border-radius:10px;color:#fff}
  .pill.safe{background:var(--safe)} .pill.caution{background:var(--caution)} .pill.nogo{background:var(--nogo)}
  /* scan card */
  .scard{border:1px solid #cfcfcf;border-radius:4px;overflow:hidden;margin-top:10px;page-break-inside:avoid}
  .scard .hd{display:flex;justify-content:space-between;align-items:center;
    background:#fafafa;border-bottom:1px solid #e3e3e3;padding:7px 10px}
  .scard .hd .t{font-weight:700;font-size:10pt}
  .scard .hd .m{font-size:8pt;color:var(--faint)}
  .scard .bd{display:grid;grid-template-columns:1.45fr 1fr;gap:10px;padding:10px}
  /* faux radargram */
  .radar{height:150px;border:1px solid #888;border-radius:2px;position:relative;overflow:hidden;
    background:
      repeating-linear-gradient(0deg,#0b0b0b 0 2px,#1b1b1b 2px 5px,#0f0f0f 5px 9px),
      linear-gradient(180deg,#222,#000)}
  .radar .scale{position:absolute;left:0;top:0;bottom:0;width:26px;background:#111;color:#bbb;
    font-size:6.5pt;border-right:1px solid #444;display:flex;flex-direction:column;
    justify-content:space-between;padding:3px 2px;text-align:center}
  .radar .hyp{position:absolute;width:60px;height:30px;border:2px solid transparent;
    border-top-color:#ff5a5a;border-radius:50%;transform:rotate(0)}
  .radar .reb{position:absolute;width:9px;height:9px;border-radius:50%;
    background:radial-gradient(circle,#fff 0 30%,#ffd23f 45%,transparent 70%)}
  .radar .cap{position:absolute;bottom:3px;right:5px;color:#9aa;font-size:6.5pt;letter-spacing:.05em}
  .legend{font-size:8.5pt;line-height:1.7}
  .legend .k{display:inline-block;width:11px;height:11px;border:1px solid #333;
    vertical-align:-1px;margin-right:6px;border-radius:2px}
  .summary{font-size:9.5pt;line-height:1.5;color:#222}
  .disc{margin-top:16px;border-top:1px solid #bbb;padding-top:8px;
    font-size:8pt;line-height:1.5;color:#444;page-break-inside:avoid}
  .pageno{position:absolute;bottom:0.32in;right:0.65in;font-size:8pt;color:var(--faint)}
`;

// ---- Shared report body (everything below the letterhead) -------------------
const body = `
  <h2 class="sec">Project Information</h2>
  <div class="pgrid">
    <div>
      <div class="row"><b>Site</b><span>1450 Industrial Way, Burnaby BC</span></div>
      <div class="row"><b>Client</b><span>Pinnacle Structural Eng.</span></div>
      <div class="row"><b>Scan date</b><span>2026-05-28</span></div>
      <div class="row"><b>Operator</b><span>D. Cunningham</span></div>
    </div>
    <div>
      <div class="row"><b>Equipment</b><span>GSSI StructureScan Mini XT</span></div>
      <div class="row"><b>Slab type</b><span>200 mm suspended deck</span></div>
      <div class="row"><b>Coverage</b><span>3 grids · 6.2 m²</span></div>
      <div class="row"><b>Project no.</b><span>AKCC-2026-0017</span></div>
    </div>
  </div>

  <h2 class="sec">Scan Summary</h2>
  <p class="summary">Ground-penetrating radar survey performed on the level-2 suspended deck to
  locate embedded reinforcement, post-tension cables and conduit prior to core drilling at three
  proposed locations. Top-mat rebar identified at ~45&nbsp;mm cover on 200&nbsp;mm centres; a single
  post-tension tendon crosses Grid&nbsp;B. No reinforcement detected within the cone of Core&nbsp;A.</p>

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

  <h2 class="sec">Scan Location — Grid B (Core B)</h2>
  <div class="scard">
    <div class="hd"><span class="t">Grid B · Bay 2 column line</span>
      <span class="m">0.9 m × 0.9 m · depth scale 0–200 mm</span></div>
    <div class="bd">
      <div class="radar">
        <div class="scale"><span>0</span><span>100</span><span>200</span></div>
        <div class="reb" style="left:70px;top:42px"></div>
        <div class="reb" style="left:120px;top:40px"></div>
        <div class="reb" style="left:170px;top:43px"></div>
        <div class="reb" style="left:220px;top:41px"></div>
        <div class="hyp" style="left:150px;top:70px;width:90px;height:46px;border-top-color:#5aa0ff"></div>
        <div class="cap">GPR B-scan · 1.6 GHz</div>
      </div>
      <div class="legend">
        <div><span class="k" style="background:#111"></span>Rebar — top mat, ~45 mm</div>
        <div><span class="k" style="background:#2b6cff"></span>Post-tension tendon</div>
        <div><span class="k" style="background:#c0282d"></span>Conduit / no-scan zone</div>
        <div style="margin-top:6px" class="faint">Targets marked on slab in matching colours.
          Photo of marked-up area on file.</div>
      </div>
    </div>
  </div>

  <div class="disc"><b>Limitations.</b> GPR results are interpretive and depend on moisture, cover and
  congestion. Clearances are referenced to the marked grid origin and should be verified on site before
  cutting. Aggarwal Kamikazes Cutting &amp; Coring Ltd. accepts no liability for drilling outside the
  cleared zones described above. Report valid for the slab and date stated.</div>
`;

// ---- Three letterhead concepts ---------------------------------------------
const concepts = {
  'A-refined-classic': {
    css: `
      .lh{text-align:center;padding-bottom:12px;border-bottom:2px solid var(--ink);margin-bottom:4px}
      .lh img{height:96px;width:auto;display:block;margin:0 auto 6px}
      .lh .nm{font-size:17pt;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
      .lh .sub{font-size:9pt;color:var(--red);letter-spacing:.18em;text-transform:uppercase;margin-top:2px}
      .lh .meta{display:flex;justify-content:center;gap:18px;font-size:8pt;color:var(--faint);margin-top:7px}
      .lh .meta b{color:var(--mut)}
    `,
    header: `
      <div class="lh">
        <img src="${logoData}" alt="">
        <div class="nm">Aggarwal Kamikazes</div>
        <div class="sub">Cutting &amp; Coring Ltd · GPR Scan Report</div>
        <div class="meta"><span><b>Project</b> AKCC-2026-0017</span>
          <span><b>Operator</b> D. Cunningham</span><span><b>Date</b> 2026-05-28</span></div>
      </div>`,
  },

  'B-engineering-letterhead': {
    css: `
      .lh{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;
        border-bottom:3px solid var(--ink);padding-bottom:10px;margin-bottom:6px}
      .lh img{height:62px;width:auto}
      .lh .co .nm{font-size:15pt;font-weight:800;letter-spacing:.04em;text-transform:uppercase;line-height:1}
      .lh .co .sub{font-size:8.5pt;color:var(--red);letter-spacing:.14em;text-transform:uppercase;margin-top:3px}
      .lh .co .addr{font-size:7.5pt;color:var(--faint);margin-top:4px;line-height:1.4}
      .lh .box{font-size:8pt;text-align:right;line-height:1.5;border-left:1px solid var(--line);padding-left:12px}
      .lh .box b{display:block;color:var(--mut);font-size:7pt;letter-spacing:.08em;text-transform:uppercase}
      .lh .box .v{font-size:9.5pt;font-weight:700;margin-bottom:4px}
    `,
    header: `
      <div class="lh">
        <img src="${logoData}" alt="">
        <div class="co">
          <div class="nm">Aggarwal Kamikazes</div>
          <div class="sub">Cutting &amp; Coring Ltd.</div>
          <div class="addr">123 Industrial Way, Burnaby BC V5A 1A1 · (604) 555-0199 · scans@aggarwalkamikazes.ca</div>
        </div>
        <div class="box">
          <b>Project</b><div class="v">AKCC-2026-0017</div>
          <b>Operator</b><div class="v">D. Cunningham</div>
          <b>Date</b><div class="v">2026-05-28</div>
        </div>
      </div>`,
  },

  'C-side-spine': {
    css: `
      .page{padding-right:0.95in}
      .lh{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--line);
        padding-bottom:9px;margin-bottom:4px}
      .lh img{height:54px;width:auto}
      .lh .nm{font-size:14pt;font-weight:800;letter-spacing:.05em;text-transform:uppercase;line-height:1}
      .lh .sub{font-size:8pt;color:var(--red);letter-spacing:.16em;text-transform:uppercase;margin-top:3px}
      .lh .pn{margin-left:auto;text-align:right;font-size:8pt;color:var(--faint);line-height:1.5}
      .lh .pn b{color:var(--mut)}
      .spine{position:absolute;top:0;right:0;bottom:0;width:0.5in;background:var(--red);
        color:#fff;display:flex;align-items:center;justify-content:center}
      .spine span{writing-mode:vertical-rl;transform:rotate(180deg);font-size:8.5pt;
        letter-spacing:.22em;text-transform:uppercase;font-weight:700}
      .spine .pg{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);
        writing-mode:initial;font-size:8pt;letter-spacing:0}
    `,
    header: `
      <div class="spine"><span>Aggarwal Kamikazes · GPR Scan Report</span><div class="pg">1 / 3</div></div>
      <div class="lh">
        <img src="${logoData}" alt="">
        <div><div class="nm">Aggarwal Kamikazes</div>
          <div class="sub">Cutting &amp; Coring Ltd.</div></div>
        <div class="pn"><div><b>Project</b> AKCC-2026-0017</div>
          <div><b>Operator</b> D. Cunningham</div><div><b>Date</b> 2026-05-28</div></div>
      </div>`,
  },
};

const html = (c) => `<!doctype html><html><head><meta charset="utf-8">
  <style>${baseCSS}${c.css}</style></head>
  <body><div class="page">${c.header}${body}<div class="pageno">Page 1 of 3 · AKCC-2026-0017</div></div></body></html>`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2 });
for (const [name, c] of Object.entries(concepts)) {
  const file = path.join(OUT, name + '.html');
  fs.writeFileSync(file, html(c));
  await page.goto('file://' + file);
  await page.waitForTimeout(150);
  const el = await page.$('.page');
  await el.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('rendered', name);
}
await browser.close();
console.log('done');
