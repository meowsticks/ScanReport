import React, { useEffect, useState } from 'react';
import ThemeEngine from './theme/engine.js';

// ============================================================
// Theme Studio (v0.2) — phone-first bottom sheet for live theme
// tinkering. Everything applies instantly via ThemeEngine.setToken
// and persists per theme ('ak-theme-overrides'); the app behind the
// sheet is the live preview. PDFs/preview are pinned to scale 1 and
// the locked print palette, so nothing here can touch a deliverable.
// ============================================================

// Curated accent presets — readable on dark and light surfaces.
const ACCENT_PRESETS = [
  '#d44545', // AK red (steel default)
  '#d97e2a', // ember orange
  '#4a7fa5', // steel blue
  '#3a8de8', // signal blue
  '#2e9e6b', // jade
  '#8a63d2', // violet
  '#c2376e', // magenta
  '#b8893a', // brass
];

// Danger stays in the red family on purpose — it marks no-cut zones.
const DANGER_PRESETS = ['#d44545', '#e02020', '#c0282d', '#b03224'];

const DENSITY_STOPS = [
  { v: '0.75', label: 'Compact' },
  { v: '1',    label: 'Normal' },
  { v: '1.25', label: 'Comfy' },
];

// Derive the tint family from a picked color so the whole UI follows
// coherently. color-mix toward bg/text keeps the derivation correct in
// dark AND light themes (tints go dark on steel/ember, light on paper).
// Theme files keep hand-tuned exacts; derivation is for live tweaks only.
function applyAccent(hex) {
  ThemeEngine.setToken('color', 'accent', hex, { persist: true });
  ThemeEngine.setToken('color', 'accentDim',
    `color-mix(in srgb, ${hex} 30%, var(--color-bg))`, { persist: true });
}

function applyDanger(hex) {
  ThemeEngine.setToken('color', 'danger', hex, { persist: true });
  ThemeEngine.setToken('color', 'dangerBg',
    `color-mix(in srgb, ${hex} 14%, var(--color-bg))`, { persist: true });
  ThemeEngine.setToken('color', 'dangerStrong',
    `color-mix(in srgb, ${hex} 60%, var(--color-text))`, { persist: true });
}

function SectionLabel({ c, children }) {
  return (
    <div style={{
      fontSize: 'calc(11px * var(--type-scale))', fontWeight: 700, color: c.textDim,
      letterSpacing: 1.2, textTransform: 'uppercase',
      margin: 'calc(18px * var(--space-scale)) 0 calc(8px * var(--space-scale))',
    }}>{children}</div>
  );
}

function Swatch({ color, size = 14 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      background: color, display: 'inline-block',
      border: '1px solid rgba(128,128,128,0.45)',
      flexShrink: 0,
    }} />
  );
}

function ColorRow({ c, value, presets, onPick, inputLabel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'calc(8px * var(--space-scale))', flexWrap: 'wrap' }}>
      {presets.map(hex => (
        <button key={hex} onClick={() => onPick(hex)}
          aria-label={`Use ${hex}`}
          style={{
            width: 34, height: 34, borderRadius: 17, cursor: 'pointer',
            background: hex, padding: 0,
            border: value?.toLowerCase() === hex
              ? `3px solid ${c.text}` : `2px solid ${c.borderStrong}`,
          }} />
      ))}
      <label title={inputLabel} style={{
        display: 'inline-flex', alignItems: 'center', gap: 'calc(7px * var(--space-scale))',
        background: c.cardAlt, border: `1px dashed ${c.borderStrong}`,
        borderRadius: 17, padding: 'calc(4px * var(--space-scale)) calc(12px * var(--space-scale)) calc(4px * var(--space-scale)) calc(6px * var(--space-scale))', cursor: 'pointer',
        fontSize: 'calc(12px * var(--type-scale))', fontWeight: 600, color: c.textDim, height: 34,
        boxSizing: 'border-box',
      }}>
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#888888'}
          onInput={e => onPick(e.target.value)}
          style={{
            width: 24, height: 24, padding: 0, border: 'none',
            background: 'transparent', cursor: 'pointer',
          }} />
        Custom…
      </label>
    </div>
  );
}

