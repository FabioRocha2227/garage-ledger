// -----------------------------------------------------------------------
// Cars: the list view (redesigned as a searchable, filterable inventory),
// the detail view for one car, and every action that can be taken on a
// car (repairs, expenses, parts used, sale, photos).
// -----------------------------------------------------------------------

let carsSearch = '';
let carsFilter = 'all';   // all | stock | sold
let carsSort = 'recent';  // recent | profit | cost | oldest
let carsViewMode = 'table'; // table | grid
let carsPage = 1;
let showAddCarForm = false;
const CARS_PAGE_SIZE = 8;

function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
function daysInStock(c) { return Math.max(0, daysBetween(c.purchase_date, c.sale_date || today())); }

function filteredSortedCars() {
  let list = [...cars];
  if (carsFilter === 'stock') list = list.filter(c => c.sale_price == null);
  if (carsFilter === 'sold') list = list.filter(c => c.sale_price != null);
  if (carsSearch.trim()) {
    const q = carsSearch.trim().toLowerCase();
    list = list.filter(c => c.name.toLowerCase().includes(q) || (c.plate || '').toLowerCase().includes(q));
  }
  if (carsSort === 'profit') list.sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity));
  else if (carsSort === 'cost') list.sort((a, b) => b.cost - a.cost);
  else if (carsSort === 'oldest') list.sort((a, b) => a.purchase_date.localeCompare(b.purchase_date));
  else list.sort((a, b) => (a.sale_price != null ? 1 : 0) - (b.sale_price != null ? 1 : 0) || b.purchase_date.localeCompare(a.purchase_date));
  return list;
}

function renderCars() {
  const totalInvested = cars.reduce((s, c) => s + c.cost, 0);
  const totalProfit = cars.filter(c => c.sale_price != null).reduce((s, c) => s + c.profit, 0);

  const filtered = filteredSortedCars();
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / CARS_PAGE_SIZE));
  if (carsPage > totalPages) carsPage = totalPages;
  const start = (carsPage - 1) * CARS_PAGE_SIZE;
  const pageItems = filtered.slice(start, start + CARS_PAGE_SIZE);

  return `
    <div class="dash-head">
      <div>
        <h1>Cars</h1>
        <p class="sub">Manage every car bought, in repair, or sold.</p>
      </div>
      <div class="inv-summary">
        <div><div class="label">Total invested</div><div class="num">€${fmt(totalInvested)}</div></div>
        <div><div class="label">Total profit</div><div class="num ${totalProfit >= 0 ? 'pos' : 'neg'}">€${fmt(totalProfit)}</div></div>
      </div>
    </div>

    <div class="toolbar">
      <input id="car-search" class="search-input" placeholder="Search by name or plate…" value="${esc(carsSearch)}" oninput="onCarSearch(this.value)">
      <div class="filter-tabs">
        <button class="tab ${carsFilter === 'all' ? 'active' : ''}" onclick="setCarsFilter('all')">All Cars</button>
        <button class="tab ${carsFilter === 'stock' ? 'active' : ''}" onclick="setCarsFilter('stock')">In Stock</button>
        <button class="tab ${carsFilter === 'sold' ? 'active' : ''}" onclick="setCarsFilter('sold')">Sold</button>
      </div>
      <select class="sort-select" onchange="setCarsSort(this.value)">
        <option value="recent" ${carsSort === 'recent' ? 'selected' : ''}>Sort: Recently added</option>
        <option value="profit" ${carsSort === 'profit' ? 'selected' : ''}>Sort: Highest profit</option>
        <option value="cost" ${carsSort === 'cost' ? 'selected' : ''}>Sort: Highest cost</option>
        <option value="oldest" ${carsSort === 'oldest' ? 'selected' : ''}>Sort: Oldest first</option>
      </select>
      <div class="view-toggle">
        <button class="${carsViewMode === 'table' ? 'active' : ''}" onclick="setCarsViewMode('table')" title="Table view">☰</button>
        <button class="${carsViewMode === 'grid' ? 'active' : ''}" onclick="setCarsViewMode('grid')" title="Grid view">▦</button>
      </div>
      <button class="btn" onclick="toggleAddCarForm()">${showAddCarForm ? 'Cancel' : '+ Add car'}</button>
    </div>

    ${showAddCarForm ? renderAddCarForm() : ''}

    ${pageItems.length === 0 ? '<div class="empty">No cars match your search/filters.</div>' :
      (carsViewMode === 'table' ? renderCarsTable(pageItems) : renderCarsGrid(pageItems))}

    ${totalCount > CARS_PAGE_SIZE ? renderCarsPagination(start, pageItems.length, totalCount, totalPages) : ''}
  `;
}

