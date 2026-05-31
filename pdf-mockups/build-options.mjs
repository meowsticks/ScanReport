// Render comparison PNGs for the header + divider decisions so the choice is
// made from the real look. Outputs: header-A.png, header-B.png, div-1.png,
// div-2.png, div-3.png
import pw from '/tmp/node_modules/playwright-core/index.js';
const { chromium } = pw;
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('.');
const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b64 = (p) => fs.readFileSync(p).toString('base64');
const logo = 'data:image/png;base64,' + b64(path.join(OUT, 'logo.png'));
const F = '/tmp/node_modules/@fontsource/caveat/files';
const cav4 = b64(`${F}/caveat-latin-400-normal.woff2`);
const cav7 = b64(`${F}/caveat-latin-700-normal.woff2`);

const BASE = `
  @font-face{font-family:'Caveat';font-weight:400;src:url(data:font/woff2;base64,${cav4}) format('woff2')}
  @font-face{font-family:'Caveat';font-weight:700;src:url(data:font/woff2;base64,${cav7}) format('woff2')}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter','Segoe UI',system-ui,sans-serif;color:#141414;background:#fff;
    -webkit-font-smoothing:antialiased}
  .sheet{width:760px;background:#fff;padding:26px 30px}
  :root{--red:#c0282d;--ink:#141414;--mut:#555;--faint:#777;--line:#d6d6d6;}
`;

// ---------- HEADER A: full 3-column letterhead (logo | name+addr | info box) ----------
const headerA = `
  <style>
    .lhA{display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center;
      border-bottom:3px solid var(--ink);padding-bottom:13px}
    .lhA img{height:96px;width:auto}
    .lhA .nm1{font-family:'Caveat',cursive;font-weight:700;font-size:34pt;line-height:.8;color:var(--ink)}
    .lhA .nm2{font-family:'Caveat',cursive;font-weight:700;font-size:22pt;line-height:.95;color:var(--red)}
    .lhA .sub{font-size:8.5pt;color:var(--mut);letter-spacing:.14em;text-transform:uppercase;margin-top:7px;font-weight:600}
    .lhA .addr{font-size:8pt;color:var(--faint);margin-top:4px;line-height:1.5}
    .lhA .box{font-size:8pt;text-align:right;line-height:1.5;border-left:1px solid var(--line);padding-left:15px}
    .lhA .box b{display:block;color:var(--mut);font-size:6.8pt;letter-spacing:.09em;text-transform:uppercase;font-weight:700}
    .lhA .box .v{font-size:10.5pt;font-weight:700;margin-bottom:6px}
  </style>
  <div class="lhA">
    <img src="${logo}" alt="">
    <div>
      <div class="nm1">Aggarwal Kamikazes</div>
      <div class="nm2">Cutting &amp; Coring Ltd.</div>
      <div class="sub">GPR Concrete Scanning · Core Clearance Report</div>
      <div class="addr">123 Industrial Way, Burnaby BC V5A 1A1 · (604) 555-0199 · scans@aggarwalkamikazes.ca</div>
    </div>
    <div class="box">
      <b>Project</b><div class="v">AKCC-2026-0431</div>
      <b>Operator</b><div class="v">D. Cunningham</div>
      <b>Date</b><div class="v">2026-05-29</div>
    </div>
  </div>`;

// ---------- HEADER B: logo left + centered wordmark, right side = info box (not empty) ----------
const headerB = `
  <style>
    .lhB{display:flex;align-items:center;gap:16px;border-bottom:3px solid var(--ink);padding-bottom:13px}
    .lhB img{height:92px;width:auto;flex-shrink:0}
    .lhB .ctr{flex:1;text-align:center;line-height:1.02}
    .lhB .nm1{font-family:'Caveat',cursive;font-weight:700;font-size:32pt;color:var(--ink);display:block}
    .lhB .nm2{font-family:'Caveat',cursive;font-weight:700;font-size:21pt;color:var(--red);display:block;margin-top:-3px}
    .lhB .tag{font-size:9.5pt;font-style:italic;color:var(--red);margin-top:4px}
    .lhB .box{font-size:8pt;text-align:right;line-height:1.5;border-left:1px solid var(--line);padding-left:15px;flex-shrink:0}
    .lhB .box b{display:block;color:var(--mut);font-size:6.8pt;letter-spacing:.09em;text-transform:uppercase;font-weight:700}
    .lhB .box .v{font-size:10pt;font-weight:700;margin-bottom:5px}
  </style>
  <div class="lhB">
    <img src="${logo}" alt="">
    <div class="ctr">
      <span class="nm1">Aggarwal Kamikazes</span>
      <span class="nm2">Cutting &amp; Coring Ltd.</span>
      <div class="tag">Know before you cut.</div>
    </div>
    <div class="box">
      <b>Project</b><div class="v">AKCC-2026-0431</div>
      <b>Operator</b><div class="v">D. Cunningham</div>
      <b>Date</b><div class="v">2026-05-29</div>
    </div>
  </div>`;

