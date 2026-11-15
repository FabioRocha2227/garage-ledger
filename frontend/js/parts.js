// -----------------------------------------------------------------------
// Inventory: tools/equipment and consumables history. Existing parts
// inventory handlers remain available for older data and integrations.
//
// Items come in two categories:
//   "tool" — equipment owned; tracked for reference
//            but never tied to a specific car or deducted automatically
// -----------------------------------------------------------------------

let showAddPartForm = false;
let showConsumableForm = false;
let consumablesHistoryOpen = true;

function renderParts() {
  const sorted = [...parts].sort((a, b) => a.name.localeCompare(b.name));
  const tools = sorted.filter(p => p.category === 'tool');
  const d = inventoryValues([], tools);

  return `
    <div class="parts-page">
    <div class="dash-head">
      <div>
        <h1>Inventory</h1>
        <p class="sub">Consumables history and tools/equipment you own.</p>
      </div>
      <button class="btn" onclick="toggleAddPartForm()">${showAddPartForm ? 'Cancel' : '+ Add item'}</button>
    </div>
    <div class="grid inventory-summary">
      <div class="stat stat-icon inventory-stat inventory-stat-value">
        <div class="icon-box icon-blue">€</div><div><div class="label">Inventory value</div><div class="num">€${fmt(d.totalValue)}</div></div>
      </div>
      <div class="stat stat-icon inventory-stat inventory-stat-tools">
        <div class="icon-box icon-amber">⚒</div><div><div class="label">Tools &amp; equipment</div><div class="num">${fmt(d.toolUnits)}</div><div class="stat-sub">${d.toolItems} item${d.toolItems === 1 ? '' : 's'}</div></div>
      </div>
    </div>
    ${showAddPartForm ? renderAddPartForm() : ''}
    ${renderConsumablesHistory()}

    <div class="inventory-section inventory-tools-section">
      <div class="inventory-section-head inventory-tools-head"><h2>Tools &amp; Equipment <span class="small">(${tools.length})</span></h2></div>
      ${renderPartsTable(tools, true)}
    </div>

    ${renderInventoryDistribution(d)}
    </div>
  `;
}

function renderConsumablesHistory() {
  const total = consumables.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  return `
    <div class="inventory-section consumables-history">
      <details class="panel consumables-history-panel" ${consumablesHistoryOpen ? 'open' : ''} ontoggle="consumablesHistoryOpen = this.open">
        <summary class="consumables-history-summary">
          <span><strong>Consumables History</strong><span class="small">${consumables.length} purchase${consumables.length === 1 ? '' : 's'}</span></span>
          <span class="consumables-history-total">Total value: <strong>€${fmt(total)}</strong></span>
        </summary>
        <div class="consumables-history-content">
          ${showConsumableForm ? renderConsumableForm() : ''}
          ${consumables.length === 0 ? '<div class="empty">No consumables purchases logged yet.</div>' : `
          <table class="dash-table"><thead><tr><th>Date</th><th>Consumable</th><th>Quantity</th><th>Unit cost</th><th>Total</th><th>Supplier</th><th></th></tr></thead><tbody>
          ${consumables.map(item => `<tr>
            <td class="mono small">${esc(item.date)}</td>
            <td><strong>${esc(item.name)}</strong></td>
            <td class="mono">${item.quantity}</td>
            <td class="mono">€${fmt(item.unit_cost)}</td>
            <td class="mono">€${fmt(item.total)}</td>
            <td class="small">${item.supplier ? esc(item.supplier) : '—'}</td>
            <td><button class="icon-btn" title="Remove purchase" onclick="deleteConsumable(${item.id})">🗑️</button></td>
          </tr>`).join('')}
          </tbody></table>`}
          <div class="consumables-history-actions">
            <button class="btn" onclick="toggleConsumableForm()">${showConsumableForm ? 'Cancel' : '+ Log purchase'}</button>
          </div>
        </div>
      </details>
    </div>
  `;
}

function renderConsumableForm() {
  return `
    <div class="consumables-form">
      <div class="row">
        <div class="field"><label>Date</label><input id="ch-date" type="date" value="${today()}"></div>
        <div class="field"><label>Consumable</label><input id="ch-name" placeholder="e.g. Box of gloves"></div>
        <div class="field"><label>Quantity</label><input id="ch-quantity" type="number" min="1" value="1"></div>
        <div class="field"><label>Unit cost (€)</label><input id="ch-cost" type="number" min="0" step="0.01" placeholder="0.00"></div>
        <div class="field"><label>Supplier (optional)</label><input id="ch-supplier" placeholder="Supplier"></div>
      </div>
      <button class="btn" onclick="addConsumable()">Save purchase</button>
    </div>
  `;
}

function toggleConsumableForm() {
  showConsumableForm = !showConsumableForm;
  document.getElementById('main').innerHTML = renderParts();
}

async function addConsumable() {
  const name = document.getElementById('ch-name').value.trim();
  const quantity = Number(document.getElementById('ch-quantity').value);
  const unitCost = Number(document.getElementById('ch-cost').value);
  if (!name || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitCost) || unitCost < 0) {
    alert('Enter a name, a positive quantity, and a valid unit cost.');
    return;
  }
  await api('/consumables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: document.getElementById('ch-date').value,
      name,
      quantity,
      unit_cost: unitCost,
      supplier: document.getElementById('ch-supplier').value.trim() || null
    })
  });
  showConsumableForm = false;
  await setView('parts');
}