export default function ThemePanel({ open, onClose, c }) {
  // Re-render on every engine change so cards/pickers always show truth.
  const [, force] = useState(0);
  useEffect(() => {
    const onTc = () => force(x => x + 1);
    document.addEventListener('themechange', onTc);
    return () => document.removeEventListener('themechange', onTc);
  }, []);

  if (!open) return null;

  const active = ThemeEngine.activeName;
  const accent = ThemeEngine.resolve('color', 'accent');
  const danger = ThemeEngine.resolve('color', 'danger');
  const density = String(ThemeEngine.resolve('space', 'scale') ?? '1');
  const textScale = parseFloat(ThemeEngine.resolve('type', 'scale') || '1');
  const tweakCount = Object.keys(ThemeEngine.getOverrides()).length;

  return (
    <div className="no-print" role="dialog" aria-label="Theme studio"
      style={{ position: 'fixed', inset: 0, zIndex: 10000 }}>
      <style>{`
        @keyframes ak-sheet-up { from { transform: translateY(24px); opacity: 0; }
                                 to   { transform: translateY(0);    opacity: 1; } }
      `}</style>
      {/* Light scrim: the app behind IS the live preview */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)',
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        maxWidth: 520, margin: '0 auto',
        background: c.card, color: c.text,
        border: `1px solid ${c.borderStrong}`, borderBottom: 'none',
        borderRadius: '16px 16px 0 0',
        maxHeight: '82vh', overflowY: 'auto',
        padding: 'calc(10px * var(--space-scale)) calc(16px * var(--space-scale)) calc(22px * var(--space-scale))',
        boxShadow: '0 -10px 36px rgba(0,0,0,0.45)',
        animation: 'ak-sheet-up .18s ease-out',
      }}>
        {/* grab bar + header */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: c.borderStrong, margin: 'calc(4px * var(--space-scale)) auto calc(10px * var(--space-scale))' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'calc(8px * var(--space-scale))' }}>
          <div style={{ fontSize: 'calc(15px * var(--type-scale))', fontWeight: 800, letterSpacing: 0.3 }}>
            🎨 Theme studio
          </div>
          <button onClick={onClose} aria-label="Close theme studio" style={{
            background: c.cardAlt, color: c.text, border: `1px solid ${c.borderStrong}`,
            borderRadius: 8, padding: 'calc(7px * var(--space-scale)) calc(12px * var(--space-scale))', fontSize: 'calc(13px * var(--type-scale))', fontWeight: 800, cursor: 'pointer',
            lineHeight: 1,
          }}>✕</button>
        </div>
        <div style={{ fontSize: 'calc(11.5px * var(--type-scale))', color: c.textFaint, marginTop: 'calc(3px * var(--space-scale))', lineHeight: 1.45 }}>
          Live on the app behind this sheet. Saved on this device, per theme.
          The printed report never changes.
        </div>

        <SectionLabel c={c}>Theme</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'calc(7px * var(--space-scale))' }}>
          {ThemeEngine.list().map(t => {
            const th = ThemeEngine.themes[t.name];
            const on = t.name === active;
            return (
              <button key={t.name} onClick={() => ThemeEngine.apply(t.name)}
                style={{
                  background: th.color.bg, cursor: 'pointer', textAlign: 'left',
                  border: on ? `2px solid ${c.accent}` : `1px solid ${c.borderStrong}`,
                  borderRadius: 10,
                  padding: on
                    ? 'calc(10px * var(--space-scale)) calc(9px * var(--space-scale))'
                    : 'calc(11px * var(--space-scale)) calc(10px * var(--space-scale))',
                  minHeight: 64,
                }}>
                <div style={{ display: 'flex', gap: 'calc(4px * var(--space-scale))', marginBottom: 'calc(7px * var(--space-scale))' }}>
                  <Swatch color={th.color.surface} />
                  <Swatch color={th.color.accent} />
                  <Swatch color={th.color.safe} />
                  <Swatch color={th.color.text} />
                </div>
                <div style={{ fontSize: 'calc(11.5px * var(--type-scale))', fontWeight: 700, color: th.color.text, lineHeight: 1.25 }}>
                  {t.label.replace('AK ', '')}{on ? ' ✓' : ''}
                </div>
              </button>
            );
          })}
        </div>

        <SectionLabel c={c}>Accent — buttons & highlights</SectionLabel>
        <ColorRow c={c} value={accent} presets={ACCENT_PRESETS} onPick={applyAccent}
          inputLabel="Pick any accent color" />

        <SectionLabel c={c}>Danger — no-go red</SectionLabel>
        <ColorRow c={c} value={danger} presets={DANGER_PRESETS} onPick={applyDanger}
          inputLabel="Pick the danger color (keep it red-family — it marks no-cut zones)" />

        <SectionLabel c={c}>Density</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'calc(7px * var(--space-scale))' }}>
          {DENSITY_STOPS.map(d => {
            const on = density === d.v;
            return (
              <button key={d.v}
                onClick={() => ThemeEngine.setToken('space', 'scale', d.v, { persist: true })}
                style={{
                  background: on ? c.accentDim : c.cardAlt,
                  color: on ? c.onAccentDim : c.textDim,
                  border: `1px solid ${on ? c.accent : c.borderStrong}`,
                  borderRadius: 8, padding: 'calc(11px * var(--space-scale)) calc(6px * var(--space-scale))', cursor: 'pointer',
                  fontSize: 'calc(12.5px * var(--type-scale))', fontWeight: 700,
                }}>{d.label}</button>
            );
          })}
        </div>

        <SectionLabel c={c}>Text size — {Math.round(textScale * 100)}%</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'calc(10px * var(--space-scale))' }}>
          <span style={{ fontSize: 'calc(11px * var(--type-scale))', color: c.textFaint }}>A</span>
          <input type="range" min="0.85" max="1.3" step="0.05" value={textScale}
            aria-label="Text size"
            onChange={e => ThemeEngine.setToken('type', 'scale', e.target.value, { persist: true })}
            style={{ flex: 1, accentColor: c.accent, height: 34 }} />
          <span style={{ fontSize: 'calc(19px * var(--type-scale))', color: c.text, fontWeight: 600 }}>A</span>
        </div>
        <div style={{ fontSize: 'calc(11px * var(--type-scale))', color: c.textFaint, marginTop: 'calc(4px * var(--space-scale))', lineHeight: 1.45 }}>
          Bigger helps gloves-and-sunlight days. On-screen only — print layout is locked.
        </div>

        <div style={{ marginTop: 'calc(20px * var(--space-scale))', display: 'flex', gap: 'calc(8px * var(--space-scale))', alignItems: 'center' }}>
          <button
            onClick={() => ThemeEngine.clearOverrides()}
            disabled={tweakCount === 0}
            style={{
              background: c.cardAlt, color: tweakCount ? c.text : c.textFaint,
              border: `1px solid ${c.borderStrong}`,
              borderRadius: 8, padding: 'calc(10px * var(--space-scale)) calc(14px * var(--space-scale))', fontSize: 'calc(12.5px * var(--type-scale))', fontWeight: 700,
              cursor: tweakCount ? 'pointer' : 'default', opacity: tweakCount ? 1 : 0.6,
            }}>
            ↺ Reset {active?.replace('ak-', '')} to defaults
          </button>
          {tweakCount > 0 && (
            <span style={{ fontSize: 'calc(11px * var(--type-scale))', color: c.textFaint }}>
              {tweakCount} tweak{tweakCount === 1 ? '' : 's'} saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
