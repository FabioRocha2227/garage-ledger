// -----------------------------------------------------------------------
// Dashboard. Core stats render immediately from `dashboardData` (fetched
// by main.js). A few extra panels — the monthly chart, the low-stock check, 
// the quick ledger and "cars in progress" 
// -----------------------------------------------------------------------

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function renderDashboard() {
  const d = dashboardData;

  loadDashboardExtras();

  return `
    <div class="dash-head">
      <div>
        <h1>${greeting()}.</h1>
        <p class="sub">Your workshop has <strong class="accent-text">${d.in_stock} car${d.in_stock === 1 ? '' : 's'} in stock</strong>
          and <strong class="accent-text">${d.service_jobs} service job${d.service_jobs === 1 ? '' : 's'}</strong> logged so far.</p>
      </div>
      <div class="dash-actions">
        <button class="btn" onclick="setView('services')">+ New job</button>
        <button class="ghost" onclick="setView('cars')">+ Add car</button>
      </div>
    </div>

    <div class="grid dash-stats">
      <div class="stat stat-icon">
        <div class="icon-box icon-orange">€</div>
        <div>
          <div class="label">Cars + jobs profit</div>
          <div class="num ${d.total_profit >= 0 ? 'pos' : 'neg'}">€${fmt(d.total_profit)}</div>
        </div>
      </div>
      <div class="stat stat-icon">
        <div class="icon-box icon-blue">🚗</div>
        <div>
          <div class="label">Cars in stock</div>
          <div class="num">${d.in_stock}</div>
          <div class="stat-sub">Valued at €${fmt(d.tied_up)}</div>
        </div>
      </div>
      <div class="stat stat-icon">
        <div class="icon-box icon-purple">🔧</div>
        <div>
          <div class="label">Service jobs</div>
          <div class="num">${d.service_jobs}</div>
          <div class="stat-sub">€${fmt(d.service_revenue)} revenue</div>
        </div>
      </div>
        <div class="stat"><div class="label">Avg. days to flip</div><div class="num">${d.avg_days === null ? '—' : d.avg_days}</div></div>

    </div>

    <div class="dash-columns">
      <div class="dash-main">
        <div class="panel">
          <div class="panel-head">
            <h2>Profit &amp; revenue</h2>
            <div class="legend"><span><i class="dot dot-accent"></i>Revenue</span><span><i class="dot dot-good"></i>Net profit</span></div>
          </div>
          <div id="dash-chart"><div class="empty">Loading chart…</div></div>
        </div>

        <div class="panel">
          <div class="panel-head">
            <h2>Recent cars</h2>
            <span class="linklike" onclick="setView('cars')">View all cars</span>
          </div>
          ${d.recent.length === 0 ? '<div class="empty">No cars yet — add one in the Cars tab.</div>' : `
          <table class="dash-table"><thead><tr><th>Vehicle</th><th>Status</th><th>Cost so far</th><th>Profit</th></tr></thead><tbody>
          ${d.recent.map(c => `<tr onclick="openCarFromDash(${c.id})">
              <td><div class="veh-cell">${carThumb(c)}<span>${esc(c.name)}</span></div></td>
              <td>${statusBadge(c)}</td>
              <td class="mono">€${fmt(c.cost)}</td>
              <td class="mono ${c.profit == null ? '' : (c.profit >= 0 ? 'pos' : 'neg')}">${c.profit == null ? '—' : (c.profit >= 0 ? '+' : '') + '€' + fmt(c.profit)}</td>
            </tr>`).join('')}
          </tbody></table>`}
        </div>
      </div>

      <div class="dash-side">
        <div class="panel">
          <h2>Quick ledger</h2>
          <div id="dash-ledger"><div class="empty">Loading…</div></div>
          <button class="ghost dash-fullwidth" onclick="setView('finances')">Go to full ledger</button>
        </div>

        <div class="panel">
          <h2>Cars in progress</h2>
          <div id="dash-inprogress"><div class="empty">Loading…</div></div>
        </div>
      </div>
    </div>
  `;
}

function carThumb(c) {
  if (c.photos && c.photos.length) return `<img class="veh-thumb" src="${c.photos[0].url}">`;
  return `<div class="veh-thumb veh-thumb-placeholder">🚗</div>`;
}

async function openCarFromDash(id) {
  view = 'cars';
  await setView('cars');
  await openCar(id);
}

// ---- extra panels, loaded independently of the core dashboard fetch ----

async function loadDashboardExtras() {
  const [allParts, fin] = await Promise.all([api('/parts'), api('/finances')]);
  parts = allParts;   // shared global also used by the parts dropdowns elsewhere
  financeData = fin;  // shared global also used by the Finances page
  if (view !== 'dashboard') return; // user navigated away while this was loading

  renderLowStockTile();
  renderQuickLedger();
  renderInProgress();
  renderChart();
}