function renderAddCarForm() {
  return `
    <div class="panel">
      <h2>Add a car</h2>
      <div class="row">
        <div class="field"><label>Name / description</label><input id="nf-name" placeholder="e.g. VW Golf Mk6 2011"></div>
        <div class="field"><label>Plate (optional)</label><input id="nf-plate" placeholder="00-AA-00"></div>
        <div class="field"><label>Purchase date</label><input id="nf-date" type="date" value="${today()}"></div>
        <div class="field"><label>Purchase price (€)</label><input id="nf-price" type="number" min="0" step="0.01" placeholder="0" required></div>
        <button class="btn" onclick="addCar()">Add car</button>
      </div>
    </div>
  `;
}

function timeBadge(c) {
  const d = daysInStock(c);
  if (c.sale_price != null) return `<span class="small">Sold after ${d} day${d === 1 ? '' : 's'}</span>`;
  const pct = Math.min(100, Math.round((d / 60) * 100));
  const cls = d > 60 ? 'bar-bad' : d > 30 ? 'bar-warn' : 'bar-good';
  return `
    <div class="time-bar-wrap">
      <span class="small">${d} day${d === 1 ? '' : 's'} in stock</span>
      <div class="time-bar"><div class="time-bar-fill ${cls}" style="width:${pct}%"></div></div>
    </div>`;
}

