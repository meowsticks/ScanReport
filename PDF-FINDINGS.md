# PDF Findings — punch list (v1)

**Principle: NO rewrite.** Keep the current cards, layout, and fonts. These are
surgical `@media print` / structure tweaks. Tags: 🟢 quick · 🟡 medium · 🔴 bigger / needs a decision.
Each item has a 💡 extra idea.

---

## A. Page integrity — CRITICAL (content must never be lost)

**A1 — Page 6 overflows; lettering overlaps** 🟡
- Reported: page 6 too big, spills past the page; text overlapping itself.
- Likely cause: a figure/card taller than one page with no cap, or an absolutely-
  positioned element overlapping flow text. Print rules live ~`GSSIReportApp.jsx:5872`.
- Fix: enforce `break-inside: avoid` per block, cap figure/photo heights to the page,
  keep content in normal flow (no fixed heights that overlap).
- 💡 Extra: auto-scale any single block taller than the page so it shrinks to fit
  instead of overflowing.

**A2 — Info lost in the page-break "deadzones" (esp. page 1→2)** 🔴 **TOP PRIORITY**
- Reported: content disappears in the gap between pages; page 1/2 lost info that
  could null the report → resend.
- Likely cause: an element landing in the unprintable margin and clipping, or
  `overflow:hidden` / fixed height cutting content at a break.
- Fix: audit every section for clipping; drop fixed heights/overflow in print;
  verify with a full multi-page render diff (nothing vanishes).
- 💡 Extra: a debug render that outlines each section so we can SEE exactly what
  clips at each break.

---

## B. Light-mode legibility

**B1 — Borders feel thin & bland** 🟢
- Print borders are hairline #999/#bbb (~`5729`,`5758`). Bump to ~1.2–1.5px and
  darker. Same style, just fuller lines.
- 💡 Extra: a faint filled header bar per card so blocks read as distinct without heavy borders.

**B2 — Large fonts look blurry in light PDF** 🟡
- Likely sub-pixel scaling / light weight. Use real font weights (no CSS transforms),
  `print-color-adjust: exact`.
- 💡 Extra: nudge big headings one weight heavier so they render solid, not hairline.

**B3 — Lines "melting" into the white background** 🟢
- Same root as B1 — raise hairline contrast in `@media print` (darker / near-black).

**B4 — Letters too tight ("Hi" almost overlapping)** 🟢
- Add a touch of `letter-spacing`; remove any negative tracking in print; check the
  tabular-nums / condensed spots.
- 💡 Extra: minimum letter-spacing on headings/labels only, leave body text alone.

---

## C. Branding & disclaimer — 🔴 DESIGN CHANGE (needs your OK)

**C1 — Tone down the company wordmark; make the disclaimer unavoidable**
- Reported: not the fancy script — one consistent font thickness, company stuff
  compact up top "out of the way," then focus on report + disclaimer so the engineer
  MUST glance at it before dismissing.
- ⚠️ This **overrides the "locked" STEEL Caveat wordmark** (CLAUDE.md). Proposed:
  replace the Caveat two-tone script with a clean single-weight company name
  (bold Inter), kept compact at the top.
- Disclaimer placement (you said "wherever best"): rec = compact **bordered disclaimer
  band on page 1** (unavoidable) + full disclaimer at the end.
- 💡 Extra: a thin red-ruled "Read before relying on this report" pointer on the band.

---

## D. Color balance (light mode) — 🟡

**D1 — Page 3 photos small; high-conf color + annotations bleached out**
- Enlarge scan photos in print; deepen verdict/confidence colors for white paper
  (the dark-theme colors wash out when printed). Tune Safe/Caution/No-go + confidence
  chips specifically for light mode.
- 💡 Extra: min photo width in 2-up (~45–48%) + a thin frame so they don't float.

---

## E. Card styling — 🟢

**E1 — "CONCRETE SCANNING DATA / L1" red header looks bad; red left-accent is a
straight line not following the card's rounded corner**
- Cause: `.scan-location-card .loc-header` solid neon #e02020 (~`5910`) + the red
  `border-left` accent with `border-radius:0` in print (~`5906`) so the accent
  doesn't round with the card.
- Fix: deepen/soften the header red (less neon) or swap the full fill for a slim red
  rule; make the accent follow the corner radius.
- 💡 Extra: white header + red bottom-rule + small red corner tab — cleaner, less ink.

---

## F. Workflow & metadata — 🟡 / 🔴

**F1 — "Tier: Full" shows but shouldn't** 🟢
- Hide the Tier indicator from the report/PDF (internal setting only).

**F2 — EGBC / BC-engineering seal & liability** 🔴 (confirm)
- You said it "isn't making us liable." Confirm intent: remove the EGBC seal block
  entirely, or only show it when an actual P.Eng stamps?

**F3 — Authorship & Review → approval workflow** 🔴 (confirm)
- Reported: the *scanner* fills this out; an engineer won't type into the PDF — they
  review and approve by email, then the app should mark the report **Approved & archived**.
- Change: "Reviewed by" = the engineer-of-record name the tech enters for the record
  (not an engineer input). Add an **Approved** status + archive action (set status,
  lock the report, file it).
- 💡 Extra: prints "Approved by [name] on [date] via email" once marked — clean audit trail.

---

## Suggested order
1. **A2** (page-break info loss — can null a report)
2. **A1** (page 6 overflow/overlap)
3. **B1+B3+B4** (borders + line contrast + letter spacing — one light-mode legibility pass)
4. **E1** (red header + curved accent)
5. **D1** (photo size + light-mode color balance)
6. **B2** (heading blur)
7. **F1** (hide Tier) → **C1** (wordmark/disclaimer) → **F2/F3** (EGBC + approval workflow)

Work top-down, one targeted fix at a time, re-render proof for each.
