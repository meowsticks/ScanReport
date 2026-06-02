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

## 2. Commercialization ideas (placeholder — Dustin to expand)

- Re-enable account connectors when needed (Gmail = auto-email reports,
  Notion = job log, Zapier = automations, Drive = file storage).
- (Dustin has more ideas to add here later.)

## 3. Disclaimer rollout (pending boss approval)

- Recommended: **Option A** — page-1 safety banner + full disclaimer at end +
  client acknowledgment block with override capture + no-signature deemed-acceptance.
- Draft wording lives in chat; boss + counsel to approve, then drop into the
  editable disclaimer field. Build once approved.
