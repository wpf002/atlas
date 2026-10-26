import { Vector3, type Scene } from 'three';
import { RESIDENTS, type ResidentRecord } from '../data/districts';
import { blockAt, type Activity } from '../data/rhythms';
import type { Campus, Obstacle, Placement } from '../world/campus';
import { buildCharacter, type CharacterRig } from '../world/character';
import { ActivityFeed, MEETING_SUBJECTS } from './activity';
import type { Clock } from './clock';

export type AgentState = 'walking' | 'idle' | 'meeting' | 'indoors';

export interface Agent {
  resident: ResidentRecord;
  rig: CharacterRig;
  placement: Placement;
  dest: Vector3;
  activity: Activity;
  /** Human-readable line for the dossier. */
  note: string;
  state: AgentState;
  speed: number;
  phase: number;
  /** Seconds until the agent picks a new destination. */
  dwell: number;
  partner: Agent | null;
  meetingHold: number;
  /** Heading to turn to on arrival, or null to keep the walking heading. */
  face: number | null;
}

const ARRIVE = 0.6;
/** Fallback half-width, used only where a rig is not to hand. */
const BODY = 0.6;
/** Ground speed the walk clip was authored at, in units per second. */
const STRIDE_SPEED = 2.3;

/** Eases an angle toward a target along the shorter arc. */
function turn(from: number, to: number, rate: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * Math.min(1, rate);
}
/** How far ahead an agent looks for something to walk around. */
const LOOKAHEAD = 7;
const PLAZA_INNER = 9;
const PLAZA_OUTER = 21;

function jitter(range: number): number {
  return (Math.random() - 0.5) * range;
}

function pointNear(base: Vector3, range: number, out: Vector3): Vector3 {
  return out.set(base.x + jitter(range), 0, base.z + jitter(range));
}

function plazaPoint(out: Vector3): Vector3 {
  const angle = Math.random() * Math.PI * 2;
  const radius = PLAZA_INNER + Math.random() * (PLAZA_OUTER - PLAZA_INNER);
  return out.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
}

/**
 * Where a point has to move to sit just outside an obstacle, once that
 * obstacle is grown by the body radius. Null when the point is already clear.
 * Boxes are solved in their own frame, so a rotated shell blocks its real
 * rectangle; the point leaves through the nearest face, never across the
 * building.
 */
function escape(o: Obstacle, px: number, pz: number, body: number): { x: number; z: number } | null {
  const dx = px - o.x;
  const dz = pz - o.z;
  if (o.round) {
    const min = o.hw + body;
    const d = Math.hypot(dx, dz);
    if (d >= min) return null;
    if (d < 1e-4) return { x: o.x + min, z: o.z };
    return { x: o.x + (dx / d) * min, z: o.z + (dz / d) * min };
  }
  const c = Math.cos(o.ry);
  const s = Math.sin(o.ry);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  const hw = o.hw + body;
  const hd = o.hd + body;
  if (Math.abs(lx) >= hw || Math.abs(lz) >= hd) return null;
  let ox = lx;
  let oz = lz;
  if (hw - Math.abs(lx) < hd - Math.abs(lz)) ox = lx < 0 ? -hw : hw;
  else oz = lz < 0 ? -hd : hd;
  return { x: o.x + ox * c + oz * s, z: o.z - ox * s + oz * c };
}

export class World {
  readonly agents: Agent[] = [];
  readonly byId = new Map<string, Agent>();
  readonly feed: ActivityFeed;
  private readonly campus: Campus;
  private readonly clock: Clock;
  private meetingTimer = 6;

  constructor(scene: Scene, campus: Campus, clock: Clock, feed: ActivityFeed) {
    this.campus = campus;
    this.clock = clock;
    this.feed = feed;

    RESIDENTS.forEach((resident, index) => {
      const placement = campus.placements[resident.districtIndex];
      const rig = buildCharacter(resident, index);
      const slot = (index % 5) - 2;
      const spread = new Vector3(placement.frontage.x, 0.1, placement.frontage.z);
      spread.x += Math.cos(placement.facing) * slot * 3.4;
      spread.z -= Math.sin(placement.facing) * slot * 3.4;
      rig.root.position.copy(spread);
      rig.root.rotation.y = placement.facing + Math.PI;
      scene.add(rig.root);

      const block = blockAt(resident.rhythm, clock.hour);
      const agent: Agent = {
        resident,
        rig,
        placement,
        dest: spread.clone(),
        activity: block.activity,
        note: block.note,
        state: 'idle',
        speed: 1.5 + (index % 4) * 0.18,
        phase: index * 1.7,
        dwell: 1 + Math.random() * 4,
        partner: null,
        meetingHold: 0,
        face: null,
      };
      this.agents.push(agent);
      this.byId.set(resident.id, agent);
    });
  }

