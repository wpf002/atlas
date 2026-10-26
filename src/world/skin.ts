/**
 * Resident skins. Every resident shares one blocky mesh, so the whole of a
 * person — face, haircut, uniform, boots — is painted into a single 512px
 * texture laid out on that mesh's UV atlas.
 *
 * The atlas is a box unwrap: each body part is six rectangles, and the second
 * rectangle of each middle row is the face the resident shows the camera. The
 * rects below are measured off the pack's own 1024px sheet and scaled down, so
 * every number here is a real UV island, not a guess.
 */
import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace } from 'three';
import {
  ARCHETYPES,
  HAIR_STYLES,
  HAIR_TONES,
  SEXES,
  SKIN_TONES,
  type ArchetypeSpec,
  type Feature,
  type HairStyle,
  type Sex,
} from '../data/archetypes';
import type { ResidentRecord } from '../data/districts';

const SIZE = 512;
const K = SIZE / 1024;

type Rect = [x: number, y: number, w: number, h: number];

/** Scales a rect off the pack's 1024px sheet onto our canvas. */
const r = (x: number, y: number, w: number, h: number): Rect => [x * K, y * K, w * K, h * K];

/** Box unwrap: top and bottom caps, then right / front / left / back. */
interface Island {
  top: Rect;
  bottom: Rect;
  sides: [Rect, Rect, Rect, Rect];
}

const HEAD: Island = {
  top: r(133, 6, 117, 117),
  bottom: r(133, 257, 117, 117),
  sides: [r(18, 132, 117, 117), r(135, 132, 116, 117), r(251, 132, 117, 117), r(389, 132, 117, 117)],
};

const TORSO: Island = {
  top: r(102, 693, 117, 87),
  bottom: r(101, 933, 117, 88),
  sides: [r(5, 790, 87, 132), r(101, 790, 117, 132), r(228, 790, 88, 132), r(326, 790, 117, 132)],
};

const ARM_L: Island = {
  top: r(771, 537, 59, 59),
  bottom: r(835, 537, 58, 59),
  sides: [r(771, 603, 58, 161), r(835, 603, 59, 161), r(899, 603, 59, 161), r(963, 603, 59, 161)],
};

const ARM_R: Island = {
  top: r(483, 537, 58, 59),
  bottom: r(546, 537, 59, 59),
  sides: [r(483, 603, 58, 161), r(546, 603, 59, 161), r(611, 603, 59, 161), r(675, 603, 59, 161)],
};

const LEG_L: Island = {
  top: r(771, 803, 58, 59),
  bottom: r(835, 803, 58, 59),
  sides: [r(771, 871, 58, 146), r(835, 871, 58, 146), r(899, 871, 58, 146), r(962, 871, 59, 146)],
};

const LEG_R: Island = {
  top: r(483, 803, 58, 59),
  bottom: r(546, 803, 59, 59),
  sides: [r(483, 871, 58, 146), r(546, 871, 59, 146), r(611, 871, 59, 146), r(675, 871, 58, 146)],
};

const ARMS = [ARM_L, ARM_R];
const LEGS = [LEG_L, LEG_R];

const SHOE = '#23252b';
const BROW = '#2a2228';

/** Mixes two hex colours. 0 is all of a, 1 is all of b. */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const out = [16, 8, 0].map((shift) => {
    const ca = (pa >> shift) & 255;
    const cb = (pb >> shift) & 255;
    return Math.round(ca + (cb - ca) * t);
  });
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Darkens a colour, used to shade the faces that point away from the sun. */
const shade = (hex: string, t: number) => mix(hex, '#000000', t);

type Ctx = CanvasRenderingContext2D;

function fill(ctx: Ctx, rect: Rect, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(rect[0], rect[1], rect[2], rect[3]);
}

/**
 * Paints a whole box one colour, with the back and the underside a shade
 * darker. Flat colour on a cuboid leaves the silhouette unreadable from above.
 */
