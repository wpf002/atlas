import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  SphereGeometry,
  type BufferAttribute,
  type Material,
} from 'three';

/**
 * Every geometry bakes its own world size into its UVs, so a 20m wall and a
 * 0.3m sill show the same grain rather than the same number of tiles. One UV
 * unit is one world unit; each surface sets its own tile density.
 */
const UV_PER_UNIT = 1;

/**
 * Geometry is cached on its dimensions. A campus of 15 districts and 40
 * characters reuses a small set of boxes, spheres and cylinders.
 */
const boxes = new Map<string, BoxGeometry>();
const spheres = new Map<string, SphereGeometry>();
const cylinders = new Map<string, CylinderGeometry>();

/** BoxGeometry lays out faces +x, -x, +y, -y, +z, -z, four vertices each. */
const BOX_FACE_SPAN: [number, number, number][] = [
  [2, 1, 0], [2, 1, 0], [0, 2, 0], [0, 2, 0], [0, 1, 0], [0, 1, 0],
];

function boxGeometry(w: number, h: number, d: number): BoxGeometry {
  const key = `${w},${h},${d}`;
  let g = boxes.get(key);
  if (!g) {
    g = new BoxGeometry(w, h, d);
    const dims = [w, h, d];
    const uv = g.attributes.uv as BufferAttribute;
    for (let f = 0; f < 6; f++) {
      const [ui, vi] = BOX_FACE_SPAN[f];
      const su = dims[ui] * UV_PER_UNIT;
      const sv = dims[vi] * UV_PER_UNIT;
      for (let i = f * 4; i < f * 4 + 4; i++) {
        uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
      }
    }
    uv.needsUpdate = true;
    boxes.set(key, g);
  }
  return g;
}

function sphereGeometry(r: number, segments: number): SphereGeometry {
  const key = `${r},${segments}`;
  let g = spheres.get(key);
  if (!g) {
    g = new SphereGeometry(r, segments, Math.max(6, Math.round(segments * 0.8)));
    scaleUv(g.attributes.uv as BufferAttribute, 2 * Math.PI * r, Math.PI * r);
    spheres.set(key, g);
  }
  return g;
}

function cylinderGeometry(rt: number, rb: number, h: number, segments: number): CylinderGeometry {
  const key = `${rt},${rb},${h},${segments}`;
  let g = cylinders.get(key);
  if (!g) {
    g = new CylinderGeometry(rt, rb, h, segments);
    scaleUv(g.attributes.uv as BufferAttribute, Math.PI * (rt + rb), h);
    cylinders.set(key, g);
  }
  return g;
}

function scaleUv(uv: BufferAttribute, spanU: number, spanV: number) {
  const su = spanU * UV_PER_UNIT;
  const sv = spanV * UV_PER_UNIT;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
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
