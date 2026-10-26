import {
  AnimationClip,
  Bone,
  BufferAttribute,
  BoxGeometry,
  CylinderGeometry,
  Euler,
  Quaternion,
  QuaternionKeyframeTrack,
  Skeleton,
  SphereGeometry,
  Vector3,
  VectorKeyframeTrack,
  type BufferGeometry,
} from 'three';

/**
 * A humanoid skeleton, the geometry that skins to it, and the walk/idle/talk
 * clips that drive it. Rotating a stack of cylinders reads as a toy because the
 * parts stay rigid and the seams pop open at every joint. A skinned mesh bends
 * one continuous surface, so a shoulder creases and a waist twists.
 *
 * Everything is authored in a bind pose three units tall, arms at the sides.
 */

export interface BoneSpec {
  name: string;
  parent: string | null;
  /** World position in the bind pose. */
  at: [number, number, number];
}

export const BONES: BoneSpec[] = [
  { name: 'hips', parent: null, at: [0, 1.46, 0] },
  { name: 'spine', parent: 'hips', at: [0, 1.8, 0] },
  { name: 'chest', parent: 'spine', at: [0, 2.18, 0] },
  { name: 'neck', parent: 'chest', at: [0, 2.54, 0] },
  { name: 'head', parent: 'neck', at: [0, 2.72, 0] },

  { name: 'shoulderL', parent: 'chest', at: [0.2, 2.46, 0] },
  { name: 'upperArmL', parent: 'shoulderL', at: [0.44, 2.44, 0] },
  { name: 'lowerArmL', parent: 'upperArmL', at: [0.48, 1.92, 0] },
  { name: 'handL', parent: 'lowerArmL', at: [0.5, 1.46, 0] },

  { name: 'shoulderR', parent: 'chest', at: [-0.2, 2.46, 0] },
  { name: 'upperArmR', parent: 'shoulderR', at: [-0.44, 2.44, 0] },
  { name: 'lowerArmR', parent: 'upperArmR', at: [-0.48, 1.92, 0] },
  { name: 'handR', parent: 'lowerArmR', at: [-0.5, 1.46, 0] },

  { name: 'upperLegL', parent: 'hips', at: [0.17, 1.42, 0] },
  { name: 'lowerLegL', parent: 'upperLegL', at: [0.185, 0.78, 0] },
  { name: 'footL', parent: 'lowerLegL', at: [0.195, 0.1, 0] },

  { name: 'upperLegR', parent: 'hips', at: [-0.17, 1.42, 0] },
  { name: 'lowerLegR', parent: 'upperLegR', at: [-0.185, 0.78, 0] },
  { name: 'footR', parent: 'lowerLegR', at: [-0.195, 0.1, 0] },
];

export const BONE_INDEX = new Map(BONES.map((b, i) => [b.name, i]));

/** Bind-pose segment each bone covers, used to weight vertices onto it. */
interface Segment {
  index: number;
  start: Vector3;
  end: Vector3;
  /** Limb bones only bind vertices on their own side of the body. */
  side: number;
}

const SEGMENTS: Segment[] = BONES.map((spec, index) => {
  const start = new Vector3(...spec.at);
  const child = BONES.find((b) => b.parent === spec.name && Math.sign(b.at[0]) === Math.sign(spec.at[0]));
  const end = child ? new Vector3(...child.at) : start.clone().add(new Vector3(0, 0.16, 0));
  return { index, start, end, side: Math.abs(spec.at[0]) > 0.1 ? Math.sign(spec.at[0]) : 0 };
});

export function makeSkeleton(): { bones: Bone[]; root: Bone; skeleton: Skeleton } {
  const bones = BONES.map((spec) => {
    const bone = new Bone();
    bone.name = spec.name;
    return bone;
  });

  BONES.forEach((spec, i) => {
    const at = new Vector3(...spec.at);
    if (spec.parent === null) {
      bones[i].position.copy(at);
      return;
    }
    const parentIndex = BONE_INDEX.get(spec.parent)!;
    bones[parentIndex].add(bones[i]);
    // Stored as an offset, because a child bone's transform is parent-relative.
    bones[i].position.copy(at).sub(new Vector3(...BONES[parentIndex].at));
  });

  const root = bones[0];
  root.updateMatrixWorld(true);
  return { bones, root, skeleton: new Skeleton(bones) };
}

/* ---------- skinning ---------- */

const EPS = 1e-4;

