// Preload bridge: exposes a small, safe desktop API to the renderer.
// The web app feature-detects `window.akDesktop` and, when present, routes
// file save/open through the native OS dialogs instead of the browser.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('akDesktop', {
  isDesktop: true,

  // Show an Open dialog and return { path, name, content } or null if cancelled.
  openFile: () => ipcRenderer.invoke('dialog:open'),

  // Show a Save As dialog; returns { path, name } or null if cancelled.
  saveFileAs: (suggestedName, content) =>
    ipcRenderer.invoke('dialog:save', { suggestedName, content }),

  // Write to an already-chosen path (the "Save" that overwrites the same file).
  saveFile: (path, content) => ipcRenderer.invoke('file:write', { path, content }),

  // Read a known path; returns { path, name, content }.
  readFile: (path) => ipcRenderer.invoke('file:read', path),

  // Render the current report to a PDF and save it via a native dialog;
  // returns { path, name } or null. Reveals the file in its folder.
  savePdf: (opts) => ipcRenderer.invoke('pdf:save', opts),

  // Reveal a file in the OS file manager.
  showInFolder: (path) => ipcRenderer.invoke('shell:show', path),

  // A file passed at launch (double-click / Open With), or null.
  getLaunchFile: () => ipcRenderer.invoke('app:get-launch-file'),

  // Subscribe to native menu actions: 'new' | 'open' | 'save' | 'save-as' | 'print'.
  onMenu: (cb) => {
    const handler = (_e, action) => cb(action);
    ipcRenderer.on('menu', handler);
    return () => ipcRenderer.removeListener('menu', handler);
  },

  // A file opened while the app was already running (second-instance / macOS).
  onOpenFile: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('open-file', handler);
    return () => ipcRenderer.removeListener('open-file', handler);
  },

  // Before an update installs, the main process asks the app to persist now.
  onFlushSave: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('flush-save', handler);
    return () => ipcRenderer.removeListener('flush-save', handler);
  },
  flushSaveDone: () => ipcRenderer.send('flush-save-done'),

  // Open a URL (or mailto:) in the user's real browser / mail app.
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),

  // App version string (e.g. "1.0.1").
  getAppVersion: () => ipcRenderer.invoke('app:version'),

  // Stable vs Test version: read/set which build the shell loads.
  // setVersionMode reloads the window into the chosen build.
  getVersionMode: () => ipcRenderer.invoke('version:get'),
  setVersionMode: (testMode, testUrl) =>
    ipcRenderer.invoke('version:set', { testMode, testUrl }),

  // ---------- Live PDF preview window ----------
  // A separate, movable window that mirrors what the saved PDF will look like.
  // The editor pushes report state to it live; it shows a read-only render
  // (no tools) so the engineer reviews exactly the document they'll send.

  // Open the preview window (idempotent — focuses it if already open).
  openPreview: () => ipcRenderer.invoke('preview:open'),
  // Close the preview window.
  closePreview: () => ipcRenderer.invoke('preview:close'),
  // Is the preview window currently open?
  isPreviewOpen: () => ipcRenderer.invoke('preview:is-open'),

  // EDITOR → main → preview: push the latest report so the mirror updates live.
  sendPreviewState: (report) => ipcRenderer.send('preview:state', report),
  // EDITOR side: the preview window just opened and wants the current report.
  onPreviewRequestState: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('preview:request-state', handler);
    return () => ipcRenderer.removeListener('preview:request-state', handler);
  },
  // EDITOR side: the preview window was closed (so the toggle can update).
  onPreviewClosed: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('preview:closed', handler);
    return () => ipcRenderer.removeListener('preview:closed', handler);
  },

  // PREVIEW side: receive live report state from the editor.
  onPreviewState: (cb) => {
    const handler = (_e, report) => cb(report);
    ipcRenderer.on('preview:state', handler);
    return () => ipcRenderer.removeListener('preview:state', handler);
  },
  // PREVIEW side: tell the editor we're mounted and need the current report.
  previewReady: () => ipcRenderer.send('preview:ready'),

  // PREVIEW side ("Final" view): render the REAL PDF — the exact same
  // printToPDF call that Save PDF uses, against the editor window — and get
  // the bytes back so we can show the true paginated document.
  renderPdf: () => ipcRenderer.invoke('preview:render-pdf'),
});
