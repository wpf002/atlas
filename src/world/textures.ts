/**
 * Procedural surface detail. Every material in the campus used to be one flat
 * colour, which reads as unfinished the moment the camera gets closer than a
 * few metres. These recipes paint an albedo variation, a height field and a
 * roughness field into canvases, then derive a tangent-space normal map from
 * the height so the lighting has something to catch.
 *
 * Everything tiles: the value-noise lattice wraps at its period, and every
 * trigonometric term uses an integer frequency.
 */

import {
  CanvasTexture,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';

export type SurfaceKind =
  | 'fabric'
  | 'wool'
  | 'leather'
  | 'skin'
  | 'hair'
  | 'stone'
  | 'concrete'
  | 'paving'
  | 'asphalt'
  | 'wood'
  | 'metal'
  | 'foliage'
  | 'plaster';

export interface SurfaceMaps {
  map: Texture;
  normalMap: Texture;
  roughnessMap: Texture;
  /** Normal strength, tuned per surface. */
  normalScale: number;
}

const SIZE = 256;
const TAU = Math.PI * 2;

/* ---------- tileable value noise ---------- */

function lattice(xi: number, yi: number, px: number, py: number, seed: number): number {
  const x = ((xi % px) + px) % px;
  const y = ((yi % py) + py) % py;
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise(x: number, y: number, px: number, py: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = lattice(xi, yi, px, py, seed);
  const b = lattice(xi + 1, yi, px, py, seed);
  const c = lattice(xi, yi + 1, px, py, seed);
  const d = lattice(xi + 1, yi + 1, px, py, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

function fbm(x: number, y: number, px: number, py: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const f = 1 << o;
    sum += amp * noise(x * f, y * f, px * f, py * f, seed + o * 31);
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

/* ---------- recipes ---------- */

/** A recipe returns [height, albedo] in roughly 0..1 for one texel. */
type Recipe = (u: number, v: number) => [number, number];

interface SurfaceSpec {
  recipe: Recipe;
  /** Normal map strength. */
  bump: number;
  /** How far the height field pushes roughness either side of the base value. */
  roughSpan: number;
  /**
   * Tiles per world unit. UVs carry world size, so this alone decides how big
   * the grain reads. One unit is about 0.65m: a person is three units tall and
   * a storey is 4.2.
   */
  tiles: number;
}

const SPECS: Record<SurfaceKind, SurfaceSpec> = {
  fabric: {
    bump: 1.1, roughSpan: -0.18, tiles: 5,
    recipe: (u, v) => {
      const weave = Math.sin(u * 72 * TAU) * Math.sin(v * 72 * TAU);
      const slub = fbm(u * 9, v * 9, 9, 9, 3, 11);
      return [0.5 + weave * 0.22 + (slub - 0.5) * 0.3, 0.92 + (slub - 0.5) * 0.17 + weave * 0.04];
    },
  },
  wool: {
    bump: 1.5, roughSpan: -0.12, tiles: 4,
    recipe: (u, v) => {
      const loop = Math.sin((u * 28 + Math.sin(v * 28 * TAU) * 0.14) * TAU);
      const n = fbm(u * 7, v * 7, 7, 7, 4, 23);
      return [0.5 + loop * 0.16 + (n - 0.5) * 0.6, 0.9 + (n - 0.5) * 0.24 + loop * 0.04];
    },
  },
  leather: {
    bump: 1.3, roughSpan: -0.22, tiles: 13,
    recipe: (u, v) => {
      const pebble = fbm(u * 16, v * 16, 16, 16, 3, 37);
      const fine = fbm(u * 48, v * 48, 48, 48, 2, 41);
      return [0.5 + (pebble - 0.5) * 0.85 + (fine - 0.5) * 0.25, 0.9 + (pebble - 0.5) * 0.2];
    },
  },
  skin: {
    bump: 0.45, roughSpan: -0.1, tiles: 8,
    recipe: (u, v) => {
      const pore = fbm(u * 80, v * 80, 80, 80, 2, 53);
      const mottle = fbm(u * 6, v * 6, 6, 6, 3, 59);
      return [0.5 + (pore - 0.5) * 0.5, 0.96 + (mottle - 0.5) * 0.11 + (pore - 0.5) * 0.04];
    },
  },
  hair: {
    bump: 1.6, roughSpan: -0.2, tiles: 4.5,
    recipe: (u, v) => {
      const strand = noise(u * 96, v * 6, 96, 6, 67);
      const clump = fbm(u * 32, v * 5, 32, 5, 3, 71);
      return [0.5 + (strand - 0.5) * 0.75 + (clump - 0.5) * 0.3, 0.86 + (strand - 0.5) * 0.28];
    },
  },
  stone: {
    bump: 0.9, roughSpan: -0.1, tiles: 2,
    recipe: (u, v) => {
      const grain = fbm(u * 11, v * 11, 11, 11, 5, 79);
      const fleck = fbm(u * 52, v * 52, 52, 52, 2, 83);
      return [0.5 + (grain - 0.5) * 0.45 + (fleck - 0.5) * 0.2, 0.93 + (grain - 0.5) * 0.15];
    },
  },
  concrete: {
    bump: 0.8, roughSpan: -0.1, tiles: 2,
    recipe: (u, v) => {
      const n = fbm(u * 17, v * 17, 17, 17, 4, 89);
      const pit = fbm(u * 58, v * 58, 58, 58, 2, 97);
      const hole = pit > 0.78 ? 0.4 : 0;
      return [0.5 + (n - 0.5) * 0.35 - hole, 0.92 + (n - 0.5) * 0.13 - hole * 0.2];
    },
  },
  paving: {
    bump: 1.8, roughSpan: -0.12, tiles: 0.27,
    recipe: (u, v) => {
      const cells = 4;
      const cu = u * cells;
      const cv = v * cells;
      const fu = cu - Math.floor(cu);
      const fv = cv - Math.floor(cv);
      const edge = Math.min(fu, 1 - fu, fv, 1 - fv);
      const joint = edge < 0.03 ? 1 : 0;
      const id = lattice(Math.floor(cu), Math.floor(cv), cells, cells, 101);
      const grain = fbm(u * 24, v * 24, 24, 24, 3, 103);
      return [
        0.62 + (grain - 0.5) * 0.22 - joint * 0.9,
        0.9 + (id - 0.5) * 0.11 + (grain - 0.5) * 0.09 - joint * 0.26,
      ];
    },
  },
  asphalt: {
    bump: 1.4, roughSpan: -0.08, tiles: 1.5,
    recipe: (u, v) => {
      const n = fbm(u * 44, v * 44, 44, 44, 4, 107);
      return [0.5 + (n - 0.5) * 0.85, 0.87 + (n - 0.5) * 0.2];
    },
  },
  wood: {
    bump: 1.0, roughSpan: -0.16, tiles: 2.7,
    recipe: (u, v) => {
      const warp = fbm(u * 3, v * 3, 3, 3, 3, 109);
      const ring = 0.5 + 0.5 * Math.sin((v * 8 + warp * 1.6) * TAU);
      const fiber = fbm(u * 5, v * 64, 5, 64, 3, 113);
      return [0.5 + (ring - 0.5) * 0.35 + (fiber - 0.5) * 0.3, 0.88 + (ring - 0.5) * 0.18 + (fiber - 0.5) * 0.09];
    },
  },
  metal: {
    bump: 0.5, roughSpan: -0.18, tiles: 2,
    recipe: (u, v) => {
      const brush = fbm(u * 128, v * 4, 128, 4, 3, 127);
      return [0.5 + (brush - 0.5) * 0.4, 0.95 + (brush - 0.5) * 0.09];
    },
  },
  foliage: {
    bump: 1.7, roughSpan: -0.14, tiles: 0.55,
    recipe: (u, v) => {
      const clump = fbm(u * 8, v * 8, 8, 8, 4, 131);
      const leaf = fbm(u * 26, v * 26, 26, 26, 2, 137);
      return [0.5 + (clump - 0.5) * 0.9 + (leaf - 0.5) * 0.35, 0.86 + (clump - 0.5) * 0.3];
    },
  },
  plaster: {
    bump: 0.6, roughSpan: -0.08, tiles: 2.5,
    recipe: (u, v) => {
      const n = fbm(u * 13, v * 13, 13, 13, 4, 139);
      return [0.5 + (n - 0.5) * 0.4, 0.95 + (n - 0.5) * 0.09];
    },
  },
};

/* ---------- baking ---------- */

function canvas(): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d canvas unavailable');
  return ctx;
}

function finish(ctx: CanvasRenderingContext2D, srgb: boolean, tiles: number): Texture {
  const t = new CanvasTexture(ctx.canvas);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  t.anisotropy = 8;
  t.repeat.set(tiles, tiles);
  return t;
}

function bake(kind: SurfaceKind): SurfaceMaps {
  const spec = SPECS[kind];
  const height = new Float32Array(SIZE * SIZE);
  const shade = new Float32Array(SIZE * SIZE);
  let peak = 0;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const [h, a] = spec.recipe(x / SIZE, y / SIZE);
      height[i] = Math.min(1, Math.max(0, h));
      shade[i] = Math.max(0, a);
      if (shade[i] > peak) peak = shade[i];
    }
  }

  // Both maps multiply what the material already has, so they are normalised to
  // top out at 1. A surface tints and varies its colour; it never darkens it
  // wholesale.
  const albedoCtx = canvas();
  const roughCtx = canvas();
  const albedo = albedoCtx.createImageData(SIZE, SIZE);
  const rough = roughCtx.createImageData(SIZE, SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const tone = Math.round(Math.min(255, (shade[i] / peak) * 255));
    albedo.data[i * 4] = tone;
    albedo.data[i * 4 + 1] = tone;
    albedo.data[i * 4 + 2] = tone;
    albedo.data[i * 4 + 3] = 255;
    const r = 1 + (height[i] - 0.5) * spec.roughSpan;
    const rv = Math.round(Math.min(255, Math.max(0, r * 255)));
    rough.data[i * 4] = rv;
    rough.data[i * 4 + 1] = rv;
    rough.data[i * 4 + 2] = rv;
    rough.data[i * 4 + 3] = 255;
  }
  albedoCtx.putImageData(albedo, 0, 0);
  roughCtx.putImageData(rough, 0, 0);

  // Sobel the height field into a tangent-space normal. The canvas runs top
  // down and the texture is flipped on upload, so the V gradient keeps its sign.
  const normalCtx = canvas();
  const normal = normalCtx.createImageData(SIZE, SIZE);
  const at = (x: number, y: number) => height[(((y % SIZE) + SIZE) % SIZE) * SIZE + (((x % SIZE) + SIZE) % SIZE)];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx =
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) -
        at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const dy =
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) -
        at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      let nx = -dx * 4;
      let ny = dy * 4;
      const len = Math.hypot(nx, ny, 1);
      nx /= len;
      ny /= len;
      const nz = 1 / len;
      const i = (y * SIZE + x) * 4;
      normal.data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      normal.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normal.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normal.data[i + 3] = 255;
    }
  }
  normalCtx.putImageData(normal, 0, 0);

  return {
    map: finish(albedoCtx, true, spec.tiles),
    normalMap: finish(normalCtx, false, spec.tiles),
    roughnessMap: finish(roughCtx, false, spec.tiles),
    normalScale: spec.bump,
  };
}

const cache = new Map<SurfaceKind, SurfaceMaps>();

/** Maps for one surface, baked on first use and shared from then on. */
export function surface(kind: SurfaceKind): SurfaceMaps {
  let found = cache.get(kind);
  if (!found) {
    found = bake(kind);
    cache.set(kind, found);
  }
  return found;
}
