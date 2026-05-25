// Test the text-annotation inline input fix.
//   1. Upload a scan photo
//   2. Open Annotate
//   3. Pick Text tool, tap canvas, type comment, hit Enter
//   4. Verify annotation persists in report data
//   5. CRITICAL: zero prompt() dialogs should fire (would mean .exe still broken)
import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('error: ' + m.text()); });
const prompts = [];
page.on('dialog', d => {
  if (d.type() === 'prompt') { prompts.push(d.message()); d.accept(''); } else d.accept();
});

await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ak_help_autoshow', '0'); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const wn = await page.getByRole('button', { name: 'Got it', exact: true }).isVisible().catch(() => false);
if (wn) await page.getByRole('button', { name: 'Got it', exact: true }).click();
await page.waitForTimeout(200);

// Upload a scan photo. The site-diagram photo input has capture=environment.
// Find a scan photo input (one of the other file inputs).
const inputs = await page.locator('input[type=file]').all();
let scanInput = null;
for (const i of inputs) {
  const accept = await i.getAttribute('accept') || '';
  const cap = await i.getAttribute('capture');
  // Site-diagram is capture=environment, scan photo inputs are typically image accept w/o capture
  if (accept.includes('image') && cap !== 'environment') { scanInput = i; break; }
}
if (!scanInput) {
  // Fall back: any image input that's not the site one
  for (const i of inputs) {
    const accept = await i.getAttribute('accept') || '';
    if (accept.includes('image')) { scanInput = i; break; }
  }
}
if (!scanInput) throw new Error('no scan photo input found');
await scanInput.setInputFiles('/home/user/ScanReport/gssi-report-app/public/kamikaze-logo.png');
await page.waitForTimeout(1500);

// Find the 🖊 Annotate button
const annotateBtn = page.locator('button:has-text("Annotate")').first();
await annotateBtn.scrollIntoViewIfNeeded();
await annotateBtn.click();
await page.waitForTimeout(500);
console.log('Annotation editor opened');

// Pick Text tool
const textBtn = page.locator('button:has-text("T Text")');
await textBtn.click();
await page.waitForTimeout(200);
console.log('Picked Text tool');

// Tap the canvas — the AnnotationEditor renders a canvas inside its modal.
// Pick the LAST canvas (most recently mounted = editor canvas).
const canvas = page.locator('canvas').last();
await canvas.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
const cb = await canvas.boundingBox();
console.log('canvas bbox after scroll:', cb);
// Click somewhere inside the visible portion of the canvas (clamped to viewport)
const vp = page.viewportSize();
const cx = cb.x + cb.width / 2;
let cy = cb.y + cb.height / 2;
if (cy > vp.height - 20) cy = vp.height / 2;
console.log('clicking at', cx, cy);
await page.mouse.click(cx, cy);
await page.waitForTimeout(400);

// Inline input should appear — find it by placeholder
const inlineInput = page.locator('input[placeholder*="comment" i], input[placeholder*="Comment" i]').first();
const visible = await inlineInput.isVisible().catch(() => false);
console.log('inline comment input visible:', visible);
if (!visible) { console.log('FAIL: inline input not shown'); process.exit(1); }

// Type a comment and hit Enter
await inlineInput.fill('Cluster of suspect targets');
await page.waitForTimeout(150);
await inlineInput.press('Enter');
await page.waitForTimeout(300);
console.log('typed comment + Enter');

// Save the editor
const saveBtn = page.locator('button:has-text("✓ Save")').first();
await saveBtn.click();
await page.waitForTimeout(700);

// Verify the text annotation is in storage
const stored = await page.evaluate(() => {
  const id = localStorage.getItem('ak_current_report');
  const v = JSON.parse(localStorage.getItem('ak_report_' + id) || 'null');
  if (!v) return null;
  // scan photos live under report.scanPhotos[].annotations
  const all = [];
  (v.scanPhotos || []).forEach(p => (p.annotations || []).forEach(a => all.push(a)));
  return all;
});
console.log('annotations in storage:', JSON.stringify(stored, null, 2));

const textAnn = (stored || []).find(a => a.type === 'text' && a.content === 'Cluster of suspect targets');
if (!textAnn) { console.log('FAIL: text annotation not saved'); process.exit(1); }
console.log('PASS: text annotation saved with content');

if (prompts.length) {
  console.log('FAIL: prompt() fired:', prompts);
  process.exit(1);
}
console.log('PASS: zero prompt() calls (Electron-safe)');

if (errs.length) {
  console.log('JS errors:');
  for (const e of errs) console.log(' -', e);
}
console.log('\nText annotation works without prompt(). Ready to ship.');
await browser.close();
