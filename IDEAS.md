# AK ScanReport — Ideas / Backlog (not built yet)

Captured so nothing gets lost. Build when we roll out + tweak.

## 1. In-app "Setup QR" manager (admin-controlled)  ⟵ requested 2026-06-02

A small QR panel inside the **desktop app** the boss uses.

**Boss side (dead simple):**
- On app start, an optional **QR pops up** ("Scan to set up your reports").
- He scans it with his phone → opens the `boss-intake.html` form → taps answers → done.
- A **"✓ Done with this QR"** button to dismiss it.

**Admin side (you, Dustin):**
- **Update the QR target** anytime (point it at the intake form, a new form, or any URL).
- **Keep / Delete** the QR — keep it parked for reuse "when free," or remove it.
- **Show-at-startup** toggle on/off.
- **Regenerate** when the form/URL changes.
- Choice **persists** (localStorage / settings) so it sticks between launches.

**Build notes:** reuse existing QR code already in the app
(`src/qrcode.js`, `qr_generator.jsx`, and the "QR on report" feature) — no new
dependency needed. Form already exists at `public/boss-intake.html`
(QR → `https://scan-report.vercel.app/boss-intake.html`).

## 4. Link the Markup Color Key to the drawing-tool colors  ⟵ requested 2026-06-05 (defer to v3)

Today the editable **Markup Color Key** (`report.colorLegend`) only changes the
**printed legend**. The colors you actually *draw* with are separate:
- `ANNOTATION_COLORS` — 5 hardcoded swatches in the annotation editor.
- `DEFAULT_PRESETS` — 9 preset chips (color + tool + thickness), saved per device
  in localStorage (`ak_annotation_presets`).

**Why it's deferred (not a clean quick patch):** the systems differ in scope
(per-**report** legend vs per-**device** presets/swatches), shape (a meaning
label vs id/tool/thickness), and count (5 vs 9). A good link needs design calls:
which side is the source of truth, how 5 legend colors map onto 9 presets, and
what happens to annotations already drawn in the previous colors.

**Use case:** a client/region mandates a specific palette and wants us drawing in
their exact colors (not just printing a legend that says so).

**Quick partial — DONE 2026-06-05:** the annotation editor's draw swatches now
mirror `report.colorLegend`, so you annotate in the report's exact palette.
`AnnotationEditor` takes a `colorLegend` prop and renders legend-derived hex
swatches; the custom-color picker and per-device preset chips are unchanged, and
existing annotations are untouched.

**Still v3 (remaining):** one shared, per-report palette that ALSO drives the
preset chips (`DEFAULT_PRESETS`, currently per-device tool/thickness combos),
plus an optional "recolor existing annotations" step when the palette changes.

## 2. Commercialization ideas (placeholder — Dustin to expand)

- Re-enable account connectors when needed (Gmail = auto-email reports,
  Notion = job log, Zapier = automations, Drive = file storage).
- (Dustin has more ideas to add here later.)

## 3. Disclaimer rollout (pending boss approval)

- Recommended: **Option A** — page-1 safety banner + full disclaimer at end +
  client acknowledgment block with override capture + no-signature deemed-acceptance.
- Draft wording lives in chat; boss + counsel to approve, then drop into the
  editable disclaimer field. Build once approved.

## 5. Field / tablet use — offline PWA  ⟵ raised 2026-06-05 (future / v3)

For outdoor use on a Samsung (Android) tablet, the `.exe` doesn't apply
(Windows-only). The web build (scan-report.vercel.app) already runs in the
tablet's Chrome, so reports can be built/annotated on-site **when there's
signal**.

**Gap:** no internet on many job sites. To make it dependable outdoors:
- Turn the web app into an installable **PWA** (add to home screen, full-screen,
  app icon).
- **Offline support** — service worker caches the app shell + assets so it loads
  with no signal; report data stays in localStorage (already the case); queue
  photo/cloud sync to flush when a connection returns.
- Nice-to-have: a clear online/offline indicator and "X changes waiting to sync".

**Note:** live screen-share with Claude isn't a thing; in the field, pasting a
screenshot/photo into the Claude app (or claude.ai) on the tablet is the way to
get help on a scan or report.
