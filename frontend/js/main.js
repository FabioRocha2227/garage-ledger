// -----------------------------------------------------------------------
// Top-level navigation and the refresh loop: decides which page function
// to call and re-fetches whatever data that page needs. This is the last
// script loaded, and kicks off the initial render at the bottom.
// -----------------------------------------------------------------------

const NAV = [
  ['dashboard', 'Dashboard'],
  ['cars', 'Cars'],
  ['services', 'Service Jobs'],
  ['parts', 'Parts Inventory'],
  ['finances', 'Finances'], 
];

function renderNav() {
  document.getElementById('nav').innerHTML = NAV.map(([k, l]) =>
    `<button class="${view === k ? 'active' : ''}" onclick="setView('${k}')">${l}</button>`
  ).join('');
}

async function setView(v) {
  view = v;
  activeCarId = null;
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

refresh();
