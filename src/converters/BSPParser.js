import * as THREE from 'three';

export const BSP_LUMPS = {
  LUMP_ENTITIES: 0,
  LUMP_PLANES: 1,
  LUMP_VERTICES: 2,
  LUMP_EDGES: 3,
  LUMP_SURFACES: 4,
  LUMP_DISPATCH: 5,
  LUMP_PHYSCOLLIDE: 6,
  LUMP_VERTNORMALS: 7,
  LUMP_FACEIDS: 8,
  LUMP_PLANES_AUX: 9,
  LUMP_GAME_LUMPS: 10,
  LUMP_BRUSHES: 11,
  LUMP_BRUSHSIDES: 12,
  LUMP_MODELS: 13,
  LUMP_WORLDLIGHTS: 14,
  LUMP_LEAFS: 15,
  LUMP_FACES2: 16,
  LUMP_TRANGHUBS: 17,
  LUMP_PHYSSURFACE: 18,
  LUMP_PHYSCOLLIDEPRX: 19,
  LUMP_PROP_BLOB: 20,
  LUMP_PROP_BLOB_SHADOW: 21,
  LUMP_NAVMESH: 22,
  LUMP_NAVMELON: 23,
  LUMP_LIGHTING_HDR: 24,
  LUMP_LIGHTING: 25,
  LUMP_WORLDLIGHT_HDR: 26,
  LUMP_WORLDLIGHT: 27,
  LUMP_LEAF_AMBIENT_LIGHTING_HDR: 28,
  LUMP_LEAF_AMBIENT_LIGHTING: 29,
  LUMP_XZIPPAKFILE: 30,
  LUMP_PACKFILE: 31,
  LUMP_REPLACEDPAKFILES: 32,
  LUMP_VERTEXRESERVED: 33,
  LUMP_QT_PATCHES: 34,
  LUMP_QT_PATCHES_IB: 35,
  LUMP_QT_PATCHES_VB: 36,
  LUMP_FACES_HULL: 37,
  LUMP_FACES_ACCEL: 38,
  LUMP_SURFACE_LIGHTING: 39,
  LUMP_WATERSHADER: 40,
  LUMP_LEAF_AMBIENT_OCCLUSION_HDR: 41,
  LUMP_LEAF_AMBIENT_OCCLUSION: 42,
  LUMP_CSMLOOOKUPS: 43,
  LUMP_CSM_AABB_VERTS: 44,
  LUMP_CSM_AABB_INDICES: 45,
  LUMP_CSM_OBB_PLANE_NORMS: 46,
  LUMP_CSM_OBB_PLANE_DISTS: 47,
  LUMP_LIGHTMAP_HEADER: 48,
  LUMP_LIGHTMAP_DATA: 49,
  LUMP_LIGHTMAP_DATA2: 50,
  LUMP_LIGHTMAP_DATA3: 51,
  LUMP_VISDATA: 52,
  LUMP_TEXDATA: 53,
  LUMP_LIGHTING_HDR_AUX_WZY: 54,
  LUMP_UNKNOWN55: 55,
  LUMP_UNKNOWN56: 56,
  LUMP_UNKNOWN57: 57,
  LUMP_UNKNOWN58: 58,
  LUMP_UNKNOWN59: 59,
  LUMP_UNKNOWN60: 60,
  LUMP_UNKNOWN61: 61,
  LUMP_UNKNOWN62: 62,
  LUMP_UNKNOWN63: 63
};

export class BSPParser {
  constructor() {
    this.buffer = null;
    this.header = null;
    this.lumps = {};
    this.entities = [];
    this.planes = [];
    this.vertices = [];
    this.edges = [];
    this.surfaces = [];
    this.brushes = [];
    this.brushSides = [];
    this.faces = [];
    this.texData = [];
  }

  parse(buffer) {
    this.buffer = new DataView(buffer);
    this.readHeader();
    this.readLumps();
    this.parseEntities();
    this.parseGeometry();
    return this;
  }

  readHeader() {
    const magic = this.buffer.getUint32(0, true);
    if (magic !== 0x50534256 && magic !== 0x56425350) {
      throw new Error('Invalid BSP file');
    }

    const version = this.buffer.getUint32(4, true);
    this.header = { magic, version, lumps: [] };

    for (let i = 0; i < 64; i++) {
      const offset = 8 + i * 16;
      this.header.lumps.push({
        type: i,
        offset: this.buffer.getUint32(offset, true),
        length: this.buffer.getUint32(offset + 4, true),
        version: this.buffer.getUint32(offset + 8, true),
        fourCC: this.buffer.getUint32(offset + 12, true)
      });
    }
  }

