import {
  AnimationMixer,
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  SkinnedMesh,
  TorusGeometry,
  Uint16BufferAttribute,
  type AnimationAction,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  BUILDS,
  HAIR_STYLES,
  HAIR_TONES,
  SEXES,
  SKIN_TONES,
  type ArchetypeSpec,
  type Feature,
  type SexTraits,
  type Silhouette,
} from '../data/archetypes';
import { ARCHETYPES } from '../data/archetypes';
import type { ResidentRecord } from '../data/districts';
import { material } from './materials';
import {
  BROW_DIR,
  EYE_DIR,
  LIP_DIR,
  decalGeometry,
  earGeometry,
  faceOf,
  skullCap,
  hairGeometry,
  headGeometry,
} from './head';
import {
  idleClip,
  limbGeometry,
  makeSkeleton,
  skin,
  sphereGeometry,
  talkClip,
  tileUv,
  torsoGeometry,
  walkClip,
} from './rig';

export type Pose = 'idle' | 'walk' | 'talk';

export interface CharacterRig {
  root: Group;
  /** Half the width of the widest garment, used for prop avoidance. */
  radius: number;
  /** Where a screen-space name label should sit, in local units. */
  labelHeight: number;
  play(pose: Pose): void;
  setStride(multiplier: number): void;
  update(dt: number): void;
}

/** Clips are stateless, so all forty residents share one set. */
const CLIPS = { idle: idleClip(), walk: walkClip(), talk: talkClip() };

const SHOE = material('#2a2a30', 0.1, 0.6, undefined, 'leather');
const IRIS = material('#2b2a33', 0, 0.34);
const CATCH = material('#f4f2ec', 0, 0.3);
const LEATHER = material('#6b5336', 0, 0.55, undefined, 'leather');
const METAL = material('#5b6068', 0.55, 0.42, undefined, 'metal');
const GLASS = material('#8a9fae', 0.1, 0.1, { transparent: true, opacity: 0.14 });

/** Heavy outerwear reads as wool; everything else as a woven cloth. */
const WEAVE: Record<Silhouette, 'wool' | 'fabric'> = {
  tailored: 'fabric', uniform: 'fabric', casual: 'fabric', work: 'fabric',
  athletic: 'fabric', coat: 'wool', robe: 'wool',
};

/**
 * Head landmarks in bind pose. Costume features sit against these rather than
 * against magic numbers scattered through the feature list.
 */
const HEAD_R = 0.27;
const HEAD_AT: [number, number, number] = [0, 2.88, 0];
/** Where the eye sits in bind pose, for eyewear to hang off. */
const EYE_Y = 2.874;
const EYE_X = 0.0929;

/* ---------- garment profiles ---------- */

type Stop = [number, number];

/** Interpolates a garment's half-width up the body. */
function curve(stops: Stop[]): (t: number) => number {
  return (t) => {
    for (let i = 0; i < stops.length - 1; i++) {
      const [t0, r0] = stops[i];
      const [t1, r1] = stops[i + 1];
      if (t >= t0 && t <= t1) {
        const k = (t - t0) / (t1 - t0 || 1);
        return r0 + (r1 - r0) * k;
      }
    }
    return stops[stops.length - 1][1];
  };
}

interface GarmentShape {
  /** Where the hem sits, in bind-pose units. */
  bottom: number;
  top: number;
  stops: Stop[];
  /** Front-to-back squash. A coat is deeper than a tank top. */
  depth: number;
  /** True when the arms and calves are bare. */
  bare: boolean;
}

