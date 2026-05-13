# GSSI Scan Report · BC Edition

Mobile-first GPR concrete scan report builder for British Columbia engineers, tuned for the GSSI StructureScan Mini XT.

## Deploy to Vercel (5 minutes)

### Easiest path: Drag-and-drop

1. Run `npm install` then `npm run build` — this creates a `dist/` folder.
2. Go to https://vercel.com/new and sign in (GitHub, Google, or email).
3. Click "Deploy" → "Browse all templates" → "Other" → or just drag the whole project folder into the upload area.
4. Vercel auto-detects Vite, builds it, and gives you a URL like `gssi-scan-report-abc123.vercel.app`.
5. That URL is what your QR code points to.

### Alternative: GitHub-connected (best for updates)

1. Push this folder to a GitHub repo.
2. Go to https://vercel.com/new → "Import Git Repository" → pick your repo.
3. Click "Deploy". Done.
4. Every `git push` auto-deploys an update.

## Local development

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## Tech

- Vite + React 18
- No backend, no database — uses browser localStorage
- Print-to-PDF via browser print dialog
- JSON save/load for portable drafts
