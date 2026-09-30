// -----------------------------------------------------------------------
// Shared state and helpers used by every page (dashboard, cars, parts,
// finances). Loaded first so everything below can rely on it.
// -----------------------------------------------------------------------

const API = '/api';

// Current view state
let view = 'dashboard';
let activeCarId = null;

// Cached data from the backend, refreshed each time a page is shown
let cars = [];
let parts = [];
let dashboardData = null;
let financeData = null;

/** Call the backend API. Throws (and alerts) on any non-OK response. */
async function api(path, opts) {
  const res = await fetch(API + path, opts);
  if (!res.ok) {
    const t = await res.text();
    alert('Error: ' + t);
    throw new Error(t);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Formatting helpers
const fmt = n => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const today = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

function esc(s) {
  return String(s || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function statusBadge(c) {
  return c.sale_price != null
    ? '<span class="status st-sold">Sold</span>'
    : '<span class="status st-repair">In stock</span>';
}

/** Renders a row of photo thumbnails with a remove (×) button on each. */
function photoGrid(photos, onRemove) {
  if (!photos.length) return '';
  return `<div class="photos">${photos.map(p =>
    `<div class="photo"><img src="${p.url}"><button class="rm" onclick="${onRemove}(${p.id})">×</button></div>`
  ).join('')}</div>`;
}
