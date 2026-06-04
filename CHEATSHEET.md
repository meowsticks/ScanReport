# Scan Report — Quick Reference 🗒️

Keep this open while you work. It's a plain Markdown file — open it in any editor,
use VS Code's Markdown **Preview** (`Ctrl`+`Shift`+`V`), or print it.

---

## 🖊 Scan-photo annotator
| What | How |
|---|---|
| **Zoom in / out** | **Scroll wheel** — zooms toward the cursor (1×–8×) |
| Zoom by buttons | **− / 100% / +** and **Reset view** in the toolbar |
| **Pan / move** (when zoomed in) | Click **🖐 Pan**, then left-drag — *or* hold **middle-mouse** and drag |
| **Snap a line/arrow to 15°** | **Hold `Shift`** while dragging |
| Place / finish a text label | Type, then **`Enter`** (**`Esc`** cancels) |
| Tools | Draw · Line · Arrow · Circle · Rect · Text |
| Presets | Rebar / PT / Conduit chips set tool + colour + thickness at once |

## 📄 Report editor
| What | How |
|---|---|
| See the exact PDF | **👁 Preview** (it's a full letter-size page) |
| Reorder sections — visual | In **Preview**, drag a section **card** up/down |
| Reorder sections — list | **⚙ Setup → Print setup**, drag the rows by the **⋮⋮** handle |
| Cancel the current action | **`Esc`** |
| Export the PDF | **📄 PDF** → choose *Save as PDF* |
| Save a backup file | **💾 Save** → makes a `.akscan` file |
| Load a report | **📂 Load** → pick a `.akscan` / `.json` |
| Draft ↔ Issued | the **● DRAFT / ✓ ISSUED** pill (top-right) — DRAFT adds the watermark |

---

## ▶ Run it locally (Windows)
In the project's **`gssi-report-app`** folder (the terminal running the server is already there):
```
git pull origin claude/work-session-Sn3Wg     get the latest changes
npm run dev                                    start the local server
```
Then open **http://localhost:5173/**. Stop the server with **`Ctrl`+`C` → `Y`**.

Load the sample report: **📂 Load → `gssi-report-app\samples\sample-full-report.json`**

---

## 🛠 If you ever get a white screen ("Invalid hook call")
A stale browser cache (now mostly auto-prevented). If it returns:
1. Stop the server: **`Ctrl`+`C` → `Y`**
2. `rmdir /s /q node_modules\.vite`
3. `npm run dev`
4. **Close the tab and open a fresh one** — or **`Ctrl`+`Shift`+`N`** (Incognito), which always loads clean.

---
*Living doc — tell me any shortcut or command you want added.*
