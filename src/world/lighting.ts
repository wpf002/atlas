import {
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  type Scene,
  type WebGLRenderer,
} from 'three';

interface SkyStop {
  /** Hour of day this stop describes. */
  hour: number;
  sky: string;
  sun: string;
  sunIntensity: number;
  hemiIntensity: number;
  exposure: number;
  /** Shown in the scene badge. */
  phase: string;
}

const STOPS: SkyStop[] = [
  { hour: 0, sky: '#131f2d', sun: '#8098c4', sunIntensity: 0.45, hemiIntensity: 1.35, exposure: 1.22, phase: 'Night · Clear' },
  { hour: 5, sky: '#1b2838', sun: '#c79a8c', sunIntensity: 1.0, hemiIntensity: 1.6, exposure: 1.3, phase: 'First Light' },
  { hour: 7, sky: '#3a4f61', sun: '#ffcb95', sunIntensity: 2.9, hemiIntensity: 2.4, exposure: 1.58, phase: 'Golden Hour' },
  { hour: 12, sky: '#41596c', sun: '#fff1d8', sunIntensity: 3.5, hemiIntensity: 2.8, exposure: 1.62, phase: 'Midday · Clear' },
  { hour: 17, sky: '#3b4c58', sun: '#ffcf9b', sunIntensity: 3.0, hemiIntensity: 2.4, exposure: 1.56, phase: 'Late Afternoon' },
  { hour: 19, sky: '#27323d', sun: '#e4915f', sunIntensity: 1.5, hemiIntensity: 1.7, exposure: 1.4, phase: 'Dusk' },
  { hour: 21, sky: '#16222f', sun: '#8098c4', sunIntensity: 0.5, hemiIntensity: 1.4, exposure: 1.25, phase: 'Night · Clear' },
  { hour: 24, sky: '#131f2d', sun: '#8098c4', sunIntensity: 0.45, hemiIntensity: 1.35, exposure: 1.22, phase: 'Night · Clear' },
];

export class Sky {
  readonly sun: DirectionalLight;
  readonly hemi: HemisphereLight;
  private readonly scene: Scene;
  private readonly renderer: WebGLRenderer;
  private readonly skyColor = new Color();
  private readonly sunColor = new Color();
  private readonly a = new Color();
  private readonly b = new Color();
  phase = STOPS[3].phase;

  constructor(scene: Scene, renderer: WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;

    this.hemi = new HemisphereLight('#cfe1ff', '#2a3a30', 2.4);
    scene.add(this.hemi);

    this.sun = new DirectionalLight('#fff0d4', 3.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -150;
    this.sun.shadow.camera.right = 150;
    this.sun.shadow.camera.top = 150;
    this.sun.shadow.camera.bottom = -150;
    this.sun.shadow.camera.far = 400;
    this.sun.shadow.normalBias = 0.025;
    scene.add(this.sun);

    scene.background = new Color('#41596c');
    scene.fog = new FogExp2('#41596c', 0.0028);
    this.apply(12);
  }

  /** Moves the sun along its arc and grades the scene for the given hour. */
  apply(hour: number) {
    let lower = STOPS[0];
    let upper = STOPS[STOPS.length - 1];
    for (let i = 0; i < STOPS.length - 1; i++) {
      if (hour >= STOPS[i].hour && hour <= STOPS[i + 1].hour) {
        lower = STOPS[i];
        upper = STOPS[i + 1];
        break;
      }
    }
    const span = upper.hour - lower.hour || 1;
    const t = Math.min(1, Math.max(0, (hour - lower.hour) / span));

    this.a.set(lower.sky);
    this.b.set(upper.sky);
    this.skyColor.copy(this.a).lerp(this.b, t);
    this.a.set(lower.sun);
    this.b.set(upper.sun);
    this.sunColor.copy(this.a).lerp(this.b, t);

    if (this.scene.background instanceof Color) this.scene.background.copy(this.skyColor);
    if (this.scene.fog) this.scene.fog.color.copy(this.skyColor);

    this.sun.color.copy(this.sunColor);
    this.sun.intensity = lower.sunIntensity + (upper.sunIntensity - lower.sunIntensity) * t;
    this.hemi.intensity = lower.hemiIntensity + (upper.hemiIntensity - lower.hemiIntensity) * t;
    this.renderer.toneMappingExposure = lower.exposure + (upper.exposure - lower.exposure) * t;
    this.phase = t < 0.5 ? lower.phase : upper.phase;

    // Sun arc: up at 06:00, overhead at noon, down at 18:00.
    const elevation = ((hour - 6) / 12) * Math.PI;
    const height = Math.sin(elevation);
    this.sun.position.set(Math.cos(elevation) * 120, Math.max(18, height * 130), 46);
  }
}
