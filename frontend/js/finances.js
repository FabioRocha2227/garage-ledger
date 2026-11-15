// -----------------------------------------------------------------------
// Finances: month-to-date summary, a real cash-flow trend chart, an
// expense breakdown by category, and the full transaction ledger with
// filtering and CSV export.
// -----------------------------------------------------------------------

let financeChartMonths = 6;   // 3 | 6 | 12
let financeTxFilter = 'all';  // all | income | expense | cars | jobs | consumables | withdrawals
let showAddTxMenu = false;
let showWithdrawalForm = false;
let financeOverview = 'monthly'; // monthly | all-time
let showBackups = false;

function isOwnerWithdrawal(entry) {
  return entry.type === 'Owner withdrawal';
}

function isSameMonth(dateStr, ref) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

/** Buckets a ledger entry into a human category + a short description,
 * used both for the transaction table badges and the expense donut. */
function txCategory(entry) {
  const t = entry.type;
  if (t === 'Sale') return { label: 'Vehicle Sale', cls: 'cat-sale', desc: entry.car };
  if (t === 'Purchase') return { label: 'Vehicle Purchase', cls: 'cat-purchase', desc: entry.car };
  if (t.startsWith('Repair:')) return { label: 'Repair', cls: 'cat-repair', desc: t.slice(8) };
  if (t.startsWith('Part:')) return { label: 'Part', cls: 'cat-part', desc: t.slice(6) };
  if (t.startsWith('Consumable:')) return { label: 'Consumables', cls: 'cat-expense', desc: t.slice(11) };
  if (t.startsWith('Tool:')) return { label: 'Tools & Equipment', cls: 'cat-expense', desc: t.slice(6) };
  if (t.startsWith('Expense:')) return { label: 'Other Expense', cls: 'cat-expense', desc: t.slice(9) };
  if (t.startsWith('Labor:')) return { label: 'Service Labor', cls: 'cat-labor', desc: t.slice(7) };
  if (t.startsWith('Job:')) return { label: 'Service Job', cls: 'cat-job', desc: t.slice(5) };
  if (isOwnerWithdrawal(entry)) return { label: 'Owner Withdrawal', cls: 'cat-expense', desc: entry.description || entry.car };
  return { label: t, cls: 'cat-other', desc: entry.car };
}