// ---------- a sample body chunk rendered three divider ways ----------
// content: a section heading, a summary line grid, and two scan cards (no photo)
function body(style) {
  // style: 'clean' | 'strong' | 'medium'
  const head = {
    clean:  `h2{font-size:11pt;font-weight:800;letter-spacing:.04em;color:#111;margin:18px 0 9px;text-transform:uppercase}`,
    strong: `h2{font-size:11pt;font-weight:800;letter-spacing:.06em;color:#fff;background:#141414;padding:5px 10px;margin:18px 0 10px;text-transform:uppercase}`,
    medium: `h2{font-size:11pt;font-weight:800;letter-spacing:.05em;color:#111;border-left:4px solid var(--red);padding:2px 0 2px 9px;margin:18px 0 10px;text-transform:uppercase}`,
  }[style];
  const card = {
    clean:  `.card{margin:9px 0}.card .hd{font-weight:800;font-size:10pt;color:#111;margin-bottom:3px}
             .card .meta{font-size:8.5pt;color:#888;margin-bottom:6px}
             .card .obs{font-size:9.5pt;line-height:1.5;color:#222}
             .card .vd{margin-top:6px;font-size:9pt}`,
    strong: `.card{margin:11px 0;border:1.5px solid #bbb}
             .card .hd{font-weight:800;font-size:10pt;color:#fff;background:var(--red);padding:6px 10px;
               display:flex;justify-content:space-between}.card .hd .r{font-weight:600;opacity:.9}
             .card .bd{padding:9px 11px}
             .card .obs{font-size:9.5pt;line-height:1.5;color:#222}
             .card .vd{margin-top:7px;font-size:9pt;border-top:1px solid #e2e2e2;padding-top:6px}`,
    medium: `.card{margin:10px 0;border:1px solid #d6d6d6;border-left:4px solid var(--red);border-radius:5px}
             .card .hd{font-weight:800;font-size:10pt;color:#111;padding:7px 11px 0;
               display:flex;justify-content:space-between}.card .hd .r{font-weight:600;color:#888;font-size:8.5pt}
             .card .bd{padding:5px 11px 10px}
             .card .obs{font-size:9.5pt;line-height:1.5;color:#222}
             .card .vd{margin-top:6px;font-size:9pt}`,
  }[style];
  const pill = `.pill{display:inline-block;font-size:7.5pt;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
    padding:2px 9px;border-radius:10px;color:#fff}.safe{background:#1d7a3a}.caution{background:#b8770a}`;
  const grid = {
    clean:  `.sum{display:grid;grid-template-columns:1fr 1fr;gap:4px 26px;font-size:9.5pt;margin-bottom:4px}
             .sum .r{display:flex;justify-content:space-between;padding:3px 0}`,
    strong: `.sum{display:grid;grid-template-columns:1fr 1fr;gap:0 26px;font-size:9.5pt;margin-bottom:4px}
             .sum .r{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e8e8e8}`,
    medium: `.sum{display:grid;grid-template-columns:1fr 1fr;gap:3px 26px;font-size:9.5pt;margin-bottom:4px}
             .sum .r{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dotted #e2e2e2}`,
  }[style];
  return `<style>${head}${card}${pill}${grid}
    .sum .r b{color:#555;font-weight:600}</style>
    <h2>Project Information</h2>
    <div class="sum">
      <div class="r"><b>Site</b><span>8800 Cambie St, Vancouver BC</span></div>
      <div class="r"><b>Client</b><span>Northpoint Construction Ltd.</span></div>
      <div class="r"><b>Structure</b><span>P1 / L2 / L3 suspended decks</span></div>
      <div class="r"><b>Scan date</b><span>2026-05-29</span></div>
    </div>
    <h2>Scan Locations</h2>
    <div class="card">
      <div class="hd">Core A · P1 Bay 1 mid-span <span class="r">0.9 m × 0.9 m</span></div>
      <div class="bd">
        <div class="obs"><b>Observation.</b> Clear cone at the proposed centre — no targets within 65 mm in any direction. Uniform top mat at ~45 mm cover.</div>
        <div class="vd"><span class="pill safe">Safe</span> &nbsp;Cleared to drill as marked.</div>
      </div>
    </div>
    <div class="card">
      <div class="hd">Core B · P1 Bay 2 column line <span class="r">0.9 m × 0.9 m</span></div>
      <div class="bd">
        <div class="obs"><b>Observation.</b> A post-tension tendon crosses on a diagonal within 30 mm of the proposed centre.</div>
        <div class="vd"><span class="pill caution">Caution</span> &nbsp;Relocate the core 80 mm south and re-scan before drilling.</div>
      </div>
    </div>`;
}

const pages = {
  'header-A': headerA,
  'header-B': headerB,
  'div-1-clean':  headerB + body('clean'),
  'div-2-strong': headerB + body('strong'),
  'div-3-medium': headerB + body('medium'),
};

const browser = await chromium.launch({ executablePath: CHROMIUM });
for (const [name, inner] of Object.entries(pages)) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}</style></head>
    <body><div class="sheet" id="s">${inner}</div></body></html>`;
  const f = path.join(OUT, name + '.html');
  fs.writeFileSync(f, html);
  const page = await browser.newPage({ viewport: { width: 820, height: 700 }, deviceScaleFactor: 2 });
  await page.goto('file://' + f);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const el = await page.$('#s');
  await el.screenshot({ path: path.join(OUT, name + '.png') });
  await page.close();
  fs.unlinkSync(f);
}
await browser.close();
console.log('wrote header-A.png header-B.png div-1-clean.png div-2-strong.png div-3-medium.png');
