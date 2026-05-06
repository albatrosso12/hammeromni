import { getState, subscribe, getLanguage } from './state.js';
import { getTransformControls } from './Renderer.js';

// i18n strings for props panel
const PROPS_STRINGS = {
  ru: { position:'Позиция', rotation:'Поворот °', scale:'Масштаб', texture:'Текстура', type:'Тип', select:'Выберите объект', id:'ID' },
  en: { position:'Position', rotation:'Rotation °', scale:'Scale',   texture:'Texture',  type:'Type', select:'Select an object', id:'ID' },
};

function p(key) {
  const lang = getLanguage();
  return PROPS_STRINGS[lang]?.[key] ?? PROPS_STRINGS.ru[key] ?? key;
}

let currentPanel = null;

export function initPropsPanel() {
  currentPanel = document.getElementById('propsPanel');
  subscribe('select', onSelect);
  subscribe('objectAdd', onObjectAdd);
  subscribe('selectionChange', onSelectionChange);
}

function onSelect(obj) {
  slidePanel(!!obj);
  renderPropsPanel(obj);
}

function onObjectAdd(obj) {
  if (getState().selected?.id === obj.id) renderPropsPanel(obj);
}

function onSelectionChange(obj) {
  slidePanel(!!obj);
  renderPropsPanel(obj);
}

function slidePanel(show) {
  if (!currentPanel) return;
  if (show) {
    currentPanel.classList.add('panel-visible');
  } else {
    currentPanel.classList.remove('panel-visible');
  }
}

// ── Number drag input ─────────────────────────────────────────────────────
function makeDragInput(value, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'drag-input-wrap';

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'drag-input';
  input.value = value;
  input.step = '1';

  let dragging = false;
  let startX = 0;
  let startVal = 0;

  input.addEventListener('pointerdown', (e) => {
    if (e.target === input && document.activeElement !== input) {
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startVal = parseFloat(input.value) || 0;
      input.setPointerCapture(e.pointerId);
      wrap.classList.add('dragging');
    }
  });

  input.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const delta = (e.clientX - startX) * (e.shiftKey ? 10 : e.altKey ? 0.1 : 1);
    const newVal = Math.round((startVal + delta) * 100) / 100;
    input.value = newVal;
    onChange(newVal);
  });

  input.addEventListener('pointerup', () => {
    dragging = false;
    wrap.classList.remove('dragging');
  });

  input.addEventListener('change', () => {
    onChange(parseFloat(input.value) || 0);
  });

  wrap.appendChild(input);
  return { wrap, input };
}

export function renderPropsPanel(obj) {
  if (!currentPanel) return;

  if (!obj) {
    currentPanel.innerHTML = `
      <div class="panel-empty-state">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        <span>${p('select')}</span>
      </div>
    `;
    return;
  }

  const mesh = obj.mesh;
  const pos   = mesh ? mesh.position : (obj.position || { x:0, y:0, z:0 });
  const rot   = mesh ? mesh.rotation : (obj.rotation || { x:0, y:0, z:0 });
  const scale = mesh ? mesh.scale    : (obj.scale    || { x:1, y:1, z:1 });

  currentPanel.innerHTML = `
    <div class="props-header">
      <div class="props-obj-name">${obj.name || 'Object'}</div>
      <div class="props-obj-type">${obj.type || 'brush'}</div>
    </div>
    <div class="props-body" id="propsBody"></div>
  `;

  const body = currentPanel.querySelector('#propsBody');

  // ── Position ──
  body.appendChild(makePropGroup(p('position'), [
    { label: 'X', val: pos.x, prop: 'position.x' },
    { label: 'Y', val: pos.y, prop: 'position.y' },
    { label: 'Z', val: pos.z, prop: 'position.z' },
  ], (prop, val) => applyProp(obj, prop, val)));

  // ── Rotation ──
  body.appendChild(makePropGroup(p('rotation'), [
    { label: 'X', val: rot.x * 180 / Math.PI, prop: 'rotation.x' },
    { label: 'Y', val: rot.y * 180 / Math.PI, prop: 'rotation.y' },
    { label: 'Z', val: rot.z * 180 / Math.PI, prop: 'rotation.z' },
  ], (prop, val) => applyProp(obj, prop, val)));

  // ── Scale ──
  body.appendChild(makePropGroup(p('scale'), [
    { label: 'X', val: scale.x, prop: 'scale.x' },
    { label: 'Y', val: scale.y, prop: 'scale.y' },
    { label: 'Z', val: scale.z, prop: 'scale.z' },
  ], (prop, val) => applyProp(obj, prop, val)));

  // ── Divider ──
  const div = document.createElement('div');
  div.className = 'props-divider';
  body.appendChild(div);

  // ── Texture ──
  const texGroup = document.createElement('div');
  texGroup.className = 'props-group';
  texGroup.innerHTML = `
    <div class="props-group-label">Текстура</div>
    <input class="props-text-input" type="text" value="${obj.texture || ''}" placeholder="dev/dev_measuregray01a"/>
  `;
  texGroup.querySelector('input').addEventListener('change', (e) => {
    obj.texture = e.target.value;
    if (mesh?.material) mesh.material.name = e.target.value;
  });
  body.appendChild(texGroup);

  // ── ID ──
  const idGroup = document.createElement('div');
  idGroup.className = 'props-group';
  idGroup.innerHTML = `<div class="props-group-label">ID</div><div class="props-id">${obj.id?.slice(0,12) || '—'}</div>`;
  body.appendChild(idGroup);

  // Live update from transform controls
  const tc = getTransformControls?.();
  if (tc) {
    const onTCChange = () => updatePanel();
    tc.addEventListener('change', onTCChange);
  }
}

function makePropGroup(label, axes, onChange) {
  const group = document.createElement('div');
  group.className = 'props-group';

  const lbl = document.createElement('div');
  lbl.className = 'props-group-label';
  lbl.textContent = label;
  group.appendChild(lbl);

  const row = document.createElement('div');
  row.className = 'props-axes-row';

  axes.forEach(({ label: axLabel, val, prop }) => {
    const axWrap = document.createElement('div');
    axWrap.className = 'props-axis';

    const axLbl = document.createElement('span');
    axLbl.className = 'props-axis-label';
    axLbl.textContent = axLabel;

    const { wrap } = makeDragInput(
      parseFloat(val.toFixed(2)),
      (v) => onChange(prop, v)
    );

    axWrap.appendChild(axLbl);
    axWrap.appendChild(wrap);
    row.appendChild(axWrap);
  });

  group.appendChild(row);
  return group;
}

function applyProp(obj, prop, value) {
  if (!obj?.mesh) return;
  const mesh = obj.mesh;
  if (prop.startsWith('position.')) {
    mesh.position[prop.split('.')[1]] = value;
  } else if (prop.startsWith('rotation.')) {
    mesh.rotation[prop.split('.')[1]] = value * Math.PI / 180;
  } else if (prop.startsWith('scale.')) {
    mesh.scale[prop.split('.')[1]] = value;
  }
}

let rafPending = false;

export function updatePanel() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const state = getState();
    renderPropsPanel(state.selected);
  });
}
