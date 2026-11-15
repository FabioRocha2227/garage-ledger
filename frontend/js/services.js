// -----------------------------------------------------------------------
// Service jobs: standalone work for a customer's own car (oil change,
// inspection, a repair) — separate from cars bought to flip.
// -----------------------------------------------------------------------

let services = [];
let showLogServiceForm = false;

function renderServices() {
  const sorted = [...services].sort((a, b) => b.date.localeCompare(a.date));
  const totalRevenue = services.reduce((s, j) => s + j.price, 0);
  const totalProfit = services.reduce((s, j) => s + j.profit, 0);

  return `
    <div class="services-page">
    <div class="dash-head">
      <div>
        <h1>Service Jobs</h1>
        <p class="sub">Oil changes, inspections and repairs for customers' own cars.</p>
      </div>
      <button class="btn" onclick="toggleLogServiceForm()">${showLogServiceForm ? 'Cancel' : '+ Add job'}</button>
    </div>
    <div class="grid">
      <div class="stat stat-icon service-stat service-stat-count">
        <div class="icon-box icon-service">✓</div><div><div class="label">Jobs done</div><div class="num">${services.length}</div></div>
      </div>
      <div class="stat stat-icon service-stat service-stat-revenue">
        <div class="icon-box icon-service">€</div><div><div class="label">Revenue from jobs</div><div class="num">€${fmt(totalRevenue)}</div></div>
      </div>
      <div class="stat stat-icon service-stat service-stat-profit">
        <div class="icon-box ${totalProfit >= 0 ? 'icon-profit-positive' : 'icon-profit-negative'}">↗</div><div><div class="label">Profit from jobs</div><div class="num ${totalProfit >= 0 ? 'pos' : 'neg'}">€${fmt(totalProfit)}</div></div>
      </div>
    </div>

    ${showLogServiceForm ? renderLogServiceForm() : ''}

    ${sorted.length === 0 ? '<div class="empty">No service jobs logged yet.</div>' : `<div class="service-list">${sorted.map(serviceCard).join('')}</div>`}
    </div>
  `;
}

function renderLogServiceForm() {
  return `
    <div class="panel service-form">
      <h2>Log a job</h2>
      <div class="row">
        <div class="field"><label>Date</label><input id="jf-date" type="date" value="${today()}"></div>
        <div class="field"><label>Customer (optional)</label><input id="jf-customer" placeholder="Name"></div>
        <div class="field"><label>Vehicle (optional)</label><input id="jf-vehicle" placeholder="e.g. Renault Clio, 12-AB-34"></div>
      </div>
      <div class="row">
        <div class="field" style="flex:1; min-width:220px"><label>Description</label><input id="jf-desc" placeholder="e.g. Oil change + filter"></div>
        <div class="field"><label>Price charged (€)</label><input id="jf-price" type="number" min="0" placeholder="0"></div>
        <div class="field"><label>Labor / other cost (€)</label><input id="jf-labor" type="number" min="0" placeholder="0"></div>
      </div>
      <button class="btn" onclick="addService()">Add job</button>
    </div>
  `;
}

function toggleLogServiceForm() {
  showLogServiceForm = !showLogServiceForm;
  document.getElementById('main').innerHTML = renderServices();
}

function serviceCard(j) {
  return `
    <details class="service-item">
      <summary class="service-summary">
        <div class="service-identity">
          <span class="service-date mono">${j.date}</span>
          <strong class="service-title">${esc(j.description)}</strong>
          <span class="service-context">${[j.customer, j.vehicle].filter(Boolean).map(esc).join(' · ') || 'No customer or vehicle recorded'}</span>
        </div>
        <div class="service-results">
          <span class="service-revenue"><small>Charged</small><strong>€${fmt(j.price)}</strong></span>
          <span><small>Cost</small><strong>€${fmt(j.cost)}</strong></span>
          <span class="${j.profit >= 0 ? 'pos' : 'neg'}"><small>Profit</small><strong>${j.profit >= 0 ? '+' : ''}€${fmt(j.profit)}</strong></span>
        </div>
        <span class="service-chevron" aria-hidden="true">›</span>
      </summary>
      <div class="service-details">
        <div class="service-details-head">
          <span class="small">Job details</span>
          <button class="ghost" onclick="delService(${j.id})">Remove job</button>
        </div>
        ${j.notes ? `<p class="small service-notes">${esc(j.notes)}</p>` : ''}
      </div>
    </details>
  `;
}

async function addService() {
  const desc = document.getElementById('jf-desc').value.trim();
  if (!desc) { alert('Describe the job.'); return; }
  await api('/services', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      date: document.getElementById('jf-date').value || today(),
      customer: document.getElementById('jf-customer').value.trim() || null,
      vehicle: document.getElementById('jf-vehicle').value.trim() || null,
      description: desc,
      price: Number(document.getElementById('jf-price').value) || 0,
      labor_cost: Number(document.getElementById('jf-labor').value) || 0,
      parts_used: []
    })
  });
  showLogServiceForm = false;
  await refreshServices();
}

async function delService(id) {
  if (!confirm('Remove this service job?')) return;
  await api(`/services/${id}`, { method: 'DELETE' });
  await refreshServices();
}

async function delServicePartUsed(usageId) {
  await api(`/service-part-usage/${usageId}`, { method: 'DELETE' });
  await refreshServices();
}

async function refreshServices() {
  parts = await api('/parts');
  services = await api('/services');
  document.getElementById('main').innerHTML = renderServices();
}
