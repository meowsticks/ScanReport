// Per-client / per-workflow templates.
//
// A template is a saved snapshot of the *setup* fields of a report (client,
// equipment, sign-off, section toggles, disclaimer...). Creating a report from
// a template pre-fills those fields, while per-job data (photos, targets,
// dates) stays empty so the user fills it in for the new job.

const KEY = 'ak_templates';

export function newTemplateId() {
  return 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

export function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

export function saveTemplates(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

// Fields a template captures. Excludes per-job data (photos, targets, cores,
// scanLocations, diagram*, dates) so applying a template never inherits stale
// project content.
export const TEMPLATE_FIELDS = [
  'tier',
  'client', 'siteAddress', 'scanArea',
  'weather', 'surface',
  'slabThickness', 'slabAge', 'scanCoverage',
  'scanner', 'antenna', 'serialNo', 'firmware',
  'scanMode', 'dielectric', 'scanDensity', 'depthRange',
  'preparedBy', 'preparedRole', 'preparedCert',
  'reviewedBy', 'reviewedRole',
  'egbcEnabled', 'permitNo',
  'limitations', 'legalDisclaimer',
  'enableZones', 'enableCadPage', 'enableStandardNotes', 'enableNamedZones',
  'brandFlourishes', 'enableColorLegend', 'enableConfidenceBand',
  'coreStandoff',
  'enableQR', 'qrUrl',
  'sectionOrder',
  'customReminders', 'assistantOn',
  'drawingScale', 'diagramNotes',
];

export function extractTemplateFields(report) {
  const out = {};
  if (!report) return out;
  TEMPLATE_FIELDS.forEach((k) => { if (report[k] !== undefined) out[k] = report[k]; });
  return out;
}
