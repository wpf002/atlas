import {
  Color,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
} from 'three';

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
): MeshStandardMaterial {
  const key = `${color}|${metalness}|${roughness}|${extra ? JSON.stringify(extra) : ''}`;
  let found = cache.get(key);
  if (!found) {
    found = new MeshStandardMaterial({ color: new Color(color), metalness, roughness, ...extra });
    cache.set(key, found);
  }
  return found;
}

/** Shared surfaces used across the campus shell. */
export const SURFACES = {
  ground: material('#1f3330'),
  paving: material('#38474c'),
  kerb: material('#9aa8aa'),
  stone: material('#566573'),
  concrete: material('#44525c'),
  wood: material('#6f5340'),
  glass: material('#4e7f94', 0.3, 0.18),
  brass: material('#c49a5e', 0.65, 0.3),
  leaf: material('#3c6b4f'),
  leafDark: material('#2f5742'),
  iron: material('#222c35'),
  canvas: material('#cdc0a6'),
};

/** Emissive material for anything that should read as lit after dark. */
export function lamp(color: string, intensity = 1.6): MeshStandardMaterial {
  return material(color, 0, 0.4, { emissive: new Color(color), emissiveIntensity: intensity });
}
