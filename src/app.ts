import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  Raycaster,
  SRGBColorSpace,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DISTRICT_COUNT, RESIDENTS, RESIDENT_COUNT, type ResidentRecord } from './data/districts';
import { ActivityFeed } from './sim/activity';
import { World, statusOf, type Agent } from './sim/agents';
import { Clock } from './sim/clock';
import { buildCampus, type Campus } from './world/campus';
import { Sky } from './world/lighting';
import { Controls } from './ui/controls';
import { el } from './ui/dom';
import { Inspector } from './ui/inspector';
import { Sidebar, type DistrictFilter } from './ui/sidebar';

const HOME_VIEW = { position: new Vector3(0, 158, 228), target: new Vector3(0, 0, 0) };
const TOUR_INTERVAL = 11;
/** Name tags only show once the camera is close enough to read them. */
const TAG_RANGE = 62;

export class Atlas {
  private readonly canvas = el<HTMLCanvasElement>('scene');
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly orbit: OrbitControls;
  private readonly sky: Sky;
  private readonly campus: Campus;
  private readonly clock = new Clock(10, 2.2);
  private readonly feed = new ActivityFeed();
  private readonly world: World;
  private readonly sidebar: Sidebar;
  private readonly inspector: Inspector;
  private readonly controls: Controls;

  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private pointerDown: { x: number; y: number } | null = null;

  private selected: Agent | null = null;
  private following: Agent | null = null;
  private running = true;
  private tourIndex = 0;
  private tourTimer = 0;
  private touring = false;
  private speed = 1;
  private labels = true;
  private statusTimer = 0;

  private last = performance.now();
  private elapsed = 0;
  private fpsWindow = 0;
  private frames = 0;

  constructor() {
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;

    this.camera = new PerspectiveCamera(46, 1, 0.1, 1200);
    this.camera.position.copy(HOME_VIEW.position);

    this.orbit = new OrbitControls(this.camera, this.canvas);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.07;
    this.orbit.minDistance = 9;
    this.orbit.maxDistance = 330;
    this.orbit.maxPolarAngle = Math.PI * 0.485;
    this.orbit.minPolarAngle = 0.18;
    this.orbit.target.copy(HOME_VIEW.target);

    this.sky = new Sky(this.scene, this.renderer);
    this.campus = buildCampus(this.scene);
    this.world = new World(this.scene, this.campus, this.clock, this.feed);

    this.sidebar = new Sidebar({
      onDistrict: (filter) => this.focusDistrict(filter),
      onResident: (resident) => this.selectResident(resident, true),
    });

    this.inspector = new Inspector(this.feed, {
      onFollow: () => this.toggleFollow(),
      onVisit: () => {
        if (this.selected) this.focusDistrict(this.selected.resident.districtIndex);
      },
    });

    this.controls = new Controls({
      onRunToggle: (running) => {
        this.running = running;
      },
      onTourToggle: (touring) => {
        this.touring = touring;
        this.tourTimer = TOUR_INTERVAL;
        if (touring) this.following = null;
      },
      onLabelsToggle: (visible) => {
        this.labels = visible;
        if (!visible) for (const agent of this.world.agents) agent.rig.tag.visible = false;
      },
      onSpeedChange: (multiplier) => {
        this.speed = multiplier;
      },
      onZoom: (direction) => this.zoom(direction),
      onHome: () => this.goHome(),
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      this.pointerDown = { x: e.clientX, y: e.clientY };
    });
    this.canvas.addEventListener('pointerup', (e) => this.handlePick(e));
    window.addEventListener('hashchange', () => this.applyHash());

    this.feed.push({
      time: this.clock.label,
      headline: 'The Atlas Is Open',
      detail: `${RESIDENT_COUNT} residents are moving through ${DISTRICT_COUNT} districts on their own schedules.`,
    });

    el('meta-districts').textContent = String(DISTRICT_COUNT);
    this.applyHash();
    // Dev-only handle for poking at the running sim from the console.
    if (import.meta.env.DEV) Reflect.set(window, 'atlas', this);
    el('loading').hidden = true;
    requestAnimationFrame(() => this.frame(performance.now()));
  }

  /* ---------- selection and camera ---------- */

  private selectResident(resident: ResidentRecord, moveCamera: boolean) {
    const agent = this.world.byId.get(resident.id);
    if (!agent) return;
    this.selected = agent;
    this.inspector.show(resident);
    this.inspector.setNow(statusOf(agent));
    this.inspector.setFollowing(this.following === agent);
    this.sidebar.setActiveResident(resident.id);
    this.controls.setHeading(resident.name, resident.title);
    if (window.location.hash !== `#/resident/${resident.id}`) {
      history.replaceState(null, '', `#/resident/${resident.id}`);
    }
    if (moveCamera) this.frameOn(agent.rig.root.position, 15);
  }

  private toggleFollow() {
    if (!this.selected) return;
    this.following = this.following === this.selected ? null : this.selected;
    this.inspector.setFollowing(this.following !== null);
    if (this.following) {
      this.touring = false;
      this.controls.setTouring(false);
      this.controls.setHeading(`Following ${this.following.resident.name}`, statusOf(this.following));
    }
  }

