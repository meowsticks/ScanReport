// Start-a-new-report dialog. Opens when there's at least one saved template,
// so the engineer can pick a client + see a preview of what gets pre-filled
// before they commit. Per-job data (photos, targets, cores, dates) stays
// blank regardless.

import React, { useState } from 'react';
import { TEMPLATE_FIELD_META, TEMPLATE_FIELD_GROUPS } from './lib/templates.js';

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 1150, background: 'rgba(0,0,0,0.65)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14,
};

function previewValue(meta, val) {
  if (val === undefined || val === null || val === '') return '—';
  if (meta.type === 'bool') return val ? 'Yes' : 'No';
  if (meta.type === 'lines' && Array.isArray(val)) {
    if (val.length === 0) return '—';
    return val.join(' • ');
  }
  if (meta.type === 'preview') {
    if (Array.isArray(val)) return `${val.length} item${val.length === 1 ? '' : 's'}`;
    return val ? '(captured)' : '—';
  }
  if (Array.isArray(val)) return val.length ? `${val.length} items` : '—';
  return String(val);
}

export default function StartReportModal({
  open, templates, onUseTemplate, onUseBlank, onEditTemplate, onClose, c,
}) {
  const [pickedId, setPickedId] = useState(null);
  if (!open) return null;

  const picked = pickedId ? templates.find(t => t.id === pickedId) : null;

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', background: c.bg || c.cardAlt,
    color: c.text, border: `1px solid ${c.borderStrong}`, borderRadius: 6,
    padding: '7px 9px', fontSize: 12.5, fontFamily: 'inherit',
  };

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 620, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        background: c.bgRaised, border: `1px solid ${c.borderStrong}`, borderRadius: 10,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)', textAlign: 'left',
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${c.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 11, color: c.textFaint, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>
              Start a new report
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2, color: c.text }}>
              {picked ? `Preview · ${picked.name}` : 'Pick a client / template'}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{
              background: 'transparent', border: 'none', color: c.text,
              fontSize: 22, cursor: 'pointer', padding: 4, lineHeight: 1,
            }}>×</button>
        </div>

        <div style={{ padding: 16, overflow: 'auto', flex: 1, minHeight: 0 }}>
          {!picked && (
            <>
              <div style={{ fontSize: 12, color: c.textDim, marginBottom: 12, lineHeight: 1.5 }}>
                Tap a saved template to see exactly what gets filled in. You can edit
                the template afterwards, or skip and start blank.
                <br/>
                Per-job data (photos, targets, dates, cores) is never auto-filled —
                you'll add those for this job.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {templates.map(t => (
                  <button key={t.id}
                    onClick={() => setPickedId(t.id)}
                    style={{
                      textAlign: 'left', cursor: 'pointer',
                      background: c.cardAlt, border: `1px solid ${c.border}`,
                      borderRadius: 7, padding: '11px 13px', color: c.text,
                      fontFamily: 'inherit',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: c.textFaint }}>
                        {Object.keys(t.fields || {}).length} fields →
                      </div>
                    </div>
                    {t.fields?.client && (
                      <div style={{ fontSize: 11, color: c.textDim, marginTop: 3 }}>
                        Client: {t.fields.client}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {picked && (
            <>
              <div style={{ fontSize: 12, color: c.textDim, marginBottom: 12, lineHeight: 1.5 }}>
                These are the fields that will be pre-filled. Per-job data stays blank.
                Review like you would on the engineer's PDF before signing.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {TEMPLATE_FIELD_GROUPS.map(g => {
                  const rows = g.keys
                    .filter(k => k in (picked.fields || {}))
                    .map(k => ({ k, meta: TEMPLATE_FIELD_META[k] }))
                    .filter(r => r.meta);
                  if (rows.length === 0) return null;
                  return (
                    <div key={g.label}>
                      <div style={{
                        fontSize: 10.5, fontWeight: 800, color: c.text,
                        letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6,
                      }}>{g.label}</div>
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: 4,
                        background: c.cardAlt, border: `1px solid ${c.border}`,
                        borderRadius: 6, padding: '8px 10px',
                      }}>
                        {rows.map(({ k, meta }) => (
                          <div key={k} style={{
                            display: 'grid', gridTemplateColumns: '150px 1fr', gap: 8,
                            fontSize: 12, padding: '3px 0',
                          }}>
                            <div style={{ color: c.textDim }}>{meta.label}</div>
                            <div style={{
                              color: c.text, fontFamily: 'inherit',
                              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            }}>
                              {previewValue(meta, picked.fields[k])}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div style={{
          padding: '12px 16px', borderTop: `1px solid ${c.border}`,
          display: 'flex', gap: 8, flexWrap: 'wrap',
        }}>
          {picked ? (
            <>
              <button onClick={() => setPickedId(null)} style={{
                padding: '9px 11px', borderRadius: 6, cursor: 'pointer',
                fontWeight: 600, fontSize: 12,
                background: c.cardAlt, color: c.textDim, border: `1px solid ${c.borderStrong}`,
              }}>← Back</button>
              <button onClick={() => { onEditTemplate(picked.id); }} style={{
                padding: '9px 11px', borderRadius: 6, cursor: 'pointer',
                fontWeight: 600, fontSize: 12,
                background: c.cardAlt, color: c.text, border: `1px solid ${c.borderStrong}`,
              }}>✏ Edit template</button>
              <div style={{ flex: 1 }} />
              <button onClick={() => { onUseTemplate(picked.id); }} style={{
                padding: '9px 14px', borderRadius: 6, cursor: 'pointer',
                fontWeight: 800, fontSize: 13,
                background: c.accent, color: '#fff', border: `1px solid ${c.accent}`,
              }}>Use this template →</button>
            </>
          ) : (
            <>
              <button onClick={onUseBlank} style={{
                padding: '9px 12px', borderRadius: 6, cursor: 'pointer',
                fontWeight: 600, fontSize: 12,
                background: c.cardAlt, color: c.text, border: `1px solid ${c.borderStrong}`,
              }}>Start blank</button>
              <div style={{ flex: 1 }} />
              <button onClick={onClose} style={{
                padding: '9px 12px', borderRadius: 6, cursor: 'pointer',
                fontWeight: 600, fontSize: 12,
                background: 'transparent', color: c.textDim, border: `1px solid ${c.border}`,
              }}>Cancel</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
