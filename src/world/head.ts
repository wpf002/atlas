/**
 * A stylized head: one sphere pushed into a few large, smooth masses.
 *
 * The earlier version aimed at a realistic face — nostrils, a mouth crease,
 * lip swells. At this polygon count and texture size that lands in the uncanny
 * valley, so the sculpt here carries only what survives at distance: a soft
 * brow, a shallow eye dish, a single nose form, full cheeks, a rounded chin.
 * Eyes, brows and mouth are flat shapes laid on that surface rather than
 * modelled, which is what keeps the face readable instead of unsettling.
 */

import {
  BufferGeometry,
  Float32BufferAttribute,
  SphereGeometry,
  Vector3,
  type BufferAttribute,
} from 'three';
import type { HairStyle, SexTraits } from '../data/archetypes';
import { tileUv } from './rig';

/** Gaussian falloff. `w` is the distance at which the bump has faded to 1/e. */
function bump(d: number, w: number): number {
  const k = d / w;
  return Math.exp(-k * k);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Everything the skull, the hair and the face decals need to agree on. One
 * object so a brow cannot be laid onto a surface the head did not build.
 */
export interface Face {
  r: number;
  at: [number, number, number];
  /** Width against height. Below 1 narrows the skull. */
  narrow: number;
  /** How hard the jaw pulls in below the cheek. Higher is a pointier chin. */
  jaw: number;
  /** Brow ridge height. */
  brow: number;
  /** Cheek fullness. */
  cheek: number;
}

export function faceOf(r: number, at: [number, number, number], t: SexTraits): Face {
  return { r, at, narrow: t.narrow, jaw: t.jaw, brow: t.brow, cheek: t.cheek };
}

/** Unit directions on the skull the face shapes are laid onto. */
export const EYE_DIR: [number, number, number] = [0.33, -0.02, -0.9];
export const BROW_DIR: [number, number, number] = [0.33, 0.21, -0.88];
export const LIP_DIR: [number, number, number] = [0, -0.44, -0.9];

/**
 * Displacement along the radius for a unit direction on the skull. Positive
 * pushes out. Everything here is a broad mass. There is deliberately no eye
 * socket: a recess puts the eye in shadow, and a shadowed eye is the single
 * strongest cue that pushes a stylized face into the uncanny valley.
 */
function relief(x: number, y: number, z: number, f: Face): number {
  const front = smoothstep(0, 0.55, -z);
  const ax = Math.abs(x);
  let d = 0;

  // The faintest shelf above the eyes. Enough to break the forehead, not
  // enough to cast anything onto the eye below it.
  d += 0.016 * f.brow * bump(y - 0.22, 0.24) * bump(ax - 0.28, 0.34) * front;

  // Nose: a small button. No bridge ridge, no wings, no nostrils.
  d += 0.03 * bump(x, 0.12) * bump(y - 0.04, 0.22) * front;
  d += 0.055 * bump(x, 0.13) * bump(y + 0.16, 0.13) * front;

  // Full cheeks, and a chin that is round instead of blocked out.
  d += 0.055 * f.cheek * bump(ax - 0.4, 0.28) * bump(y + 0.12, 0.26) * smoothstep(-0.3, 0.45, -z);
  d += 0.04 * bump(y + 0.66, 0.26) * bump(ax, 0.3) * front;

  // Temples pull in; the back of the skull flattens a little.
  d -= 0.022 * bump(ax - 0.82, 0.2) * bump(y - 0.34, 0.26);
  d -= 0.03 * smoothstep(0.55, 1, z);

  return d;
}

/** The sculpted surface point for a unit direction, shared by every part. */
function project(v: Vector3, f: Face, swell: number): Vector3 {
  const { x, y, z } = v;
  v.multiplyScalar((1 + relief(x, y, z, f)) * swell);
  v.x *= f.narrow;
  v.y *= 1.04;
  v.z *= 0.99;
  // A large cranium over a small lower face. This proportion is what reads as
  // drawn rather than scanned, and it is doing more work than any single
  // feature to keep the head out of the uncanny valley at this fidelity.
  const dome = 1 + 0.09 * smoothstep(-0.15, 0.85, y);
  v.x *= dome;
  v.z *= dome;
  // Below the cheekbone the skull becomes a jaw, so it narrows front to back
  // as well as side to side.
  const below = Math.max(0, -y);
  const taper = 1 - f.jaw * Math.pow(below, 1.5);
  v.x *= taper;
  v.z *= taper;
  return v.multiplyScalar(f.r);
}

function shapeSkull(g: BufferGeometry, f: Face, swell: number) {
  const position = g.attributes.position as BufferAttribute;
  const v = new Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    project(v, f, swell);
    position.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
}

export function headGeometry(f: Face): BufferGeometry {
  const g = new SphereGeometry(1, 44, 34);
  shapeSkull(g, f, 1);
  tileUv(g);
  g.translate(...f.at);
  return g;
}

/** Cap volume and hairline tilt per style. A larger tilt lifts the hairline. */
const CAPS: Record<HairStyle, { swell: number; tilt: number }> = {
  crop: { swell: 1.06, tilt: 0.58 },
  swept: { swell: 1.12, tilt: 0.54 },
  bob: { swell: 1.1, tilt: 0.52 },
  long: { swell: 1.1, tilt: 0.52 },
  bun: { swell: 1.08, tilt: 0.56 },
};

/**
 * Hair that falls past the jaw, as a closed band swept around the back of the
 * head. The profile keeps its own radius instead of following the jaw taper,
 * so it hangs rather than shrink-wrapping the chin.
 */
const FALLS: Partial<Record<HairStyle, [number, number][]>> = {
  // [radius in head radii, height in head radii], outer edge first.
  bob: [[1.07, 0.5], [1.13, -0.3], [1.0, -1.08], [0.89, -1.02], [0.9, 0.46]],
  long: [[1.07, 0.5], [1.14, -0.45], [1.08, -1.92], [0.95, -1.86], [0.9, 0.46]],
  bun: [[1.06, 0.5], [1.09, -0.12], [1.0, -0.6], [0.92, -0.55], [0.9, 0.46]],
};

function sweep(f: Face, profile: [number, number][], gapHalf: number): BufferGeometry {
  // Azimuth zero faces +Z and the character faces -Z, so the gap the face
  // shows through is centred on PI.
  const start = Math.PI + gapHalf;
  const span = Math.PI * 2 - gapHalf * 2;
  const steps = 40;
  const position: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];

  for (let i = 0; i <= steps; i++) {
    const a = start + (i / steps) * span;
    const sin = Math.sin(a);
    const cos = Math.cos(a);
    // Azimuth zero is the back of the head, so this pulls the band in as it
    // comes round to the face. Without it the two ends hang beside the cheeks
    // as flat slabs instead of tapering into the hairline.
    const hug = 1 - 0.2 * (1 - cos) * 0.5;
    for (const [rad, h] of profile) {
      // The ends also stop short, so the hair does not end in a square cut.
      const drop = h < 0 ? 1 - 0.35 * (1 - cos) * 0.5 : 1;
      position.push(
        sin * rad * hug * f.narrow * f.r + f.at[0],
        h * drop * f.r + f.at[1],
        cos * rad * hug * f.r + f.at[2],
      );
      uv.push(a * f.r, h * f.r);
    }
  }
  const n = profile.length;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      const a = i * n + j;
      const b = i * n + k;
      const c = (i + 1) * n + j;
      const d = (i + 1) * n + k;
      index.push(a, c, d, a, d, b);
    }
  }

  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(position, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * Hair as the skull surface lifted a few millimetres and cut at a hairline,
 * plus whatever falls below it. A separate sphere either floats or lets the
 * crown poke through, so the cap is the same surface the head is.
 */
export function hairGeometry(f: Face, style: HairStyle): BufferGeometry[] {
  const { swell, tilt } = CAPS[style];
  const pieces: BufferGeometry[] = [skullCap(f, swell, tilt)];
  const fall = FALLS[style];
  if (fall) pieces.push(sweep(f, fall, 0.9));
  if (style === 'bun') {
    const knot = new SphereGeometry(f.r * 0.42, 16, 14);
    knot.scale(1, 0.86, 0.9);
    tileUv(knot);
    knot.translate(f.at[0], f.at[1] + f.r * 0.3, f.at[2] + f.r * 1.12);
    pieces.push(knot);
  }
  return pieces;
}

/**
 * The skull surface swelled and cut at an angle. Hair uses it, and so does a
 * fitted hat: a free sphere over a head this shape flares at the sides and
 * reads as a mushroom, however carefully it is placed.
 */
export function skullCap(f: Face, swell: number, tilt: number): BufferGeometry {
  const cap = new SphereGeometry(1, 36, 26, 0, Math.PI * 2, 0, Math.PI * 0.5);
  cap.rotateX(tilt);
  shapeSkull(cap, f, swell);
  tileUv(cap);
  cap.translate(...f.at);
  return cap;
}

export function earGeometry(r: number, at: [number, number, number], side: 1 | -1): BufferGeometry {
  const g = new SphereGeometry(r, 14, 12);
  const position = g.attributes.position as BufferAttribute;
  const v = new Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    // Thin front to back, taller than wide, and hollowed on the outer face.
    const cup = bump(Math.hypot(v.y / r + 0.1, v.z / r), 0.55);
    const thickness = 0.3 - 0.14 * cup * Math.max(0, v.x * side) / r;
    position.setXYZ(i, v.x * thickness, v.y * 1.25, v.z * 0.82);
  }
  g.computeVertexNormals();
  tileUv(g);
  g.translate(...at);
  return g;
}

