import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getState, selectObject, emit } from './state.js';
import { getScene } from './Renderer.js';
import ManifoldInit from 'manifold-3d';

let wasm = null;
let csgOps = null;

export async function initCSGEngine() {
    if (wasm) return;
    try {
        const Module = await ManifoldInit();
        wasm = Module;

        console.log('[CSG] Module keys:', Object.keys(Module).filter(k => !k.startsWith('_')));
        console.log('[CSG] typeof Manifold:', typeof Module.Manifold);
        console.log('[CSG] typeof Mesh:', typeof Module.Mesh);
        console.log('[CSG] typeof union:', typeof Module.union);
        console.log('[CSG] typeof Manifold.union:', typeof Module.Manifold?.union);

        if (typeof Module.Manifold?.union === 'function') {
            csgOps = {
                union:        (a, b) => Module.Manifold.union(a, b),
                difference:   (a, b) => Module.Manifold.difference(a, b),
                intersection: (a, b) => Module.Manifold.intersection(a, b),
                smooth:       (mesh, edges) => Module.Manifold.smooth(mesh, edges),
            };
            console.log('[CSG] API: static methods on Module.Manifold');
        } else if (typeof Module.union === 'function') {
            csgOps = {
                union:        (a, b) => Module.union(a, b),
                difference:   (a, b) => Module.difference(a, b),
                intersection: (a, b) => Module.intersection(a, b),
                smooth:       (mesh, edges) => Module.smooth?.(mesh, edges) ?? null,
            };
            console.log('[CSG] API: methods directly on Module');
        } else {
            csgOps = {
                union:        (a, b) => a.add(b),
                difference:   (a, b) => a.subtract(b),
                intersection: (a, b) => a.intersect(b),
                smooth:       null,
            };
            console.log('[CSG] API: instance methods (add/subtract/intersect)');
        }

        console.log('[CSG] Manifold Engine Ready');
    } catch (e) {
        console.error('[CSG] Manifold init failed:', e);
    }
}

export function bindCSGAutoOpen() {}

// ── Конвертеры THREE ↔ Manifold ───────────────────────────────────────────────

export function threeToManifold(mesh) {
    mesh.updateMatrixWorld(true);
    let geo = mesh.geometry.clone();
    if (!geo.index) geo = mergeVertices(geo);

    const pos = geo.attributes.position;
    const idx = geo.index;
    const verts = new Float32Array(pos.count * 3);
    const tmp = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
        tmp.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        verts[i * 3]     = tmp.x;
        verts[i * 3 + 1] = tmp.y;
        verts[i * 3 + 2] = tmp.z;
    }

    const meshData = {
        vertProperties: verts,
        triVerts: new Uint32Array(idx.array),
        numProp: 3,
    };

    // Вариант 1: new wasm.Mesh() → new wasm.Manifold()
    if (typeof wasm.Mesh === 'function') {
        try {
            const m = new wasm.Mesh(meshData);
            const man = new wasm.Manifold(m);
            if (typeof man.getMesh === 'function') {
                console.log('[CSG] threeToManifold: Variant 1 OK (Mesh → Manifold)');
                return man;
            }
        } catch (e) { console.warn('[CSG] Variant 1 failed:', e.message); }
    }

    // Вариант 2: new wasm.Manifold(meshData) напрямую
    if (typeof wasm.Manifold === 'function') {
        try {
            const man = new wasm.Manifold(meshData);
            if (typeof man.getMesh === 'function') {
                console.log('[CSG] threeToManifold: Variant 2 OK (Manifold direct)');
                return man;
            }
        } catch (e) { console.warn('[CSG] Variant 2 failed:', e.message); }
    }

    // Вариант 3: статические фабричные методы
    for (const fn of ['ofMesh', 'fromMesh', 'create']) {
        if (typeof wasm.Manifold?.[fn] === 'function') {
            try {
                const man = wasm.Manifold[fn](meshData);
                if (typeof man.getMesh === 'function') {
                    console.log(`[CSG] threeToManifold: Variant 3 OK (Manifold.${fn})`);
                    return man;
                }
            } catch (e) { console.warn(`[CSG] Variant 3 (${fn}) failed:`, e.message); }
        }
    }

    throw new Error('Не удалось создать Manifold — проверь консоль и версию manifold-3d');
}

export function manifoldToThree(manifoldObj) {
    const m = manifoldObj.getMesh();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(m.vertProperties.slice(), 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(m.triVerts), 1));
    geo.computeVertexNormals();
    return geo;
}

// ── CSG операции ──────────────────────────────────────────────────────────────

async function runOp(type) {
    if (!wasm || !csgOps) {
        await initCSGEngine();
        if (!wasm || !csgOps) return alert('CSG Engine не инициализирован');
    }

    const state = getState();
    const objs = state.selectedObjects;
    if (objs.length < 2) return alert('Выберите 2 объекта');

    const [a, b] = objs;
    let manA, manB, res;
    try {
        manA = threeToManifold(a.mesh);
        manB = threeToManifold(b.mesh);

        if (type === 'union')        res = csgOps.union(manA, manB);
        if (type === 'difference')   res = csgOps.difference(manA, manB);
        if (type === 'intersection') res = csgOps.intersection(manA, manB);

        if (!res) throw new Error(`Unknown operation: ${type}`);

        const scene = getScene();
        const resultMesh = new THREE.Mesh(manifoldToThree(res), a.mesh.material.clone());
        scene.add(resultMesh);

        [a, b].forEach(o => {
            scene.remove(o.mesh);
            state.objects = state.objects.filter(x => x.id !== o.id);
        });

        const newObj = {
            id: crypto.randomUUID(),
            name: `CSG_${type}`,
            type: 'brush',
            mesh: resultMesh,
        };
        state.objects.push(newObj);
        selectObject(newObj);
        emit('objectAdd', newObj);
    } catch (e) {
        console.error('[CSG] Operation failed:', e);
        alert(`CSG ошибка: ${e.message}`);
    } finally {
        manA?.delete();
        manB?.delete();
        res?.delete();
    }
}

export const csgUnion     = () => runOp('union');
export const csgSubtract  = () => runOp('difference');
export const csgIntersect = () => runOp('intersection');
export const mergeMeshes  = () => runOp('union');

// ── Bevel (скругление углов) ──────────────────────────────────────────────────

export function applyBevel(mesh, amount) {
    if (!wasm || amount <= 0) return mesh.geometry;

    let man = null;
    let smoothed = null;
    let refined = null;

    try {
        man = threeToManifold(mesh);

        if (csgOps?.smooth) {
            smoothed = csgOps.smooth(man.getMesh(), []);
        } else {
            smoothed = man;
        }

        const steps = Math.max(1, Math.round(amount * 4));
        refined = smoothed.refine(steps);

        return manifoldToThree(refined);
    } catch (e) {
        console.warn('[CSG] Bevel failed:', e);
        return mesh.geometry;
    } finally {
        if (smoothed !== man) smoothed?.delete();
        man?.delete();
        refined?.delete();
    }
}