function renderLowStockTile() {
  const el = document.getElementById('dash-lowstock-tile');
  if (!el) return;
  const low = parts.filter(p => p.category !== 'tool' && p.stock <= 2);
  el.querySelector('.num').textContent = low.length;
  const sub = el.querySelector('.stat-sub');
  sub.textContent = low.length ? 'Restock needed' : 'All parts stocked';
  sub.classList.toggle('neg', low.length > 0);
}

function renderQuickLedger() {
  const el = document.getElementById('dash-ledger');
  if (!el) return;
  const recent = financeData.entries.slice(0, 4);
  if (recent.length === 0) { el.innerHTML = '<div class="empty">No transactions yet.</div>'; return; }
  el.innerHTML = recent.map(e => `
    <div class="ledger-row">
      <div class="ledger-icon ${e.amount >= 0 ? 'in' : 'out'}">${e.amount >= 0 ? '↑' : '↓'}</div>
      <div class="ledger-text">
        <div class="ledger-title">${esc(e.type)}</div>
        <div class="ledger-sub">${esc(e.car)}</div>
      </div>
      <div class="mono ${e.amount >= 0 ? 'pos' : 'neg'}">${e.amount >= 0 ? '+' : ''}€${fmt(e.amount)}</div>
    </div>
  `).join('');
}

function renderInProgress() {
  const el = document.getElementById('dash-inprogress');
  if (!el) return;
  const inProgress = dashboardData.recent.filter(c => c.sale_price == null).slice(0, 4);
  if (inProgress.length === 0) { el.innerHTML = '<div class="empty">Nothing in progress right now.</div>'; return; }
  el.innerHTML = inProgress.map(c => `
    <div class="ledger-row" style="cursor:pointer" onclick="openCarFromDash(${c.id})">
      ${carThumb(c)}
      <div class="ledger-text">
        <div class="ledger-title">${esc(c.name)}</div>
        <div class="ledger-sub">Bought ${c.purchase_date}</div>
      </div>
      <div class="mono">€${fmt(c.cost)}</div>
    </div>
  `).join('');
}

// ---- monthly Profit & Revenue chart, built from real transaction history ----

function monthlySeries(entries) {
  const byMonth = {};
  entries.forEach(e => {
    const month = e.date.slice(0, 7); // YYYY-MM
    if (!byMonth[month]) byMonth[month] = { revenue: 0, net: 0 };
    if (e.amount > 0) byMonth[month].revenue += e.amount;
    byMonth[month].net += e.amount;
  });
  return Object.keys(byMonth).sort().slice(-8).map(m => ({ month: m, ...byMonth[m] }));
}

function renderChart() {
  const el = document.getElementById('dash-chart');
  if (!el) return;
  const series = monthlySeries(financeData.entries);
  if (series.length === 0) { el.innerHTML = '<div class="empty">Not enough transactions yet for a trend.</div>'; return; }

  const W = 640, H = 220, padL = 44, padR = 10, padT = 10, padB = 24;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxVal = Math.max(1, ...series.map(s => Math.max(s.revenue, Math.abs(s.net))));
  const step = chartW / series.length;
  const barW = step * 0.5;

  const grid = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const y = padT + chartH * (1 - f);
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>
            <text x="0" y="${(y + 4).toFixed(1)}" class="chart-axis">€${fmt(Math.round(maxVal * f))}</text>`;
  }).join('');

  const bars = series.map((s, i) => {
    const x = padL + step * i + (step - barW) / 2;
    const h = Math.max(1, Math.abs(s.net) / maxVal * chartH);
    const y = padT + chartH - h;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${s.net >= 0 ? 'var(--good)' : 'var(--bad)'}" opacity="0.9"/>`;
  }).join('');

  const points = series.map((s, i) => {
    const x = padL + step * i + step / 2;
    const y = padT + chartH - (s.revenue / maxVal * chartH);
    return [x, y];
  });
  const linePath = 'M' + points.map(p => p.map(n => n.toFixed(1)).join(',')).join(' L');
  const dots = points.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="var(--accent)"/>`).join('');

  const labels = series.map((s, i) => {
    const x = padL + step * i + step / 2;
    const label = new Date(s.month + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short' });
    return `<text x="${x.toFixed(1)}" y="${H - 6}" class="chart-axis" text-anchor="middle">${label}</text>`;
  }).join('');

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
    ${grid}${bars}<path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="2"/>${dots}${labels}
  </svg>`;
}
