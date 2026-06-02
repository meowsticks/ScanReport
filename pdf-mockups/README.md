# AK ScanReport — Locked Deliverable (v2 "STEEL")

This folder holds the **approved** report design — the one signed off on 2026-06-01.

| File | What |
|------|------|
| `AK-ScanReport-STEEL.pdf` | **THE main deliverable.** 6-page engineer report, US Letter. |
| `build-steel-report.mjs` | Generator that produces the PDF + per-page PNGs. |
| `logo.png`, `caveat-400.woff2`, `caveat-700.woff2` | Assets the generator inlines (base64). |

## The locked design

- **Wordmark:** Caveat two-tone — "Aggarwal Kamikazes" in ink, **"Cutting & Coring Ltd." in steel gray (`#6b7682`)**.
- **Subtitle:** `GPR CONCRETE SCANNING · CORE CLEARANCE REPORT`.
- **Focus accents:** thin **red left-border** on section headings and scan cards.
- **Shadow:** subtle **gold tint** under the logo / on cards.
- **Meta box:** Project / Operator / Date, top-right.
- Findings table with SAFE / CAUTION / NO-GO pills + subtle no-go row tint.
- Page-break-safe cards (~3 per page); footer = page number only.

## Regenerate

```bash
npm i -D puppeteer            # one-time (Chrome auto-downloads)
node pdf-mockups/build-steel-report.mjs
```

Outputs `AK-ScanReport-STEEL.*` (PDF + p1..p6 PNGs) into this folder.

> This is the canonical design source. The live app's letterhead mirrors it
> (`gssi-report-app/src/GSSIReportApp.jsx` → `.ak-lh*`). Keep the two in sync.
