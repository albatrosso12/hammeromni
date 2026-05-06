import * as THREE from 'three';

export class VMFParser {
  constructor() {
    this.world = null;
    this.entities = [];
    this.containers = [];
  }

  parse(text) {
    this.containers = [];
    this.entities = [];
    this.world = null;

    const lines = text.split(/\r?\n/);
    let currentContainer = null;
    let braceStack = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line || line.startsWith('//')) continue;

      if (line === '{') {
        if (braceStack.length === 0) {
          currentContainer = this.createNewContainer();
          this.containers.push(currentContainer);
        } else {
          const parent = braceStack[braceStack.length - 1];
          if (parent.properties) {
            if (!parent.children) parent.children = [];
            const childContainer = this.createNewContainer();
            parent.children.push(childContainer);
            currentContainer = childContainer;
            this.containers.push(currentContainer);
          }
        }
        braceStack.push(currentContainer);
      } else if (line === '}') {
        braceStack.pop();
        if (braceStack.length > 0) {
          currentContainer = braceStack[braceStack.length - 1];
        } else {
          currentContainer = null;
        }
      } else if (currentContainer) {
        const match = line.match(/^"([^"]+)"\s+"([^"]*)"$/);
        if (match) {
          currentContainer.properties[match[1]] = match[2];
        }
      }
    }

    const worldContainer = this.containers.find(c => c.properties.classname === 'world');
    if (worldContainer) {
      this.world = this.parseWorld(worldContainer);
    }

    this.entities = this.containers
      .filter(c => c.properties.classname && c.properties.classname !== 'world')
      .map(c => this.parseEntity(c));

    return { world: this.world, entities: this.entities };
  }

  createNewContainer() {
    return { properties: {}, children: [] };
  }

  parseWorld(container) {
    const brushes = [];

    const solidChildren = container.children?.filter(c => 
      c.properties.classname === 'brush' || 
      (c.properties.sides && !c.properties.classname)
    ) || [];

    for (const solid of solidChildren) {
      const sides = solid.children?.filter(c => c.properties) || [];
      const planeData = [];

      for (const side of sides) {
        const plane = this.parsePlane(side.properties);
        if (plane) planeData.push(plane);
      }

      if (planeData.length >= 4) {
        brushes.push({
          planes: planeData,
          material: sides[0]?.properties?.material || 'dev/dev_measuregray01a'
        });
      }
    }

    return {
      properties: { ...container.properties },
      brushes
    };
  }

  parsePlane(props) {
    const ux = parseFloat(props.plane_uaxis_x || props.uvw_rotation_0 || 0);
    const uy = parseFloat(props.plane_uaxis_y || props.uvw_rotation_1 || 0);
    const uz = parseFloat(props.plane_uaxis_z || props.uvw_rotation_2 || 0);

    const vx = parseFloat(props.plane_vaxis_x || props.uvw_rotation_3 || 0);
    const vy = parseFloat(props.plane_vaxis_y || props.uvw_rotation_4 || 0);
    const vz = parseFloat(props.plane_vaxis_z || props.uvw_rotation_5 || 0);

    const origin = props.origin?.split(' ').map(Number) || [0, 0, 0];

    const normal = this.calculateNormal(ux, uy, uz, vx, vy, vz);
    const distance = -(normal.x * origin[0] + normal.y * origin[1] + normal.z * origin[2]);

    return {
      normal,
      distance,
      material: props.material || 'dev/dev_measuregray01a',
      uaxis: { x: ux, y: uy, z: uz, offset: parseFloat(props.uvw_offset_u || 0) },
      vaxis: { x: vx, y: vy, z: vz, offset: parseFloat(props.uvw_offset_v || 0) },
      rotation: parseFloat(props.uvw_rotation || 0),
      scale: {
        u: parseFloat(props.uvw_scale_u || 1),
        v: parseFloat(props.uvw_scale_v || 1)
      }
    };
  }

  calculateNormal(ux, uy, uz, vx, vy, vz) {
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len < 0.0001) return { x: 0, y: 1, z: 0 };
    return { x: nx / len, y: ny / len, z: nz / len };
  }

  parseEntity(container) {
    return {
      properties: { ...container.properties },
      position: container.properties.origin 
        ? container.properties.origin.split(' ').map(Number) 
        : [0, 0, 0],
      angles: container.properties.angles 
        ? container.properties.angles.split(' ').map(Number) 
        : [0, 0, 0]
    };
  }

  toBrushes() {
    const brushes = [];
    if (!this.world) return brushes;

    for (const brush of this.world.brushes) {
      const geometry = this.createGeometryFromPlanes(brush.planes);
      if (geometry) {
        brushes.push({
          geometry,
          material: brush.material,
          position: [0, 0, 0],
          rotation: [0, 0, 0]
        });
      }
    }

    return brushes;
  }

  createGeometryFromPlanes(planes) {
    try {
      const vertices = [];
      const epsilon = 0.001;

      for (let i = 0; i < planes.length; i++) {
        for (let j = i + 1; j < planes.length; j++) {
          for (let k = j + 1; k < planes.length; k++) {
            const p1 = planes[i];
            const p2 = planes[j];
            const p3 = planes[k];

            const normal1 = p1.normal;
            const normal2 = p2.normal;
            const normal3 = p3.normal;

            const det = this.det3(
              normal1.x, normal1.y, normal1.z,
              normal2.x, normal2.y, normal2.z,
              normal3.x, normal3.y, normal3.z
            );

            if (Math.abs(det) < epsilon) continue;

            const A = this.det3(
              -p1.distance, normal1.y, normal1.z,
              -p2.distance, normal2.y, normal2.z,
              -p3.distance, normal3.y, normal3.z
            ) / det;
            const B = this.det3(
              normal1.x, -p1.distance, normal1.z,
              normal2.x, -p2.distance, normal2.z,
              normal3.x, -p3.distance, normal3.z
            ) / det;
            const C = this.det3(
              normal1.x, normal1.y, -p1.distance,
              normal2.x, normal2.y, -p2.distance,
              normal3.x, normal3.y, -p3.distance
            ) / det;

            const v = new THREE.Vector3(A, B, C);

            let onSurface = true;
            for (const plane of planes) {
              const dist = v.x * plane.normal.x + v.y * plane.normal.y + v.z * plane.normal.z - plane.distance;
              if (dist > epsilon) {
                onSurface = false;
                break;
              }
            }

            if (onSurface) {
              let exists = false;
              for (const existing of vertices) {
                if (existing.distanceTo(v) < epsilon) {
                  exists = true;
                  break;
                }
              }
              if (!exists) vertices.push(v);
            }
          }
        }
      }

      if (vertices.length < 4) return null;

      const faces = [];
      for (const plane of planes) {
        const faceVertices = [];
        for (const v of vertices) {
          const dist = v.x * plane.normal.x + v.y * plane.normal.y + v.z * plane.normal.z - plane.distance;
          if (Math.abs(dist) < epsilon) {
            faceVertices.push(v);
          }
        }

        if (faceVertices.length >= 3) {
          const center = new THREE.Vector3();
          for (const v of faceVertices) center.add(v);
          center.divideScalar(faceVertices.length);

          faceVertices.sort((a, b) => {
            const angleA = Math.atan2(a.z - center.z, a.x - center.x);
            const angleB = Math.atan2(b.z - center.z, b.x - center.x);
            return angleA - angleB;
          });

          faces.push({
            vertices: faceVertices,
            material: plane.material,
            normal: plane.normal,
            uaxis: plane.uaxis,
            vaxis: plane.vaxis,
            scale: plane.scale,
            rotation: plane.rotation
          });
        }
      }

      if (faces.length < 4) return null;

      const indices = [];
      const positions = [];
      const normals = [];
      const uvs = [];

      for (const face of faces) {
        const baseIndex = positions.length / 3;
        for (const v of face.vertices) {
          positions.push(v.x, v.y, v.z);
          normals.push(face.normal.x, face.normal.y, face.normal.z);

          const u = (v.x * face.uaxis.x + v.y * face.uaxis.y + v.z * face.uaxis.z + face.uaxis.offset) * face.scale.u;
          const v2 = (v.x * face.vaxis.x + v.y * face.vaxis.y + v.z * face.vaxis.z + face.vaxis.offset) * face.scale.v;
          uvs.push(u, v2);
        }

        for (let i = 1; i < face.vertices.length - 1; i++) {
          indices.push(baseIndex, baseIndex + i, baseIndex + i + 1);
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);

      return geometry;
    } catch (e) {
      console.error('Failed to create geometry from planes:', e);
      return null;
    }
  }

  det3(a1, a2, a3, b1, b2, b3, c1, c2, c3) {
    return a1 * (b2 * c3 - b3 * c2) - a2 * (b1 * c3 - b3 * c1) + a3 * (b1 * c2 - b2 * c1);
  }
}

