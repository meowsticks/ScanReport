// Bundled starter templates so a fresh install is never empty — the operator
// gets ready-made setups at "New report" instead of building from scratch.
// These prefill tier + section toggles + standoff + diagram notes on top of the
// app's built-in equipment / disclaimer / standard-notes defaults. Per-job data
// (client, targets, cores, photos, dates) stays blank. The operator can rename,
// edit, or delete them like any template (they're not re-added once removed).

export const STARTER_TEMPLATES = [
  {
    id: 'starter-slab-coring',
    name: 'Slab scan for coring',
    builtin: true,
    createdAt: 0,
    fields: {
      tier: 'standard',
      scanArea: 'Suspended slab — locate before coring',
      enableStandardNotes: true,
      enableColorLegend: true,
      enableConfidenceBand: true,
      enableZones: false,
      enableCadPage: false,
      enableNamedZones: false,
      coreStandoff: '25 mm',
      diagramNotes: 'Locate top and bottom rebar mats and any PT before coring. Keep all cores clear of marked targets by the standoff margin.',
    },
  },
  {
    id: 'starter-pt-deck',
    name: 'PT deck scan',
    builtin: true,
    createdAt: 0,
    fields: {
      tier: 'full',
      scanArea: 'Post-tension deck',
      enableStandardNotes: true,
      enableColorLegend: true,
      enableConfidenceBand: true,
      enableZones: true,
      enableNamedZones: true,
      enableCadPage: false,
      coreStandoff: '100 mm',
      diagramNotes: 'Post-tension deck — treat all PT bands as LIVE until physically confirmed inactive. Hatch no-go zones over tendon paths; keep cores well clear of marked cables.',
    },
  },
  {
    id: 'starter-wall-locate',
    name: 'Wall / general locate',
    builtin: true,
    createdAt: 0,
    fields: {
      tier: 'standard',
      scanArea: 'Wall / general locate',
      enableStandardNotes: true,
      enableColorLegend: true,
      enableConfidenceBand: true,
      enableZones: false,
      enableCadPage: false,
      enableNamedZones: false,
      coreStandoff: '25 mm',
      diagramNotes: 'Locate rebar, conduit, and embedded services before drilling, cutting, or anchoring.',
    },
  },
  {
    id: 'starter-quick-mark',
    name: 'Quick field mark',
    builtin: true,
    createdAt: 0,
    fields: {
      tier: 'quick',
      enableStandardNotes: false,
      enableColorLegend: true,
      enableConfidenceBand: false,
      enableZones: false,
      enableCadPage: false,
      enableNamedZones: false,
      coreStandoff: '25 mm',
    },
  },
];
