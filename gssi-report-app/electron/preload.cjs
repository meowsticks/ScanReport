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
});
