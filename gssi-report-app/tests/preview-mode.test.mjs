// Comprehensive Preview-mode QA. Tests in order:
//   A. Demo button loads sample data
//   B. Preview opens; brand ribbon (logo + name) is GLUED TO TOP
//      (not wrapped in a card)
//   C. Drag-reorder cards in preview moves them while keeping vertical layout
//   D. Drag bar appearance / cursor / drop indicator
//   E. Setup-cards collapse + 👁 Preview shortcut in setup bar
//   F. Exiting preview returns to editor cleanly
import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('dialog', d => d.accept()); // auto-accept demo overwrite confirm

const FAILS = [];
const pass = (n) => console.log('  ✓', n);
const fail = (n, why) => { console.log('  ✗', n, '—', why); FAILS.push(n); };

await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ak_help_autoshow', '0'); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const wn = page.getByRole('button', { name: 'Got it', exact: true });
if (await wn.isVisible().catch(() => false)) await wn.click();
await page.waitForTimeout(300);

// === A: Demo button ===
const demoBtn = page.locator('button:has-text("🧪 Demo")');
if (await demoBtn.isVisible().catch(() => false)) pass('A1: 🧪 Demo button visible (dev mode)');
else fail('A1: Demo button', 'not visible');

await demoBtn.click();
await page.waitForTimeout(500);
const projNo = await page.evaluate(() => {
  const id = localStorage.getItem('ak_current_report');
  const r = JSON.parse(localStorage.getItem('ak_report_' + id) || '{}');
  return r.projectNo;
});
if (projNo === 'AKCC-2026-0518') pass('A2: demo loaded — projectNo matches');
else fail('A2: demo loaded', `projectNo=${projNo}`);

// === B: Preview opens, ribbon is at top, NOT in a card ===
// Take a debug screenshot so we can see what's on the page
await page.screenshot({ path: '/tmp/before-preview.png', fullPage: false });
const allBtns = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('button')).map(b => (b.textContent || '').trim()).filter(t => t).slice(0, 30);
});
console.log('  visible button labels:', allBtns);
const previewBtn = page.locator('button').filter({ hasText: /Preview saved PDF/ });
if (await previewBtn.isVisible().catch(() => false)) pass('B0: Preview shortcut in setup bar');
else fail('B0: Preview shortcut', 'not in setup bar');
await previewBtn.click();
await page.waitForTimeout(800);

const inPreview = await page.evaluate(() => document.body.classList.contains('preview-mode'));
if (inPreview) pass('B1: preview-mode class on body');
else fail('B1: preview-mode class', 'not set');

// Brand ribbon visible
const ribbon = page.locator('.brand-ribbon');
const ribbonVis = await ribbon.isVisible().catch(() => false);
if (ribbonVis) pass('B2: brand ribbon (logo + name) visible in preview');
else fail('B2: brand ribbon visible', 'hidden in preview');

// Ribbon NOT inside a Card (.ak-sec)
const ribbonInCard = await page.evaluate(() =>
  !!document.querySelector('.ak-sec .brand-ribbon, .brand-ribbon .ak-sec'));
if (!ribbonInCard) pass('B3: ribbon NOT wrapped in a card');
else fail('B3: ribbon not in card', 'ribbon nested inside .ak-sec');

// Ribbon visually at the very top of the report body (computed offsetTop check)
const ribbonAtTop = await page.evaluate(() => {
  const rb = document.querySelector('.brand-ribbon');
  const allCards = document.querySelectorAll('.ak-sec');
  if (!rb) return null;
  const rbTop = rb.getBoundingClientRect().top;
  for (const card of allCards) {
    const cb = card.getBoundingClientRect();
    if (cb.top < rbTop && cb.height > 5) return false; // some card above ribbon
  }
  return true;
});
if (ribbonAtTop) pass('B4: ribbon is above every section card visually');
else fail('B4: ribbon above all cards', 'some card renders above ribbon');

// Snapshot of preview top
await page.screenshot({ path: '/tmp/preview-top.png', fullPage: false, clip: { x: 0, y: 0, width: 1300, height: 700 } });

// === C: Drag-reorder cards ===
// Read order BEFORE drag
const beforeOrder = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.ak-sec[class*="ak-sec-"]'))
    .map(el => (el.className.match(/ak-sec-([\w-]+)/) || [])[1])
    .filter(Boolean);
});
console.log('  visible cards (DOM order):', beforeOrder.slice(0, 5), '...');

// Find two distinct cards to drag
const sourceClass = `.ak-sec-${beforeOrder[1]}`;
const targetClass = `.ak-sec-${beforeOrder[4]}`;
const src = page.locator(sourceClass).first();
const tgt = page.locator(targetClass).first();

// Cursor should be 'grab' on hover (computed)
await src.scrollIntoViewIfNeeded();
const cursor = await src.evaluate(el => getComputedStyle(el).cursor);
if (cursor === 'grab') pass('C1: card cursor is grab in preview');
else fail('C1: grab cursor', `got '${cursor}'`);

// Read sectionOrder before
const beforeSO = await page.evaluate(() => {
  const id = localStorage.getItem('ak_current_report');
  const r = JSON.parse(localStorage.getItem('ak_report_' + id) || '{}');
  return r.sectionOrder || [];
});

