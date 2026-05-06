import * as THREE from 'three';
import { getState, selectObject, emit } from './state.js';
import { getScene, getCamera, raycast } from './Renderer.js';
import { threeToManifold, manifoldToThree } from './CSGEngine.js';

let enabled = false;
let points = [];

export function toggleKnifeTool() {
  enabled = !enabled;
  if (!enabled) reset();
  // Твоя логика UI...
}

// ... (оставь листенеры мыши из своего кода, они собирают массив `points` из 2 точек)

function performCut(obj) {
  if (points.length < 2) return;

  const mesh = obj.mesh;
  const scene = getScene();
  const state = getState();

  const p1 = points[0];
  const p2 = points[1];
  const cam = getCamera();

  // 1. Вычисляем нормаль плоскости разреза
  const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
  const planeNormal = new THREE.Vector3().crossVectors(dir, up).normalize();

  // 2. Создаем гигантский "резак" (Cutter) в Three.js
  // Создаем куб размером 10000, смещаем его так, чтобы его грань лежала на плоскости реза
  const cutterGeo = new THREE.BoxGeometry(10000, 10000, 10000);
  cutterGeo.translate(0, 5000, 0); // Смещаем центр на край куба
  const cutterMesh = new THREE.Mesh(cutterGeo);
  
  // Поворачиваем резак по нормали плоскости и ставим в точку p1
  cutterMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), planeNormal);
  cutterMesh.position.copy(p1);
  cutterMesh.updateMatrixWorld(true);

  try {
    // 3. Передаем всё в Manifold
    const manTarget = threeToManifold(mesh);
    const manCutter = threeToManifold(cutterMesh);

    // Часть А (Всё что ВНЕ резака)
    const manHalfA = wasm.difference(manTarget, manCutter);
    // Часть B (Всё что ВНУТРИ резака)
    const manHalfB = wasm.intersection(manTarget, manCutter);

    const geoA = manifoldToThree(manHalfA);
    const geoB = manifoldToThree(manHalfB);

    const mat = mesh.material.clone();
    const meshA = new THREE.Mesh(geoA, mat);
    const meshB = new THREE.Mesh(geoB, mat.clone());

    scene.add(meshA);
    scene.add(meshB);

    // Удаляем оригинал
    scene.remove(mesh);
    mesh.geometry.dispose();
    
    // Очистка памяти C++ (КРИТИЧНО ВАЖНО)
    manTarget.delete();
    manCutter.delete();
    manHalfA.delete();
    manHalfB.delete();
    cutterGeo.dispose();

    showMsg('Идеальный твердотельный разрез выполнен!');
  } catch (e) {
    console.error('Ошибка резки:', e);
  }
}