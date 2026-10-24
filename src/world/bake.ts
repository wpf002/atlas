import { Group, Mesh, Sprite, Vector3, type BufferGeometry, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The campus is static once built, so every mesh sharing a material is merged
 * into one. That takes the shell from ~2,000 draw calls to roughly one per
 * material, which is the difference between 20fps and a locked frame rate.
 * Sprites cannot merge, so they are re-parented with their world position kept.
 */
export function bakeStatic(source: Group): Group {
  source.updateMatrixWorld(true);

  const buckets = new Map<Material, BufferGeometry[]>();
  const sprites: { sprite: Sprite; position: Vector3 }[] = [];

  source.traverse((object) => {
    if (object instanceof Mesh) {
      const material = object.material as Material;
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      const bucket = buckets.get(material);
      if (bucket) bucket.push(geometry);
      else buckets.set(material, [geometry]);
    } else if (object instanceof Sprite) {
      sprites.push({ sprite: object, position: object.getWorldPosition(new Vector3()) });
    }
  });

  const baked = new Group();
  baked.name = 'campus';

  for (const [material, geometries] of buckets) {
    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    if (!merged) continue;
    const mesh = new Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    baked.add(mesh);
  }

  for (const { sprite, position } of sprites) {
    sprite.removeFromParent();
    sprite.position.copy(position);
    baked.add(sprite);
  }

  return baked;
}