const SHAPES: Record<Silhouette, GarmentShape> = {
  tailored: {
    bottom: 1.06, top: 2.56, depth: 0.62, bare: false,
    stops: [[0, 0.345], [0.2, 0.315], [0.44, 0.3], [0.76, 0.355], [0.93, 0.375], [1, 0.255]],
  },
  uniform: {
    bottom: 1.1, top: 2.56, depth: 0.6, bare: false,
    stops: [[0, 0.34], [0.2, 0.31], [0.45, 0.295], [0.78, 0.35], [0.94, 0.365], [1, 0.25]],
  },
  casual: {
    bottom: 1.02, top: 2.56, depth: 0.72, bare: false,
    stops: [[0, 0.375], [0.25, 0.365], [0.55, 0.352], [0.8, 0.372], [0.93, 0.385], [1, 0.265]],
  },
  work: {
    bottom: 0.98, top: 2.56, depth: 0.7, bare: false,
    stops: [[0, 0.385], [0.22, 0.375], [0.5, 0.358], [0.8, 0.378], [0.93, 0.39], [1, 0.27]],
  },
  coat: {
    bottom: 0.68, top: 2.56, depth: 0.66, bare: false,
    stops: [[0, 0.44], [0.28, 0.395], [0.58, 0.335], [0.82, 0.365], [0.94, 0.385], [1, 0.265]],
  },
  robe: {
    bottom: 0.26, top: 2.56, depth: 0.78, bare: false,
    stops: [[0, 0.56], [0.35, 0.44], [0.65, 0.345], [0.88, 0.362], [1, 0.27]],
  },
  athletic: {
    bottom: 1.2, top: 2.5, depth: 0.6, bare: true,
    stops: [[0, 0.305], [0.3, 0.3], [0.7, 0.335], [0.9, 0.345], [1, 0.245]],
  },
};

/* ---------- geometry collection ---------- */

/** One material's worth of geometry, merged into a single group at the end. */
type Parts = Map<Material, BufferGeometry[]>;

function add(parts: Parts, geometry: BufferGeometry, m: Material) {
  const bucket = parts.get(m);
  if (bucket) bucket.push(geometry);
  else parts.set(m, [geometry]);
}

/** Box with an optional tilt, used for lapels, brims and straps. */
function bx(
  w: number,
  h: number,
  d: number,
  at: [number, number, number],
  rx = 0,
  rz = 0,
  ry = 0,
): BufferGeometry {
  const g = new BoxGeometry(w, h, d, 2, 2, 2);
  if (ry) g.rotateY(ry);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  g.translate(...at);
  return g;
}

/** A spectacle rim: a ring, not the filled disc that reads as a goggle. */
function rim(r: number, thickness: number, at: [number, number, number]): BufferGeometry {
  const g = new TorusGeometry(r, thickness, 8, 20);
  g.translate(...at);
  return g;
}

function disc(
  rt: number,
  rb: number,
  h: number,
  at: [number, number, number],
  rx = 0,
): BufferGeometry {
  const g = new CylinderGeometry(rt, rb, h, 16, 2);
  if (rx) g.rotateX(rx);
  g.translate(...at);
  return g;
}

/**
 * An open arc of cylinder wrapped around the front of the body, for aprons and
 * anything else that lies on the chest instead of jutting out from it.
 */
function shell(
  rt: number,
  rb: number,
  h: number,
  at: [number, number, number],
  arc: number,
): BufferGeometry {
  // Theta zero faces +Z and the character faces -Z, so the front is at PI.
  const g = new CylinderGeometry(rt, rb, h, 22, 4, true, Math.PI - arc / 2, arc);
  g.translate(...at);
  return g;
}

/**
 * Reshapes a garment profile for the wearer: hips out, waist in and shoulders
 * narrow for a woman, the reverse for a man. One curve, so the collar, cuffs
 * and hem built from the same stops stay on the body.
 */
function sexProfile(stops: Stop[], t: SexTraits): Stop[] {
  const k = curve([[0, t.hip], [0.45, t.waist], [1, t.shoulder]]);
  return stops.map(([x, r]) => [x, r * k(x)] as Stop);
}

/** Silhouettes that fasten down the front, so they get a placket and buttons. */
const FASTENS = new Set<Silhouette>(['tailored', 'uniform', 'coat', 'work']);

/** Blends two hex colours, `t` of the way from `a` to `b`. */
function mix(a: string, b: string, t: number): string {
  const c = new Color(a).lerp(new Color(b), t);
  return `#${c.getHexString()}`;
}

function tint(hex: string, amount: number): string {
  const c = new Color(hex);
  c.multiplyScalar(1 + amount);
  return `#${c.getHexString()}`;
}

/**
 * Seams, collar, cuffs, hem and a button line. Without these a garment reads
 * as the extruded profile it actually is.
 */
