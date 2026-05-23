// Opt-in cloud-sync control for the header: a status button plus a sign-in /
// account modal. The app works fully offline; this only adds cross-device sync
// once the user signs in.

import React, { useState } from 'react';

const STATUS_LABEL = {
  off: 'Sign in to sync',
  connecting: 'Connecting…',
  synced: 'Synced',
  saving: 'Saving…',
  error: 'Sync error',
};

export default function SyncControl({ auth, sync, c }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const signedIn = !!auth.session;
  const status = signedIn ? sync.status : 'off';
  const dotColor =
    status === 'synced' ? c.green
    : status === 'error' ? '#e0564b'
    : c.textDim;

  const btnStyle = {
    background: c.cardAlt, color: c.text,
    border: `1px solid ${signedIn && status === 'synced' ? c.green : c.borderStrong}`,
    borderRadius: 6, padding: '7px 10px', cursor: 'pointer',
    fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1,
    display: 'inline-flex', alignItems: 'center', gap: 6,
  };

  const submit = async (mode) => {
    setBusy(true); setMsg(null);
    try {
      const fn = mode === 'up' ? auth.signUp : auth.signIn;
      const { data, error } = await fn(email, password);
      if (error) { setMsg(error.message); return; }
      if (mode === 'up' && !data?.session) {
        setMsg('Account created. Check your email to confirm, then sign in.');
        return;
      }
      setOpen(false); setPassword('');
    } catch (e) {
      setMsg('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const doSignOut = async () => {
    setBusy(true);
    try { await auth.signOut(); } finally { setBusy(false); setOpen(false); }
  };

  const inConflict = !!sync.conflict;

  const field = {
    width: '100%', boxSizing: 'border-box', marginTop: 6,
    background: c.bg || c.cardAlt, color: c.text,
    border: `1px solid ${c.borderStrong}`, borderRadius: 6,
    padding: '10px 11px', fontSize: 14,
  };
  const action = (primary) => ({
    flex: 1, padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
    fontWeight: 700, fontSize: 13,
    background: primary ? c.accent : c.cardAlt,
    color: primary ? '#fff' : c.text,
    border: `1px solid ${primary ? c.accent : c.borderStrong}`,
    opacity: busy ? 0.6 : 1,
  });

  return (
    <>
      {inConflict && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            width: '100%', maxWidth: 380, background: c.bgRaised,
            border: `1px solid ${c.borderStrong}`, borderRadius: 10,
            padding: 18, textAlign: 'left', boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: c.text, marginBottom: 6 }}>
              Two reports found
            </div>
            <div style={{ fontSize: 13, color: c.textDim, marginBottom: 14, lineHeight: 1.5 }}>
              This device has a report, and your account already has a different
              saved report. Pick which one to keep — <strong style={{ color: c.text }}>the other
              will be replaced</strong>. Nothing changes until you choose.
            </div>
            <button
              onClick={() => sync.resolveConflict('local')}
              style={{
                width: '100%', padding: '11px 12px', borderRadius: 6, cursor: 'pointer',
                fontWeight: 700, fontSize: 13, marginBottom: 8,
                background: c.accent, color: '#fff', border: `1px solid ${c.accent}`,
              }}>
              Keep this device’s report
            </button>
            <button
              onClick={() => sync.resolveConflict('cloud')}
              style={{
                width: '100%', padding: '11px 12px', borderRadius: 6, cursor: 'pointer',
                fontWeight: 700, fontSize: 13,
                background: c.cardAlt, color: c.text, border: `1px solid ${c.borderStrong}`,
              }}>
              Load the saved (cloud) report
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => { setMsg(null); setOpen(true); }}
        title={signedIn ? `Signed in as ${auth.user?.email || ''} · ${STATUS_LABEL[status]}` : 'Sign in to sync across devices'}
        aria-label="Cloud sync"
        style={btnStyle}
      >
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: dotColor,
          display: 'inline-block', flexShrink: 0,
        }} />
        ☁ {signedIn ? STATUS_LABEL[status] : 'Sync'}
      </button>

      {open && (
        <div
          onClick={() => !busy && setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 360, background: c.bgRaised,
              border: `1px solid ${c.borderStrong}`, borderRadius: 10,
              padding: 18, textAlign: 'left', boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            }}
          >
            {signedIn ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 800, color: c.text, marginBottom: 4 }}>
                  Cloud sync
                </div>
                <div style={{ fontSize: 13, color: c.textDim, marginBottom: 14 }}>
                  Signed in as <strong style={{ color: c.text }}>{auth.user?.email}</strong>.<br />
                  Status: {STATUS_LABEL[status]}{sync.lastSyncedAt ? ` · ${new Date(sync.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={action(false)} disabled={busy} onClick={() => setOpen(false)}>Close</button>
                  <button style={action(true)} disabled={busy} onClick={doSignOut}>Sign out</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 800, color: c.text, marginBottom: 4 }}>
                  Sign in to sync
                </div>
                <div style={{ fontSize: 12.5, color: c.textDim, marginBottom: 6 }}>
                  Sign in on every device to keep this report — photos included — in sync.
                </div>
                <input
                  style={field} type="email" inputMode="email" autoComplete="email"
                  placeholder="Email" value={email}
                  onChange={(e) => setEmail(e.target.value)} disabled={busy}
                />
                <input
                  style={field} type="password" autoComplete="current-password"
                  placeholder="Password" value={password}
                  onChange={(e) => setPassword(e.target.value)} disabled={busy}
                  onKeyDown={(e) => { if (e.key === 'Enter') submit('in'); }}
                />
                {msg && (
                  <div style={{ marginTop: 10, fontSize: 12.5, color: '#e0564b', lineHeight: 1.4 }}>
                    {msg}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button style={action(false)} disabled={busy || !email || !password} onClick={() => submit('up')}>
                    Create account
                  </button>
                  <button style={action(true)} disabled={busy || !email || !password} onClick={() => submit('in')}>
                    Sign in
                  </button>
                </div>
                <button
                  onClick={() => !busy && setOpen(false)}
                  style={{
                    width: '100%', marginTop: 8, background: 'transparent',
                    color: c.textDim, border: 'none', cursor: 'pointer',
                    fontSize: 12, padding: 6,
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