  readLumps() {
    for (const lump of this.header.lumps) {
      if (lump.length > 0) {
        this.lumps[lump.type] = {
          offset: lump.offset,
          length: lump.length,
          data: new Uint8Array(this.buffer.buffer, lump.offset, lump.length)
        };
      }
    }
  }

  parseEntities() {
    const entityData = this.lumps[BSP_LUMPS.LUMP_ENTITIES];
    if (!entityData) return;

    const text = new TextDecoder().decode(entityData.data);
    this.entities = this.parseEntityText(text);
  }

  parseEntityText(text) {
    const entities = [];
    const lines = text.split('\n');
    let currentEntity = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '{') {
        currentEntity = { properties: {} };
      } else if (trimmed === '}') {
        if (currentEntity) {
          entities.push(currentEntity);
          currentEntity = null;
        }
      } else if (currentEntity && trimmed) {
        const match = trimmed.match(/^"([^"]+)"\s+"(.+)"$/);
        if (match) {
          currentEntity.properties[match[1]] = match[2];
        }
      }
    }

    return entities;
  }

  parseGeometry() {
    this.parsePlanes();
    this.parseVertices();
    this.parseEdges();
    this.parseBrushes();
    this.parseBrushSides();
    this.parseFaces();
    this.parseTexData();
  }

  parsePlanes() {
    const lump = this.lumps[BSP_LUMPS.LUMP_PLANES];
    if (!lump) return;

    const dv = new DataView(lump.data.buffer, lump.data.byteOffset, lump.length);
    const count = lump.length / 20;

    for (let i = 0; i < count; i++) {
      const base = i * 20;
      const plane = {
        normal: {
          x: dv.getFloat32(base, true),
          y: dv.getFloat32(base + 4, true),
          z: dv.getFloat32(base + 8, true)
        },
        distance: dv.getFloat32(base + 12, true),
        type: dv.getUint32(base + 16, true)
      };
      this.planes.push(plane);
    }
  }

  parseVertices() {
    const lump = this.lumps[BSP_LUMPS.LUMP_VERTICES];
    if (!lump) return;

    const dv = new DataView(lump.data.buffer, lump.data.byteOffset, lump.length);
    const count = lump.length / 12;

    for (let i = 0; i < count; i++) {
      const base = i * 12;
      this.vertices.push(new THREE.Vector3(
        dv.getFloat32(base, true),
        dv.getFloat32(base + 4, true),
        dv.getFloat32(base + 8, true)
      ));
    }
  }

  parseEdges() {
    const lump = this.lumps[BSP_LUMPS.LUMP_EDGES];
    if (!lump) return;

    const dv = new DataView(lump.data.buffer, lump.data.byteOffset, lump.length);
    const count = lump.length / 4;

    for (let i = 0; i < count; i++) {
      const base = i * 4;
      this.edges.push({
        vertexIndex: [
          dv.getUint16(base, true),
          dv.getUint16(base + 2, true)
        ]
      });
    }
  }

  parseBrushes() {
    const lump = this.lumps[BSP_LUMPS.LUMP_BRUSHES];
    if (!lump) return;

    const dv = new DataView(lump.data.buffer, lump.data.byteOffset, lump.length);
    const count = lump.length / 20;

    for (let i = 0; i < count; i++) {
      const base = i * 20;
      this.brushes.push({
        firstSide: dv.getUint32(base, true),
        numSides: dv.getUint32(base + 4, true),
        contents: dv.getUint32(base + 8, true)
      });
    }
  }

  parseBrushSides() {
    const lump = this.lumps[BSP_LUMPS.LUMP_BRUSHSIDES];
    if (!lump) return;

    const dv = new DataView(lump.data.buffer, lump.data.byteOffset, lump.length);
    const count = lump.length / 8;

    for (let i = 0; i < count; i++) {
      const base = i * 8;
      this.brushSides.push({
        planeIndex: dv.getUint32(base, true),
        texInfoIndex: dv.getUint32(base + 4, true)
      });
    }
  }

  parseFaces() {
    const lump = this.lumps[BSP_LUMPS.LUMP_SURFACES];
    if (!lump) return;

    const dv = new DataView(lump.data.buffer, lump.data.byteOffset, lump.length);
    const count = lump.length / 56;

    for (let i = 0; i < count; i++) {
      const base = i * 56;
      const face = {
        planenum: dv.getUint16(base, true),
        side: dv.getUint8(base + 2),
        onNode: dv.getInt32(base + 4, true),
        firstEdge: dv.getUint32(base + 8, true),
        numEdges: dv.getInt16(base + 12, true),
        texInfoIndex: dv.getInt32(base + 16, true),
        dispInfoIndex: dv.getInt32(base + 20, true),
        surfaceFogVolumeContents: dv.getInt32(base + 24, true),
        styles: [
          dv.getUint8(base + 28),
          dv.getUint8(base + 29),
          dv.getUint8(base + 30),
          dv.getUint8(base + 31)
        ],
        lightmapOffset: dv.getInt32(base + 32, true),
        area: dv.getFloat32(base + 36, true),
        lightmapMins: [dv.getInt32(base + 40, true), dv.getInt32(base + 44, true)],
        lightmapSize: [dv.getInt32(base + 48, true), dv.getInt32(base + 52, true)]
      };
      this.faces.push(face);
    }
  }

  parseTexData() {
    const lump = this.lumps[BSP_LUMPS.LUMP_TEXDATA];
    if (!lump) return;

    const dv = new DataView(lump.data.buffer, lump.data.byteOffset, lump.length);
    const count = lump.length / 32;

    for (let i = 0; i < count; i++) {
      const base = i * 32;
      this.texData.push({
        nameStringTableIndex: dv.getInt32(base, true),
        width: dv.getInt32(base + 4, true),
        height: dv.getInt32(base + 8, true),
        view_width: dv.getInt32(base + 12, true),
        view_height: dv.getInt32(base + 16, true),
        materialWidth: dv.getFloat32(base + 20, true),
        materialHeight: dv.getFloat32(base + 24, true),
        flags: dv.getInt32(base + 28, true)
      });
    }
  }

  getFacesAsGeometry(options = {}) {
    const { snapToGrid = 0, mergePlanar = true, removeInvisible = true } = options;
    const faces = [];

    for (const face of this.faces) {
      if (face.onNode < 0 && removeInvisible) continue;

      const edgeIndices = [];
      for (let e = 0; e < face.numEdges; e++) {
        const edgeIndex = this.getEdge(face.firstEdge + e);
        if (edgeIndex !== undefined) {
          edgeIndices.push(edgeIndex);
        }
      }

      if (edgeIndices.length < 3) continue;

      const texInfo = face.texInfoIndex >= 0 ? this.texData[face.texInfoIndex] : null;
      const material = texInfo ? `textures/${this.getTextureName(texInfo.nameStringTableIndex)}` : 'dev/dev_measuregray01a';

      const vertices = [];
      for (const idx of edgeIndices) {
        let v = this.vertices[Math.abs(idx)].clone();
        if (snapToGrid > 0) {
          v.x = Math.round(v.x / snapToGrid) * snapToGrid;
          v.y = Math.round(v.y / snapToGrid) * snapToGrid;
          v.z = Math.round(v.z / snapToGrid) * snapToGrid;
        }
        vertices.push(v);
      }

      if (vertices.length < 3) continue;

      const plane = this.planes[face.planenum];
      const normal = plane ? new THREE.Vector3(plane.normal.x, plane.normal.y, plane.normal.z) : new THREE.Vector3(0, 1, 0);

      faces.push({
        vertices,
        normal,
        material,
        planeIndex: face.planenum
      });
    }

    if (mergePlanar) {
      return this.mergePlanarFaces(faces);
    }

    return faces;
  }

  getEdge(index) {
    if (index < 0) {
      return -this.edges[-index - 1].vertexIndex[1];
    }
    return this.edges[index].vertexIndex[0];
  }

  getTextureName(stringTableIndex) {
    return 'dev/dev_measuregray01a';
  }

  mergePlanarFaces(faces) {
    const faceGroups = new Map();

    for (const face of faces) {
      const n = face.normal;
      const key = `${n.x.toFixed(4)}_${n.y.toFixed(4)}_${n.z.toFixed(4)}`;
      if (!faceGroups.has(key)) {
        faceGroups.set(key, []);
      }
      faceGroups.get(key).push(face);
    }

    const merged = [];
    for (const [key, group] of faceGroups) {
      const combined = this.combineCoplanarFaces(group);
      merged.push(...combined);
    }

    return merged;
  }

  combineCoplanarFaces(faces) {
    if (faces.length <= 1) return faces;

    const result = [];
    const epsilon = 0.01;
    const mergedMaterial = faces[0].material;

    const allVertices = [];
    for (const face of faces) {
      allVertices.push(...face.vertices);
    }

    const uniqueVerts = [];
    for (const v of allVertices) {
      let found = false;
      for (const existing of uniqueVerts) {
        if (v.distanceTo(existing) < epsilon) {
          found = true;
          break;
        }
      }
      if (!found) uniqueVerts.push(v);
    }

    if (uniqueVerts.length < 3) return faces;

    const hull = this.convexHull2D(uniqueVerts, faces[0].normal);
    if (hull.length < 3) return faces;

    result.push({
      vertices: hull,
      normal: faces[0].normal,
      material: mergedMaterial,
      planeIndex: faces[0].planeIndex
    });

    return result;
  }

  convexHull2D(vertices, normal) {
    if (vertices.length < 3) return vertices;

    let base = 0;
    for (let i = 1; i < vertices.length; i++) {
      if (vertices[i].y < vertices[base].y || 
          (vertices[i].y === vertices[base].y && vertices[i].x < vertices[base].x)) {
        base = i;
      }
    }

    const sorted = [];
    const used = new Set();
    let current = base;

    while (true) {
      sorted.push(vertices[current]);
      used.add(current);

      let next = 0;
      let minAngle = Infinity;

      for (let i = 0; i < vertices.length; i++) {
        if (i === current || used.has(i)) continue;

        const dx = vertices[i].x - vertices[current].x;
        const dy = vertices[i].y - vertices[current].y;
        const angle = Math.atan2(dy, dx);

        if (angle < minAngle || (angle === minAngle && 
            dx * dx + dy * dy < 
            (vertices[next].x - vertices[current].x) ** 2 + 
            (vertices[next].y - vertices[current].y) ** 2)) {
          minAngle = angle;
          next = i;
        }
      }

      if (next === base || minAngle === Infinity) break;
      current = next;
    }

    return sorted;
  }

  getEntities() {
    return this.entities;
  }

  toObjects(options = {}) {
    const faces = this.getFacesAsGeometry(options);
    const objects = [];

    for (const face of faces) {
      const geometry = new THREE.BufferGeometry();
      const positions = [];
      const normals = [];
      const uvs = [];

      for (const v of face.vertices) {
        positions.push(v.x, v.y, v.z);
        normals.push(face.normal.x, face.normal.y, face.normal.z);
        uvs.push(0, 0);
      }

      const indices = [];
      for (let i = 1; i < face.vertices.length - 1; i++) {
        indices.push(0, i, i + 1);
      }

      if (indices.length > 0) {
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);

        objects.push({
          type: 'brush',
          geometry,
          material: face.material,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          texture: face.material
        });
      }
    }

    return {
      objects,
      entities: this.entities
    };
  }
}

