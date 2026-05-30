// Pure B (engineering letterhead) with subtle, PRINT-SAFE focus aids.
// Instead of a dark vignette, attention is guided by hierarchy + restraint:
//   - clean  : the baseline B, focus through whitespace + type + restrained red.
//   - aided  : a soft "lift" on the Core Clearance Findings (the part engineers
//              scan for first) plus quieted secondary chrome, so the eye flows
//              heading -> verdict pills. These aids are on-screen Preview only;
//              @media print would drop them, leaving a clean white page.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { baseCSS, reportBody, CHROMIUM } from './content.mjs';
import { concepts } from './build.mjs';

const OUT = path.resolve('.');
const B = concepts['B-engineering-letterhead'];

// Focus-aid CSS layered on top of B. Subtle on purpose.
const aidCSS = `
  /* findings = the visual anchor: faint warm lift + soft shadow (screen only) */
  table.find{background:#fffdf9;
    box-shadow:0 0 0 7px #fffdf9, 0 8px 22px rgba(0,0,0,.07);border-radius:3px}
  /* quiet the secondary chrome so it recedes */
  .pgrid .row{border-bottom-color:#eee}
  .summary{color:#3a3a3a}
  .scard .hd .m, .radar .cap{opacity:.8}
  /* let the verdict pills carry the eye — a touch more presence */
  .pill{box-shadow:0 1px 2px rgba(0,0,0,.18)}
  h2.sec{color:#000}
`;

function doc(withAids) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${baseCSS}${B.css}${withAids ? aidCSS : ''}
    html,body{background:#e9e9ea}
    .page{margin:34px auto;box-shadow:0 14px 50px rgba(0,0,0,.30)}
  </style></head><body>
    <div class="page">${B.header}${reportBody}
      <div class="pageno">Page 1 of 3 · AKCC-2026-0017</div></div>
  </body></html>`;
}

const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await browser.newPage({ viewport: { width: 900, height: 1160 }, deviceScaleFactor: 2 });
for (const [name, aids] of [['B-focus-clean', false], ['B-focus-aided', true]]) {
  const f = path.join(OUT, name + '.html');
  fs.writeFileSync(f, doc(aids));
  await page.goto('file://' + f);
  await page.waitForTimeout(150);
  await (await page.$('.page')).screenshot({ path: path.join(OUT, name + '.png') });
  console.log('rendered', name);
}
await browser.close();
console.log('done');
