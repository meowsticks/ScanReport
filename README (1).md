# Mockup assets

## logo.png (or logo.jpg / logo.svg)

Drop the Aggarwal Kamikazes logo here. Filename: `logo.png`.

The mockup HTML files reference `assets/logo.png` directly. Until the file is in place, the letterhead and footer logo slots show a brown circular fallback placeholder.

**What to commit:** the full logo as supplied — Tasmanian-devil mascot in the gear silhouette, with the "AGGARWAL KAMIKAZES" chrome wordmark and "CUTTING AND CORING" ribbon banner beneath. Transparent background. Any reasonable resolution (the production app and these mockups scale it down).

**Why one file is enough:** the same image goes into both the 60×60 letterhead slot and the 24×24 footer slot. The browser/PDF renderer handles the downscale. The wordmark below the mascot becomes small at footer size — that's expected and acceptable per design decision (2026-05-27).
