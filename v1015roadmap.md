# AK ScanReport — v1.0.15 Roadmap

> Current shipping: **v1.0.14**. This document captures the v1.0.15 plan as refocused on 2026-05-27 around **PDF polish for engineer-ready reports**. Static HTML mockups live at [`v1015-mockups/`](./v1015-mockups/index.html).

## Refocus — v1.0.15 is "PDF Polish"

The earlier plan (project numbers, autocomplete, DRAFT watermark) had one weak link: **autocomplete** is unrelated to the PDF surface and can land any time. The other two features both touch PDF rendering, and the moment we're modifying the print/export layer is the right time to deliver the highest-leverage missing piece: **a branded letterhead that doesn't move, and scan cards that don't get cut across page boundaries**.

A scan report that gets emailed to a structural engineer needs to look produced. v1.0.14 prints clean black-on-white but has no logo, no fixed letterhead, and cards can split mid-content across pages. v1.0.15 fixes all three.

**Autocomplete moves to v1.0.16.** Not abandoned — just decoupled from this release.

## Scope (4 features, all PDF/branding layer)

Branded letterhead, page-break-safe cards with taller photos, DRAFT watermark, and a vertical side spine (right-edge default) that carries both the company name and the page indicator. The bottom footer band that earlier drafts of this roadmap proposed has been dropped — pagination moved to the spine, vertical space goes to the scan photos.

