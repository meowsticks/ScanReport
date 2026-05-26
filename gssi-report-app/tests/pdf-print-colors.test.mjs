// Saved PDFs were rendering with the dark theme bleeding through — entire
// pages of black background with a tiny content card in the middle. This
// regression test forces print emulation (what Electron printToPDF does)
// and confirms shell/cards/text use white-on-black, not dark-on-dark.
//
// Background: cards have inline `background: c.card` (dark hex) which
// beats CSS unless overridden with !important. The bug also had
// `@media print { ... }` closing one rule too early so the page-break
// rules weren't being applied.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ak_help_autoshow', '0'); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const gotIt = page.getByRole('button', { name: 'Got it', exact: true });
if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
await page.waitForTimeout(300);

const setupToggle = page.locator('button:has-text("⚙ Setup")');
if (await setupToggle.isVisible().catch(() => false)) {
  await setupToggle.click();
  await page.waitForTimeout(300);
}
await page.locator('button:has-text("Full")').first().click({ force: true });
await page.waitForTimeout(400);

const FAILS = [];
const pass = (n) => console.log('  ✓', n);
const fail = (n, why) => { console.log('  ✗', n, '—', why); FAILS.push(n); };

// === PRINT MODE ===
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(400);

const shellBg = await page.evaluate(() =>
  getComputedStyle(document.querySelector('.ak-shell')).backgroundColor);
if (shellBg === 'rgb(255, 255, 255)') pass('print: shell white');
else fail('print: shell white', `got ${shellBg}`);

const cardBg = await page.evaluate(() =>
  getComputedStyle(document.querySelector('.ak-sec')).backgroundColor);
if (cardBg === 'rgb(255, 255, 255)') pass('print: first .ak-sec white');
else fail('print: first .ak-sec white', `got ${cardBg}`);

const h2Color = await page.evaluate(() =>
  getComputedStyle(document.querySelector('.ak-sec h2')).color);
if (h2Color === 'rgb(0, 0, 0)') pass('print: card title black');
else fail('print: card title black', `got ${h2Color}`);

// Markup color key card was missing .ak-sec class — must be wrapped too
const colorKeyBg = await page.evaluate(() => {
  const el = document.querySelector('.ak-sec-colorLegend');
  return el ? getComputedStyle(el).backgroundColor : 'NO_CARD';
});
if (colorKeyBg === 'rgb(255, 255, 255)') pass('print: markup color key white');
else fail('print: markup color key white', `got ${colorKeyBg}`);

// Generate an actual PDF and check it's not microscopic (which it would be
// if the entire shell was empty/dark)
const buf = await page.pdf({ format: 'Letter', printBackground: true });
if (buf.length > 50000) pass(`print: PDF has content (${buf.length} bytes)`);
else fail('print: PDF has content', `tiny ${buf.length} bytes`);

// === PREVIEW MODE === (engineer hits 👁 Preview button)
await page.emulateMedia({ media: 'screen' });
await page.evaluate(() => { document.body.classList.add('preview-mode'); });
await page.waitForTimeout(300);

const pvShell = await page.evaluate(() =>
  getComputedStyle(document.querySelector('.ak-shell')).backgroundColor);
if (pvShell === 'rgb(255, 255, 255)') pass('preview: shell white');
else fail('preview: shell white', `got ${pvShell}`);

const pvCard = await page.evaluate(() =>
  getComputedStyle(document.querySelector('.ak-sec')).backgroundColor);
if (pvCard === 'rgb(255, 255, 255)') pass('preview: .ak-sec white');
else fail('preview: .ak-sec white', `got ${pvCard}`);

const pvTitle = await page.evaluate(() =>
  getComputedStyle(document.querySelector('.ak-sec h2')).color);
if (pvTitle === 'rgb(0, 0, 0)') pass('preview: card title black');
else fail('preview: card title black', `got ${pvTitle}`);

if (errs.length) { console.log('JS errs:'); errs.forEach(e => console.log(' ', e)); FAILS.push('js errors'); }
console.log(`\n${FAILS.length} failures / 8 checks`);
if (FAILS.length) process.exit(1);
console.log('Print & Preview both render as polished white pages.');
await browser.close();
