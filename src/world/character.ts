/**
 * Residents.
 *
 * Each resident is a copy of one of the pack's fifteen outfits, picked from
 * their archetype and sex, with their own skin and hair colour.
 */
import { AnimationMixer, Group, type AnimationAction } from 'three';
import { ARCHETYPES, BUILDS, HAIR_TONES, SEXES, SKIN_TONES, type ArchetypeId } from '../data/archetypes';
import type { ResidentRecord } from '../data/districts';
import { cloneResident, type Outfit } from './model';

export type Pose = 'idle' | 'walk' | 'talk';

export interface CharacterRig {
  root: Group;
  /** Half the width of the shoulders, used for prop avoidance. */
  radius: number;
  /** Where a screen-space name label should sit, in local units. */
  labelHeight: number;
  play(pose: Pose): void;
  setStride(multiplier: number): void;
  update(dt: number): void;
}

const CLIP: Record<Pose, string> = { idle: 'Idle_Neutral', walk: 'Walk', talk: 'Idle' };

/** Top of the head on an average build, before build and sex scale it. */
const CROWN = 3;

/** Outfit per archetype, as [man, woman]. */
const WARDROBE: Record<ArchetypeId, [Outfit, Outfit]> = {
  director: ['suit-m', 'suit-f'],
  officer: ['swat-m', 'suit-f'],
  future: ['hoodie-m', 'punk-f'],
  scholar: ['casual-m', 'casual-f'],
  explorer: ['adventurer-m', 'adventurer-f'],
  scientist: ['casual-m', 'casual-f'],
  hacker: ['hoodie-m', 'punk-f'],
  security: ['swat-m', 'adventurer-f'],
  inventor: ['worker2-m', 'casual-f'],
  financier: ['suit-m', 'suit-f'],
  lawyer: ['suit-m', 'suit-f'],
  doctor: ['casual-m', 'formal-f'],
  trainer: ['beach-m', 'adventurer-f'],
  psych: ['suit-m', 'formal-f'],
  theologian: ['farmer-m', 'formal-f'],
  journalist: ['casual-m', 'casual-f'],
  creator: ['hoodie-m', 'punk-f'],
  writer: ['casual-m', 'casual-f'],
  designer: ['punk-m', 'punk-f'],
  musician: ['punk-m', 'formal-f'],
  critic: ['suit-m', 'formal-f'],
  builder: ['worker-m', 'casual-f'],
  gentleman: ['suit-m', 'formal-f'],
  chef: ['farmer-m', 'casual-f'],
  stylist: ['suit-m', 'suit-f'],
  mechanic: ['worker2-m', 'adventurer-f'],
  sports: ['beach-m', 'adventurer-f'],
  player: ['suit-m', 'formal-f'],
  racing: ['casual-m', 'casual-f'],
  fighter: ['beach-m', 'adventurer-f'],
  ranger: ['adventurer-m', 'adventurer-f'],
  agent: ['suit-m', 'suit-f'],
  detective: ['adventurer-m', 'suit-f'],
  oracle: ['hoodie-m', 'formal-f'],
  teacher: ['casual-m', 'casual-f'],
  collector: ['suit-m', 'formal-f'],
  tattoo: ['punk-m', 'punk-f'],
  philosopher: ['farmer-m', 'formal-f'],
  traveler: ['adventurer-m', 'adventurer-f'],
  naturalist: ['farmer-m', 'adventurer-f'],
};

export function buildCharacter(resident: ResidentRecord, index: number): CharacterRig {
  const spec = ARCHETYPES[resident.archetype];
  const { height, bulk } = BUILDS[spec.build];
  const tall = height * SEXES[resident.sex].stature;
  // The outfits are already sexed, so bulk only nudges the width.
  const wide = 1 + (bulk - 1) * 0.6;

  const outfit = WARDROBE[resident.archetype][resident.sex === 'm' ? 0 : 1];
  const skin = SKIN_TONES[(index * 3) % SKIN_TONES.length];
  const hair = HAIR_TONES[(index * 5) % HAIR_TONES.length];
  const { body, clips, height: modelHeight } = cloneResident(outfit, skin, hair);

  const fit = (CROWN * tall) / modelHeight;
  body.scale.set(body.scale.x * fit * wide, body.scale.y * fit, body.scale.z * fit * wide);
  // The pack faces +Z; steering works in -Z.
  body.rotation.y = Math.PI;
  const root = new Group();
  root.add(body);

  const mixer = new AnimationMixer(body);
  const actions = {} as Record<Pose, AnimationAction>;
  for (const pose of ['idle', 'walk', 'talk'] as Pose[]) {
    const clip = clips.find((c) => c.name === CLIP[pose]);
    if (!clip) throw new Error(`${outfit} has no clip named ${CLIP[pose]}`);
    const action = mixer.clipAction(clip);
    // Staggered, or forty residents breathe and step in lockstep.
    action.time = ((index * 0.37) % 1) * clip.duration;
    actions[pose] = action;
  }
  actions.idle.play();
  let current: Pose = 'idle';

  return {
    root,
    radius: 0.55 * wide,
    labelHeight: (CROWN + 0.4) * tall,
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