**Color note.** The report body already uses color semantically: black for top bar (rebar), blue for bottom bar, red for conduit and no-scan zones (where the scanner couldn't reach). The letterhead/footer chrome must NOT introduce a competing color accent — it would compete with the scan grammar. v1.0.15 uses **neutral black/dark gray** for the letterhead rule, footer rule, and project number. Brand identity comes from the logo and (optionally) the side spine, not from a colored accent.

**Tier label customization** was previewed in [mockup 05](./v1015-mockups/05-branding-customization.html) but defers to v1.0.16 — it touches the data model and every scan card render, so it ships alone.

### 1. Branded letterhead — fixed at top of every page

A configurable letterhead that renders identically on every PDF page and in print preview. Logo + company info + per-report project number + operator name, all in one band that stays put while the report content scrolls underneath.

**Letterhead contents (per user selection):**

- **Logo** — user-uploadable PNG or SVG, persisted as base64. Settings → "Company Letterhead" panel. Round 60–64px slot in the letterhead, 24–28px round in the footer. Aspect-ratio preserved via `object-fit: contain` inside a circular mask.
  - **Production asset:** the **full** Aggarwal Kamikazes logo as supplied — mascot + gear + spinning saw with the chrome wordmark and ribbon banner beneath. One file is enough; the renderer scales it into both slots. The wordmark beneath the mascot becomes small at footer size (24×28px) but that's the design call — the mark stays recognizable by silhouette and color, and the typeset company name in the letterhead/footer carries the readable wordmark job.
  - Mockup HTML references `docs/v1015-mockups/assets/logo.png` directly; production app reads the user-uploaded file from settings.
- **Company name (primary)** — `"Aggarwal Kamikazes"` by default. Bebas Neue display face, large, uppercase, letter-spaced — mirrors the chrome wordmark style in the logo itself.
- **Company name (secondary)** — `"Cutting and Coring Ltd."` by default. Bebas Neue, smaller, brown (`#5b2c0a`), letter-spaced — mirrors the ribbon banner style in the logo. Optional field; set empty to render only the primary line.
- **Tagline** — small italic strap under the company name (default `"— Shut up and cut straight"` for AK). 10pt, muted gray, italic with leading em-dash. Editable; set empty to hide.
- **Project number** — `AKCC-{YYYY}-{####}` (was the standalone feature; now lives inside the letterhead). Auto-generated per-year sequential, editable via pencil affordance. Top-right corner of the letterhead.
- **Address** — single line, 9pt grey (`#525252`).
- **Phone & email** — single line, 9pt grey, separated by " · ".
- **Operator name** — right-aligned under the project number, "Operator: {operator}" in 9pt grey. The `{operator}` value is **per-report**: filled in by whoever creates the scan, not a global "my name" setting on the app. New reports leave the field blank and prompt for it (or pre-fill from the most-recently-used value if the user opts into that convenience). No baked-in default operator name.

**Layout:**

```
┌──────────────────────────────────────────────────────────────────┐
│ [MARK]  AGGARWAL KAMIKAZES                AKCC-2026-0017         │
│         CUTTING AND CORING LTD.           Operator: D. Cunningham│
│         — Shut up and cut straight                               │
│         123 Industrial Way, Toronto ON  M1A 1A1                  │
│         (416) 555-0199 · contact@aggarwalkamikazes.ca            │
│  ════════════════════════════════════════════════════════════════│
└──────────────────────────────────────────────────────────────────┘
                          (scan content below)
```

**Implementation steps (tentative — confirm paths against the real ScanReport repo):**

1. **Settings panel** (`components/SettingsPanel` or wherever existing prefs live):
   - "Company Letterhead" section with: logo upload, company name, address, phone, email, default operator name.
   - Logo upload validates ≤ 200 KB after base64 encoding (anything bigger blows up localStorage and slows PDF render).
   - Store under one localStorage key: `akscan.letterhead.v1` as a JSON blob. Versioned key so future changes can migrate.
2. **`lib/letterhead.ts`** — typed helper:
   ```ts
   export interface Letterhead {
     logoDataUrl?: string;        // base64 PNG/SVG
     companyName: string;
     addressLine: string;
     phone: string;
     email: string;
     defaultOperator: string;
   }
   export function getLetterhead(): Letterhead;
   export function setLetterhead(l: Letterhead): void;
   ```
3. **Per-report fields** — add to report model:
   - `projectNumber?: string` (lives in the letterhead band, top-right)
   - `operator?: string` (defaults to `letterhead.defaultOperator` on new report)
4. **`<LetterheadBand>`** component — pure, takes `Letterhead + projectNumber + operator`, renders the band. Used in both screen preview and the PDF render tree.
5. **Fixed-on-every-page rendering:**
   - For browser print path (`window.print()` based): use CSS `@page` + `position: running(header)` with `@top-center` content. Modern Chromium (Electron) supports this; the renderer must wrap the band in `<div style="position: running(header)">` and reference it from `@page { @top-center { content: element(header); }}`.
   - **Fallback** if `position: running` is unreliable in the project's Electron version: place the band inside a `<header>` element with `position: fixed; top: 0; left: 0; right: 0;` in print CSS only. Verify by 3-page export.
6. **Project-number helper** (carried over from the previous plan):
   - `peekNextProjectNumber(year)` / `commitProjectNumber(value)` in `lib/projectNumber.ts`
   - Per-year counter at `localStorage["akscan.projectNo." + year]`
   - Filename builder prefixes both `.akscan` and `.pdf`: `${projectNumber}_${slug(site)}.pdf`

**Edge cases:**

- **No logo uploaded** — render an empty 60×60 slot or omit the slot entirely (decision: omit, so the text band is centered). Don't render a "no logo" placeholder.
- **Tall/narrow logo (e.g., 200×60)** — fit-within the 60×60 box preserving aspect ratio. CSS: `object-fit: contain`.
- **Very long company name** — single-line truncate with ellipsis at the screen preview; allow wrap in PDF (PDF has more horizontal room).
- **Letterhead disabled entirely** — power-user option in Settings to "Disable letterhead" for plain reports. When off, the band doesn't render and existing v1.0.14 layout is preserved.
- **Letterhead bigger than ~120px tall** — clamp height; if user uploads a giant logo it gets capped, not allowed to push content down.
- **Project-number override** — backfilling `AKCC-2025-0099` in 2026 does not bump the 2026 counter (only same-year matches counter-bump).

**Acceptance criteria:**

- [ ] Settings → Company Letterhead saves and persists across restarts
- [ ] Logo upload accepts PNG and SVG, rejects > 200 KB
- [ ] Letterhead renders on every page of a 3+ page PDF (fixed, not scrolling)
- [ ] Project number auto-generates on new report, editable, prefixes filenames
- [ ] Operator name defaults from letterhead settings, per-report override allowed
- [ ] Disabling letterhead in settings yields v1.0.14-style plain output
- [ ] Letterhead does not violate `pdf-print-colors.test.mjs` (white paper, black text, brand-red accent OK)

**Touches:** Settings panel, new `lib/letterhead.ts`, new `lib/projectNumber.ts`, new `<LetterheadBand>` component, print CSS (`@page` + running header or fixed fallback), report data model (`projectNumber`, `operator`), filename builder.

**Tests at risk:** `pdf-print-colors.test.mjs` (new band; ensure white/black/brand-red preserved), `save-load-roundtrip.test.mjs` (`projectNumber` + `operator` round-trip).

### 2. Page-break-safe scan cards

Today, scan cards can split across PDF page breaks — half a card on page 2, the other half on page 3. Engineers reading the report lose context. v1.0.15 makes cards atomic by default, and shows a visible page-break line in preview so the user can fine-tune with drag-reorder (already supported per v1.0.6 lock-in).

**Two-part behavior:**

1. **Auto-keep-whole (CSS):** every scan card gets `break-inside: avoid; page-break-inside: avoid;` in print CSS. If a card doesn't fit in the remaining space on a page, it gets pushed to the next page. Whitespace at the page bottom is acceptable — it's the cleanest read.
2. **Visible page-break indicator in preview:** the preview shows a horizontal dashed line wherever a page break will land. User sees exactly where pages split. If they want different ordering (e.g., move a small card up to fill the gap), they drag-reorder cards as they already can — and the break indicator updates live.

**Implementation steps (tentative):**

1. **Print CSS:**
   ```css
   @media print {
     .ak-scan-card { break-inside: avoid; page-break-inside: avoid; }
     .ak-letterhead { position: running(header); }
     @page { @top-center { content: element(header); } margin-top: 1.2in; }
   }
   ```
2. **Preview page-break indicator** — new component `<PageBreakOverlay>`:
   - Measures the rendered card list (via `ResizeObserver` or `useLayoutEffect`) and computes where page breaks will land based on:
     - Letter paper height (11" / ~1056px at 96 DPI)
     - Top margin reserved for letterhead (~115px)
     - Bottom margin (~50px)
   - Renders a horizontal dashed line + small "Page 2 →" label at each break point.
   - Listens to drag-reorder events so the line updates as the user moves cards.
3. **Card boundary helper** `lib/pageBreaks.ts`:
   ```ts
   export interface PageBreak { yPx: number; nextPageIndex: number; }
   export function computePageBreaks(cardRects: DOMRect[], pageHeightPx: number, topMarginPx: number, bottomMarginPx: number): PageBreak[];
   ```
   Pure function — no DOM access. Card rects come from caller via `getBoundingClientRect()`. Easily unit-tested.
4. **Preview-only** — the indicator does NOT render in the actual PDF. It's a UX aid for the editor, nothing more.
5. **Snap-to-break (optional polish)** — when dragging a card, snap its drop position to the nearest break line if within ~10px. Defer if time-constrained; auto-keep-whole alone solves the cut-off problem.

**Edge cases:**

- **Card taller than a page** (huge photo + long comment) — `break-inside: avoid` can't help. Fall back to splitting; warn in preview with a yellow caution badge on that card ("This card exceeds one page and will split. Consider splitting it manually.").
- **Letterhead-disabled mode** — page-break math must account for top margin = 0.5" instead of ~1.2". The helper takes `topMarginPx` as a parameter precisely so this is configurable.
- **Window resize during preview** — debounce the break recompute; 100ms is plenty.
- **Different paper sizes** — current scope is Letter (11×8.5"). If A4 is on the roadmap, add a paper-size setting later; v1.0.15 hardcodes Letter.
- **Drag-reorder + break indicator** — make sure the break overlay's z-index sits above cards but below the drag ghost.

**Acceptance criteria:**

- [ ] No scan card is split across a PDF page boundary (3-page test export)
- [ ] Preview shows dashed line + "Page N →" label at each break
- [ ] Drag-reordering a card updates the break indicator live
- [ ] Oversized cards show a warning badge in preview
- [ ] Letterhead-disabled mode recomputes breaks with smaller top margin
- [ ] `preview-mode.test.mjs` still passes

**Touches:** print CSS, new `<PageBreakOverlay>` component, new `lib/pageBreaks.ts` helper, preview page (`pages/preview` or wherever), scan card component (add `.ak-scan-card` class if not present).

**Tests at risk:** `preview-mode.test.mjs` (the overlay must not break existing preview assertions), `diagram-tools.test.mjs` (unchanged — diagram tools don't touch print layout, but verify), `pdf-print-colors.test.mjs` (white space at page bottom is fine; verify no color regressions).

### 3. DRAFT watermark on un-issued PDFs

Unchanged from the previous plan — we're already in the PDF rendering layer for the other two features, so adding the watermark here costs almost nothing extra.

- Per-report `status: "draft" | "issued"` flag, default `"draft"`.
- PDF export adds a diagonal "DRAFT" SVG text overlay across each page when `status === "draft"`. Color `#9ca3af` at 18% opacity, rotated −30°, centered.
- Toolbar button "Mark as Issued" flips the flag; re-export drops the watermark. Re-marking as draft is allowed.
- Additive layer only — does not change paper color, text color, or brand-red headers.

**Implementation steps (tentative):**

1. Add `status: "draft" | "issued"` to the report data model. Default `"draft"` on new reports. Treat missing field as `"draft"` on legacy loads.
2. PDF export adds a watermark layer:
   ```html
   <div class="ak-watermark" data-status="draft">
     <svg viewBox="0 0 100 130" preserveAspectRatio="xMidYMid meet">
       <g transform="rotate(-30 50 65)">
         <text x="50" y="70" text-anchor="middle"
               font-family="Helvetica, Arial, sans-serif"
               font-size="24" font-weight="800" letter-spacing="2"
               fill="#9ca3af" fill-opacity="0.18">DRAFT</text>
       </g>
     </svg>
   </div>
   ```
   - `position: absolute; inset: 0; pointer-events: none; z-index: 1` (must sit ABOVE content, BELOW letterhead band)
   - One instance per page (same as letterhead)
3. Toolbar: status pill (Draft amber / Issued green) + "Mark as Issued" toggle.
4. Persist `status` via existing save/load.

**Edge cases & acceptance:** same as the previous plan — see the v1.0.15 plan history if needed. Key items:

- [ ] Multi-page PDFs show watermark on every page
- [ ] Watermark sits between letterhead and content (z-index correct)
- [ ] Legacy reports default to draft
- [ ] `pdf-print-colors.test.mjs` extended with status-conditional assertion

**Touches:** PDF export module, report toolbar, save/load (`status` field), report data model.

**Tests at risk:** `pdf-print-colors.test.mjs`.

### 4. Vertical side spine — company name + page indicator on the outer edge

Confirmed for v1.0.15 with the right edge as the default position. Carries both the company name and the page indicator, replacing what was previously a bottom footer band. Edge is configurable in Settings (left/right).

- Vertical band (~24px wide) along the right edge of every page by default. Black background, white text.
- **Stacked page indicator at the top** of the spine: current page number above a short divider rule, total pages below. Reads as `1 / — / 2`. Monospace font for clean number alignment.
- **Company name fills the rest** of the spine, `writing-mode: vertical-rl` so it reads top-to-bottom on the right (industrial-drawing convention).
- No separate "show footer" toggle — pagination is intrinsic to the spine; turning the spine off would leave the report with no page count. The spine is mandatory; only its edge is configurable.

**Why no bottom footer band:** the earlier draft included one. The footer was carrying logo + company + project + operator + date + page count — but every value except `{date}` was already in the letterhead, so the footer was duplicating. Dropping it gives ~50px of vertical space back to the scan cards (taller photos, more breathable layout) and keeps the report frame tighter. Pagination moves to the spine where it's always visible without competing with content.

**Implementation steps (tentative):**

1. Add `sideSpinePosition: "left" | "right"` to the `Letterhead` blob (default `"right"`). No enable/disable toggle — spine is always on.
2. `<SideSpine>` component — fixed-position vertical band, two children: `<PageIndicator>` (top) and `<SpineLabel>` (fills remaining space).
3. `<PageIndicator>` — renders current page / divider / total. In print CSS use `counter(page)` and `counter(pages)`; in browser preview, fed by the `useCurrentPage` hook the preview already has.
4. `<SpineLabel>` — uses `writing-mode: vertical-rl` for right edge (reads top-to-bottom), `vertical-rl` + `rotate(180deg)` for left edge (reads bottom-to-top).
5. Print CSS: `position: fixed; top: 0; bottom: 0; right: 0; width: 24px;` — fixed band pins to every page. Page-counter values pulled in via `content: counter(page)` inside the indicator.
6. `computePageBreaks`: subtract 24px from horizontal card width on whichever edge the spine sits, so cards don't overlap. Vertical card space gets the freed ~50px since there's no footer to subtract.

**Edge cases:**

- 1-page report — indicator reads `1 / — / 1`. Fine.
- Very long company name — `writing-mode: vertical-rl` plus `text-overflow: ellipsis` truncates gracefully.
- Print bleed — keep spine 18px from edge with 4px white margin so it doesn't get clipped on printer margins.
- Page count >9 — two-digit numbers still fit comfortably in the 24px-wide spine (monospace font).
- Page-number font color must contrast with the black spine — white at 100% opacity for the current page, 70% for the total (visual hierarchy).

**Acceptance criteria:**

- [ ] Spine renders on every page in PDF export, right edge by default
- [ ] Page indicator shows correct current / total on multi-page reports
- [ ] Setting flip swaps spine to left edge; text reading direction adjusts
- [ ] Cards reflow narrower when spine is on (always-on in v1.0.15)
- [ ] Photos render at the bumped height (~150px), not the v1.0.14 80px

**Touches:** Settings panel, `Letterhead` type, new `<SideSpine>` + `<PageIndicator>` components, print CSS (fixed spine + page counters), `computePageBreaks` (horizontal margin for spine, freed vertical from removed footer, taller photos).

**Tests at risk:** `pdf-print-colors.test.mjs` (spine renders, page counter populates), `preview-mode.test.mjs` (page-break overlay accounts for spine width on whichever edge, ignores former footer math).

## Implementation order

All features land in the PDF rendering layer. Order is about isolating regressions:

1. **Letterhead foundation** — Settings panel + `<LetterheadBand>` + print CSS for fixed-on-every-page. Biggest change, most likely to surface print-CSS quirks. Land alone, smoke-test exports, fix CSS issues before stacking layers. Uses neutral black for the rule and project number — no accent color.
2. **Side spine + page indicator** — Fixed vertical band on right edge by default; reuses the fixed-position print pattern from letterhead. `<PageIndicator>` is small and standalone — wire `counter(page)` into the print CSS, sample at top of spine.
3. **Page-break-safe cards (taller photos)** — `break-inside: avoid` CSS plus preview overlay. The `computePageBreaks` helper accounts for letterhead height at top and spine width on the side. Bump photo height from 80px to ~150px.
4. **DRAFT watermark** — Layered on top; lowest blast radius.
5. **Side spine** — Smallest piece, no dependencies on the others. Right-edge default. `computePageBreaks` accounts for the spine width on whichever edge it's on.

Each feature on its own PR/commit so a bisect remains useful.

## Data model migration

New report shape:

```ts
interface AKScanReport {
  // ... existing v1.0.14 fields ...
  projectNumber?: string;          // NEW. Optional. Missing on legacy reports.
  operator?: string;               // NEW. Optional. Defaults from letterhead.defaultOperator.
  status?: "draft" | "issued";     // NEW. Optional. Absent = "draft".
}
```

Plus a `Letterhead` shape used in two places (see "Storage strategy" below):

```ts
interface Letterhead {
  logoDataUrl?: string;            // base64 PNG/SVG, ≤ 200 KB. Full logo (mascot + wordmark).
  companyName: string;             // Primary line. Default "Aggarwal Kamikazes".
  companyNameSecondary?: string;   // Optional. Default "Cutting and Coring Ltd." for AK.
  tagline?: string;                // Optional. Default "— Shut up and cut straight" for AK.
  addressLine: string;
  phone: string;
  email: string;
  // No defaultOperator field — operator is per-report, filled by whoever
  // creates the scan. A "remember last operator" UX convenience can ship
  // separately if useful; it's not part of brand identity.
  sideSpinePosition: "left" | "right";  // Default "right". Spine is always on; only edge configurable.
}
```

**Tagline rendering.** Small label-style strap under the company name. Same display face as the logo (Bebas Neue), letter-spaced, muted gray, upper-case. Not bold, not colored — quietly reinforces the brand mark without competing with the address line or the project number. The leading em-dash is part of the default string; users can override the entire tagline (or set it to empty to hide).

**Storage strategy — letterhead lives in the `.akscan` file, with localStorage as the default source.**

Reversed from the earlier design (machine-local only). Now:

1. Each `.akscan` file carries its own copy of the `Letterhead` blob (under a `letterhead` key).
2. `localStorage["akscan.letterhead.v1"]` still exists — but as the **default** for new reports, not the source of truth.
3. New report → seed `report.letterhead` from localStorage at creation.
4. Open `.akscan` file → use `report.letterhead` if present; fall back to localStorage if absent (v1.0.14 legacy files).
5. Edit letterhead from Settings → updates localStorage (the default) AND the currently-open report. Saving the report persists the edit into the file.
6. Reports become self-describing: open on another machine, render identically — including tagline, footer template, and side spine setting.

For a one-operator shop this is strictly better than machine-local. If multi-operator ever becomes a concern, a "use my machine defaults" override toggle on the Letterhead settings panel handles it without changing the data model.

Chrome colors are not user-configurable in v1.0.15 — the letterhead rule, footer rule, and project number all render in neutral black (`#0a0a0a`). The color palette inside the report body (black / blue / red) is reserved for scan semantics and must not be diluted by branding chrome.

Backwards-compatibility rules:

- Loading a v1.0.14 `.akscan` file: missing fields stay missing. Letterhead pulls from local settings (if configured) regardless of report origin.
- Loading a partial letterhead blob from an earlier in-development v1.0.15 build (e.g., missing `companyNameSecondary` or `sideSpinePosition`): merge with defaults — never crash on missing keys.
- Saving a v1.0.15 report and loading in v1.0.14: extra fields dropped if schema is strict, preserved if generic JSON. Confirm against the actual save/load before shipping; add tolerant-parse if needed.
- No format-version bump — all additive optional fields.
- Letterhead blob (logo, tagline, spine position) lives inside the `.akscan` file so reports are self-describing across machines. localStorage provides defaults for new reports.

## Test pseudo-diffs

**`tests/save-load-roundtrip.test.mjs`** — extend fixture:
```js
const fixture = {
  // ...existing fields...
  projectNumber: "AKCC-2026-0017",
  operator: "D. Cunningham",
  status: "draft",
};
const loaded = loadAKScan(saveAKScan(fixture));
assert.equal(loaded.projectNumber, fixture.projectNumber);
assert.equal(loaded.operator, fixture.operator);
assert.equal(loaded.status, fixture.status);
```

**`tests/pdf-print-colors.test.mjs`** — needs the most update:
```js
// Letterhead chrome is neutral. The semantically-meaningful colors
// (black top-bar, blue bottom-bar, red conduit/no-scan zone) are
// reserved for scan content — chrome must not introduce competing color.
const headerBandSample = samplePdfRegion(pdf, { x: 100, y: 30, w: 200, h: 60 });
assert.matchesAny(headerBandSample, ["#ffffff", "#0a0a0a", "#525252"]);

// Side spine is solid black on the right edge; sample it:
const spineSample = samplePdfRegion(pdf, { x: 590, y: 100, w: 24, h: 600 });
assert.matchesAny(spineSample, ["#0a0a0a", "#ffffff"]);

// Page indicator at top of spine — verify it has actual numbers, not blank:
const indicatorRegion = samplePdfRegion(pdf, { x: 590, y: 10, w: 24, h: 40 });
assert.containsText(indicatorRegion, /[0-9]/);

// Scan card region must still surface the semantic palette — assert
// it's NOT all-neutral when the report has e.g. a red no-scan zone:
const scanRegionPalette = samplePalette(pdf, scanRegionBounds);
assert.includesAny(scanRegionPalette, ["#dc2626", "#1d4ed8", "#000000"]);

// Verify watermark only when status=draft:
const draftPdf = await renderPdf({ ...fixture, status: "draft" });
const issuedPdf = await renderPdf({ ...fixture, status: "issued" });
assert.containsGlyph(draftPdf, "DRAFT");
assert.notContainsGlyph(issuedPdf, "DRAFT");

// Verify card boundaries respect page breaks:
const pages = splitPdfByPage(draftPdf);
for (const page of pages) {
  for (const card of detectCardsOnPage(page)) {
    assert.equal(card.splitAcrossPages, false);
  }
}
```

**`tests/preview-mode.test.mjs`** — likely needs a small addition:
```js
// New: page-break overlay appears in preview
const preview = render(<Preview cards={threePageWorth} />);
assert.equal(preview.querySelectorAll(".ak-page-break").length >= 1, true);
```

**`tests/typing-perf.test.mjs`** — unchanged. Autocomplete deferred.

**`tests/photo-annotation.test.mjs`** — unchanged.

## Out of scope for v1.0.15 (logged so they're not forgotten)

| Feature | Defer to | Why |
|---|---|---|
| **Tier label customization** (CLEAR/CAUTION/DO NOT CORE → user-defined) | **v1.0.16** | Touches data model + every scan card render; cleaner to land alone. Mockup 05 previews the UX. |
| **Mobile-friendly PDF mode** (per-report toggle) | **v1.0.16** | When the toggle is on for a report, the PDF generation switches to a layout tuned for small-screen viewing: spine dropped, page indicator moves inline to letterhead top-right (`2/5`), scan card body stacks vertically (photo on top, notes below), base font bumped. Default off — desktop viewing stays as v1.0.15. Optional flag a customer can request. |
| Client/site autocomplete | v1.0.16 | Unrelated to PDF surface; can ship independently anytime |
| Engineer P.Eng stamp + signoff | v1.0.16 | Stacks on letterhead; natural follow-on |
| Snap-to-page-break on drag | v1.0.16 | Polish; auto-keep-whole solves the core problem alone |
| Auto-generated executive summary | v1.0.17 | Needs BYO-key plumbing finalized first |
| A4 paper-size support | TBD | Add when first non-Letter request lands |
| ™ in brand ribbon | Blocked | User wants AI-lawyer review before any TM assertion |
| CIPO filing (~$330 CAD) | Blocked | Tied to commercialization timeline |

## Test-suite checklist

All 9 must pass before tagging `v1.0.15` (lowercase, per `build-desktop.yml`).

- [ ] `tests/typing-perf.test.mjs` — unchanged (no Input changes in v1.0.15)
- [ ] `tests/pdf-print-colors.test.mjs` — letterhead chrome stays neutral (no brand-color contamination of scan palette) + spine renders black + page counter populates + DRAFT watermark + page breaks
- [ ] `tests/preview-mode.test.mjs` — page-break overlay accounts for spine width and bumped photo height; no longer accounts for footer (footer dropped)
- [ ] `tests/context-menu.test.mjs` — `electron-context-menu` still pinned at `^3.6.1`
- [ ] `tests/photo-annotation.test.mjs` — unchanged
- [ ] `tests/save-load-roundtrip.test.mjs` — `projectNumber` + `operator` + `status` + embedded `letterhead` blob round-trip (logo, tagline, spine position)
- [ ] `tests/diagram-tools.test.mjs` — unchanged
- [ ] `tests/no-vercel-default.test.mjs` — unchanged
- [ ] `tests/v106-features.test.mjs` — unchanged (drag-reorder still works)

## Manual QA checklist (in addition to automated tests)

The PDF-polish nature of this release means visual review matters more than test counts.

- [ ] Upload the Aggarwal Kamikazes logo (PNG ≤ 200 KB), verify it renders correctly in screen preview, PDF export, and the letterhead slot at the actual rendered size
- [ ] Same with an SVG logo
- [ ] Generate a 1-page report → letterhead + spine both render, page indicator reads "1 / — / 1"
- [ ] Generate a 3-page report → letterhead + spine render on all 3 pages, identically positioned; page indicator advances "1 of 3 → 2 of 3 → 3 of 3"
- [ ] Disable letterhead in settings → output matches v1.0.14 plain style, spine still renders
- [ ] Flip spine to left edge → spine moves, cards reflow, text reads bottom-to-top
- [ ] Drag-reorder a card across a page-break line in preview → break indicator updates live
- [ ] Force an oversized card (giant photo + long comment) → warning badge appears in preview
- [ ] Photos render at the bumped height (~150px) by default
- [ ] Mark report as Issued → watermark gone on next export
- [ ] Re-mark as Draft → watermark returns
- [ ] Visual review: chrome (letterhead rule, spine, project no.) stays neutral — no red competing with scan-content colors
- [ ] Visual review: a report containing a red no-scan zone and blue bottom-bar markings reads clearly — the semantic palette is not muddled by chrome
- [ ] Tagline "— Shut up and cut straight" renders under the company name in the letterhead, italic, muted gray
- [ ] Set tagline to empty in Settings → letterhead reflows without it, no visual gap
- [ ] Open a v1.0.14 `.akscan` file → letterhead renders from local settings (fallback path), no project number (blank), defaults to draft
- [ ] Save a v1.0.15 report → reopen on a fresh machine (different localStorage) → letterhead, tagline, spine all render from the file, not from local defaults

## Release checklist

1. Land all three features behind the existing branch flow (separate commits)
2. `npm test` — all 9 pass
3. Manual QA checklist above — all 10 items
4. Smoke test the local installer
5. Tag `v1.0.15` (lowercase) — workflow publishes installer + `latest.yml`
6. Install v1.0.14, confirm auto-update pulls v1.0.15, confirm saves + letterhead settings survive the upgrade
7. Update README / What's-new with the three features and the deferred list

## Release notes draft

User-facing changelog for the v1.0.15 GitHub Release body and the in-app "What's new" panel:

```markdown
## v1.0.15 — Branded reports: letterhead, footer, page-break-safe layout

**New**

- **Company letterhead on every page** — Upload your logo and company info once in Settings. Every scan report PDF gets your branding fixed at the top of every page: mascot mark, two-line company wordmark ("Aggarwal Kamikazes" / "Cutting and Coring Ltd."), tagline ("Shut up and cut straight"), address, phone, email, project number, and operator. Professional output ready to send to engineers and clients.
- **Vertical brand spine with page count** — Thin black band along the right edge of every page. Top of the spine shows the page indicator stacked — current page above a divider line, total pages below ("1 / — / 2"). The company name runs vertically through the rest of the spine. No bottom footer band — the whole bottom of the page is yours for content. Spine edge is configurable (left or right) in Settings.
- **Bigger scan photos** — Photo area in each scan card is now ~150px tall (was 80px). The space freed by removing the bottom footer goes straight into more legible photos.
- **Auto project numbers** — Every new report gets a sequential `AKCC-{year}-{####}` number, shown in the letterhead and used as the filename prefix. Editable if you need to backfill or skip.
- **No more cards split across pages** — Scan cards now stay whole. If a card doesn't fit on the current page, it moves to the next page automatically. The preview shows you exactly where each page break will land, and you can drag-reorder cards to fine-tune the layout.
- **DRAFT watermark on un-issued PDFs** — Reports default to draft and export with a diagonal DRAFT watermark so clients immediately see the difference between a working copy and a final. Click "Mark as Issued" when ready; the watermark drops off the next export.

**Branding kept deliberately neutral.** The chrome (letterhead rule, footer rule, project number) uses neutral black so it doesn't compete with the color grammar inside scan reports — black for top bar, blue for bottom bar, red for conduits and no-scan zones. Brand identity rides on the logo, not on a chrome accent.

**Compatibility**

- Reports created in v1.0.14 load cleanly. They render with your letterhead settings, but don't get a project number retroactively (those stay blank) and default to draft until you mark them issued.
- Letterhead and footer settings live on your machine — they don't travel with `.akscan` files. Each install configures its own branding.
- Auto-update over v1.0.14 preserves all local saves.

**Coming next**

- v1.0.16: Custom tier labels (CLEAR/CAUTION/DO NOT CORE → your wording), client & site autocomplete, engineer P.Eng signature/stamp, snap-to-page-break on drag.
- v1.0.17 candidate: AI-generated executive summary.
```

## Rollback plan

If a critical bug surfaces post-release:

1. **Re-tag the previous version** — push a `v1.0.16-rollback` tag pointing at the v1.0.14 commit so the auto-updater pulls users back. (Electron-updater respects the highest version it sees; you cannot publish `v1.0.14` again because the version is already used, hence the new tag.)
2. **Disable the feature locally** if the bug is feature-isolated: a hotfix tag (e.g., `v1.0.15.1`) that gates the broken feature behind a `localStorage.getItem("akscan.feature.X") === "on"` check, defaulting off. The letterhead has a natural off-switch via Settings.
3. **Auto-update flush** — the save-flush-before-update behavior from `save-load-roundtrip.test.mjs` already protects local data. Letterhead settings also persist in localStorage and survive downgrade.
4. **Communicate** — short note in the GitHub Release body for the rollback tag explaining what shipped, what regressed, and the expected fix window.

Most likely failure modes by feature:

- **Letterhead:** print CSS `position: running(header)` not honored in some Electron version → fall back to `position: fixed` print path. Caught by 3-page manual export in QA.
- **Side spine + page counter:** `counter(page)` / `counter(pages)` not firing in print → spine indicator shows blank or "0 / 0". Caught by 3-page manual export. Mitigation: if counter unreliable in the PDF backend, fall back to a JS-computed page number injected at render time.
- **Side spine — vertical text:** rendering inconsistent across PDF backends → spine text appears garbled or rotated wrong direction. Caught by visual QA. Mitigation: known-good fallback CSS for both `vertical-rl` and rotated variants.
- **Page-break-safe cards:** `break-inside: avoid` interacting badly with reserved top margin (letterhead) + spine on side, causing unexpected blank pages or overflowing photo height. Caught by 3-page manual QA. Mitigation: validated by `computePageBreaks` helper unit tests with letterhead height + spine width as configurable inputs.
- **DRAFT watermark:** z-index battle with letterhead/spine (watermark hiding logo, or vice versa). Caught by visual QA on draft export.

## Cost surface

No change. No new vendor dependencies, no new API calls. Logo upload is local-only (base64 in localStorage). Supabase usage unaffected.

## Pointers

- HTML mockups: [`v1015-mockups/index.html`](./v1015-mockups/index.html) — updated to show letterhead + page-break-safe preview
- Existing locked-in conventions: `CLAUDE.md` (in the ScanReport repo)
- Build workflow: `.github/workflows/build-desktop.yml` (in the ScanReport repo)
