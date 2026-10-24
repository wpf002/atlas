/**
 * Costume system. Every resident maps to one archetype, and an archetype is a
 * garment silhouette plus a set of features the character builder knows how to
 * assemble. Adding a look means adding an entry here, not editing the rig.
 */

export type Silhouette =
  | 'tailored'
  | 'coat'
  | 'robe'
  | 'casual'
  | 'work'
  | 'athletic'
  | 'uniform';

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
  silhouette: Silhouette;
  features: Feature[];
}

export const ARCHETYPES = {
  director: { primary: '#263b50', accent: '#e5c4a1', silhouette: 'tailored', features: ['lapels', 'pocketSquare'] },
  officer: { primary: '#3c494c', accent: '#d2ae7c', silhouette: 'uniform', features: ['cap', 'gloves'] },
  future: { primary: '#343c62', accent: '#6ec6c3', silhouette: 'coat', features: ['visor'] },
  scholar: { primary: '#665248', accent: '#c9ac87', silhouette: 'casual', features: ['glasses', 'scarf'] },
  explorer: { primary: '#8e704a', accent: '#d9b88d', silhouette: 'coat', features: ['brimHat', 'satchel'] },
  scientist: { primary: '#e5e9e6', accent: '#74c5ca', silhouette: 'coat', features: ['glasses', 'apron'] },
  hacker: { primary: '#172b37', accent: '#42d2c8', silhouette: 'casual', features: ['hood', 'headset'] },
  security: { primary: '#1d343e', accent: '#6fbfc4', silhouette: 'uniform', features: ['headset', 'gloves'] },
  inventor: { primary: '#876b4a', accent: '#d2a55c', silhouette: 'work', features: ['apron', 'visor', 'toolbelt'] },
  financier: { primary: '#28374d', accent: '#d9b98a', silhouette: 'tailored', features: ['tie', 'lapels'] },
  lawyer: { primary: '#2c303e', accent: '#d7bdac', silhouette: 'tailored', features: ['tie', 'lapels', 'satchel'] },
  doctor: { primary: '#e9e9e2', accent: '#6abdb5', silhouette: 'coat', features: ['stethoscope', 'glasses'] },
  trainer: { primary: '#45645d', accent: '#d0dcd0', silhouette: 'athletic', features: ['wristbands', 'cap'] },
  psych: { primary: '#846d85', accent: '#d6b5c6', silhouette: 'tailored', features: ['lapels', 'glasses'] },
  theologian: { primary: '#50463e', accent: '#d8c5a1', silhouette: 'robe', features: ['scarf'] },
  journalist: { primary: '#5b6d78', accent: '#d4b8a0', silhouette: 'coat', features: ['satchel', 'cap'] },
  creator: { primary: '#af705e', accent: '#f4c88b', silhouette: 'casual', features: ['cap', 'headset'] },
  writer: { primary: '#56506c', accent: '#d6bba4', silhouette: 'casual', features: ['glasses', 'scarf'] },
  designer: { primary: '#c27f66', accent: '#ebd1b6', silhouette: 'casual', features: ['glasses'] },
  musician: { primary: '#2d2c3d', accent: '#c4a2c8', silhouette: 'tailored', features: ['bowtie', 'lapels'] },
  critic: { primary: '#526374', accent: '#c6b6a1', silhouette: 'coat', features: ['glasses', 'scarf'] },
  builder: { primary: '#c1a061', accent: '#f4d88b', silhouette: 'work', features: ['cap', 'toolbelt', 'gloves'] },
  gentleman: { primary: '#523b3b', accent: '#d7b58a', silhouette: 'tailored', features: ['bowtie', 'pocketSquare'] },
  chef: { primary: '#f2eee4', accent: '#a4b4b9', silhouette: 'coat', features: ['chefHat', 'apron'] },
  stylist: { primary: '#45404c', accent: '#c7a9a5', silhouette: 'tailored', features: ['pocketSquare', 'shades'] },
  mechanic: { primary: '#345568', accent: '#9bc3c8', silhouette: 'work', features: ['toolbelt', 'gloves', 'cap'] },
  sports: { primary: '#3e566d', accent: '#d1dbe2', silhouette: 'athletic', features: ['headset', 'cap'] },
  player: { primary: '#54465d', accent: '#e3bd89', silhouette: 'tailored', features: ['shades', 'pocketSquare'] },
  racing: { primary: '#527a6d', accent: '#e2c79d', silhouette: 'coat', features: ['cap', 'glasses'] },
  fighter: { primary: '#8a514b', accent: '#caa28c', silhouette: 'athletic', features: ['gloves', 'wristbands'] },
  ranger: { primary: '#667b4b', accent: '#d0bd8d', silhouette: 'work', features: ['brimHat', 'satchel', 'gloves'] },
  agent: { primary: '#222a34', accent: '#e1e0d9', silhouette: 'tailored', features: ['shades', 'tie', 'lapels'] },
  detective: { primary: '#7c6b58', accent: '#d3bda1', silhouette: 'coat', features: ['brimHat', 'glasses'] },
  oracle: { primary: '#625b86', accent: '#b9b2df', silhouette: 'robe', features: ['hood'] },
  teacher: { primary: '#59788c', accent: '#c7e0e7', silhouette: 'casual', features: ['glasses', 'satchel'] },
  collector: { primary: '#5c5a63', accent: '#d7b889', silhouette: 'tailored', features: ['glasses', 'gloves'] },
  tattoo: { primary: '#36313e', accent: '#d68e8d', silhouette: 'casual', features: ['cap', 'gloves'] },
  philosopher: { primary: '#c8c1ad', accent: '#eee1b9', silhouette: 'robe', features: [] },
  traveler: { primary: '#88704b', accent: '#c9ae80', silhouette: 'coat', features: ['brimHat', 'satchel', 'shades'] },
  naturalist: { primary: '#53765a', accent: '#a7c68d', silhouette: 'work', features: ['brimHat', 'satchel', 'glasses'] },
} as const satisfies Record<string, ArchetypeSpec>;

export type ArchetypeId = keyof typeof ARCHETYPES;

/** Skin and hair ranges, cycled by resident index so the campus is not uniform. */
export const SKIN_TONES = ['#e7b28f', '#b67a58', '#f0c6a4', '#8f5e47', '#d59b73', '#a86b4c', '#eec0a0'];
export const HAIR_TONES = ['#241c20', '#584235', '#b6a08b', '#2a333c', '#694a35', '#3b2a24', '#8b8c93'];
