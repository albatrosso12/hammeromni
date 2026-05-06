import * as THREE from 'three';
import { BSPParser, BSPWriter, BSP_LUMPS } from './BSPParser.js';

export class SmartDecompiler {
  constructor(options = {}) {
    this.snapThreshold = options.snapThreshold || 1.0;
    this.mergeAngleThreshold = options.mergeAngleThreshold || 0.05;
    this.minFaceArea = options.minFaceArea || 0.01;
  }

  snapVertex(v, threshold = this.snapThreshold) {
    const snapped = v.clone();
    snapped.x = this.nearestGrid(snapped.x, threshold);
    snapped.y = this.nearestGrid(snapped.y, threshold);
    snapped.z = this.nearestGrid(snapped.z, threshold);
    return snapped;
  }

  nearestGrid(value, gridSize) {
    const rounded = Math.round(value / gridSize);
    if (Math.abs(rounded * gridSize - value) < 0.001) {
      return rounded * gridSize;
    }
    return value;
  }

  mergeCoplanarFaces(faces, materialMap = {}) {
    const groups = new Map();
    const epsilon = 0.001;

    for (const face of faces) {
      const n = face.normal;
      const key = this.getPlaneKey(n, epsilon);
      
      const matKey = face.material || 'default';
      const groupKey = `${key}_${matKey}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(face);
    }

    const merged = [];
    for (const [key, group] of groups) {
      if (group.length === 1) {
        merged.push(group[0]);
      } else {
        const combined = this.combineFaces(group);
        if (combined) merged.push(combined);
      }
    }

    return merged;
  }

  getPlaneKey(normal, epsilon) {
    const precision = 1 / epsilon;
    return `${Math.round(normal.x * precision)}_${Math.round(normal.y * precision)}_${Math.round(normal.z * precision)}`;
  }

  combineFaces(faces) {
    const allVerts = [];
    const seen = new Map();

    for (const face of faces) {
      for (const v of face.vertices) {
        const key = `${v.x.toFixed(4)}_${v.y.toFixed(4)}_${v.z.toFixed(4)}`;
        if (!seen.has(key)) {
          seen.set(key, allVerts.length);
          allVerts.push(v.clone());
        }
      }
    }

    if (allVerts.length < 3) return null;

    const hull = this.computeConvexHull2D(allVerts, faces[0].normal);
    if (hull.length < 3) return null;

    const area = this.computeFaceArea(hull);
    if (area < this.minFaceArea) return null;

    return {
      vertices: hull,
      normal: faces[0].normal,
      material: faces[0].material
    };
  }

  computeConvexHull2D(vertices, normal) {
    const up = Math.abs(normal.y) > 0.9 
      ? new THREE.Vector3(1, 0, 0) 
      : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(normal, up).normalize();
    up.crossVectors(right, normal).normalize();

    const points2D = vertices.map(v => ({
      x: v.dot(right),
      y: v.dot(up),
      original: v
    }));

    points2D.sort((a, b) => a.x - b.x || a.y - b.y);

    const lower = [];
    for (const p of points2D) {
      while (lower.length >= 2 && this.cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }

    const upper = [];
    for (let i = points2D.length - 1; i >= 0; i--) {
      const p = points2D[i];
      while (upper.length >= 2 && this.cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }

    lower.pop();
    upper.pop();
    const hull2D = lower.concat(upper);

    return hull2D.map(p => p.original);
  }

  cross(o, a, b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  computeFaceArea(vertices) {
    if (vertices.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const v1 = vertices[i];
      const v2 = vertices[(i + 1) % vertices.length];
      area += v1.x * v2.y - v2.x * v1.y;
    }
    return Math.abs(area) / 2;
  }

  buildConvexBrushes(faces) {
    const epsilon = 0.001;
    const planeGroups = new Map();

    for (const face of faces) {
      const n = face.normal;
      const key = `${n.x.toFixed(4)}_${n.y.toFixed(4)}_${n.z.toFixed(4)}`;
      if (!planeGroups.has(key)) {
        planeGroups.set(key, []);
      }
      planeGroups.get(key).push(face);
    }

    const uniquePlanes = [];
    for (const [key, group] of planeGroups) {
      const firstFace = group[0];
      const plane = {
        normal: firstFace.normal.clone(),
        distance: this.calculatePlaneDistance(firstFace.vertices),
        material: firstFace.material
      };
      uniquePlanes.push(plane);
    }

    return [{ planes: uniquePlanes, material: 'combined' }];
  }

  calculatePlaneDistance(vertices) {
    if (vertices.length === 0) return 0;
    const center = new THREE.Vector3();
    for (const v of vertices) center.add(v);
    center.divideScalar(vertices.length);
    
    const n = new THREE.Vector3();
    if (vertices.length >= 3) {
      const v1 = new THREE.Vector3().subVectors(vertices[1], vertices[0]);
      const v2 = new THREE.Vector3().subVectors(vertices[2], vertices[0]);
      n.crossVectors(v1, v2).normalize();
    } else {
      n.set(0, 1, 0);
    }
    
    return -(n.x * center.x + n.y * center.y + n.z * center.z);
  }

  processBSP(bspData, options = {}) {
    const {
      snapGrid = 1.0,
      mergeFaces = true,
      removeInvisible = true,
      snapVertices = true
    } = options;

    const parser = new BSPParser();
    parser.parse(bspData);

    let faces = parser.getFacesAsGeometry({
      snapToGrid: snapVertices ? snapGrid : 0,
      mergePlanar: false,
      removeInvisible
    });

    if (snapVertices) {
      faces = faces.map(face => ({
        ...face,
        vertices: face.vertices.map(v => this.snapVertex(v, snapGrid))
      }));
    }

    if (mergeFaces) {
      faces = this.mergeCoplanarFaces(faces);
    }

    return {
      objects: faces.map(face => this.faceToObject(face)),
      entities: parser.getEntities()
    };
  }

  faceToObject(face) {
    const geometry = new THREE.BufferGeometry();
    
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i < face.vertices.length; i++) {
      const v = face.vertices[i];
      positions.push(v.x, v.y, v.z);
      normals.push(face.normal.x, face.normal.y, face.normal.z);
      uvs.push(0, 0);
    }

    for (let i = 1; i < face.vertices.length - 1; i++) {
      indices.push(0, i, i + 1);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    return {
      type: 'brush',
      geometry,
      material: face.material,
      texture: face.material,
      position: [0, 0, 0],
      rotation: [0, 0, 0]
    };
  }
}

export function importBSP(buffer, options = {}) {
  const decompiler = new SmartDecompiler(options);
  return decompiler.processBSP(buffer, options);
}

export function exportBSP(objects, entities = []) {
  const writer = new BSPWriter();
  writer.fromObjects(objects, entities);
  return writer.toArrayBuffer();
}