# ScanReport

Tools for producing GPR concrete scan reports (BC edition, GSSI StructureScan Mini XT).

## Contents

- [`gssi-report-app/`](gssi-report-app) — Vite + React app engineers use in the field to fill in and print/PDF a scan report. Saves drafts to browser localStorage; JSON export/import for portability.
- [`qr_generator.jsx`](qr_generator.jsx) — standalone helper for generating a QR code that points at the deployed report app.

## Quick start (engineers)

```bash
cd gssi-report-app
npm install
npm run dev
```

Open http://localhost:5173. Fill the report, hit print → "Save as PDF".

## Build for distribution

```bash
cd gssi-report-app
npm run build    # outputs gssi-report-app/dist
```

The `dist/` folder is fully static — drop it on any host (Vercel, Netlify, S3, a USB stick served by a local web server). No backend, no database.

## Notes

- Drafts live in the browser's localStorage, so clearing site data wipes them. Use the JSON export to keep a portable copy.
- Print styling is tuned for letter-size portrait; use the browser's print preview before sending to engineers.
- The QR generator in `qr_generator.jsx` is a one-off React snippet — paste it into a sandbox (e.g. CodeSandbox) or wire it into the app if you want it inline.
- `gssi-report-app.zip` at the repo root is the original handoff archive; kept untracked. Safe to delete once you trust the working tree.