function renderCarsTable(items) {
  return `
    <div class="panel" style="padding:0; overflow:hidden">
      <table class="dash-table">
        <thead><tr><th>Vehicle</th><th>Status</th><th>Financials</th><th>Time</th><th>Actions</th></tr></thead>
        <tbody>
          ${items.map(c => `<tr>
            <td><div class="veh-cell"><span class="linklike" onclick="openCar(${c.id})">${carThumb(c)}</span>
              <div><div class="linklike" onclick="openCar(${c.id})">${esc(c.name)}</div>${c.plate ? `<div class="small">${esc(c.plate)}</div>` : ''}</div>
            </div></td>
            <td>${statusBadge(c)}</td>
            <td>
              <div class="mono">Cost: €${fmt(c.cost)}</div>
              <div class="mono small">${c.sale_price != null ? 'Sold: €' + fmt(c.sale_price) : 'Not sold yet'}</div>
            </td>
            <td>${timeBadge(c)}</td>
            <td class="row-actions">
              <button class="icon-btn" title="Open" onclick="openCar(${c.id})">✏️</button>
              <button class="icon-btn" title="Delete" onclick="quickDeleteCar(${c.id}, event)">🗑️</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderCarsGrid(items) {
  return `<div class="cars-grid">${items.map(c => `
    <div class="panel car-card">
      <div class="car-card-thumb">${carThumb(c, true)}</div>
      <div class="row" style="justify-content:space-between; align-items:flex-start; margin-top:10px">
        <div>
          <div class="linklike" style="font-size:15px" onclick="openCar(${c.id})">${esc(c.name)}</div>
          ${c.plate ? `<div class="small">${esc(c.plate)}</div>` : ''}
        </div>
        ${statusBadge(c)}
      </div>
      <div class="grid" style="grid-template-columns:1fr 1fr; margin:12px 0 8px">
        <div class="stat"><div class="label">Cost</div><div class="num" style="font-size:16px">€${fmt(c.cost)}</div></div>
        <div class="stat"><div class="label">${c.sale_price != null ? 'Profit' : 'Sale price'}</div>
          <div class="num ${c.profit == null ? '' : (c.profit >= 0 ? 'pos' : 'neg')}" style="font-size:16px">
            ${c.sale_price != null ? (c.profit >= 0 ? '+' : '') + '€' + fmt(c.profit) : '—'}
          </div>
        </div>
      </div>
      ${timeBadge(c)}
      <div class="row-actions" style="margin-top:12px">
        <button class="ghost" onclick="openCar(${c.id})">Open</button>
        <button class="icon-btn" title="Delete" onclick="quickDeleteCar(${c.id}, event)">🗑️</button>
      </div>
    </div>
  `).join('')}</div>`;
}

function renderCarsPagination(start, pageCount, totalCount, totalPages) {
  return `
    <div class="pagination">
      <span class="small">Showing ${start + 1}-${start + pageCount} of ${totalCount} car${totalCount === 1 ? '' : 's'}</span>
      <div class="row-actions">
        <button class="ghost" ${carsPage <= 1 ? 'disabled' : ''} onclick="setCarsPage(${carsPage - 1})">Previous</button>
        <button class="ghost" ${carsPage >= totalPages ? 'disabled' : ''} onclick="setCarsPage(${carsPage + 1})">Next</button>
      </div>
    </div>
  `;
}

function carThumb(c, big) {
  const cls = big ? 'veh-thumb veh-thumb-big' : 'veh-thumb';
  if (c.photos && c.photos.length) {
    const zoomWide = big ? ` onload="if (this.naturalWidth / this.naturalHeight > 3.5) this.classList.add('wide-photo')"` : '';
    return `<img class="${cls}" src="${c.photos[0].url}"${zoomWide}>`;
  }
  return `<div class="${cls} veh-thumb-placeholder">🚗</div>`;
}

/** Re-renders the cars list in place, preserving focus/caret in the search box so typing isn't interrupted. */
function refreshCarsView() {
  const active = document.activeElement;
  const wasSearchFocused = active && active.id === 'car-search';
  const caret = wasSearchFocused ? active.selectionStart : null;
  document.getElementById('main').innerHTML = renderCars();
  if (wasSearchFocused) {
    const el = document.getElementById('car-search');
    if (el) { el.focus(); if (caret !== null) el.setSelectionRange(caret, caret); }
  }
}

function onCarSearch(v) { carsSearch = v; carsPage = 1; refreshCarsView(); }
function setCarsFilter(f) { carsFilter = f; carsPage = 1; refreshCarsView(); }
function setCarsSort(v) { carsSort = v; refreshCarsView(); }
function setCarsViewMode(m) { carsViewMode = m; refreshCarsView(); }
function setCarsPage(p) { carsPage = p; refreshCarsView(); }
function toggleAddCarForm() { showAddCarForm = !showAddCarForm; refreshCarsView(); }

function readAmount(inputId, label) {
  const value = document.getElementById(inputId).value.trim();
  const amount = Number(value);
  if (!value || !Number.isFinite(amount)) {
    alert(`${label} must be a number.`);
    return null;
  }
  return amount;
}

async function quickDeleteCar(id, ev) {
  if (ev) ev.stopPropagation();
  if (!confirm('Delete this car and all its records?')) return;
  await api(`/cars/${id}`, { method: 'DELETE' });
  cars = await api('/cars');
  refreshCarsView();
}

async function addCar() {
  const name = document.getElementById('nf-name').value.trim();
  if (!name) { alert('Give the car a name.'); return; }
  const purchasePrice = readAmount('nf-price', 'Purchase price');
  if (purchasePrice === null) return;
  await api('/cars', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      name, plate: document.getElementById('nf-plate').value.trim() || null,
      purchase_date: document.getElementById('nf-date').value || today(),
      purchase_price: purchasePrice
    })
  });
  cars = await api('/cars');
  showAddCarForm = false;
  carsPage = 1;
  refreshCarsView();
}

async function openCar(id) {
  activeCarId = id;
  view = 'cars';
  await refresh();
}

