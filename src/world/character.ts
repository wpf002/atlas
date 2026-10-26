import { Group, type Object3D, type Sprite } from 'three';
import {
  ARCHETYPES,
  BUILDS,
  HAIR_TONES,
  SKIN_TONES,
  type ArchetypeSpec,
  type Feature,
} from '../data/archetypes';
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
  /** Half the width of the widest garment, used for prop avoidance. */
  radius: number;
}

const SHOE = material('#1e2228');
const EYE = material('#161e27');
const LEATHER = material('#6b5336');

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
      torso.add(box(0.2, 0.92, 0.08, accent, 0, 1.92, -0.5));
      torso.add(box(0.22, 0.16, 0.09, accent, 0, 2.42, -0.5));
      break;
    case 'bowtie':
      torso.add(box(0.46, 0.2, 0.12, accent, 0, 2.36, -0.5));
      torso.add(box(0.12, 0.12, 0.13, material(spec.primary, 0, 0.55), 0, 2.36, -0.52));
      break;
    case 'lapels':
      torso.add(box(0.8, 0.62, 0.07, material(spec.primary, 0, 0.45), 0, 2.14, -0.51));
      torso.add(box(0.26, 0.5, 0.08, accent, 0, 2.3, -0.52));
      break;
    case 'pocketSquare':
      torso.add(box(0.2, 0.13, 0.07, accent, -0.34, 2.14, -0.5));
      break;
    case 'apron':
      torso.add(box(0.84, 1.12, 0.1, accent, 0, 1.66, -0.5));
      torso.add(box(0.16, 0.56, 0.08, accent, -0.32, 2.34, -0.47));
      torso.add(box(0.16, 0.56, 0.08, accent, 0.32, 2.34, -0.47));
      break;
    case 'toolbelt':
      torso.add(box(1.16, 0.22, 0.88, LEATHER, 0, 1.3, 0));
      torso.add(box(0.2, 0.34, 0.16, material('#8d8f94'), 0.46, 1.18, -0.3));
      torso.add(box(0.16, 0.28, 0.14, material('#c0922f'), -0.46, 1.2, -0.26));
      break;
    case 'gloves':
      rig.armL.add(ball(0.21, accent, 0, -0.9, 0, 10));
      rig.armR.add(ball(0.21, accent, 0, -0.9, 0, 10));
      break;
    case 'wristbands':
      rig.armL.add(cyl(0.23, 0.23, 0.16, accent, 0, -0.72, 0, 10));
      rig.armR.add(cyl(0.23, 0.23, 0.16, accent, 0, -0.72, 0, 10));
      break;
    case 'satchel':
      torso.add(box(0.6, 0.46, 0.26, LEATHER, 0.46, 1.5, 0.2));
      torso.add(box(0.12, 1.0, 0.07, LEATHER, 0.12, 2.08, -0.3));
      break;
    case 'stethoscope':
      torso.add(cyl(0.24, 0.24, 0.1, accent, -0.24, 2.42, -0.36, 10));
      torso.add(box(0.62, 0.09, 0.09, accent, 0, 2.54, -0.4));
      torso.add(box(0.09, 0.44, 0.09, accent, 0.3, 2.34, -0.38));
      break;
    case 'scarf':
      torso.add(cyl(0.5, 0.48, 0.3, accent, 0, 2.58, 0, 12));
      torso.add(box(0.22, 0.66, 0.12, accent, 0.16, 2.2, -0.44));
      break;
    case 'brimHat':
      head.add(cyl(0.68, 0.68, 0.08, material('#6f5a3b'), 0, 0.4, 0, 16));
      head.add(cyl(0.36, 0.4, 0.36, material('#6f5a3b'), 0, 0.6, 0, 16));
      head.add(cyl(0.41, 0.41, 0.09, material(spec.accent), 0, 0.46, 0, 16));
      break;
    case 'cap':
      head.add(cyl(0.4, 0.42, 0.26, accent, 0, 0.46, 0, 16));
      head.add(box(0.66, 0.06, 0.42, accent, 0, 0.36, -0.38));
      break;
    case 'chefHat':
      head.add(cyl(0.44, 0.42, 0.8, material('#f6f2e9'), 0, 0.78, 0, 16));
      break;
    case 'glasses':
      head.add(box(0.76, 0.17, 0.07, material('#2d343c'), 0, 0.04, -0.34));
      head.add(box(0.14, 0.05, 0.3, material('#2d343c'), -0.36, 0.06, -0.2));
      head.add(box(0.14, 0.05, 0.3, material('#2d343c'), 0.36, 0.06, -0.2));
      break;
    case 'shades':
      head.add(box(0.8, 0.23, 0.09, material('#12181f'), 0, 0.05, -0.33));
      head.add(box(0.14, 0.05, 0.3, material('#12181f'), -0.37, 0.07, -0.2));
      head.add(box(0.14, 0.05, 0.3, material('#12181f'), 0.37, 0.07, -0.2));
      break;
    case 'headset':
      head.add(box(0.84, 0.12, 0.12, accent, 0, 0.3, 0));
      head.add(ball(0.16, accent, -0.4, 0.1, 0, 8));
      head.add(ball(0.16, accent, 0.4, 0.1, 0, 8));
      head.add(box(0.34, 0.06, 0.06, accent, 0.22, -0.08, -0.28));
      break;
    case 'visor':
      head.add(box(0.84, 0.26, 0.1, accent, 0, 0.06, -0.32));
      head.add(box(0.86, 0.1, 0.12, primary, 0, 0.3, -0.12));
      break;
    case 'hood':
      torso.add(ball(0.58, primary, 0, 2.52, 0.26, 10));
      torso.add(cyl(0.56, 0.46, 0.34, primary, 0, 2.54, 0, 12));
      break;
  }
}

