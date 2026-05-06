import { getState, addObject } from './state.js';
import { getScene } from './Renderer.js';
import { uuid } from './helpers.js';

let prefabs = [];

export function initPrefabLibrary() {
  loadPrefabs();
  renderPrefabGrid();
}

function loadPrefabs() {
  try {
    const saved = localStorage.getItem('hammer-omni-prefabs');
    if (saved) {
      prefabs = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load prefabs:', e);
  }
}

function savePrefabs() {
  try {
    localStorage.setItem('hammer-omni-prefabs', JSON.stringify(prefabs));
  } catch (e) {
    console.warn('Failed to save prefabs:', e);
  }
}

export function saveAsPrefab() {
  const state = getState();
  if (!state.selected || !state.selected.mesh) return;

  const mesh = state.selected.mesh;
  const prefab = {
    id: uuid(),
    name: state.selected.name || 'Prefab',
    position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
    rotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
    scale: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z },
    geometry: mesh.geometry.toJSON(),
    material: mesh.material.toJSON(),
  };

  prefabs.push(prefab);
  savePrefabs();
  renderPrefabGrid();
}

export function loadPrefab(id) {
  const prefab = prefabs.find(p => p.id === id);
  if (!prefab) return;

  const THREE = window.THREE || window.three;
  if (!THREE) {
    console.warn('Three.js not loaded');
    return;
  }

  const geometry = new THREE.BufferGeometry().copy(prefab.geometry);
  const material = new THREE.MeshStandardMaterial().copy(prefab.material);
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(prefab.position.x, prefab.position.y, prefab.position.z);
  mesh.rotation.set(prefab.rotation.x, prefab.rotation.y, prefab.rotation.z);
  mesh.scale.set(prefab.scale.x, prefab.scale.y, prefab.scale.z);

  const scene = getScene();
  scene.add(mesh);

  addObject({
    type: 'prefab',
    name: prefab.name,
    mesh,
    prefabId: id,
  });
}

export function deletePrefab(id) {
  prefabs = prefabs.filter(p => p.id !== id);
  savePrefabs();
  renderPrefabGrid();
}

export function renderPrefabGrid() {
  const grid = document.getElementById('prefabGrid');
  if (!grid) return;

  grid.innerHTML = '';

  prefabs.forEach(prefab => {
    const card = document.createElement('div');
    card.className = 'prefab-card';
    card.innerHTML = `
      <span class="ms">widgets</span>
      <div class="prefab-card-name">${prefab.name}</div>
    `;
    card.onclick = () => loadPrefab(prefab.id);
    grid.appendChild(card);
  });
}

export function getPrefabs() {
  return prefabs;
}