import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  SphereGeometry,
  type Material,
} from 'three';

/**
 * Geometry is cached on its dimensions. A campus of 15 districts and 40
 * characters reuses a small set of boxes, spheres and cylinders.
 */
const boxes = new Map<string, BoxGeometry>();
const spheres = new Map<string, SphereGeometry>();
const cylinders = new Map<string, CylinderGeometry>();

function boxGeometry(w: number, h: number, d: number): BoxGeometry {
  const key = `${w},${h},${d}`;
  let g = boxes.get(key);
  if (!g) {
    g = new BoxGeometry(w, h, d);
    boxes.set(key, g);
  }
  return g;
}

function sphereGeometry(r: number, segments: number): SphereGeometry {
  const key = `${r},${segments}`;
  let g = spheres.get(key);
  if (!g) {
    g = new SphereGeometry(r, segments, Math.max(6, Math.round(segments * 0.8)));
    spheres.set(key, g);
  }
  return g;
}

function cylinderGeometry(rt: number, rb: number, h: number, segments: number): CylinderGeometry {
  const key = `${rt},${rb},${h},${segments}`;
  let g = cylinders.get(key);
  if (!g) {
    g = new CylinderGeometry(rt, rb, h, segments);
    cylinders.set(key, g);
  }
  return g;
}

export function box(
  w: number,
  h: number,
  d: number,
  m: Material,
  x = 0,
  y = 0,
  z = 0,
  cast = true,
): Mesh {
  const mesh = new Mesh(boxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

export function ball(r: number, m: Material, x = 0, y = 0, z = 0, segments = 12): Mesh {
  const mesh = new Mesh(sphereGeometry(r, segments), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function cyl(
  rt: number,
  rb: number,
  h: number,
  m: Material,
  x = 0,
  y = 0,
  z = 0,
  segments = 12,
): Mesh {
  const mesh = new Mesh(cylinderGeometry(rt, rb, h, segments), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
