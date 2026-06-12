/* AK ScanReport theme: ak-paper (light / outdoor readability)
   ────────────────────────────────────────────────────────────
   Values are the app's pre-engine light palette, verbatim. Same
   token names as ak-steel — that invariant is what keeps every
   component theme-agnostic.

   Note: the printed/preview deliverable does NOT use these tokens;
   its palette is locked in the print CSS (see THEME-ENGINE.md).
*/
export default {
  name: 'ak-paper',
  label: 'AK Paper (Light)',

  color: {
    bg:            '#f6f3ec',
    bgRaised:      '#ede9df',
    surface:       '#fbf8f1',
    surfaceAlt:    '#e8e4d8',
    border:        '#cfcabc',
    borderStrong:  '#9c9685',
    text:          '#1f1d18',
    textMuted:     '#46423a',
    textFaint:     '#6e6a5e',
    accent:        '#a32626',
    accentDim:     '#f0d4d2',
    onAccent:      '#ffffff',
    onAccentDim:   '#5e1416',
    accentSilver:  '#6e7e8c',
    signal:        '#e02020',
    safe:          '#2b6e3a',
    safeBg:        '#d8ecdc',
    safeStrong:    '#1d5028',
    warning:       '#7a5510',
    warningBg:     '#f4e4c4',
    warningStrong: '#5e4308',
    danger:        '#a32626',
    dangerBg:      '#efd8d6',
    dangerStrong:  '#7c1818',
  },

  // scale: unitless multipliers (strings stay verbatim — numbers would
  // become px). Theme Studio's density / text-size knobs override these;
  // print + preview pin them back to 1 so deliverables never scale.
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40, scale: '1' },

  type: {
    fontBody: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
    sizeBase: 16,
    sizeDisplay: 28,
    sizeHeading: 18,
    sizeCaption: 12,
    sizeData: 13,
    scale: '1',
  },

  radius: { sm: 4, md: 6, lg: 8, xl: 10 },
};
