# Recipe Coster

PWA showing AUD cost of household recipes (total, per serve, cost-to-buy given pantry).
Data lives in a private Google Sheet, served via Apps Script Web App.
Recipes originally exported one-time from AnyList (07/06/2026); all edits now happen in the sheet.

- `export/` — one-time AnyList export script (outputs gitignored)
- `apps-script/Code.gs` — reference copy of the deployed Apps Script
- root — the PWA, deployed via GitHub Pages