async function deleteConsumable(id) {
  if (!confirm('Remove this consumables purchase from the history?')) return;
  await api(`/consumables/${id}`, { method: 'DELETE' });
  await setView('parts');
}

function renderAddPartForm() {
  return `
    <div class="panel">
      <h2>Add an item</h2>
      <div class="row">
        <div class="field"><label>Name</label><input id="pn-name" placeholder="e.g. Brake pads (front), or Car jack"></div>
        <input id="pn-category" type="hidden" value="tool">
        <div class="field"><label>Stock / qty owned</label><input id="pn-stock" type="number" min="0" value="1"></div>
        <div class="field"><label>Unit cost (€)</label><input id="pn-cost" type="number" min="0" placeholder="0"></div>
        <div class="field"><label>Supplier (optional)</label><input id="pn-supplier" placeholder="Supplier"></div>
        <button class="btn" onclick="addPart()">Add item</button>
      </div>
    </div>
  `;
}

function toggleAddPartForm() {
  showAddPartForm = !showAddPartForm;
  document.getElementById('main').innerHTML = renderParts();
}

function inventoryValues(consumables, tools) {
  const valueOf = items => items.reduce((sum, p) => sum + (Number(p.stock) || 0) * (Number(p.unit_cost) || 0), 0);
  const partsValue = valueOf(consumables);
  const toolsValue = valueOf(tools);
  return {
    partsItems: consumables.length,
    partsUnits: consumables.reduce((sum, p) => sum + (Number(p.stock) || 0), 0),
    partsValue,
    toolItems: tools.length,
    toolUnits: tools.reduce((sum, p) => sum + (Number(p.stock) || 0), 0),
    toolsValue,
    totalValue: partsValue + toolsValue
  };
}

function renderInventoryDistribution(d) {
  const rows = [
    ['Tools & Equipment', d.toolItems, d.toolUnits, d.toolsValue]
  ];
  return `
    <div class="inventory-section inventory-distribution">
      <div class="inventory-section-head"><h2>Inventory distribution</h2></div>
      <div class="panel inventory-distribution-panel">
        ${rows.map(([name, itemCount, quantity, value]) => {
          const share = d.totalValue ? Math.round(value / d.totalValue * 100) : 0;
          return `
            <div class="inventory-bar-row">
              <div class="inventory-bar-label"><strong>${name}</strong><span class="small">${itemCount} item${itemCount === 1 ? '' : 's'} · ${quantity} unit${quantity === 1 ? '' : 's'}</span></div>
              <div class="inventory-bar-track"><div class="inventory-bar-fill" style="width:${share}%"></div></div>
              <div class="inventory-bar-value"><strong>${share}%</strong><span class="small">€${fmt(value)}</span></div>
            </div>`;
        }).join('')}
        <div class="inventory-distribution-total"><span>Total inventory value</span><strong>€${fmt(d.totalValue)}</strong></div>
      </div>
    </div>
  `;
}

function renderPartsTable(items, isTool) {
  if (items.length === 0) {
    return `<div class="panel inventory-empty"><div class="empty">${isTool ? 'No tools or equipment logged yet.' : 'No consumable parts yet.'}</div></div>`;
  }

  return `
    <div class="panel inventory-table-panel">
      <table class="dash-table">
        <thead><tr><th>Item</th><th>${isTool ? 'Qty owned' : 'Stock'}</th><th>Unit cost</th><th>Supplier</th><th>Photo</th><th>Actions</th></tr></thead>
        <tbody>${items.map(p => `
          <tr>
            <td><strong>${esc(p.name)}</strong></td>
            <td class="mono ${!isTool && p.stock <= 2 ? 'neg' : ''}">${p.stock}</td>
            <td class="mono">€${fmt(p.unit_cost)}</td>
            <td class="small">${p.supplier ? esc(p.supplier) : '—'}</td>
            <td>${partThumb(p)}</td>
            <td><div class="row-actions">
              <label class="icon-btn" title="Add photo">＋<input type="file" accept="image/*" style="display:none" onchange="uploadPartPhoto(${p.id}, event)"></label>
              <button class="icon-btn" title="Remove" onclick="delPart(${p.id})">🗑️</button>
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function partThumb(p) {
  if (p.photos && p.photos.length) return `<img class="inventory-thumb" src="${p.photos[0].url}" alt="${esc(p.name)}">`;
  return '<div class="inventory-thumb inventory-thumb-placeholder">▧</div>';
}

async function addPart() {
  const name = document.getElementById('pn-name').value.trim();
  if (!name) { alert('Give it a name.'); return; }
  await api('/parts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      name,
      category: document.getElementById('pn-category').value,
      stock: Number(document.getElementById('pn-stock').value) || 0,
      unit_cost: Number(document.getElementById('pn-cost').value) || 0,
      supplier: document.getElementById('pn-supplier').value.trim() || null
    })
  });
  showAddPartForm = false;
  await setView('parts');
}

async function delPart(id) {
  if (!confirm('Remove this item from inventory?')) return;
  await api(`/parts/${id}`, { method: 'DELETE' });
  await setView('parts');
}

async function uploadPartPhoto(id, ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  await api(`/parts/${id}/photos`, { method: 'POST', body: fd });
  await setView('parts');
}

async function removePartPhoto(pid) {
  await api(`/photos/${pid}`, { method: 'DELETE' });
  await setView('parts');
}