function addGarmentDetail(parts: Parts, shape: GarmentShape, spec: ArchetypeSpec, t: SexTraits) {
  const weave = WEAVE[spec.silhouette];
  const profile = curve(shape.stops);
  const span = shape.top - shape.bottom;
  const tAt = (y: number) => Math.min(1, Math.max(0, (y - shape.bottom) / span));
  const rAt = (y: number) => profile(tAt(y));
  const seam = material(tint(spec.primary, -0.16), 0, 0.72, undefined, weave);
  const edge = material(tint(spec.primary, -0.3), 0, 0.72, undefined, weave);
  const flat = (y0: number, y1: number, k: number) =>
    torsoGeometry(y0, y1, curve([[0, rAt(y0) * k], [1, rAt(y1) * k]]), shape.depth);

  // Hem, one step wider than the body so it catches a highlight.
  add(parts, flat(shape.bottom - 0.015, shape.bottom + 0.075, 1.022), edge);

  // Collar standing off the neck, and the shoulder seam a sleeve sets into.
  const neck = profile(1);
  add(parts, torsoGeometry(2.48, 2.63, curve([[0, neck * 0.86], [1, neck * 0.7]]), 0.95), seam);
  add(parts, flat(2.35, 2.41, 1.016), seam);

  // Cuffs at the wrist, and a waist seam on anything that falls past it.
  for (const side of [1, -1]) {
    add(parts, disc(0.09, 0.1, 0.085, [side * 0.478 * t.shoulder, 1.5, 0]), shape.bare ? edge : seam);
  }
  if (shape.bottom < 1.0) add(parts, flat(1.36, 1.44, 1.014), seam);

  if (!FASTENS.has(spec.silhouette)) return;

  // Placket down the front. A narrow arc of cone tracks the body's curve well
  // enough at this width, and the depth squash puts it on the front face.
  const lo = Math.max(shape.bottom + 0.12, 1.22);
  const hi = 2.4;
  add(
    parts,
    shell(rAt(hi) * shape.depth * 1.02, rAt(lo) * shape.depth * 1.02, hi - lo, [0, (lo + hi) / 2, 0], 0.4),
    seam,
  );
  const buttons = material(tint(spec.accent, -0.1), 0.2, 0.4, undefined, 'leather');
  for (let i = 0; i < 4; i++) {
    const y = hi - 0.14 - i * ((hi - lo - 0.24) / 3);
    add(parts, disc(0.03, 0.03, 0.022, [0, y, -rAt(y) * shape.depth - 0.018], Math.PI / 2), buttons);
  }
}

/* ---------- role features ---------- */