function paintBox(ctx: Ctx, box: Island, color: string) {
  fill(ctx, box.top, mix(color, '#ffffff', 0.08));
  fill(ctx, box.bottom, shade(color, 0.3));
  fill(ctx, box.sides[0], shade(color, 0.1));
  fill(ctx, box.sides[1], color);
  fill(ctx, box.sides[2], shade(color, 0.1));
  fill(ctx, box.sides[3], shade(color, 0.18));
}

/** Paints a horizontal band across all four upright faces of a box. */
function band(ctx: Ctx, box: Island, from: number, to: number, color: string) {
  for (let i = 0; i < 4; i++) {
    const [x, y, w, h] = box.sides[i];
    ctx.fillStyle = i === 3 ? shade(color, 0.18) : i === 1 ? color : shade(color, 0.1);
    ctx.fillRect(x, y + h * from, w, h * (to - from));
  }
}

/** A rect placed in a face's own 0-1 space, so features scale with the cell. */
function onFace(ctx: Ctx, face: Rect, fx: number, fy: number, fw: number, fh: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(face[0] + face[2] * fx, face[1] + face[3] * fy, face[2] * fw, face[3] * fh);
}

/* ---------- hair ---------- */

/** How far down the head each cut reaches, as a fraction of the head's height. */
const HAIR_DROP: Record<HairStyle, { side: number; back: number; fringe: number }> = {
  crop: { side: 0.2, back: 0.24, fringe: 0.17 },
  swept: { side: 0.22, back: 0.26, fringe: 0.13 },
  bob: { side: 0.52, back: 0.6, fringe: 0.22 },
  long: { side: 0.66, back: 0.86, fringe: 0.2 },
  bun: { side: 0.24, back: 0.3, fringe: 0.18 },
};

function paintHair(ctx: Ctx, style: HairStyle, hair: string) {
  const drop = HAIR_DROP[style];
  fill(ctx, HEAD.top, hair);
  const [rightSide, front, leftSide, back] = HEAD.sides;
  const cuts: [Rect, number, string][] = [
    [rightSide, drop.side, shade(hair, 0.08)],
    [leftSide, drop.side, shade(hair, 0.08)],
    [back, drop.back, shade(hair, 0.16)],
    [front, drop.fringe, hair],
  ];
  for (const [face, depth, tone] of cuts) {
    ctx.fillStyle = tone;
    ctx.fillRect(face[0], face[1], face[2], face[3] * depth);
  }
  if (style === 'swept') {
    // The fringe falls to one side, so the parting is visible head-on.
    onFace(ctx, HEAD.sides[1], 0, drop.fringe, 0.42, 0.1, hair);
  }
  if (style === 'bun') {
    onFace(ctx, HEAD.top, 0.3, 0.06, 0.4, 0.34, shade(hair, 0.12));
  }
}

/* ---------- face ---------- */

function paintFace(ctx: Ctx, sex: Sex, skin: string) {
  const t = SEXES[sex];
  const face = HEAD.sides[1];
  const eyeW = 0.15 * t.eye;
  const eyeH = 0.1 * t.eye;
  const eyeY = 0.42;
  for (const x of [0.22, 0.63]) {
    onFace(ctx, face, x, eyeY - 0.1, eyeW, 0.045 * t.brow + 0.03, BROW);
    onFace(ctx, face, x, eyeY, eyeW, eyeH, '#f3efe7');
    onFace(ctx, face, x + eyeW * 0.3, eyeY + eyeH * 0.15, eyeW * 0.44, eyeH * 0.7, '#2c2b33');
  }
  // A mouth a shade off the skin reads as a face at rest. Drawn in a contrast
  // colour it reads as a fixed expression, and forty of those is unsettling.
  const lip = mix(skin, sex === 'f' ? '#a85a5a' : '#8c5248', 0.45);
  onFace(ctx, face, 0.5 - 0.11 * t.mouth, 0.72, 0.22 * t.mouth, 0.045, lip);
  onFace(ctx, face, 0.42, 0.56, 0.16, 0.06, shade(skin, 0.12));
}

