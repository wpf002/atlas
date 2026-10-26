/**
 * Costume system. Every resident maps to one archetype, and an archetype is a
 * garment silhouette plus a set of features the character builder knows how to
 * assemble. Adding a look means adding an entry here, not editing the rig.
 */

/**
 * Sex. Residents are built from one rig, so everything that differs between
 * the men and the women on the campus is a number in SEXES below.
 */
export type Sex = 'f' | 'm';

export interface SexTraits {
  /** Skull width against height. Below 1 narrows the face. */
  narrow: number;
  /** How hard the jaw pulls in below the cheek. Higher is a pointier chin. */
  jaw: number;
  /** Brow ridge height. */
  brow: number;
  /** Cheek fullness. */
  cheek: number;
  /** Eye size. */
  eye: number;
  /** Mouth width. */
  mouth: number;
  /** Shoulder width. */
  shoulder: number;
  /** Waist width. */
  waist: number;
  /** Hip width. */
  hip: number;
  /** Neck thickness. */
  neck: number;
  /** Overall height, on top of the build's own. */
  stature: number;
}

export const SEXES: Record<Sex, SexTraits> = {
  f: {
    narrow: 0.86, jaw: 0.56, brow: 0.45, cheek: 1.25, eye: 1.1, mouth: 1.12,
    shoulder: 0.9, waist: 0.9, hip: 1.1, neck: 0.86, stature: 0.95,
  },
  m: {
    narrow: 0.92, jaw: 0.4, brow: 1, cheek: 1, eye: 1, mouth: 1,
    shoulder: 1.06, waist: 1, hip: 0.97, neck: 1, stature: 1,
  },
};

/** Hair silhouettes the head builder knows how to cut. */
export type HairStyle = 'crop' | 'swept' | 'bob' | 'long' | 'bun';

/** Cycled by resident index, so the campus is not forty of one haircut. */
export const HAIR_STYLES: Record<Sex, HairStyle[]> = {
  f: ['long', 'bob', 'bun', 'bob'],
  m: ['crop', 'swept', 'crop'],
};

export type Silhouette =
  | 'tailored'
  | 'coat'
  | 'robe'
  | 'casual'
  | 'work'
  | 'athletic'
  | 'uniform';

/** Body shape. The rig scales height and shoulder width from this. */
export type Build = 'slight' | 'lean' | 'average' | 'solid' | 'heavy';

export const BUILDS: Record<Build, { height: number; bulk: number }> = {
  slight: { height: 0.92, bulk: 0.86 },
  lean: { height: 1.05, bulk: 0.9 },
  average: { height: 1.0, bulk: 1.0 },
  solid: { height: 1.05, bulk: 1.12 },
  heavy: { height: 0.96, bulk: 1.26 },
};

export type Feature =
  | 'tie'
  | 'bowtie'
  | 'lapels'
  | 'apron'
  | 'brimHat'
  | 'cap'
  | 'chefHat'
  | 'glasses'
  | 'shades'
  | 'headset'
  | 'visor'
  | 'gloves'
  | 'toolbelt'
  | 'satchel'
  | 'stethoscope'
  | 'scarf'
  | 'hood'
  | 'wristbands'
  | 'pocketSquare';

export interface ArchetypeSpec {
  /** Main garment colour. */
  primary: string;
  /** Trim, lining and feature colour. */
  accent: string;
  /** Trousers, skirt or shorts. */
  legs: string;
  silhouette: Silhouette;
  build: Build;
  features: Feature[];
}

