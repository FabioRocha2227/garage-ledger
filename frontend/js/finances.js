// -----------------------------------------------------------------------
// Finances: month-to-date summary, a real cash-flow trend chart, an
// expense breakdown by category, and the full transaction ledger with
// filtering and CSV export.
// -----------------------------------------------------------------------

let financeChartMonths = 6;   // 3 | 6 | 12
let financeTxFilter = 'all';  // all | income | expense
let showAddTxMenu = false;
let financeOverview = 'monthly'; // monthly | all-time

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
  if (t.startsWith('Expense:')) return { label: 'Other Expense', cls: 'cat-expense', desc: t.slice(9) };
  if (t.startsWith('Labor:')) return { label: 'Service Labor', cls: 'cat-labor', desc: t.slice(7) };
  if (t.startsWith('Job:')) return { label: 'Service Job', cls: 'cat-job', desc: t.slice(5) };
  return { label: t, cls: 'cat-other', desc: entry.car };
}

function renderFinances() {
  const entries = financeData.entries;

  // Fire-and-forget: fills in the backup list once it's fetched.
  loadBackupsList();

  const now = new Date();
  const lastMonthRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonth = entries.filter(e => isSameMonth(e.date, now));
  const lastMonth = entries.filter(e => isSameMonth(e.date, lastMonthRef));
  const sumIn = list => list.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const sumOut = list => list.filter(e => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);

  const mtdIncome = sumIn(thisMonth);
  const mtdExpense = sumOut(thisMonth);
  const mtdNet = mtdIncome - mtdExpense;
  const totalIncome = Number(financeData.total_in) || 0;
  const totalExpense = Math.abs(Number(financeData.total_out) || 0);
  const totalNet = totalIncome - totalExpense;
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

  const filteredEntries = financeTxFilter === 'all' ? entries
    : entries.filter(e => financeTxFilter === 'income' ? e.amount > 0 : e.amount < 0);

  return `
    <div class="dash-head">
      <div>
        <h1>Financial Ledger</h1>
        <p class="sub">Every euro in and out of the business — cars and service jobs combined.</p>
      </div>
      <div class="dash-actions">
        <a class="ghost" style="text-decoration:none; display:inline-block" href="${API}/export/csv">⬇ Export CSV</a>
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
        <button class="ghost" onclick="setView('parts')">📦 Parts or tools purchase</button>
      </div>
    </div>` : ''}

    <div class="panel">
      <div class="panel-head">
        <h2>Performance overview</h2>
        <div class="filter-tabs">
          <button class="tab ${financeOverview === 'monthly' ? 'active' : ''}" onclick="setFinanceOverview('monthly')">This month</button>
          <button class="tab ${financeOverview === 'all-time' ? 'active' : ''}" onclick="setFinanceOverview('all-time')">All time</button>
        </div>
      </div>
      <div class="grid dash-stats" style="margin-bottom:0">
        ${financeOverview === 'monthly' ? `
        <div class="stat stat-border border-good">
          <div class="label">Net profit (this month)</div>
          <div class="num ${mtdNet >= 0 ? 'pos' : 'neg'}">€${fmt(mtdNet)}</div>
          <div class="stat-sub ${deltaLabel.startsWith('↓') ? 'neg' : ''}">${deltaLabel}</div>
        </div>
        <div class="stat stat-border border-accent">
          <div class="label">Revenue (this month)</div>
          <div class="num">€${fmt(mtdIncome)}</div>
          <div class="stat-sub">Sales + service jobs</div>
        </div>
        <div class="stat stat-border border-bad">
          <div class="label">Expenses (this month)</div>
          <div class="num">€${fmt(mtdExpense)}</div>
          <div class="stat-sub">Purchases, repairs, parts</div>
        </div>
        <div class="stat stat-border border-blue">
          <div class="label">Profit margin</div>
          <div class="num">${margin === null ? '—' : margin + '%'}</div>
          <div class="stat-sub">Net ÷ revenue, this month</div>
        </div>` : `
        <div class="stat stat-border border-good">
          <div class="label">Total net profit</div>
          <div class="num ${totalNet >= 0 ? 'pos' : 'neg'}">€${fmt(totalNet)}</div>
        </div>
        <div class="stat stat-border border-accent">
          <div class="label">Total revenue</div>
          <div class="num">€${fmt(totalIncome)}</div>
          <div class="stat-sub">Sales + service jobs</div>
        </div>
        <div class="stat stat-border border-bad">
          <div class="label">Total expenses</div>
          <div class="num">€${fmt(totalExpense)}</div>
          <div class="stat-sub">Purchases, repairs, parts</div>
        </div>
        <div class="stat stat-border border-blue">
          <div class="label">Profit margin</div>
          <div class="num">${marginAllTime === null ? '—' : marginAllTime + '%'}</div>
          <div class="stat-sub">Net ÷ revenue, all time</div>
        </div>`}
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
          <div class="legend" style="margin-top:10px"><span><i class="dot dot-accent"></i>Income</span><span><i class="dot" style="background:var(--bad)"></i>Expenses</span></div>
        </div>
      </div>
      <div class="dash-side">
        <div class="panel">
          <h2>Expense breakdown</h2>
          ${expenseCats.total === 0 ? '<div class="empty">No expenses recorded yet.</div>' : renderExpenseDonut(expenseCats)}
        </div>
      </div>
    </div>

    <div class="panel finance-transactions">
      <div class="panel-head">
        <h2>Recent transactions</h2>
        <div class="filter-tabs">
          <button class="tab ${financeTxFilter === 'all' ? 'active' : ''}" onclick="setFinanceTxFilter('all')">All</button>
          <button class="tab ${financeTxFilter === 'income' ? 'active' : ''}" onclick="setFinanceTxFilter('income')">Income</button>
          <button class="tab ${financeTxFilter === 'expense' ? 'active' : ''}" onclick="setFinanceTxFilter('expense')">Expenses</button>
        </div>
      </div>
      ${filteredEntries.length === 0 ? '<div class="empty">No transactions match this filter.</div>' : `
      <table class="dash-table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Car / Customer</th><th>Amount</th></tr></thead><tbody>
      ${filteredEntries.slice(0, 60).map(e => {
        const cat = txCategory(e);
        return `<tr>
          <td class="mono small">${e.date}</td>
          <td><span class="cat-badge ${cat.cls}">${esc(cat.label)}</span></td>
          <td>${esc(cat.desc || '—')}</td>
          <td class="small">${esc(e.car)}</td>
          <td class="mono ${e.amount >= 0 ? 'pos' : 'neg'}">${e.amount >= 0 ? '+' : ''}€${fmt(e.amount)}</td>
        </tr>`;
      }).join('')}
      </tbody></table>
      ${filteredEntries.length > 60 ? `<p class="small" style="margin-top:10px">Showing the 60 most recent — export CSV for the full history.</p>` : ''}`}
    </div>

    <div class="panel">
      <div class="panel-head">
        <h2>Backup</h2>
        <button class="ghost" onclick="backupNow()">Back up now</button>
      </div>
      <p class="small" style="margin-top:-8px">A backup is taken automatically once a day. Each one is a full copy of <code>garage.db</code> and <code>uploads/</code>, kept for 14 days.</p>
      <div id="fin-backups"><div class="empty">Loading backups…</div></div>
    </div>
  `;
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
    <path d="${pathFor('income')}" fill="none" stroke="var(--accent)" stroke-width="2"/>${dotsFor('income', 'var(--accent)')}
    <path d="${pathFor('expense')}" fill="none" stroke="var(--bad)" stroke-width="2"/>${dotsFor('expense', 'var(--bad)')}
    ${labels}
  </svg>`;
}

