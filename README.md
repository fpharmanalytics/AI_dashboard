# Faculty of Pharmacy Gemini Pro Adoption Dashboard — Live Data Version

Deployment address:

`https://fpharmanalytics.github.io/AI-adoption/`

## Improvements in this version

- Reads directly from a live Google Sheet through Google Apps Script.
- Updates automatically after new monthly rows are added to the `Details` sheet.
- Shows full names, full Pusat Pengajian names and usage for the Top 10 users.
- Provides a staff-ID lookup within the dashboard.
- Allows a valid staff ID to retrieve that staff member's complete monthly trend.
- Uses the corrected denominators: 89 licensees in June 2026 and 90 in July 2026.
- Keeps the existing UiTM–Google visual design.

## Folder contents

- `index.html` — dashboard interface and staff lookup dialog
- `styles.css` — UiTM purple, white, gold and grey theme with Google accents
- `app.js` — live data loading, charts, tables and individual trend lookup
- `config.js` — Google Apps Script data-service URL
- `data/dashboard-data.json` — current workbook snapshot and offline fallback
- `live-data-app/Code.gs` — Google Sheets live data service
- `live-data-app/appsscript.json` — Apps Script project manifest
- `SETUP_GUIDE.md` — complete deployment instructions
- `.nojekyll` — serves files directly through GitHub Pages

## Monthly workflow after setup

1. Add the new month's usage rows to the Google Sheet's `Details` tab.
2. Add or amend staff details in `Staff Info` when necessary.
3. Refresh the GitHub dashboard after approximately five minutes.

No new JSON file or GitHub commit is required for routine monthly data updates.

## Important access note

GitHub Pages is a public static website. The live Apps Script service must also allow public read access so the page can retrieve data without a separate sign-in flow. The individual lookup is therefore controlled by knowledge of a valid staff ID rather than verified UiTM identity.

The main dashboard does not display staff IDs. It returns one individual's trend only after a matching ID is entered. This matches the requested low-confidentiality use model but is not strong security.
