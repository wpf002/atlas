import { Color, Group } from 'three';
import { lamp, material, SURFACES } from './materials';
import { box, cyl } from './primitives';

/**
 * A venue shell built as masonry instead of one extruded slab. Everything that
 * makes a building read as designed is depth: piers standing proud of the wall,
 * glazing sitting back behind them, a string course at every floor line, a
 * cornice with three projections, and a parapet above the roof.
 *
 * The campus bakes all of this into one mesh per material, so the box count
 * costs geometry memory once and nothing per frame.
 */

/** Storey height. Bay and floor counts are derived from it. */
const FLOOR = 4.2;
/** How far a pier stands out from the wall plane. */
const PIER = 0.42;
/** Height of the rusticated ground storey. */
const BASE = 4.6;

export interface VenueShell {
  width: number;
  depth: number;
  height: number;
  facade: string;
  accent: string;
  /** Index of the district, used to vary window lighting between venues. */
  seed: number;
}

/** Lightening toward limestone rather than white keeps the facade's hue. */
const LIMESTONE = new Color('#e4d9c4');

function shade(hex: string, amount: number): string {
  const c = new Color(hex);
  if (amount < 0) c.multiplyScalar(1 + amount);
  else c.lerp(LIMESTONE, amount);
  return `#${c.getHexString()}`;
}

/** A moulding course: a slab that oversails the wall on every side. */
function course(g: Group, w: number, d: number, h: number, y: number, out: number, m: Parameters<typeof box>[3]) {
  g.add(box(w + out * 2, h, d + out * 2, m, 0, y + h / 2, 0, false));
}

