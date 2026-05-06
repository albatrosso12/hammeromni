import * as THREE from 'three';
import { addObject as addStateObject, getState } from './state.js';
import { getScene } from './Renderer.js';

const defaultMaterial = new THREE.MeshStandardMaterial({
  color: 0x888888,
  roughness: 0.8,
  metalness: 0.1,
});

export function createCube(options = {}) {
  const geometry = new THREE.BoxGeometry(
    options.width || 64,
    options.height || 64,
    options.depth || 64
  );
  const mesh = new THREE.Mesh(geometry, defaultMaterial.clone());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(options.x || 0, options.y || 32, options.z || 0);

  const scene = getScene();
  scene.add(mesh);

  const obj = addStateObject({
    type: 'brush',
    name: 'Cube',
    mesh,
    texture: 'dev/dev_measuregray01a',
    ...options,
  });

  return obj;
}

export function createSphere(options = {}) {
  const geometry = new THREE.SphereGeometry(
    options.radius || 32,
    options.segments || 32,
    options.segments || 32
  );
  const mesh = new THREE.Mesh(geometry, defaultMaterial.clone());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(options.x || 0, options.y || 32, options.z || 0);

  const scene = getScene();
  scene.add(mesh);

  const obj = addStateObject({
    type: 'mesh',
    name: 'Sphere',
    mesh,
    ...options,
  });

  return obj;
}

export function createCylinder(options = {}) {
  const geometry = new THREE.CylinderGeometry(
    options.radiusTop || 32,
    options.radiusBottom || 32,
    options.height || 64,
    options.segments || 32
  );
  const mesh = new THREE.Mesh(geometry, defaultMaterial.clone());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(options.x || 0, options.y || 32, options.z || 0);

  const scene = getScene();
  scene.add(mesh);

  const obj = addStateObject({
    type: 'mesh',
    name: 'Cylinder',
    mesh,
    ...options,
  });

  return obj;
}

export function createPlane(options = {}) {
  const geometry = new THREE.PlaneGeometry(
    options.width || 64,
    options.height || 64
  );
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, defaultMaterial.clone());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(options.x || 0, options.y || 0, options.z || 0);

  const scene = getScene();
  scene.add(mesh);

  const obj = addStateObject({
    type: 'plane',
    name: 'Plane',
    mesh,
    ...options,
  });

  return obj;
}

export function createLight(options = {}) {
  const light = new THREE.PointLight(0xffffee, 1, 500);
  light.position.set(options.x || 0, options.y || 64, options.z || 0);
  light.castShadow = true;

  const scene = getScene();
  scene.add(light);

  const helper = new THREE.PointLightHelper(light, 10);
  scene.add(helper);

  const obj = addStateObject({
    type: 'light',
    name: 'PointLight',
    mesh: light,
    light,
    helper,
    ...options,
  });

  return obj;
}

export function createInfoPoint(options = {}) {
  const geometry = new THREE.OctahedronGeometry(8);
  const material = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00ff88,
    emissiveIntensity: 0.5,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(options.x || 0, options.y || 32, options.z || 0);

  const scene = getScene();
  scene.add(mesh);

  const obj = addStateObject({
    type: 'entity',
    name: 'info_point',
    mesh,
    ...options,
  });

  return obj;
}

export function addObject(type, options = {}) {
  switch (type) {
    case 'cube':
      return createCube(options);
    case 'sphere':
      return createSphere(options);
    case 'cylinder':
      return createCylinder(options);
    case 'plane':
      return createPlane(options);
    case 'light':
      return createLight(options);
    case 'info':
      return createInfoPoint(options);
    default:
      return createCube(options);
  }
}

export function captureObject(obj) {
  if (!obj || !obj.mesh) return null;

  const mesh = obj.mesh.clone();
  mesh.position.copy(obj.position);
  mesh.rotation.copy(obj.rotation);
  mesh.scale.copy(obj.scale);

  return {
    type: obj.type,
    name: obj.name,
    mesh,
    position: obj.position.clone(),
    rotation: obj.rotation.clone(),
    scale: obj.scale.clone(),
    texture: obj.texture,
  };
}