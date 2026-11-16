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
let toolsHistoryOpen = false;

function renderParts() {
  const consumableTotal = consumables.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const toolTotal = toolPurchases.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const purchaseTotal = consumableTotal + toolTotal;

  return `
    <div class="parts-page">
    <div class="dash-head">
      <div>
        <h1>Inventory</h1>
        <p class="sub">Keep every consumable and equipment purchase organized in one place.</p>
      </div>
      <div class="dash-actions inventory-actions">
        <button class="ghost" onclick="toggleConsumableForm()">${showConsumableForm ? 'Cancel' : '+ Log consumable'}</button>
        <button class="btn" onclick="toggleAddPartForm()">${showAddPartForm ? 'Cancel' : '+ Log tool purchase'}</button>
      </div>
    </div>
    <div class="inventory-summary-grid">
      <div class="inventory-summary-card inventory-summary-total">
        <div class="inventory-summary-icon">€</div>
        <div><span class="label">Recorded purchase spend</span><strong>€${fmt(purchaseTotal)}</strong><small>${consumables.length + toolPurchases.length} purchase${consumables.length + toolPurchases.length === 1 ? '' : 's'} recorded</small></div>
      </div>
      <div class="inventory-summary-card inventory-summary-consumables">
        <div class="inventory-summary-icon">C</div>
        <div><span class="label">Consumables</span><strong>€${fmt(consumableTotal)}</strong><small>${consumables.length} purchase${consumables.length === 1 ? '' : 's'}</small></div>
      </div>
      <div class="inventory-summary-card inventory-summary-tools">
        <div class="inventory-summary-icon">T</div>
        <div><span class="label">Tools &amp; equipment</span><strong>€${fmt(toolTotal)}</strong><small>${toolPurchases.length} purchase${toolPurchases.length === 1 ? '' : 's'}</small></div>
      </div>
    </div>
    ${showAddPartForm ? renderAddPartForm() : ''}
    ${renderConsumablesHistory()}
    ${renderToolsHistory()}

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
          <div class="inventory-section-intro"><strong>Everyday supplies</strong><span>Gloves, oils, cleaning products and other operating expenses.</span></div>
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

function renderToolsHistory() {
  const total = toolPurchases.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  return `
    <div class="inventory-section tools-history">
      <details class="panel consumables-history-panel" ${toolsHistoryOpen ? 'open' : ''} ontoggle="toolsHistoryOpen = this.open">
        <summary class="consumables-history-summary">
          <span><strong>Tools &amp; Equipment Purchases</strong><span class="small">${toolPurchases.length} purchase${toolPurchases.length === 1 ? '' : 's'}</span></span>
          <span class="consumables-history-total">Total expenses: <strong>€${fmt(total)}</strong></span>
        </summary>
        <div class="consumables-history-content">
          <div class="inventory-section-intro"><strong>Equipment owned by the business</strong><span>Tools are recorded as business expenses when purchased.</span></div>
          ${toolPurchases.length === 0 ? '<div class="empty">No tools or equipment purchases logged yet.</div>' : `
          <table class="dash-table"><thead><tr><th>Date</th><th>Tool / equipment</th><th>Quantity</th><th>Unit cost</th><th>Total</th><th>Supplier</th><th></th></tr></thead><tbody>
          ${toolPurchases.map(item => `<tr>
            <td class="mono small">${esc(item.date)}</td><td><strong>${esc(item.name)}</strong></td>
            <td class="mono">${item.quantity}</td><td class="mono">€${fmt(item.unit_cost)}</td>
            <td class="mono">€${fmt(item.total)}</td><td class="small">${item.supplier ? esc(item.supplier) : '—'}</td>
            <td><button class="icon-btn" title="Remove purchase" onclick="deleteToolPurchase(${item.id})">🗑️</button></td>
          </tr>`).join('')}
          </tbody></table>`}
        </div>
      </details>
    </div>
  `;
}

function toggleConsumableForm() {
  showConsumableForm = !showConsumableForm;
  consumablesHistoryOpen = true;
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
    <div class="panel inventory-form-panel">
      <div class="inventory-form-heading"><div><span class="inventory-eyebrow">New purchase</span><h2>Log tool or equipment purchase</h2></div><span class="small">This will also appear in Finances.</span></div>
      <div class="row">
        <div class="field"><label>Purchase date</label><input id="pn-date" type="date" value="${today()}"></div>
        <div class="field"><label>Tool / equipment</label><input id="pn-name" placeholder="e.g. Car jack"></div>
        <input id="pn-category" type="hidden" value="tool">
        <div class="field"><label>Quantity</label><input id="pn-stock" type="number" min="1" value="1"></div>
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
  const quantity = Number(document.getElementById('pn-stock').value);
  const unitCost = Number(document.getElementById('pn-cost').value) || 0;
  if (!name) { alert('Give it a name.'); return; }
  if (!Number.isInteger(quantity) || quantity < 1 || unitCost < 0) {
    alert('Enter a positive quantity and a valid unit cost.');
    return;
  }
  await api('/parts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      name,
      category: document.getElementById('pn-category').value,
      stock: quantity,
      unit_cost: unitCost,
      supplier: document.getElementById('pn-supplier').value.trim() || null
    })
  });
  await api('/tools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: document.getElementById('pn-date').value || today(),
      name,
      quantity,
      unit_cost: unitCost,
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

async function deleteToolPurchase(id) {
  if (!confirm('Remove this tools and equipment purchase from the history?')) return;
  await api(`/tools/${id}`, { method: 'DELETE' });
  await setView('parts');
}
