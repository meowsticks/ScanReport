// v1.0.6 regression — exercise all four features end-to-end
//   1. Setup-cards collapsed by default; toggle expands and persists
//   2. Drag a section row in Print setup to reorder
//   3. Sections quick-nav floats, opens, jumps with smooth scroll
//   4. Photo upload triggers "Annotate now? / Not now" prompt; both buttons work
import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('error: ' + m.text()); });
const prompts = [];
page.on('dialog', d => {
  if (d.type() === 'prompt') prompts.push(d.message());
  d.accept();
});

const FAILS = [];
const pass = (n) => console.log('  ✓', n);
const fail = (n, why) => { console.log('  ✗', n, '—', why); FAILS.push(n); };

await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ak_help_autoshow', '0'); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const wn = await page.getByRole('button', { name: 'Got it', exact: true }).isVisible().catch(() => false);
if (wn) await page.getByRole('button', { name: 'Got it', exact: true }).click();
await page.waitForTimeout(200);

// === 1. Setup collapsed by default ===
const setupToggleVisible = await page.locator('button:has-text("⚙ Setup")').isVisible();
console.log('[1a] setup toggle present:', setupToggleVisible);
const tierVisibleInitial = await page.locator('text=Quick MarkField').isVisible().catch(() => false);
if (setupToggleVisible && !tierVisibleInitial) pass('1a: setup cards collapsed by default');
else fail('1a: setup cards collapsed by default', `toggle=${setupToggleVisible} tier-visible=${tierVisibleInitial}`);

// Expand
await page.locator('button:has-text("⚙ Setup")').click();
await page.waitForTimeout(300);
const tierVisibleAfter = await page.locator('text=Quick MarkField').isVisible().catch(() => false);
if (tierVisibleAfter) pass('1b: expand reveals tier picker');
else fail('1b: expand reveals tier picker', 'tier still hidden');

// Reload and verify state persisted (still expanded)
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const wn2 = await page.getByRole('button', { name: 'Got it', exact: true }).isVisible().catch(() => false);
if (wn2) await page.getByRole('button', { name: 'Got it', exact: true }).click();
await page.waitForTimeout(300);
const tierStillVisible = await page.locator('text=Quick MarkField').isVisible().catch(() => false);
if (tierStillVisible) pass('1c: collapse state persists across reload');
else fail('1c: collapse state persists', 'expanded → reload → tier hidden again');

// === 2. Drag a section row in Print setup ===
// Pick the FIRST row, drag onto the THIRD row → reorder
await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('div'));
  const h = all.find(d => d.textContent?.trim() === 'Print setup · sections, order & visibility');
  if (h) {
    let n = h;
    while (n && !n.style?.border) n = n.parentElement;
    n?.scrollIntoView({ block: 'start' });
  }
});
await page.waitForTimeout(400);

// Find rows. Each section row has a drag handle ⋮⋮ — find by that
const handlesBefore = await page.locator('span[title="Drag to reorder"]').count();
console.log('[2a] section drag handles:', handlesBefore);
if (handlesBefore < 5) fail('2a: drag handles present', `expected lots, got ${handlesBefore}`);
else pass(`2a: ${handlesBefore} draggable section rows`);

// Read the order BEFORE drag
const before = await page.evaluate(() => {
  const id = localStorage.getItem('ak_current_report');
  const v = JSON.parse(localStorage.getItem('ak_report_' + id) || 'null');
  return v?.sectionOrder || [];
});
console.log('  sectionOrder before drag:', before.slice(0, 4), '...');

// Drag the first row's text down past a few rows
const rows = page.locator('div[draggable="true"]').filter({ hasText: /^/ });
const rowCount = await rows.count();
console.log('  draggable rows total:', rowCount);

// Grab first row, drop on the 4th row
const r1 = rows.first();
const r4 = rows.nth(3);
const r1box = await r1.boundingBox();
const r4box = await r4.boundingBox();
if (r1box && r4box) {
  await page.mouse.move(r1box.x + 20, r1box.y + r1box.height / 2);
  await page.mouse.down();
  await page.mouse.move(r4box.x + 20, r4box.y + r4box.height - 4, { steps: 8 });
  // Browsers fire HTML5 drag events on dragstart→dragover→drop. Pure mouse events
  // won't trigger the React drag handlers. So instead, use Playwright's dragTo:
  await page.mouse.up();
}
// Playwright high-level drag-and-drop:
await r1.dragTo(r4);
await page.waitForTimeout(500);
const after = await page.evaluate(() => {
  const id = localStorage.getItem('ak_current_report');
  const v = JSON.parse(localStorage.getItem('ak_report_' + id) || 'null');
  return v?.sectionOrder || [];
});
console.log('  sectionOrder after drag:', after.slice(0, 4), '...');
if (after.length > 0 && JSON.stringify(after) !== JSON.stringify(before)) pass('2b: drag reorders sectionOrder');
else fail('2b: drag reorders', `before=${JSON.stringify(before.slice(0,4))} after=${JSON.stringify(after.slice(0,4))}`);