/**
 * Garment volume per silhouette. Every silhouette adds real geometry, so two
 * residents in the same colour still read as different roles from across the
 * plaza.
 */
/** Garment half-widths: `shoulder` places the arms, `hem` sizes prop avoidance. */
interface Garment {
  shoulder: number;
  hem: number;
}

function addSilhouette(torso: Group, spec: ArchetypeSpec): Garment {
  const primary = material(spec.primary);
  const accent = material(spec.accent);
  const legs = material(spec.legs);
  const shade = material(spec.primary, 0, 0.45);

  switch (spec.silhouette) {
    case 'tailored':
      // Structured jacket: padded shoulders, nipped waist, short flared hem.
      torso.add(cyl(0.52, 0.6, 1.3, primary, 0, 1.78, 0, 16));
      torso.add(box(1.1, 0.16, 0.64, primary, 0, 2.42, 0));
      torso.add(cyl(0.61, 0.61, 0.08, shade, 0, 1.16, 0, 16));
      return { shoulder: 0.56, hem: 0.61 };
    case 'uniform':
      // Fitted tunic with a belt and epaulettes.
      torso.add(cyl(0.53, 0.57, 1.38, primary, 0, 1.74, 0, 16));
      torso.add(cyl(0.59, 0.59, 0.18, accent, 0, 1.32, 0, 16));
      torso.add(box(0.32, 0.1, 0.3, accent, -0.47, 2.46, 0));
      torso.add(box(0.32, 0.1, 0.3, accent, 0.47, 2.46, 0));
      return { shoulder: 0.54, hem: 0.6 };
    case 'casual':
      // Loose sweatshirt, cropped at the hip with a ribbed hem.
      torso.add(cyl(0.6, 0.62, 1.06, primary, 0, 1.92, 0, 14));
      torso.add(cyl(0.62, 0.62, 0.16, accent, 0, 1.44, 0, 14));
      return { shoulder: 0.6, hem: 0.62 };
    case 'work':
      // Coveralls: wide hips, chest bib, braces over the shoulders.
      torso.add(cyl(0.56, 0.64, 1.36, primary, 0, 1.76, 0, 14));
      torso.add(box(0.7, 0.66, 0.08, accent, 0, 2.12, -0.52));
      torso.add(box(0.14, 0.52, 0.08, primary, -0.3, 2.4, -0.48));
      torso.add(box(0.14, 0.52, 0.08, primary, 0.3, 2.4, -0.48));
      return { shoulder: 0.57, hem: 0.66 };
    case 'coat':
      // Long coat to the knee, standing collar, centre placket.
      torso.add(cyl(0.58, 0.66, 1.42, primary, 0, 1.56, 0, 16));
      torso.add(cyl(0.52, 0.46, 0.3, accent, 0, 2.54, 0, 14));
      torso.add(box(0.14, 1.34, 0.07, shade, 0, 1.56, -0.56));
      return { shoulder: 0.59, hem: 0.68 };
    case 'robe':
      // Floor-length robe over a cord belt.
      torso.add(cyl(0.5, 0.78, 1.86, primary, 0, 1.3, 0, 16));
      torso.add(cyl(0.58, 0.58, 0.12, accent, 0, 1.8, 0, 14));
      return { shoulder: 0.53, hem: 0.78 };
    case 'athletic':
      // Tank top and shorts, so the arms and calves stay bare.
      torso.add(box(0.9, 0.86, 0.58, accent, 0, 1.94, 0));
      torso.add(cyl(0.54, 0.58, 0.56, legs, 0, 1.3, 0, 14));
      return { shoulder: 0.47, hem: 0.58 };
  }
}

