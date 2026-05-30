// Headless smoke test: open the single-file test build via file://, confirm the
// app boots with the seeded report, and screenshot the editor for review.
import pw from '/tmp/node_modules/playwright-core/index.js';
const { chromium } = pw;
import path from 'node:path';

const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FILE = path.resolve('..', 'pdf-mockups', 'ScanReport-TEST.html');

const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await browser.newPage({ viewport: { width: 900, height: 1300 }, deviceScaleFactor: 1.5 });
const errors = [];
page.on('pageerror', e => errors.push(String(e.message)));
await page.goto('file://' + FILE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// what did the app load?
const probe = await page.evaluate(() => {
  const id = localStorage.getItem('ak_current_report');
  const rep = JSON.parse(localStorage.getItem('ak_report_' + id) || '{}');
  return {
    projectNo: rep.projectNo, client: rep.client, tier: rep.tier,
    targets: (rep.targets||[]).length, cores: (rep.cores||[]).length,
    locations: (rep.scanLocations||[]).length,
    bodyText: document.body.innerText.slice(0, 120).replace(/\n/g,' '),
  };
});
console.log('SEED ' + JSON.stringify(probe));
console.log('ERRORS ' + JSON.stringify(errors.slice(0,5)));

await page.screenshot({ path: path.resolve('..','pdf-mockups','testhtml-editor.png'), fullPage: false });

// try to open the built-in PDF preview so we can show the engineer-facing view
try {
  const btn = page.locator('button:has-text("Preview saved PDF")').first();
  if (await btn.isVisible().catch(()=>false)) {
    await btn.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.resolve('..','pdf-mockups','testhtml-preview.png'), fullPage: true });
    console.log('PREVIEW ok');
  } else {
    console.log('PREVIEW button not found');
  }
} catch (e) { console.log('PREVIEW err ' + e.message); }

await browser.close();
