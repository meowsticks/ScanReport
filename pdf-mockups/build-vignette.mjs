// Centered hybrid letterhead (B's polish + C's centering & spine) shown three ways:
//   1. flat clean page (what actually prints / gets emailed),
//   2. inside a SOFT vignette matte (subtle focus surround for on-screen Preview),
//   3. inside a STRONG vignette matte (more cinematic focus).
// The vignette lives in the viewing surround only — the page stays pristine white,
// so the printed/emailed PDF is unaffected. Like a photo in a dark mat.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { baseCSS, reportBody, logoData, CHROMIUM } from './content.mjs';

const OUT = path.resolve('.');

// Centered hybrid masthead: centered mascot + name + red sub-rule + centered meta,
// plus C's slim red side-spine carrying company name + page indicator.
const headerCSS = `
  .page{padding-right:0.95in}            /* room for the spine */
  .lh{text-align:center;padding-bottom:11px;border-bottom:2px solid var(--ink);margin-bottom:4px}
  .lh img{height:86px;width:auto;display:block;margin:0 auto 6px;
    filter:drop-shadow(0 1px 2px rgba(0,0,0,.18))}
  .lh .nm{font-size:17pt;font-weight:800;letter-spacing:.06em;text-transform:uppercase;line-height:1}
  .lh .sub{font-size:8.5pt;color:var(--red);letter-spacing:.2em;text-transform:uppercase;margin-top:4px}
  .lh .meta{display:flex;justify-content:center;gap:22px;font-size:8pt;color:var(--faint);margin-top:8px}
  .lh .meta b{color:var(--mut)}
  .spine{position:absolute;top:0;right:0;bottom:0;width:0.5in;background:var(--red);color:#fff;
    display:flex;align-items:center;justify-content:center}
  .spine span{writing-mode:vertical-rl;transform:rotate(180deg);font-size:8.5pt;
    letter-spacing:.22em;text-transform:uppercase;font-weight:700}
  .spine .pg{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);font-size:8pt}
`;

const header = `
  <div class="spine"><span>Aggarwal Kamikazes · GPR Scan Report</span><div class="pg">1 / 3</div></div>
  <div class="lh">
    <img src="${logoData}" alt="">
    <div class="nm">Aggarwal Kamikazes</div>
    <div class="sub">Cutting &amp; Coring Ltd · GPR Scan Report</div>
    <div class="meta"><span><b>Project</b> AKCC-2026-0017</span>
      <span><b>Operator</b> D. Cunningham</span><span><b>Date</b> 2026-05-28</span></div>
  </div>`;

const pageHTML = `<div class="page">${header}${reportBody}
  <div class="pageno">Page 1 of 3 · AKCC-2026-0017</div></div>`;

// vignette: 'none' | 'soft' | 'strong' — controls only the surround behind the page
function doc(vignette) {
  const stages = {
    none:   { bg:'#e9e9ea', vig:'transparent' },
    soft:   { bg:'#3a3a3c', vig:'radial-gradient(ellipse 70% 65% at 50% 42%, rgba(0,0,0,0) 35%, rgba(0,0,0,.45) 100%)' },
    strong: { bg:'#242426', vig:'radial-gradient(ellipse 62% 58% at 50% 40%, rgba(0,0,0,0) 22%, rgba(0,0,0,.78) 100%)' },
  }[vignette];
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${baseCSS}${headerCSS}
    html,body{background:${stages.bg}}
    .stage{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:46px 0;position:relative}
    .stage::after{content:"";position:fixed;inset:0;pointer-events:none;background:${stages.vig}}
    .page{box-shadow:0 18px 60px rgba(0,0,0,.55);position:relative;z-index:1}
  </style></head><body><div class="stage">${pageHTML}</div></body></html>`;
}

const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await browser.newPage({ viewport: { width: 1120, height: 1380 }, deviceScaleFactor: 2 });

// 1. flat clean page only (crop to the page element = the real printable artifact)
fs.writeFileSync(path.join(OUT, 'D-centered-hybrid.html'), doc('none'));
await page.goto('file://' + path.join(OUT, 'D-centered-hybrid.html'));
await page.waitForTimeout(150);
await (await page.$('.page')).screenshot({ path: path.join(OUT, 'D-centered-hybrid.png') });
console.log('rendered D-centered-hybrid (flat)');

// 2 & 3. full-viewport shots showing the vignette matte around the page
for (const v of ['soft', 'strong']) {
  const f = path.join(OUT, `D-vignette-${v}.html`);
  fs.writeFileSync(f, doc(v));
  await page.goto('file://' + f);
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, `D-vignette-${v}.png`) });
  console.log('rendered D-vignette-' + v);
}

await browser.close();
console.log('done');
