import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { getState, subscribe } from './state.js';

let renderer, scene, camera, controls, transformControls;
let raycaster, mouse, gridHelper, floorMesh;
let animationId;
let ambientLight, directionalLight;

export let updateLightingConfig = null;

// Один BoxHelper для primary выделения, массив для мульти
let selectionBox = null;
let multiBoxHelpers = [];

// Пустая группа для одновременного перетаскивания нескольких объектов
let selectionGroup = null;

export function initRenderer(container) {
  const w = container.clientWidth || container.offsetWidth || 800;
  const h = container.clientHeight || container.offsetHeight || 600;

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.setClearColor(0x111318, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';

  scene = new THREE.Scene();
  // Sky gradient background
  scene.background = new THREE.Color(0x111318);
  // No fog — clean viewport
  scene.fog = null;

  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 2000);
  camera.position.set(150, 120, 150);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;
  controls.minDistance = 10;
  controls.maxDistance = 1000;
  controls.target.set(0, 32, 0);

  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setSize(0.85);
  transformControls.setSpace('world');
  transformControls.setTranslationSnap(64);
  transformControls.setRotationSnap(THREE.MathUtils.degToRad(15));
  transformControls.addEventListener('dragging-changed', e => {
    controls.enabled = !e.value;
  });
  transformControls.addEventListener('objectChange', () => {
    const state = getState();
    // Если тянем группу — синхронизируем позиции всех объектов из группы
    if (selectionGroup && state.selectedObjects.length > 1) {
      syncGroupToObjects(state.selectedObjects);
    }
    const panel = document.getElementById('propsPanel');
    if (panel && state.selected) updatePropsPanel(state.selected);
  });

  // TransformControls в Three.js r160 добавляет helper отдельно
  if (typeof transformControls.getHelper === 'function') {
    scene.add(transformControls.getHelper());
  } else {
    scene.add(transformControls);
  }

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  const state = getState();
  const lighting = state.settings?.lighting;

  // Hemisphere light — sky/ground gradient
  const hemiLight = new THREE.HemisphereLight(0xc8d8f0, 0x2a2a35, 0.6);
  scene.add(hemiLight);

  // Ambient
  ambientLight = new THREE.AmbientLight(0xffffff, lighting?.ambient?.intensity ?? 0.35);
  scene.add(ambientLight);

  // Main directional (sun)
  directionalLight = new THREE.DirectionalLight(0xfff5e0, lighting?.directional?.intensity ?? 1.0);
  const pos = lighting?.directional?.position || { x: 200, y: 400, z: 150 };
  directionalLight.position.set(pos.x, pos.y, pos.z);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(2048, 2048);
  directionalLight.shadow.camera.left   = -300;
  directionalLight.shadow.camera.right  =  300;
  directionalLight.shadow.camera.top    =  300;
  directionalLight.shadow.camera.bottom = -300;
  directionalLight.shadow.camera.near   = 1;
  directionalLight.shadow.camera.far    = 1000;
  directionalLight.shadow.bias = -0.001;
  scene.add(directionalLight);

  // Sky dome
  createSkyDome();

  createGrid(512, 64);
  createFloor();
  animate();

  const ro = new ResizeObserver(() => onResize(container));
  ro.observe(container);

  subscribe('select', onSelect);
  subscribe('multiSelect', onMultiSelect);
  subscribe('toolChange', onToolChange);

  return { renderer, scene, camera, controls, transformControls };
}

function createSkyDome() {
  // Gradient sky using a large sphere with vertex colors
  const skyGeo = new THREE.SphereGeometry(900, 16, 8);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor:    { value: new THREE.Color(0x0d1117) },
      bottomColor: { value: new THREE.Color(0x1a1f2e) },
      offset:      { value: 200 },
      exponent:    { value: 0.4 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.userData.isSky = true;
  scene.add(sky);
}

function createGrid(size, divisions) {
  if (gridHelper) scene.remove(gridHelper);
  gridHelper = new THREE.GridHelper(size, divisions, 0x2d3142, 0x1e2130);
  gridHelper.position.y = 0.01;
  gridHelper.material.opacity = 0.5;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);
}

function createFloor() {
  const geo = new THREE.PlaneGeometry(1000, 1000);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0d0f14,
    roughness: 0.98,
    metalness: 0.0,
  });
  floorMesh = new THREE.Mesh(geo, mat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  floorMesh.userData.isFloor = true;
  scene.add(floorMesh);
}

// ── Синхронизация group → позиции объектов ────────────────────────────────────
// selectionGroup — это вспомогательный Three.js Object3D.
// Мы добавляем в него все выделенные меши, перемещаем группу,
// затем при отпускании вытаскиваем меши обратно с обновлёнными worldMatrix.
function buildSelectionGroup(objs) {
  if (selectionGroup) {
    // Вытащить все объекты обратно в сцену прежде чем удалить группу
    detachSelectionGroup(objs);
    scene.remove(selectionGroup);
  }

  selectionGroup = new THREE.Group();

  // Центр группы = среднее положение объектов
  const center = new THREE.Vector3();
  let count = 0;
  objs.forEach(obj => {
    if (obj.mesh) { center.add(obj.mesh.position); count++; }
  });
  if (count > 0) center.divideScalar(count);
  selectionGroup.position.copy(center);

  scene.add(selectionGroup);

  objs.forEach(obj => {
    if (!obj.mesh) return;
    // Пересчитываем позицию в локальных координатах группы
    selectionGroup.attach(obj.mesh);
  });

  return selectionGroup;
}

function detachSelectionGroup(objs) {
  if (!selectionGroup) return;
  objs.forEach(obj => {
    if (obj.mesh && obj.mesh.parent === selectionGroup) {
      scene.attach(obj.mesh); // сохраняет world transform
    }
  });
}