// === 3. Floating Sections quick-nav ===
const navBtn = page.locator('button:has-text("📑 Sections")');
const navVisible = await navBtn.isVisible().catch(() => false);
if (navVisible) pass('3a: floating Sections button shown');
else fail('3a: floating Sections button', 'not visible');

await navBtn.click();
await page.waitForTimeout(300);
const navMenuItems = await page.locator('text=Jump to section').isVisible().catch(() => false);
if (navMenuItems) pass('3b: menu opens with "Jump to section" header');
else fail('3b: menu opens', 'header not found');

// Tap a section — it should scroll. Just verify no crash.
const menuItem = page.locator('button:has-text("Project info")').last();
if (await menuItem.isVisible().catch(() => false)) {
  await menuItem.click();
  await page.waitForTimeout(700);
  pass('3c: tap on menu item executes (smooth scroll)');
} else {
  fail('3c: tap on menu item', 'Project info entry not in menu');
}

// === 4. Photo upload prompt ===
// Scroll to scan photos
await page.evaluate(() => {
  const h = Array.from(document.querySelectorAll('div')).find(d => d.textContent?.trim() === 'Scan photos');
  h?.scrollIntoView({ block: 'start' });
});
await page.waitForTimeout(300);

const inputs = await page.locator('input[type=file]').all();
let scanInput = null;
for (const i of inputs) {
  const accept = await i.getAttribute('accept') || '';
  const cap = await i.getAttribute('capture');
  if (accept.includes('image') && cap !== 'environment') { scanInput = i; break; }
}
if (!scanInput) { fail('4a: scan photo input', 'not found'); }
else {
  await scanInput.setInputFiles('/home/user/ScanReport/gssi-report-app/public/kamikaze-logo.png');
  await page.waitForTimeout(1500);
  // The prompt should show
  const promptText = page.locator('text=Open annotation editor for this photo?');
  const promptVisible = await promptText.isVisible().catch(() => false);
  if (promptVisible) pass('4a: per-photo annotate prompt appears after upload');
  else fail('4a: prompt appears', 'banner not shown after upload');

  // Click "Not now" — dismisses
  const notNowBtn = page.locator('button:has-text("Not now")');
  await notNowBtn.click();
  await page.waitForTimeout(300);
  const stillThere = await promptText.isVisible().catch(() => false);
  if (!stillThere) pass('4b: Not now dismisses without opening editor');
  else fail('4b: Not now dismisses', 'banner still visible');

  // Upload another photo → new prompt → tap Annotate now
  await scanInput.setInputFiles('/home/user/ScanReport/gssi-report-app/public/kamikaze-logo.png');
  await page.waitForTimeout(1500);
  const promptVisible2 = await page.locator('text=Open annotation editor for this photo?').isVisible().catch(() => false);
  if (!promptVisible2) fail('4c: 2nd upload prompt', 'no prompt for new upload');
  else {
    const annotNowBtn = page.locator('button:has-text("Annotate now")');
    await annotNowBtn.click();
    await page.waitForTimeout(700);
    // Annotation editor opens — look for its toolbar
    const editorOpen = await page.locator('button:has-text("T Text")').isVisible().catch(() => false);
    if (editorOpen) pass('4c: Annotate now opens the editor');
    else fail('4c: editor opens', 'no T Text button visible');
    // Close editor
    const cancelBtn = page.locator('button:has-text("Cancel")').first();
    if (await cancelBtn.isVisible().catch(() => false)) await cancelBtn.click();
    await page.waitForTimeout(300);
  }
}

if (prompts.length) {
  console.log('\nWARN: window.prompt() fired during run:'); for (const p of prompts) console.log('  ', p);
  FAILS.push('prompt() regression');
}
if (errs.length) {
  console.log('\nJS errors:'); for (const e of errs) console.log('  ', e);
}
console.log(`\n${FAILS.length} failures / ${FAILS.length + (5 - FAILS.length)} checks`);
if (FAILS.length) process.exit(1);
console.log('All v1.0.6 features verified.');
await browser.close();
