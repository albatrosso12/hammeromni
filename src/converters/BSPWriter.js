const BSP_LUMPS = {
  ENTITIES: 0,
  PLANES: 1,
  VERTEXES: 2,
  EDGES: 3,
  SURFEDGES: 4,
  FACES: 5,
  ORIGINALFACES: 8,
  BRUSHES: 18,
  BRUSHSIDES: 19,
  MODELS: 14,
  LIGHTING: 7,
  VISDATA: 10,
  LIGHTVOLS: 11,
  LEAFS: 9,
  LEAKFILE: 13,
  SCRATCH: 30,
};

class dheader_t {
  constructor() {
    this.ident = 0x50534249;
    this.version = 20;
    this.lumps = [];
  }
}

class lump_t {
  constructor() {
    this.fileofs = 0;
    this.filelen = 0;
    this.version = 0;
    this.un4 = 0;
  }
}

class dplane_t {
  constructor() {
    this.normal = new Float32Array(3);
    this.dist = 0;
    this.type = 0;
  }
}

class dvertex_t {
  constructor() {
    this.point = new Float32Array(3);
  }
}

class dedge_t {
  constructor() {
    this.v = [0, 0];
  }
}

class dface_t {
  constructor() {
    this.planenum = 0;
    this.side = 0;
    this.onNode = 0;
    this.firstedge = 0;
    this.numedges = 0;
    this.texinfo = 0;
    this.dispinfo = 0;
    this.surfaceFogVolumeID = 0;
    this.styles = [0, 0, 0, 0];
    this.lightofs = 0;
    this.area = 0;
    this.m = [0, 0, 0, 0];
    this.flags = 0;
  }
}

class dbrush_t {
  constructor() {
    this.firstside = 0;
    this.numsides = 0;
    this.contents = 0;
  }
}

class dbrushside_t {
  constructor() {
    this.planenum = 0;
    this.texinfo = 0;
    this.dispinfo = 0;
    this.bevel = 0;
  }
}

class dmodel_t {
  constructor() {
    this.mins = new Float32Array(3);
    this.maxs = new Float32Array(3);
    this.origin = new Float32Array(3);
    this.headnode = 0;
    this.firstface = 0;
    this.numfaces = 0;
  }
}

export class BSPWriter {
  constructor() {
    this.planes = [];
    this.vertexes = [];
    this.edges = [];
    this.surfEdges = [];
    this.faces = [];
    this.brushes = [];
    this.brushSides = [];
    this.models = [];
    this.entityData = '';
  }

  fromVMF(vmfData, options = {}) {
    this.reset();
    
    this.processWorld(vmfData.world);
    this.processEntities(vmfData.entities);
    this.createModel();
    
    console.log(`[BSP Writer] Создано: ${this.vertexes.length} вершин, ${this.faces.length} граней, ${this.brushes.length} брашей`);
    
    return this.toArrayBuffer();
  }

  reset() {
    this.planes = [];
    this.vertexes = [];
    this.edges = [];
    this.surfEdges = [];
    this.faces = [];
    this.brushes = [];
    this.brushSides = [];
    this.models = [];
    this.entityData = '';
  }

  processWorld(world) {
    if (!world || !world.brushes) return;

    for (const brush of world.brushes) {
      this.addBrush(brush);
    }
  }

  addBrush(brush) {
    const brushIdx = this.brushes.length;
    const brushObj = new dbrush_t();
    brushObj.firstside = this.brushSides.length;
    brushObj.numsides = brush.planes.length;
    brushObj.contents = 0;
    this.brushes.push(brushObj);

    for (const plane of brush.planes) {
      const planeIdx = this.addPlane(plane);
      const side = new dbrushside_t();
      side.planenum = planeIdx;
      side.texinfo = this.findOrAddTexinfo(plane.material || 'dev/dev_measuregray01a');
      this.brushSides.push(side);
    }
  }

  addPlane(planeData) {
    const normal = planeData.normal;
    const dist = planeData.distance;

    for (let i = 0; i < this.planes.length; i++) {
      const p = this.planes[i];
      if (Math.abs(p.normal[0] - normal.x) < 0.001 &&
          Math.abs(p.normal[1] - normal.y) < 0.001 &&
          Math.abs(p.normal[2] - normal.z) < 0.001 &&
          Math.abs(p.dist - dist) < 0.001) {
        return i;
      }
    }

    const plane = new dplane_t();
    plane.normal[0] = normal.x;
    plane.normal[1] = normal.y;
    plane.normal[2] = normal.z;
    plane.dist = dist;
    plane.type = this.getPlaneType(normal);

    this.planes.push(plane);
    return this.planes.length - 1;
  }

