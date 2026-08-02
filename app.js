const fmt = new Intl.NumberFormat('en-MY');
let dashboardData;
let charts = {};
let sourceMode = 'snapshot';
let startupWarnings = [];

const purple = '#4b1f6f';
const purple2 = '#6f3a91';
const gold = '#c7a34a';
const grey = '#d9d5dc';
const googleBlue = '#4285f4';
const googleRed = '#ea4335';
const googleYellow = '#fbbc05';
const googleGreen = '#34a853';

async function initialise() {
  try {
    dashboardData = await loadDashboardData();
    setupMonthSelector();
    setupStaffLookup();
    renderWarnings();
    renderMonth(dashboardData.config.latestMonth);
  } catch (error) {
    console.error(error);
    document.querySelector('.page-shell').innerHTML = `<section class="warning-panel"><strong>Dashboard error:</strong> ${escapeHtml(error.message)}.</section>`;
  }
}

async function loadDashboardData() {
  const apiUrl = window.DASHBOARD_CONFIG?.dataApiUrl?.trim();
  if (apiUrl) {
    try {
      const liveData = await requestApi('dashboard');
      if (!liveData?.ok) throw new Error(liveData?.error || 'The live data service returned an invalid response');
      sourceMode = 'live';
      setSourceBadge('Live Google Sheet', 'live');
      return liveData;
    } catch (error) {
      console.error('Live data failed; using snapshot.', error);
      startupWarnings.push(`Live Google Sheet connection failed, so the embedded snapshot is being shown. ${error.message}`);
    }
  }

  const response = await fetch('./data/dashboard-data.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load the dashboard snapshot (${response.status})`);
  sourceMode = 'snapshot';
  setSourceBadge('Embedded snapshot', 'snapshot');
  return response.json();
}

function setSourceBadge(label, mode) {
  const badge = document.getElementById('sourceBadge');
  badge.textContent = label;
  badge.className = `source-badge ${mode}`;
}

function requestApi(action, parameters = {}) {
  const apiUrl = window.DASHBOARD_CONFIG?.dataApiUrl?.trim();
  if (!apiUrl) return Promise.reject(new Error('The live Google Sheets API URL has not been configured'));

  return new Promise((resolve, reject) => {
    const callbackName = `__ffGeminiCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => finish(new Error('The live data request timed out')), 15000);

    function cleanup() {
      window.clearTimeout(timeout);
      script.remove();
      try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
    }

    function finish(error, payload) {
      cleanup();
      if (error) reject(error);
      else resolve(payload);
    }

    window[callbackName] = payload => finish(null, payload);
    script.onerror = () => finish(new Error('The live data service could not be reached'));

    const url = new URL(apiUrl);
    url.searchParams.set('action', action);
    url.searchParams.set('prefix', callbackName);
    url.searchParams.set('_', Date.now().toString());
    Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
    script.src = url.toString();
    document.head.appendChild(script);
  });
}

function setupMonthSelector() {
  const select = document.getElementById('monthSelect');
  select.innerHTML = dashboardData.months.map(month => `<option value="${escapeHtml(month.key)}">${escapeHtml(month.label)}</option>`).join('');
  select.value = dashboardData.config.latestMonth;
  select.addEventListener('change', event => renderMonth(event.target.value));
}

function setupStaffLookup() {
  const dialog = document.getElementById('staffLookupDialog');
  const button = document.getElementById('staffLookupButton');
  const closeButton = document.getElementById('closeLookupButton');
  const form = document.getElementById('staffLookupForm');

  button.addEventListener('click', () => {
    dialog.showModal();
    window.setTimeout(() => document.getElementById('staffIdInput').focus(), 50);
  });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  form.addEventListener('submit', handleStaffLookup);
}

async function handleStaffLookup(event) {
  event.preventDefault();
  const input = document.getElementById('staffIdInput');
  const staffId = normaliseStaffId(input.value);
  const message = document.getElementById('lookupMessage');
  const resultPanel = document.getElementById('lookupResult');

  resultPanel.hidden = true;
  showLookupMessage('Searching the usage records…', 'loading');

  if (!staffId) {
    showLookupMessage('Enter a valid No. Pekerja containing digits only.');
    return;
  }

  try {
    let result;
    if (sourceMode === 'live' && window.DASHBOARD_CONFIG?.dataApiUrl?.trim()) {
      result = await requestApi('lookup', { staffId });
    } else {
      const record = dashboardData.lookupIndex?.[staffId];
      if (!record) throw new Error('No matching staff record was found. Check the No. Pekerja entered.');
      result = {
        ok: true,
        staff: { name: record.name, staffId: record.staffId, centre: record.centre },
        months: record.months,
        activeMonths: record.activeMonths,
        monthsRecorded: record.monthsRecorded,
        activeMonthRate: record.activeMonthRate
      };
    }

    if (!result?.ok) throw new Error(result?.error || 'No matching staff record was found.');
    message.hidden = true;
    renderStaffLookup(result);
  } catch (error) {
    showLookupMessage(error.message || 'The staff record could not be retrieved.');
  }
}

function showLookupMessage(textValue, type = 'error') {
  const message = document.getElementById('lookupMessage');
  message.hidden = false;
  message.className = `lookup-message ${type === 'loading' ? 'loading' : ''}`;
  message.textContent = textValue;
}

function renderStaffLookup(result) {
  const months = result.months || [];
  if (!months.length) throw new Error('No monthly usage record was found for this staff member.');

  const latest = months[months.length - 1];
  const activeMonths = result.activeMonths ?? months.filter(row => row.active).length;
  const monthsRecorded = result.monthsRecorded ?? months.length;
  const activeMonthRate = result.activeMonthRate ?? (monthsRecorded ? activeMonths / monthsRecorded * 100 : 0);

  text('lookupName', result.staff.name);
  text('lookupCentre', result.staff.centre);
  text('lookupLatestUsage', fmt.format(latest.usage));
  text('lookupLatestDays', fmt.format(latest.activeDays));
  text('lookupProgress', `${Math.min(100, latest.progress ?? Math.round(latest.usage / dashboardData.config.activeThreshold * 100))}%`);
  text('lookupActiveMonths', `${activeMonths}/${monthsRecorded} (${activeMonthRate.toFixed(0)}%)`);

  const status = document.getElementById('lookupStatus');
  status.textContent = latest.active ? `Active · ${latest.month}` : `Below threshold · ${latest.month}`;
  status.className = `status-chip ${latest.active ? 'active' : 'inactive'}`;

  document.getElementById('lookupTable').innerHTML = months.map(row => `
    <tr>
      <td><strong>${escapeHtml(row.month)}</strong></td>
      <td>${fmt.format(row.usage)}</td>
      <td>${fmt.format(row.activeDays)}</td>
      <td>${Math.min(100, row.progress ?? Math.round(row.usage / dashboardData.config.activeThreshold * 100))}%</td>
      <td><span class="rate-pill ${row.active ? '' : 'under'}">${row.active ? 'Active' : 'Below target'}</span></td>
    </tr>`).join('');

  replaceChart('staffTrendChart', {
    type: 'bar',
    data: {
      labels: months.map(row => row.month.replace(` ${dashboardData.metadata.year}`, '')),
      datasets: [
        { label: 'Overall usage', data: months.map(row => row.usage), backgroundColor: purple2, borderRadius: 7 },
        { label: `Active threshold (${dashboardData.config.activeThreshold})`, data: months.map(() => dashboardData.config.activeThreshold), type: 'line', borderColor: gold, borderDash: [7, 5], pointRadius: 0, borderWidth: 2 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 9 } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#6d6872' } },
        y: { beginAtZero: true, grid: { color: '#efedf1' }, ticks: { precision: 0, color: '#6d6872' } }
      }
    }
  });

  document.getElementById('lookupResult').hidden = false;
}

function renderWarnings() {
  const panel = document.getElementById('warningPanel');
  const messages = [
    ...startupWarnings,
    ...(dashboardData.dataQualityWarnings || []).map(item => typeof item === 'string' ? item : item.message)
  ].filter(Boolean);
  if (!messages.length) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  panel.innerHTML = `<strong>Data note:</strong> ${messages.map(escapeHtml).join(' ')}`;
}

function renderMonth(monthKey) {
  const month = dashboardData.months.find(item => item.key === monthKey);
  if (!month) return;

  text('adoptionRate', month.adoptionRate.toFixed(1));
  text('targetRate', `${month.targetRate}%`);
  text('activeUsers', fmt.format(month.activeUsers));
  text('roomForImprovement', fmt.format(month.roomForImprovement));
  text('totalUsage', fmt.format(month.totalUsage));
  text('zeroUsage', fmt.format(month.zeroUsage));
  text('nearTarget', fmt.format(month.nearTarget));
  text('sustainedUsers', fmt.format(month.sustainedUsers));
  text('powerUsers', fmt.format(month.powerUsers));
  text('top10Share', `${month.top10UsageShare.toFixed(1)}%`);
  text('activeUsersNote', `${month.activeUsers} of ${month.staff} licensed staff meet the threshold`);
  text('improvementNote', `${month.zeroUsage} have zero usage; ${month.nearTarget} are close to target`);
  text('usageNote', `Median: ${fmt.format(month.medianUsage)} uses · Avg. active days: ${month.averageActiveDays}`);

  const status = document.getElementById('kpiStatus');
  if (month.kpiGapUsers >= 0) {
    status.className = 'status-line good';
    status.textContent = `${month.kpiGapPercentagePoints.toFixed(1)} percentage points above target (${month.kpiGapUsers} users above minimum)`;
  } else {
    status.className = 'status-line bad';
    status.textContent = `${Math.abs(month.kpiGapPercentagePoints).toFixed(1)} percentage points below target (${Math.abs(month.kpiGapUsers)} more active users needed)`;
  }

  const circumference = 2 * Math.PI * 48;
  const progress = Math.min(month.adoptionRate, 100) / 100;
  document.getElementById('gaugeProgress').style.strokeDashoffset = `${circumference * (1 - progress)}`;

  renderTopUsers(month.topUsers);
  renderCentreTable(month.centreStats, month.targetRate);
  renderCharts(month);
  const sourceLabel = sourceMode === 'live' ? 'Live Google Sheet' : 'Embedded snapshot';
  text('dataStamp', `${month.label} · ${dashboardData.metadata.activeDefinition} · ${sourceLabel}`);
}

function renderTopUsers(rows) {
  document.getElementById('topUsersTable').innerHTML = rows.map(row => `
    <tr>
      <td><strong>${row.rank}</strong></td>
      <td>${escapeHtml(row.name || row.label || '—')}</td>
      <td>${escapeHtml(row.centre)}</td>
      <td><strong>${fmt.format(row.usage)}</strong></td>
      <td>${fmt.format(row.activeDays)}</td>
    </tr>`).join('');
}

function renderCentreTable(rows, target) {
  document.getElementById('centreTable').innerHTML = rows.map(row => `
    <tr>
      <td>${escapeHtml(row.centre)}</td>
      <td>${row.active}/${row.staff}</td>
      <td><span class="rate-pill ${row.adoptionRate < target ? 'under' : ''}">${row.adoptionRate.toFixed(1)}%</span></td>
      <td>${row.roomForImprovement}</td>
      <td>${row.zeroUsage}</td>
    </tr>`).join('');
}

function renderCharts(month) {
  const common = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { usePointStyle: true, boxWidth: 9, color: '#39343e' } } },
    scales: { x: { grid: { color: '#efedf1' }, ticks: { color: '#6d6872' } }, y: { grid: { color: '#efedf1' }, ticks: { color: '#6d6872' } } }
  };

  replaceChart('trendChart', {
    type: 'line',
    data: {
      labels: dashboardData.months.map(item => item.label.replace(` ${dashboardData.metadata.year}`, '')),
      datasets: [
        { label: 'Adoption rate', data: dashboardData.months.map(item => item.adoptionRate), borderColor: purple, backgroundColor: 'rgba(75,31,111,.12)', pointBackgroundColor: purple, tension: .3, fill: true, borderWidth: 3 },
        { label: 'KPI target', data: dashboardData.months.map(item => item.targetRate), borderColor: gold, borderDash: [8, 6], pointRadius: 0, borderWidth: 2 }
      ]
    },
    options: { ...common, scales: { ...common.scales, y: { ...common.scales.y, suggestedMin: 0, suggestedMax: 100, ticks: { callback: value => `${value}%`, color: '#6d6872' } } } }
  });

  replaceChart('distributionChart', {
    type: 'doughnut',
    data: {
      labels: month.engagementBands.map(item => item.label),
      datasets: [{ data: month.engagementBands.map(item => item.count), backgroundColor: [grey, googleYellow, googleBlue, purple2, googleGreen, purple], borderColor: '#fff', borderWidth: 3 }]
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 9, padding: 15 } } } }
  });

  const centreRows = [...month.centreStats].sort((a, b) => a.adoptionRate - b.adoptionRate);
  replaceChart('centreChart', {
    type: 'bar',
    data: {
      labels: centreRows.map(item => item.centre),
      datasets: [{ label: 'Adoption rate', data: centreRows.map(item => item.adoptionRate), backgroundColor: centreRows.map(item => item.adoptionRate >= month.targetRate ? googleGreen : googleRed), borderRadius: 7 }]
    },
    options: {
      ...common,
      indexAxis: 'y',
      layout: { padding: { left: 5 } },
      plugins: { legend: { display: false } },
      scales: {
        x: { suggestedMin: 0, suggestedMax: 100, ticks: { callback: value => `${value}%` }, grid: { color: '#efedf1' } },
        y: { grid: { display: false }, ticks: { color: '#39343e', callback: (_, index) => wrapLabel(centreRows[index].centre, 28) } }
      }
    }
  });

  const improvementRows = [...month.centreStats].sort((a, b) => b.roomForImprovement - a.roomForImprovement);
  replaceChart('improvementChart', {
    type: 'bar',
    data: {
      labels: improvementRows.map(item => item.centre),
      datasets: [
        { label: 'Below threshold', data: improvementRows.map(item => item.roomForImprovement), backgroundColor: googleYellow, borderRadius: 6 },
        { label: 'Active', data: improvementRows.map(item => item.active), backgroundColor: purple, borderRadius: 6 }
      ]
    },
    options: {
      ...common,
      indexAxis: 'y',
      scales: {
        x: { stacked: true, grid: { color: '#efedf1' }, ticks: { precision: 0 } },
        y: { stacked: true, grid: { display: false }, ticks: { color: '#39343e', callback: (_, index) => wrapLabel(improvementRows[index].centre, 28) } }
      }
    }
  });
}

function wrapLabel(value, maxLength = 28) {
  const words = String(value || '').split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach(word => {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function replaceChart(id, config) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), config);
}

function normaliseStaffId(value) {
  return String(value || '').replace(/\D/g, '');
}

function text(id, value) {
  document.getElementById(id).textContent = value;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
}

document.addEventListener('DOMContentLoaded', initialise);
