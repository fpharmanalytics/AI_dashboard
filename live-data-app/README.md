# Live Google Sheets data service

This Apps Script turns the Google Sheet into a read-only JSONP data service for the GitHub Pages dashboard.

It provides:

- `action=dashboard` — all aggregate analytics and the named Top 10;
- `action=lookup&staffId=...` — one staff member's monthly trend;
- `action=ping` — connection test.

The dashboard uses JSONP because Apps Script Content Service redirects its output and browser cross-origin requests can otherwise be unreliable.

## Setup

1. Upload the latest Excel workbook to Google Drive.
2. Open it in Google Sheets and confirm the sheet names are exactly `Details` and `Staff Info`.
3. Open **Extensions → Apps Script**.
4. Replace the contents of `Code.gs` with the supplied `Code.gs`.
5. Open **Project Settings**, enable the manifest file, and replace `appsscript.json` with the supplied manifest.
6. In `Code.gs`, replace `PASTE_GOOGLE_SHEET_ID_HERE` with the ID from the Google Sheet URL.
7. Select **Deploy → New deployment → Web app**.
8. Set **Execute as: Me**.
9. Set access to **Anyone** so the public GitHub Pages site can read the data service.
10. Deploy, authorise, and copy the URL ending in `/exec`.
11. Paste the URL into the dashboard's `config.js` as `dataApiUrl`.

## Test

Open the following address after replacing `YOUR_EXEC_URL`:

`YOUR_EXEC_URL?action=ping`

You should see a JSON response with `"ok":true`.

The dashboard cache lasts five minutes. New monthly rows will therefore appear automatically after the cache expires and the dashboard is refreshed. During testing, add `&refresh=1` to a dashboard request to bypass the cache.

## Access model

The service is technically public because GitHub Pages cannot authenticate to a domain-restricted Apps Script service. The dashboard does not list staff IDs, and individual records are returned only when a valid No. Pekerja is entered. This is an ID-gated lookup, not strong identity-based access control.
