/* AK ScanReport theme: ak-steel (dark app default)
   ─────────────────────────────────────────────────
   Values are the app's pre-engine dark palette, verbatim — with
   ak-steel active the app renders pixel-identical to the v1.0.14
   build. Same token names in every theme file, always.

   signal + the on* colors are intentionally identical across themes
   (see THEME-ENGINE.md). Utility/data colors (sketch strokes, verdict
   pins, APWA legend) are NOT tokens — they live in report data and
   print into the locked deliverable.
*/
export default {
  name: 'ak-steel',
  label: 'AK Steel (Dark)',

  color: {
    bg:            '#14171c',
    bgRaised:      '#1a1e24',
    surface:       '#1e232a',
    surfaceAlt:    '#242a32',
    border:        '#2c333c',
    borderStrong:  '#3a4250',
    text:          '#e8e4dc',
    textMuted:     '#a8a59e',
    textFaint:     '#6e6c66',
    accent:        '#d44545',
    accentDim:     '#5a1c1f',
    onAccent:      '#ffffff',
    onAccentDim:   '#f4ece0',
    accentSilver:  '#b8c4ce',
    signal:        '#e02020',
    safe:          '#4fb86a',
    safeBg:        '#16291e',
    safeStrong:    '#6cd082',
    warning:       '#d9a35a',
    warningBg:     '#2a2114',
    warningStrong: '#ecbf6e',
    danger:        '#d44545',
    dangerBg:      '#2c1818',
    dangerStrong:  '#e96868',
  },

  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },

  type: {
    fontBody: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
    sizeBase: 16,
    sizeDisplay: 28,
    sizeHeading: 18,
    sizeCaption: 12,
    sizeData: 13,
  },

  radius: { sm: 4, md: 6, lg: 8, xl: 10 },
};
