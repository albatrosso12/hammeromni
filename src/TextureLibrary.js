import { getState, subscribe } from './state.js';

// ── Встроенные dev-текстуры ────────────────────────────────────────────────
const BUILTIN_TEXTURES = [
  'dev/dev_measuregray01a', 'dev/dev_measureblue01a', 'dev/dev_measuregreen01a',
  'dev/dev_measurered01a',  'dev/dev_measureyellow01a','dev/dev_measurewall01a',
  'dev/dev_ceiling_01a',    'dev/dev_floor_01a',       'dev/dev_floor02',
  'dev/dev_brick01a',       'dev/dev_brick02',          'dev/dev_concrete01a',
  'dev/dev_concrete02',     'dev/dev_concrete03',       'dev/dev_plaster01a',
  'dev/dev_plaster02',      'dev/dev_metalfloor001a',   'dev/dev_metalfloor002a',
  'dev/dev_metal01a',       'dev/dev_metal02',          'dev/dev_woodfloor01a',
  'dev/dev_woodfloor02',    'dev/dev_wood01',           'tools/toolsky',
  'nature/dirtfloor01a',    'nature/dirt02',            'nature/grassfloor01a',
  'nature/gravel01a',       'nature/sandfloor01a',      'nature/snowfloor01a',
];

// ── Облачные текстуры (ambientcg.com — публичный домен) ───────────────────
const CLOUD_SOURCES = [
  {
    name: 'AmbientCG',
    baseUrl: 'https://ambientcg.com/api/v2/full_json?include=downloadData&sort=Popular&type=Material&limit=20',
    enabled: true,
  },
];

const textures = [];
let gmodPath = null;

export function initTextureLibrary() {
  loadBuiltinTextures();
  renderTextureGrid();
  subscribe('viewChange', onViewChange);
  // Auto-detect GMod path
  autoDetectGmodPath();
  const state = getState();
  if (state.settings?.gmodPath) {
    setGmodPath(state.settings.gmodPath);
  }
}

// ── Auto-detect GMod ──────────────────────────────────────────────────────
async function autoDetectGmodPath() {
  if (!window.electronAPI?.getPath) return;
  try {
    // Common Steam paths
    const home = await window.electronAPI.getPath('home');
    const candidates = [
      `${home}/Steam/steamapps/common/GarrysMod`,
      `${home}/.steam/steam/steamapps/common/GarrysMod`,
      'C:/Program Files (x86)/Steam/steamapps/common/GarrysMod',
      'C:/Program Files/Steam/steamapps/common/GarrysMod',
      'D:/Steam/steamapps/common/GarrysMod',
      'E:/Steam/steamapps/common/GarrysMod',
    ];
    for (const p of candidates) {
      const result = await window.electronAPI.readFile(p + '/garrysmod/gameinfo.txt');
      if (result?.success) {
        const state = getState();
        state.settings.gmodPath = p;
        setGmodPath(p);
        const display = document.getElementById('gmodPathDisplay');
        if (display) display.textContent = p;
        window.showCSGMessage?.('GMod найден: ' + p.split(/[\\/]/).pop());
        return;
      }
    }
  } catch {}
}

function loadBuiltinTextures() {
  textures.length = 0;
  BUILTIN_TEXTURES.forEach(name => {
    textures.push({ name, src: null, source: 'builtin' });
  });
  const state = getState();
  state.textures = textures;
}

function onViewChange(view) {
  if (view === 'textures') renderTextureGridMain();
}

// ── GMod path integration ─────────────────────────────────────────────────
export function setGmodPath(path) {
  gmodPath = path;
  if (path) {
    loadGmodTextures(path);
  }
}

function loadGmodTextures(path) {
  // In Electron context, use IPC to read directory
  if (window.electronAPI?.readFile) {
    // Try to read materials directory listing
    const materialsPath = path.replace(/\\/g, '/') + '/garrysmod/materials';
    window.electronAPI.readFile(materialsPath).then(result => {
      if (result?.success) {
        // Parse directory listing — simplified: just show path is connected
        window.showCSGMessage?.(`GMod текстуры: ${path}`);
      }
    }).catch(() => {});
  }
}