  /** Chooses where an agent should be for its current activity. */
  private retarget(agent: Agent) {
    const { activity } = agent;
    const dest = agent.dest;
    agent.face = null;

    switch (activity) {
      case 'rest': {
        // Head for the entrance, then step inside.
        dest.copy(agent.placement.frontage);
        dest.x += Math.sin(agent.placement.facing) * 4;
        dest.z += Math.cos(agent.placement.facing) * 4;
        agent.dwell = 20 + Math.random() * 30;
        break;
      }
      case 'work': {
        // Each resident keeps their own station, so colleagues stand side by
        // side at the props instead of stacking on one random point.
        const { stations, stationFacing, district } = agent.placement;
        const slot = Math.max(0, district.residents.findIndex((r) => r.id === agent.resident.id));
        dest.copy(stations[slot % stations.length]);
        agent.face = stationFacing;
        agent.dwell = 12 + Math.random() * 14;
        break;
      }
      case 'commons':
        plazaPoint(dest);
        agent.dwell = 5 + Math.random() * 8;
        break;
      case 'wander': {
        const others = this.campus.placements.filter((p) => p.index !== agent.placement.index);
        const target = others[Math.floor(Math.random() * others.length)];
        pointNear(target.frontage, 9, dest);
        agent.dwell = 6 + Math.random() * 8;
        break;
      }
      case 'social': {
        const peer = this.agents[Math.floor(Math.random() * this.agents.length)];
        if (peer !== agent && peer.state !== 'indoors') {
          pointNear(peer.rig.root.position, 4, dest);
        } else {
          plazaPoint(dest);
        }
        agent.dwell = 5 + Math.random() * 6;
        break;
      }
    }
    // Never aim at a point inside a bench, tree or the fountain.
    if (activity !== 'rest') this.clearOf(dest, agent.rig.radius);
    agent.state = 'walking';
  }

  /** Pulls two nearby, available agents into a conversation. */
  private tryMeeting() {
    const available = this.agents.filter(
      (a) => a.state !== 'indoors' && !a.partner && a.activity !== 'rest',
    );
    if (available.length < 2) return;

    const a = available[Math.floor(Math.random() * available.length)];
    let best: Agent | null = null;
    let bestDistance = 26;
    for (const b of available) {
      if (b === a) continue;
      const d = a.rig.root.position.distanceTo(b.rig.root.position);
      if (d < bestDistance) {
        best = b;
        bestDistance = d;
      }
    }
    if (!best) return;

    const midpoint = new Vector3()
      .addVectors(a.rig.root.position, best.rig.root.position)
      .multiplyScalar(0.5);
    const offset = 1.1;
    a.partner = best;
    best.partner = a;
    a.meetingHold = 7 + Math.random() * 6;
    best.meetingHold = a.meetingHold;
    this.clearOf(a.dest.set(midpoint.x - offset, 0, midpoint.z), a.rig.radius);
    this.clearOf(best.dest.set(midpoint.x + offset, 0, midpoint.z), best.rig.radius);
    a.state = 'walking';
    best.state = 'walking';

    const subject = MEETING_SUBJECTS[Math.floor(Math.random() * MEETING_SUBJECTS.length)];
    this.feed.push({
      time: this.clock.label,
      headline: `${a.resident.name} × ${best.resident.name}`,
      detail: `${a.resident.name} and ${best.resident.name} ${subject}.`,
      accent: a.resident.district.accent,
    });
  }

  private endMeeting(agent: Agent) {
    const partner = agent.partner;
    agent.partner = null;
    agent.meetingHold = 0;
    if (partner) {
      partner.partner = null;
      partner.meetingHold = 0;
      this.retarget(partner);
    }
    this.retarget(agent);
  }

  /** Re-reads every agent's rhythm block. Called when the sim hour ticks over. */
  syncToSchedule() {
    const hour = this.clock.hour;
    for (const agent of this.agents) {
      const block = blockAt(agent.resident.rhythm, hour);
      const changed = block.activity !== agent.activity;
      agent.activity = block.activity;
      agent.note = block.note;
      if (changed && !agent.partner) {
        if (agent.state === 'indoors') {
          agent.rig.root.visible = true;
          agent.state = 'idle';
        }
        this.retarget(agent);
      }
    }
  }

  /** Nudges a point out of any prop or building it landed inside. */
  private clearOf(point: Vector3, body = BODY): Vector3 {
    for (const o of this.campus.obstacles) {
      const out = escape(o, point.x, point.z, body);
      if (!out) continue;
      point.x = out.x;
      point.z = out.z;
    }
    return point;
  }

