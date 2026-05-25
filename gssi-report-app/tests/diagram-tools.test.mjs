// Regression test for every Site Diagram tool. Catches the "pin doesn't
// show on .exe" class of bug — we exercise each tool by tapping it,
// then tapping/dragging the canvas, then assert the report state has
// the expected entity in it.
//
// Run from the repo root with:
//   npm run dev (in another terminal)
//   node /tmp/pw/all-tools-test.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('error: ' + m.text()); });
// IMPORTANT: with the v1.0.3+ codepath there must be NO prompt() calls in
// any tool flow — Electron silently returns null and the click is dropped.
const dialogs = [];
page.on('dialog', d => {
  dialogs.push({ type: d.type(), msg: d.message() });
  if (d.type() === 'prompt') d.accept('');  // simulate Electron's null return
  else d.accept();
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

// Setup cards are collapsed by default in v1.0.6+; expand so the tier
// buttons (and Print setup) are reachable.
const setupToggle = page.locator('button:has-text("⚙ Setup")');
if (await setupToggle.isVisible().catch(() => false)) {
  await setupToggle.click();
  await page.waitForTimeout(300);
}

// Enable Zones via Full tier so the ▦ Zone button is available.
await page.locator('button:has-text("Full")').first().scrollIntoViewIfNeeded();
await page.locator('button:has-text("Full")').first().click({ force: true });
await page.waitForTimeout(400);

const canvas = page.locator('.ak-sec-diagram canvas').first();
await canvas.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
// Re-measure each iteration since selecting different tools shows/hides
// sub-toolbars (pin verdict picker, zone pattern picker) which shifts the
// canvas vertically.
const measure = async () => canvas.boundingBox();

const readReport = async () => page.evaluate(() => {
  const id = localStorage.getItem('ak_current_report');
  return JSON.parse(localStorage.getItem('ak_report_' + id) || 'null');
});

// Each tool: { name, setup (clicks the tool button + any sub-toolbar steps),
// act (clicks/drags the canvas), check(report) → string|null (null=pass) }
const tools = [
  {
    name: 'Pin core (safe)',
    setup: async () => { await page.locator('button:has-text("Pin core")').first().click(); },
    act: async () => { await page.mouse.click(CB.x + 120, CB.y + 120); },
    check: r => r.diagramPins.length === 1 && r.diagramPins[0].verdict === 'safe'
      ? null : `expected 1 safe pin, got ${JSON.stringify(r.diagramPins)}`,
  },
  {
    name: 'Pin core (caution) via verdict picker',
    setup: async () => {
      await page.locator('button:has-text("Pin core")').first().click();
      await page.locator('button:has-text("● Caution")').click();
    },
    act: async () => { await page.mouse.click(CB.x + 160, CB.y + 120); },
    check: r => r.diagramPins.length === 2 && r.diagramPins[1].verdict === 'caution'
      ? null : `expected 2nd pin caution, got ${JSON.stringify(r.diagramPins)}`,
  },
  {
    name: 'Pin core (nogo) via verdict picker',
    setup: async () => {
      await page.locator('button:has-text("Pin core")').first().click();
      await page.locator('button:has-text("● No-go")').click();
    },
    act: async () => { await page.mouse.click(CB.x + 200, CB.y + 120); },
    check: r => r.diagramPins.length === 3 && r.diagramPins[2].verdict === 'nogo'
      ? null : `expected 3rd pin nogo, got ${JSON.stringify(r.diagramPins)}`,
  },
  {
    name: 'Draw Rebar line (two-tap)',
    setup: async () => { await page.locator('button:has-text("Rebar")').first().click(); },
    act: async () => {
      await page.mouse.click(CB.x + 250, CB.y + 200);
      await page.waitForTimeout(100);
      await page.mouse.click(CB.x + 350, CB.y + 200);
    },
    check: r => r.diagramStrokes.length === 1 && r.diagramStrokes[0].color === '#FAC775'
      ? null : `expected 1 rebar stroke, got ${JSON.stringify(r.diagramStrokes)}`,
  },
  {
    name: 'Draw PT cable',
    setup: async () => { await page.locator('button:has-text("PT cable")').first().click(); },
    act: async () => {
      await page.mouse.click(CB.x + 250, CB.y + 240);
      await page.waitForTimeout(100);
      await page.mouse.click(CB.x + 350, CB.y + 240);
    },
    check: r => r.diagramStrokes.length === 2 && r.diagramStrokes[1].color === '#F09595'
      ? null : `expected PT stroke, got ${JSON.stringify(r.diagramStrokes.map(s => s.color))}`,
  },
  {
    name: 'Draw Conduit',
    setup: async () => { await page.locator('button:has-text("Conduit")').first().click(); },
    act: async () => {
      await page.mouse.click(CB.x + 250, CB.y + 280);
      await page.waitForTimeout(100);
      await page.mouse.click(CB.x + 350, CB.y + 280);
    },
    check: r => r.diagramStrokes.length === 3 && r.diagramStrokes[2].color === '#9BC5E8'
      ? null : `expected Conduit stroke, got ${JSON.stringify(r.diagramStrokes.map(s => s.color))}`,
  },
  {
    name: 'Draw Note',
    setup: async () => { await page.locator('button:has-text("Note")').first().click(); },
    act: async () => {
      await page.mouse.click(CB.x + 250, CB.y + 320);
      await page.waitForTimeout(100);
      await page.mouse.click(CB.x + 350, CB.y + 320);
    },
    check: r => r.diagramStrokes.length === 4 && r.diagramStrokes[3].color === '#5DCAA5'
      ? null : `expected Note stroke, got ${JSON.stringify(r.diagramStrokes.map(s => s.color))}`,
  },
  {
    name: 'Draw Crack (dashed)',
    setup: async () => { await page.locator('button:has-text("Crack")').first().click(); },
    act: async () => {
      await page.mouse.click(CB.x + 250, CB.y + 360);
      await page.waitForTimeout(100);
      await page.mouse.click(CB.x + 350, CB.y + 360);
    },
    check: r => r.diagramStrokes.length === 5 && r.diagramStrokes[4].dashed === true
      ? null : `expected dashed Crack stroke, got ${JSON.stringify(r.diagramStrokes.map(s => ({ c: s.color, d: s.dashed })))}`,
  },
  {
    name: 'Zone — click-drag box + custom label',
    setup: async () => {
      await page.locator('button:has-text("▦ Zone")').click();
      await page.waitForTimeout(150);
      // Box mode is the default
    },
    act: async () => {
      const sx = CB.x + 400, sy = CB.y + 200, ex = CB.x + 550, ey = CB.y + 300;
      await page.mouse.move(sx, sy);
      await page.mouse.down();
      await page.mouse.move(ex, ey, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(200);
      // Custom label via input field
      const labelInput = page.locator('input[placeholder^="Z"]').first();
      await labelInput.fill('Test Slab');
      await page.locator('button:has-text("Save zone")').click();
      await page.waitForTimeout(300);
    },
    check: r => r.diagramZones?.length === 1 && r.diagramZones[0].label === 'Test Slab'
      && r.diagramZones[0].points.length === 4
      ? null : `expected 1 zone "Test Slab" with 4 pts, got ${JSON.stringify(r.diagramZones)}`,
  },
  {
    name: 'Pick/Move — select last stroke',
    setup: async () => { await page.locator('button:has-text("✥ Pick / Move")').click(); },
    act: async () => {
      // Click on the Crack line at y=360 to select it
      await page.mouse.click(CB.x + 300, CB.y + 360);
      await page.waitForTimeout(200);
    },
    // Check via the UI: the "Delete selected line" button should appear
    check: async () => {
      const visible = await page.locator('button:has-text("Delete selected line")').isVisible().catch(() => false);
      return visible ? null : 'select did not highlight a stroke (Delete button missing)';
    },
  },
];

let CB;  // canvas bounding box — re-measured AFTER setup so sub-toolbar shifts are accounted for
for (const t of tools) {
  try {
    await t.setup();
    await page.waitForTimeout(250);  // let the sub-toolbar render and layout settle
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    CB = await measure();
    console.log(`  · ${t.name}: CB=(${CB.x.toFixed(0)},${CB.y.toFixed(0)}) ${CB.width}x${CB.height}`);
    await t.act();
    await page.waitForTimeout(800);  // 500ms localStorage debounce + headroom
    const r = await readReport();
    const result = typeof t.check === 'function'
      ? (t.check.length === 0 ? await t.check() : t.check(r))
      : null;
    if (result === null) pass(t.name);
    else fail(t.name, result);
  } catch (e) {
    fail(t.name, 'threw: ' + e.message);
  }
}

if (dialogs.length) {
  console.log('\nWARNING — prompt/confirm dialogs fired during tool tests:');
  for (const d of dialogs) console.log('  ', d.type, '·', d.msg);
  console.log('Any prompt() here means the .exe build will silently fail because Electron disables prompt(). Replace with inline UI.');
  // Treat any prompt as a regression
  for (const d of dialogs) if (d.type === 'prompt') FAILS.push('prompt() called (would silently fail in Electron): ' + d.msg);
}
if (errs.length) {
  console.log('\nJS errors:');
  for (const e of errs) console.log(' -', e);
}
if (FAILS.length) {
  console.log(`\nFAILED ${FAILS.length} of ${tools.length} tools`);
  process.exit(1);
}
console.log(`\nAll ${tools.length} diagram tools work. Ship it.`);
await browser.close();
