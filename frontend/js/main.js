// -----------------------------------------------------------------------
// Top-level navigation and the refresh loop: decides which page function
// to call and re-fetches whatever data that page needs. This is the last
// script loaded, and kicks off the initial render at the bottom.
// -----------------------------------------------------------------------

const NAV = [
  ['dashboard', 'Dashboard'],
  ['cars', 'Cars'],
  // ['services', 'Service Jobs'], // API route not implemented yet.
  // ['parts', 'Parts Inventory'], // API route not implemented yet.
  // ['finances', 'Finances'], // API route not implemented yet.
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
    cars = await api('/cars');
    dashboardData = {
      in_stock: cars.filter(c => c.sale_price == null).length,
      total_profit: cars.reduce((sum, c) => sum + (c.profit || 0), 0),
      tied_up: cars.filter(c => c.sale_price == null).reduce((sum, c) => sum + (c.cost || 0), 0),
      service_jobs: 0,
      service_revenue: 0,
      avg_days: null,
      recent: cars.slice(-5).reverse(),
    };
    m.innerHTML = renderDashboard();
  } else if (view === 'cars') {
    cars = await api('/cars');
    m.innerHTML = activeCarId ? renderCarDetail(cars.find(c => c.id === activeCarId)) : renderCars();
  // Unsupported views remain commented out until their API routes exist.
  // } else if (view === 'parts') {
  //   parts = await api('/parts');
  //   m.innerHTML = renderParts();
  // } else if (view === 'services') {
  //   parts = await api('/parts');
  //   services = await api('/services');
  //   m.innerHTML = renderServices();
  // } else if (view === 'finances') {
  //   financeData = await api('/finances');
  //   m.innerHTML = renderFinances();
  }
}

refresh();
