import { Group, type Object3D, type Sprite } from 'three';
import { ARCHETYPES, HAIR_TONES, SKIN_TONES, type ArchetypeSpec, type Feature } from '../data/archetypes';
import type { ResidentRecord } from '../data/districts';
import { label } from './labels';
import { material } from './materials';
import { ball, box, cyl } from './primitives';

export interface CharacterRig {
  root: Group;
  torso: Group;
  armL: Group;
  armR: Group;
  legL: Group;
  legR: Group;
  head: Group;
  tag: Sprite;
}

const TROUSERS = material('#273340');
const SHOE = material('#1e2228');
const EYE = material('#161e27');

function limb(parent: Object3D, radius: number, length: number, m: ReturnType<typeof material>) {
  const piece = cyl(radius * 0.85, radius, length, m, 0, -length / 2, 0, 8);
  parent.add(piece);
  return piece;
}

function addFeature(rig: CharacterRig, feature: Feature, spec: ArchetypeSpec) {
  const accent = material(spec.accent);
  const primary = material(spec.primary);
  const { torso, head } = rig;

  switch (feature) {
    case 'tie':
      torso.add(box(0.13, 0.78, 0.07, accent, 0, 1.88, -0.47));
      break;
    case 'bowtie':
      torso.add(box(0.34, 0.14, 0.1, accent, 0, 2.3, -0.46));
      break;
    case 'lapels':
      torso.add(box(0.62, 0.52, 0.06, material(spec.primary, 0, 0.55), 0, 2.12, -0.46));
      break;
    case 'pocketSquare':
      torso.add(box(0.14, 0.09, 0.06, accent, -0.28, 2.16, -0.45));
      break;
    case 'apron':
      torso.add(box(0.74, 1.0, 0.1, accent, 0, 1.68, -0.44));
      torso.add(box(0.14, 0.5, 0.08, accent, -0.3, 2.3, -0.42));
      torso.add(box(0.14, 0.5, 0.08, accent, 0.3, 2.3, -0.42));
      break;
    case 'toolbelt':
      torso.add(box(1.02, 0.18, 0.78, material('#4b3a28'), 0, 1.3, 0));
      torso.add(box(0.16, 0.26, 0.14, material('#8d8f94'), 0.42, 1.2, -0.3));
      break;
    case 'gloves':
      rig.armL.add(ball(0.17, accent, 0, -0.9, 0, 10));
      rig.armR.add(ball(0.17, accent, 0, -0.9, 0, 10));
      break;
    case 'wristbands':
      rig.armL.add(cyl(0.19, 0.19, 0.12, accent, 0, -0.74, 0, 10));
      rig.armR.add(cyl(0.19, 0.19, 0.12, accent, 0, -0.74, 0, 10));
      break;
    case 'satchel':
      torso.add(box(0.5, 0.38, 0.22, material('#6b5336'), 0.42, 1.52, 0.18));
      torso.add(box(0.1, 0.9, 0.06, material('#6b5336'), 0.1, 2.08, -0.24));
      break;
    case 'stethoscope':
      torso.add(cyl(0.2, 0.2, 0.08, accent, -0.2, 2.44, -0.3, 10));
      torso.add(box(0.5, 0.07, 0.07, accent, 0, 2.52, -0.34));
      break;
    case 'scarf':
      torso.add(cyl(0.44, 0.42, 0.22, accent, 0, 2.6, 0, 12));
      torso.add(box(0.16, 0.5, 0.1, accent, 0.14, 2.3, -0.4));
      break;
    case 'brimHat':
      head.add(cyl(0.56, 0.56, 0.07, material('#6f5a3b'), 0, 0.4, 0, 16));
      head.add(cyl(0.34, 0.37, 0.3, material('#6f5a3b'), 0, 0.56, 0, 16));
      break;
    case 'cap':
      head.add(cyl(0.37, 0.39, 0.22, accent, 0, 0.44, 0, 16));
      head.add(box(0.5, 0.05, 0.3, accent, 0, 0.36, -0.34));
      break;
    case 'chefHat':
      head.add(cyl(0.42, 0.4, 0.62, material('#f6f2e9'), 0, 0.68, 0, 16));
      break;
    case 'glasses':
      head.add(box(0.56, 0.11, 0.06, material('#2d343c'), 0, 0.04, -0.33));
      break;
    case 'shades':
      head.add(box(0.6, 0.15, 0.08, material('#12181f'), 0, 0.05, -0.33));
      break;
    case 'headset':
      head.add(box(0.72, 0.1, 0.1, accent, 0, 0.26, 0));
      head.add(ball(0.1, accent, -0.36, 0.1, 0, 8));
      head.add(ball(0.1, accent, 0.36, 0.1, 0, 8));
      head.add(box(0.26, 0.05, 0.05, accent, 0.18, -0.06, -0.26));
      break;
    case 'visor':
      head.add(box(0.66, 0.18, 0.08, accent, 0, 0.06, -0.31));
      head.add(box(0.7, 0.08, 0.1, primary, 0, 0.28, -0.1));
      break;
    case 'hood':
      torso.add(ball(0.5, primary, 0, 2.5, 0.22, 10));
      torso.add(cyl(0.5, 0.42, 0.3, primary, 0, 2.52, 0, 12));
      break;
  }
}

