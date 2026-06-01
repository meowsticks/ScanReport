# AK ScanReport — v2 Cleanup Manifest

> Purpose: stop the "frankenstein" sprawl. One canonical branch, one clean v2.
> **Nothing is deleted until you sign off on this file.**
> Date: 2026-06-01

## TL;DR

- **Canonical branch = `claude/work-session-Sn3Wg`** (current, master-based, has v1.0.14 + today's work).
- The full finalized letterhead now lives **in the app** here (it was never integrated before — it only existed as standalone PDF mockups on the other branch).
- We **port** the page-break-safe card work from `claude/4.7-4.8-comparison-JvG2S`, then **retire** that branch and all the design scaffolding.

---

## Why this branch (not the other one)

Both branches forked from **v1.0.14** and advanced in parallel — neither is "behind."

| | `work-session-Sn3Wg` (KEEP as base) | `4.7-4.8-comparison-JvG2S` (harvest, then retire) |
|---|---|---|
| Logo asset (`assets/logo.png`) | ✅ committed | uses `pdf-mockups/logo.png` |
| DRAFT watermark in app | ✅ committed | ❌ |
| **Full letterhead in app** (meta box, subtitle) | ✅ today (`ak-lh`, uncommitted) | ❌ — only a simple 2-tone ribbon in-app; full design lives only in `pdf-mockups/` |
| Caveat fonts in app | ✅ today (uncommitted) | ✅ |
| Page-break-safe **DOM wiring** | ❌ (only base CSS) | ✅ **port this** |
| Confidence-pill readability fix | ❔ verify | ✅ maybe port |
| `pdf-mockups/` design scaffolding | — | 🗑 scaffolding (served its purpose) |

---

## KEEP (already on `work-session-Sn3Wg`)

| Item | State | Notes |
|---|---|---|
| `assets/logo.png` | committed `ea2dab6` | full AK mark, confirmed by you |
| DRAFT watermark (`report.status`, toolbar pill, overlay) | committed `c9804bd` | tested, regression 9/9 |
| Letterhead `ak-lh` (Caveat two-tone + project/operator/date) | **uncommitted** | the finalized midjob design, now in-app |
| `public/fonts/caveat-400/700.woff2` | **uncommitted** | required by the letterhead |
| v1 app structure + all 23 sections + legal disclaimer | inherited from v1.0.14 | the engineer-grade content |

## PORT from `4.7-4.8-comparison-JvG2S` (re-apply onto this branch)

| Commit | What | Decision |
|---|---|---|
| `2635412` | Print: stop target rows, core cards & headings splitting across pages | **PORT** |
| `1000c3c` | Wire `break-inside` classes onto the real target/core DOM elements | **PORT** |
| `c959e8d` | Print: never clip scan-location cards — flow, don't cut | **PORT** (verify vs base) |
| `9062671` | Confidence-pill readability (white text on solid) | **EVALUATE** — port if not already fine |
| `e72a555`/`479c58c` | in-app Caveat ribbon / centered name | **SKIP** — superseded by `ak-lh` |
| `818338c` | `build-testhtml.mjs` self-contained review build | **OPTIONAL** — handy tooling; keep or drop (your call) |

## DELETE (scaffolding — served its purpose)

| Path | Lives on | Why delete |
|---|---|---|
| `pdf-mockups/` (entire: playground, build-*.mjs, concept PNGs, sample PDFs, content.mjs) | branch B only | design exploration; letterhead design already extracted into the app |
| `01projectnumbers.html` … `05brandingcustomization.html` | working tree | feature mockups; features now tracked in-app / roadmap |
| `index.html` (mockup hub) | working tree | only links the 01–05 mockups |
| `README (1).md` | working tree | duplicate of `README.md` |
| `pdf-cleanup-checklist.md` | branch B only | scratch checklist |

## MOVE / ARCHIVE

| Path | Action |
|---|---|
| `v1015roadmap.md` | **MOVE → `docs/v1015roadmap.md`** (keep as planning record) |
| branch `claude/4.7-4.8-comparison-JvG2S` | **ARCHIVE/DELETE after porting** (it's the source of the frankenstein confusion) |

## OPEN QUESTIONS (need your call)

1. **Letterhead = `ak-lh` (full meta-box, your midjob screenshot).** Confirm this is THE one, and we skip branch B's simpler in-app ribbon. ✅/❌
2. **`build-testhtml.mjs`** (one-file engineer review build) — keep as tooling, or delete? 
3. **Root mockups (01–05 + index.html)** — hard-delete, or move to `docs/mockups/` for reference?
4. **Delete branch `4.7-4.8-comparison-JvG2S`** after we harvest the page-break commits? (Or leave it as a frozen archive.)

## EXECUTION ORDER (after sign-off)

1. Commit today's uncommitted work (letterhead + fonts) on `work-session-Sn3Wg`.
2. Port page-break commits (`2635412`, `1000c3c`, `c959e8d`) — cherry-pick or hand-apply; resolve CSS conflicts.
3. Verify on localhost: preview + multi-page PDF, regression test (print colors), no split cards.
4. Delete scaffolding per the DELETE table; move roadmap to `docs/`.
5. (Optional) retire branch B.
6. Final review build + push.

---

*This manifest is the source of truth for the v2 cleanup. Edit the decisions above, then I execute.*
