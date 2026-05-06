import * as THREE from 'three';
import { getState, subscribe, emit } from './state.js';
import { getScene, getCamera, raycast } from './Renderer.js';

let softSelectEnabled = false;
let radius = 3.0;
let selectedVertices = [];
let originalPositions = [];
let isDragging = false;
let dragStartPoint = null;

export function initSoftSelect() {
  const canvas = document.getElementById('canvas-3d');
  if (!canvas) return;

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
}

export function toggleSoftSelect() {
  softSelectEnabled = !softSelectEnabled;
  const hud = document.getElementById('softHud');
  if (hud) {
    hud.classList.toggle('active', softSelectEnabled);
  }
  emit('toolChange', softSelectEnabled ? 'soft' : 'select');
}

export function setSoftRadius(r) {
  radius = Math.max(0.5, Math.min(20, r));
  const state = getState();
  state.settings.softRadius = radius;

  const valEl = document.getElementById('softRadiusVal');
  if (valEl) valEl.textContent = radius.toFixed(1);
}

export function isSoftSelectEnabled() {
  return softSelectEnabled;
}

function onWheel(e) {
  if (!softSelectEnabled) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.5 : 0.5;
  setSoftRadius(radius + delta);
}

function onMouseDown(e) {
  if (!softSelectEnabled) return;
  if (e.button !== 0) return;

  const state = getState();
  if (!state.selected || !state.selected.mesh) return;

  const intersects = raycast(e.clientX, e.clientY, [state.selected.mesh]);

  if (intersects.length > 0) {
    const hit = intersects[0];
    selectVerticesNear(state.selected.mesh, hit.point);
    isDragging = true;
    dragStartPoint = hit.point.clone();
  }
}

function onMouseMove(e) {
  if (!softSelectEnabled || !isDragging) return;

  const state = getState();
  if (!state.selected || !state.selected.mesh) return;

  const scene = getScene();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersects = raycast(e.clientX, e.clientY, scene.children.filter(c => c.isPlane || c.isGridHelper));
  
  if (intersects.length === 0) return;

  const hit = intersects[0];
  const delta = hit.point.clone().sub(dragStartPoint);

  applySoftDisplacement(state.selected.mesh, delta);
  dragStartPoint = hit.point.clone();
}

function onMouseUp() {
  if (isDragging) {
    isDragging = false;
    saveOriginalPositions();
  }
}

function selectVerticesNear(mesh, point) {
  const positions = mesh.geometry.attributes.position;
  const vertex = new THREE.Vector3();
  selectedVertices = [];

  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    vertex.applyMatrix4(mesh.matrixWorld);

    const dist = vertex.distanceTo(point);
    if (dist <= radius) {
      selectedVertices.push({
        index: i,
        weight: 1 - (dist / radius),
      });
    }
  }

  saveOriginalPositions();
}

function saveOriginalPositions() {
  const state = getState();
  if (!state.selected || !state.selected.mesh) return;

  const positions = state.selected.mesh.geometry.attributes.position;
  originalPositions = [];

  for (const v of selectedVertices) {
    originalPositions.push({
      x: positions.getX(v.index),
      y: positions.getY(v.index),
      z: positions.getZ(v.index),
    });
  }
}

function applySoftDisplacement(mesh, delta) {
  const positions = mesh.geometry.attributes.position;

  for (let i = 0; i < selectedVertices.length; i++) {
    const v = selectedVertices[i];
    const orig = originalPositions[i];

    const dx = delta.x * v.weight;
    const dy = delta.y * v.weight;
    const dz = delta.z * v.weight;

    positions.setXYZ(
      v.index,
      orig.x + dx,
      orig.y + dy,
      orig.z + dz
    );
  }

  positions.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

export function getSoftRadius() {
  return radius;
}