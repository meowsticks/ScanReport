// Generates the three original letterhead concepts (A/B/C) to PNG.
// Shared brand CSS + report body live in content.mjs (single source of truth).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { baseCSS, reportBody, logoData, CHROMIUM } from './content.mjs';

const OUT = path.resolve('.');

// ---- Three letterhead concepts ----------------------------------------------
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
  <style>${baseCSS}${c.css}
    html,body{background:#6a6a6a}
    .page{margin:28px auto;box-shadow:0 10px 40px rgba(0,0,0,.45)}
  </style></head>
  <body><div class="page">${c.header}${reportBody}
    <div class="pageno">Page 1 of 3 · AKCC-2026-0017</div></div></body></html>`;

const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2 });
for (const [name, c] of Object.entries(concepts)) {
  const file = path.join(OUT, name + '.html');
  fs.writeFileSync(file, html(c));
  await page.goto('file://' + file);
  await page.waitForTimeout(150);
  await (await page.$('.page')).screenshot({ path: path.join(OUT, name + '.png') });
  console.log('rendered', name);
}
await browser.close();
console.log('done');
