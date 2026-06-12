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
- `gssi-report-app/src/theme/` — the token-based theme engine (ak-steel /
  ak-paper / ak-ember). **Never hardcode a color in app chrome — use a `c.*`
  token; new color → new token in EVERY theme file.** Report-data colors,
  print CSS, and scrims are deliberate constants. Full rules + mapping:
  `THEME-ENGINE.md`.
- **v3 = UI structure, not colors.** Direction: desktop "Workstation"
  (GSSI/RADAN-style: menu bar · toolbar · explorer tree · focused editor ·
  inspector). Interactive mockups live in app `public/ui-mockups/`
  (served at `/ui-mockups/…` on every deploy); plan + constraints in
  `V3-UI.md`. Mockups first, retrofit only after Dustin locks a direction.

## The locked v2 "STEEL" design (canonical)
- Caveat two-tone wordmark: "Aggarwal Kamikazes" ink, **"Cutting & Coring Ltd."
  steel gray `#6b7682`**; subtitle red; red left-accent on cards; gold-tinted
  logo shadow; DRAFT watermark while `status !== 'issued'`.
- App letterhead (`.ak-lh*` in `GSSIReportApp.jsx`) mirrors the PDF — keep in sync.

## Branch
- Develop on **`claude/work-session-Sn3Wg`**. Commit + push when work is done.
- Archived (do not delete): `claude/4.7-4.8-comparison-JvG2S` (older PDF/letterhead
  exploration; design already extracted).
