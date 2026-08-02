const fmt = new Intl.NumberFormat('en-MY');
let dashboardData;
let charts = {};

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
    const response = await fetch('./data/dashboard-data.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load data (${response.status})`);
    dashboardData = await response.json();
    setupMonthSelector();
    setupStaffLookup();
    renderWarnings();
    renderMonth(dashboardData.config.latestMonth);
  } catch (error) {
    console.error(error);
    document.querySelector('.page-shell').innerHTML = `<section class="warning-panel"><strong>Dashboard error:</strong> ${escapeHtml(error.message)}. Confirm that <code>data/dashboard-data.json</code> has been uploaded.</section>`;
  }
}

function setupMonthSelector() {
  const select = document.getElementById('monthSelect');
  select.innerHTML = dashboardData.months.map(month => `<option value="${month.key}">${month.label}</option>`).join('');
  select.value = dashboardData.config.latestMonth;
  select.addEventListener('change', event => renderMonth(event.target.value));
}

function setupStaffLookup() {
  const button = document.getElementById('staffLookupButton');
  const url = window.DASHBOARD_CONFIG?.staffLookupUrl?.trim();
  if (url) {
    button.href = url;
    button.target = '_blank';
    button.rel = 'noopener';
    button.classList.remove('is-disabled');
    button.removeAttribute('aria-disabled');
  } else {
    button.title = 'Add the secure Google Apps Script URL in config.js';
  }
}

function renderWarnings() {
  const panel = document.getElementById('warningPanel');
  if (!dashboardData.dataQualityWarnings?.length) return;
  panel.hidden = false;
  panel.innerHTML = `<strong>Data-quality check:</strong> ${dashboardData.dataQualityWarnings.map(w => escapeHtml(w.message)).join(' ')}`;
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
  text('activeUsersNote', `${month.activeUsers} of ${month.staff} staff meet the threshold`);
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
  text('dataStamp', `${month.label} · ${dashboardData.metadata.activeDefinition} · Generated ${dashboardData.metadata.generatedAt}`);
}

function renderTopUsers(rows) {
  document.getElementById('topUsersTable').innerHTML = rows.map(row => `
    <tr>
      <td><strong>${row.rank}</strong></td>
      <td>${escapeHtml(row.label)}</td>
      <td>${escapeHtml(shortCentre(row.centre))}</td>
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
      labels: dashboardData.months.map(m => m.label.replace(' 2026','')),
      datasets: [
        { label: 'Adoption rate', data: dashboardData.months.map(m => m.adoptionRate), borderColor: purple, backgroundColor: 'rgba(75,31,111,.12)', pointBackgroundColor: purple, tension: .3, fill: true, borderWidth: 3 },
        { label: 'KPI target', data: dashboardData.months.map(m => m.targetRate), borderColor: gold, borderDash: [8,6], pointRadius: 0, borderWidth: 2 }
      ]
    },
    options: { ...common, scales: { ...common.scales, y: { ...common.scales.y, suggestedMin: 0, suggestedMax: 100, ticks: { callback: value => `${value}%`, color: '#6d6872' } } } }
  });

  replaceChart('distributionChart', {
    type: 'doughnut',
    data: {
      labels: month.engagementBands.map(x => x.label),
      datasets: [{ data: month.engagementBands.map(x => x.count), backgroundColor: [grey, googleYellow, googleBlue, purple2, googleGreen, purple], borderColor: '#fff', borderWidth: 3 }]
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 9, padding: 15 } } } }
  });

  const centreRows = [...month.centreStats].sort((a,b) => a.adoptionRate - b.adoptionRate);
  replaceChart('centreChart', {
    type: 'bar',
    data: { labels: centreRows.map(x => shortCentre(x.centre)), datasets: [{ label: 'Adoption rate', data: centreRows.map(x => x.adoptionRate), backgroundColor: centreRows.map(x => x.adoptionRate >= month.targetRate ? googleGreen : googleRed), borderRadius: 7 }] },
    options: { ...common, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { suggestedMin: 0, suggestedMax: 100, ticks: { callback: value => `${value}%` }, grid: { color: '#efedf1' } }, y: { grid: { display: false }, ticks: { color: '#39343e' } } } }
  });

  const improvementRows = [...month.centreStats].sort((a,b) => b.roomForImprovement - a.roomForImprovement);
  replaceChart('improvementChart', {
    type: 'bar',
    data: { labels: improvementRows.map(x => shortCentre(x.centre)), datasets: [
      { label: 'Below threshold', data: improvementRows.map(x => x.roomForImprovement), backgroundColor: googleYellow, borderRadius: 6 },
      { label: 'Active', data: improvementRows.map(x => x.active), backgroundColor: purple, borderRadius: 6 }
    ] },
    options: { ...common, indexAxis: 'y', scales: { x: { stacked: true, grid: { color: '#efedf1' }, ticks: { precision: 0 } }, y: { stacked: true, grid: { display: false }, ticks: { color: '#39343e' } } } }
  });
}

function replaceChart(id, config) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), config);
}

function shortCentre(value) {
  const map = {
    'AMALAN FARMASI & FARMASI KLINIKAL': 'Amalan & Klinikal',
    'TEKNOLOGI FARMASEUTIKAL': 'Teknologi',
    'KIMIA FARMASEUTIKAL': 'Kimia',
    'SAINS HAYAT': 'Sains Hayat',
    'FARMAKOLOGI': 'Farmakologi',
    'PENTADBIRAN': 'Pentadbiran'
  };
  return map[value] || value;
}

function text(id, value) { document.getElementById(id).textContent = value; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[char])); }

document.addEventListener('DOMContentLoaded', initialise);
