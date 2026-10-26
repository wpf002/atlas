import {
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Vector3,
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
  { hour: 0, sky: '#0d1620', sun: '#6b82ab', sunIntensity: 0.35, hemiIntensity: 0.5, exposure: 0.92, phase: 'Night · Clear' },
  { hour: 5, sky: '#172231', sun: '#b0867a', sunIntensity: 0.8, hemiIntensity: 0.62, exposure: 0.96, phase: 'First Light' },
  { hour: 7, sky: '#2f4252', sun: '#ffc083', sunIntensity: 2.3, hemiIntensity: 0.82, exposure: 1.06, phase: 'Golden Hour' },
  { hour: 12, sky: '#3a5268', sun: '#ffeed2', sunIntensity: 2.8, hemiIntensity: 0.98, exposure: 1.0, phase: 'Midday · Clear' },
  { hour: 17, sky: '#334553', sun: '#ffc68d', sunIntensity: 2.4, hemiIntensity: 0.88, exposure: 1.03, phase: 'Late Afternoon' },
  { hour: 19, sky: '#212c37', sun: '#dc8450', sunIntensity: 1.2, hemiIntensity: 0.66, exposure: 0.97, phase: 'Dusk' },
  { hour: 21, sky: '#111c28', sun: '#6b82ab', sunIntensity: 0.4, hemiIntensity: 0.52, exposure: 0.93, phase: 'Night · Clear' },
  { hour: 24, sky: '#0d1620', sun: '#6b82ab', sunIntensity: 0.35, hemiIntensity: 0.5, exposure: 0.92, phase: 'Night · Clear' },
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
  /** Unit vector from the scene toward the sun, rebuilt each hour. */
  private readonly toSun = new Vector3(0, 1, 0.35).normalize();
  private extent = 0;
  phase = STOPS[3].phase;
  /** 0 at full noon, 1 in the dead of night. Drives bloom on the lamps. */
  night = 0;

  constructor(scene: Scene, renderer: WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;

    this.hemi = new HemisphereLight('#bcd4f5', '#3a3326', 0.98);
    scene.add(this.hemi);

    this.sun = new DirectionalLight('#fff0d4', 2.8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 520;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.focus(new Vector3(), 150);

    scene.background = new Color('#3a5268');
    scene.fog = new FogExp2('#3a5268', 0.0028);
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
    this.night = Math.min(1, Math.max(0, 1 - this.sun.intensity / 2.4));

    // Sun arc: up at 06:00, overhead at noon, down at 18:00.
    const elevation = ((hour - 6) / 12) * Math.PI;
    const height = Math.sin(elevation);
    this.toSun.set(Math.cos(elevation) * 120, Math.max(18, height * 130), 46).normalize();
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.toSun, 260);
  }

  /**
   * One 4096 map stretched over the whole campus gives a shadow texel of about
   * 70mm, which is wider than an eyelid. The frustum instead tracks what the
   * camera is looking at and tightens as it closes in, so a face gets the same
   * map a district used to share.
   */
  focus(target: Vector3, distance: number) {
    const extent = Math.min(170, Math.max(7, distance * 0.95));
    this.sun.target.position.set(target.x, target.y, target.z);
    this.sun.position.copy(target).addScaledVector(this.toSun, 260);
    if (Math.abs(extent - this.extent) < this.extent * 0.08) return;
    this.extent = extent;
    const shadow = this.sun.shadow.camera;
    shadow.left = -extent;
    shadow.right = extent;
    shadow.top = extent;
    shadow.bottom = -extent;
    shadow.updateProjectionMatrix();
    // Bias has to shrink with the frustum or a tight map detaches the contact
    // shadow from the foot that casts it.
    this.sun.shadow.normalBias = 0.004 + extent / 7000;
    this.sun.shadow.bias = -0.00008 - extent / 900000;
  }
}
