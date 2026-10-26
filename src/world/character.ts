/**
 * Residents.
 *
 * Every resident is one clone of the shared blocky rig wearing a texture
 * painted for their archetype. The previous build sculpted each person out of
 * lathed and merged geometry, which cost forty unique meshes and still read as
 * a mannequin. A stylized rig with a drawn face reads as a person at any
 * distance and costs one geometry for the whole campus.
 */
import { AnimationMixer, Group, Mesh, MeshStandardMaterial, type AnimationAction } from 'three';
import { ARCHETYPES, BUILDS, SEXES } from '../data/archetypes';
import type { ResidentRecord } from '../data/districts';
import { clipNamed, cloneResident } from './model';
import { residentTexture } from './skin';

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

/** Which of the pack's twenty-seven clips each pose uses. */
const CLIP: Record<Pose, string> = { idle: 'idle', walk: 'walk', talk: 'emote-yes' };

/** Top of the head on an average build, before build and sex scale it. */
const CROWN = 3;

export function buildCharacter(resident: ResidentRecord, index: number): CharacterRig {
  const spec = ARCHETYPES[resident.archetype];
  const { height, bulk } = BUILDS[spec.build];
  const traits = SEXES[resident.sex];
  const tall = height * traits.stature;
  const wide = bulk * traits.shoulder;

  const { root, body } = cloneResident();
  body.scale.set(body.scale.x * wide, body.scale.y * tall, body.scale.z * bulk);

  const map = residentTexture(resident, index);
  const material = new MeshStandardMaterial({ map, roughness: 0.82, metalness: 0 });
  body.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.material = material;
    object.castShadow = true;
    object.receiveShadow = true;
  });

  const mixer = new AnimationMixer(body);
  const actions = {} as Record<Pose, AnimationAction>;
  for (const pose of ['idle', 'walk', 'talk'] as Pose[]) {
    const clip = clipNamed(CLIP[pose]);
    const action = mixer.clipAction(clip);
    // Staggered, or forty residents breathe and step in lockstep.
    action.time = ((index * 0.37) % 1) * clip.duration;
    actions[pose] = action;
  }
  actions.idle.play();
  let current: Pose = 'idle';

  return {
    root,
    radius: 0.6 * wide,
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
