const CONFIG = Object.freeze({
  // Replace with the ID of the Google Sheet containing the converted workbook.
  spreadsheetId: 'PASTE_GOOGLE_SHEET_ID_HERE',
  detailsSheetName: 'Details',
  staffSheetName: 'Staff Info',
  activeThreshold: 4,
  targetRate: 80,

  // Add management email addresses in lowercase. Managers may search any staff ID
  // and view the named Top 10 table. Ordinary users may view only their own record.
  managerEmails: [
    'your.email@uitm.edu.my'
  ]
});

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Gemini Pro Usage — Secure Staff View');
}

function getAppContext() {
  const email = getActiveEmail_();
  if (!email) {
    return {
      ok: false,
      message: 'Your UiTM email address could not be verified. Ensure the web app is restricted to the UiTM domain and test the deployment with another UiTM account.'
    };
  }

  return {
    ok: true,
    email: maskEmail_(email),
    isManager: isManager_(email),
    activeThreshold: CONFIG.activeThreshold,
    targetRate: CONFIG.targetRate
  };
}

function lookupUsage(staffIdInput) {
  const email = getActiveEmail_();
  if (!email) throw new Error('UiTM account verification failed. Please sign in using your UiTM Google account.');

  const staffId = normaliseStaffId_(staffIdInput);
  if (!staffId) throw new Error('Enter a valid No. Pekerja.');

  const data = loadData_();
  const staff = data.staffById[staffId];
  if (!staff) throw new Error('No matching staff record was found. Check the No. Pekerja entered.');

  const manager = isManager_(email);
  if (!manager && normaliseEmail_(staff.email) !== email) {
    throw new Error('The No. Pekerja does not match the signed-in UiTM account. You may access only your own record.');
  }

  const records = data.details
    .filter(row => normaliseEmail_(row.email) === normaliseEmail_(staff.email))
    .sort((a, b) => monthIndex_(a.month) - monthIndex_(b.month));

  if (!records.length) throw new Error('No monthly Gemini usage record was found for this staff member.');

  const months = records.map(row => ({
    month: titleCase_(row.month),
    usage: row.usage,
    activeDays: row.activeDays,
    active: row.usage >= CONFIG.activeThreshold,
    progress: Math.min(100, Math.round((row.usage / CONFIG.activeThreshold) * 100))
  }));

  const latest = months[months.length - 1];
  return {
    ok: true,
    isManager: manager,
    staff: {
      name: staff.name,
      staffId: staff.staffId,
      centre: staff.centre,
      email: maskEmail_(staff.email)
    },
    latest,
    months,
    definition: `Active = Overall Usage ≥ ${CONFIG.activeThreshold} in a month`
  };
}

function getManagementSummary(monthInput) {
  const email = getActiveEmail_();
  if (!email || !isManager_(email)) throw new Error('Management access is restricted.');

  const data = loadData_();
  const availableMonths = [...new Set(data.details.map(row => row.month))]
    .filter(Boolean)
    .sort((a, b) => monthIndex_(a) - monthIndex_(b));
  const selectedMonth = String(monthInput || availableMonths[availableMonths.length - 1]).trim().toUpperCase();
  const rows = data.details.filter(row => row.month === selectedMonth);
  if (!rows.length) throw new Error('No records were found for the selected month.');

  const enriched = rows.map(row => {
    const staff = data.staffByEmail[normaliseEmail_(row.email)] || {};
    return {
      name: staff.name || row.name || 'Unknown',
      staffId: staff.staffId || '',
      centre: staff.centre || 'Not matched',
      usage: row.usage,
      activeDays: row.activeDays
    };
  });

  const active = enriched.filter(row => row.usage >= CONFIG.activeThreshold).length;
  const centreMap = {};
  enriched.forEach(row => {
    const key = row.centre;
    if (!centreMap[key]) centreMap[key] = { centre: key, staff: 0, active: 0, below: 0, zero: 0 };
    centreMap[key].staff += 1;
    if (row.usage >= CONFIG.activeThreshold) centreMap[key].active += 1;
    else centreMap[key].below += 1;
    if (row.usage === 0) centreMap[key].zero += 1;
  });

  const centreStats = Object.values(centreMap).map(row => ({
    ...row,
    rate: Math.round((row.active / row.staff) * 1000) / 10
  })).sort((a, b) => b.rate - a.rate || a.centre.localeCompare(b.centre));

  return {
    ok: true,
    month: titleCase_(selectedMonth),
    availableMonths,
    staff: enriched.length,
    active,
    adoptionRate: Math.round((active / enriched.length) * 1000) / 10,
    belowThreshold: enriched.length - active,
    zeroUsage: enriched.filter(row => row.usage === 0).length,
    topUsers: [...enriched].sort((a, b) => b.usage - a.usage).slice(0, 10),
    centreStats
  };
}