function syncGroupToObjects(objs) {
  // Вызывается каждый кадр пока тянем — boxhelpers нужно обновить
  multiBoxHelpers.forEach(h => h.update());
  if (selectionBox) selectionBox.update();
}

// ── Очистка вспомогательных объектов ─────────────────────────────────────────
function clearSelectionVisuals() {
  if (selectionBox) {
    scene.remove(selectionBox);
    selectionBox.geometry?.dispose();
    selectionBox = null;
  }
  multiBoxHelpers.forEach(h => {
    scene.remove(h);
    h.geometry?.dispose();
  });
  multiBoxHelpers = [];
}

function clearSelectionGroup(objs) {
  if (selectionGroup) {
    detachSelectionGroup(objs || getState().selectedObjects);
    scene.remove(selectionGroup);
    selectionGroup = null;
  }
}

// ── Событие выбора одного объекта ─────────────────────────────────────────────
function onSelect(obj) {
  const state = getState();
  clearSelectionVisuals();
  clearSelectionGroup([]);
  transformControls.detach();

  if (obj && obj.mesh) {
    transformControls.attach(obj.mesh);
    selectionBox = new THREE.BoxHelper(obj.mesh, 0xffffff);
    selectionBox.material.depthTest = false;
    selectionBox.material.opacity = 0.4;
    selectionBox.material.transparent = true;
    scene.add(selectionBox);
  }
}

// ── Событие мульти-выбора ──────────────────────────────────────────────────────
function onMultiSelect(objs) {
  clearSelectionVisuals();
  clearSelectionGroup([]);
  transformControls.detach();

  if (!objs || objs.length === 0) return;

  if (objs.length === 1) {
    // Одиночный — обычный режим
    onSelect(objs[0]);
    return;
  }

  // Несколько объектов — строим группу для совместного перемещения
  const group = buildSelectionGroup(objs);
  transformControls.attach(group);

  // BoxHelper для каждого
  objs.forEach(obj => {
    if (!obj.mesh) return;
    const h = new THREE.BoxHelper(obj.mesh, 0x4488ff);
    h.material.depthTest = false;
    h.material.opacity = 0.6;
    h.material.transparent = true;
    scene.add(h);
    multiBoxHelpers.push(h);
  });
}

// ── Инструменты ────────────────────────────────────────────────────────────────
function onToolChange(tool) {
  const state = getState();
  const hasMesh = state.selected?.mesh;
  const hasMulti = state.selectedObjects.length > 1;

  if (tool === 'select') {
    transformControls.detach();
    return;
  }

  const modeMap = { translate: 'translate', rotate: 'rotate', scale: 'scale' };
  const mode = modeMap[tool];
  if (!mode) return;

  transformControls.setMode(mode);

  if (hasMulti && selectionGroup) {
    transformControls.attach(selectionGroup);
  } else if (hasMesh) {
    transformControls.attach(state.selected.mesh);
  }
}

function updatePropsPanel(obj) {
  if (!obj?.mesh) return;
  const mesh = obj.mesh;
  const panel = document.getElementById('propsPanel');
  if (!panel) return;
  const get = (sel) => panel.querySelectorAll(sel);
  const p = get('[data-prop^="position."]');
  const r = get('[data-prop^="rotation."]');
  const s = get('[data-prop^="scale."]');
  if (p.length >= 3) { p[0].value = mesh.position.x.toFixed(1); p[1].value = mesh.position.y.toFixed(1); p[2].value = mesh.position.z.toFixed(1); }
  if (r.length >= 3) { r[0].value = (mesh.rotation.x * 180 / Math.PI).toFixed(1); r[1].value = (mesh.rotation.y * 180 / Math.PI).toFixed(1); r[2].value = (mesh.rotation.z * 180 / Math.PI).toFixed(1); }
  if (s.length >= 3) { s[0].value = mesh.scale.x.toFixed(2); s[1].value = mesh.scale.y.toFixed(2); s[2].value = mesh.scale.z.toFixed(2); }
}

function onResize(container) {
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

let lastFrameTime = 0;
let frameCount = 0;

function animate(time) {
  animationId = requestAnimationFrame(animate);
  controls.update();
  if (selectionBox) selectionBox.update();
  multiBoxHelpers.forEach(h => h.update());
  renderer.render(scene, camera);

  frameCount++;
  if (time - lastFrameTime >= 1000) {
    const fps = frameCount;
    frameCount = 0;
    lastFrameTime = time;
    const el = document.getElementById('status-fps');
    if (el) el.textContent = `${fps} FPS`;
  }
}

export function getScene()            { return scene; }
export function getCamera()           { return camera; }
export function getRenderer()         { return renderer; }
export function getControls()         { return controls; }
export function getTransformControls(){ return transformControls; }

export function raycast(x, y, objects) {
  const container = renderer.domElement.parentElement;
  if (!container) return [];
  const rect = container.getBoundingClientRect();
  mouse.x = ((x - rect.left) / rect.width)  *  2 - 1;
  mouse.y = -((y - rect.top)  / rect.height) *  2 + 1;
  raycaster.setFromCamera(mouse, camera);
  return raycaster.intersectObjects(objects, true);
}

export function finalizeGroupMove() {
  // Вызывается после отпускания мыши — фиксируем позиции
  const state = getState();
  if (selectionGroup && state.selectedObjects.length > 1) {
    detachSelectionGroup(state.selectedObjects);
    scene.remove(selectionGroup);
    selectionGroup = null;
    // Пересоздаём группу со свежими позициями
    buildSelectionGroup(state.selectedObjects);
    const group = selectionGroup;
    transformControls.attach(group);
  }
}

export function dispose() {
  cancelAnimationFrame(animationId);
  renderer.dispose();
}