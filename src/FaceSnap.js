import * as THREE from 'three';
import { getState, subscribe } from './state.js';
import { getScene, getCamera, raycast, getTransformControls } from './Renderer.js';

let faceSnapEnabled = false;
let lastFaceNormal = null;

export function initFaceSnap() {
  const canvas = document.getElementById('canvas-3d');
  if (!canvas) return;

  canvas.addEventListener('mousemove', onMouseMove, { passive: true });
  subscribe('toolChange', onToolChange);
}

function onToolChange(tool) {
  if (tool === 'translate') {
    enableFaceSnap();
  } else {
    disableFaceSnap();
  }
}

export function enableFaceSnap() {
  faceSnapEnabled = true;
  const state = getState();
  state.settings.faceSnap = true;
}

export function disableFaceSnap() {
  faceSnapEnabled = false;
  const state = getState();
  state.settings.faceSnap = false;
}

export function toggleFaceSnap() {
  if (faceSnapEnabled) {
    disableFaceSnap();
  } else {
    enableFaceSnap();
  }
}

function onMouseMove(e) {
  if (!faceSnapEnabled) return;

  const state = getState();
  if (!state.selected || !state.selected.mesh) return;

  const controls = getTransformControls();
  if (!controls || !controls.dragging) return;

  const scene = getScene();
  const objects = scene.children.filter(c => c.isMesh && c !== state.selected.mesh);

  const intersects = raycast(e.clientX, e.clientY, objects);
  if (intersects.length > 0) {
    const hit = intersects[0];
    const normal = hit.face.normal.clone();
    normal.transformDirection(hit.object.matrixWorld);

    if (lastFaceNormal && !normalsEqual(normal, lastFaceNormal)) {
      alignToFace(normal);
    }
    lastFaceNormal = normal;
  } else {
    lastFaceNormal = null;
  }
}

function normalsEqual(a, b, tolerance = 0.01) {
  return (
    Math.abs(a.x - b.x) < tolerance &&
    Math.abs(a.y - b.y) < tolerance &&
    Math.abs(a.z - b.z) < tolerance
  );
}

function alignToFace(normal) {
  const controls = getTransformControls();
  const selected = getState().selected;
  if (!selected || !selected.mesh) return;

  const up = new THREE.Vector3(0, 1, 0);

  if (Math.abs(normal.dot(up)) > 0.99) {
    return;
  }

  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

  selected.mesh.quaternion.premultiply(quaternion);
}

export function isFaceSnapEnabled() {
  return faceSnapEnabled;
}