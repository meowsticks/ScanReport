# CLAUDE.md — working notes for this repo

## Working preferences (Dustin)
- **Default to text updates.** Don't render/screenshot every step — it's the #1
  context-window cost. **Only screenshot when asked**, or when a change genuinely
  needs a visual check.
- **Lean on the committed PDF** instead of re-rendering: the canonical report is
  `pdf-mockups/AK-ScanReport-STEEL.pdf`. Point there rather than regenerating.
- Keep one task per chat where possible; suggest `/compact` or a new chat when a
  session gets heavy.
- Confirm before deleting anything; nothing destructive without sign-off
  (see `V2-MANIFEST.md`).

## Project shape
- `gssi-report-app/` — the Vite + React app (also packaged as Electron `.exe`).
  This is the real engineer deliverable (v1 structure + v2 facelift).
- `pdf-mockups/` — the **locked** v2 "STEEL" design: PDF + self-contained
  generator (`build-steel-report.mjs`) + logo + Caveat fonts + README.
- `boss-intake.html` (in app `public/`) — the "grill me" setup form;
  QR at `pdf-mockups/boss-intake-qr.png` → `scan-report.vercel.app/boss-intake.html`.
- `V2-MANIFEST.md` — cleanup plan (keep/delete/move). `IDEAS.md` — future backlog.

## The locked v2 "STEEL" design (canonical)
- Caveat two-tone wordmark: "Aggarwal Kamikazes" ink, **"Cutting & Coring Ltd."
  steel gray `#6b7682`**; subtitle red; red left-accent on cards; gold-tinted
  logo shadow; DRAFT watermark while `status !== 'issued'`.
- App letterhead (`.ak-lh*` in `GSSIReportApp.jsx`) mirrors the PDF — keep in sync.

## Branch
- Develop on **`claude/work-session-Sn3Wg`**. Commit + push when work is done.
- Archived (do not delete): `claude/4.7-4.8-comparison-JvG2S` (older PDF/letterhead
  exploration; design already extracted).
