# PDF View — Cleanup & Implementation Checklist

> Goal: keep the printed/PDF report looking the way it does now (clean black-on-white
> paper, brand-red accents, centered logo) **but** fix the inconsistencies spotted while
> reading the code and finish the half-built letterhead/logo story.
>
> All line references are into `gssi-report-app/src/GSSIReportApp.jsx` unless noted.
> Started 2026-05-29. Check items off as they land.

---

## A. Bugs / inconsistencies spotted (fix without changing the look)

- [x] **A1 — Preview is sized to US Letter, PDF prints A4.** ✅ FIXED — `@page` now
  `size: letter` (and `letter landscape` for the CAD page) to match the Preview shell
  (`8.5in × 11in`) and the README's "letter-size portrait" intent. Preview now reflects the
  real PDF page.
- [ ] **A2 — Three separate logo systems, one hardcoded source.** `LOGO_SRC` is a fixed
  file path (line 267) consumed by three unrelated render paths:
  `.brand-ribbon-mark` (line 6319), the centered hero `.ak-logo` (line 5995), and
  `.cad-logo` (line 7087). Sizing, drop-shadow, and placement are defined three times
  and can drift. Unify into one source of truth so "logo in the proper spot" is decided
  once.
- [ ] **A3 — Letterhead/logo appears on page 1 only.** The brand ribbon is a single
  flex-ordered element (`order: -100`, line 5556), not a running header, so a multi-page
  PDF shows the logo once. The v1.0.15 roadmap explicitly wants it on every page. (See C1.)
- [ ] **A4 — `brandFlourishes` default differs between demo and real reports.** Sample
  report defaults it **on** (line 311); the new-report default has it **off** (line 413).
  Confirm intent — a new engineer's first real report looks different from the demo they
  were shown.
- [ ] **A5 — Print CSS has known-fragile structure.** Scar comments document a brace that
  previously leaked all print rules into the live editor (line 5767) and a dark-theme
  bleed-into-PDF fix (line 105). The `@media print` block is long and order-dependent
  ("cascade is source-order at equal specificity", line 5700). High risk of regression on
  the next edit — candidate for careful consolidation. (See B1.)

- [x] **A6 — Photo-annotation arrows drift in the exported PDF.** ✅ FIXED — `AnnotatedImage`
  (the overlay used in the printed report, 7 call sites) sized its canvas in *screen* pixels
  via `getBoundingClientRect()` at draw time and never recomputed for print, so when the image
  reflowed to PDF width the arrows shifted off-target — a report-validity risk. Fix: canvas
  backing-store now derives from the image's intrinsic size (capped) and CSS-stretches to cover
  the image (`inset:0; width/height:100%`); annotation coords are normalized, so arrows stay
  pinned at any render size including the PDF reflow. Build-verified; before/after proof in
  `pdf-mockups/annotation-fix-proof.png`.

## B. Cleanups (tech debt — no visible change)

- [ ] **B1 — Consolidate the `@media print` blocks.** There are multiple separate
  `@media print` blocks (lines ~5521, 5550, 5567, 5636, 6018) plus parallel
  `body.preview-mode` mirrors that must be hand-kept in sync (e.g. lines 5530–5533 mirror
  5522–5525). Collapse the print rules and have Preview reuse them instead of duplicating,
  so screen-Preview and PDF can't drift.
- [ ] **B2 — Extract a single `<LetterheadBand>` / logo component.** Pulling the three
  logo paths (A2) into one component is the enabling step for A2, A3, and C2, and chips
  away at the 7,844-line monolith without behavior change.
- [ ] **B3 — Name the magic colors.** Brand red appears as `#e02020`, `#d44545`/`--ak-accent`,
  `#a32626` (print), `#a32626` tagline. Confirm these are intentional shades vs. accidental
  drift; centralize as named tokens.

## C. Implementations (finish the look you liked)

- [ ] **C1 — Letterhead placement is a per-report CHOICE (not hard-coded).** Direction
  locked with the mock-up (`pdf-mockups/ScanReport-mockup.pdf`): **default = full letterhead on
  page 1 only, no header on continuation pages.** Build the *option* to repeat (full or a slim
  text-only line) for users who want it, but ship page-1-only as the default. Decide CSS
  `position: running()` vs. `position: fixed` for the repeat mode and **verify with a real
  3-page export**.
- [ ] **C2 — User-uploadable logo (replace hardcoded `LOGO_SRC`).** Settings → Company
  Letterhead: upload PNG/SVG, persist as base64 (`akscan.letterhead.v1`), validate ≤200 KB.
  Falls back to current bundled logo if none uploaded so nothing breaks. (Roadmap §1.)
