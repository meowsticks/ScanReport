/* AK Theme Engine — v0.2 (Theme Studio)
   ──────────────────────────────────────
   Design tokens live in theme files as plain data (src/theme/themes/).
   This loader flattens them onto <html> as CSS variables:

     color.bg        → --color-bg
     space.md        → --space-md          (numbers become px)
     type.fontMono   → --type-font-mono    (camelCase → kebab-case)

   Components reference ONLY var(--token) — never raw values. Swapping
   or editing a theme rewrites the variables and the entire UI follows,
   live (no refresh) via ThemeEngine.setToken(group, key, value).

   v0.2 adds per-theme user overrides (the Theme Studio panel): pass
   { persist: true } to setToken and the override is stored under
   'ak-theme-overrides' and re-applied on every load/apply. Theme files
   stay pristine — clearOverrides() returns to the hand-tuned palette.

   Lockbox rules: no network, persistence is localStorage only.
   Full token mapping + policies: THEME-ENGINE.md at the repo root.
*/

import akSteel from './themes/ak-steel.js';
import akPaper from './themes/ak-paper.js';
import akEmber from './themes/ak-ember.js';

const THEME_KEY = 'ak-theme';              // persisted theme name
const BOOT_BG_KEY = 'ak-theme-bg';         // last applied bg; index.html paints it pre-mount
const LEGACY_KEY = 'ak_theme';             // pre-engine toggle stored 'dark' | 'light'
const OVERRIDES_KEY = 'ak-theme-overrides';// { [themeName]: { 'group.key': value } }

const GROUPS = ['color', 'space', 'type', 'radius'];

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY)) || {}; }
  catch { return {}; }
}

function saveOverrides(all) {
  try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(all)); } catch {}
}

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

  cssValue(value) {
    // Numbers become px; strings (fonts, hex colors, unitless scales,
    // color-mix() expressions) pass through verbatim.
    return typeof value === 'number' ? value + 'px' : value;
  },

  setVar(group, key, value) {
    document.documentElement.style.setProperty(
      `--${group}-${this.kebab(key)}`, this.cssValue(value)
    );
  },

  apply(name) {
    const theme = this.themes[name];
    if (!theme) { console.warn('Theme not found:', name); return; }

    const root = document.documentElement;
    // Wipe vars from the previous theme so stale overrides can't linger,
    // then lay down base tokens + this theme's saved user overrides.
    for (const group of GROUPS) {
      const tokens = theme[group] || {};
      for (const [key, value] of Object.entries(tokens)) {
        root.style.setProperty(`--${group}-${this.kebab(key)}`, this.cssValue(value));
      }
    }
    const ov = loadOverrides()[name] || {};
    for (const [path, value] of Object.entries(ov)) {
      const [group, key] = path.split('.');
      if (group && key) this.setVar(group, key, value);
    }

    this.activeName = name;
    try {
      localStorage.setItem(THEME_KEY, name);
      localStorage.setItem(BOOT_BG_KEY, ov['color.bg'] || theme.color?.bg || '');
    } catch {}

    document.dispatchEvent(new CustomEvent('themechange', { detail: name }));
  },

  // Live single-token edit (Theme Studio). { persist: true } stores it as
  // a user override on the ACTIVE theme, surviving reload + theme flips.
  setToken(group, key, value, { persist = false } = {}) {
    this.setVar(group, key, value);
    if (persist && this.activeName) {
      const all = loadOverrides();
      all[this.activeName] = { ...(all[this.activeName] || {}), [`${group}.${key}`]: value };
      saveOverrides(all);
      if (`${group}.${key}` === 'color.bg') {
        try { localStorage.setItem(BOOT_BG_KEY, String(value)); } catch {}
      }
    }
    document.dispatchEvent(new CustomEvent('themechange', { detail: this.activeName }));
  },

  // User overrides for a theme (default: active). {} when pristine.
  getOverrides(name = this.activeName) {
    return loadOverrides()[name] || {};
  },

  // Drop all user overrides for a theme and restore its file values.
  clearOverrides(name = this.activeName) {
    const all = loadOverrides();
    delete all[name];
    saveOverrides(all);
    if (name === this.activeName) this.apply(name);
  },

  // Effective value the Studio should display: user override if present,
  // else the theme-file base. Always a raw token value (e.g. a hex), never
  // a computed/derived CSS expression — use get() for the rendered value.
  resolve(group, key, name = this.activeName) {
    const ov = loadOverrides()[name] || {};
    if (`${group}.${key}` in ov) return ov[`${group}.${key}`];
    return this.themes[name]?.[group]?.[key];
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

// Console / Theme-Studio handle (local only)
if (typeof window !== 'undefined') window.AKTheme = ThemeEngine;

export default ThemeEngine;
