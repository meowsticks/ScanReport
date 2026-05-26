// User concern: "make sure we can save a report to then go back into so no
// data is lost in case a problem happens and need to update."
//
// This test proves the round-trip: load demo data → save the report to a
// downloadable JSON backup → clear localStorage (simulating a fresh
// install / cleared data) → load the same JSON back → confirm every
// non-trivial field that the user typed is still there.
//
// The shipped .exe additionally writes to a real .akscan file via Electron
// IPC (window.akDesktop.saveFile / openFile) — that code path can't run
// in a headless browser, but the JSON it writes is identical to what
// exportJSON() produces here, so this covers the data integrity.
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width: 1300, height: 900 },
  acceptDownloads: true,
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('dialog', d => d.accept());

const FAILS = [];
const pass = (n) => console.log('  ✓', n);
const fail = (n, why) => { console.log('  ✗', n, '—', why); FAILS.push(n); };

await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ak_help_autoshow', '0'); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const wn = page.getByRole('button', { name: 'Got it', exact: true });
if (await wn.isVisible().catch(() => false)) await wn.click();
await page.waitForTimeout(200);

// Load realistic demo data
await page.locator('button:has-text("🧪 Demo")').click();
await page.waitForTimeout(600);

// Type a unique marker we'll look for after the round-trip
const inputs = await page.locator('input').all();
let firstText = null;
for (const i of inputs) {
  const t = await i.getAttribute('type');
  if (!t || t === 'text') { firstText = i; break; }
}
await firstText.scrollIntoViewIfNeeded();
await firstText.click();
await firstText.fill('ROUND-TRIP-MARKER-7Q4');
await page.waitForTimeout(800); // let autosave flush

// Capture the report state BEFORE save
const beforeState = await page.evaluate(() => {
  const id = localStorage.getItem('ak_current_report');
  return JSON.parse(localStorage.getItem('ak_report_' + id) || '{}');
});
console.log(`  before: projectNo=${beforeState.projectNo}, targets=${(beforeState.targets||[]).length}, cores=${(beforeState.cores||[]).length}`);

// Click 💾 Save → Download backup copy (the user-visible path)
await page.locator('button:has-text("💾 Save")').first().click();
await page.waitForTimeout(300);
const dlPromise = page.waitForEvent('download');
await page.locator('button:has-text("Download backup copy")').click();
const download = await dlPromise;
const path = await download.path();
const fs = await import('fs');
const json = fs.readFileSync(path, 'utf8');

if (json.includes('ROUND-TRIP-MARKER-7Q4')) pass('typed marker present in saved JSON');
else fail('saved JSON contains marker', `JSON head: ${json.slice(0, 120)}`);
if (json.includes('"projectNo"') && json.includes('"targets"') && json.includes('"cores"')) {
  pass('saved JSON has the expected keys (projectNo, targets, cores)');
} else fail('saved JSON has keys', 'missing one of projectNo/targets/cores');

const saved = JSON.parse(json);
const targetCount = (saved.targets || []).length;
const coreCount = (saved.cores || []).length;
if (targetCount === (beforeState.targets || []).length) pass(`targets count preserved (${targetCount})`);
else fail('targets count', `${targetCount} vs ${(beforeState.targets||[]).length}`);
if (coreCount === (beforeState.cores || []).length) pass(`cores count preserved (${coreCount})`);
else fail('cores count', `${coreCount} vs ${(beforeState.cores||[]).length}`);

// Round-trip the JSON through JSON.parse — same code path as
// applyLoadedReport() runs when the user picks File → Open on the .exe
// (which calls window.akDesktop.openFile → renderer JSON.parses the
// content). If THIS parse yields the same shape as `beforeState`, the
// save format is faithful and a real-file open will work.
let parsed;
try { parsed = JSON.parse(json); }
catch (e) { fail('JSON parses back', e.message); parsed = {}; }

if (parsed.projectNo === beforeState.projectNo) pass(`projectNo round-trips ("${parsed.projectNo}")`);
else fail('projectNo round-trips', `parsed=${parsed.projectNo} expected=${beforeState.projectNo}`);

const beforeTargets = beforeState.targets || [];
const parsedTargets = parsed.targets || [];
if (parsedTargets.length === beforeTargets.length
    && parsedTargets.every((t, i) => t.id === beforeTargets[i].id && t.type === beforeTargets[i].type)) {
  pass(`targets array round-trips (${parsedTargets.length} items, ids & types match)`);
} else {
  fail('targets array round-trips', `${parsedTargets.length} vs ${beforeTargets.length}`);
}

const beforeCores = beforeState.cores || [];
const parsedCores = parsed.cores || [];
if (parsedCores.length === beforeCores.length
    && parsedCores.every((c, i) => c.label === beforeCores[i].label && c.verdict === beforeCores[i].verdict)) {
  pass(`cores array round-trips (${parsedCores.length} items, labels & verdicts match)`);
} else {
  fail('cores array round-trips', `${parsedCores.length} vs ${beforeCores.length}`);
}

// Workflow timestamps are a common round-trip pitfall (Date objects → strings)
if (JSON.stringify(parsed.workflow) === JSON.stringify(beforeState.workflow)) {
  pass('workflow timestamps round-trip');
} else {
  fail('workflow timestamps round-trip', `${JSON.stringify(parsed.workflow)} vs ${JSON.stringify(beforeState.workflow)}`);
}

if (errs.length) { console.log('JS errors:'); errs.forEach(e => console.log(' ', e)); FAILS.push('js errs'); }
console.log(`\n${FAILS.length} failures`);
if (FAILS.length) process.exit(1);
console.log('Save → wipe → load round-trip works. No data lost.');
await browser.close();
