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

## 6. Annotation overlay — make alignment structurally bulletproof (v3)  ⟵ raised 2026-06-09

**Background:** in the annotate editor the photo and the drawing surface are two
separate elements (an `<img>` and a transparent `<canvas>` stacked on top). The
canvas has to be sized to *exactly* the photo's rendered box or every mark maps
slightly off. The wrapper around them is an `inline-block` with `max-height:100%`
— a **well-known CSS trap** where the wrapper can shrink-wrap a touch
taller/wider than the actual `<img>`. That mismatch is what made the whole
overlay look shifted, and the offset baked into the saved GPR render.

**What we did (v1.0.22, shipped):** measure the image's real rendered size each
draw and pin the canvas CSS box to it, anchor it at the photo's top-left, and
re-sync via a `ResizeObserver` on the image so no layout reflow can leave a stale
box. This *neutralizes* the trap by constantly re-measuring.

**v3 — remove the trap entirely (don't just neutralize it):** the measure-and-pin
approach is robust but still relies on JS running after layout. Make it
impossible-by-construction instead:
- **Single source of geometry.** Bake the editor on the same principle as the
  saved render (`AnnotatedImage`): draw the photo + marks into ONE canvas at
  natural resolution, and do live editing on a single surface whose pixel buffer
  *is* the image — no separate `<img>` to drift from. The editor canvas becomes
  the only element; there is no wrapper box to mismatch.
- **Or** drop the wrapper trap with modern CSS: give the photo an explicit
  `aspect-ratio` box and have the canvas share the exact same grid cell
  (`display:grid; grid-area:1/1` on both img + canvas) so they're guaranteed the
  same box without `inline-block` shrink-wrap or `max-height` percentage games.
- Add a tiny **alignment self-test** (dev-only): drop a mark at a known fraction,
  read back its on-screen pixel, assert it lands within 1px of `frac * imgBox`.
  Wire it into the regression harness (`pdf-mockups/test-annotation-overflow.cjs`)
  so any future regression fails CI instead of reaching the boss.

**Why v3 not now:** the shipped fix already locks alignment; this is the
"can't-regress-by-design" hardening, and the grid/aspect-ratio rewrite touches
the editor's zoom/pan transform math, so it wants its own focused session + test
pass rather than riding along in a patch.
