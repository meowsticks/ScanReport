/* AK Theme Engine — v0.1 (retrofit)
   ──────────────────────────────────
   Design tokens live in theme files as plain data (src/theme/themes/).
   This loader flattens them onto <html> as CSS variables:

     color.bg        → --color-bg
     space.md        → --space-md          (numbers become px)
     type.fontMono   → --type-font-mono    (camelCase → kebab-case)

   Components reference ONLY var(--token) — never raw values. Swapping
   or editing a theme rewrites the variables and the entire UI follows,
   live (no refresh) via ThemeEngine.setToken(group, key, value).

   Lockbox rules: no network, persistence is localStorage only.
   Full token mapping + policies: THEME-ENGINE.md at the repo root.
*/

import akSteel from './themes/ak-steel.js';
import akPaper from './themes/ak-paper.js';
import akEmber from './themes/ak-ember.js';

const THEME_KEY = 'ak-theme';      // persisted theme name
const BOOT_BG_KEY = 'ak-theme-bg'; // last applied bg; index.html paints it pre-mount
const LEGACY_KEY = 'ak_theme';     // pre-engine toggle stored 'dark' | 'light'

const GROUPS = ['color', 'space', 'type', 'radius'];

const ThemeEngine = {
  themes: {},
  activeName: null,

  register(theme) {
    this.themes[theme.name] = theme;
  },

  // camelCase token names → css kebab-case
  kebab(s) {
    return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  },

  apply(name) {
    const theme = this.themes[name];
    if (!theme) { console.warn('Theme not found:', name); return; }

    const root = document.documentElement;
    for (const group of GROUPS) {
      const tokens = theme[group] || {};
      for (const [key, value] of Object.entries(tokens)) {
        const cssVar = `--${group}-${this.kebab(key)}`;
        // Numbers become px; strings (fonts, hex colors) pass through
        const cssValue = typeof value === 'number' ? value + 'px' : value;
        root.style.setProperty(cssVar, cssValue);
      }
    }

    this.activeName = name;
    try {
      localStorage.setItem(THEME_KEY, name);
      localStorage.setItem(BOOT_BG_KEY, theme.color?.bg || '');
    } catch {}

    document.dispatchEvent(new CustomEvent('themechange', { detail: name }));
  },

  // Live single-token override (Theme Lab / future Settings tab).
  // Not persisted in v0.1 — override persistence lands with v0.2.
  setToken(group, key, value) {
    const cssValue = typeof value === 'number' ? value + 'px' : value;
    document.documentElement.style.setProperty(
      `--${group}-${this.kebab(key)}`, cssValue
    );
    document.dispatchEvent(new CustomEvent('themechange', { detail: this.activeName }));
  },

  // Resolved value of a token as currently rendered. Canvas/SVG code
  // must use this (or getComputedStyle directly) at draw time.
  get(group, key) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(`--${group}-${this.kebab(key)}`).trim();
  },

  list() {
    return Object.values(this.themes).map(t => ({ name: t.name, label: t.label }));
  },

  // Startup: saved choice → legacy dark/light migration → ak-steel.
  init() {
    let saved = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
      if (!saved) {
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy === 'light') saved = 'ak-paper';
        else if (legacy === 'dark') saved = 'ak-steel';
      }
    } catch {}
    this.apply(saved && this.themes[saved] ? saved : 'ak-steel');
  },
};

ThemeEngine.register(akSteel);
ThemeEngine.register(akPaper);
ThemeEngine.register(akEmber);

// Console / Theme-Lab handle (local only, no UI exposure yet)
if (typeof window !== 'undefined') window.AKTheme = ThemeEngine;

export default ThemeEngine;
