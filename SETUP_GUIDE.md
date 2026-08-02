# Step-by-step setup guide

## Part 1 — Prepare the live Google Sheet

1. Upload `FF Gemini Adoption Rate 2026(3).xlsx` to Google Drive.
2. Open the file with Google Sheets.
3. Confirm that the two tabs are named exactly:
   - `Details`
   - `Staff Info`
4. Keep the column headings unchanged.
5. In the Google Sheet URL, copy the long spreadsheet ID between `/d/` and `/edit`.

### Data structure for future months

Add every new monthly record underneath the existing rows in `Details`.

The dashboard expects these columns:

- `BULAN`
- `EMEL GWS`
- `NAMA PENUH`
- `Overall Usage`
- `Active Days`

The `Staff Info` tab is matched using `EMEL GWS` and supplies:

- `NO. PEKERJA`
- `PUSAT PENGAJIAN`
- staff full name

Do not create a separate sheet for each month. Continue appending records to the existing `Details` tab.

## Part 2 — Create the live data service

1. In the Google Sheet, select **Extensions → Apps Script**.
2. Delete the default code.
3. Copy all content from `live-data-app/Code.gs` into the Apps Script editor.
4. Replace:

```javascript
spreadsheetId: 'PASTE_GOOGLE_SHEET_ID_HERE'
```

with the Google Sheet ID copied earlier.

5. Open **Project Settings**.
6. Enable **Show “appsscript.json” manifest file in editor**.
7. Open `appsscript.json` and replace it with the supplied `live-data-app/appsscript.json`.
8. Save the project and name it `FF Gemini Adoption Live Data`.

## Part 3 — Deploy the Apps Script

1. Select **Deploy → New deployment**.
2. Choose **Web app**.
3. Description: `Gemini dashboard live data`.
4. Set **Execute as** to `Me`.
5. Set **Who has access** to `Anyone`.
6. Select **Deploy** and complete the authorisation steps.
7. Copy the deployment URL ending in `/exec`.

### Test the service

Open the deployment URL with:

`?action=ping`

appended to the end. A successful response contains:

```json
{"ok":true}
```

## Part 4 — Connect the dashboard to Google Sheets

Open `config.js` and paste the `/exec` URL:

```javascript
window.DASHBOARD_CONFIG = {
  dataApiUrl: "YOUR_APPS_SCRIPT_EXEC_URL"
};
```

Save the file.

When the URL is configured, the header displays **Live Google Sheet**. If the service is unavailable, the dashboard automatically falls back to the embedded June–July snapshot.

## Part 5 — Upload to GitHub

### For an existing `AI-adoption` repository

1. Download and extract the revised package.
2. Open the `fpharmanalytics/AI-adoption` repository.
3. Replace the existing dashboard files with the contents of the revised package.
4. Remove the old `private-lookup-app` and `tools/monthly-updater.html` files if they remain in the repository.
5. Ensure `index.html` is located at the repository root.
6. Commit the changes with:

`Enable live Google Sheet updates and named Top 10`

### GitHub Pages configuration

1. Open **Settings → Pages**.
2. Select **Deploy from a branch**.
3. Select `main` and `/(root)`.
4. Save.

The site should remain at:

`https://fpharmanalytics.github.io/AI-adoption/`

## Part 6 — Test the dashboard

Verify the following:

1. The source badge says **Live Google Sheet**.
2. June shows 89 licensed staff.
3. July shows 90 licensed staff.
4. June adoption is 75.3% and July adoption is 82.2%.
5. Top 10 shows full names and full Pusat Pengajian names.
6. The staff lookup returns the correct monthly trend after a valid No. Pekerja is entered.
7. The chart and tables remain readable on a phone.

## Part 7 — Monthly update procedure

At the end of every month:

1. Open the live Google Sheet.
2. Append the new month's records to `Details`.
3. Use the full English month name in `BULAN`, for example `AUGUST`.
4. Update `Staff Info` when there is a new licensee, changed email, changed No. Pekerja or changed Pusat Pengajian.
5. Wait up to five minutes for the dashboard cache to expire.
6. Refresh the GitHub dashboard.

The new month will automatically appear in the month selector and all analytics will be recalculated. No GitHub data file needs to be regenerated.

## Pusat Pengajian display names

The dashboard converts the current workbook categories to:

- Pusat Pengajian Amalan Farmasi dan Farmasi Klinikal
- Pusat Pengajian Farmakologi
- Pusat Pengajian Kimia Farmaseutikal
- Pusat Pengajian Sains Hayat
- Pusat Pengajian Teknologi Farmaseutikal
- Pentadbiran Fakulti

These labels can be changed in the `centreDisplay_()` function in `live-data-app/Code.gs` when the faculty confirms a different official wording.

## Current data note

One record in `Staff Info` has No. Pekerja recorded as `0`. The staff member remains included in the faculty and Pusat Pengajian analytics but cannot be found through the individual lookup until a valid No. Pekerja is entered in the Google Sheet.

## Access and privacy limitation

The GitHub page and its live data endpoint are technically public. The lookup requires a valid No. Pekerja but does not verify the visitor's UiTM Google identity. Anyone who knows a staff ID and the dashboard address can retrieve that staff member's trend.

For genuinely faculty-only authentication in the future, the dashboard would need to be hosted behind an identity-aware service rather than ordinary public GitHub Pages.