function addFeature(
  parts: Parts,
  feature: Feature,
  spec: ArchetypeSpec,
  hair: Material,
  t: SexTraits,
) {
  // A narrower face needs narrower glasses, or the temples float off the head.
  const w = t.narrow / SEXES.m.narrow;
  const ex = EYE_X * t.narrow;
  const weave = WEAVE[spec.silhouette];
  const primary = material(spec.primary, 0, 0.75, undefined, weave);
  const accent = material(spec.accent, 0, 0.75, undefined, 'fabric');

  switch (feature) {
    case 'tie':
      add(parts, bx(0.095, 0.42, 0.05, [0, 2.24, -0.235]), accent);
      add(parts, bx(0.12, 0.09, 0.07, [0, 2.49, -0.215]), accent);
      break;
    case 'bowtie':
      add(parts, bx(0.24, 0.1, 0.07, [0, 2.5, -0.21]), accent);
      add(parts, bx(0.07, 0.08, 0.08, [0, 2.5, -0.225]), material(spec.primary, 0, 0.5));
      break;
    case 'lapels':
      add(parts, bx(0.13, 0.42, 0.045, [0.12, 2.3, -0.225], 0, 0.22), material(spec.primary, 0, 0.45));
      add(parts, bx(0.13, 0.42, 0.045, [-0.12, 2.3, -0.225], 0, -0.22), material(spec.primary, 0, 0.45));
      break;
    case 'pocketSquare':
      add(parts, bx(0.08, 0.055, 0.035, [0.21, 2.32, -0.215]), accent);
      break;
    case 'apron':
      add(parts, shell(0.4, 0.43, 1.18, [0, 1.76, 0], 1.95), accent);
      add(parts, shell(0.395, 0.395, 0.06, [0, 2.4, 0], 1.1), accent);
      break;
    case 'scarf':
      add(parts, disc(0.215, 0.215, 0.16, [0, 2.52, 0]), accent);
      add(parts, bx(0.11, 0.38, 0.06, [0.1, 2.26, -0.2]), accent);
      break;
    case 'hood':
      add(parts, sphereGeometry(0.345, [0, 2.84, 0.1], 0.98), material(spec.primary, 0, 0.7, undefined, weave));
      add(parts, disc(0.29, 0.34, 0.18, [0, 2.54, 0.03]), material(spec.primary, 0, 0.7, undefined, weave));
      break;
    case 'brimHat': {
      // The crown sits down over the hairline and the brim slopes away from
      // it, so the hat rests on the head instead of hovering above it.
      const felt = material(spec.primary, 0, 0.6, undefined, 'wool');
      add(parts, disc(0.345, 0.475, 0.05, [0, 3.01, 0]), felt);
      add(parts, disc(0.3, 0.325, 0.3, [0, 3.165, 0]), felt);
      add(parts, disc(0.305, 0.305, 0.055, [0, 3.05, 0]), accent);
      add(parts, disc(0.298, 0.26, 0.05, [0, 3.325, 0]), felt);
      break;
    }
    case 'cap': {
      // Crown cut from the skull itself, so it grips instead of flaring, and
      // tilted lower than any hairline so it sits on the forehead.
      add(parts, skullCap(faceOf(HEAD_R, HEAD_AT, t), 1.17, 0.26), primary);
      // The bill is a flattened round fan, mostly buried in the crown. A box
      // across the forehead reads as a headband.
      const bill = new CylinderGeometry(0.168, 0.168, 0.022, 22, 1);
      bill.scale(1, 1, 0.76);
      bill.rotateX(-0.32);
      bill.translate(0, 2.963, -0.2);
      tileUv(bill);
      add(parts, bill, primary);
      add(parts, sphereGeometry(0.018, [0, 3.206, 0]), accent);
      break;
    }
    case 'chefHat':
      add(parts, disc(0.29, 0.275, 0.13, [0, 3.025, 0]), material('#f2f0ea', 0, 0.8, undefined, 'fabric'));
      add(parts, sphereGeometry(0.3, [0, 3.225, 0], 1.2), material('#f2f0ea', 0, 0.8, undefined, 'fabric'));
      break;
    case 'glasses':
      // Lens wider than the eye, so the eye sits inside it rather than being
      // ringed by it. The arms run back on a diagonal to the ear; straight
      // ones at this width float off the temple.
      add(parts, rim(0.042, 0.005, [ex, EYE_Y, -0.262]), METAL);
      add(parts, rim(0.042, 0.005, [-ex, EYE_Y, -0.262]), METAL);
      add(parts, disc(0.04, 0.04, 0.004, [ex, EYE_Y, -0.262], Math.PI / 2), GLASS);
      add(parts, disc(0.04, 0.04, 0.004, [-ex, EYE_Y, -0.262], Math.PI / 2), GLASS);
      add(parts, bx(0.1, 0.007, 0.008, [0, EYE_Y + 0.016, -0.266]), METAL);
      add(parts, bx(0.009, 0.009, 0.26, [ex + 0.055, EYE_Y, -0.138], 0, 0, 0.44), METAL);
      add(parts, bx(0.009, 0.009, 0.26, [-(ex + 0.055), EYE_Y, -0.138], 0, 0, -0.44), METAL);
      break;
    case 'shades':
      // Two lenses and a bridge. One bar across the whole face reads as a
      // censor strip, not as sunglasses.
      add(parts, disc(0.038, 0.038, 0.006, [ex, EYE_Y, -0.274], Math.PI / 2), material('#14161c', 0.2, 0.38));
      add(parts, disc(0.038, 0.038, 0.006, [-ex, EYE_Y, -0.274], Math.PI / 2), material('#14161c', 0.2, 0.38));
      add(parts, bx(0.1, 0.012, 0.012, [0, EYE_Y + 0.018, -0.276]), material('#14161c', 0.3, 0.2));
      add(parts, bx(0.012, 0.012, 0.26, [0.148 * w, EYE_Y, -0.138], 0, 0, 0.4), material('#14161c', 0.3, 0.2));
      add(parts, bx(0.012, 0.012, 0.26, [-0.148 * w, EYE_Y, -0.138], 0, 0, -0.4), material('#14161c', 0.3, 0.2));
      break;
    case 'visor': {
      // Tinted lenses and a strap, not a slab. A straight box across a curved
      // skull sinks in at the middle and leaves its corners sticking out.
      const tint = material(mix(spec.accent, '#111820', 0.45), 0.3, 0.26, { transparent: true, opacity: 0.72 });
      add(parts, disc(0.038, 0.038, 0.007, [ex, EYE_Y + 0.006, -0.274], Math.PI / 2), tint);
      add(parts, disc(0.038, 0.038, 0.007, [-ex, EYE_Y + 0.006, -0.274], Math.PI / 2), tint);
      add(parts, bx(0.1, 0.018, 0.016, [0, EYE_Y + 0.034, -0.276]), accent);
      add(parts, bx(0.014, 0.016, 0.26, [ex + 0.06, EYE_Y + 0.02, -0.132], 0, 0, 0.44), accent);
      add(parts, bx(0.014, 0.016, 0.26, [-(ex + 0.06), EYE_Y + 0.02, -0.132], 0, 0, -0.44), accent);
      break;
    }
    case 'headset':
      add(parts, disc(0.07, 0.07, 0.055, [0.258 * w, 2.858, 0.024], Math.PI / 2), material('#23262c', 0.3, 0.4));
      add(parts, disc(0.07, 0.07, 0.055, [-0.258 * w, 2.858, 0.024], Math.PI / 2), material('#23262c', 0.3, 0.4));
      add(parts, bx(0.04, 0.22, 0.048, [0, 3.058, 0.01]), material('#23262c', 0.3, 0.4));
      add(parts, bx(0.015, 0.015, 0.3, [0.145, 2.8, -0.11], 0, 0, 0.63), accent);
      break;
    case 'stethoscope':
      add(parts, disc(0.24, 0.24, 0.05, [0, 2.56, -0.04]), METAL);
      add(parts, bx(0.045, 0.34, 0.045, [0.16, 2.34, -0.2]), METAL);
      add(parts, disc(0.075, 0.075, 0.045, [0.16, 2.16, -0.22], Math.PI / 2), METAL);
      break;
    case 'gloves':
      add(parts, sphereGeometry(0.1, [0.51, 1.4, 0]), LEATHER);
      add(parts, sphereGeometry(0.1, [-0.51, 1.4, 0]), LEATHER);
      break;
    case 'wristbands':
      add(parts, disc(0.095, 0.095, 0.09, [0.497, 1.56, 0]), accent);
      add(parts, disc(0.095, 0.095, 0.09, [-0.497, 1.56, 0]), accent);
      break;
    case 'toolbelt':
      add(parts, disc(0.4, 0.4, 0.12, [0, 1.4, 0]), LEATHER);
      add(parts, bx(0.14, 0.22, 0.12, [0.33, 1.28, -0.2]), METAL);
      add(parts, bx(0.11, 0.19, 0.1, [-0.33, 1.28, -0.17]), METAL);
      add(parts, bx(0.12, 0.1, 0.08, [0, 1.42, -0.3]), accent);
      break;
    case 'satchel':
      add(parts, bx(0.32, 0.28, 0.14, [0.33, 1.66, 0.12]), LEATHER);
      add(parts, bx(0.06, 0.6, 0.05, [0.08, 2.1, 0.0], 0, -0.42), LEATHER);
      add(parts, bx(0.34, 0.09, 0.15, [0.33, 1.79, 0.12]), accent);
      break;
  }

  // Keeps the compiler honest if a feature is added to the union later.
  void hair;
}

