import {
  AnimationMixer,
  BoxGeometry,
  CylinderGeometry,
  Group,
  SkinnedMesh,
  SphereGeometry,
  Uint16BufferAttribute,
  type AnimationAction,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  BUILDS,
  HAIR_TONES,
  SKIN_TONES,
  type ArchetypeSpec,
  type Feature,
  type Silhouette,
} from '../data/archetypes';
import { ARCHETYPES } from '../data/archetypes';
import type { ResidentRecord } from '../data/districts';
import { material } from './materials';
import {
  idleClip,
  limbGeometry,
  makeSkeleton,
  skin,
  sphereGeometry,
  talkClip,
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

const SHOE = material('#2a2a30', 0.1, 0.6);
const EYE = material('#1b1b22', 0, 0.3);
const LEATHER = material('#6b5336', 0, 0.55);
const METAL = material('#9fa6ad', 0.8, 0.3);
const GLASS = material('#aebfca', 0.2, 0.15);

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
): BufferGeometry {
  const g = new BoxGeometry(w, h, d, 2, 2, 2);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
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

/* ---------- role features ---------- */

function addFeature(parts: Parts, feature: Feature, spec: ArchetypeSpec, hair: Material) {
  const primary = material(spec.primary);
  const accent = material(spec.accent);

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
      add(parts, sphereGeometry(0.34, [0, 2.78, 0.09], 0.94), material(spec.primary, 0, 0.7));
      add(parts, disc(0.29, 0.34, 0.18, [0, 2.54, 0.03]), material(spec.primary, 0, 0.7));
      break;
    case 'brimHat':
      add(parts, disc(0.52, 0.52, 0.045, [0, 3.0, 0]), material(spec.primary, 0, 0.6));
      add(parts, disc(0.25, 0.275, 0.28, [0, 3.14, 0]), material(spec.primary, 0, 0.6));
      add(parts, disc(0.281, 0.281, 0.07, [0, 3.04, 0]), accent);
      break;
    case 'cap':
      add(parts, sphereGeometry(0.288, [0, 2.92, 0], 0.76), primary);
      add(parts, bx(0.42, 0.045, 0.3, [0, 2.92, -0.26], 0.1), primary);
      break;
    case 'chefHat':
      add(parts, disc(0.26, 0.235, 0.11, [0, 3.0, 0]), material('#f2f0ea'));
      add(parts, sphereGeometry(0.29, [0, 3.2, 0], 1.25), material('#f2f0ea'));
      break;
    case 'glasses':
      add(parts, disc(0.095, 0.095, 0.03, [0.115, 2.874, -0.238], Math.PI / 2), METAL);
      add(parts, disc(0.095, 0.095, 0.03, [-0.115, 2.874, -0.238], Math.PI / 2), METAL);
      add(parts, bx(0.08, 0.018, 0.018, [0, 2.874, -0.253]), METAL);
      add(parts, bx(0.018, 0.018, 0.2, [0.205, 2.874, -0.14]), METAL);
      add(parts, bx(0.018, 0.018, 0.2, [-0.205, 2.874, -0.14]), METAL);
      break;
    case 'shades':
      add(parts, bx(0.38, 0.11, 0.05, [0, 2.874, -0.238]), material('#14161c', 0.3, 0.2));
      add(parts, bx(0.018, 0.018, 0.2, [0.2, 2.874, -0.14]), material('#14161c', 0.3, 0.2));
      add(parts, bx(0.018, 0.018, 0.2, [-0.2, 2.874, -0.14]), material('#14161c', 0.3, 0.2));
      break;
    case 'visor':
      add(parts, bx(0.4, 0.13, 0.06, [0, 2.93, -0.23]), GLASS);
      add(parts, bx(0.42, 0.06, 0.26, [0, 3.0, -0.1]), accent);
      break;
    case 'headset':
      add(parts, disc(0.09, 0.09, 0.07, [0.255, 2.9, 0], Math.PI / 2), material('#23262c', 0.3, 0.4));
      add(parts, disc(0.09, 0.09, 0.07, [-0.255, 2.9, 0], Math.PI / 2), material('#23262c', 0.3, 0.4));
      add(parts, bx(0.05, 0.28, 0.06, [0, 3.06, 0]), material('#23262c', 0.3, 0.4));
      add(parts, bx(0.17, 0.035, 0.035, [0.17, 2.82, -0.13]), accent);
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
  const shape = SHAPES[spec.silhouette];
  const { height, bulk } = BUILDS[spec.build];

  const skinTone = material(SKIN_TONES[index % SKIN_TONES.length]);
  const hairTone = material(HAIR_TONES[(index * 3 + 1) % HAIR_TONES.length], 0, 0.62);
  const primary = material(spec.primary);
  const legWear = shape.bare ? skinTone : material(spec.legs);
  const sleeve = shape.bare ? skinTone : primary;

  const parts: Parts = new Map();

  // Garment body. The profile is what makes a robe a robe and a tunic a tunic.
  add(parts, torsoGeometry(shape.bottom, shape.top, curve(shape.stops), shape.depth), primary);

  if (spec.silhouette === 'athletic') {
    // Shorts, so the hem reads separately from the tank top above it.
    add(parts, torsoGeometry(0.92, 1.28, curve([[0, 0.34], [1, 0.32]]), 0.78), legWear);
  }

  // Neck and head.
  add(parts, limbGeometry([0, 2.48, 0], [0, 2.8, 0], 0.115, 0.13), skinTone);
  add(parts, sphereGeometry(0.27, [0, 2.88, 0], 1.1), skinTone);
  add(parts, sphereGeometry(0.038, [0.098, 2.852, -0.232]), EYE);
  add(parts, sphereGeometry(0.038, [-0.098, 2.852, -0.232]), EYE);
  // A nose is the one feature that keeps a head from reading as a ball.
  add(parts, sphereGeometry(0.042, [0, 2.812, -0.252], 1.35), skinTone);

  // Hair as a cap over the skull, not a second full sphere.
  const hairCap = new SphereGeometry(0.278, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.46);
  hairCap.scale(1.04, 1.1, 1.08);
  hairCap.translate(0, 2.885, 0.012);
  add(parts, hairCap, hairTone);

  // Shoulders, arms, hands. The arms clear the garment so a swing is visible.
  for (const side of [1, -1]) {
    add(parts, sphereGeometry(0.135, [side * 0.4, 2.45, 0]), sleeve);
    add(parts, limbGeometry([side * 0.44, 2.44, 0], [side * 0.48, 1.92, 0], 0.125, 0.1), sleeve);
    add(parts, limbGeometry([side * 0.48, 1.92, 0], [side * 0.5, 1.46, 0], 0.1, 0.082), sleeve);
    add(parts, sphereGeometry(0.09, [side * 0.51, 1.4, 0]), skinTone);
  }

  // Legs and shoes.
  for (const side of [1, -1]) {
    add(parts, limbGeometry([side * 0.17, 1.42, 0], [side * 0.185, 0.78, 0], 0.155, 0.12), legWear);
    add(parts, limbGeometry([side * 0.185, 0.78, 0], [side * 0.195, 0.12, 0], 0.12, 0.085), legWear);
    add(parts, bx(0.2, 0.1, 0.34, [side * 0.195, 0.06, -0.06]), SHOE);
  }

  for (const feature of spec.features) addFeature(parts, feature, spec, hairTone);

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
  root.scale.set(height * bulk, height, height * bulk);

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
    radius: widest * bulk * height,
    labelHeight: 3.36 * height,
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
