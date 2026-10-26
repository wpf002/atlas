import {
  Color,
  MeshStandardMaterial,
  Vector2,
  type MeshStandardMaterialParameters,
} from 'three';
import { surface, type SurfaceKind } from './textures';

/**
 * The prototype allocated a fresh material for every mesh, which meant hundreds
 * of near-identical shader programs. Materials are cached by their parameters so
 * the whole campus shares a few dozen.
 */
const cache = new Map<string, MeshStandardMaterial>();

export function material(
  color: string,
  metalness = 0,
  roughness = 0.75,
  extra?: MeshStandardMaterialParameters,
  kind?: SurfaceKind,
): MeshStandardMaterial {
  const key = `${color}|${metalness}|${roughness}|${kind ?? ''}|${extra ? JSON.stringify(extra) : ''}`;
  let found = cache.get(key);
  if (!found) {
    const params: MeshStandardMaterialParameters = {
      color: new Color(color),
      metalness,
      roughness,
      ...extra,
    };
    if (kind) {
      const maps = surface(kind);
      params.map = maps.map;
      params.normalMap = maps.normalMap;
      params.roughnessMap = maps.roughnessMap;
      params.normalScale = new Vector2(maps.normalScale, maps.normalScale);
    }
    found = new MeshStandardMaterial(params);
    cache.set(key, found);
  }
  return found;
}

/** Shared surfaces used across the campus shell. */
export const SURFACES = {
  ground: material('#1f3330', 0, 0.95, undefined, 'foliage'),
  paving: material('#38474c', 0, 0.9, undefined, 'paving'),
  kerb: material('#9aa8aa', 0, 0.85, undefined, 'stone'),
  stone: material('#566573', 0, 0.85, undefined, 'stone'),
  concrete: material('#44525c', 0, 0.9, undefined, 'concrete'),
  wood: material('#6f5340', 0, 0.7, undefined, 'wood'),
  glass: material('#4e7f94', 0.3, 0.18),
  brass: material('#c49a5e', 0.65, 0.3, undefined, 'metal'),
  leaf: material('#3c6b4f', 0, 0.82, undefined, 'foliage'),
  leafDark: material('#2f5742', 0, 0.82, undefined, 'foliage'),
  iron: material('#222c35', 0.5, 0.45, undefined, 'metal'),
  canvas: material('#cdc0a6', 0, 0.88, undefined, 'fabric'),
};

/** Emissive material for anything that should read as lit after dark. */
export function lamp(color: string, intensity = 1.6): MeshStandardMaterial {
  return material(color, 0, 0.4, { emissive: new Color(color), emissiveIntensity: intensity });
}