function loadData_() {
  if (CONFIG.spreadsheetId === 'PASTE_GOOGLE_SHEET_ID_HERE') {
    throw new Error('The Google Sheet ID has not been configured in Code.gs.');
  }

  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const detailsSheet = spreadsheet.getSheetByName(CONFIG.detailsSheetName);
  const staffSheet = spreadsheet.getSheetByName(CONFIG.staffSheetName);
  if (!detailsSheet || !staffSheet) throw new Error('Required sheets “Details” and “Staff Info” were not found.');

  const detailsValues = detailsSheet.getDataRange().getValues();
  const staffValues = staffSheet.getDataRange().getDisplayValues();
  const detailsHeaders = headerMap_(detailsValues.shift());
  const staffHeaders = headerMap_(staffValues.shift());

  const details = detailsValues.filter(row => row.some(value => value !== '')).map(row => ({
    month: String(valueAt_(row, detailsHeaders, 'BULAN')).trim().toUpperCase(),
    email: normaliseEmail_(valueAt_(row, detailsHeaders, 'EMEL GWS')),
    name: String(valueAt_(row, detailsHeaders, 'NAMA PENUH') || '').trim(),
    usage: number_(valueAt_(row, detailsHeaders, 'Overall Usage')),
    activeDays: number_(valueAt_(row, detailsHeaders, 'Active Days'))
  }));

  const staffRows = staffValues.filter(row => row.some(value => value !== '')).map(row => ({
    email: normaliseEmail_(valueAt_(row, staffHeaders, 'EMEL GWS')),
    name: String(valueAt_(row, staffHeaders, 'NAMA PENUH') || '').trim(),
    staffId: normaliseStaffId_(valueAt_(row, staffHeaders, 'NO. PEKERJA')),
    centre: String(valueAt_(row, staffHeaders, 'PUSAT PENGAJIAN') || '').trim()
  }));

  const staffById = {};
  const staffByEmail = {};
  staffRows.forEach(row => {
    if (row.staffId) staffById[row.staffId] = row;
    if (row.email) staffByEmail[row.email] = row;
  });

  return { details, staffById, staffByEmail };
}

function getActiveEmail_() {
  return normaliseEmail_(Session.getActiveUser().getEmail());
}

function isManager_(email) {
  return CONFIG.managerEmails.map(normaliseEmail_).includes(normaliseEmail_(email));
}

function headerMap_(headers) {
  const map = {};
  headers.forEach((header, index) => {
    const key = String(header || '').trim();
    if (key) map[key] = index;
  });
  return map;
}

function valueAt_(row, map, header) {
  if (!(header in map)) throw new Error(`Required column “${header}” was not found.`);
  return row[map[header]];
}

function normaliseEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function normaliseStaffId_(value) {
  return String(value || '').replace(/\D/g, '');
}

function number_(value) {
  const number = Number(String(value || 0).replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function maskEmail_(email) {
  const parts = String(email || '').split('@');
  if (parts.length !== 2) return '';
  const name = parts[0];
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(2, name.length - 2))}@${parts[1]}`;
}

function monthIndex_(month) {
  const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  const index = months.indexOf(String(month || '').toUpperCase());
  return index === -1 ? 99 : index;
}

function titleCase_(value) {
  return String(value || '').toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
}
