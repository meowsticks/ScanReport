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

## Desktop app (Windows / macOS)

The same app can be packaged as an installable desktop program (Electron). On
the desktop, **File ▸ Save / Open** use real OS file dialogs and write `.akscan`
files (plain JSON) straight to disk, so nothing depends on browser storage.
Double-clicking a saved `.akscan` file opens it in the app.

```bash
npm install
npm run electron:dev        # run the desktop app against the live dev server
npm run app:build:win       # build a Windows installer (.exe) into release/
npm run app:build:mac       # build a macOS installer (.dmg) into release/
npm run app:build:linux     # build a Linux AppImage into release/
```

Each `app:build:*` must be run on (or for) its own OS. To build installers
without any local toolchain, use the **Build desktop app** GitHub Action
(`.github/workflows/build-desktop.yml`): run it from the Actions tab and
download the installers from the run's Artifacts, or push a `vX.Y.Z` tag to
also attach them to a GitHub Release.

## Tech

- Vite + React 18
- Web build: no backend, no database — uses browser localStorage
- Desktop build: Electron with native file save/open (`.akscan` = JSON on disk)
- Print-to-PDF via browser/OS print dialog
- JSON save/load for portable drafts