function renderFinances() {
  const entries = financeData.entries;
  const visibleEntries = entries.filter(e => !e.type.startsWith('Part:'));

  // Fire-and-forget: fills in the backup list once it's fetched.
  loadBackupsList();

  const now = new Date();
  const lastMonthRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonth = entries.filter(e => isSameMonth(e.date, now));
  const lastMonth = entries.filter(e => isSameMonth(e.date, lastMonthRef));
  const sumIn = list => list.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const sumOut = list => list.filter(e => e.amount < 0 && !isOwnerWithdrawal(e)).reduce((s, e) => s + Math.abs(e.amount), 0);

  const mtdIncome = sumIn(thisMonth);
  const mtdExpense = sumOut(thisMonth);
  const mtdWithdrawals = thisMonth
    .filter(isOwnerWithdrawal)
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  const mtdNet = mtdIncome - mtdExpense;
  const totalIncome = Number(financeData.total_in) || 0;
  const totalExpense = Math.abs(Number(financeData.total_out) || 0);
  const totalWithdrawals = Number(financeData.total_withdrawals) || 0;
  const totalNet = totalIncome - totalExpense;
  const mtdAvailableCash = mtdNet - mtdWithdrawals;
  const availableCash = totalNet - totalWithdrawals;
  const lastNet = sumIn(lastMonth) - sumOut(lastMonth);
  let deltaLabel = '—';
  if (lastMonth.length > 0 && lastNet !== 0) {
    const pct = Math.round(((mtdNet - lastNet) / Math.abs(lastNet)) * 100);
    deltaLabel = `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)}% vs last month`;
  }
  const margin = mtdIncome > 0 ? Math.round((mtdNet / mtdIncome) * 100) : null;
  const marginAllTime = totalIncome > 0 ? Math.round((totalNet / totalIncome) * 100) : null;

  const series = buildFinanceSeries(entries, financeChartMonths);
  const expenseCats = buildExpenseCategories(entries);
  const profitLoss = buildProfitLoss(entries);
  const monthlySummary = buildMonthlySummary(entries, 12);
  const performanceRows = buildPerformanceRows(entries);

  const filteredEntries = financeTxFilter === 'all' ? visibleEntries
    : visibleEntries.filter(e => {
      if (financeTxFilter === 'income') return e.amount > 0;
      if (financeTxFilter === 'expense') return e.amount < 0;
      return transactionGroup(e) === financeTxFilter;
    });

  return `
    <div class="finances-page">
    <div class="dash-head">
      <div>
        <h1>Financial Ledger</h1>
        <p class="sub">Every euro in and out of the business — cars and service jobs combined.</p>
      </div>
      <div class="dash-actions">
        <a class="export-csv" href="${API}/export/csv" download="garage-ledger-transactions.csv">
          <span class="export-csv-icon" aria-hidden="true">↓</span>
          <span><strong>Export CSV</strong><small>Download ledger</small></span>
        </a>
        <button class="btn" onclick="toggleAddTxMenu()">${showAddTxMenu ? 'Cancel' : '+ Add transaction'}</button>
      </div>
    </div>

    ${showAddTxMenu ? `
    <div class="panel">
      <h2>Where would you like to log this?</h2>
      <p class="small" style="margin-top:-8px">Every number here comes from real activity — pick where this transaction actually belongs.</p>
      <div class="row-actions" style="flex-wrap:wrap">
        <button class="ghost" onclick="setView('cars')">🚗 Repair, expense or sale on a car</button>
        <button class="ghost" onclick="setView('services')">🔧 Service job for a customer</button>
        <button class="ghost" onclick="setView('parts')">📦 Inventory purchase</button>
        <button class="ghost" onclick="toggleWithdrawalForm()">💶 Owner withdrawal</button>
      </div>
    </div>` : ''}

    ${showWithdrawalForm ? renderWithdrawalForm() : ''}

    <div class="panel finance-overview">
      <div class="panel-head finance-overview-head">
        <div>
          <span class="finance-eyebrow">Business snapshot</span>
          <h2>Performance overview</h2>
        </div>
        <div class="filter-tabs">
          <button class="tab ${financeOverview === 'monthly' ? 'active' : ''}" onclick="setFinanceOverview('monthly')">This month</button>
          <button class="tab ${financeOverview === 'all-time' ? 'active' : ''}" onclick="setFinanceOverview('all-time')">All time</button>
        </div>
      </div>
      <div class="finance-cash-hero">
        <div>
          <div class="finance-metric-label">Available cash</div>
          <div class="finance-cash-value ${(financeOverview === 'monthly' ? mtdAvailableCash : availableCash) >= 0 ? 'pos' : 'neg'}">€${fmt(financeOverview === 'monthly' ? mtdAvailableCash : availableCash)}</div>
          <div class="finance-cash-note">Income minus operating expenses and owner withdrawals</div>
        </div>
        <div class="finance-cash-period">${financeOverview === 'monthly' ? 'This month' : 'All time'}<span>Cash position</span></div>
      </div>
      <div class="finance-kpi-grid">
        <div class="finance-kpi">
          <div class="finance-kpi-heading"><span class="finance-kpi-dot dot-income"></span>Revenue</div>
          <strong>€${fmt(financeOverview === 'monthly' ? mtdIncome : totalIncome)}</strong>
          <span>${financeOverview === 'monthly' ? 'Sales + service jobs' : 'All recorded income'}</span>
        </div>
        <div class="finance-kpi">
          <div class="finance-kpi-heading"><span class="finance-kpi-dot dot-expense"></span>Operating expenses</div>
          <strong>€${fmt(financeOverview === 'monthly' ? mtdExpense : totalExpense)}</strong>
          <span>Purchases, repairs, labor, consumables and tools</span>
        </div>
        <div class="finance-kpi">
          <div class="finance-kpi-heading"><span class="finance-kpi-dot dot-profit"></span>Net profit</div>
          <strong class="${(financeOverview === 'monthly' ? mtdNet : totalNet) >= 0 ? 'pos' : 'neg'}">€${fmt(financeOverview === 'monthly' ? mtdNet : totalNet)}</strong>
          <span>${financeOverview === 'monthly' ? (deltaLabel === '—' ? 'No previous month data' : deltaLabel) : `${marginAllTime === null ? '—' : marginAllTime + '%'} profit margin`}</span>
        </div>
        <div class="finance-kpi">
          <div class="finance-kpi-heading"><span class="finance-kpi-dot dot-withdrawal"></span>Owner withdrawals</div>
          <strong>€${fmt(financeOverview === 'monthly' ? mtdWithdrawals : totalWithdrawals)}</strong>
          <span>Not included in profit</span>
        </div>
      </div>
    </div>

    <div class="dash-columns">
      <div class="dash-main">
        <div class="panel">
          <div class="panel-head">
            <h2>Cash flow</h2>
            <select class="sort-select" onchange="setFinanceChartMonths(this.value)">
              <option value="3" ${financeChartMonths === 3 ? 'selected' : ''}>Last 3 months</option>
              <option value="6" ${financeChartMonths === 6 ? 'selected' : ''}>Last 6 months</option>
              <option value="12" ${financeChartMonths === 12 ? 'selected' : ''}>Last 12 months</option>
            </select>
          </div>
          ${series.length === 0 ? '<div class="empty">Not enough transactions yet for a trend.</div>' : renderCashFlowChart(series)}
          <div class="legend" style="margin-top:10px"><span><i class="dot dot-good"></i>Income</span><span><i class="dot" style="background:var(--bad)"></i>Expenses</span></div>
        </div>
      </div>
      <div class="dash-side">
        <div class="panel">
          <h2>Expense breakdown</h2>
          ${expenseCats.total === 0 ? '<div class="empty">No expenses recorded yet.</div>' : renderExpenseDonut(expenseCats)}
        </div>
      </div>
    </div>

    <div class="finance-analytics-grid">
      <div class="panel finance-analytics-panel">
        <div class="panel-head">
          <div>
            <span class="finance-eyebrow">Accountability</span>
            <h2>Profit &amp; Loss</h2>
          </div>
          <span class="small">All recorded activity</span>
        </div>
        ${renderProfitLossTable(profitLoss)}
      </div>
      <div class="panel finance-analytics-panel">
        <div class="panel-head">
          <div>
            <span class="finance-eyebrow">Trend</span>
            <h2>Monthly summary</h2>
          </div>
          <span class="small">Last 12 months</span>
        </div>
        ${renderMonthlySummaryTable(monthlySummary)}
      </div>
    </div>

    <div class="panel finance-performance-panel">
      <div class="panel-head">
        <div>
          <span class="finance-eyebrow">Decision support</span>
          <h2>Vehicle &amp; service performance</h2>
        </div>
        <span class="small">Revenue less recorded costs</span>
      </div>
      <p class="small finance-table-note">Business-wide purchases are shown separately because they are not assigned to one vehicle or job.</p>
      ${renderPerformanceTable(performanceRows)}
    </div>

    <div class="panel finance-transactions">
      <div class="panel-head">
        <h2>Recent transactions</h2>
        <div class="filter-tabs">
          <button class="tab ${financeTxFilter === 'all' ? 'active' : ''}" onclick="setFinanceTxFilter('all')">All</button>
          <button class="tab ${financeTxFilter === 'income' ? 'active' : ''}" onclick="setFinanceTxFilter('income')">Income</button>
          <button class="tab ${financeTxFilter === 'expense' ? 'active' : ''}" onclick="setFinanceTxFilter('expense')">Expenses</button>
          <button class="tab ${financeTxFilter === 'cars' ? 'active' : ''}" onclick="setFinanceTxFilter('cars')">Cars</button>
          <button class="tab ${financeTxFilter === 'jobs' ? 'active' : ''}" onclick="setFinanceTxFilter('jobs')">Jobs</button>
          <button class="tab ${financeTxFilter === 'consumables' ? 'active' : ''}" onclick="setFinanceTxFilter('consumables')">Consumables</button>
          <button class="tab ${financeTxFilter === 'tools' ? 'active' : ''}" onclick="setFinanceTxFilter('tools')">Tools</button>
        </div>
      </div>
      ${filteredEntries.length === 0 ? '<div class="empty">No transactions match this filter.</div>' : `
      <table class="dash-table"><thead><tr><th>Date / time</th><th>Category</th><th>Description</th><th>Car / Customer</th><th>Amount</th></tr></thead><tbody>
      ${filteredEntries.slice(0, 60).map(e => {
        const cat = txCategory(e);
        return `<tr>
          <td class="mono small">${transactionDateTime(e)}</td>
          <td><span class="cat-badge ${cat.cls}">${esc(cat.label)}</span></td>
          <td>${esc(cat.desc || '—')}</td>
          <td class="small">${esc(e.car)}</td>
          <td class="mono ${e.amount >= 0 ? 'pos' : 'neg'}">
            <span class="transaction-amount">${e.amount >= 0 ? '+' : ''}€${fmt(e.amount)}</span>
            ${isOwnerWithdrawal(e) ? `<button class="withdrawal-delete" title="Remove owner withdrawal" aria-label="Remove owner withdrawal" onclick="deleteWithdrawal(${e.withdrawal_id})"><span aria-hidden="true">×</span><span>Remove</span></button>` : ''}
          </td>
        </tr>`;
      }).join('')}
      </tbody></table>
      ${filteredEntries.length > 60 ? `<p class="small" style="margin-top:10px">Showing the 60 most recent — export CSV for the full history.</p>` : ''}`}
    </div>

    <div class="panel finance-backup-panel">
      <div class="panel-head">
        <h2>Backup</h2>
        <div class="row-actions">
          <button class="ghost" onclick="backupNow()">Back up now</button>
          <button class="ghost" onclick="toggleBackups()" aria-expanded="${showBackups}" aria-controls="fin-backups">${showBackups ? 'Hide history' : 'Show history'}</button>
        </div>
      </div>
      <p class="small" style="margin-top:-8px">A backup is taken automatically once a day. Each one is a full copy of <code>garage.db</code> and <code>uploads/</code>, kept for 14 days.</p>
      ${showBackups ? '<div id="fin-backups"><div class="empty">Loading backups…</div></div>' : ''}
    </div>
    </div>
  `;
}