function distanceToSegment(p: Vector3, a: Vector3, b: Vector3): number {
  const ab = b.clone().sub(a);
  const lengthSq = ab.lengthSq();
  if (lengthSq < EPS) return p.distanceTo(a);
  const t = Math.min(1, Math.max(0, p.clone().sub(a).dot(ab) / lengthSq));
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

/**
 * Weights every vertex onto its four nearest bones by inverse distance. A limb
 * bone is skipped for vertices on the far side of the body, or the left arm
 * drags the right hip along with it whenever the two pass close.
 */
export function skin(geometry: BufferGeometry): BufferGeometry {
  const position = geometry.attributes.position;
  const count = position.count;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  const v = new Vector3();

  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(position, i);

    const scored: { index: number; score: number }[] = [];
    for (const segment of SEGMENTS) {
      if (segment.side !== 0 && Math.sign(v.x) !== segment.side && Math.abs(v.x) > 0.06) continue;
      const d = distanceToSegment(v, segment.start, segment.end);
      scored.push({ index: segment.index, score: 1 / Math.pow(d + 0.04, 4) });
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 4);
    const total = top.reduce((sum, s) => sum + s.score, 0) || 1;
    for (let k = 0; k < 4; k++) {
      indices[i * 4 + k] = top[k] ? top[k].index : 0;
      weights[i * 4 + k] = top[k] ? top[k].score / total : 0;
    }
  }

  geometry.setAttribute('skinIndex', new BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new BufferAttribute(weights, 4));
  return geometry;
}

/* ---------- body geometry ---------- */

/**
 * A torso built from a plain cylinder reads as a barrel. Each ring is pushed
 * in or out by a profile curve and squashed in Z, which is what gives the body
 * a chest, a waist and hips instead of one constant radius.
 */
/**
 * UVs carry the geometry's own size, so a cuff and a coat skirt show the same
 * weave. How fine that weave reads is the surface's business, not the rig's.
 */
const CHARACTER_TILES = 1;

export function tileUv(g: BufferGeometry): BufferGeometry {
  g.computeBoundingBox();
  const b = g.boundingBox;
  if (!b) return g;
  const girth = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * Math.PI;
  const run = Math.max(0.05, b.max.y - b.min.y);
  const uv = g.attributes.uv as BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * girth * CHARACTER_TILES, uv.getY(i) * run * CHARACTER_TILES);
  }
  uv.needsUpdate = true;
  return g;
}

export function torsoGeometry(
  bottom: number,
  top: number,
  profile: (t: number) => number,
  depth = 0.64,
): BufferGeometry {
  const height = top - bottom;
  const g = new CylinderGeometry(1, 1, height, 20, 18, false);
  g.translate(0, bottom + height / 2, 0);

  const position = g.attributes.position as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const t = Math.min(1, Math.max(0, (y - bottom) / height));
    const r = profile(t);
    position.setX(i, position.getX(i) * r);
    position.setZ(i, position.getZ(i) * r * depth);
  }
  g.computeVertexNormals();
  return tileUv(g);
}

/** Tapered, segmented limb running between two bind-pose points. */
export function limbGeometry(
  from: [number, number, number],
  to: [number, number, number],
  rTop: number,
  rBottom: number,
): BufferGeometry {
  const a = new Vector3(...from);
  const b = new Vector3(...to);
  const length = a.distanceTo(b);
  const g = new CylinderGeometry(rTop, rBottom, length, 12, 10, false);
  g.translate(0, -length / 2, 0);

  // Stand the cylinder up along the bone, then move it onto the joint.
  const direction = b.clone().sub(a).normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), direction);
  tileUv(g);
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

export function sphereGeometry(r: number, at: [number, number, number], squashY = 1): BufferGeometry {
  const g = new SphereGeometry(r, 18, 14);
  g.scale(1, squashY, 1);
  tileUv(g);
  g.translate(...at);
  return g;
}

export function boxGeometry(
  size: [number, number, number],
  at: [number, number, number],
): BufferGeometry {
  const g = new BoxGeometry(size[0], size[1], size[2], 2, 2, 2);
  tileUv(g);
  g.translate(...at);
  return g;
}

/* ---------- animation ---------- */

const q = new Quaternion();
const e = new Euler();

/** Turns a list of euler keyframes into the quaternion track the mixer wants. */
function rot(bone: string, times: number[], frames: [number, number, number][]): QuaternionKeyframeTrack {
  const values: number[] = [];
  for (const [x, y, z] of frames) {
    q.setFromEuler(e.set(x, y, z));
    values.push(q.x, q.y, q.z, q.w);
  }
  return new QuaternionKeyframeTrack(`${bone}.quaternion`, times, values);
}

const WALK_TIMES = [0, 0.25, 0.5, 0.75, 1];

/**
 * One full stride. Legs swing opposite, arms counter-swing against them, the
 * hips drop onto the planted foot and the chest counter-rotates, which is what
 * stops a walk reading as two pendulums under a static box.
 */
