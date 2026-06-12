# AK Theme Engine — retrofit record (June 11–12 2026)

The token-based theme engine from the June 10 design session is now wired
into the app. **With ak-steel active at default settings the app is
pixel-identical to the pre-retrofit build** (screenshot-diffed, see
Verification below). Re-skinning is now a data change: edit/add a theme
file, or tinker live in the Theme Studio.

## What shipped

| Piece | Where |
|---|---|
| Engine (register/apply/init/setToken/overrides/get) | `gssi-report-app/src/theme/engine.js` |
| ak-steel — dark default, ≡ old dark palette verbatim | `src/theme/themes/ak-steel.js` |
| ak-paper — light/outdoor, ≡ old light palette verbatim | `src/theme/themes/ak-paper.js` |
| ak-ember — NEW dark industrial orange | `src/theme/themes/ak-ember.js` |
| Init before first paint | `src/main.jsx` (`ThemeEngine.init()`) |
| No-flash boot (reads `ak-theme-bg`) | `index.html` |
| **v0.2 Theme Studio** — 🎨 in the header (phone-first sheet) | `src/ThemePanel.jsx` |

## Theme Studio (v0.2, shipped June 12)

Bottom-sheet panel behind the header 🎨 button: theme picker (steel / paper
/ ember with palette-swatch cards), accent + danger color pickers (curated
presets + native OS color wheel), density (Compact ·75 / Normal / Comfy
·1.25), text size (85–130%), reset-to-factory per theme.

- Everything applies live (`setToken`) and persists per theme in
  `ak-theme-overrides` (localStorage): `{ [themeName]: { 'group.key': value } }`.
  Theme files stay pristine; `clearOverrides()` = factory reset.
- Picking accent/danger also derives the tint family so the UI follows
  coherently: `accentDim = color-mix(picked 30%, var(--color-bg))`,
  `dangerBg = mix(picked 14%, bg)`, `dangerStrong = mix(picked 60%, text)`.
  Mixing toward each theme's own bg/text keeps the derivation correct in
  dark and light themes alike. Hand-tune theme files for exact control.
- Density/text-size work through two unitless tokens, `--space-scale` and
  `--type-scale` (strings `'1'` in every theme file). Every inline
  `fontSize` and `padding`/`margin`/`gap` in the app is wrapped as
  `calc(Npx * var(--type-scale|--space-scale))` — exactly `Npx` at scale 1
  (pixel-verified), scaled everywhere otherwise.
- **Deliverable guard**: `@media print` and `body.preview-mode` pin both
  scales to 1 with `!important` (stylesheet importants beat the engine's
  inline vars), and print colors were never tokens. Verified: with text
  130% + density 0.75 + a green accent active, preview renders
  byte-identical to the locked reference.
- Not scaled on purpose: the `<style>`-block CSS (print/preview + the
  desktop-only ws-nav), `letterSpacing`/`lineHeight`, shapes/positions
  (radius, width/height, absolute offsets), and on-diagram elements
  (NorthArrow) which print.

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

## The spacing/font-size long tail — resolved (v0.2)

The audit found ~390 numeric spacing props (values 1–18, no clean scale —
5/7/9/11 all heavily used) and ~355 inline `fontSize` numbers across a
16-step ladder (9.5–28, half-steps included). Forcing those onto a 5-step
token scale would have shifted hundreds of pixels. The v0.2 answer keeps
every value exact and multiplies instead: `fontSize: 11` became
`fontSize: 'calc(11px * var(--type-scale))'` (≈1,100 sites converted by
script, pixel-verified identical at scale 1). The classic `--space-md`-style
tokens still exist for NEW structured layout; the multiplier is what makes
the Studio's density/text knobs govern the whole editor.

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

v0.1 retrofit (June 11):

| Surface | Result |
|---|---|
| Editor desktop dark / light | **identical** |
| Editor mobile dark / light | **identical** |
| Preview mode (PDF surface) | **identical** |

v0.2 Theme Studio (June 12):

| Surface | Result |
|---|---|
| Editor at default settings vs locked reference | **identical** except the header rows containing the new 🎨 button |
| Preview with text 130% + density 0.75 + green accent | **byte-identical** to the locked reference (guard holds) |
| Studio interactions: pick → persist across reload → per-theme isolation → reset | all pass, zero JS errors |
| `vite build` | passes |

## Roadmap

- ~~v0.2 Settings tab~~ — shipped as the Theme Studio (this doc, above).
- **v0.3** Export/import themes as .json (lockbox portability).
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