function transactionDateTime(entry) {
  if (!entry.timestamp) return entry.date;
  const display = entry.timestamp.replace('T', ' ').slice(0, 16);
  return display.endsWith(' 00:00') ? entry.date : display;
}

function transactionGroup(entry) {
  if (isOwnerWithdrawal(entry)) return 'withdrawals';
  if (entry.type.startsWith('Consumable:')) return 'consumables';
  if (entry.type.startsWith('Tool:')) return 'tools';
  if (entry.type.startsWith('Part:')) return 'parts';
  if (entry.type.startsWith('Labor:') || entry.type.startsWith('Job:')) return 'jobs';
  return 'cars';
}

function loadBackupsList() {
  api('/backups').then(list => {
    if (view !== 'finances') return; // navigated away while this was loading
    const el = document.getElementById('fin-backups');
    if (!el) return;
    if (list.length === 0) { el.innerHTML = '<div class="empty">No backups yet — one will be made automatically, or click "Back up now".</div>'; return; }
    el.innerHTML = `
      <table class="dash-table"><thead><tr><th>Backup</th><th>Size</th><th></th></tr></thead><tbody>
      ${list.map(b => `<tr>
          <td class="mono small">${esc(b.name.replace('_', ' '))}</td>
          <td class="mono small">${b.size_mb} MB</td>
          <td><a class="ghost" style="text-decoration:none; display:inline-block" href="${API}/backups/${b.name}/download">Download</a></td>
        </tr>`).join('')}
      </tbody></table>`;
  }).catch(() => {
    const el = document.getElementById('fin-backups');
    if (el) el.innerHTML = '<div class="empty">Couldn\'t load the backup list.</div>';
  });
}

