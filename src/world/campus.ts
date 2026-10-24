import { Group, Vector3, type Object3D, type Scene } from 'three';
import { DISTRICTS, type District, type VenueKind } from '../data/districts';
import { bakeStatic } from './bake';
import { label } from './labels';
import { lamp, material, SURFACES } from './materials';
import { ball, box, cyl } from './primitives';

/** Where a district sits, which way it faces, and where its residents gather. */
export interface Placement {
  district: District;
  index: number;
  center: Vector3;
  /** Y rotation so the entrance faces the central plaza. */
  facing: number;
  /** Plaza-side apron where residents work and meet. */
  frontage: Vector3;
}

export interface Campus {
  placements: Placement[];
  plaza: Vector3;
}

const INNER_RADIUS = 56;
const OUTER_RADIUS = 104;

interface VenueProfile {
  height: number;
  width: number;
  depth: number;
  facade: string;
  /** Open-air venues skip the solid shell. */
  open?: boolean;
}

function venueProfile(kind: VenueKind): VenueProfile {
  switch (kind) {
    case 'tower':
      return { height: 26, width: 18, depth: 16, facade: '#33465a' };
    case 'archive':
      return { height: 13, width: 24, depth: 18, facade: '#41474f' };
    case 'lab':
      return { height: 11, width: 23, depth: 18, facade: '#2d4350' };
    case 'market':
      return { height: 15, width: 21, depth: 17, facade: '#3f4a48' };
    case 'chamber':
      return { height: 14, width: 22, depth: 18, facade: '#4a4851' };
    case 'clinic':
      return { height: 10, width: 23, depth: 18, facade: '#47544f' };
    case 'forum':
      return { height: 9, width: 25, depth: 19, facade: '#474457' };
    case 'studio':
      return { height: 12, width: 25, depth: 19, facade: '#4b4039' };
    case 'workshop':
      return { height: 9, width: 26, depth: 19, facade: '#3d4852' };
    case 'arena':
      return { height: 11, width: 26, depth: 20, facade: '#3e4a3c' };
    case 'bureau':
      return { height: 12, width: 21, depth: 17, facade: '#2b3440' };
    case 'gallery':
      return { height: 10, width: 23, depth: 18, facade: '#4c4446' };
    case 'colonnade':
      return { height: 8, width: 22, depth: 16, facade: '#5b5648', open: true };
    case 'hall':
      return { height: 13, width: 23, depth: 18, facade: '#4a4336' };
    case 'dome':
      return { height: 8, width: 22, depth: 18, facade: '#364a42', open: true };
  }
}

