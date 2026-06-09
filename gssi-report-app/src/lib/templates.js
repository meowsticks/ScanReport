// Per-client / per-workflow templates.
//
// A template is a saved snapshot of the *setup* fields of a report (client,
// equipment, sign-off, section toggles, disclaimer...). Creating a report from
// a template pre-fills those fields, while per-job data (photos, targets,
// dates) stays empty so the user fills it in for the new job.

import { STARTER_TEMPLATES } from './starterTemplates.js';

const KEY = 'ak_templates';
const SEED_KEY = 'ak_templates_seeded';

export function newTemplateId() {
  return 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

export function loadTemplates() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    // First run on a device: drop in the bundled starter templates so the
    // operator isn't staring at an empty list. The seed flag means deleting a
    // starter sticks (we don't re-add it on the next launch).
    if (!localStorage.getItem(SEED_KEY)) {
      const have = new Set(list.map((t) => t.id));
      const merged = [...list, ...STARTER_TEMPLATES.filter((t) => !have.has(t.id))];
      localStorage.setItem(KEY, JSON.stringify(merged));
      localStorage.setItem(SEED_KEY, '1');
      return merged;
    }
    return list;
  } catch {
    return STARTER_TEMPLATES.slice();
  }
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

// Display metadata for the template editor: label + how to render the value.
// 'text' (default), 'textarea', 'lines' (array of strings, one per line),
// 'bool', 'select' (with options), or 'preview' (read-only summary).
export const TEMPLATE_FIELD_META = {
  tier: { label: 'Tier', type: 'select', options: ['quick', 'standard', 'full'] },
  client: { label: 'Client', type: 'text' },
  siteAddress: { label: 'Default site address', type: 'text' },
  scanArea: { label: 'Default scan area', type: 'text' },
  weather: { label: 'Weather default', type: 'text' },
  surface: { label: 'Surface default', type: 'text' },
  slabThickness: { label: 'Slab thickness default', type: 'text' },
  slabAge: { label: 'Slab age default', type: 'text' },
  scanCoverage: { label: 'Scan coverage default', type: 'text' },
  scanner: { label: 'Scanner', type: 'text' },
  antenna: { label: 'Antenna', type: 'text' },
  serialNo: { label: 'Serial #', type: 'text' },
  firmware: { label: 'Firmware', type: 'text' },
  scanMode: { label: 'Scan mode', type: 'text' },
  dielectric: { label: 'Dielectric', type: 'text' },
  scanDensity: { label: 'Scan density', type: 'text' },
  depthRange: { label: 'Depth range', type: 'text' },
  preparedBy: { label: 'Prepared by', type: 'text' },
  preparedRole: { label: 'Prepared role', type: 'text' },
  preparedCert: { label: 'Prepared cert #', type: 'text' },
  reviewedBy: { label: 'Reviewed by', type: 'text' },
  reviewedRole: { label: 'Reviewed role', type: 'text' },
  egbcEnabled: { label: 'P.Eng stamp', type: 'bool' },
  permitNo: { label: 'Permit #', type: 'text' },
  limitations: { label: 'Limitations (one per line)', type: 'lines' },
  legalDisclaimer: { label: 'Legal disclaimer', type: 'textarea' },
  enableZones: { label: 'Hatched zones', type: 'bool' },
  enableCadPage: { label: 'CAD page', type: 'bool' },
  enableStandardNotes: { label: 'Standard notes', type: 'bool' },
  enableNamedZones: { label: 'Named zones', type: 'bool' },
  brandFlourishes: { label: 'Brand flourishes', type: 'bool' },
  enableColorLegend: { label: 'Color legend', type: 'bool' },
  enableConfidenceBand: { label: 'Confidence band', type: 'bool' },
  enableQR: { label: 'QR code on report', type: 'bool' },
  qrUrl: { label: 'QR URL', type: 'text' },
  coreStandoff: { label: 'Core standoff', type: 'text' },
  sectionOrder: { label: 'Custom section order', type: 'preview' },
  customReminders: { label: 'Custom reminders', type: 'preview' },
  assistantOn: { label: 'Assistant on', type: 'bool' },
  drawingScale: { label: 'Drawing scale', type: 'text' },
  diagramNotes: { label: 'Diagram notes', type: 'textarea' },
};

export const TEMPLATE_FIELD_GROUPS = [
  { label: 'Project & client',    keys: ['tier', 'client', 'siteAddress', 'scanArea'] },
  { label: 'Conditions',          keys: ['weather', 'surface', 'slabThickness', 'slabAge', 'scanCoverage'] },
  { label: 'Equipment',           keys: ['scanner', 'antenna', 'serialNo', 'firmware'] },
  { label: 'Calibration',         keys: ['scanMode', 'dielectric', 'scanDensity', 'depthRange'] },
  { label: 'Sign-off',            keys: ['preparedBy', 'preparedRole', 'preparedCert', 'reviewedBy', 'reviewedRole', 'egbcEnabled', 'permitNo'] },
  { label: 'Sections & toggles',  keys: ['enableZones', 'enableCadPage', 'enableStandardNotes', 'enableNamedZones', 'brandFlourishes', 'enableColorLegend', 'enableConfidenceBand', 'enableQR', 'qrUrl', 'coreStandoff'] },
  { label: 'Layout & notes',      keys: ['sectionOrder', 'drawingScale', 'diagramNotes'] },
  { label: 'Assistant',           keys: ['assistantOn', 'customReminders'] },
  { label: 'Legal',               keys: ['limitations', 'legalDisclaimer'] },
];