  getPlaneType(normal) {
    const ax = Math.abs(normal.x);
    const ay = Math.abs(normal.y);
    const az = Math.abs(normal.z);

    if (ax > ay && ax > az) return 0;
    if (ay > ax && ay > az) return 1;
    if (az > ax && az > ay) return 2;
    return 0;
  }

  addFace(brushIdx, planeIdx, planeData, material) {
    const face = new dface_t();
    face.planenum = planeIdx;
    face.onNode = 0;
    face.firstedge = this.surfEdges.length;
    face.texinfo = this.findOrAddTexinfo(material);
    face.area = 0;
    face.flags = 0;

    const faceVertices = this.computeFaceVertices(brushIdx, planeIdx);
    if (faceVertices.length < 3) return;

    for (let i = 0; i < faceVertices.length; i++) {
      const v1 = faceVertices[i];
      const v2 = faceVertices[(i + 1) % faceVertices.length];

      const v1Idx = this.addVertex(v1);
      const v2Idx = this.addVertex(v2);

      const edgeIdx = this.addEdge(v1Idx, v2Idx);
      this.surfEdges.push(edgeIdx);
    }

    face.numedges = faceVertices.length;
    this.faces.push(face);
  }

  computeFaceVertices(brushIdx, planeIdx) {
    const brush = this.brushes[brushIdx];
    if (!brush) return [];

    const plane = this.planes[planeIdx];
    if (!plane) return [];

    const brushPlanes = [];
    for (let i = 0; i < brush.numsides; i++) {
      const side = this.brushSides[brush.firstside + i];
      brushPlanes.push(this.planes[side.planenum]);
    }

    const vertices = [];
    const eps = 0.01;

    for (let i = 0; i < brushPlanes.length; i++) {
      for (let j = i + 1; j < brushPlanes.length; j++) {
        for (let k = j + 1; k < brushPlanes.length; k++) {
          const p1 = brushPlanes[i];
          const p2 = brushPlanes[j];
          const p3 = brushPlanes[k];

          const v = this.intersectThreePlanes(p1, p2, p3);
          if (!v) continue;

          let onPlane = true;
          for (let m = 0; m < brushPlanes.length; m++) {
            if (m === i || m === j || m === k) continue;
            const p = brushPlanes[m];
            const dist = p.normal[0] * v[0] + p.normal[1] * v[1] + p.normal[2] * v[2] - p.dist;
            if (dist > eps) {
              onPlane = false;
              break;
            }
          }

          if (onPlane) {
            let exists = false;
            for (const existing of vertices) {
              if (Math.abs(existing[0] - v[0]) < eps &&
                  Math.abs(existing[1] - v[1]) < eps &&
                  Math.abs(existing[2] - v[2]) < eps) {
                exists = true;
                break;
              }
            }
            if (!exists) vertices.push(v);
          }
        }
      }
    }

    if (vertices.length < 3) return [];

    const center = [0, 0, 0];
    for (const v of vertices) {
      center[0] += v[0];
      center[1] += v[1];
      center[2] += v[2];
    }
    center[0] /= vertices.length;
    center[1] /= vertices.length;
    center[2] /= vertices.length;

    const facePlane = this.planes[planeIdx];
    const axis = Math.abs(facePlane.normal[2]) > 0.9 ? 0 : (Math.abs(facePlane.normal[0]) > 0.9 ? 1 : 2);
    const ax = axis;
    const ay = (axis + 1) % 3;

    vertices.sort((a, b) => {
      const angA = Math.atan2(a[ay] - center[ay], a[ax] - center[ax]);
      const angB = Math.atan2(b[ay] - center[ay], b[ax] - center[ax]);
      return angA - angB;
    });

    return vertices;
  }

