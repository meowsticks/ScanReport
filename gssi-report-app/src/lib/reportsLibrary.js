// Local multi-report library.
//
// Each report is stored under its own key (ak_report_<id>) so editing one never
// re-serializes the others — important for speed and localStorage headroom with
// photo-heavy reports. A lightweight index (ak_reports_index) holds just
// { id, name, updatedAt } for the picker, and ak_current_report tracks which is
// open. On first run we migrate the legacy single report + any saved drafts in.

const INDEX_KEY = 'ak_reports_index';
const CURRENT_KEY = 'ak_current_report';
const DATA_PREFIX = 'ak_report_';
const LEGACY_REPORT_KEY = 'gssi_report_v2';
const LEGACY_DRAFTS_KEY = 'ak_drafts';

export function newId() {
  return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function read(key, fallback) {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; }
  catch { return fallback; }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch { return false; }
}

export function loadIndex() { return read(INDEX_KEY, []); }
export function saveIndex(idx) { write(INDEX_KEY, idx); }
export function loadReport(id) { return read(DATA_PREFIX + id, null); }
export function saveReport(id, report) { return write(DATA_PREFIX + id, report); }
export function removeReport(id) { try { localStorage.removeItem(DATA_PREFIX + id); } catch {} }
export function getCurrentId() { try { return localStorage.getItem(CURRENT_KEY) || null; } catch { return null; } }
export function setCurrentId(id) { try { localStorage.setItem(CURRENT_KEY, id); } catch {} }

// Returns { index, currentId, currentReport }. Builds/migrates the library if
// it doesn't exist yet so the app always has at least one report.
export function ensureLibrary(defaultReport, deriveName) {
  let index = loadIndex();

  if (index.length > 0) {
    let cur = getCurrentId();
    if (!cur || !index.some((e) => e.id === cur)) { cur = index[0].id; setCurrentId(cur); }
    return { index, currentId: cur, currentReport: { ...defaultReport, ...(loadReport(cur) || {}) } };
  }

  index = [];
  const now = Date.now();
  let currentId = null;

  const legacy = read(LEGACY_REPORT_KEY, null);
  if (legacy && typeof legacy === 'object') {
    const id = newId();
    const r = { ...defaultReport, ...legacy };
    saveReport(id, r);
    index.push({ id, name: deriveName(r), updatedAt: now });
    currentId = id;
  }

  const drafts = read(LEGACY_DRAFTS_KEY, []);
  if (Array.isArray(drafts)) {
    drafts.forEach((d) => {
      if (!d || !d.report) return;
      const id = newId();
      const r = { ...defaultReport, ...d.report };
      saveReport(id, r);
      index.push({ id, name: d.name || deriveName(r), updatedAt: d.savedAt || now });
    });
  }

  if (index.length === 0) {
    const id = newId();
    saveReport(id, defaultReport);
    index.push({ id, name: deriveName(defaultReport), updatedAt: now });
    currentId = id;
  }
  if (!currentId) currentId = index[0].id;

  saveIndex(index);
  setCurrentId(currentId);
  return { index, currentId, currentReport: { ...defaultReport, ...(loadReport(currentId) || {}) } };
}