- [ ] **C3 — Visible page-break indicator in Preview.** Cards are already kept whole
  (`break-inside: avoid` is in place, lines 5811–5838) — good. The missing half is the
  dashed line in Preview showing *where* each page splits, so the engineer can drag-reorder
  to fill gaps. (Roadmap §2, part 2 — not yet built.)
- [ ] **C4 — Make "clean" testable.** Today `tests/pdf-print-colors.test.mjs` asserts colors
  and strings only; nothing renders actual pages. Add a render-to-PDF + page-screenshot check
  so "logo in the right spot / card didn't split / Preview matches PDF" fails loudly instead
  of being eyeballed in print preview.

## D. Customizable report builder (user direction 2026-05-29)

> ⚠️ **SCOPE CORRECTION (2026-05-30): these controls are a DESIGN TOOL, not shipping features.**
> The playground's knobs (header mode, card size, paper, density, fonts, tap-to-style, accent,
> watermark, etc.) exist ONLY to dial the PDF until the **preview is a shippable file**. Once the
> look is locked, the app gets the **fixed final output**, not the controls. Do NOT wire these
> sliders/pickers into `GSSIReportApp.jsx`. The deliverable is the PDF, not a builder UI.
> Re-evaluate which (if any) of D1–D6 ever become real user options only after the user says
> "let's test this live."

- [ ] **D1 — Header per page: choose `Page 1 only` (default) · `Slim text line` · `Full letterhead`.**
- [ ] **D2 — Card / scan-photo size: keep current default; expose a size control** (e.g.
  Compact / Normal / Tall) so users fill pages by choice, not by a forced larger card.
- [ ] **D3 — Card order: drag-reorder (already shipped v1.0.6) + the C3 page-break indicator**
  so cards can be rearranged to fill each page. This is the answer to "fill the open space"
  without enlarging cards.
- [ ] **D4 — Optional card detail: stats strip (cover/spacing/depth/targets) and an
  observation line as toggles**, off by default (they were tried in the mock and pulled back).
- [ ] **D5 — Footer text customizable** (the "Confidential — for the named recipient" line,
  page-number format, project number).
- [ ] **D6 — Per-region lettering (prototyped in playground 2026-05-30).** Tap a region
  (company name / headings / paragraphs / card titles) → set font/case/weight/size/spacing.
  "Common text" regions update across the whole report at once. 24 embedded fonts incl.
  script/cursive; script fonts auto mixed-case. Logo size control (S/M/L/XL).

## E. Typographic emphasis — "important words noticeable, not bloated" (2026-05-30)

> Applied in the FINAL deliverable PDF (`build-final.mjs` → `ScanReport-final.pdf`). Keep these
> as the house emphasis rules when wiring live; the principle is restraint — emphasis earns its
> place, it doesn't decorate.

- [x] **E1 — Verdict pills** (Safe/Caution/No-go) carry colour; used in the findings table AND
  as a per-scan-card badge so the call is unmissable without a heavy box.
- [x] **E2 — Bold the numbers that matter** — clearances (60 mm, 25 mm, 75 mm south), tolerance
  (±15%), cover/spacing/standoff — via `tnum` tabular figures + selective `<strong>`.
- [x] **E3 — Quiet "Bottom line" key-callout** at the top of page 1: one line, red left-rule,
  no fill box. Gives the reviewer the verdict in 2 seconds without shouting.
- [x] **E4 — Restrained red** — brand red stays an accent (sub-rule, callout rule, no-go); never
  a background wash, so it never competes with the scan-colour grammar (rebar/PT/conduit).

## DELIVERABLE (2026-05-30)

- **`pdf-mockups/ScanReport-final.pdf`** — polished, client-ready 3-page Pure-B report for the
  engineer to use in the next update. Page-1-only letterhead (Bebas wordmark + bigger logo),
  no header on continuation pages, normal cards, emphasis pass E1–E4. US Letter, fonts embedded,
  generated by `build-final.mjs`. **Mock content** (sample site/cores; stylised radargrams) — the
  live app will drop in real photos/data once we wire Pure B in.

---

### Suggested order

1. **A1** (paper size) — small, high-impact, makes Preview trustworthy for everything below.
2. **B2 → A2** (extract `<LetterheadBand>`, unify logo) — unlocks the rest.
3. **C1** (repeat on every page) on top of the unified band.
4. **C2** (uploadable logo), **C3** (break indicator), then **B1/B3/C4** cleanup + safety net.