export function walkClip(): AnimationClip {
  const swing = 0.62;
  const tracks = [
    rot('upperLegL', WALK_TIMES, [[swing, 0, 0], [0, 0, 0], [-swing, 0, 0], [0, 0, 0], [swing, 0, 0]]),
    rot('upperLegR', WALK_TIMES, [[-swing, 0, 0], [0, 0, 0], [swing, 0, 0], [0, 0, 0], [-swing, 0, 0]]),
    rot('lowerLegL', WALK_TIMES, [[-0.1, 0, 0], [-0.72, 0, 0], [-0.5, 0, 0], [-0.12, 0, 0], [-0.1, 0, 0]]),
    rot('lowerLegR', WALK_TIMES, [[-0.5, 0, 0], [-0.12, 0, 0], [-0.1, 0, 0], [-0.72, 0, 0], [-0.5, 0, 0]]),
    rot('footL', WALK_TIMES, [[0.18, 0, 0], [0.3, 0, 0], [0.12, 0, 0], [-0.1, 0, 0], [0.18, 0, 0]]),
    rot('footR', WALK_TIMES, [[0.12, 0, 0], [-0.1, 0, 0], [0.18, 0, 0], [0.3, 0, 0], [0.12, 0, 0]]),

    rot('upperArmL', WALK_TIMES, [[-0.46, 0, 0.07], [0, 0, 0.09], [0.46, 0, 0.11], [0, 0, 0.09], [-0.46, 0, 0.07]]),
    rot('upperArmR', WALK_TIMES, [[0.46, 0, -0.07], [0, 0, -0.09], [-0.46, 0, -0.11], [0, 0, -0.09], [0.46, 0, -0.07]]),
    rot('lowerArmL', WALK_TIMES, [[-0.24, 0, 0], [-0.4, 0, 0], [-0.3, 0, 0], [-0.22, 0, 0], [-0.24, 0, 0]]),
    rot('lowerArmR', WALK_TIMES, [[-0.3, 0, 0], [-0.22, 0, 0], [-0.24, 0, 0], [-0.4, 0, 0], [-0.3, 0, 0]]),

    rot('hips', WALK_TIMES, [[0, 0.1, 0.03], [0, 0, 0], [0, -0.1, -0.03], [0, 0, 0], [0, 0.1, 0.03]]),
    rot('chest', WALK_TIMES, [[0.04, -0.12, 0], [0.04, 0, 0], [0.04, 0.12, 0], [0.04, 0, 0], [0.04, -0.12, 0]]),
    // The body rises over the planted leg twice per stride.
    new VectorKeyframeTrack(
      'hips.position',
      [0, 0.25, 0.5, 0.75, 1],
      [0, 1.46, 0, 0, 1.515, 0, 0, 1.46, 0, 0, 1.515, 0, 0, 1.46, 0],
    ),
  ];
  return new AnimationClip('walk', 1, tracks);
}

/** Breathing, a slow weight shift, and arms that hang rather than stick out. */
export function idleClip(): AnimationClip {
  const t = [0, 1.4, 2.8];
  const tracks = [
    rot('chest', t, [[0.01, 0, 0], [-0.03, 0, 0], [0.01, 0, 0]]),
    rot('spine', t, [[0, 0.03, 0], [0, -0.03, 0], [0, 0.03, 0]]),
    rot('head', t, [[0, 0.05, 0], [0.03, -0.06, 0], [0, 0.05, 0]]),
    rot('upperArmL', t, [[0.02, 0, 0.08], [-0.03, 0, 0.1], [0.02, 0, 0.08]]),
    rot('upperArmR', t, [[0.02, 0, -0.08], [-0.03, 0, -0.1], [0.02, 0, -0.08]]),
    rot('lowerArmL', t, [[-0.2, 0, 0], [-0.26, 0, 0], [-0.2, 0, 0]]),
    rot('lowerArmR', t, [[-0.2, 0, 0], [-0.26, 0, 0], [-0.2, 0, 0]]),
    new VectorKeyframeTrack('hips.position', t, [0, 1.46, 0, 0, 1.447, 0, 0, 1.46, 0]),
  ];
  return new AnimationClip('idle', 2.8, tracks);
}

/** Hands come up, the head nods and turns. Used while two residents meet. */
export function talkClip(): AnimationClip {
  const t = [0, 0.7, 1.4, 2.1];
  const tracks = [
    rot('upperArmL', t, [[-0.5, 0, 0.3], [-0.85, 0, 0.42], [-0.44, 0, 0.26], [-0.5, 0, 0.3]]),
    rot('upperArmR', t, [[-0.4, 0, -0.26], [-0.52, 0, -0.3], [-0.78, 0, -0.4], [-0.4, 0, -0.26]]),
    rot('lowerArmL', t, [[-1.1, 0, 0], [-1.35, 0.2, 0], [-1.0, 0, 0], [-1.1, 0, 0]]),
    rot('lowerArmR', t, [[-1.0, 0, 0], [-1.12, -0.18, 0], [-1.3, 0, 0], [-1.0, 0, 0]]),
    rot('head', t, [[0.06, 0.1, 0], [-0.05, -0.04, 0.03], [0.08, 0.12, 0], [0.06, 0.1, 0]]),
    rot('chest', t, [[0.02, 0.06, 0], [0.02, -0.03, 0], [0.02, 0.08, 0], [0.02, 0.06, 0]]),
    rot('spine', t, [[0, 0.02, 0], [0, -0.04, 0], [0, 0.03, 0], [0, 0.02, 0]]),
  ];
  return new AnimationClip('talk', 2.1, tracks);
}
