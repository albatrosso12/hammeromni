import { getState, subscribe } from './state.js';

let pickerVisible = false;
const categories = ['All', 'Brushes', 'Prefabs', 'Entities', 'Lights'];
const assets = [];

// ── DOM helpers (previously in template.js) ──────────────────────────────────

function create(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'className') {
      el.className = v;
    } else if (k === 'style' && typeof v === 'object') {
      Object.assign(el.style, v);
    } else if (k === 'dataset') {
      Object.assign(el.dataset, v);
    } else if (k === 'html') {
      el.innerHTML = v;
    } else if (k === 'text') {
      el.textContent = v;
    } else if (typeof v === 'string') {
      el.setAttribute(k, v);
    }
  }
  const childArr = Array.isArray(children) ? children : [children];
  for (const c of childArr) {
    if (c === null || c === undefined) continue;
    if (typeof c === 'string') el.appendChild(document.createTextNode(c));
    else if (c instanceof Node) el.appendChild(c);
  }
  return el;
}

function assetCard(icon, title, subtitle, tag = null) {
  const children = [
    create('div', { className: 'asset-card-icon' }, [create('span', { className: 'ms' }, [icon])]),
    create('div', { className: 'asset-card-title' }, [title]),
    create('div', { className: 'asset-card-sub' }, [subtitle]),
  ];
  if (tag) children.push(create('span', { className: 'asset-card-tag' }, [tag]));
  return create('div', { className: 'asset-card' }, children);
}

export function initAssetPicker() {
  loadAssets();
  setupPicker();
}

function loadAssets() {
  assets.length = 0;

  assets.push(
    { id: 1, name: 'Cube Brush', category: 'Brushes', icon: 'check_box' },
    { id: 2, name: 'Sphere', category: 'Brushes', icon: 'circle' },
    { id: 3, name: 'Cylinder', category: 'Brushes', icon: 'filter_vintage' },
    { id: 4, name: 'Plane', category: 'Brushes', icon: 'crop_square' },
    { id: 5, name: 'Arch', category: 'Prefabs', icon: 'door_front' },
    { id: 6, name: 'Stairs', category: 'Prefabs', icon: 'stairs' },
    { id: 7, name: 'Window', category: 'Prefabs', icon: 'window' },
    { id: 8, name: 'Point Light', category: 'Lights', icon: 'light_mode' },
    { id: 9, name: 'Spotlight', category: 'Lights', icon: 'flashlight_on' },
    { id: 10, name: 'Info Player Start', category: 'Entities', icon: 'person' },
    { id: 11, name: 'Func Button', category: 'Entities', icon: 'radio_button' },
    { id: 12, name: 'Prop Physics', category: 'Entities', icon: 'category' }
  );
}

function setupPicker() {
  const backdrop = document.createElement('div');
  backdrop.className = 'asset-picker-backdrop';
  backdrop.id = 'assetPickerBackdrop';

  const picker = document.createElement('div');
  picker.className = 'asset-picker';
  picker.id = 'assetPicker';

  const header = document.createElement('div');
  header.className = 'asset-picker-hdr';

  const search = document.createElement('div');
  search.className = 'asset-picker-search';
  search.innerHTML = '<span class="ms">search</span><input type="text" placeholder="Поиск...">';

  const closeBtn = create('button', {
    className: 'btn btn-mini btn-outlined',
    onClick: hideAssetPicker
  }, ['<span class="ms">close</span>']);

  header.appendChild(search);
  header.appendChild(closeBtn);

  const cats = document.createElement('div');
  cats.className = 'asset-picker-cats';
  categories.forEach(cat => {
    const btn = document.createElement('span');
    btn.className = `asset-cat ${cat === 'All' ? 'active' : ''}`;
    btn.textContent = cat;
    btn.onclick = () => filterByCategory(cat, btn);
    cats.appendChild(btn);
  });

  const grid = document.createElement('div');
  grid.className = 'asset-grid';
  grid.id = 'assetGrid';

  picker.appendChild(header);
  picker.appendChild(cats);
  picker.appendChild(grid);

  backdrop.appendChild(picker);
  document.body.appendChild(backdrop);

  backdrop.onclick = (e) => {
    if (e.target === backdrop) hideAssetPicker();
  };

  search.querySelector('input').oninput = (e) => {
    filterAssets(e.target.value);
  };

  renderAssets();
}

function renderAssets(filtered = assets) {
  const grid = document.getElementById('assetGrid');
  if (!grid) return;

  grid.innerHTML = '';

  filtered.forEach(asset => {
    const card = assetCard(asset.icon, asset.name, asset.category, asset.category);
    card.onclick = () => selectAsset(asset);
    grid.appendChild(card);
  });
}

function filterByCategory(category, btn) {
  document.querySelectorAll('.asset-cat').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');

  if (category === 'All') {
    renderAssets();
  } else {
    const filtered = assets.filter(a => a.category === category);
    renderAssets(filtered);
  }
}

function filterAssets(query) {
  const filtered = assets.filter(a =>
    a.name.toLowerCase().includes(query.toLowerCase()) ||
    a.category.toLowerCase().includes(query.toLowerCase())
  );
  renderAssets(filtered);
}

function selectAsset(asset) {
  console.log('Selected asset:', asset.name);
  hideAssetPicker();
}

export function showAssetPicker() {
  pickerVisible = true;
  const backdrop = document.getElementById('assetPickerBackdrop');
  const picker = document.getElementById('assetPicker');
  if (backdrop) backdrop.classList.add('show');
  if (picker) picker.classList.add('show');
  renderAssets();
}

export function hideAssetPicker() {
  pickerVisible = false;
  const backdrop = document.getElementById('assetPickerBackdrop');
  const picker = document.getElementById('assetPicker');
  if (backdrop) backdrop.classList.remove('show');
  if (picker) picker.classList.remove('show');
}

export function isPickerVisible() {
  return pickerVisible;
}

export function getAssets() {
  return assets;
}