  intersectThreePlanes(p1, p2, p3) {
    const n1 = p1.normal;
    const n2 = p2.normal;
    const n3 = p3.normal;

    const det = n1[0] * (n2[1] * n3[2] - n2[2] * n3[1]) -
                n1[1] * (n2[0] * n3[2] - n2[2] * n3[0]) +
                n1[2] * (n2[0] * n3[1] - n2[1] * n3[0]);

    if (Math.abs(det) < 0.0001) return null;

    const d1 = -p1.dist;
    const d2 = -p2.dist;
    const d3 = -p3.dist;

    const x = (d1 * (n2[1] * n3[2] - n2[2] * n3[1]) -
               d2 * (n1[1] * n3[2] - n1[2] * n3[1]) +
               d3 * (n1[1] * n2[2] - n1[2] * n2[1])) / det;

    const y = (d1 * (n2[0] * n3[2] - n2[2] * n3[0]) -
               d2 * (n1[0] * n3[2] - n1[2] * n3[0]) +
               d3 * (n1[0] * n2[2] - n1[2] * n2[0])) / -det;

    const z = (d1 * (n2[0] * n3[1] - n2[1] * n3[0]) -
               d2 * (n1[0] * n3[1] - n1[1] * n3[0]) +
               d3 * (n1[0] * n2[1] - n1[1] * n2[0])) / det;

    return [x, y, z];
  }

  addVertex(point) {
    for (let i = 0; i < this.vertexes.length; i++) {
      const v = this.vertexes[i];
      if (Math.abs(v.point[0] - point[0]) < 0.01 &&
          Math.abs(v.point[1] - point[1]) < 0.01 &&
          Math.abs(v.point[2] - point[2]) < 0.01) {
        return i;
      }
    }

    const vert = new dvertex_t();
    vert.point[0] = point[0];
    vert.point[1] = point[1];
    vert.point[2] = point[2];
    this.vertexes.push(vert);
    return this.vertexes.length - 1;
  }

