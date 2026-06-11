# AK Theme Engine — retrofit record (June 11 2026)

The token-based theme engine from the June 10 design session is now wired
into the app. **With ak-steel active the app is pixel-identical to the
pre-retrofit build** (screenshot-diffed, see Verification below). Re-skinning
is now a data change: edit/add a theme file, or poke tokens live.

## What shipped

| Piece | Where |
|---|---|
| Engine (~100 lines: register/apply/init/setToken/get) | `gssi-report-app/src/theme/engine.js` |
| ak-steel — dark default, ≡ old dark palette verbatim | `src/theme/themes/ak-steel.js` |
| ak-paper — light/outdoor, ≡ old light palette verbatim | `src/theme/themes/ak-paper.js` |
| ak-ember — NEW dark industrial orange | `src/theme/themes/ak-ember.js` |
| Init before first paint | `src/main.jsx` (`ThemeEngine.init()`) |
| No-flash boot (reads `ak-theme-bg`) | `index.html` |

- Tokens flatten onto `<html>` as `--color-*`, `--space-*`, `--type-*`,
  `--radius-*` (numbers → px, camelCase → kebab-case).
- Theme choice persists as `ak-theme` in localStorage; the old `ak_theme`
  (`dark`/`light`) migrates automatically on first launch.
- Every `apply()`/`setToken()` dispatches a `themechange` event on
  `document`; the ☀/☾ toggle listens, so external applies stay in sync.
- The ☀/☾ toggle flips any dark theme ↔ ak-paper. ak-ember is reachable via
  `AKTheme.apply('ak-ember')` in the console until the v0.2 Settings tab.
- `window.AKTheme` is the console handle (local only — lockbox intact:
  no network, no new deps, fonts already bundled via @fontsource).

## Color token mapping (JS `c.*` names kept, vars renamed)

Components keep using the `c` object — only the CSS variables underneath
changed. Old `--ak-*` names are gone.

| `c.*` (JS) | token | old var |
|---|---|---|
| bg | `--color-bg` | `--ak-bg` |
| bgRaised | `--color-bg-raised` | `--ak-bg-raised` |
| card | `--color-surface` | `--ak-card` |
| cardAlt | `--color-surface-alt` | `--ak-card-alt` |
| border / borderStrong | `--color-border` / `--color-border-strong` | `--ak-border*` |
| text / textDim / textFaint | `--color-text` / `--color-text-muted` / `--color-text-faint` | `--ak-text*` |
| accent / accentDim | `--color-accent` / `--color-accent-dim` | `--ak-accent*` |
| onAccent **(new)** | `--color-on-accent` | — (was scattered `'#fff'`) |
| onAccentDim | `--color-on-accent-dim` | `--ak-on-accent-dim` |
| signal **(new)** | `--color-signal` | — (was scattered `#e02020`) |
| green / greenBg / greenStrong | `--color-safe` / `-bg` / `-strong` | `--ak-green*` |
| amber / amberBg / amberStrong | `--color-warning` / `-bg` / `-strong` | `--ak-amber*` |
| red / redBg / redStrong | `--color-danger` / `-bg` / `-strong` | `--ak-red*` |
| — | `--color-accent-silver` | — (schema parity w/ handoff; no consumer yet) |