export class BSPWriter {
  constructor() {
    this.entities = [];
    this.planes = [];
    this.vertices = [];
    this.edges = [];
    this.faces = [];
    this.brushes = [];
    this.brushSides = [];
  }

  fromObjects(objects, entities = []) {
    this.entities = entities.map(e => ({ properties: e }));
    this.buildGeometryFromObjects(objects);
    return this;
  }

  buildGeometryFromObjects(objects) {
    const planeMap = new Map();
    const vertexMap = new Map();

    for (const obj of objects) {
      if (obj.type !== 'brush') continue;
      if (!obj.mesh) continue;

      const mesh = obj.mesh;
      mesh.updateMatrixWorld(true);
      const geo = mesh.geometry;

      const idx = geo.index;
      const pos = geo.attributes.position;
      const norm = geo.attributes.normal;

      const brushStartSide = this.brushSides.length;
      const faceVertices = [];
      const facePlanes = [];

      if (idx) {
        for (let i = 0; i < idx.count; i += 3) {
          const i0 = idx.getX(i);
          const i1 = idx.getX(i + 1);
          const i2 = idx.getX(i + 2);

          const v0 = new THREE.Vector3(pos.getX(i0), pos.getY(i0), pos.getZ(i0)).applyMatrix4(mesh.matrixWorld);
          const v1 = new THREE.Vector3(pos.getX(i1), pos.getY(i1), pos.getZ(i1)).applyMatrix4(mesh.matrixWorld);
          const v2 = new THREE.Vector3(pos.getX(i2), pos.getY(i2), pos.getZ(i2)).applyMatrix4(mesh.matrixWorld);

          const n = new THREE.Vector3(norm.getX(i0), norm.getY(i0), norm.getZ(i0)).applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
          const d = -(n.x * v0.x + n.y * v0.y + n.z * v0.z);

          const planeKey = `${n.x.toFixed(6)}_${n.y.toFixed(6)}_${n.z.toFixed(6)}_${d.toFixed(6)}`;
          let planeIndex;
          if (planeMap.has(planeKey)) {
            planeIndex = planeMap.get(planeKey);
          } else {
            planeIndex = this.planes.length;
            this.planes.push({ normal: { x: n.x, y: n.y, z: n.z }, distance: d, type: 0 });
            planeMap.set(planeKey, planeIndex);
          }

          const vertKeys = [
            this.getOrAddVertex(v0, vertexMap),
            this.getOrAddVertex(v1, vertexMap),
            this.getOrAddVertex(v2, vertexMap)
          ];

          faceVertices.push(vertKeys);
          facePlanes.push(planeIndex);
        }
      }

      this.brushes.push({
        firstSide: brushStartSide,
        numSides: facePlanes.length,
        contents: 1
      });

      for (const planeIndex of facePlanes) {
        this.brushSides.push({
          planeIndex,
          texInfoIndex: 0
        });
      }
    }

    this.buildEdgesFromVertices();
    this.buildFacesFromEdges();
  }