  addEdge(v1, v2) {
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i];
      if ((e.v[0] === v1 && e.v[1] === v2) || (e.v[0] === v2 && e.v[1] === v1)) {
        return i;
      }
    }

    const edge = new dedge_t();
    edge.v[0] = v1;
    edge.v[1] = v2;
    this.edges.push(edge);
    return this.edges.length - 1;
  }

  findOrAddTexinfo(material) {
    return 0;
  }

  processEntities(entities) {
    this.entityData = '';
    this.entityData += '{\n';
    this.entityData += '"world"\n';
    this.entityData += '{\n';

    for (const entity of entities) {
      this.entityData += '{\n';
      for (const [key, value] of Object.entries(entity.properties)) {
        if (value) {
          this.entityData += `"${key}" "${value}"\n`;
        }
      }
      this.entityData += '}\n';
    }

    this.entityData += '}\n';
    this.entityData += '}\n';
  }

  createModel() {
    const model = new dmodel_t();

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const v of this.vertexes) {
      minX = Math.min(minX, v.point[0]);
      minY = Math.min(minY, v.point[1]);
      minZ = Math.min(minZ, v.point[2]);
      maxX = Math.max(maxX, v.point[0]);
      maxY = Math.max(maxY, v.point[1]);
      maxZ = Math.max(maxZ, v.point[2]);
    }

    if (this.vertexes.length === 0) {
      minX = minY = minZ = 0;
      maxX = maxY = maxZ = 0;
    }

    model.mins[0] = minX;
    model.mins[1] = minY;
    model.mins[2] = minZ;
    model.maxs[0] = maxX;
    model.maxs[1] = maxY;
    model.maxs[2] = maxZ;
    model.headnode = 0;
    model.firstface = 0;
    model.numfaces = this.faces.length;

    this.models.push(model);
  }

  toArrayBuffer() {
    const headerSize = 8 + 20 * 4;
    const lumpData = {};
    const lumpOrder = [
      'ENTITIES', 'PLANES', 'VERTEXES', 'EDGES', 'SURFEDGES',
      'FACES', 'ORIGINALFACES', 'LIGHTING', 'LEAFS', 'LEAKFILE',
      'BRUSHES', 'BRUSHSIDES', 'MODELS', 'VISDATA', 'LIGHTVOLS'
    ];

    const dataArrays = [
      new TextEncoder().encode(this.entityData),
      this.planes,
      this.vertexes,
      this.edges,
      new Int32Array(this.surfEdges),
      this.faces,
      this.faces,
      new Uint8Array(this.vertexes.length * 8),
      [],
      new TextEncoder().encode(''),
      this.brushes,
      this.brushSides,
      this.models,
      new Uint8Array([0, 0, 0, 0]),
      new Uint8Array(0)
    ];

    let offset = headerSize;
    for (let i = 0; i < lumpOrder.length; i++) {
      const data = dataArrays[i];
      const size = data.length || 0;
      lumpData[lumpOrder[i]] = { offset, size };
      offset += size;
    }

    const buffer = new ArrayBuffer(offset);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    view.setUint32(0, 0x50534249, true);
    view.setUint32(4, 20, true);

    const lumpNames = [
      'ENTITIES', 'PLANES', 'VERTEXES', 'EDGES', 'SURFEDGES',
      'FACES', 'ORIGINALFACES', 'LIGHTING', 'LEAFS', 'LEAKFILE',
      'BRUSHES', 'BRUSHSIDES', 'MODELS', 'VISDATA', 'LIGHTVOLS'
    ];

    for (let i = 0; i < lumpNames.length; i++) {
      const lump = lumpData[lumpNames[i]];
      const base = 8 + i * 16;
      view.setUint32(base, lump.offset, true);
      view.setUint32(base + 4, lump.size, true);
      view.setUint32(base + 8, 0, true);
      view.setUint32(base + 12, 0, true);
    }

    let pos = lumpData['ENTITIES'].offset;
    bytes.set(dataArrays[0], pos);

    pos = lumpData['PLANES'].offset;
    for (const p of this.planes) {
      view.setFloat32(pos, p.normal[0], true); pos += 4;
      view.setFloat32(pos, p.normal[1], true); pos += 4;
      view.setFloat32(pos, p.normal[2], true); pos += 4;
      view.setFloat32(pos, p.dist, true); pos += 4;
      view.setUint32(pos, p.type, true); pos += 4;
    }

    pos = lumpData['VERTEXES'].offset;
    for (const v of this.vertexes) {
      view.setFloat32(pos, v.point[0], true); pos += 4;
      view.setFloat32(pos, v.point[1], true); pos += 4;
      view.setFloat32(pos, v.point[2], true); pos += 4;
    }

    pos = lumpData['EDGES'].offset;
    for (const e of this.edges) {
      view.setUint16(pos, e.v[0], true); pos += 2;
      view.setUint16(pos, e.v[1], true); pos += 2;
    }

    pos = lumpData['SURFEDGES'].offset;
    const surfEdges = new Int32Array(buffer, pos, this.surfEdges.length);
    surfEdges.set(this.surfEdges);

    pos = lumpData['FACES'].offset;
    for (const f of this.faces) {
      view.setUint32(pos, f.planenum, true); pos += 4;
      view.setUint8(pos, f.side, true); pos += 1;
      view.setUint8(pos, f.onNode, true); pos += 1;
      view.setUint16(pos, 0, true); pos += 2;
      view.setUint32(pos, f.firstedge, true); pos += 4;
      view.setUint16(pos, f.numedges, true); pos += 2;
      view.setUint16(pos, f.texinfo, true); pos += 2;
      pos += 8;
      view.setUint32(pos, f.area, true); pos += 4;
      pos += 16;
      view.setUint32(pos, f.flags, true); pos += 4;
    }

    pos = lumpData['BRUSHES'].offset;
    for (const b of this.brushes) {
      view.setUint32(pos, b.firstside, true); pos += 4;
      view.setUint32(pos, b.numsides, true); pos += 4;
      view.setUint32(pos, b.contents, true); pos += 4;
    }

    pos = lumpData['BRUSHSIDES'].offset;
    for (const s of this.brushSides) {
      view.setUint32(pos, s.planenum, true); pos += 4;
      view.setUint32(pos, s.texinfo, true); pos += 4;
      pos += 8;
    }

    pos = lumpData['MODELS'].offset;
    for (const m of this.models) {
      view.setFloat32(pos, m.mins[0], true); pos += 4;
      view.setFloat32(pos, m.mins[1], true); pos += 4;
      view.setFloat32(pos, m.mins[2], true); pos += 4;
      view.setFloat32(pos, m.maxs[0], true); pos += 4;
      view.setFloat32(pos, m.maxs[1], true); pos += 4;
      view.setFloat32(pos, m.maxs[2], true); pos += 4;
      view.setFloat32(pos, m.origin[0], true); pos += 4;
      view.setFloat32(pos, m.origin[1], true); pos += 4;
      view.setFloat32(pos, m.origin[2], true); pos += 4;
      view.setUint32(pos, m.headnode, true); pos += 4;
      view.setUint32(pos, m.firstface, true); pos += 4;
      view.setUint32(pos, m.numfaces, true); pos += 4;
    }

    return buffer;
  }
}

export function createBSPFromVMF(vmfData, options = {}) {
  const writer = new BSPWriter();
  return writer.fromVMF(vmfData, options);
}