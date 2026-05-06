import * as THREE from 'three';
import { getState, subscribe } from './state.js';

let smartUVEnabled = false;
let gridSize = 64;

export function initSmartUV() {
  subscribe('objectAdd', onObjectAdd);
}

export function toggleSmartUV() {
  smartUVEnabled = !smartUVEnabled;
  const badge = document.getElementById('uvBadge');
  if (badge) {
    badge.classList.toggle('active', smartUVEnabled);
  }
}

function onObjectAdd(obj) {
  if (!smartUVEnabled) return;
  if (!obj || !obj.mesh) return;

  applySmartUV(obj.mesh);
}

export function applySmartUV(mesh) {
  if (!mesh || !mesh.geometry) return;

  const geometry = mesh.geometry;
  const positionAttr = geometry.attributes.position;
  const uvAttr = geometry.attributes.uv;

  if (!uvAttr) {
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(positionAttr.count * 2), 2));
  }

  const pos = new THREE.Vector3();
  const uv = new THREE.Vector2();

  for (let i = 0; i < positionAttr.count; i++) {
    pos.fromBufferAttribute(positionAttr, i);

    const tileX = Math.floor(pos.x / gridSize);
    const tileY = Math.floor(pos.z / gridSize);

    const fracX = (pos.x % gridSize) / gridSize;
    const fracY = (pos.z % gridSize) / gridSize;

    uv.set(
      tileX + fracX,
      tileY + fracY
    );

    uvAttr.setXY(i, uv.x, uv.y);
  }

  uvAttr.needsUpdate = true;
  geometry.attributes.uv.needsUpdate = true;
}

export function applySmartUVToSelected() {
  const state = getState();
  if (!state.selected || !state.selected.mesh) return;

  applySmartUV(state.selected.mesh);
}

export function isSmartUVEnabled() {
  return smartUVEnabled;
}

export function setGridSize(size) {
  gridSize = size;
}