  /**
   * Probes the path ahead and slides the heading along the first footprint it
   * would enter. Probing beats a centre-and-radius test because a building is
   * long: an agent walking at its flank is nowhere near the centre but is very
   * much on course for the wall.
   */
  private steer(position: Vector3, dirX: number, dirZ: number, body: number): { x: number; z: number } {
    const margin = body + 0.4;
    for (let i = 1; i <= 5; i++) {
      const reach = (LOOKAHEAD * i) / 5;
      const px = position.x + dirX * reach;
      const pz = position.z + dirZ * reach;
      for (const o of this.campus.obstacles) {
        const out = escape(o, px, pz, margin);
        if (!out) continue;
        // The way out of the footprint is the surface normal; walking the
        // perpendicular to it skirts the wall instead of bouncing off it.
        let nx = out.x - px;
        let nz = out.z - pz;
        const length = Math.hypot(nx, nz) || 1;
        nx /= length;
        nz /= length;
        let tx = -nz;
        let tz = nx;
        if (tx * dirX + tz * dirZ < 0) {
          tx = nz;
          tz = -nx;
        }
        // The nearer the wall, the more the tangent wins over the heading.
        const near = 1 - reach / LOOKAHEAD;
        const bx = dirX * (1 - 0.7 * near) + tx * (0.45 + 1.3 * near) + nx * 0.25 * near;
        const bz = dirZ * (1 - 0.7 * near) + tz * (0.45 + 1.3 * near) + nz * 0.25 * near;
        const blended = Math.hypot(bx, bz) || 1;
        return { x: bx / blended, z: bz / blended };
      }
    }
    return { x: dirX, z: dirZ };
  }

  private pushOut(position: Vector3, body: number) {
    for (const o of this.campus.obstacles) {
      const out = escape(o, position.x, position.z, body);
      if (!out) continue;
      position.x = out.x;
      position.z = out.z;
    }
  }

  update(dt: number) {
    this.meetingTimer -= dt;
    if (this.meetingTimer <= 0) {
      this.meetingTimer = 9 + Math.random() * 9;
      this.tryMeeting();
    }

    for (const agent of this.agents) {
      const rig = agent.rig;

      if (agent.state === 'indoors') {
        agent.dwell -= dt;
        if (agent.dwell <= 0 && agent.activity !== 'rest') {
          rig.root.visible = true;
          agent.state = 'idle';
          agent.dwell = 0;
        }
        continue;
      }

      const position = rig.root.position;
      this.pushOut(position, rig.radius);
      const dx = agent.dest.x - position.x;
      const dz = agent.dest.z - position.z;
      const distance = Math.hypot(dx, dz);

      if (distance > ARRIVE) {
        const step = Math.min(distance, dt * agent.speed * 2.1);
        const heading = this.steer(position, dx / distance, dz / distance, rig.radius);
        position.x += heading.x * step;
        position.z += heading.z * step;
        // Again after the step, so a stride never ends inside a prop.
        this.pushOut(position, rig.radius);
        // Turn into the heading rather than snapping, or a change of course
        // spins the whole body on the spot.
        rig.root.rotation.y = turn(rig.root.rotation.y, Math.atan2(-heading.x, -heading.z), dt * 7);

        rig.play('walk');
        // The stride matches ground speed, so nobody moonwalks or mincing-steps.
        rig.setStride(Math.max(0.55, (agent.speed * 2.1) / STRIDE_SPEED));
        rig.update(dt);
        continue;
      }

      // Arrived.
      if (agent.partner) {
        const other = agent.partner.rig.root.position;
        rig.root.rotation.y = turn(
          rig.root.rotation.y,
          Math.atan2(-(other.x - position.x), -(other.z - position.z)),
          dt * 5,
        );
        rig.play('talk');
        rig.update(dt);
        agent.state = 'meeting';
        agent.meetingHold -= dt;
        if (agent.meetingHold <= 0) this.endMeeting(agent);
        continue;
      }

      if (agent.face !== null) rig.root.rotation.y = turn(rig.root.rotation.y, agent.face, dt * 5);
      rig.play('idle');
      rig.update(dt);

      if (agent.activity === 'rest') {
        rig.root.visible = false;
        agent.state = 'indoors';
        agent.dwell = 30;
        continue;
      }

      agent.state = 'idle';
      agent.dwell -= dt;
      if (agent.dwell <= 0) this.retarget(agent);
    }
  }

  /** Count of residents currently out on the campus. */
  get awakeCount(): number {
    return this.agents.reduce((n, a) => n + (a.state === 'indoors' ? 0 : 1), 0);
  }
}

/**
 * What the dossier shows. The rhythm note describes where an agent is headed,
 * so on its own it reads as a lie while they are still walking there.
 */
export function statusOf(agent: Agent): string {
  if (agent.state === 'indoors') return agent.note;
  if (agent.state === 'meeting') {
    return agent.partner ? `Talking with ${agent.partner.resident.name}` : 'In conversation';
  }
  if (agent.state !== 'walking') return agent.note;
  switch (agent.activity) {
    case 'rest':
      return 'Walking home';
    case 'commons':
      return 'Crossing the commons';
    case 'social':
      return 'Off to find someone';
    case 'wander':
      return 'Out walking';
    default:
      return `Walking to ${agent.placement.district.venue}`;
  }
}