/** Builds one resident: body rig, costume, and the floating name tag. */
export function buildCharacter(resident: ResidentRecord, index: number): CharacterRig {
  const spec = ARCHETYPES[resident.archetype];
  const { height, bulk } = BUILDS[spec.build];
  const primary = material(spec.primary);
  const skin = material(SKIN_TONES[index % SKIN_TONES.length]);
  const hair = material(HAIR_TONES[index % HAIR_TONES.length]);
  const athletic = spec.silhouette === 'athletic';

  const root = new Group();
  const torso = new Group();
  const head = new Group();
  root.add(torso);
  // Height scales the whole rig about the feet; bulk widens the torso only.
  root.scale.setScalar(height);
  torso.scale.set(bulk, 1, bulk);

  // Body: chest, shoulders, neck, skull.
  torso.add(cyl(0.49, 0.4, 1.3, athletic ? skin : primary, 0, 1.8, 0));
  torso.add(ball(0.48, athletic ? skin : primary, 0, 2.35, 0));
  torso.add(cyl(0.16, 0.16, 0.24, skin, 0, 2.65, 0));

  head.position.set(0, 2.98, 0);
  // Cancel the torso's bulk so a heavy build does not get a bigger head.
  head.scale.set(1 / bulk, 1, 1 / bulk);
  torso.add(head);
  head.add(ball(0.38, skin, 0, 0, 0));
  head.add(ball(0.4, hair, 0, 0.22, 0.03, 10));
  head.add(box(0.65, 0.12, 0.25, hair, 0, 0.27, -0.18));
  head.add(ball(0.034, EYE, -0.14, 0.02, -0.35, 8));
  head.add(ball(0.034, EYE, 0.14, 0.02, -0.35, 8));

  const garment = addSilhouette(torso, spec);

  const armL = new Group();
  const armR = new Group();
  // Sit the arms at the garment's shoulder, or a flared coat swallows them.
  const reach = Math.max(0.55, garment.shoulder + 0.06);
  armL.position.set(-reach, 2.32, 0);
  armR.position.set(reach, 2.32, 0);
  torso.add(armL, armR);
  const sleeve = athletic ? skin : primary;
  limb(armL, 0.17, 0.82, sleeve);
  limb(armR, 0.17, 0.82, sleeve);
  armL.add(ball(0.14, skin, 0, -0.9, 0, 10));
  armR.add(ball(0.14, skin, 0, -0.9, 0, 10));

  const legL = new Group();
  const legR = new Group();
  legL.position.set(-0.23 * bulk, 1.15, 0);
  legR.position.set(0.23 * bulk, 1.15, 0);
  root.add(legL, legR);
  const leg = athletic ? skin : material(spec.legs);
  limb(legL, 0.19 * bulk, 0.96, leg);
  limb(legR, 0.19 * bulk, 0.96, leg);
  const shoe = athletic ? material(spec.accent) : SHOE;
  legL.add(box(0.37, 0.16, 0.62, shoe, 0, -1.0, -0.13));
  legR.add(box(0.37, 0.16, 0.62, shoe, 0, -1.0, -0.13));

  const tag = label(resident.name, { background: '#0d1621e8', scale: 0.42 });
  // Stagger tag height so residents standing together do not stack their labels.
  tag.position.set(0, (4.5 + (index % 5) * 0.56) / height, 0);
  root.add(tag);

  const radius = garment.hem * bulk * height;
  const rig: CharacterRig = { root, torso, armL, armR, legL, legR, head, tag, radius };
  // addFeature parents head-worn pieces to the head group and the rest to the torso.
  for (const feature of spec.features) addFeature(rig, feature, spec);

  root.userData.residentId = resident.id;
  root.traverse((o) => {
    o.userData.residentId = resident.id;
  });

  return rig;
}
