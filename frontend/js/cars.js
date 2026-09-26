// -----------------------------------------------------------------------
// Cars: the list view, the detail view for one car, and every action that
// can be taken on a car (repairs, expenses, parts used, sale, photos).
// -----------------------------------------------------------------------

function renderCars() {
  const sorted = [...cars].sort((a, b) =>
    (a.sale_price != null ? 1 : 0) - (b.sale_price != null ? 1 : 0) ||
    b.purchase_date.localeCompare(a.purchase_date)
  );
  return `
    <h1>Cars</h1>
    <p class="sub">Every car bought, in repair, for sale, or sold.</p>
    <div class="panel">
      <h2>Add a car</h2>
      <div class="row">
        <div class="field"><label>Name / description</label><input id="nf-name" placeholder="e.g. VW Golf Mk6 2011"></div>
        <div class="field"><label>Plate (optional)</label><input id="nf-plate" placeholder="00-AA-00"></div>
        <div class="field"><label>Purchase date</label><input id="nf-date" type="date" value="${today()}"></div>
        <div class="field"><label>Purchase price (€)</label><input id="nf-price" type="number" min="0" placeholder="0"></div>
        <button class="btn" onclick="addCar()">Add car</button>
      </div>
    </div>
    ${sorted.length === 0 ? '<div class="empty">No cars yet.</div>' : `
    <table><thead><tr><th>Car</th><th>Purchased</th><th>Status</th><th>Cost so far</th><th>Sale price</th><th>Profit</th></tr></thead><tbody>
    ${sorted.map(c => `<tr>
        <td><span class="linklike" onclick="openCar(${c.id})">${esc(c.name)}</span></td>
        <td class="mono small">${c.purchase_date}</td><td>${statusBadge(c)}</td>
        <td class="mono">€${fmt(c.cost)}</td><td class="mono">${c.sale_price != null ? '€' + fmt(c.sale_price) : '—'}</td>
        <td class="mono ${c.profit == null ? '' : (c.profit >= 0 ? 'pos' : 'neg')}">${c.profit == null ? '—' : (c.profit >= 0 ? '+' : '') + '€' + fmt(c.profit)}</td>
      </tr>`).join('')}
    </tbody></table>`}
  `;
}

async function addCar() {
  const name = document.getElementById('nf-name').value.trim();
  if (!name) { alert('Give the car a name.'); return; }
  await api('/cars', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      name, plate: document.getElementById('nf-plate').value.trim() || null,
      purchase_date: document.getElementById('nf-date').value || today(),
      purchase_price: Number(document.getElementById('nf-price').value) || 0
    })
  });
  await refresh();
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
        <div class="field"><label>Cost (€)</label><input id="rf-cost" type="number" min="0" placeholder="0"></div>
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
        <div class="field"><label>Cost (€)</label><input id="ef-cost" type="number" min="0" placeholder="0"></div>
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
          <div class="field"><label>Sale price (€)</label><input id="sf-price" type="number" min="0" placeholder="0"></div>
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
  await api(`/cars/${id}/repairs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      date: document.getElementById('rf-date').value || today(), description: desc, cost: Number(document.getElementById('rf-cost').value) || 0
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
  await api(`/cars/${id}/expenses`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      description: desc, cost: Number(document.getElementById('ef-cost').value) || 0
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
  const price = Number(document.getElementById('sf-price').value) || 0;
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
