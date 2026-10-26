/**
 * Resident models from Quaternius's Ultimate Animated Character Pack.
 *
 * Fifteen outfits, five women and ten men, all bound to the same 62-joint
 * `CharacterArmature`. The files were trimmed to the clips the campus uses
 * (see public/models/characters/License.txt). The meshes are skinned, so a
 * copy needs SkeletonUtils.clone to get its own bones.
 */
import { AnimationClip, Box3, Color, Mesh, MeshStandardMaterial, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const OUTFITS = [
  'suit-m', 'suit-f', 'worker-m', 'worker2-m', 'swat-m',
  'adventurer-m', 'adventurer-f', 'farmer-m', 'hoodie-m', 'casual-m',
  'casual-f', 'formal-f', 'punk-f', 'punk-m', 'beach-m',
] as const;
export type Outfit = (typeof OUTFITS)[number];

interface Source {
  scene: Object3D;
  clips: AnimationClip[];
  /** Bind-pose height in the file's own units. */
  height: number;
}

const sources = new Map<Outfit, Source>();

export async function loadResidentModel(): Promise<void> {
  const loader = new GLTFLoader();
  await Promise.all(
    OUTFITS.map(async (outfit) => {
      const gltf = await loader.loadAsync(`models/characters/${outfit}.glb`);
      const scene = gltf.scene;
      scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const old = object.material as MeshStandardMaterial;
        object.material = new MeshStandardMaterial({
          name: old.name,
          color: old.color,
          roughness: 0.78,
          metalness: 0,
        });
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = false;
      });
      scene.updateMatrixWorld(true);
      const height = new Box3().setFromObject(scene).getSize(new Vector3()).y;
      sources.set(outfit, { scene, clips: gltf.animations, height });
    }),
  );
}

export interface ResidentModel {
  body: Object3D;
  clips: AnimationClip[];
  height: number;
}

/** Material names the pack uses for skin and for hair. */
const SKIN = new Set(['Skin']);
const HAIR = new Set(['Hair', 'Hair_Brown', 'Hair_Blond']);

/**
 * A fresh, independently animated copy of an outfit with its own skin and hair
 * colour. Clothing materials stay shared across copies.
 */
export function cloneResident(outfit: Outfit, skin: string, hair: string): ResidentModel {
  const source = sources.get(outfit);
  if (!source) throw new Error('loadResidentModel() has to finish before residents are built');
  const body = cloneSkinned(source.scene);
  const skinMat = new Map<MeshStandardMaterial, MeshStandardMaterial>();
  body.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const list = Array.isArray(object.material) ? object.material : [object.material];
    const swapped = list.map((mat: MeshStandardMaterial) => {
      const tint = SKIN.has(mat.name) ? skin : HAIR.has(mat.name) ? hair : null;
      if (!tint) return mat;
      let copy = skinMat.get(mat);
      if (!copy) {
        copy = mat.clone();
        copy.color = new Color(tint);
        skinMat.set(mat, copy);
      }
      return copy;
    });
    object.material = Array.isArray(object.material) ? swapped : swapped[0];
  });
  return { body, clips: source.clips, height: source.height };
}