export function generateVMF(objects, entities = []) {
  const lines = [];
  const version = 'VMF_Version01';
  lines.push(version);

  lines.push('world');
  lines.push('{');
  lines.push('"id" "1"');
  lines.push('"classname" "world"');
  lines.push('"skyname" "sky"');
  lines.push('"fogcolor" "0 0 0"');
  lines.push('"fogstart" "500"');
  lines.push('"fogend" "2000"');

  let brushId = 1;
  for (const obj of objects) {
    if (obj.type !== 'brush') continue;
    lines.push(`"${brushId}"`);
    lines.push('{');
    lines.push('"classname" "brush"');

    const mesh = obj.mesh;
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;

    const planes = extractPlanesFromGeometry(geo, obj.texture || 'dev/dev_measuregray01a');
    for (const plane of planes) {
      lines.push('{');
      for (const [key, value] of Object.entries(plane)) {
        lines.push(`"${key}" "${value}"`);
      }
      lines.push('}');
    }

    lines.push('}');
    brushId++;
  }
  lines.push('}');

  for (const entity of entities) {
    lines.push('"ent"');
    lines.push('{');
    for (const [key, value] of Object.entries(entity.properties)) {
      lines.push(`"${key}" "${value}"`);
    }
    lines.push('}');
  }

  lines.push('EOF');
  return lines.join('\n');
}

