/**
 * The one mesh every resident is built from.
 *
 * All forty residents share a single blocky rig loaded once at boot: six boxes
 * on a seven-node hierarchy with twenty-seven baked clips. The rig has no skin
 * weights, so a plain clone is a complete, independently animatable copy — no
 * skeleton rebinding and no per-resident geometry.
 */
import { AnimationClip, Group, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** The pack ships the rig 2.7 units tall; the campus expects a 3-unit person. */
const FIT = 3 / 2.7;

let source: Object3D | null = null;
let library: AnimationClip[] = [];

export async function loadResidentModel(): Promise<void> {
  const gltf = await new GLTFLoader().loadAsync('models/characters/resident.glb');
  source = gltf.scene;
  library = gltf.animations;
  // The pack marks its material unlit, which ignores the sun and the sky grade
  // entirely. Residents have to take the same light as the buildings do.
  source.traverse((object) => {
    if (object instanceof Mesh) object.material = new MeshStandardMaterial({ roughness: 0.82 });
  });
}

export function clipNamed(name: string): AnimationClip {
  const found = library.find((clip) => clip.name === name);
  if (!found) throw new Error(`resident.glb has no clip named ${name}`);
  return found;
}

/**
 * A fresh copy of the rig, already scaled to campus units and turned to face
 * -Z, which is the heading the steering code works in.
 */
export function cloneResident(): { root: Group; body: Object3D } {
  if (!source) throw new Error('loadResidentModel() has to finish before residents are built');
  const body = source.clone(true);
  body.scale.setScalar(FIT);
  body.rotation.y = Math.PI;
  const root = new Group();
  root.add(body);
  return { root, body };
}