/** Districts are ordered largest first so the busiest sit on the inner ring. */
function ringOrder(): number[] {
  return DISTRICTS.map((d, i) => ({ i, n: d.residents.length }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((entry) => entry.i);
}

function groundPlan(scene: Object3D) {
  // Lawn, ring road, radial boulevards, kerbs.
  scene.add(cyl(230, 230, 0.6, SURFACES.ground, 0, -0.5, 0, 72));

  const ring = cyl(OUTER_RADIUS - 22, OUTER_RADIUS - 22, 0.08, SURFACES.paving, 0, -0.1, 0, 64);
  const inner = cyl(OUTER_RADIUS - 30, OUTER_RADIUS - 30, 0.12, SURFACES.ground, 0, -0.06, 0, 64);
  scene.add(ring, inner);

  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const road = box(7, 0.06, OUTER_RADIUS + 14, SURFACES.paving, 0, -0.12, 0, false);
    road.position.set(Math.sin(angle) * ((OUTER_RADIUS + 14) / 2), -0.12, Math.cos(angle) * ((OUTER_RADIUS + 14) / 2));
    road.rotation.y = angle;
    scene.add(road);
  }

  // Perimeter tree line.
  for (let i = 0; i < 64; i++) {
    const angle = (i / 64) * Math.PI * 2;
    const r = 132 + (i % 3) * 6;
    tree(scene, Math.sin(angle) * r, Math.cos(angle) * r, 0.85 + (i % 4) * 0.12);
  }
}

function tree(scene: Object3D, x: number, z: number, s = 1) {
  const g = new Group();
  g.position.set(x, 0, z);
  g.add(cyl(0.17, 0.26, 2.6 * s, SURFACES.wood, 0, 1.3 * s, 0, 8));
  for (let k = 0; k < 3; k++) {
    g.add(
      ball((1.3 - k * 0.16) * s, k === 1 ? SURFACES.leafDark : SURFACES.leaf,
        Math.sin(k * 2) * 0.3, (2.9 + k * 0.5) * s, Math.cos(k * 3) * 0.25, 10),
    );
  }
  scene.add(g);
}

function lampPost(parent: Group, x: number, z: number) {
  parent.add(cyl(0.12, 0.16, 5, SURFACES.iron, x, 2.5, z, 8));
  parent.add(ball(0.42, lamp('#f2d9a4', 1.1), x, 5.2, z, 10));
}

function bench(parent: Group, x: number, z: number, rotation = 0) {
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotation;
  g.add(box(3.2, 0.18, 0.9, SURFACES.wood, 0, 0.78, 0));
  g.add(box(3.2, 0.9, 0.16, SURFACES.wood, 0, 1.2, 0.4));
  g.add(box(0.2, 0.78, 0.8, SURFACES.iron, -1.4, 0.39, 0));
  g.add(box(0.2, 0.78, 0.8, SURFACES.iron, 1.4, 0.39, 0));
  parent.add(g);
}

/** Exterior props. Each venue kind reads differently from across the plaza. */
function venueProps(kind: VenueKind, accent: string): Group {
  const g = new Group();
  const tint = material(accent);
  const console_ = (x: number) => {
    g.add(box(2.5, 1.5, 1.2, SURFACES.iron, x, 1.15, 0));
    g.add(box(2.2, 1.2, 0.13, tint, x, 2.15, -0.55));
    g.add(cyl(0.08, 0.08, 0.8, SURFACES.stone, x, 1.65, -0.4, 8));
  };

  switch (kind) {
    case 'tower':
      console_(-3.4);
      console_(3.4);
      g.add(cyl(0.1, 0.1, 6, SURFACES.kerb, 0, 3, 2.4, 6));
      break;
    case 'archive':
      for (let j = 0; j < 4; j++) g.add(box(1.5, 2.6, 1.2, SURFACES.wood, (j - 1.5) * 3, 1.5, 0));
      g.add(box(13, 0.2, 1.4, tint, 0, 2.9, 0));
      break;
    case 'lab':
      console_(-3.4);
      console_(3.4);
      g.add(cyl(0.6, 0.6, 2.2, SURFACES.glass, 0, 1.3, 0.6, 14));
      break;
    case 'market':
      g.add(box(11, 2.4, 0.4, SURFACES.iron, 0, 2.6, 1.2));
      g.add(box(10.2, 1.8, 0.14, tint, 0, 2.6, 0.95));
      for (let j = 0; j < 3; j++) g.add(cyl(0.7, 0.8, 1.3, SURFACES.stone, (j - 1) * 3.6, 0.85, -0.8, 12));
      break;
    case 'chamber':
      for (let j = 0; j < 4; j++) g.add(cyl(0.6, 0.7, 5.4, SURFACES.kerb, (j - 1.5) * 3.6, 2.9, 1.4, 14));
      g.add(box(14, 0.4, 3, SURFACES.stone, 0, 0.4, -1.2));
      break;
    case 'clinic':
      for (let j = 0; j < 2; j++) {
        g.add(box(2.4, 0.5, 1.1, SURFACES.canvas, (j - 0.5) * 4, 0.9, 0));
        g.add(box(2.4, 0.22, 0.26, SURFACES.iron, (j - 0.5) * 4, 1.25, -0.42));
      }
      g.add(box(0.5, 2, 0.2, tint, 4.8, 1.6, 0.8));
      g.add(box(2, 0.5, 0.2, tint, 4.8, 1.6, 0.8));
      break;
    case 'forum':
      for (let j = 0; j < 3; j++) bench(g, (j - 1) * 4.4, 0.6, Math.PI + (j - 1) * 0.35);
      g.add(cyl(1.3, 1.5, 0.5, SURFACES.stone, 0, 0.35, -2.4, 16));
      break;
    case 'studio':
      for (let j = 0; j < 3; j++) {
        const x = (j - 1) * 4.4;
        g.add(cyl(0.1, 0.14, 3.4, SURFACES.iron, x, 1.7, 0, 8));
        g.add(box(1.1, 0.9, 0.5, lamp('#ffe6b8', 0.8), x, 3.5, 0));
      }
      g.add(box(1.8, 1.2, 1.8, SURFACES.iron, 4.6, 1.5, -0.4));
      break;
    case 'workshop':
      g.add(box(11, 0.3, 2.2, SURFACES.wood, 0, 1.6, 0));
      for (let j = 0; j < 4; j++) g.add(cyl(0.16, 0.16, 1.6, SURFACES.iron, (j - 1.5) * 3.2, 0.8, 0.7, 6));
      for (let j = 0; j < 3; j++) g.add(box(1.4, 1.4, 1.4, SURFACES.wood, (j - 1) * 2.4, 0.7, -2.6));
      break;
    case 'arena':
      for (let j = 0; j < 4; j++) {
        const x = j % 2 === 0 ? -5.2 : 5.2;
        const z = j < 2 ? -2.4 : 2.4;
        g.add(cyl(0.18, 0.2, 2.4, SURFACES.iron, x, 1.2, z, 8));
      }
      g.add(box(11, 0.1, 0.1, tint, 0, 2.1, -2.4));
      g.add(box(11, 0.1, 0.1, tint, 0, 2.1, 2.4));
      g.add(box(11.4, 0.26, 5.4, SURFACES.canvas, 0, 0.3, 0));
      break;
    case 'bureau':
      g.add(box(9, 0.3, 5, SURFACES.iron, 0, 1.5, 0));
      for (let j = 0; j < 3; j++) g.add(box(2.4, 2.2, 0.16, j === 1 ? tint : SURFACES.concrete, (j - 1) * 3, 2.9, 1.8));
      break;
    case 'gallery':
      for (let j = 0; j < 4; j++) {
        const x = (j - 1.5) * 3.2;
        g.add(box(1.3, 1.5, 1.3, SURFACES.stone, x, 0.85, 0));
        g.add(box(1.1, 1.1, 1.1, SURFACES.glass, x, 2.1, 0));
      }
      break;
    case 'colonnade':
      for (let j = 0; j < 6; j++) g.add(cyl(0.55, 0.62, 7, SURFACES.kerb, (j - 2.5) * 3.6, 3.6, 0, 16));
      g.add(box(23, 0.6, 2, SURFACES.kerb, 0, 7.4, 0));
      g.add(box(23, 0.5, 3.4, SURFACES.stone, 0, 0.3, 0));
      break;
    case 'hall':
      g.add(ball(2.1, SURFACES.glass, 0, 2.7, 0, 16));
      g.add(cyl(0.3, 0.7, 1.5, SURFACES.brass, 0, 1.2, 0, 12));
      for (let j = 0; j < 3; j++) g.add(box(1.5, 0.8, 1.1, SURFACES.wood, 4.4, 0.45 + j * 0.85, -0.4 + j * 0.2));
      break;
    case 'dome':
      g.add(ball(6.4, SURFACES.glass, 0, 1.2, 0, 18));
      for (let j = 0; j < 4; j++) {
        const a = (j / 4) * Math.PI * 2;
        g.add(cyl(0.8, 0.9, 0.9, SURFACES.stone, Math.sin(a) * 3.4, 0.6, Math.cos(a) * 3.4, 12));
        tree(g, Math.sin(a) * 3.4, Math.cos(a) * 3.4, 0.5);
      }
      break;
  }
  return g;
}

function buildDistrict(scene: Object3D, placement: Placement) {
  const { district, center, facing } = placement;
  const profile = venueProfile(district.kind);
  const accent = material(district.accent);

  const group = new Group();
  group.position.copy(center);
  group.rotation.y = facing;
  scene.add(group);

  // Plinth.
  group.add(box(profile.width + 8, 0.5, profile.depth + 8, SURFACES.stone, 0, 0.05, 0));

  if (!profile.open) {
    group.add(box(profile.width, profile.height, profile.depth, material(profile.facade), 0, profile.height / 2, 0));
    group.add(box(profile.width + 1.4, 0.6, profile.depth + 1.4, accent, 0, profile.height + 0.3, 0));

    // Entrance and glazing on the plaza-facing side (-Z after rotation).
    const front = -profile.depth / 2 - 0.1;
    group.add(box(profile.width - 3, 0.4, 1.4, SURFACES.wood, 0, 3.4, front + 0.5));
    group.add(box(4.6, 5, 0.25, SURFACES.glass, 0, 2.5, front));
    for (let c = -2; c <= 2; c++) {
      if (c === 0) continue;
      group.add(box(2.6, 2.6, 0.16, SURFACES.glass, c * 4.2, 5.4, front));
      group.add(box(2.6, 2.6, 0.16, SURFACES.glass, c * 4.2, 5.4, -front));
    }
    const upperRows = Math.max(1, Math.floor((profile.height - 8) / 4));
    for (let row = 0; row < upperRows; row++) {
      for (let c = -1; c <= 1; c++) {
        group.add(box(3, 2.4, 0.15, SURFACES.glass, c * 5.3, 9 + row * 4, front));
      }
    }
  }

  const sign = label(district.venue, { background: '#101b26e0', scale: 0.85, font: 'display' });
  sign.position.set(0, profile.height + 3.2, -profile.depth / 2);
  group.add(sign);

  // Apron, props, lamps.
  const apron = box(profile.width + 2, 0.2, 10, SURFACES.paving, 0, 0.2, -profile.depth / 2 - 6);
  group.add(apron);
  const props = venueProps(district.kind, district.accent);
  props.position.set(0, 0, -profile.depth / 2 - 6);
  group.add(props);

  lampPost(group, -(profile.width / 2 + 3), -profile.depth / 2 - 2);
  lampPost(group, profile.width / 2 + 3, -profile.depth / 2 - 2);
  group.add(box(1.3, 1.1, 1.3, accent, -(profile.width / 2 + 1), 0.8, -profile.depth / 2 - 1.5));
  group.add(box(1.3, 1.1, 1.3, accent, profile.width / 2 + 1, 0.8, -profile.depth / 2 - 1.5));
  tree(group, -(profile.width / 2 + 6), -profile.depth / 2 - 1, 0.9);
  tree(group, profile.width / 2 + 6, -profile.depth / 2 - 1, 0.9);
}

function buildPlaza(scene: Object3D) {
  const plaza = new Group();
  scene.add(plaza);

  plaza.add(cyl(26, 26, 0.3, SURFACES.paving, 0, 0.1, 0, 64));
  plaza.add(cyl(7, 7, 0.8, SURFACES.stone, 0, 0.35, 0, 32));
  plaza.add(cyl(6, 6, 0.2, SURFACES.glass, 0, 0.8, 0, 32));
  plaza.add(cyl(1.1, 1.3, 4.2, SURFACES.brass, 0, 2.5, 0, 16));
  plaza.add(ball(1.35, SURFACES.glass, 0, 4.9, 0, 14));
  plaza.add(cyl(2.6, 2.8, 0.4, SURFACES.brass, 0, 1.0, 0, 24));

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    bench(plaza, Math.sin(a) * 15, Math.cos(a) * 15, -a);
    lampPost(plaza, Math.sin(a) * 22, Math.cos(a) * 22);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    tree(plaza, Math.sin(a) * 31, Math.cos(a) * 31, 0.75);
  }
}