function renderCarDetail(c) {
  if (!c) return renderCars();
  return `
    <span class="backbtn" onclick="setView('cars')">&larr; Back to cars</span>
    <h1>${esc(c.name)} ${c.plate ? `<span class="small">(${esc(c.plate)})</span>` : ''}</h1>
    <p class="sub">Purchased ${c.purchase_date} for €${fmt(c.purchase_price)} ${statusBadge(c)}</p>
    <div class="grid">
      <div class="stat"><div class="label">Total cost so far</div><div class="num">€${fmt(c.cost)}</div></div>
      <div class="stat"><div class="label">Sale price</div><div class="num">${c.sale_price != null ? '€' + fmt(c.sale_price) : '—'}</div></div>
      <div class="stat"><div class="label">Profit</div><div class="num ${c.profit == null ? '' : (c.profit >= 0 ? 'pos' : 'neg')}">${c.profit == null ? 'Not sold yet' : (c.profit >= 0 ? '+' : '') + '€' + fmt(c.profit)}</div></div>
    </div>

    <div class="panel">
      <h2>Photos</h2>
      ${photoGrid(c.photos, 'removeCarPhoto')}
      <label class="uploadbtn">+ Add photo<input type="file" accept="image/*" style="display:none" onchange="uploadCarPhoto(${c.id}, event)"></label>
    </div>

    <div class="panel">
      <h2>Repairs & work done</h2>
      ${c.repairs.length === 0 ? '<div class="empty">No repairs logged.</div>' : `
      <table><thead><tr><th>Date</th><th>Description</th><th>Cost</th><th></th></tr></thead><tbody>
      ${c.repairs.map(r => `<tr><td class="mono small">${r.date}</td><td>${esc(r.description)}</td><td class="mono">€${fmt(r.cost)}</td>
      <td><button class="ghost" onclick="delRepair(${r.id})">Remove</button></td></tr>`).join('')}
      </tbody></table>`}
      <div class="row" style="margin-top:12px">
        <div class="field"><label>Date</label><input id="rf-date" type="date" value="${today()}"></div>
        <div class="field"><label>Description</label><input id="rf-desc" placeholder="e.g. Brake pads + discs"></div>
        <div class="field"><label>Cost (€)</label><input id="rf-cost" type="number" min="0" step="0.01" placeholder="0" required></div>
        <button class="btn" onclick="addRepair(${c.id})">Add repair</button>
      </div>
    </div>

    <div class="panel">
      <h2>Parts used from inventory</h2>
      ${c.parts_used.length === 0 ? '<div class="empty">No parts recorded.</div>' : `
      <table><thead><tr><th>Part</th><th>Qty</th><th>Cost</th><th></th></tr></thead><tbody>
      ${c.parts_used.map(p => `<tr><td>${esc(p.part_name)}</td><td class="mono">${p.qty}</td><td class="mono">€${fmt(p.cost)}</td>
      <td><button class="ghost" onclick="delPartUsed(${p.id})">Remove</button></td></tr>`).join('')}
      </tbody></table>`}
      <div class="row" style="margin-top:12px">
        <div class="field"><label>Part</label>
          <select id="pf-part">${(() => {
            const consumables = parts.filter(p => p.category !== 'tool');
            return consumables.length === 0
              ? '<option value="">No parts in inventory</option>'
              : consumables.map(p => `<option value="${p.id}">${esc(p.name)} (${p.stock} in stock)</option>`).join('');
          })()}</select>
        </div>
        <div class="field"><label>Qty</label><input id="pf-qty" type="number" min="1" value="1" style="width:70px"></div>
        <button class="btn" onclick="usePart(${c.id})">Use part</button>
      </div>
    </div>

    <div class="panel">
      <h2>Other expenses</h2>
      <p class="small" style="margin-top:-8px">Transport, registration, storage, advertising, etc.</p>
      ${c.expenses.length === 0 ? '<div class="empty">None recorded.</div>' : `
      <table><thead><tr><th>Description</th><th>Cost</th><th></th></tr></thead><tbody>
      ${c.expenses.map(e => `<tr><td>${esc(e.description)}</td><td class="mono">€${fmt(e.cost)}</td>
      <td><button class="ghost" onclick="delExpense(${e.id})">Remove</button></td></tr>`).join('')}
      </tbody></table>`}
      <div class="row" style="margin-top:12px">
        <div class="field"><label>Description</label><input id="ef-desc" placeholder="e.g. Transport"></div>
        <div class="field"><label>Cost (€)</label><input id="ef-cost" type="number" min="0" step="0.01" placeholder="0" required></div>
        <button class="btn" onclick="addExpense(${c.id})">Add expense</button>
      </div>
    </div>

    <div class="panel">
      <h2>Sale</h2>
      ${c.sale_price != null ? `
        <p>Sold on <strong>${c.sale_date}</strong> for <strong>€${fmt(c.sale_price)}</strong> to ${esc(c.sale_buyer || '—')}.</p>
        <button class="ghost" onclick="unsell(${c.id})">Undo sale</button>
      ` : `
        <div class="row">
          <div class="field"><label>Sale date</label><input id="sf-date" type="date" value="${today()}"></div>
          <div class="field"><label>Sale price (€)</label><input id="sf-price" type="number" min="0" step="0.01" placeholder="0" required></div>
          <div class="field"><label>Buyer (optional)</label><input id="sf-buyer" placeholder="Name"></div>
          <button class="btn" onclick="markSold(${c.id})">Mark as sold</button>
        </div>
      `}
    </div>
    <button class="ghost" onclick="delCar(${c.id})">Delete this car</button>
  `;
}

