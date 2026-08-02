# Faculty of Pharmacy Gemini Pro Adoption Dashboard

A ready-to-deploy static dashboard for:

`https://fpharmanalytics.github.io/AI-adoption/`

The public site contains aggregate data only. The secure individual lookup is supplied as a separate Google Apps Script web app.

## Included files

- `index.html` — public dashboard page
- `styles.css` — UiTM purple/white/gold/grey theme with Google accent colours
- `app.js` — charts and dashboard interaction
- `config.js` — secure staff-lookup URL
- `data/dashboard-data.json` — aggregate June and July 2026 data
- `tools/monthly-updater.html` — local Excel-to-JSON updater; no installation required
- `private-lookup-app/` — domain-restricted staff self-service and management view
- `.nojekyll` — tells GitHub Pages to serve the files directly

## Current workbook findings

Using an active threshold of `Overall Usage ≥ 4`:

- Total staff: 90
- Active users: 74
- Adoption rate: 82.2%
- KPI target: 80%
- Minimum active users needed: 72
- Margin above target: 2 users / 2.2 percentage points
- Room for improvement: 16 staff
- Zero usage: 8 staff
- Near target with 1–3 uses: 8 staff

Data-quality warning: June and July contain identical `Overall Usage` and `Active Days` values for all 90 staff. Verify the July source data before interpreting the trend.

## Why individual data is separate

GitHub Pages is static hosting. Any staff IDs, emails, names or individual records placed in JavaScript or JSON files can be downloaded by visitors, even when the page only displays one matching record. The public repository therefore contains no raw staff records.

The secure Apps Script application:

- requires a signed-in UiTM Google account;
- checks the entered No. Pekerja against the signed-in email;
- returns only the matching staff record to ordinary users;
- gives named Top 10 and management summaries only to configured manager emails.

See `SETUP_GUIDE.md` for the complete deployment procedure.


## Corrected source data

This package was regenerated from `FF Gemini Adoption Rate 2026(3).xlsx`. The source contains 89 licensed users in June 2026 and 90 in July 2026.
