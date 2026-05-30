# PDF Letterhead Concepts

Three clean, engineer-facing letterhead treatments for the printed scan report.
Same report body in each — only the masthead/branding differs. Rendered at US Letter.

| File | Concept | Character |
|------|---------|-----------|
| `A-refined-classic.png` | **Refined Classic** | Your current centered-logo look, tidied: big mascot, company name, neutral rule, meta row. Closest to what's shipping. |
| `B-engineering-letterhead.png` | **Engineering Letterhead** | Logo left + company block + a top-right project/operator/date box. Reads like a structural firm's letterhead. Designed to repeat on every page. |
| `C-side-spine.png` | **Side Spine** | Compact top masthead plus a red vertical spine carrying the company name + page number (from the v1.0.15 roadmap). |
| `D-centered-hybrid.png` | **Centered Hybrid** | The merge: B's polish + C's centering & red side-spine. Centered mascot, name, red sub-rule, centered project/operator/date meta. Flat = the real printable page. |
| `D-vignette-soft.png` / `D-vignette-strong.png` | **Vignette surround** | The Centered Hybrid shown inside a darkened matte that focuses the eye on the page — like a photo vignette. The vignette is in the **on-screen surround only**; the page (and the emailed PDF) stays pristine white. |

## Files

- `content.mjs` — single source of truth: brand CSS, report body, logo, chromium path.
- `build.mjs` — renders concepts A/B/C.
- `build-vignette.mjs` — renders the Centered Hybrid (D) flat + soft/strong vignette surrounds.

## Regenerate

```bash
cd pdf-mockups
ln -s /path/to/playwright-core/.. node_modules   # playwright-core must resolve
node build.mjs                                    # writes *.html and *.png
```

`build.mjs` shares one report body and swaps only the header block + a little CSS,
so it's the testbed for picking a direction before touching `GSSIReportApp.jsx`.
