// Electron main process for the AK ScanReport desktop app.
//
// Responsibilities:
//   - Open the application window (loads the dev server in development, or the
//     built dist/index.html when packaged).
//   - Provide a native File menu (New / Open / Save / Save As / Export PDF).
//   - Handle reading and writing report files on the real filesystem via IPC,
//     so the renderer never touches Node directly (contextIsolation stays on).
//   - Support opening a report file by double-clicking it in the OS.

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs/promises');
const path = require('path');

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || null;
const FILE_FILTERS = [
  { name: 'Scan report', extensions: ['akscan', 'json'] },
  { name: 'All files', extensions: ['*'] },
];

let mainWindow = null;
// A file path passed at launch (double-click / "Open with"), held until the
// renderer asks for it via the 'app:get-launch-file' channel.
let pendingOpenPath = pickFileFromArgv(process.argv);

function pickFileFromArgv(argv) {
  // On Windows/Linux a double-clicked file arrives as a trailing argv entry.
  const candidate = argv.find(
    (a) => /\.(akscan|json)$/i.test(a) && !a.startsWith('--')
  );
  return candidate || null;
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const fileMenu = {
    label: 'File',
    submenu: [
      { label: 'New Report', accelerator: 'CmdOrCtrl+N', click: () => sendToRenderer('menu', 'new') },
      { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => sendToRenderer('menu', 'open') },
      { type: 'separator' },
      { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendToRenderer('menu', 'save') },
      { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendToRenderer('menu', 'save-as') },
      { type: 'separator' },
      { label: 'Export / Print PDF…', accelerator: 'CmdOrCtrl+P', click: () => sendToRenderer('menu', 'print') },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' },
    ],
  };
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    fileMenu,
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 900,
    minWidth: 480,
    minHeight: 600,
    backgroundColor: '#000000',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Open external links (e.g. mailto:, http) in the user's real apps/browser,
  // never inside the Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ---------- IPC: filesystem access on behalf of the renderer ----------

ipcMain.handle('dialog:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open scan report',
    filters: FILE_FILTERS,
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, 'utf8');
  return { path: filePath, name: path.basename(filePath), content };
});

ipcMain.handle('dialog:save', async (_e, { suggestedName, content }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save scan report',
    defaultPath: suggestedName || 'scan-report.akscan',
    filters: FILE_FILTERS,
  });
  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, content, 'utf8');
  return { path: result.filePath, name: path.basename(result.filePath) };
});

ipcMain.handle('file:write', async (_e, { path: filePath, content }) => {
  if (!filePath) return { ok: false, error: 'No file path' };
  await fs.writeFile(filePath, content, 'utf8');
  return { ok: true, name: path.basename(filePath) };
});

ipcMain.handle('file:read', async (_e, filePath) => {
  const content = await fs.readFile(filePath, 'utf8');
  return { path: filePath, name: path.basename(filePath), content };
});

ipcMain.handle('pdf:save', async (_e, { suggestedName, currentFilePath }) => {
  // Render the current report to PDF using the print stylesheet, then save it
  // next to the report file by default so PDFs land in a predictable place.
  const data = await mainWindow.webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
    pageSize: 'Letter',
  });
  const defaultDir = currentFilePath ? path.dirname(currentFilePath) : app.getPath('documents');
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save PDF',
    defaultPath: path.join(defaultDir, suggestedName || 'scan-report.pdf'),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, data);
  shell.showItemInFolder(result.filePath); // reveal so the user sees where it went
  return { path: result.filePath, name: path.basename(result.filePath) };
});

ipcMain.handle('shell:show', async (_e, filePath) => {
  if (filePath) shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle('app:get-launch-file', async () => {
  if (!pendingOpenPath) return null;
  const filePath = pendingOpenPath;
  pendingOpenPath = null;
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return { path: filePath, name: path.basename(filePath), content };
  } catch {
    return null;
  }
});

// ---------- Auto-update ----------

// Checks GitHub Releases for a newer version, downloads it in the background,
// and offers to install on the next restart. No-ops in development and fails
// silently if the network or GitHub is unavailable, so it never blocks use.
// Persist the renderer's work first, then install. Falls back to installing
// anyway if the renderer can't confirm, so an update is never stuck.
function installUpdateAfterSave() {
  let installed = false;
  const finish = () => { if (!installed) { installed = true; autoUpdater.quitAndInstall(); } };
  ipcMain.once('flush-save-done', finish);
  sendToRenderer('flush-save');
  setTimeout(finish, 1000);
}

function setupAutoUpdates() {
  if (DEV_SERVER_URL) return;

  autoUpdater.on('update-downloaded', async (info) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Save & restart', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'Your work is saved automatically and your saved reports carry over. Restart now to finish updating, or choose Later.',
    });
    if (response === 0) installUpdateAfterSave();
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update check failed:', err == null ? 'unknown' : err);
  });

  autoUpdater.checkForUpdates().catch(() => {});
}

// ---------- App lifecycle ----------

// Single-instance: a second launch (e.g. double-clicking another file) routes
// the file to the already-running window instead of opening a new one.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const filePath = pickFileFromArgv(argv);
    if (filePath) {
      fs.readFile(filePath, 'utf8')
        .then((content) => sendToRenderer('open-file', { path: filePath, name: path.basename(filePath), content }))
        .catch(() => {});
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // macOS delivers double-clicked files via this event.
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (mainWindow) {
      fs.readFile(filePath, 'utf8')
        .then((content) => sendToRenderer('open-file', { path: filePath, name: path.basename(filePath), content }))
        .catch(() => {});
    } else {
      pendingOpenPath = filePath;
    }
  });

  app.whenReady().then(() => {
    buildMenu();
    createWindow();
    setupAutoUpdates();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