/** Builds one resident: body rig, costume, and the floating name tag. */
export function buildCharacter(resident: ResidentRecord, index: number): CharacterRig {
  const spec = ARCHETYPES[resident.archetype];
  const primary = material(spec.primary);
  const skin = material(SKIN_TONES[index % SKIN_TONES.length]);
  const hair = material(HAIR_TONES[index % HAIR_TONES.length]);

  const root = new Group();
  const torso = new Group();
  const head = new Group();
  root.add(torso);

  // Body: chest, shoulders, neck, skull.
  torso.add(cyl(0.49, 0.4, 1.3, primary, 0, 1.8, 0));
  torso.add(ball(0.48, primary, 0, 2.35, 0));
  torso.add(cyl(0.16, 0.16, 0.24, skin, 0, 2.65, 0));

  head.position.set(0, 2.98, 0);
  torso.add(head);
  head.add(ball(0.38, skin, 0, 0, 0));
  head.add(ball(0.4, hair, 0, 0.22, 0.03, 10));
  head.add(box(0.65, 0.12, 0.25, hair, 0, 0.27, -0.18));
  head.add(ball(0.034, EYE, -0.14, 0.02, -0.35, 8));
  head.add(ball(0.034, EYE, 0.14, 0.02, -0.35, 8));

  // Silhouette: long garments get an extra skirt volume.
  if (spec.silhouette === 'robe') {
    torso.add(cyl(0.68, 0.42, 1.7, primary, 0, 1.3, 0, 14));
  } else if (spec.silhouette === 'coat') {
    torso.add(cyl(0.56, 0.52, 1.1, primary, 0, 1.35, 0, 14));
  } else if (spec.silhouette === 'athletic') {
    torso.add(box(0.9, 0.5, 0.56, material(spec.accent), 0, 1.36, 0));
  }

  const armL = new Group();
  const armR = new Group();
  armL.position.set(-0.55, 2.32, 0);
  armR.position.set(0.55, 2.32, 0);
  torso.add(armL, armR);
  const sleeve = spec.silhouette === 'athletic' ? skin : primary;
  limb(armL, 0.17, 0.82, sleeve);
  limb(armR, 0.17, 0.82, sleeve);
  armL.add(ball(0.14, skin, 0, -0.9, 0, 10));
  armR.add(ball(0.14, skin, 0, -0.9, 0, 10));

  const legL = new Group();
  const legR = new Group();
  legL.position.set(-0.23, 1.15, 0);
  legR.position.set(0.23, 1.15, 0);
  root.add(legL, legR);
  const leg = spec.silhouette === 'athletic' ? material(spec.accent) : TROUSERS;
  limb(legL, 0.19, 0.96, leg);
  limb(legR, 0.19, 0.96, leg);
  legL.add(box(0.37, 0.16, 0.62, SHOE, 0, -1.0, -0.13));
  legR.add(box(0.37, 0.16, 0.62, SHOE, 0, -1.0, -0.13));

  const tag = label(resident.name, { background: '#0d1621e8', scale: 0.5 });
  // Stagger tag height so residents standing together do not stack their labels.
  tag.position.set(0, 4.3 + (index % 3) * 0.62, 0);
  root.add(tag);

  const rig: CharacterRig = { root, torso, armL, armR, legL, legR, head, tag };
  // addFeature parents head-worn pieces to the head group and the rest to the torso.
  for (const feature of spec.features) addFeature(rig, feature, spec);

  root.userData.residentId = resident.id;
  root.traverse((o) => {
    o.userData.residentId = resident.id;
  });

  return rig;
}