`onAccent` (#fff in all themes) replaced eleven hardcoded `'#fff'`-on-accent
sites and fixed a latent bug (`c.onAccent || '#fff'` referenced a key that
didn't exist). `signal` (#e02020, same in all shipped themes) covers the
drag-reorder indicators and drop-target outlines.

Type/space/radius tokens are defined in every theme (identical values across
all three) and consumed where exact matches existed (`--type-font-body` on
the shell, `--radius-md` etc. in the structured CSS). The inline px long-tail
is deferred — see below.

## Deliberate constants (NOT tokens — do not "fix")

1. **Report data colors** — sketch strokes, zones, verdict pins, annotation
   presets, APWA legend, target-type colors. They carry utility-marking
   meaning, are **stored in saved report data** (each stroke saves its hex;
   line width even keys off `#F09595`), and print into the deliverable. An
   app re-skin must never change what a saved report says. Centralized:
   `VERDICT_PIN_COLORS` / `ZONE_PATTERNS` / `DEFAULT_PRESETS` / `APWA_LEGEND`
   in `GSSIReportApp.jsx`.
2. **Print/preview CSS** (the big `@media print` + `body.preview-mode`
   block, `.ak-lh*` letterhead, CAD page) — this IS the locked "white paper"
   deliverable palette; its hardcoded values are the mechanism that keeps
   PDFs theme-independent. Verified byte-identical.
3. **Scrims & on-photo overlays** (`rgba(0,0,0,…)` backdrops, white on-image
   chips, photo-menu Cancel) — sit on photos/black, not on themed surfaces.
4. **Preview bar** (#1a1a1a / #e02020) — chrome of the locked preview
   surface, intentionally the same in every theme.
5. **QR quiet zone, NorthArrow chip** (#fff/#000) — functional/printed.
6. **#7a4dd6 purple** (DesktopTools version toggle) — signals "test
   channel" identically everywhere, deliberately not the brand accent.

## Intentional sub-pixel deviations (sanctioned near-dupe cleanup)

- Photo-menu "Remove" `#ff7b7b` → `c.redStrong` (#e96868 dark).
- SyncControl error `#e0564b` → `c.redStrong`.
- Brand-ribbon tint: hardcoded `rgba(212,69,69,.08)` → `color-mix(in srgb,
  var(--color-accent) 8%, transparent)` — in light mode the tint now derives
  from the light accent (#a32626) instead of the dark one; at 8% alpha the
  difference is imperceptible and it's now correct per the tint rule.

## Deferred: inline spacing/font-size long tail

The audit found ~390 numeric spacing props (values 1–18, no clean scale —
5/7/9/11 all heavily used) and ~355 inline `fontSize` numbers across a
16-step ladder (9.5–28, half-steps included). Forcing those onto a 5-step
scale would shift hundreds of pixels and break the pixel-identical
guarantee; converting them 1:1 adds indirection with zero theming gain
(space/type values are identical across all three themes). They stay
literal for now and convert together with the v0.2 density/text-size work,
which needs a deliberate scale design anyway.

## Rules for ALL future ScanReport work (from the handoff, now in force)

- Never hardcode a color in components — new color → new token → added to
  **every** theme file. (Exceptions: the Deliberate-constants list above.)
- Same token names in every theme, always.
- Tints derive via `color-mix(in srgb, var(--color-x) N%, transparent)`.
- Theme persistence is localStorage only. No network, no CDNs.
- Canvas/SVG that draws **themed chrome** must read tokens via
  `ThemeEngine.get(group, key)` at draw time and redraw on `themechange`.
  (Today's canvases draw report content only — constants by design.)

## Verification (screenshot pixel-diff, Chromium, frozen clock)

| Surface | Result |
|---|---|
| Editor desktop dark / light | **identical** |
| Editor mobile dark / light | **identical** |
| Preview mode (PDF surface) | **identical** |
| `vite build` | passes |
| Legacy `ak_theme` migration, toggle, `apply('ak-ember')`, `setToken`, `themechange` | all pass, zero JS errors |

## Roadmap (unchanged from handoff)

- **v0.2** Settings tab: theme picker (incl. ember), accent/danger pickers,
  density, text size; persist user overrides next to the theme name.
- **v0.3** Export/import themes as .json.
- **v1.0** Tokens drive the deliverable renderer (if ever unlocked — see
  open questions).

## Open questions for Dustin (defaults chosen, change anytime)

1. **Shipped default**: ak-steel (forced by pixel-identical; ember is one
   `apply()` away — say the word and the default flips).
2. **Deliverables themeable?** Locked to the print palette, per the
   handoff's own recommendation. Revisit at v1.0.
3. **Fonts**: Inter Variable was already bundled locally; JetBrains Mono is
   in the token stacks but falls back to system mono (no chrome uses mono
   yet). Bundle a .woff2 only if/when mono actually appears in the UI.
