// -----------------------------------------------------------------------
// Parts inventory: list, add, delete, and photos per item.
//
// Items come in two categories:
//   "part" — consumable, gets used on a car and deducted from stock
//   "tool" — equipment owned; tracked for reference
//            but never tied to a specific car or deducted automatically
// -----------------------------------------------------------------------

let showAddPartForm = false;

function renderParts() {
  const sorted = [...parts].sort((a, b) => a.name.localeCompare(b.name));
  const consumables = sorted.filter(p => p.category !== 'tool' && p.stock > 0);
  const tools = sorted.filter(p => p.category === 'tool');
  const d = inventoryValues(consumables, tools);

  return `
    <div class="dash-head">
      <div>
        <h1>Parts Inventory</h1>
        <p class="sub">Consumable parts used on repairs, and tools/equipment you own.</p>
      </div>
      <button class="btn" onclick="toggleAddPartForm()">${showAddPartForm ? 'Cancel' : '+ Add item'}</button>
    </div>
    <div class="grid inventory-summary">
      <div class="stat"><div class="label">Inventory value</div><div class="num">€${fmt(d.totalValue)}</div></div>
      <div class="stat"><div class="label">Parts in stock</div><div class="num">${fmt(d.partsUnits)}</div><div class="stat-sub">${d.partsItems} item${d.partsItems === 1 ? '' : 's'}</div></div>
      <div class="stat"><div class="label">Tools &amp; equipment</div><div class="num">${fmt(d.toolUnits)}</div><div class="stat-sub">${d.toolItems} item${d.toolItems === 1 ? '' : 's'}</div></div>
    </div>
    ${showAddPartForm ? renderAddPartForm() : ''}

    <div class="inventory-section">
      <div class="inventory-section-head"><h2>Parts <span class="small">(${consumables.length})</span></h2></div>
      ${renderPartsTable(consumables, false)}
    </div>

    <div class="inventory-section">
      <div class="inventory-section-head"><h2>Tools &amp; Equipment <span class="small">(${tools.length})</span></h2></div>
      ${renderPartsTable(tools, true)}
    </div>

    ${renderInventoryDistribution(d)}
  `;
}

function renderAddPartForm() {
  return `
    <div class="panel">
      <h2>Add an item</h2>
      <div class="row">
        <div class="field"><label>Name</label><input id="pn-name" placeholder="e.g. Brake pads (front), or Car jack"></div>
        <div class="field"><label>Category</label>
          <select id="pn-category">
            <option value="part">Part (used on cars, stock deducts)</option>
            <option value="tool">Tool / Equipment (owned, not used up)</option>
          </select>
        </div>
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
    ['Parts', d.partsItems, d.partsUnits, d.partsValue],
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