/* ---------- headwear ---------- */

function paintHeadwear(
  ctx: Ctx,
  features: readonly Feature[],
  spec: ArchetypeSpec,
  sex: Sex,
  skin: string,
) {
  const face = HEAD.sides[1];
  if (features.includes('chefHat')) {
    fill(ctx, HEAD.top, '#f6f4ee');
    band(ctx, HEAD, 0, 0.3, '#f6f4ee');
    band(ctx, HEAD, 0.22, 0.3, '#e2ded2');
  }
  if (features.includes('cap')) {
    fill(ctx, HEAD.top, spec.accent);
    band(ctx, HEAD, 0, 0.28, spec.accent);
    // The bill sits on the forehead, which is the only place a flat unwrap can
    // put it without modelling a brim.
    onFace(ctx, face, 0, 0.26, 1, 0.08, shade(spec.accent, 0.42));
  }
  if (features.includes('brimHat')) {
    fill(ctx, HEAD.top, spec.primary);
    band(ctx, HEAD, 0, 0.3, spec.primary);
    band(ctx, HEAD, 0.2, 0.26, spec.accent);
    band(ctx, HEAD, 0.3, 0.37, shade(spec.primary, 0.45));
  }
  if (features.includes('hood')) {
    fill(ctx, HEAD.top, shade(spec.primary, 0.1));
    band(ctx, HEAD, 0, 0.9, shade(spec.primary, 0.1));
    // The hood swallowed the face, so the opening is cut back to skin and the
    // face redrawn inside it. Clearing instead would leave a hole the material
    // renders as a transparent gap in the head.
    onFace(ctx, face, 0.1, 0.17, 0.8, 0.68, skin);
    paintFace(ctx, sex, skin);
  }
  if (features.includes('headset')) {
    onFace(ctx, HEAD.top, 0.36, 0, 0.28, 1, '#23262c');
    for (const side of [HEAD.sides[0], HEAD.sides[2]]) {
      onFace(ctx, side, 0.34, 0.3, 0.32, 0.3, '#23262c');
    }
    onFace(ctx, face, 0.04, 0.54, 0.3, 0.07, '#23262c');
  }
  if (features.includes('visor')) onFace(ctx, face, 0, 0.34, 1, 0.22, mix(spec.accent, '#101418', 0.4));
  else if (features.includes('shades')) onFace(ctx, face, 0.12, 0.38, 0.76, 0.14, '#1b1d23');
  else if (features.includes('glasses')) {
    for (const x of [0.17, 0.58]) {
      onFace(ctx, face, x, 0.37, 0.25, 0.02, spec.accent);
      onFace(ctx, face, x, 0.52, 0.25, 0.02, spec.accent);
      onFace(ctx, face, x, 0.37, 0.02, 0.17, spec.accent);
      onFace(ctx, face, x + 0.23, 0.37, 0.02, 0.17, spec.accent);
    }
    onFace(ctx, face, 0.42, 0.43, 0.16, 0.02, spec.accent);
  }
}

/* ---------- garment ---------- */

