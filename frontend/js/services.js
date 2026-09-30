// -----------------------------------------------------------------------
// Service jobs: standalone work for a customer's own car (oil change,
// inspection, a repair) — separate from cars bought to flip. Each job
// tracks what was charged, labor cost, and any parts used from inventory.
// -----------------------------------------------------------------------

let services = [];
let showLogServiceForm = false;

function renderServices() {
  const sorted = [...services].sort((a, b) => b.date.localeCompare(a.date));
  const totalRevenue = services.reduce((s, j) => s + j.price, 0);
  const totalProfit = services.reduce((s, j) => s + j.profit, 0);

  return `
    <div class="dash-head">
      <div>
        <h1>Service Jobs</h1>
        <p class="sub">Oil changes, inspections and repairs for customers' own cars.</p>
      </div>
      <button class="btn" onclick="toggleLogServiceForm()">${showLogServiceForm ? 'Cancel' : '+ Add job'}</button>
    </div>
    <div class="grid">
      <div class="stat"><div class="label">Jobs done</div><div class="num">${services.length}</div></div>
      <div class="stat"><div class="label">Revenue from jobs</div><div class="num">€${fmt(totalRevenue)}</div></div>
      <div class="stat"><div class="label">Profit from jobs</div><div class="num ${totalProfit >= 0 ? 'pos' : 'neg'}">€${fmt(totalProfit)}</div></div>
    </div>

    ${showLogServiceForm ? renderLogServiceForm() : ''}

    ${sorted.length === 0 ? '<div class="empty">No service jobs logged yet.</div>' : `<div class="service-list">${sorted.map(serviceCard).join('')}</div>`}
  `;
}

function renderLogServiceForm() {
  const availableParts = parts.filter(p => p.category !== 'tool' && p.stock > 0);
  return `
    <div class="panel">
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
      <div class="field"><label>Parts used</label>
        ${availableParts.length === 0
          ? '<span class="small">No consumable parts in inventory.</span>'
          : availableParts.map(p => `
            <div class="row" style="margin:4px 0; align-items:center">
              <label style="display:flex; align-items:center; gap:8px; min-width:220px">
                <input id="jf-part-${p.id}" type="checkbox"> ${esc(p.name)} (${p.stock} in stock)
              </label>
              <input id="jf-part-qty-${p.id}" type="number" min="1" max="${p.stock}" value="1" style="width:70px" aria-label="Quantity of ${esc(p.name)}">
            </div>`).join('')}
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
          <span><small>Charged</small><strong>€${fmt(j.price)}</strong></span>
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
        ${j.parts_used.length === 0 ? '<p class="small service-empty-detail">No parts recorded for this job.</p>' : `
        <table><thead><tr><th>Part used</th><th>Qty</th><th>Cost</th><th></th></tr></thead><tbody>
        ${j.parts_used.map(p => `<tr><td>${esc(p.part_name)}</td><td class="mono">${p.qty}</td><td class="mono">€${fmt(p.cost)}</td>
        <td><button class="ghost" onclick="delServicePartUsed(${p.id})">Remove</button></td></tr>`).join('')}
        </tbody></table>`}
        ${j.notes ? `<p class="small service-notes">${esc(j.notes)}</p>` : ''}
      </div>
    </details>
  `;
}

async function addService() {
  const desc = document.getElementById('jf-desc').value.trim();
  if (!desc) { alert('Describe the job.'); return; }
  const partsUsed = parts
    .filter(p => p.category !== 'tool' && document.getElementById(`jf-part-${p.id}`)?.checked)
    .map(p => ({
      part_id: p.id,
      qty: Number(document.getElementById(`jf-part-qty-${p.id}`).value) || 1
    }));
  await api('/services', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      date: document.getElementById('jf-date').value || today(),
      customer: document.getElementById('jf-customer').value.trim() || null,
      vehicle: document.getElementById('jf-vehicle').value.trim() || null,
      description: desc,
      price: Number(document.getElementById('jf-price').value) || 0,
      labor_cost: Number(document.getElementById('jf-labor').value) || 0,
      parts_used: partsUsed
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
