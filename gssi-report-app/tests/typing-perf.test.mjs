// Boss complained about slow typing in the .exe. Cause: every keystroke
// called setReport on the giant top-level state, which re-rendered the
// entire ~7500-line tree (incl. all section cards and embedded photos).
//
// Fix: Input/Textarea keep local state and only flush UP to the parent
// after 120ms idle or on blur. Typing only re-renders that one <input>
// until you pause.
//
// This test:
//   1. Measures wall-clock typing latency (must be reasonably fast, even
//      in dev mode with the realistic Demo report loaded).
//   2. Asserts the typed value DOES eventually reach the parent state
//      (via localStorage after the 500ms autosave debounce + buffer).
//   3. Asserts onBlur flushes immediately (no waiting for the debounce).
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('dialog', d => d.accept());

const FAILS = [];
const pass = (n) => console.log('  ✓', n);
const fail = (n, why) => { console.log('  ✗', n, '—', why); FAILS.push(n); };

await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ak_help_autoshow', '0'); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const wn = page.getByRole('button', { name: 'Got it', exact: true });
if (await wn.isVisible().catch(() => false)) await wn.click();
await page.waitForTimeout(200);

// Load demo so DOM is realistic-size
await page.locator('button:has-text("🧪 Demo")').click();
await page.waitForTimeout(600);

// Find the first real text input
const inputs = await page.locator('input').all();
let target = null;
for (const i of inputs) {
  const t = await i.getAttribute('type');
  if (!t || t === 'text') { target = i; break; }
}
if (!target) { fail('typing-perf', 'no text input on page'); process.exit(1); }
await target.scrollIntoViewIfNeeded();
await target.click();
await target.fill(''); // clear first

// === 1. Typing latency ===
const text = 'The quick brown fox jumped over the lazy dog forty seven';
const start = Date.now();
for (const ch of text) await page.keyboard.type(ch, { delay: 0 });
const elapsed = Date.now() - start;
const perKey = elapsed / text.length;
// In dev mode on this Chromium harness, baseline (no debounce) was ~10
// ms/key with the demo report loaded. Debounced should be well under 5.
// Set the gate at 6 ms to leave headroom for slower CI nodes.
console.log(`  typed ${text.length} chars in ${elapsed} ms (${perKey.toFixed(1)} ms/keystroke)`);
if (perKey < 6) pass(`typing fast (${perKey.toFixed(1)} ms/keystroke)`);
else fail('typing fast', `${perKey.toFixed(1)} ms/keystroke is too slow`);

// === 2. Value reaches parent state after pause + autosave (debounce 120 + autosave 500) ===
await page.waitForTimeout(900);
const persistedValue = await page.evaluate(() => {
  const id = localStorage.getItem('ak_current_report');
  const r = JSON.parse(localStorage.getItem('ak_report_' + id) || '{}');
  // Pull every string field and see which one ends with our marker
  return Object.entries(r).find(([_, v]) => typeof v === 'string' && v.includes('forty seven'))?.[1] || null;
});
if (persistedValue && persistedValue.includes('forty seven')) pass(`autosave persisted typed text (${persistedValue.slice(0, 50)}...)`);
else fail('autosave persisted', `not found in localStorage`);

// === 3. onBlur flushes immediately ===
await target.fill('');                  // clear via fill (synthetic, no debounce)
await target.click();
await page.keyboard.type('blur-flush-marker-zzz', { delay: 0 });
// Don't wait for debounce — click somewhere else to trigger blur
await page.locator('body').click({ position: { x: 1, y: 1 } });
await page.waitForTimeout(600); // give the autosave 500ms timer time to fire
const blurValue = await page.evaluate(() => {
  const id = localStorage.getItem('ak_current_report');
  const r = JSON.parse(localStorage.getItem('ak_report_' + id) || '{}');
  return Object.entries(r).find(([_, v]) => typeof v === 'string' && v.includes('blur-flush-marker-zzz'))?.[1] || null;
});
if (blurValue && blurValue.includes('blur-flush-marker-zzz')) pass('onBlur flushes immediately');
else fail('onBlur flush', 'marker not persisted');

if (errs.length) { console.log('JS errors:'); errs.forEach(e => console.log(' ', e)); FAILS.push('js errors'); }
console.log(`\n${FAILS.length} failures`);
if (FAILS.length) process.exit(1);
console.log('Typing is fast and inputs persist correctly.');
await browser.close();
