# Step-by-step deployment guide

## Part A — Create the `fpharmanalytics` GitHub organisation

The requested address requires the repository owner to be named `fpharmanalytics`.

1. Sign in to GitHub using your existing account.
2. Click your profile picture at the top right.
3. Select **Your organisations**.
4. Click **New organisation**.
5. Choose the free plan for the public aggregate dashboard.
6. Enter the organisation name: `fpharmanalytics`.
7. Enter your contact email and complete the setup.
8. Keep your personal GitHub account as the organisation owner. You retain full administrative control.

If the name is unavailable, the URL must use a different available organisation name, or you must use your existing username in the address.

## Part B — Create the dashboard repository

1. Open the `fpharmanalytics` organisation page.
2. Click **New repository**.
3. Repository name: `AI-adoption`.
4. Description: `Faculty of Pharmacy Gemini Pro adoption dashboard`.
5. Select **Public**. The public repository must contain aggregate data only.
6. Do not add a README, `.gitignore` or licence because these are already in the starter package.
7. Click **Create repository**.

The project-site URL pattern is:

`https://<owner>.github.io/<repository>/`

Therefore the required URL will be:

`https://fpharmanalytics.github.io/AI-adoption/`

## Part C — Upload the dashboard files

### Easiest method: GitHub website

1. Extract `AI-adoption-dashboard-starter.zip` on your Mac.
2. Open the new `AI-adoption` repository in GitHub.
3. Click **Add file → Upload files**.
4. Drag all contents from inside the extracted folder into the upload area. Upload the contents, not the outer folder itself.
5. Confirm that `index.html` is visible at the top level of the repository.
6. Enter the commit message: `Initial Gemini adoption dashboard`.
7. Click **Commit changes**.

### Alternative: GitHub Desktop

1. Clone `fpharmanalytics/AI-adoption` in GitHub Desktop.
2. Open the local repository folder.
3. Copy all starter-package contents into that folder.
4. In GitHub Desktop, enter the summary `Initial Gemini adoption dashboard`.
5. Click **Commit to main** and then **Push origin**.

## Part D — Turn on GitHub Pages

1. In the repository, click **Settings**.
2. In the left sidebar, click **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch `main` and folder `/(root)`.
5. Click **Save**.
6. Return to the Pages screen and click **Visit site** after deployment completes.

The dashboard should appear at:

`https://fpharmanalytics.github.io/AI-adoption/`

## Part E — Review the public dashboard

Before sharing the link:

1. Select June and July from the month menu.
2. Confirm that June contains 89 licensees and July contains 90 licensees.
3. Confirm the month-specific adoption rates and centre totals shown in the dashboard match the corrected workbook.
4. Check the charts on desktop and mobile.
5. Confirm no names, emails or No. Pekerja values appear in the GitHub repository or page source.

The public Top 10 is intentionally anonymised. Full names are available only through the secure management view described below.

## Part F — Create the secure staff lookup

1. Upload the workbook to Google Drive.
2. Open it with Google Sheets and confirm the sheet names remain `Details` and `Staff Info`.
3. Follow `private-lookup-app/README.md` to create and deploy the Apps Script web app.
4. Restrict access to the UiTM Google Workspace domain.
5. Test an ordinary staff account:
   - correct No. Pekerja should display that staff member's record;
   - another staff member's number should be rejected.
6. Test a management email listed in `managerEmails`.
7. Copy the Apps Script `/exec` URL.
8. Edit `config.js` in GitHub and paste the URL:

```javascript
window.DASHBOARD_CONFIG = {
  staffLookupUrl: "PASTE_THE_APPS_SCRIPT_EXEC_URL_HERE"
};
```

9. Commit the change. The **Check my usage securely** button will become active.

## Part G — Update the dashboard every month

1. Add the new month's rows to the `Details` sheet in the Excel workbook.
2. Update `Staff Info` only when staffing or Pusat Pengajian details change.
3. Open `tools/monthly-updater.html` by double-clicking it on your Mac.
4. Select the updated Excel workbook.
5. Confirm threshold `4`, KPI target `80`, and year `2026`.
6. Click **Process workbook**.
7. Review the preview and any data-quality warnings.
8. Click **Download dashboard-data.json**.
9. In GitHub, open the `data` folder and replace `dashboard-data.json` with the newly generated file.
10. Commit with a message such as `Add August 2026 Gemini usage`.
11. Update the converted Google Sheet used by the secure Apps Script app. The private lookup reads the updated sheet automatically.

## Part H — Recommended governance

- Keep the original Excel workbook and converted Google Sheet restricted to authorised committee members.
- Do not upload the raw workbook to the public repository.
- Obtain faculty approval before publishing identifiable rankings, even in a domain-restricted management view.
- Document the KPI definition as `Overall Usage ≥ 4`; the current workbook request contained both “more than 4” and “at least 4”, so the dashboard uses the latest stated rule: at least 4.
- Assign at least one additional organisation owner to prevent loss of access, while keeping yourself as owner and repository administrator.