/** Builds the whole campus and returns where everything landed. */
export function buildCampus(scene: Scene): Campus {
  const root = new Group();
  groundPlan(root);
  buildPlaza(root);

  const order = ringOrder();
  const placements: Placement[] = [];

  order.forEach((districtIndex, slot) => {
    const district = DISTRICTS[districtIndex];
    const profile = venueProfile(district.kind);
    const inner = slot < 5;
    const count = inner ? 5 : order.length - 5;
    const position = inner ? slot : slot - 5;
    // Offsets keep a boulevard, not a facade, pointing at the default camera.
    const angle = (position / count) * Math.PI * 2 + (inner ? 0.63 : Math.PI / 10);
    const radius = inner ? INNER_RADIUS : OUTER_RADIUS;

    const center = new Vector3(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
    // Entrance faces the plaza: the shell's -Z side points at the origin.
    const facing = Math.atan2(center.x, center.z);
    const frontageDistance = profile.depth / 2 + 7;
    const frontage = new Vector3(
      center.x - Math.sin(facing) * frontageDistance,
      0,
      center.z - Math.cos(facing) * frontageDistance,
    );

    const placement: Placement = { district, index: districtIndex, center, facing, frontage };
    placements[districtIndex] = placement;
    buildDistrict(root, placement);
  });

  scene.add(bakeStatic(root));
  return { placements, plaza: new Vector3(0, 0, 0) };
}