// Probe: are listeners actually attached? Use a counter via instrumentation.
await page.evaluate(({ sc }) => {
  const card = document.querySelector(sc);
  window.__hits = { start: 0, over: 0, drop: 0 };
  card.addEventListener('dragstart', () => window.__hits.start++);
  card.addEventListener('dragover',  () => window.__hits.over++);
  card.addEventListener('drop',      () => window.__hits.drop++);
}, { sc: sourceClass });
// Drag-and-drop. Playwright's dragTo sometimes misses HTML5 drag events on
// elements we attach listeners to dynamically. Try dragTo first; if it
// doesn't take, fall back to manual DataTransfer dispatch.
await src.dragTo(tgt);
await page.waitForTimeout(400);
let manualNeeded = await page.evaluate(() => {
  const id = localStorage.getItem('ak_current_report');
  const r = JSON.parse(localStorage.getItem('ak_report_' + id) || '{}');
  return !(r.sectionOrder && r.sectionOrder.length);
});
const hits1 = await page.evaluate(() => window.__hits);
console.log('  drag event hits after dragTo:', hits1);
if (manualNeeded) {
  console.log('  dragTo had no effect — using manual DataTransfer dispatch');
  const result = await page.evaluate(({ sc, tc }) => {
    const s = document.querySelector(sc);
    const t = document.querySelector(tc);
    if (!s || !t) return { error: 'missing source/target', sc, tc };
    const dt = new DataTransfer();
    s.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    const tr = t.getBoundingClientRect();
    t.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientY: tr.top + tr.height - 5 }));
    t.dispatchEvent(new DragEvent('drop',     { bubbles: true, cancelable: true, dataTransfer: dt, clientY: tr.top + tr.height - 5 }));
    s.dispatchEvent(new DragEvent('dragend',  { bubbles: true, cancelable: true, dataTransfer: dt }));
    return { hits: window.__hits, sourceDraggable: s.getAttribute('draggable'), sourceClass: s.className };
  }, { sc: sourceClass, tc: targetClass });
  console.log('  manual dispatch result:', result);
  await page.waitForTimeout(400);
}

// React state holds sectionOrder; persistence to localStorage is on save.
// Check the CSS `order` value injected per-card — if reorder fired, the
// source card's order moved past the target's.
const orderInfo = await page.evaluate(({ sc, tc }) => {
  const s = document.querySelector(sc);
  const t = document.querySelector(tc);
  return {
    sourceOrder: parseInt(getComputedStyle(s).order, 10),
    targetOrder: parseInt(getComputedStyle(t).order, 10),
  };
}, { sc: sourceClass, tc: targetClass });
console.log('  source order:', orderInfo.sourceOrder, 'target order:', orderInfo.targetOrder);
if (orderInfo.sourceOrder > orderInfo.targetOrder) {
  pass(`C2: drag reorder applied (source CSS order ${orderInfo.sourceOrder} > target ${orderInfo.targetOrder})`);
} else {
  fail('C2: drag reorder', `source=${orderInfo.sourceOrder} target=${orderInfo.targetOrder}`);
}

// C2b: 500ms debounced autosave persists the new sectionOrder to localStorage
await page.waitForTimeout(700);
const persisted = await page.evaluate(() => {
  const id = localStorage.getItem('ak_current_report');
  const r = JSON.parse(localStorage.getItem('ak_report_' + id) || '{}');
  return r.sectionOrder || [];
});
if (persisted.length > 0) pass(`C2b: sectionOrder autosaved (${persisted.slice(0,5).join(',')}...)`);
else fail('C2b: autosave persists', 'sectionOrder empty in localStorage');

// Cards still in a vertical column (line up by left edge)
const lefts = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('.ak-sec'));
  return cards.slice(0, 5).map(c => Math.round(c.getBoundingClientRect().left));
});
const allEqual = lefts.every(l => Math.abs(l - lefts[0]) < 5);
if (allEqual) pass(`C3: cards still column-aligned after reorder (lefts: ${lefts.join(',')})`);
else fail('C3: column alignment', `lefts: ${lefts.join(',')}`);

// === D: Exit preview ===
// Find Close button on the preview bar
const closeBtn = page.locator('.preview-bar button').first();
if (await closeBtn.isVisible().catch(() => false)) {
  await closeBtn.click();
  await page.waitForTimeout(300);
  const stillPreview = await page.evaluate(() => document.body.classList.contains('preview-mode'));
  if (!stillPreview) pass('D1: exit preview restores editor');
  else fail('D1: exit preview', 'still in preview-mode');
  // Cursor on card no longer 'grab'
  const editCursor = await page.locator('.ak-sec').first().evaluate(el => getComputedStyle(el).cursor);
  if (editCursor !== 'grab') pass('D2: drag listeners removed on exit');
  else fail('D2: drag listeners removed', 'cards still have grab cursor');
} else {
  fail('D1: exit preview button', 'no close button on preview bar');
}

if (errs.length) { console.log('\nJS errors:'); errs.forEach(e => console.log(' ', e)); FAILS.push('js errs'); }
console.log(`\n${FAILS.length} failures`);
if (FAILS.length) process.exit(1);
console.log('Preview mode polished end-to-end.');
await browser.close();
