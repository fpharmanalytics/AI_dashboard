const CONFIG = Object.freeze({
  spreadsheetId: 'PASTE_GOOGLE_SHEET_ID_HERE',
  detailsSheetName: 'Details',
  staffSheetName: 'Staff Info',
  activeThreshold: 4,
  targetRate: 80,
  reportingYear: 2026,
  cacheSeconds: 300
});

const MONTHS = Object.freeze([
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
]);

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'dashboard').toLowerCase();
    let payload;

    if (action === 'dashboard') {
      payload = getDashboardPayload_(e && e.parameter && e.parameter.refresh === '1');
    } else if (action === 'lookup') {
      payload = getLookupPayload_(e && e.parameter && e.parameter.staffId);
    } else if (action === 'ping') {
      payload = { ok: true, service: 'FF Gemini Adoption Live Data', timestamp: new Date().toISOString() };
    } else {
      throw new Error('Unknown action. Use dashboard, lookup or ping.');
    }

    return output_(payload, e && e.parameter && e.parameter.prefix);
  } catch (error) {
    return output_({ ok: false, error: error.message || String(error) }, e && e.parameter && e.parameter.prefix);
  }
}

function getDashboardPayload_(bypassCache) {
  const cache = CacheService.getScriptCache();
  if (!bypassCache) {
    const cached = cache.get('dashboard-v2');
    if (cached) return JSON.parse(cached);
  }

  const data = loadData_();
  const availableMonths = unique_(data.details.map(row => row.month).filter(Boolean))
    .sort((a, b) => monthIndex_(a) - monthIndex_(b));

  if (!availableMonths.length) throw new Error('No reporting months were found in the Details sheet.');

  const months = availableMonths.map(month => buildMonthSummary_(month, data.details));
  const payload = {
    ok: true,
    metadata: {
      title: 'Faculty of Pharmacy Gemini Pro Adoption Dashboard',
      year: CONFIG.reportingYear,
      generatedAt: new Date().toISOString(),
      sourceWorkbook: 'Live Google Sheet',
      activeDefinition: `Overall Usage ≥ ${CONFIG.activeThreshold} in the selected month`,
      dataMode: 'Live Google Sheet data'
    },
    config: {
      targetRate: CONFIG.targetRate,
      activeThreshold: CONFIG.activeThreshold,
      latestMonth: availableMonths[availableMonths.length - 1]
    },
    months: months,
    dataQualityWarnings: data.warnings
  };

  cache.put('dashboard-v2', JSON.stringify(payload), CONFIG.cacheSeconds);
  return payload;
}

function getLookupPayload_(staffIdInput) {
  const staffId = normaliseStaffId_(staffIdInput);
  if (!staffId) throw new Error('Enter a valid No. Pekerja.');

  const data = loadData_();
  const staff = data.staffById[staffId];
  if (!staff) throw new Error('No matching staff record was found. Check the No. Pekerja entered.');

  const records = data.details
    .filter(row => row.email === staff.email)
    .sort((a, b) => monthIndex_(a.month) - monthIndex_(b.month));

  if (!records.length) throw new Error('No monthly Gemini usage record was found for this staff member.');

  const months = records.map(row => ({
    key: row.month,
    month: `${titleMonth_(row.month)} ${CONFIG.reportingYear}`,
    usage: row.usage,
    activeDays: row.activeDays,
    active: row.usage >= CONFIG.activeThreshold,
    progress: Math.min(100, Math.round(row.usage / CONFIG.activeThreshold * 100))
  }));
  const activeMonths = months.filter(row => row.active).length;

  return {
    ok: true,
    staff: {
      name: staff.name,
      staffId: staff.staffId,
      centre: staff.centre
    },
    months: months,
    activeMonths: activeMonths,
    monthsRecorded: months.length,
    activeMonthRate: round1_(activeMonths / months.length * 100),
    definition: `Active = Overall Usage ≥ ${CONFIG.activeThreshold} in a month`
  };
}

