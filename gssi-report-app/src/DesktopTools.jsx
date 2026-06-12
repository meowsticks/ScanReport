// Header tools: a Feedback button (everywhere) and a Stable/Test version
// toggle (desktop only). Both are small and self-contained.

import React, { useEffect, useState } from 'react';

const FEEDBACK_TO = 'dtjcunningham@gmail.com';
const TEMPLATE =
  "What's working well:\n- \n\nWhat needs changing:\n- \n";

function overlay(onClose) {
  return {
    position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(16px * var(--space-scale))',
  };
}

export function FeedbackButton({ c }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(TEMPLATE);
  const [version, setVersion] = useState('');

  useEffect(() => {
    window.akDesktop?.getAppVersion?.().then((v) => setVersion(v || '')).catch(() => {});
  }, []);

  const send = () => {
    const isDesktop = !!window.akDesktop;
    const subject = `AK ScanReport feedback${version ? ' (v' + version + ')' : ''}`;
    const body = `${text.trim()}\n\n---\nVersion: ${version || 'web'} · ${isDesktop ? 'Desktop app' : 'Web'}`;
    const url = `mailto:${FEEDBACK_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (window.akDesktop?.openExternal) window.akDesktop.openExternal(url);
    else window.location.href = url;
    setOpen(false);
    setText(TEMPLATE);
  };

  const btn = {
    background: c.cardAlt, color: c.text, border: `1px solid ${c.borderStrong}`,
    borderRadius: 6, padding: 'calc(7px * var(--space-scale)) calc(10px * var(--space-scale))', cursor: 'pointer',
    fontSize: 'calc(13px * var(--type-scale))', fontWeight: 900, whiteSpace: 'nowrap', lineHeight: 1,
  };

  return (
    <>
      <button onClick={() => setOpen(true)} title="Send feedback" aria-label="Send feedback" style={btn}>💬</button>
      {open && (
        <div style={overlay()} onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '100%', maxWidth: 420, background: c.bgRaised,
            border: `1px solid ${c.borderStrong}`, borderRadius: 10, padding: 'calc(18px * var(--space-scale))',
            boxShadow: '0 12px 40px rgba(0,0,0,0.4)', textAlign: 'left',
          }}>
            <div style={{ fontSize: 'calc(15px * var(--type-scale))', fontWeight: 800, color: c.text, marginBottom: 'calc(4px * var(--space-scale))' }}>Send feedback</div>
            <div style={{ fontSize: 'calc(12.5px * var(--type-scale))', color: c.textDim, marginBottom: 'calc(10px * var(--space-scale))', lineHeight: 1.5 }}>
              Note what’s good or what needs changing. This opens an email to the team.
            </div>
            <textarea
              value={text} onChange={(e) => setText(e.target.value)} rows={8}
              style={{
                width: '100%', boxSizing: 'border-box', background: c.bg || c.cardAlt,
                color: c.text, border: `1px solid ${c.borderStrong}`, borderRadius: 6,
                padding: 'calc(10px * var(--space-scale)) calc(11px * var(--space-scale))', fontSize: 'calc(13px * var(--type-scale))', fontFamily: 'inherit', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 'calc(8px * var(--space-scale))', marginTop: 'calc(12px * var(--space-scale))' }}>
              <button onClick={() => setOpen(false)} style={{
                flex: 1, padding: 'calc(10px * var(--space-scale)) calc(12px * var(--space-scale))', borderRadius: 6, cursor: 'pointer', fontWeight: 700,
                fontSize: 'calc(13px * var(--type-scale))', background: c.cardAlt, color: c.text, border: `1px solid ${c.borderStrong}`,
              }}>Cancel</button>
              <button onClick={send} style={{
                flex: 1, padding: 'calc(10px * var(--space-scale)) calc(12px * var(--space-scale))', borderRadius: 6, cursor: 'pointer', fontWeight: 700,
                fontSize: 'calc(13px * var(--type-scale))', background: c.accent, color: c.onAccent, border: `1px solid ${c.accent}`,
              }}>Send</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function VersionToggle({ c }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState({ testMode: false, testUrl: '' });
  const [urlField, setUrlField] = useState('');

  useEffect(() => {
    window.akDesktop?.getVersionMode?.().then((m) => {
      if (m) { setMode(m); setUrlField(m.testUrl || ''); }
    }).catch(() => {});
  }, []);

  const apply = (testMode) => {
    // The window reloads into the chosen build, so no further UI work is needed.
    window.akDesktop?.setVersionMode?.(testMode, urlField.trim());
    setOpen(false);
  };

  const isTest = mode.testMode && mode.testUrl;
  const btn = {
    background: isTest ? '#7a4dd6' : c.cardAlt, color: isTest ? c.onAccent : c.textDim,
    border: `1px solid ${isTest ? '#7a4dd6' : c.borderStrong}`,
    borderRadius: 6, padding: 'calc(7px * var(--space-scale)) calc(10px * var(--space-scale))', cursor: 'pointer',
    fontSize: 'calc(12px * var(--type-scale))', fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1,
  };
  const action = (primary) => ({
    flex: 1, padding: 'calc(10px * var(--space-scale)) calc(12px * var(--space-scale))', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 'calc(13px * var(--type-scale))',
    background: primary ? '#7a4dd6' : c.cardAlt, color: primary ? c.onAccent : c.text,
    border: `1px solid ${primary ? '#7a4dd6' : c.borderStrong}`,
  });

  return (
    <>
      <button onClick={() => setOpen(true)}
        title={isTest ? 'Running the Test version' : 'Running the Stable version'}
        aria-label="Version mode" style={btn}>
        {isTest ? '🧪 Test' : '● Stable'}
      </button>
      {open && (
        <div style={overlay()} onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '100%', maxWidth: 420, background: c.bgRaised,
            border: `1px solid ${c.borderStrong}`, borderRadius: 10, padding: 'calc(18px * var(--space-scale))',
            boxShadow: '0 12px 40px rgba(0,0,0,0.4)', textAlign: 'left',
          }}>
            <div style={{ fontSize: 'calc(15px * var(--type-scale))', fontWeight: 800, color: c.text, marginBottom: 'calc(4px * var(--space-scale))' }}>App version</div>
            <div style={{ fontSize: 'calc(12.5px * var(--type-scale))', color: c.textDim, marginBottom: 'calc(12px * var(--space-scale))', lineHeight: 1.5 }}>
              <strong>Stable</strong> is the installed app (works offline). <strong>Test</strong> loads
              the latest in-progress build from the web for review — no re-install needed.
            </div>
            <label style={{ fontSize: 'calc(11px * var(--type-scale))', fontWeight: 700, color: c.textDim }}>Test build URL</label>
            <input
              value={urlField} onChange={(e) => setUrlField(e.target.value)}
              placeholder="https://…preview.vercel.app"
              style={{
                width: '100%', boxSizing: 'border-box', marginTop: 'calc(4px * var(--space-scale))', background: c.bg || c.cardAlt,
                color: c.text, border: `1px solid ${c.borderStrong}`, borderRadius: 6,
                padding: 'calc(10px * var(--space-scale)) calc(11px * var(--space-scale))', fontSize: 'calc(13px * var(--type-scale))',
              }}
            />
            <div style={{ display: 'flex', gap: 'calc(8px * var(--space-scale))', marginTop: 'calc(14px * var(--space-scale))' }}>
              <button onClick={() => apply(false)} style={action(!mode.testMode)}>● Use Stable</button>
              <button onClick={() => apply(true)} disabled={!urlField.trim()}
                style={{ ...action(mode.testMode), opacity: urlField.trim() ? 1 : 0.5 }}>
                🧪 Use Test
              </button>
            </div>
            <button onClick={() => setOpen(false)} style={{
              width: '100%', marginTop: 'calc(8px * var(--space-scale))', background: 'transparent', color: c.textDim,
              border: 'none', cursor: 'pointer', fontSize: 'calc(12px * var(--type-scale))', padding: 'calc(6px * var(--space-scale))',
            }}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}