async function backupNow() {
  try {
    await api('/backups', { method: 'POST' });
    loadBackupsList();
  } catch (e) {
    // api() already alerts on failure
  }
}

function refreshFinancesView() { document.getElementById('main').innerHTML = renderFinances(); }
function setFinanceChartMonths(v) { financeChartMonths = Number(v); refreshFinancesView(); }
function setFinanceTxFilter(f) { financeTxFilter = f; refreshFinancesView(); }
function setFinanceOverview(mode) { financeOverview = mode; refreshFinancesView(); }
function toggleAddTxMenu() { showAddTxMenu = !showAddTxMenu; refreshFinancesView(); }
function toggleWithdrawalForm() { showWithdrawalForm = !showWithdrawalForm; refreshFinancesView(); }
function toggleBackups() { showBackups = !showBackups; refreshFinancesView(); }

function renderWithdrawalForm() {
  return `
    <div class="panel">
      <h2>Log owner withdrawal</h2>
      <p class="small">This reduces available cash but does not count as a business expense or reduce profit.</p>
      <div class="row">
        <div class="field"><label>Date</label><input id="ow-date" type="date" value="${today()}"></div>
        <div class="field"><label>Amount (€)</label><input id="ow-amount" type="number" min="0.01" step="0.01" placeholder="0.00"></div>
        <div class="field" style="flex:1; min-width:220px"><label>Description (optional)</label><input id="ow-description" placeholder="e.g. Personal withdrawal"></div>
      </div>
      <button class="btn" onclick="addWithdrawal()">Add withdrawal</button>
    </div>
  `;
}