export const ARCHETYPES = {
  director: { primary: '#263b50', accent: '#e5c4a1', legs: '#1d2d3c', silhouette: 'tailored', build: 'solid', features: ['lapels', 'pocketSquare'] },
  officer: { primary: '#3c494c', accent: '#d2ae7c', legs: '#2d383b', silhouette: 'uniform', build: 'solid', features: ['cap', 'gloves'] },
  future: { primary: '#343c62', accent: '#6ec6c3', legs: '#262c47', silhouette: 'coat', build: 'lean', features: ['visor'] },
  scholar: { primary: '#665248', accent: '#c9ac87', legs: '#4a3c34', silhouette: 'casual', build: 'average', features: ['glasses', 'scarf'] },
  explorer: { primary: '#8e704a', accent: '#d9b88d', legs: '#5d4a31', silhouette: 'coat', build: 'solid', features: ['brimHat', 'satchel'] },
  scientist: { primary: '#e5e9e6', accent: '#74c5ca', legs: '#3c4450', silhouette: 'coat', build: 'lean', features: ['glasses', 'apron'] },
  hacker: { primary: '#172b37', accent: '#42d2c8', legs: '#1f2b33', silhouette: 'casual', build: 'slight', features: ['hood', 'headset'] },
  security: { primary: '#1d343e', accent: '#6fbfc4', legs: '#16272e', silhouette: 'uniform', build: 'heavy', features: ['headset', 'gloves'] },
  inventor: { primary: '#876b4a', accent: '#d2a55c', legs: '#5b4631', silhouette: 'work', build: 'solid', features: ['apron', 'visor', 'toolbelt'] },
  financier: { primary: '#28374d', accent: '#d9b98a', legs: '#1e2a3a', silhouette: 'tailored', build: 'average', features: ['tie', 'lapels'] },
  lawyer: { primary: '#2c303e', accent: '#d7bdac', legs: '#22252f', silhouette: 'tailored', build: 'average', features: ['tie', 'lapels', 'satchel'] },
  doctor: { primary: '#e9e9e2', accent: '#6abdb5', legs: '#3d4a55', silhouette: 'coat', build: 'average', features: ['stethoscope', 'glasses'] },
  trainer: { primary: '#45645d', accent: '#d0dcd0', legs: '#2f4a45', silhouette: 'athletic', build: 'solid', features: ['wristbands', 'cap'] },
  psych: { primary: '#846d85', accent: '#d6b5c6', legs: '#5c4c5d', silhouette: 'tailored', build: 'slight', features: ['lapels', 'glasses'] },
  theologian: { primary: '#50463e', accent: '#d8c5a1', legs: '#3a332d', silhouette: 'robe', build: 'average', features: ['scarf'] },
  journalist: { primary: '#5b6d78', accent: '#d4b8a0', legs: '#414e57', silhouette: 'coat', build: 'lean', features: ['satchel', 'cap'] },
  creator: { primary: '#af705e', accent: '#f4c88b', legs: '#6d4338', silhouette: 'casual', build: 'average', features: ['cap', 'headset'] },
  writer: { primary: '#56506c', accent: '#d6bba4', legs: '#3c3849', silhouette: 'casual', build: 'slight', features: ['glasses', 'scarf'] },
  designer: { primary: '#c27f66', accent: '#ebd1b6', legs: '#7c4f41', silhouette: 'casual', build: 'lean', features: ['glasses'] },
  musician: { primary: '#2d2c3d', accent: '#c4a2c8', legs: '#1f1e2b', silhouette: 'tailored', build: 'slight', features: ['bowtie', 'lapels'] },
  critic: { primary: '#526374', accent: '#c6b6a1', legs: '#3a4652', silhouette: 'coat', build: 'heavy', features: ['glasses', 'scarf'] },
  builder: { primary: '#c1a061', accent: '#f4d88b', legs: '#8a7343', silhouette: 'work', build: 'heavy', features: ['cap', 'toolbelt', 'gloves'] },
  gentleman: { primary: '#523b3b', accent: '#d7b58a', legs: '#3a2929', silhouette: 'tailored', build: 'heavy', features: ['bowtie', 'pocketSquare'] },
  chef: { primary: '#f2eee4', accent: '#a4b4b9', legs: '#4a4a52', silhouette: 'coat', build: 'heavy', features: ['chefHat', 'apron'] },
  stylist: { primary: '#45404c', accent: '#c7a9a5', legs: '#322e38', silhouette: 'tailored', build: 'lean', features: ['pocketSquare', 'shades'] },
  mechanic: { primary: '#345568', accent: '#9bc3c8', legs: '#243c49', silhouette: 'work', build: 'solid', features: ['toolbelt', 'gloves', 'cap'] },
  sports: { primary: '#3e566d', accent: '#d1dbe2', legs: '#2c3d4e', silhouette: 'athletic', build: 'heavy', features: ['headset', 'cap'] },
  player: { primary: '#54465d', accent: '#e3bd89', legs: '#3c3143', silhouette: 'tailored', build: 'lean', features: ['shades', 'pocketSquare'] },
  racing: { primary: '#527a6d', accent: '#e2c79d', legs: '#3a584e', silhouette: 'coat', build: 'average', features: ['cap', 'glasses'] },
  fighter: { primary: '#8a514b', accent: '#caa28c', legs: '#633934', silhouette: 'athletic', build: 'heavy', features: ['gloves', 'wristbands'] },
  ranger: { primary: '#667b4b', accent: '#d0bd8d', legs: '#495634', silhouette: 'work', build: 'average', features: ['brimHat', 'satchel', 'gloves'] },
  agent: { primary: '#222a34', accent: '#e1e0d9', legs: '#171d24', silhouette: 'tailored', build: 'solid', features: ['shades', 'tie', 'lapels'] },
  detective: { primary: '#7c6b58', accent: '#d3bda1', legs: '#564839', silhouette: 'coat', build: 'heavy', features: ['brimHat', 'glasses'] },
  oracle: { primary: '#625b86', accent: '#b9b2df', legs: '#464168', silhouette: 'robe', build: 'slight', features: ['hood'] },
  teacher: { primary: '#59788c', accent: '#c7e0e7', legs: '#3f5463', silhouette: 'casual', build: 'average', features: ['glasses', 'satchel'] },
  collector: { primary: '#5c5a63', accent: '#d7b889', legs: '#403f46', silhouette: 'tailored', build: 'average', features: ['glasses', 'gloves'] },
  tattoo: { primary: '#36313e', accent: '#d68e8d', legs: '#26232b', silhouette: 'casual', build: 'solid', features: ['cap', 'gloves'] },
  philosopher: { primary: '#c8c1ad', accent: '#eee1b9', legs: '#9a957f', silhouette: 'robe', build: 'heavy', features: [] },
  traveler: { primary: '#88704b', accent: '#c9ae80', legs: '#5e4c33', silhouette: 'coat', build: 'average', features: ['brimHat', 'satchel', 'shades'] },
  naturalist: { primary: '#53765a', accent: '#a7c68d', legs: '#3a5440', silhouette: 'work', build: 'lean', features: ['brimHat', 'satchel', 'glasses'] },
} as const satisfies Record<string, ArchetypeSpec>;

export type ArchetypeId = keyof typeof ARCHETYPES;

/** Skin and hair ranges, cycled by resident index so the campus is not uniform. */
export const SKIN_TONES = ['#c0906f', '#9f6647', '#c79b7a', '#7b4e3a', '#ad7a55', '#8f583d', '#c3955f'];
export const HAIR_TONES = ['#241c20', '#584235', '#b6a08b', '#2a333c', '#694a35', '#3b2a24', '#8b8c93'];