/* ---------- build ---------- */

export function buildCharacter(resident: ResidentRecord, index: number): CharacterRig {
  const spec = ARCHETYPES[resident.archetype];
  const traits = SEXES[resident.sex];
  const base = SHAPES[spec.silhouette];
  const shape: GarmentShape = { ...base, stops: sexProfile(base.stops, traits) };
  const { height, bulk } = BUILDS[spec.build];
  const styles = HAIR_STYLES[resident.sex];
  const face = faceOf(HEAD_R, HEAD_AT, traits);

  const skinTone = material(SKIN_TONES[index % SKIN_TONES.length], 0, 0.66, undefined, 'skin');
  const hairTone = material(HAIR_TONES[(index * 3 + 1) % HAIR_TONES.length], 0, 0.62, undefined, 'hair');
  const primary = material(spec.primary, 0, 0.75, undefined, WEAVE[spec.silhouette]);
  const legWear = shape.bare ? skinTone : material(spec.legs, 0, 0.75, undefined, 'fabric');
  const sleeve = shape.bare ? skinTone : primary;

  const parts: Parts = new Map();

  // Garment body. The profile is what makes a robe a robe and a tunic a tunic.
  add(parts, torsoGeometry(shape.bottom, shape.top, curve(shape.stops), shape.depth), primary);

  if (spec.silhouette === 'athletic') {
    // Shorts, so the hem reads separately from the tank top above it.
    add(parts, torsoGeometry(0.92, 1.28, curve([[0, 0.34], [1, 0.32]]), 0.78), legWear);
  }

  // Neck and head. The skull is one sculpted surface; the face is flat shapes
  // laid on it, which reads as a drawn face instead of a modelled one.
  add(parts, limbGeometry([0, 2.46, 0], [0, 2.78, 0], 0.122 * traits.neck, 0.138 * traits.neck), skinTone);
  add(parts, headGeometry(face), skinTone);

  // Lips only a shade off the skin. A defined mouth on a stylized head reads
  // as a fixed expression, and forty fixed expressions is what unsettles.
  const lipTone = material(
    mix(SKIN_TONES[index % SKIN_TONES.length], resident.sex === 'f' ? '#a85a5a' : '#8c5248', 0.42),
    0, 0.44, undefined, 'skin',
  );
  // Brows pulled toward the skin rather than drawn in the hair colour flat,
  // so they read as a stroke on the forehead instead of a bar across it.
  const browTone = material(
    mix(HAIR_TONES[(index * 3 + 1) % HAIR_TONES.length], SKIN_TONES[index % SKIN_TONES.length], 0.22),
    0, 0.6, undefined, 'skin',
  );

  for (const side of [1, -1]) {
    const eye = (dx: number, dy: number): [number, number, number] =>
      [side * (EYE_DIR[0] + dx), EYE_DIR[1] + dy, EYE_DIR[2]];
    // One dark lozenge per eye and a single catch light. No white around it:
    // visible sclera is what turned the earlier heads into dolls, and every
    // stylized house style that works at this fidelity carries the eye as one
    // shape rather than as an eyeball.
    add(parts, decalGeometry({
      f: face, center: eye(0, 0), lift: 0.01,
      across: 0.072 * traits.eye, down: 0.055 * traits.eye,
      shape: (u) => Math.pow(Math.max(0, 1 - u * u), 0.42),
    }), IRIS);
    add(parts, decalGeometry({
      f: face, center: eye(-0.022, 0.022), lift: 0.019,
      across: 0.016, down: 0.016,
    }), CATCH);
    // A short stroke, lifted clear of the eye so the two never merge.
    add(parts, decalGeometry({
      f: face,
      center: [side * BROW_DIR[0], BROW_DIR[1], BROW_DIR[2]],
      across: 0.1,
      down: 0.013 * traits.brow,
      lift: 0.012,
      shape: (u) => Math.pow(Math.max(0, 1 - u * u), 0.4) * (1 - 0.3 * u * side),
    }), browTone);
    add(parts, earGeometry(0.05, [side * 0.236, 2.856, 0.026], side as 1 | -1), skinTone);
  }

  // Mouth: a short soft line. Wider than this becomes a grin.
  add(parts, decalGeometry({
    f: face, center: LIP_DIR, lift: 0.008,
    across: 0.095 * traits.mouth, down: 0.021 * traits.mouth,
    shape: (u) => Math.pow(Math.max(0, 1 - u * u), 0.5),
  }), lipTone);

  for (const piece of hairGeometry(face, styles[index % styles.length])) {
    add(parts, piece, hairTone);
  }

  // Shoulders, arms, hands. The arms clear the garment so a swing is visible.
  for (const side of [1, -1]) {
    // The shoulder ball is tucked inside the torso's own width, or it reads as
    // a puffed sleeve rather than a shoulder.
    const sw = traits.shoulder;
    add(parts, sphereGeometry(0.128 * sw, [side * 0.325 * sw, 2.43, 0], 0.86), sleeve);
    add(parts, limbGeometry([side * 0.355 * sw, 2.45, 0], [side * 0.455 * sw, 1.92, 0], 0.122 * sw, 0.098 * sw), sleeve);
    add(parts, limbGeometry([side * 0.455 * sw, 1.92, 0], [side * 0.482 * sw, 1.46, 0], 0.098 * sw, 0.08 * sw), sleeve);
    add(parts, sphereGeometry(0.088 * sw, [side * 0.49 * sw, 1.39, 0]), skinTone);
  }

  // Legs and shoes.
  for (const side of [1, -1]) {
    const hp = traits.hip;
    add(parts, limbGeometry([side * 0.17 * hp, 1.42, 0], [side * 0.185 * hp, 0.78, 0], 0.155 * hp, 0.12 * hp), legWear);
    add(parts, limbGeometry([side * 0.185 * hp, 0.78, 0], [side * 0.195 * hp, 0.12, 0], 0.12 * hp, 0.085 * hp), legWear);
    add(parts, bx(0.2, 0.1, 0.34, [side * 0.195 * hp, 0.06, -0.06]), SHOE);
  }

  addGarmentDetail(parts, shape, spec, traits);
  for (const feature of spec.features) addFeature(parts, feature, spec, hairTone, traits);

  // Merge per material, then merge those into one mesh with a group each.
  const materials: Material[] = [];
  const grouped: BufferGeometry[] = [];
  for (const [m, geometries] of parts) {
    const merged = mergeGeometries(geometries.map(skin), false);
    for (const g of geometries) g.dispose();
    if (!merged) continue;
    materials.push(m);
    grouped.push(merged);
  }

  const geometry = mergeGeometries(grouped, true);
  for (const g of grouped) g.dispose();
  if (!geometry) throw new Error(`No geometry built for ${resident.name}`);

  // mergeGeometries widens skinIndex to float; the shader wants integers.
  const si = geometry.attributes.skinIndex;
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(Array.from(si.array), 4));

  const { root: boneRoot, skeleton } = makeSkeleton();
  const mesh = new SkinnedMesh(geometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Skinned bounds are computed in the bind pose, so an animated limb can pop
  // out of frustum at the screen edge.
  mesh.frustumCulled = false;
  mesh.userData.residentId = resident.id;

  const root = new Group();
  root.name = resident.name;
  root.add(boneRoot);
  root.add(mesh);
  mesh.bind(skeleton);

  // Height scales the whole figure about the feet; bulk widens it only.
  const tall = height * traits.stature;
  root.scale.set(tall * bulk, tall, tall * bulk);

  const mixer = new AnimationMixer(root);
  const actions: Record<Pose, AnimationAction> = {
    idle: mixer.clipAction(CLIPS.idle),
    walk: mixer.clipAction(CLIPS.walk),
    talk: mixer.clipAction(CLIPS.talk),
  };
  // Staggered so forty residents do not breathe and step in lockstep.
  for (const [name, action] of Object.entries(actions)) {
    action.time = ((index * 0.37) % 1) * CLIPS[name as Pose].duration;
  }
  actions.idle.play();
  let current: Pose = 'idle';

  const widest = shape.stops.reduce((max, [, r]) => Math.max(max, r), 0);

  return {
    root,
    radius: widest * bulk * tall,
    labelHeight: 3.36 * tall,
    play(pose) {
      if (pose === current) return;
      actions[current].fadeOut(0.28);
      actions[pose].reset().fadeIn(0.28).play();
      current = pose;
    },
    setStride(multiplier) {
      actions.walk.timeScale = multiplier;
    },
    update(dt) {
      mixer.update(dt);
    },
  };
}