async function addWithdrawal() {
  const amount = Number(document.getElementById('ow-amount').value);
  if (!Number.isFinite(amount) || amount <= 0) {
    alert('Enter a withdrawal amount greater than zero.');
    return;
  }
  await api('/withdrawals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: document.getElementById('ow-date').value,
      amount,
      description: document.getElementById('ow-description').value.trim() || null,
    }),
  });
  showWithdrawalForm = false;
  showAddTxMenu = false;
  financeData = await api('/finances');
  document.getElementById('main').innerHTML = renderFinances();
}

async function deleteWithdrawal(id) {
  if (!confirm('Delete this owner withdrawal?')) return;
  await api(`/withdrawals/${id}`, { method: 'DELETE' });
  financeData = await api('/finances');
  document.getElementById('main').innerHTML = renderFinances();
}

// ---- cash flow chart: two real lines (income, expenses) by month ----

function buildFinanceSeries(entries, months) {
  const byMonth = {};
  entries.forEach(e => {
    const m = e.date.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { income: 0, expense: 0 };
    if (e.amount > 0) byMonth[m].income += e.amount; else byMonth[m].expense += Math.abs(e.amount);
  });
  return Object.keys(byMonth).sort().slice(-months).map(m => ({ month: m, ...byMonth[m] }));
}

