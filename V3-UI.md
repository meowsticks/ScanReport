# v3 UI — "Workstation" direction

**The focus of v3 is the UI itself** — structure, navigation, and feel —
not colors (colors stay on the locked v2 token system, THEME-ENGINE.md).
Dustin's brief (June 12 2026): desktop-first, "like the GSSI report
program for Windows, almost" — a real engineering application, not a
long-scroll web form.

## Process: UI Lab (mockups first)

Same playbook that produced the locked v2 STEEL report design via
`pdf-mockups/`: build high-fidelity **interactive** mockups, tinker,
lock the winner, then retrofit the real app. Nothing in the live app
changes until a direction is locked.

## Mockup r1 — the Workstation

`gssi-report-app/public/ui-mockups/v3-workstation.html` — one
self-contained file (no build, no network; works from `file://`), served
by every deploy at `/ui-mockups/v3-workstation.html`. Loaded with the
demo report (AKCC-2026-0518, Stuart Olson, P2 parkade).

The shell, top to bottom:

- **Menu bar** — File / Edit / View / Report / Help with working
  dropdowns and shortcuts (View ▸ theme cycle proves v2 tokens carry).
- **Toolbar** — grouped icon buttons (New/Open/Save · Undo/Redo ·
  +Location/+Photo/+Target), the DRAFT ⇄ ISSUED chip, theme cycle, and
  the red **Preview PDF** primary.
- **Report Explorer** (left, resizable) — the report as a tree:
  Project / Field work / Report groups, scan locations as children with
  verdict dots and completion ticks.
- **Workspace** (center) — one focused editor per tree node. Built out:
  project info, slab, equipment, site diagram (live canvas: rebar/PT/
  conduit strokes, hatched no-core zone, verdict pins — locked data
  colors), locations overview, per-location editor (verdict segmented
  control, instruction/notes, depth refs), photos grid, findings table,
  cores schedule, uncertainty, sign-off, CAD stub.
- **Inspector** (right, resizable) — selection properties, completion
  ring, assistant tips.
- **Status bar** — save state, project, DRAFT/ISSUED, counts, theme.
- **Ctrl+K command palette** — jump to any section / run actions.

## Locked constraints (carry into the real v3)

1. Colors remain the v2 token engine; the mockup embeds the same
   `--color-*` names/values. v3 is structure only.
2. Report-data colors (APWA strokes, verdict pins) and the print/preview
   deliverable pipeline are untouchable — same policy as v2.
3. Lockbox: no network, no CDNs; mockups must be self-contained files.

## Retrofit path (after a direction is locked)

The v2 app already separates report data from rendering, and each section
is its own component. The v3 shell replaces the *scroll layout* around
those section components: tree selection ⇄ mounts one section editor in
the workspace. Ship behind a UI switch (v2 default, v3 opt-in) the same
way themes shipped, then flip the default when field-proven. Mobile
keeps the v2 single-scroll (the workstation is a desktop layout).

## Open items for Dustin

- React to r1: what's right/wrong about the tree, inspector, toolbar?
- Tabs for multiple open sections (like RADAN documents) — wanted?
- Keep the mobile app on v2 scroll, or design a v3 phone companion later?