/**
 * A shape lying on the skull surface. Eyes, brows and the mouth are all this:
 * a parametric patch laid out in a basis built around `center`, every sample
 * pushed onto the same surface the head uses, then lifted clear of it so the
 * layers stack without fighting.
 */
export function decalGeometry(opts: {
  f: Face;
  center: [number, number, number];
  across: number;
  down: number;
  lift: number;
  /** Half-height multiplier along the patch, u running -1..1. Rounds the ends. */
  shape?: (u: number) => number;
}): BufferGeometry {
  const { f, across, down, lift } = opts;
  const shape = opts.shape ?? ((u) => Math.sqrt(Math.max(0, 1 - u * u)));
  const c = new Vector3(...opts.center).normalize();
  const right = new Vector3().crossVectors(c, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, c).normalize();

  const nu = 26;
  const nv = 8;
  const position: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  const v = new Vector3();

  for (let i = 0; i <= nu; i++) {
    const u = (i / nu) * 2 - 1;
    const half = shape(u);
    for (let j = 0; j <= nv; j++) {
      const w = ((j / nv) * 2 - 1) * half;
      v.copy(c).addScaledVector(right, u * across).addScaledVector(up, w * down).normalize();
      project(v, f, 1 + lift);
      position.push(v.x + f.at[0], v.y + f.at[1], v.z + f.at[2]);
      uv.push((u + 1) * across * f.r, (w + 1) * down * f.r);
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j;
      const b = a + 1;
      const d = a + nv + 1;
      const e = d + 1;
      // Wound so the face normal points away from the skull.
      index.push(a, b, e, a, e, d);
    }
  }

  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(position, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
