import * as THREE from 'three';
import { subscribe } from './state.js';
import { applyBevel } from './CSGEngine.js';

let scene, camera, gizmo, activeMesh = null;
let baseGeometry = null;
let isDragging = false;
let startX = 0;

export function initAutoRounder({ scene: s, camera: c, renderer: r }) {
    scene = s;
    camera = c;

    const geo = new THREE.TorusGeometry(8, 0.6, 16, 32);
    const mat = new THREE.MeshBasicMaterial({
        color: 0x00ffcc,
        depthTest: false,
        transparent: true,
        opacity: 0.8,
    });
    gizmo = new THREE.Mesh(geo, mat);
    gizmo.renderOrder = 999;
    gizmo.visible = false;
    scene.add(gizmo);

    r.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    // ИСПРАВЛЕНО: событие 'select', а не 'objectSelect'
    // Renderer эмитит именно 'select' через state.js
    subscribe('select', (obj) => {
        if (obj?.mesh) {
            activeMesh = obj.mesh;
            baseGeometry = obj.mesh.geometry.clone();
            showGizmo();
        } else {
            hideGizmo();
        }
    });
}

function showGizmo() {
    if (!activeMesh) return;
    gizmo.visible = true;
    updateGizmoPos();
}

function hideGizmo() {
    gizmo.visible = false;
    activeMesh = null;
    baseGeometry = null;
}

function updateGizmoPos() {
    // ИСПРАВЛЕНО: guard на camera и boundingBox
    if (!activeMesh || !camera) return;
    activeMesh.geometry.computeBoundingBox();
    const bb = activeMesh.geometry.boundingBox;
    if (!bb) return;
    const height = bb.max.y;
    gizmo.position.copy(activeMesh.position);
    gizmo.position.y += height + 10;
    gizmo.lookAt(camera.position);
}

function onDown(e) {
    if (!gizmo.visible) return;
    const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(gizmo);

    if (hits.length > 0) {
        isDragging = true;
        startX = e.clientX;
        if (activeMesh && !baseGeometry) {
            baseGeometry = activeMesh.geometry.clone();
        }
    }
}

function onMove(e) {
    if (gizmo.visible) updateGizmoPos();
    if (!isDragging || !activeMesh) return;

    const delta = (e.clientX - startX) * 0.002;
    const amount = Math.max(0, Math.min(0.95, delta));

    const oldGeo = activeMesh.geometry;
    const tempMesh = new THREE.Mesh(baseGeometry, activeMesh.material);
    tempMesh.matrixWorld.copy(activeMesh.matrixWorld);

    activeMesh.geometry = applyBevel(tempMesh, amount);
    if (oldGeo !== baseGeometry) oldGeo.dispose();
}

function onUp() {
    isDragging = false;
}

export function setGizmoVisible(v) { if (gizmo) gizmo.visible = v; }
export function syncFromSelection() {}