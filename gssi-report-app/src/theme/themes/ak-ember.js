/* AK ScanReport theme: ak-ember (dark industrial, orange)
   ────────────────────────────────────────────────────────
   Third theme from the June 2026 design session: ak-steel's
   structure with warm-shifted neutrals and an industrial-orange
   accent. Status colors stay in the red/amber/green families so
   field meaning never changes. Not reachable from the ☀/☾ toggle
   yet — select via the future Settings tab (v0.2) or the console:
   AKTheme.apply('ak-ember').
*/
export default {
  name: 'ak-ember',
  label: 'AK Ember (Industrial)',

  color: {
    bg:            '#16130e',
    bgRaised:      '#1c1812',
    surface:       '#211c15',
    surfaceAlt:    '#29221a',
    border:        '#3a3022',
    borderStrong:  '#4e4130',
    text:          '#ece5d8',
    textMuted:     '#aaa094',
    textFaint:     '#6e6759',
    accent:        '#d97e2a',
    accentDim:     '#4e2a0c',
    onAccent:      '#ffffff',
    onAccentDim:   '#f6ecdf',
    accentSilver:  '#c4b49e',
    signal:        '#e02020',
    safe:          '#4fb86a',
    safeBg:        '#1a2917',
    safeStrong:    '#6cd082',
    warning:       '#d9a35a',
    warningBg:     '#2e2310',
    warningStrong: '#ecbf6e',
    danger:        '#d44545',
    dangerBg:      '#301a14',
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
