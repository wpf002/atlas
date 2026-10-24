import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';

const DISPLAY = '"Spectral", Georgia, serif';
const UI = '"Archivo", system-ui, sans-serif';

interface LabelOptions {
  color?: string;
  background?: string;
  scale?: number;
  font?: 'display' | 'ui';
  letterSpacing?: number;
}

/**
 * Canvas-backed sprite label. Used for building signs and the name tag that
 * floats above each resident.
 */
export function label(text: string, options: LabelOptions = {}): Sprite {
  const { color = '#f3ead7', background, scale = 1, font = 'ui' } = options;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for label rendering');

  if (background) {
    ctx.fillStyle = background;
    const r = 28;
    ctx.beginPath();
    ctx.roundRect(8, 34, canvas.width - 16, 124, r);
    ctx.fill();
  }

  ctx.font = font === 'display' ? `600 68px ${DISPLAY}` : `600 62px ${UI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 64);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;

  const sprite = new Sprite(
    new SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(9 * scale, 1.7 * scale, 1);
  return sprite;
}
