// -----------------------------------------------------------------------
// Top-level navigation and the refresh loop: decides which page function
// to call and re-fetches whatever data that page needs. This is the last
// script loaded, and kicks off the initial render at the bottom.
// -----------------------------------------------------------------------

const NAV = [
  ['dashboard', 'Dashboard', '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="7" rx="1"/><rect x="14" y="4" width="6" height="4" rx="1"/><rect x="4" y="15" width="6" height="5" rx="1"/><rect x="14" y="11" width="6" height="9" rx="1"/></svg>'],
  ['cars', 'Cars', '<svg viewBox="0 0 24 24"><path d="m5 17-1 2m15-2 1 2M5 17h14l1-6-2-4H6l-2 4 1 6Zm1-6h12M7 17h.01M17 17h.01"/></svg>'],
  ['services', 'Service Jobs', '<svg viewBox="0 0 24 24"><path d="m14 6 4-4 4 4-4 4m0-4-8 8m-2-2-5 5 4 4 5-5M4 20h4"/></svg>'],
  ['parts', 'Parts Inventory', '<svg viewBox="0 0 24 24"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12 4 7.5M12 12v9"/></svg>'],
  ['finances', 'Finances', '<svg viewBox="0 0 24 24"><path d="M4 20V4m0 16h16M8 16v-5m4 5V8m4 8V5"/></svg>'],
];

const SIDEBAR_STORAGE_KEY = 'garage-ledger-sidebar-collapsed';

function toggleSidebar() {
  const app = document.querySelector('.app');
  if (window.matchMedia('(max-width: 720px)').matches) {
    const open = app.classList.toggle('mobile-sidebar-open');
    updateSidebarToggle(open);
    return;
  }
  const collapsed = app.classList.toggle('sidebar-collapsed');
  localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? 'true' : 'false');
  updateSidebarToggle(!collapsed);
}

function closeMobileSidebar() {
  document.querySelector('.app').classList.remove('mobile-sidebar-open');
  updateSidebarToggle(false);
}

function updateSidebarToggle(expanded) {
  const toggle = document.querySelector('.sidebar-toggle');
  const mobile = window.matchMedia('(max-width: 720px)').matches;
  const label = mobile ? (expanded ? 'Close navigation' : 'Open navigation') : (expanded ? 'Collapse sidebar' : 'Expand sidebar');
  toggle.title = label;
  toggle.setAttribute('aria-label', label);
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.textContent = expanded ? '‹' : '›';
}

function restoreSidebarState() {
  const collapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  if (collapsed && !window.matchMedia('(max-width: 720px)').matches) {
    document.querySelector('.app').classList.add('sidebar-collapsed');
  }
  updateSidebarToggle(!collapsed);
}

function renderNav() {
  document.getElementById('nav').innerHTML = NAV.map(([k, l, icon]) =>
    `<button class="${view === k ? 'active' : ''}" onclick="setView('${k}')" aria-label="${l}" data-tooltip="${l}" aria-current="${view === k ? 'page' : 'false'}"><span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-label">${l}</span></button>`
  ).join('');
}

async function setView(v) {
  view = v;
  activeCarId = null;
  if (window.matchMedia('(max-width: 720px)').matches) closeMobileSidebar();
  await refresh();
}

async function refresh() {
  renderNav();
  const m = document.getElementById('main');
  if (view === 'dashboard') {
    dashboardData = await api('/dashboard');
    m.innerHTML = renderDashboard();
  } else if (view === 'cars') {
    cars = await api('/cars');
    m.innerHTML = activeCarId ? renderCarDetail(cars.find(c => c.id === activeCarId)) : renderCars();
  } else if (view === 'parts') {
    parts = await api('/parts');
    m.innerHTML = renderParts();
  } else if (view === 'services') {
    parts = await api('/parts');
    services = await api('/services');
    m.innerHTML = renderServices();
  } else if (view === 'finances') {
    financeData = await api('/finances');
    m.innerHTML = renderFinances();
  }
}

restoreSidebarState();
window.matchMedia('(max-width: 720px)').addEventListener('change', restoreSidebarState);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeMobileSidebar();
});
refresh();