  getOrAddVertex(v, vertexMap) {
    const key = `${v.x.toFixed(4)}_${v.y.toFixed(4)}_${v.z.toFixed(4)}`;
    if (vertexMap.has(key)) {
      return vertexMap.get(key);
    }
    const index = this.vertices.length;
    this.vertices.push({ x: v.x, y: v.y, z: v.z });
    vertexMap.set(key, index);
    return index;
  }

  buildEdgesFromVertices() {
    const edgeSet = new Set();
    for (const face of this.faces) {
      for (let i = 0; i < face.numEdges; i++) {
        const edgeIndex = face.firstEdge + i;
        if (edgeIndex >= 0) {
          const edge = this.edges[edgeIndex];
          const key = Math.min(edge.vertexIndex[0], edge.vertexIndex[1]) + '_' + 
                      Math.max(edge.vertexIndex[0], edge.vertexIndex[1]);
          edgeSet.add(key);
        }
      }
    }

    for (const key of edgeSet) {
      const [a, b] = key.split('_').map(Number);
      this.edges.push({ vertexIndex: [a, b] });
    }
  }

  buildFacesFromEdges() {
    const faceSideMap = new Map();

    for (let i = 0; i < this.brushSides.length; i++) {
      const side = this.brushSides[i];
      const brushIndex = this.brushes.findIndex(b => 
        i >= b.firstSide && i < b.firstSide + b.numSides
      );
      if (!faceSideMap.has(brushIndex)) {
        faceSideMap.set(brushIndex, []);
      }
      faceSideMap.get(brushIndex).push(side.planeIndex);
    }

    for (let b = 0; b < this.brushes.length; b++) {
      const brush = this.brushes[b];
      for (let s = 0; s < brush.numSides; s++) {
        const sideIndex = brush.firstSide + s;
        const plane = this.planes[this.brushSides[sideIndex].planeIndex];

        const minEdgeIndex = 0;
        this.faces.push({
          planenum: this.brushSides[sideIndex].planeIndex,
          side: s,
          onNode: 0,
          firstEdge: minEdgeIndex,
          numEdges: 4,
          texInfoIndex: 0,
          dispInfoIndex: -1,
          surfaceFogVolumeContents: 0,
          styles: [0, 0, 0, 0],
          lightmapOffset: -1,
          area: 1,
          lightmapMins: [0, 0],
          lightmapSize: [0, 0]
        });
      }
    }
  }