function extractPlanesFromGeometry(geometry, material) {
  const planes = [];
  const pos = geometry.attributes.position;
  const norm = geometry.attributes.normal;
  const idx = geometry.index;

  if (!idx) {
    const vertexCount = pos.count;
    const faceCount = Math.floor(vertexCount / 3);
    for (let f = 0; f < faceCount; f++) {
      const i0 = f * 3;
      const v0 = new THREE.Vector3(pos.getX(i0), pos.getY(i0), pos.getZ(i0));
      const v1 = new THREE.Vector3(pos.getX(i0 + 1), pos.getY(i0 + 1), pos.getZ(i0 + 1));
      const v2 = new THREE.Vector3(pos.getX(i0 + 2), pos.getY(i0 + 2), pos.getZ(i0 + 2));

      const n = new THREE.Vector3(norm.getX(i0), norm.getY(i0), norm.getZ(i0));
      const d = -(n.x * v0.x + n.y * v0.y + n.z * v0.z);

      const uVec = new THREE.Vector3().subVectors(v1, v0).normalize();
      const vVec = new THREE.Vector3().crossVectors(n, uVec).normalize();

      planes.push({
        plane: `${v0.x.toFixed(4)} ${v0.y.toFixed(4)} ${v0.z.toFixed(4)}`,
        normal: `${n.x.toFixed(4)} ${n.y.toFixed(4)} ${n.z.toFixed(4)}`,
        dist: d.toFixed(4),
        material: material,
        plane_uaxis_x: uVec.x.toFixed(4),
        plane_uaxis_y: uVec.y.toFixed(4),
        plane_uaxis_z: uVec.z.toFixed(4),
        plane_vaxis_x: vVec.x.toFixed(4),
        plane_vaxis_y: vVec.y.toFixed(4),
        plane_vaxis_z: vVec.z.toFixed(4),
        uvw_offset_u: 0,
        uvw_offset_v: 0,
        uvw_scale_u: 1,
        uvw_scale_v: 1,
        uvw_rotation: 0
      });
    }
  } else {
    const processed = new Set();
    for (let i = 0; i < idx.count; i += 3) {
      const i0 = idx.getX(i);
      const i1 = idx.getX(i + 1);
      const i2 = idx.getX(i + 2);

      const key = `${Math.min(i0,i1,i2)}-${Math.max(i0,i1,i2)}`;
      if (processed.has(key)) continue;
      processed.add(key);

      const v0 = new THREE.Vector3(pos.getX(i0), pos.getY(i0), pos.getZ(i0));
      const v1 = new THREE.Vector3(pos.getX(i1), pos.getY(i1), pos.getZ(i1));
      const v2 = new THREE.Vector3(pos.getX(i2), pos.getY(i2), pos.getZ(i2));

      const edge1 = new THREE.Vector3().subVectors(v1, v0);
      const edge2 = new THREE.Vector3().subVectors(v2, v0);
      const n = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
      const d = -(n.x * v0.x + n.y * v0.y + n.z * v0.z);

      const uVec = edge1.clone().normalize();
      const vVec = new THREE.Vector3().crossVectors(n, uVec).normalize();

      planes.push({
        plane: `${v0.x.toFixed(4)} ${v0.y.toFixed(4)} ${v0.z.toFixed(4)}`,
        normal: `${n.x.toFixed(4)} ${n.y.toFixed(4)} ${n.z.toFixed(4)}`,
        dist: d.toFixed(4),
        material: material,
        plane_uaxis_x: uVec.x.toFixed(4),
        plane_uaxis_y: uVec.y.toFixed(4),
        plane_uaxis_z: uVec.z.toFixed(4),
        plane_vaxis_x: vVec.x.toFixed(4),
        plane_vaxis_y: vVec.y.toFixed(4),
        plane_vaxis_z: vVec.z.toFixed(4),
        uvw_offset_u: 0,
        uvw_offset_v: 0,
        uvw_scale_u: 1,
        uvw_scale_v: 1,
        uvw_rotation: 0
      });
    }
  }

  return planes;
}