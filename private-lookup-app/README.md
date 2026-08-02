# Secure staff lookup — Google Apps Script

This companion web app keeps names, emails, staff IDs and individual usage outside the public GitHub Pages repository.

## Setup

1. Upload the Excel workbook to Google Drive and open it with Google Sheets. Confirm that the two sheet names remain exactly `Details` and `Staff Info`.
2. Copy the Google Sheet ID from its URL. It is the long text between `/d/` and `/edit`.
3. Visit `script.google.com`, create a new project, and name it `FF Gemini Secure Lookup`.
4. Replace the default `Code.gs` content with the supplied `Code.gs`.
5. Add a new HTML file named `Index`, then paste the supplied `Index.html` content.
6. Open **Project Settings**, enable **Show appsscript.json manifest file**, and replace it with the supplied manifest.
7. In `Code.gs`, replace `PASTE_GOOGLE_SHEET_ID_HERE` and add the management email addresses to `managerEmails`.
8. Select **Deploy → New deployment → Web app**.
9. Use **Execute as: Me** so the raw Google Sheet does not need to be shared with all staff.
10. Use **Who has access: Anyone within your UiTM Google Workspace domain**. The exact wording depends on the organisation's Google Workspace settings.
11. Test with your account and with one other UiTM account. Confirm that ordinary users cannot enter another person's No. Pekerja.
12. Copy the deployed `/exec` URL and paste it into `staffLookupUrl` in the public dashboard's `config.js`.

## Important test

The app relies on `Session.getActiveUser().getEmail()` to verify the signed-in UiTM account. This normally works for users in the same Google Workspace domain, but organisational security policies can return a blank email. If that occurs, consult the UiTM Google Workspace administrator or use a centrally approved authentication platform.

## Monthly update

Replace or update the data in the same Google Sheet. The secure app reads the latest rows each time it is opened; no code redeployment is needed unless the column names or sheet names change.
