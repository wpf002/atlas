import {
  HalfFloatType,
  PMREMGenerator,
  Vector2,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** Ambient occlusion sized for a campus where a person is about 3 units tall. */
const AO = {
  radius: 0.62,
  distanceExponent: 1.4,
  thickness: 1.4,
  scale: 1.1,
  samples: 16,
  screenSpaceRadius: false,
};

/** Edge-aware blur that cleans up the AO buffer without smearing contact shadows. */
const DENOISE = { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 3, rings: 2, samples: 8 };

/**
 * Lighting a scene with a sun and a hemisphere light alone leaves every surface
 * flat, because nothing supplies the bounced light a real room has. This adds
 * two things: an image-based environment so materials get a believable specular
 * response, and a post chain whose ambient occlusion puts contact shadows where
 * geometry meets geometry.
 */
export class RenderPipeline {
  private readonly composer: EffectComposer;
  private readonly gtao: GTAOPass;
  private readonly bloom: UnrealBloomPass;
  private readonly bokeh: BokehPass;

  constructor(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera) {
    // Image-based lighting. Kept dim so the sun stays the key light and this
    // only fills the shadows the way a real sky would.
    const pmrem = new PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.26;
    pmrem.dispose();

    const size = renderer.getSize(new Vector2());
    this.composer = new EffectComposer(renderer);
    this.composer.renderTarget1.texture.type = HalfFloatType;
    this.composer.renderTarget2.texture.type = HalfFloatType;

    this.composer.addPass(new RenderPass(scene, camera));

    this.gtao = new GTAOPass(scene, camera, size.x, size.y);
    this.gtao.output = GTAOPass.OUTPUT.Default;
    this.gtao.blendIntensity = 0.85;
    this.gtao.updateGtaoMaterial(AO);
    this.gtao.updatePdMaterial(DENOISE);
    this.composer.addPass(this.gtao);

    // Depth of field. It re-renders the scene for depth, so it stays switched
    // off at campus range and only earns its cost on a close shot.
    this.bokeh = new BokehPass(scene, camera, { focus: 16, aperture: 0.0002, maxblur: 0.009 });
    this.bokeh.enabled = false;
    this.composer.addPass(this.bokeh);

    // Only the emissive lamps clear the threshold, so daylight stays crisp.
    this.bloom = new UnrealBloomPass(new Vector2(size.x, size.y), 0.34, 0.7, 0.86);
    this.composer.addPass(this.bloom);

    this.composer.addPass(new SMAAPass(size.x, size.y));
    // Applies the renderer's tone mapping and colour space as the last step.
    this.composer.addPass(new OutputPass());
  }

  /**
   * Lamps should read as light sources after dark and as painted metal at noon,
   * so the bloom follows the sun rather than sitting at one strength.
   */
  setNight(amount: number) {
    this.bloom.strength = 0.22 + amount * 0.5;
    this.bloom.threshold = 0.86 - amount * 0.22;
  }

  /**
   * Focus follows the orbit target. Aperture fades in below 34 units and the
   * pass switches off above it, so the wide campus view is fully sharp.
   */
  setFocus(distance: number) {
    const close = Math.min(1, Math.max(0, (34 - distance) / 22));
    this.bokeh.enabled = close > 0.02;
    if (!this.bokeh.enabled) return;
    const u = this.bokeh.materialBokeh.uniforms;
    u.focus.value = distance;
    u.aperture.value = 0.00004 + close * close * 0.00055;
    u.maxblur.value = 0.003 + close * 0.008;
  }

  setSize(width: number, height: number) {
    this.composer.setSize(width, height);
  }

  render(dt: number) {
    this.composer.render(dt);
  }

  dispose() {
    this.composer.dispose();
  }
}