// ── Cloud textures ────────────────────────────────────────────────────────
export async function loadCloudTextures() {
  const mainGrid = document.getElementById('textureGridMain');
  if (!mainGrid) return;

  // Show loading state
  const loadingEl = document.createElement('div');
  loadingEl.style.cssText = 'grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted);font-size:12px;';
  loadingEl.textContent = 'Загрузка облачных текстур...';
  mainGrid.appendChild(loadingEl);

  try {
    // AmbientCG free textures API
    const res = await fetch('https://ambientcg.com/api/v2/full_json?include=downloadData&sort=Popular&type=Material&limit=24&offset=0');
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();

    loadingEl.remove();

    if (data.foundAssets) {
      data.foundAssets.forEach(asset => {
        const preview = asset.previewImage?.replace('https://', 'https://');
        if (preview) {
          const existing = textures.find(t => t.name === `cloud/${asset.assetId}`);
          if (!existing) {
            textures.push({
              name: `cloud/${asset.assetId}`,
              src: preview,
              source: 'cloud',
              displayName: asset.assetId,
            });
          }
        }
      });
      renderTextureGridMain();
      window.showCSGMessage?.(`Загружено ${data.foundAssets.length} облачных текстур`);
    }
  } catch (err) {
    loadingEl.textContent = 'Не удалось загрузить облачные текстуры';
    setTimeout(() => loadingEl.remove(), 3000);
  }
}

// ── Render ────────────────────────────────────────────────────────────────
export function renderTextureGrid() {
  const sideGrid = document.getElementById('textureGridSide');
  if (!sideGrid) return;
  sideGrid.innerHTML = '';
  textures.slice(0, 18).forEach(tex => sideGrid.appendChild(createTextureItem(tex)));
}

export function renderTextureGridMain() {
  const mainGrid = document.getElementById('textureGridMain');
  if (!mainGrid) return;
  mainGrid.innerHTML = '';
  textures.forEach(tex => mainGrid.appendChild(createTextureItem(tex, true)));
}

function createTextureItem(tex, large = false) {
  const item = document.createElement('div');
  item.className = 'texture-item';
  if (tex.source === 'cloud') item.classList.add('texture-cloud');

  if (tex.src) {
    const img = document.createElement('img');
    img.src = tex.src;
    img.loading = 'lazy';
    img.alt = tex.displayName || tex.name;
    item.appendChild(img);
  } else {
    // Placeholder with texture name initials
    const ph = document.createElement('div');
    ph.className = 'texture-placeholder';
    const parts = tex.name.split('/');
    ph.textContent = parts[parts.length - 1].slice(0, 3).toUpperCase();
    item.appendChild(ph);
  }

  const span = document.createElement('span');
  span.textContent = tex.displayName || tex.name.split('/').pop();
  item.appendChild(span);

  item.onclick = () => selectTexture(tex.name);
  return item;
}

export function selectTexture(name) {
  const state = getState();
  if (state.selected) {
    state.selected.texture = name;
    if (state.selected.mesh?.material) {
      // Apply texture name as material name for VMF export
      state.selected.mesh.material.name = name;
    }
    window.showCSGMessage?.(`Текстура: ${name.split('/').pop()}`);
  }
}

export function filterTextures(query) {
  const q = query.toLowerCase();
  const filtered = textures.filter(t =>
    t.name.toLowerCase().includes(q) || (t.displayName || '').toLowerCase().includes(q)
  );
  const grid = document.getElementById('textureGridSide');
  if (!grid) return;
  grid.innerHTML = '';
  filtered.slice(0, 18).forEach(tex => grid.appendChild(createTextureItem(tex)));
}

export function filterTexturesMain(query) {
  const q = query.toLowerCase();
  const filtered = textures.filter(t =>
    t.name.toLowerCase().includes(q) || (t.displayName || '').toLowerCase().includes(q)
  );
  const grid = document.getElementById('textureGridMain');
  if (!grid) return;
  grid.innerHTML = '';
  filtered.forEach(tex => grid.appendChild(createTextureItem(tex, true)));
}

export function getTextures() { return textures; }
export function addTexture(name, src = null, source = 'custom') {
  textures.push({ name, src, source });
}