export function buildVenue(shell: VenueShell): Group {
  const g = new Group();
  const { width: W, depth: D, height: H, seed } = shell;

  const stone = material(shade(shell.facade, 0.12), 0, 0.82, undefined, 'stone');
  const rustic = material(shade(shell.facade, -0.26), 0, 0.88, undefined, 'concrete');
  const reveal = material(shade(shell.facade, -0.42), 0, 0.9, undefined, 'concrete');
  const trim = material(shade(shell.facade, 0.34), 0, 0.78, undefined, 'stone');
  const accent = material(shell.accent, 0, 0.6, undefined, 'stone');
  const lit = material('#6d5f44', 0, 0.3, { emissive: new Color('#f2d6a0'), emissiveIntensity: 0.9 });

  // Tall venues step back so the silhouette is not one rectangle.
  const setback = H >= 12;
  const bodyTop = setback ? BASE + (H - BASE) * 0.64 : H;
  const bodyH = bodyTop - BASE;

  const floors = Math.max(1, Math.round(bodyH / FLOOR));
  const storey = bodyH / floors;

  /* ---------- ground storey ---------- */

  g.add(box(W, BASE, D, rustic, 0, BASE / 2, 0));
  course(g, W, D, 0.7, 0, 0.55, rustic);
  // Rusticated joints read as shadow lines across the base.
  for (let i = 1; i < 3; i++) {
    course(g, W, D, 0.22, (BASE / 3) * i, 0.16, reveal);
  }
  course(g, W, D, 0.62, BASE - 0.62, 0.62, trim);

  /* ---------- main body ---------- */

  g.add(box(W, bodyH, D, stone, 0, BASE + bodyH / 2, 0));

  const faces: { axis: 'z' | 'x'; sign: 1 | -1; span: number; off: number }[] = [
    { axis: 'z', sign: -1, span: W, off: D / 2 },
    { axis: 'z', sign: 1, span: W, off: D / 2 },
    { axis: 'x', sign: -1, span: D, off: W / 2 },
    { axis: 'x', sign: 1, span: D, off: W / 2 },
  ];

  for (const face of faces) {
    const n = Math.max(3, Math.min(6, Math.round(face.span / 5.4)));
    const p = face.span / n;

    // Piers between every bay, wider at the corners.
    for (let i = 0; i <= n; i++) {
      const t = -face.span / 2 + i * p;
      const w = i === 0 || i === n ? 1.9 : 1.15;
      const at = face.off + PIER / 2;
      if (face.axis === 'z') g.add(box(w, bodyH + 0.3, PIER, trim, t, BASE + bodyH / 2, face.sign * at));
      else g.add(box(PIER, bodyH + 0.3, w, trim, face.sign * at, BASE + bodyH / 2, t));
    }

    // Glazing sits at the wall plane, so the piers read as a recess around it.
    for (let i = 0; i < n; i++) {
      const t = -face.span / 2 + (i + 0.5) * p;
      const gw = p - 1.9;
      for (let f = 0; f < floors; f++) {
        const y = BASE + f * storey + storey / 2;
        const gh = storey - 1.7;
        const on = (seed * 7 + i * 5 + f * 3 + (face.axis === 'z' ? 0 : 11)) % 5 < 2;
        const pane = on ? lit : SURFACES.glass;
        if (face.axis === 'z') {
          g.add(box(gw + 0.7, gh + 0.7, 0.18, reveal, t, y, face.sign * (face.off + 0.08), false));
          g.add(box(gw, gh, 0.14, pane, t, y, face.sign * (face.off + 0.17), false));
          g.add(box(gw + 0.9, 0.3, 0.52, trim, t, y - gh / 2 - 0.3, face.sign * (face.off + 0.18), false));
        } else {
          g.add(box(0.18, gh + 0.7, gw + 0.7, reveal, face.sign * (face.off + 0.08), y, t, false));
          g.add(box(0.14, gh, gw, pane, face.sign * (face.off + 0.17), y, t, false));
          g.add(box(0.52, 0.3, gw + 0.9, trim, face.sign * (face.off + 0.18), y - gh / 2 - 0.3, t, false));
        }
      }
    }
  }

  // String course at every floor line, then the cornice above the top one.
  for (let f = 1; f < floors; f++) {
    course(g, W, D, 0.32, BASE + f * storey - 0.16, 0.56, trim);
  }
  course(g, W, D, 0.5, bodyTop - 0.5, 0.7, trim);
  course(g, W, D, 0.72, bodyTop, 1.25, accent);
  course(g, W, D, 0.38, bodyTop + 0.72, 0.85, trim);

  /* ---------- upper volume and roof ---------- */

  let roof = bodyTop + 1.1;
  let roofW = W;
  let roofD = D;

  if (setback) {
    const topH = H - bodyTop;
    const tw = W - 6.5;
    const td = D - 6.5;
    g.add(box(tw, topH, td, stone, 0, roof + topH / 2, 0));
    const tbays = Math.max(2, Math.round(tw / 5.4));
    for (let i = 0; i <= tbays; i++) {
      const t = -tw / 2 + i * (tw / tbays);
      g.add(box(1.1, topH, PIER, trim, t, roof + topH / 2, -(td / 2 + PIER / 2)));
      g.add(box(1.1, topH, PIER, trim, t, roof + topH / 2, td / 2 + PIER / 2));
    }
    for (let i = 0; i < tbays; i++) {
      const t = -tw / 2 + (i + 0.5) * (tw / tbays);
      g.add(box(tw / tbays - 1.9, topH - 2.2, 0.16, SURFACES.glass, t, roof + topH / 2, -(td / 2 + 0.1), false));
      g.add(box(tw / tbays - 1.9, topH - 2.2, 0.16, SURFACES.glass, t, roof + topH / 2, td / 2 + 0.1, false));
    }
    course(g, tw, td, 0.6, roof + topH, 1.0, accent);
    // Parapet rail around the setback terrace.
    parapet(g, W, D, roof, trim, 0.9);
    roof = roof + topH + 0.6;
    roofW = tw;
    roofD = td;
  }

  parapet(g, roofW, roofD, roof, trim, 1.2);
  g.add(box(roofW - 1.6, 0.3, roofD - 1.6, SURFACES.concrete, 0, roof + 0.15, 0, false));

  // Roof plant, so the skyline is not a flat edge.
  const plantX = (seed % 2 === 0 ? -1 : 1) * (roofW / 4);
  g.add(box(roofW * 0.3, 2.2, roofD * 0.32, SURFACES.concrete, plantX, roof + 1.3, 0.6));
  g.add(cyl(1.0, 1.1, 1.5, SURFACES.iron, plantX - roofW * 0.14, roof + 2.9, 0.6, 12));
  g.add(cyl(0.16, 0.16, 5.4, SURFACES.iron, -plantX, roof + 2.9, -roofD / 4, 6));
  g.add(box(0.5, 0.5, 0.5, lamp('#e2705f', 1.4), -plantX, roof + 5.7, -roofD / 4, false));

  /* ---------- entrance ---------- */

  const front = -D / 2;
  const portalW = Math.min(9.5, W * 0.46);

  for (let s = 0; s < 3; s++) {
    g.add(box(portalW + 4.4 - s * 0.8, 0.32, 1.1, SURFACES.kerb, 0, 0.16 + s * 0.32, front - 2.0 + s * 0.95, false));
  }

  // A portal that projects from the wall, with a reveal and doors inside it.
  g.add(box(portalW + 1.8, BASE + 2.6, 1.0, trim, 0, (BASE + 2.6) / 2, front - 0.4));
  g.add(box(portalW, BASE + 1.6, 0.7, reveal, 0, (BASE + 1.6) / 2, front - 0.75, false));
  g.add(box(portalW - 0.5, 0.5, 0.9, accent, 0, BASE + 1.9, front - 0.8, false));
  for (const side of [-1, 1]) {
    g.add(box(portalW / 2 - 0.5, BASE - 0.8, 0.3, SURFACES.wood, side * (portalW / 4 + 0.1), (BASE - 0.8) / 2 + 0.3, front - 0.95, false));
    g.add(box(0.34, 0.34, 0.34, SURFACES.brass, side * 0.45, 2.1, front - 1.12, false));
  }

  // Canopy on brackets.
  g.add(box(portalW + 4.2, 0.4, 3.0, accent, 0, BASE + 3.1, front - 1.6));
  g.add(box(portalW + 3.4, 0.22, 2.4, trim, 0, BASE + 2.85, front - 1.4, false));
  for (const side of [-1, 1]) {
    g.add(box(0.36, 2.0, 1.9, trim, side * (portalW / 2 + 1.4), BASE + 1.9, front - 1.2, false));
  }

  return g;
}

function parapet(g: Group, w: number, d: number, y: number, m: Parameters<typeof box>[3], h: number) {
  g.add(box(w + 0.6, h, 0.6, m, 0, y + h / 2, -(d / 2 + 0.1)));
  g.add(box(w + 0.6, h, 0.6, m, 0, y + h / 2, d / 2 + 0.1));
  g.add(box(0.6, h, d + 0.6, m, -(w / 2 + 0.1), y + h / 2, 0));
  g.add(box(0.6, h, d + 0.6, m, w / 2 + 0.1, y + h / 2, 0));
}