  generateEntities() {
    let entityText = '';
    for (const entity of this.entities) {
      entityText += '{\n';
      for (const [key, value] of Object.entries(entity.properties)) {
        entityText += `"${key}" "${value}"\n`;
      }
      entityText += '}\n';
    }
    return entityText;
  }

  toArrayBuffer() {
    const version = 21;
    const headerSize = 8 + 64 * 16;
    const lumpData = {};

    const entityStr = this.generateEntities();
    lumpData[BSP_LUMPS.LUMP_ENTITIES] = new TextEncoder().encode(entityStr);

    const planeData = new ArrayBuffer(this.planes.length * 20);
    const planeView = new DataView(planeData);
    for (let i = 0; i < this.planes.length; i++) {
      const p = this.planes[i];
      const base = i * 20;
      planeView.setFloat32(base, p.normal.x, true);
      planeView.setFloat32(base + 4, p.normal.y, true);
      planeView.setFloat32(base + 8, p.normal.z, true);
      planeView.setFloat32(base + 12, p.distance, true);
      planeView.setUint32(base + 16, p.type, true);
    }
    lumpData[BSP_LUMPS.LUMP_PLANES] = new Uint8Array(planeData);

    const vertData = new ArrayBuffer(this.vertices.length * 12);
    const vertView = new DataView(vertData);
    for (let i = 0; i < this.vertices.length; i++) {
      const v = this.vertices[i];
      const base = i * 12;
      vertView.setFloat32(base, v.x, true);
      vertView.setFloat32(base + 4, v.y, true);
      vertView.setFloat32(base + 8, v.z, true);
    }
    lumpData[BSP_LUMPS.LUMP_VERTICES] = new Uint8Array(vertData);

    const edgeData = new ArrayBuffer(this.edges.length * 4);
    const edgeView = new DataView(edgeData);
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i];
      const base = i * 4;
      edgeView.setUint16(base, e.vertexIndex[0], true);
      edgeView.setUint16(base + 2, e.vertexIndex[1], true);
    }
    lumpData[BSP_LUMPS.LUMP_EDGES] = new Uint8Array(edgeData);

    const brushData = new ArrayBuffer(this.brushes.length * 20);
    const brushView = new DataView(brushData);
    for (let i = 0; i < this.brushes.length; i++) {
      const b = this.brushes[i];
      const base = i * 20;
      brushView.setUint32(base, b.firstSide, true);
      brushView.setUint32(base + 4, b.numSides, true);
      brushView.setUint32(base + 8, b.contents, true);
    }
    lumpData[BSP_LUMPS.LUMP_BRUSHES] = new Uint8Array(brushData);

    const brushSideData = new ArrayBuffer(this.brushSides.length * 8);
    const brushSideView = new DataView(brushSideData);
    for (let i = 0; i < this.brushSides.length; i++) {
      const s = this.brushSides[i];
      const base = i * 8;
      brushSideView.setUint32(base, s.planeIndex, true);
      brushSideView.setUint32(base + 4, s.texInfoIndex, true);
    }
    lumpData[BSP_LUMPS.LUMP_BRUSHSIDES] = new Uint8Array(brushSideData);

    const faceData = new ArrayBuffer(this.faces.length * 56);
    const faceView = new DataView(faceData);
    for (let i = 0; i < this.faces.length; i++) {
      const f = this.faces[i];
      const base = i * 56;
      faceView.setUint16(base, f.planenum, true);
      faceView.setUint8(base + 2, f.side);
      faceView.setInt32(base + 4, f.onNode, true);
      faceView.setUint32(base + 8, f.firstEdge, true);
      faceView.setInt16(base + 12, f.numEdges, true);
      faceView.setInt32(base + 16, f.texInfoIndex, true);
    }
    lumpData[BSP_LUMPS.LUMP_SURFACES] = new Uint8Array(faceData);

    let totalSize = headerSize;
    const lumpOffsets = [];
    for (let i = 0; i < 64; i++) {
      lumpOffsets.push(totalSize);
      const data = lumpData[i];
      totalSize += data ? data.length : 0;
    }

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    view.setUint32(0, 0x50534256, true);
    view.setUint32(4, version, true);

    for (let i = 0; i < 64; i++) {
      const offset = 8 + i * 16;
      const data = lumpData[i];
      view.setUint32(offset, lumpOffsets[i], true);
      view.setUint32(offset + 4, data ? data.length : 0, true);
      view.setUint32(offset + 8, 0, true);
      view.setUint32(offset + 12, 0, true);
    }

    const uint8 = new Uint8Array(buffer);
    for (let i = 0; i < 64; i++) {
      const data = lumpData[i];
      if (data) {
        uint8.set(data, lumpOffsets[i]);
      }
    }

    return buffer;
  }
}