// ---- expense breakdown donut, built from real transaction categories ----

function buildExpenseCategories(entries) {
  const buckets = {
    purchase: { label: 'Car purchases', color: '#e0611e', value: 0 },
    part: { label: 'Parts', color: '#6fb3e0', value: 0 },
    labor: { label: 'Repairs & labor', color: '#5fb383', value: 0 },
    other: { label: 'Other expenses', color: '#b48be0', value: 0 },
  };
  entries.forEach(e => {
    if (e.amount >= 0) return;
    const t = e.type, v = Math.abs(e.amount);
    if (t === 'Purchase') buckets.purchase.value += v;
    else if (t.startsWith('Part:')) buckets.part.value += v;
    else if (t.startsWith('Repair:') || t.startsWith('Labor:')) buckets.labor.value += v;
    else buckets.other.value += v;
  });
  const list = Object.values(buckets).filter(b => b.value > 0);
  const total = list.reduce((s, b) => s + b.value, 0);
  return { list, total };
}

function renderExpenseDonut({ list, total }) {
  let cum = 0;
  const stops = list.map(b => {
    const start = (cum / total * 100);
    cum += b.value;
    return `${b.color} ${start.toFixed(2)}% ${(cum / total * 100).toFixed(2)}%`;
  }).join(', ');
  return `
    <div class="donut-wrap">
      <div class="donut" style="background:conic-gradient(${stops})">
        <div class="donut-hole"><div class="small">Total</div><div class="mono" style="font-size:14px">€${fmt(total)}</div></div>
      </div>
    </div>
    <div class="donut-legend">
      ${list.map(b => `<div class="legend-row"><span class="legend-dot" style="background:${b.color}"></span>${esc(b.label)}<span class="mono legend-amt">€${fmt(b.value)}</span></div>`).join('')}
    </div>
  `;
}