function paintGarment(ctx: Ctx, features: readonly Feature[], spec: ArchetypeSpec) {
  const front = TORSO.sides[1];
  if (features.includes('lapels')) {
    onFace(ctx, front, 0.2, 0, 0.14, 0.44, shade(spec.primary, 0.3));
    onFace(ctx, front, 0.66, 0, 0.14, 0.44, shade(spec.primary, 0.3));
    onFace(ctx, front, 0.34, 0, 0.32, 0.3, spec.accent);
  }
  if (features.includes('apron')) {
    onFace(ctx, front, 0.14, 0.2, 0.72, 0.8, mix(spec.accent, '#ffffff', 0.35));
    onFace(ctx, front, 0.26, 0, 0.08, 0.24, mix(spec.accent, '#ffffff', 0.35));
    onFace(ctx, front, 0.66, 0, 0.08, 0.24, mix(spec.accent, '#ffffff', 0.35));
  }
  if (features.includes('tie')) onFace(ctx, front, 0.45, 0.06, 0.1, 0.6, spec.accent);
  if (features.includes('bowtie')) onFace(ctx, front, 0.39, 0.07, 0.22, 0.1, spec.accent);
  if (features.includes('scarf')) {
    band(ctx, TORSO, 0, 0.16, spec.accent);
    onFace(ctx, front, 0.4, 0.1, 0.12, 0.5, spec.accent);
  }
  if (features.includes('stethoscope')) {
    onFace(ctx, front, 0.24, 0.02, 0.06, 0.34, '#2e3238');
    onFace(ctx, front, 0.7, 0.02, 0.06, 0.34, '#2e3238');
    onFace(ctx, front, 0.24, 0.3, 0.52, 0.05, '#2e3238');
    onFace(ctx, front, 0.62, 0.36, 0.12, 0.1, '#9aa5ad');
  }
  if (features.includes('satchel')) {
    onFace(ctx, front, 0.1, 0, 0.14, 1, shade(spec.accent, 0.35));
    onFace(ctx, TORSO.sides[0], 0.3, 0.42, 0.5, 0.5, shade(spec.accent, 0.3));
  }
  if (features.includes('toolbelt')) band(ctx, TORSO, 0.82, 0.96, shade(spec.accent, 0.4));
  if (features.includes('pocketSquare')) onFace(ctx, front, 0.68, 0.3, 0.12, 0.06, spec.accent);
}

/* ---------- the sheet ---------- */

export function residentTexture(resident: ResidentRecord, index: number): CanvasTexture {
  const spec: ArchetypeSpec = ARCHETYPES[resident.archetype];
  const features = spec.features as readonly Feature[];
  const skin = SKIN_TONES[index % SKIN_TONES.length];
  const hair = HAIR_TONES[(index * 3 + 1) % HAIR_TONES.length];
  const style = HAIR_STYLES[resident.sex][index % HAIR_STYLES[resident.sex].length];
  const bare = !features.includes('gloves') && spec.silhouette === 'athletic';

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = spec.primary;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.imageSmoothingEnabled = false;

  paintBox(ctx, HEAD, skin);
  paintHair(ctx, style, hair);
  paintFace(ctx, resident.sex, skin);
  paintHeadwear(ctx, features, spec, resident.sex, skin);

  paintBox(ctx, TORSO, spec.primary);
  paintGarment(ctx, features, spec);

  const hand = features.includes('gloves') ? shade(spec.accent, 0.3) : skin;
  for (const arm of ARMS) {
    paintBox(ctx, arm, bare ? skin : spec.primary);
    band(ctx, arm, 0.78, 1, hand);
    fill(ctx, arm.bottom, hand);
    if (features.includes('wristbands')) band(ctx, arm, 0.7, 0.78, spec.accent);
    else if (!bare) band(ctx, arm, 0.74, 0.78, shade(spec.primary, 0.3));
  }

  for (const leg of LEGS) {
    paintBox(ctx, leg, spec.legs);
    band(ctx, leg, 0.84, 1, SHOE);
    fill(ctx, leg.bottom, shade(SHOE, 0.3));
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // The pack's UVs follow the glTF convention: V runs down from the top of the
  // sheet. A CanvasTexture flips V by default, which samples every rect from
  // the wrong half of the canvas and leaves the faces blank.
  texture.flipY = false;
  // The pack lays its cells out past the edge of the sheet: leg U runs negative
  // and every V sits between 1 and 2. Clamped sampling pins those faces to the
  // border pixel, which paints a whole head in one flat colour.
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  // The art is flat blocks of colour. Nearest keeps the edges crisp instead of
  // smearing a face across two texels when a resident is far off.
  texture.magFilter = NearestFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