  private focusDistrict(filter: DistrictFilter) {
    this.following = null;
    this.inspector.setFollowing(false);
    if (filter === 'all') {
      this.goHome();
      return;
    }
    const placement = this.campus.placements[filter];
    this.frameOn(placement.frontage, 46);
    this.controls.setHeading(placement.district.venue, placement.district.name);
    this.sidebar.setActiveDistrict(filter);
    history.replaceState(null, '', `#/district/${placement.district.id}`);
  }

  private frameOn(point: Vector3, distance: number) {
    const direction = new Vector3(point.x, 0, point.z).normalize();
    if (direction.lengthSq() === 0) direction.set(0, 0, 1);
    this.orbit.target.set(point.x, 2.4, point.z);
    this.camera.position.set(
      point.x - direction.x * distance * 0.9,
      distance * 0.7 + 8,
      point.z - direction.z * distance * 0.9,
    );
    this.orbit.update();
  }

  private goHome() {
    this.following = null;
    this.inspector.setFollowing(false);
    this.orbit.target.copy(HOME_VIEW.target);
    this.camera.position.copy(HOME_VIEW.position);
    this.orbit.update();
    this.controls.setHeading('The Grand Commons', 'Forty specialists, fifteen districts, one working day');
  }

  private zoom(direction: 1 | -1) {
    const offset = this.camera.position.clone().sub(this.orbit.target);
    offset.multiplyScalar(direction === 1 ? 0.82 : 1.22);
    this.camera.position.copy(this.orbit.target).add(offset);
    this.orbit.update();
  }

  private handlePick(event: PointerEvent) {
    const start = this.pointerDown;
    this.pointerDown = null;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;

    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const roots = this.world.agents.filter((a) => a.rig.root.visible).map((a) => a.rig.root);
    const hit = this.raycaster.intersectObjects(roots, true)[0];
    const residentId = hit?.object.userData.residentId as string | undefined;
    if (!residentId) return;
    const resident = RESIDENTS.find((r) => r.id === residentId);
    if (resident) this.selectResident(resident, false);
  }

  private applyHash() {
    const match = /^#\/(resident|district)\/([a-z0-9-]+)$/.exec(window.location.hash);
    if (!match) return;
    if (match[1] === 'resident') {
      const resident = RESIDENTS.find((r) => r.id === match[2]);
      if (resident) this.selectResident(resident, true);
      return;
    }
    const index = this.campus.placements.findIndex((p) => p.district.id === match[2]);
    if (index >= 0) this.focusDistrict(index);
  }

  /* ---------- frame loop ---------- */

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = Math.min(devicePixelRatio, 1.8);
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Forty tags at once is unreadable from the overview, so a tag shows only
   * when the camera is near it, plus always for the resident on screen.
   */
  private updateTags() {
    const camera = this.camera.position;
    const range = TAG_RANGE * TAG_RANGE;
    for (const agent of this.world.agents) {
      if (!this.labels || !agent.rig.root.visible) {
        agent.rig.tag.visible = false;
        continue;
      }
      const p = agent.rig.root.position;
      const dx = p.x - camera.x;
      const dy = p.y - camera.y;
      const dz = p.z - camera.z;
      agent.rig.tag.visible = agent === this.selected || dx * dx + dy * dy + dz * dz < range;
    }
  }

  private frame(now: number) {
    requestAnimationFrame((next) => this.frame(next));
    const raw = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.resize();

    if (this.running) {
      const dt = raw * this.speed;
      this.elapsed += dt;
      const { hourChanged } = this.clock.advance(dt);
      this.sky.apply(this.clock.hourFraction);
      this.world.update(dt, this.elapsed);
      if (hourChanged) {
        this.world.syncToSchedule();
        this.controls.setAwake(this.world.awakeCount);
        if (this.selected) this.inspector.setNow(statusOf(this.selected));
      }
      this.controls.setClock(this.clock.label, this.sky.phase);
      this.updateTags();

      this.statusTimer -= dt;
      if (this.statusTimer <= 0) {
        this.statusTimer = 0.6;
        if (this.selected) this.inspector.setNow(statusOf(this.selected));
        if (this.following) {
          this.controls.setHeading(`Following ${this.following.resident.name}`, statusOf(this.following));
        }
      }

      if (this.touring) {
        this.tourTimer -= dt;
        if (this.tourTimer <= 0) {
          this.tourTimer = TOUR_INTERVAL;
          const placement = this.campus.placements[this.tourIndex % this.campus.placements.length];
          this.tourIndex++;
          this.frameOn(placement.frontage, 44);
          this.controls.setHeading(placement.district.venue, placement.district.name);
        }
      }
    }

    if (this.following) {
      const target = this.following.rig.root.position;
      this.orbit.target.lerp(new Vector3(target.x, 2.2, target.z), 0.08);
      this.camera.position.lerp(new Vector3(target.x + 11, 10, target.z + 14), 0.045);
    }

    this.orbit.update();
    this.renderer.render(this.scene, this.camera);

    this.frames++;
    this.fpsWindow += raw;
    if (this.fpsWindow > 1.5) {
      this.controls.setFps(Math.round(this.frames / this.fpsWindow));
      this.frames = 0;
      this.fpsWindow = 0;
    }
  }
}