function renderCashFlowChart(series) {
  const W = 640, H = 220, padL = 50, padR = 10, padT = 10, padB = 24;
  const chartW = W - padL - padR, chartH = H - padT - padB;
  const n = series.length;
  const maxVal = Math.max(1, ...series.map(s => Math.max(s.income, s.expense)));
  const step = n > 1 ? chartW / (n - 1) : 0;
  const xFor = i => n === 1 ? padL + chartW / 2 : padL + step * i;
  const yFor = v => padT + chartH - (v / maxVal * chartH);

  const grid = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const y = padT + chartH * (1 - f);
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>
            <text x="0" y="${(y + 4).toFixed(1)}" class="chart-axis">€${fmt(Math.round(maxVal * f))}</text>`;
  }).join('');

  const pathFor = key => 'M' + series.map((s, i) => `${xFor(i).toFixed(1)},${yFor(s[key]).toFixed(1)}`).join(' L');
  const dotsFor = (key, color) => series.map((s, i) => `<circle cx="${xFor(i).toFixed(1)}" cy="${yFor(s[key]).toFixed(1)}" r="3.5" fill="${color}"/>`).join('');
  const labels = series.map((s, i) => {
    const label = new Date(s.month + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short' });
    return `<text x="${xFor(i).toFixed(1)}" y="${H - 6}" class="chart-axis" text-anchor="middle">${label}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
    ${grid}
    <path d="${pathFor('income')}" fill="none" stroke="var(--good)" stroke-width="2"/>${dotsFor('income', 'var(--good)')}
    <path d="${pathFor('expense')}" fill="none" stroke="var(--bad)" stroke-width="2"/>${dotsFor('expense', 'var(--bad)')}
    ${labels}
  </svg>`;
}

// ---- expense breakdown donut, built from real transaction categories ----

function buildExpenseCategories(entries) {
  const buckets = {
    purchase: { label: 'Car purchases', color: '#e0611e', value: 0 },
    consumables: { label: 'Consumables', color: '#e0c05f', value: 0 },
    tools: { label: 'Tools & equipment', color: '#d18b4a', value: 0 },
    labor: { label: 'Repairs & labor', color: '#5fb383', value: 0 },
    other: { label: 'Other expenses', color: '#b48be0', value: 0 },
  };
  entries.forEach(e => {
    if (e.amount >= 0) return;
    if (isOwnerWithdrawal(e)) return;
    const t = e.type, v = Math.abs(e.amount);
    if (t === 'Purchase') buckets.purchase.value += v;
    else if (t.startsWith('Consumable:')) buckets.consumables.value += v;
    else if (t.startsWith('Tool:')) buckets.tools.value += v;
    else if (t.startsWith('Part:') || t.startsWith('Repair:') || t.startsWith('Labor:')) buckets.labor.value += v;
    else buckets.other.value += v;
  });
  const list = Object.values(buckets).filter(b => b.value > 0);
  const total = list.reduce((s, b) => s + b.value, 0);
  return { list, total };
}

function buildProfitLoss(entries) {
  const rows = [
    { key: 'income', label: 'Revenue', value: 0, cls: 'pos' },
    { key: 'purchase', label: 'Vehicle purchases', value: 0 },
    { key: 'repairs', label: 'Repairs & labor', value: 0 },
    { key: 'consumables', label: 'Consumables', value: 0 },
    { key: 'tools', label: 'Tools & equipment', value: 0 },
    { key: 'other', label: 'Other expenses', value: 0 },
  ];
  const byKey = Object.fromEntries(rows.map(row => [row.key, row]));
  entries.forEach(entry => {
    if (isOwnerWithdrawal(entry)) return;
    if (entry.amount > 0) {
      byKey.income.value += entry.amount;
      return;
    }
    const type = entry.type;
    let key = 'other';
    if (type === 'Purchase') key = 'purchase';
    else if (type.startsWith('Part:') || type.startsWith('Repair:') || type.startsWith('Labor:')) key = 'repairs';
    else if (type.startsWith('Consumable:')) key = 'consumables';
    else if (type.startsWith('Tool:')) key = 'tools';
    byKey[key].value += Math.abs(entry.amount);
  });
  const expenses = rows.slice(1).reduce((sum, row) => sum + row.value, 0);
  return { rows, expenses, profit: rows[0].value - expenses };
}

function renderProfitLossTable({ rows, expenses, profit }) {
  return `<table class="dash-table finance-analytics-table">
    <tbody>
      ${rows.map((row, index) => `<tr class="${index === 0 ? 'finance-total-row' : ''}">
        <td>${esc(row.label)}</td>
        <td class="mono ${index === 0 ? 'pos' : 'neg'}">${index === 0 ? '+' : '−'}€${fmt(row.value)}</td>
      </tr>`).join('')}
      <tr class="finance-total-row"><td>Total operating expenses</td><td class="mono neg">−€${fmt(expenses)}</td></tr>
      <tr class="finance-result-row"><td>Business profit</td><td class="mono ${profit >= 0 ? 'pos' : 'neg'}">${profit >= 0 ? '+' : '−'}€${fmt(Math.abs(profit))}</td></tr>
    </tbody>
  </table>`;
}

function buildMonthlySummary(entries, months) {
  const byMonth = {};
  entries.forEach(entry => {
    if (isOwnerWithdrawal(entry)) return;
    const month = entry.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { month, income: 0, expenses: 0 };
    if (entry.amount > 0) byMonth[month].income += entry.amount;
    else byMonth[month].expenses += Math.abs(entry.amount);
  });
  return Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month)).slice(0, months);
}

function renderMonthlySummaryTable(rows) {
  if (!rows.length) return '<div class="empty">No monthly activity recorded yet.</div>';
  return `<div class="finance-table-scroll"><table class="dash-table finance-analytics-table">
    <thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Profit</th></tr></thead>
    <tbody>${rows.map(row => {
      const profit = row.income - row.expenses;
      const date = new Date(`${row.month}-01T00:00:00`);
      const label = date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      return `<tr><td>${label}</td><td class="mono pos">+€${fmt(row.income)}</td><td class="mono neg">−€${fmt(row.expenses)}</td><td class="mono ${profit >= 0 ? 'pos' : 'neg'}">${profit >= 0 ? '+' : '−'}€${fmt(Math.abs(profit))}</td></tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function buildPerformanceRows(entries) {
  const groups = {};
  entries.forEach(entry => {
    if (isOwnerWithdrawal(entry)) return;
    const global = entry.type.startsWith('Consumable:') || entry.type.startsWith('Tool:');
    const label = global ? 'Business-wide' : (entry.car || 'Unassigned');
    if (!groups[label]) groups[label] = { label, income: 0, costs: 0 };
    if (entry.amount > 0) groups[label].income += entry.amount;
    else groups[label].costs += Math.abs(entry.amount);
  });
  return Object.values(groups)
    .map(row => ({ ...row, profit: row.income - row.costs }))
    .filter(row => row.income > 0 || row.costs > 0)
    .sort((a, b) => b.profit - a.profit);
}

function renderPerformanceTable(rows) {
  if (!rows.length) return '<div class="empty">No vehicle or service activity recorded yet.</div>';
  return `<div class="finance-table-scroll"><table class="dash-table finance-analytics-table">
    <thead><tr><th>Vehicle / job</th><th>Revenue</th><th>Costs</th><th>Result</th></tr></thead>
    <tbody>${rows.map(row => `<tr>
      <td>${esc(row.label)}</td>
      <td class="mono pos">+€${fmt(row.income)}</td>
      <td class="mono neg">−€${fmt(row.costs)}</td>
      <td class="mono ${row.profit >= 0 ? 'pos' : 'neg'}">${row.profit >= 0 ? '+' : '−'}€${fmt(Math.abs(row.profit))}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function renderExpenseDonut({ list, total }) {
  let cum = 0;
  const segments = list.map(b => {
    const start = cum / total * Math.PI * 2 - Math.PI / 2;
    const end = (cum + b.value) / total * Math.PI * 2 - Math.PI / 2;
    const mid = (start + end) / 2;
    const shiftX = Math.cos(mid) * 5;
    const shiftY = Math.sin(mid) * 5;
    cum += b.value;
    return `<path class="donut-segment"
      d="${donutSegmentPath(start, end)}"
      fill="${b.color}"
      style="--segment-shift-x:${shiftX.toFixed(2)}px; --segment-shift-y:${shiftY.toFixed(2)}px"
      data-label="${esc(b.label)}"
      data-value="€${fmt(b.value)}"
      data-percentage="${Math.round(b.value / total * 100)}%"
      data-color="${b.color}"
      data-tooltip-angle="${mid}"
      onmouseenter="showDonutTooltip(this)"
      onmouseleave="hideDonutTooltip(this)"
      onfocus="showDonutTooltip(this)"
      onblur="hideDonutTooltip(this)"
      tabindex="0"
      role="img"
      aria-label="${esc(b.label)}: €${fmt(b.value)}, ${Math.round(b.value / total * 100)}%"></path>`;
  }).join('');
  return `
    <div class="donut-wrap">
      <div class="donut">
        <svg viewBox="0 0 200 200" aria-label="Expense breakdown">
          ${segments}
        </svg>
        <div class="donut-hole"><div class="small">Total</div><div class="mono" style="font-size:14px">€${fmt(total)}</div></div>
        <div class="donut-tooltip" role="status" aria-live="polite">
          <span class="donut-tooltip-swatch"></span>
          <span class="donut-tooltip-content">
            <strong class="donut-tooltip-label"></strong>
            <span><span class="donut-tooltip-value"></span><span class="donut-tooltip-separator"> · </span><span class="donut-tooltip-percentage"></span></span>
          </span>
        </div>
      </div>
    </div>
    <div class="donut-legend">
      ${list.map(b => `<div class="legend-row"><span class="legend-dot" style="background:${b.color}"></span>${esc(b.label)}<span class="mono legend-amt">€${fmt(b.value)}</span></div>`).join('')}
    </div>
  `;
}

function donutPoint(angle, radius) {
  return `${(100 + Math.cos(angle) * radius).toFixed(2)} ${(100 + Math.sin(angle) * radius).toFixed(2)}`;
}

function donutSegmentPath(start, end) {
  const outer = 84, inner = 44;
  const span = end - start;
  if (span >= Math.PI * 2 - 0.001) {
    return `M ${donutPoint(start, outer)} A ${outer} ${outer} 0 1 1 ${donutPoint(start + Math.PI, outer)} A ${outer} ${outer} 0 1 1 ${donutPoint(start, outer)} L ${donutPoint(start, inner)} A ${inner} ${inner} 0 1 0 ${donutPoint(start + Math.PI, inner)} A ${inner} ${inner} 0 1 0 ${donutPoint(start, inner)} Z`;
  }
  const largeArc = span > Math.PI ? 1 : 0;
  return `M ${donutPoint(start, outer)} A ${outer} ${outer} 0 ${largeArc} 1 ${donutPoint(end, outer)} L ${donutPoint(end, inner)} A ${inner} ${inner} 0 ${largeArc} 0 ${donutPoint(start, inner)} Z`;
}

function showDonutTooltip(segment) {
  const wrap = segment.closest('.donut-wrap');
  const donut = wrap.querySelector('.donut');
  const tooltip = wrap.querySelector('.donut-tooltip');
  tooltip.querySelector('.donut-tooltip-swatch').style.background = segment.dataset.color;
  tooltip.querySelector('.donut-tooltip-label').textContent = segment.dataset.label;
  tooltip.querySelector('.donut-tooltip-value').textContent = segment.dataset.value;
  tooltip.querySelector('.donut-tooltip-percentage').textContent = segment.dataset.percentage;
  tooltip.classList.add('visible');

  const donutRect = donut.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const angle = Number(segment.dataset.tooltipAngle);
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  const halfWidth = tooltipRect.width / 2;
  const halfHeight = tooltipRect.height / 2;
  const radialExtent = halfWidth * Math.abs(directionX) + halfHeight * Math.abs(directionY);
  const outerRadius = Math.min(donutRect.width, donutRect.height) * 84 / 200;
  const distance = outerRadius + 14 + radialExtent;
  const centerX = donutRect.width / 2;
  const centerY = donutRect.height / 2;
  let left = centerX + directionX * distance;
  let top = centerY + directionY * distance;

  const panel = wrap.closest('.panel');
  const boundary = panel ? panel.getBoundingClientRect() : {
    left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight,
  };
  const minLeft = Math.max(halfWidth + 8, boundary.left - donutRect.left + halfWidth + 8, halfWidth + 8 - donutRect.left);
  const maxLeft = Math.min(boundary.right - donutRect.left - halfWidth - 8, window.innerWidth - donutRect.left - halfWidth - 8);
  const minTop = Math.max(halfHeight + 8, boundary.top - donutRect.top + halfHeight + 8, halfHeight + 8 - donutRect.top);
  const maxTop = Math.min(boundary.bottom - donutRect.top - halfHeight - 8, window.innerHeight - donutRect.top - halfHeight - 8);
  left = Math.min(Math.max(left, minLeft), maxLeft);
  top = Math.min(Math.max(top, minTop), maxTop);
  tooltip.style.setProperty('--tooltip-x', `${left}px`);
  tooltip.style.setProperty('--tooltip-y', `${top}px`);
}

function hideDonutTooltip(segment) {
  const wrap = segment.closest('.donut-wrap');
  wrap.querySelector('.donut-tooltip').classList.remove('visible');
}