/** Reloads car data from the server and re-renders the currently open car. */
async function reopenCar() {
  const id = activeCarId;
  cars = await api('/cars');
  activeCarId = id;
  document.getElementById('main').innerHTML = renderCarDetail(cars.find(c => c.id === id));
}

async function addRepair(id) {
  const desc = document.getElementById('rf-desc').value.trim();
  if (!desc) { alert('Add a description.'); return; }
  const cost = readAmount('rf-cost', 'Repair cost');
  if (cost === null) return;
  await api(`/cars/${id}/repairs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      date: document.getElementById('rf-date').value || today(), description: desc, cost
    })
  });
  await reopenCar();
}

async function delRepair(rid) {
  await api(`/repairs/${rid}`, { method: 'DELETE' });
  await reopenCar();
}

async function addExpense(id) {
  const desc = document.getElementById('ef-desc').value.trim();
  if (!desc) { alert('Add a description.'); return; }
  const cost = readAmount('ef-cost', 'Expense cost');
  if (cost === null) return;
  await api(`/cars/${id}/expenses`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      description: desc, cost
    })
  });
  await reopenCar();
}

async function delExpense(eid) {
  await api(`/expenses/${eid}`, { method: 'DELETE' });
  await reopenCar();
}

async function usePart(id) {
  const partId = Number(document.getElementById('pf-part').value);
  const qty = Number(document.getElementById('pf-qty').value) || 1;
  if (!partId) { alert('Pick a part.'); return; }
  await api(`/cars/${id}/use-part`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ part_id: partId, qty })
  });
  await reopenCar();
}

async function delPartUsed(uid) {
  await api(`/part-usage/${uid}`, { method: 'DELETE' });
  await reopenCar();
}

async function markSold(id) {
  const price = readAmount('sf-price', 'Sale price');
  if (price === null) return;
  await api(`/cars/${id}/sale`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      sale_date: document.getElementById('sf-date').value || today(), sale_price: price, sale_buyer: document.getElementById('sf-buyer').value.trim() || null
    })
  });
  await reopenCar();
}

async function unsell(id) {
  await api(`/cars/${id}/sale`, { method: 'DELETE' });
  await reopenCar();
}

async function delCar(id) {
  if (!confirm('Delete this car and all its records?')) return;
  await api(`/cars/${id}`, { method: 'DELETE' });
  activeCarId = null;
  await setView('cars');
}

async function uploadCarPhoto(id, ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  await api(`/cars/${id}/photos`, { method: 'POST', body: fd });
  await reopenCar();
}

async function removeCarPhoto(pid) {
  await api(`/photos/${pid}`, { method: 'DELETE' });
  await reopenCar();
}