function buildMonthSummary_(month, allDetails) {
  const rows = allDetails.filter(row => row.month === month);
  if (!rows.length) throw new Error(`No records were found for ${month}.`);

  const staff = rows.length;
  const activeUsers = rows.filter(row => row.usage >= CONFIG.activeThreshold).length;
  const roomForImprovement = staff - activeUsers;
  const adoptionRate = round1_(activeUsers / staff * 100);
  const targetActiveUsers = Math.ceil(CONFIG.targetRate / 100 * staff);
  const usages = rows.map(row => row.usage);
  const activeDays = rows.map(row => row.activeDays);
  const totalUsage = sum_(usages);

  const centreMap = {};
  rows.forEach(row => {
    if (!centreMap[row.centre]) centreMap[row.centre] = [];
    centreMap[row.centre].push(row);
  });

  const centreStats = Object.keys(centreMap).map(centre => {
    const centreRows = centreMap[centre];
    const centreActive = centreRows.filter(row => row.usage >= CONFIG.activeThreshold).length;
    const centreUsages = centreRows.map(row => row.usage);
    return {
      centre: centre,
      staff: centreRows.length,
      active: centreActive,
      roomForImprovement: centreRows.length - centreActive,
      adoptionRate: round1_(centreActive / centreRows.length * 100),
      totalUsage: sum_(centreUsages),
      medianUsage: round1_(median_(centreUsages)),
      zeroUsage: centreRows.filter(row => row.usage === 0).length
    };
  }).sort((a, b) => b.adoptionRate - a.adoptionRate || a.centre.localeCompare(b.centre));

  const sortedUsers = rows.slice().sort((a, b) =>
    b.usage - a.usage || b.activeDays - a.activeDays || a.name.localeCompare(b.name)
  );
  const topRows = sortedUsers.slice(0, 10);

  return {
    key: month,
    label: `${titleMonth_(month)} ${CONFIG.reportingYear}`,
    staff: staff,
    activeUsers: activeUsers,
    roomForImprovement: roomForImprovement,
    adoptionRate: adoptionRate,
    targetRate: CONFIG.targetRate,
    targetActiveUsers: targetActiveUsers,
    kpiGapUsers: activeUsers - targetActiveUsers,
    kpiGapPercentagePoints: round1_(adoptionRate - CONFIG.targetRate),
    totalUsage: totalUsage,
    medianUsage: round1_(median_(usages)),
    meanUsage: round1_(totalUsage / staff),
    averageActiveDays: round1_(sum_(activeDays) / staff),
    medianActiveDays: round1_(median_(activeDays)),
    zeroUsage: usages.filter(value => value === 0).length,
    nearTarget: usages.filter(value => value >= 1 && value <= 3).length,
    sustainedUsers: activeDays.filter(value => value >= 8).length,
    powerUsers: usages.filter(value => value >= 100).length,
    top10UsageShare: totalUsage ? round1_(sum_(topRows.map(row => row.usage)) / totalUsage * 100) : 0,
    engagementBands: [
      { label: 'No usage (0)', count: usages.filter(value => value === 0).length },
      { label: 'Near target (1–3)', count: usages.filter(value => value >= 1 && value <= 3).length },
      { label: 'Active (4–9)', count: usages.filter(value => value >= 4 && value <= 9).length },
      { label: 'Regular (10–49)', count: usages.filter(value => value >= 10 && value <= 49).length },
      { label: 'High (50–99)', count: usages.filter(value => value >= 50 && value <= 99).length },
      { label: 'Power (100+)', count: usages.filter(value => value >= 100).length }
    ],
    centreStats: centreStats,
    topUsers: topRows.map((row, index) => ({
      rank: index + 1,
      name: row.name,
      centre: row.centre,
      usage: row.usage,
      activeDays: row.activeDays
    }))
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
  if (detailsValues.length < 2 || staffValues.length < 2) throw new Error('The Google Sheet does not contain sufficient data.');

  const detailsHeaders = headerMap_(detailsValues.shift());
  const staffHeaders = headerMap_(staffValues.shift());

  const staffRows = staffValues.filter(row => row.some(value => value !== '')).map(row => ({
    email: normaliseEmail_(valueAt_(row, staffHeaders, 'EMEL GWS')),
    name: String(valueAt_(row, staffHeaders, 'NAMA PENUH') || '').trim(),
    staffId: normaliseStaffId_(valueAt_(row, staffHeaders, 'NO. PEKERJA')),
    centre: centreDisplay_(valueAt_(row, staffHeaders, 'PUSAT PENGAJIAN'))
  }));

  const staffByEmail = {};
  const staffById = {};
  const duplicateIds = [];
  staffRows.forEach(row => {
    if (row.email) staffByEmail[row.email] = row;
    if (row.staffId) {
      if (staffById[row.staffId]) duplicateIds.push(row.staffId);
      staffById[row.staffId] = row;
    }
  });

  const unmatchedEmails = [];
  const details = detailsValues.filter(row => row.some(value => value !== '')).map(row => {
    const email = normaliseEmail_(valueAt_(row, detailsHeaders, 'EMEL GWS'));
    const staff = staffByEmail[email];
    if (!staff) unmatchedEmails.push(email || '(blank email)');
    return {
      month: String(valueAt_(row, detailsHeaders, 'BULAN') || '').trim().toUpperCase(),
      email: email,
      name: staff ? staff.name : String(valueAt_(row, detailsHeaders, 'NAMA PENUH') || '').trim(),
      staffId: staff ? staff.staffId : '',
      centre: staff ? staff.centre : 'Tidak dipadankan',
      usage: number_(valueAt_(row, detailsHeaders, 'Overall Usage')),
      activeDays: number_(valueAt_(row, detailsHeaders, 'Active Days'))
    };
  });

  const warnings = [];
  const missingIds = staffRows.filter(row => !row.staffId).length;
  if (missingIds) warnings.push({ message: `${missingIds} staff record has no usable No. Pekerja and cannot be retrieved through the individual lookup.` });
  if (unique_(unmatchedEmails).length) warnings.push({ message: `${unique_(unmatchedEmails).length} usage record email could not be matched to Staff Info.` });
  if (unique_(duplicateIds).length) warnings.push({ message: `${unique_(duplicateIds).length} duplicated No. Pekerja value was detected in Staff Info.` });

  return { details: details, staffByEmail: staffByEmail, staffById: staffById, warnings: warnings };
}

function centreDisplay_(value) {
  const key = String(value || '').trim().toUpperCase();
  const map = {
    'SAINS HAYAT': 'Pusat Pengajian Sains Hayat',
    'AMALAN FARMASI & FARMASI KLINIKAL': 'Pusat Pengajian Amalan Farmasi dan Farmasi Klinikal',
    'FARMAKOLOGI': 'Pusat Pengajian Farmakologi',
    'KIMIA FARMASEUTIKAL': 'Pusat Pengajian Kimia Farmaseutikal',
    'TEKNOLOGI FARMASEUTIKAL': 'Pusat Pengajian Teknologi Farmaseutikal',
    'PENTADBIRAN': 'Pentadbiran Fakulti'
  };
  return map[key] || String(value || '').trim() || 'Tidak dipadankan';
}

function output_(payload, prefix) {
  let json = JSON.stringify(payload)
    .replace(/<\//g, '<\\/')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  if (prefix) {
    const callback = String(prefix);
    if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
      json = JSON.stringify({ ok: false, error: 'Invalid callback name.' });
      return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(`${callback}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
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
  const id = String(value || '').replace(/\D/g, '');
  return id === '0' ? '' : id;
}

function number_(value) {
  const result = Number(String(value || 0).replace(/,/g, ''));
  return Number.isFinite(result) ? Math.round(result) : 0;
}

function sum_(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function median_(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round1_(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
}

function unique_(values) {
  return Array.from(new Set(values));
}

function monthIndex_(month) {
  const index = MONTHS.indexOf(String(month || '').toUpperCase());
  return index === -1 ? 99 : index;
}

function titleMonth_(month) {
  const value = String(month || '').toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
}
