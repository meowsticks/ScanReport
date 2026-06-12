// Template editor: a "preview before saving" for new templates and a
// "customize anytime" editor for saved ones. Shows every field that can be
// captured, grouped, with an include checkbox + an editor sized to its type.

import React, { useEffect, useState } from 'react';
import { TEMPLATE_FIELD_META, TEMPLATE_FIELD_GROUPS } from './lib/templates.js';

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(16px * var(--space-scale))',
};

export default function TemplateEditor({ open, mode, initialName, initialFields, onSave, onClose, c }) {
  const [name, setName] = useState(initialName || '');
  const [fields, setFields] = useState(initialFields || {});
  const [included, setIncluded] = useState(() => new Set(Object.keys(initialFields || {})));

  useEffect(() => {
    if (!open) return;
    setName(initialName || '');
    setFields({ ...(initialFields || {}) });
    setIncluded(new Set(Object.keys(initialFields || {})));
  }, [open, initialName, initialFields]);

  if (!open) return null;

  const toggle = (k) => {
    const s = new Set(included);
    if (s.has(k)) s.delete(k); else s.add(k);
    setIncluded(s);
  };
  const setField = (k, v) => setFields((f) => ({ ...f, [k]: v }));

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', background: c.bg || c.cardAlt,
    color: c.text, border: `1px solid ${c.borderStrong}`, borderRadius: 6,
    padding: 'calc(7px * var(--space-scale)) calc(9px * var(--space-scale))', fontSize: 'calc(12.5px * var(--type-scale))', fontFamily: 'inherit',
  };
  const dim = (on) => ({ opacity: on ? 1 : 0.45 });

  const renderEditor = (key, meta) => {
    const on = included.has(key);
    const val = fields[key];
    if (meta.type === 'bool') {
      return <input type="checkbox" checked={!!val} disabled={!on}
        onChange={(e) => setField(key, e.target.checked)} style={dim(on)} />;
    }
    if (meta.type === 'select') {
      return (
        <select disabled={!on} value={val ?? ''} onChange={(e) => setField(key, e.target.value)}
          style={{ ...inputStyle, ...dim(on) }}>
          {meta.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (meta.type === 'textarea') {
      return <textarea rows={3} disabled={!on} value={val ?? ''}
        onChange={(e) => setField(key, e.target.value)}
        style={{ ...inputStyle, resize: 'vertical', ...dim(on) }} />;
    }
    if (meta.type === 'lines') {
      const text = Array.isArray(val) ? val.join('\n') : (val ?? '');
      return <textarea rows={3} disabled={!on} value={text}
        onChange={(e) => setField(key, e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
        style={{ ...inputStyle, resize: 'vertical', ...dim(on) }} />;
    }
    if (meta.type === 'preview') {
      const summary = Array.isArray(val)
        ? `${val.length} item${val.length === 1 ? '' : 's'}`
        : (val ? '(captured)' : '(empty)');
      return <div style={{ fontSize: 'calc(11.5px * var(--type-scale))', color: c.textDim, fontStyle: 'italic', ...dim(on) }}>{summary} — copied as-is</div>;
    }
    return <input type="text" disabled={!on} value={val ?? ''}
      onChange={(e) => setField(key, e.target.value)} style={{ ...inputStyle, ...dim(on) }} />;
  };

  const save = () => {
    const out = {};
    Array.from(included).forEach((k) => { out[k] = fields[k]; });
    onSave({ name: name.trim() || 'Template', fields: out });
  };

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 580, maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        background: c.bgRaised, border: `1px solid ${c.borderStrong}`, borderRadius: 10,
        padding: 'calc(18px * var(--space-scale))', boxShadow: '0 12px 40px rgba(0,0,0,0.4)', textAlign: 'left',
      }}>
        <div style={{ fontSize: 'calc(15px * var(--type-scale))', fontWeight: 800, color: c.text, marginBottom: 'calc(4px * var(--space-scale))' }}>
          {mode === 'edit' ? '📋 Edit template' : '📋 New template — preview'}
        </div>
        <div style={{ fontSize: 'calc(12px * var(--type-scale))', color: c.textDim, marginBottom: 'calc(12px * var(--space-scale))', lineHeight: 1.5 }}>
          {mode === 'edit'
            ? 'Tweak any value. Uncheck a row to drop that field from this template — applying it then leaves that field as the report’s default.'
            : 'This is exactly what will be saved. Uncheck rows to leave them out, edit values inline. Per-job data (photos, targets, cores, dates) is never captured.'}
        </div>

        <label style={{ fontSize: 'calc(11px * var(--type-scale))', fontWeight: 700, color: c.textDim }}>Template name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. client or workflow"
          style={{ ...inputStyle, marginTop: 'calc(4px * var(--space-scale))', marginBottom: 'calc(12px * var(--space-scale))', fontSize: 'calc(13px * var(--type-scale))', fontWeight: 600 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(14px * var(--space-scale))', overflow: 'auto', paddingRight: 'calc(4px * var(--space-scale))', flex: 1, minHeight: 0 }}>
          {TEMPLATE_FIELD_GROUPS.map((g) => (
            <div key={g.label}>
              <div style={{ fontSize: 'calc(10.5px * var(--type-scale))', fontWeight: 800, color: c.text, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 'calc(6px * var(--space-scale))' }}>
                {g.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(5px * var(--space-scale))' }}>
                {g.keys.map((k) => {
                  const meta = TEMPLATE_FIELD_META[k];
                  if (!meta) return null;
                  return (
                    <div key={k} style={{ display: 'grid', gridTemplateColumns: '22px 130px 1fr', gap: 'calc(6px * var(--space-scale))', alignItems: 'center' }}>
                      <input type="checkbox" checked={included.has(k)} onChange={() => toggle(k)} />
                      <label style={{ fontSize: 'calc(11.5px * var(--type-scale))', color: c.textDim }}>{meta.label}</label>
                      {renderEditor(k, meta)}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'calc(8px * var(--space-scale))', marginTop: 'calc(14px * var(--space-scale))' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 'calc(10px * var(--space-scale)) calc(12px * var(--space-scale))', borderRadius: 6, cursor: 'pointer',
            fontWeight: 700, fontSize: 'calc(13px * var(--type-scale))',
            background: c.cardAlt, color: c.text, border: `1px solid ${c.borderStrong}`,
          }}>Cancel</button>
          <button onClick={save} style={{
            flex: 1, padding: 'calc(10px * var(--space-scale)) calc(12px * var(--space-scale))', borderRadius: 6, cursor: 'pointer',
            fontWeight: 700, fontSize: 'calc(13px * var(--type-scale))',
            background: c.accent, color: c.onAccent, border: `1px solid ${c.accent}`,
          }}>{mode === 'edit' ? 'Save changes' : 'Save template'}</button>
        </div>
      </div>
    </div>
  );
}
