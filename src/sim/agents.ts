import { Vector3, type Scene } from 'three';
import { RESIDENTS, type ResidentRecord } from '../data/districts';
import { blockAt, type Activity } from '../data/rhythms';
import type { Campus, Placement } from '../world/campus';
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
}

const ARRIVE = 0.6;
/** Fallback half-width, used only where a rig is not to hand. */
const BODY = 0.6;
/** How far ahead an agent looks for something to walk around. */
const LOOKAHEAD = 4.2;
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
      };
      this.agents.push(agent);
      this.byId.set(resident.id, agent);
    });
  }

  /** Chooses where an agent should be for its current activity. */
  private retarget(agent: Agent) {
    const { activity } = agent;
    const dest = agent.dest;

    switch (activity) {
      case 'rest': {
        // Head for the entrance, then step inside.
        dest.copy(agent.placement.frontage);
        dest.x += Math.sin(agent.placement.facing) * 4;
        dest.z += Math.cos(agent.placement.facing) * 4;
        agent.dwell = 20 + Math.random() * 30;
        break;
      }
      case 'work':
        pointNear(agent.placement.frontage, 11, dest);
        agent.dwell = 4 + Math.random() * 7;
        break;
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

  /** Nudges a point out of any prop it landed inside. */
  private clearOf(point: Vector3, body = BODY): Vector3 {
    for (const o of this.campus.obstacles) {
      const dx = point.x - o.x;
      const dz = point.z - o.z;
      const min = o.radius + body;
      const d = Math.hypot(dx, dz);
      if (d >= min) continue;
      if (d < 1e-4) {
        point.x = o.x + min;
        continue;
      }
      point.x = o.x + (dx / d) * min;
      point.z = o.z + (dz / d) * min;
    }
    return point;
  }

  /**
   * Deflects a heading around the nearest prop in front of the agent, then
   * pushes the body out of anything it is already overlapping. Steering alone
   * leaves gaps at corners; the push-out is what guarantees no clipping.
   */
  private steer(position: Vector3, dirX: number, dirZ: number, body: number): { x: number; z: number } {
    let bestDot = 0;
    let bestX = 0;
    let bestZ = 0;
    let bestGap = Infinity;

    for (const o of this.campus.obstacles) {
      const dx = o.x - position.x;
      const dz = o.z - position.z;
      const ahead = dx * dirX + dz * dirZ;
      if (ahead <= 0 || ahead > LOOKAHEAD) continue;
      const reach = o.radius + body;
      // Perpendicular distance from the obstacle centre to the path.
      const side = dx * -dirZ + dz * dirX;
      if (Math.abs(side) > reach) continue;
      const gap = ahead - reach;
      if (gap >= bestGap) continue;
      bestGap = gap;
      bestDot = side;
      bestX = dx;
      bestZ = dz;
    }

    if (bestGap === Infinity) return { x: dirX, z: dirZ };

    // Turn away from whichever side the obstacle sits on.
    const away = bestDot >= 0 ? -1 : 1;
    const strength = Math.min(1, LOOKAHEAD / Math.max(0.4, Math.hypot(bestX, bestZ)));
    const x = dirX + -dirZ * away * strength;
    const z = dirZ + dirX * away * strength;
    const length = Math.hypot(x, z) || 1;
    return { x: x / length, z: z / length };
  }

  private pushOut(position: Vector3, body: number) {
    for (const o of this.campus.obstacles) {
      const dx = position.x - o.x;
      const dz = position.z - o.z;
      const min = o.radius + body;
      if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
      const d = Math.hypot(dx, dz);
      if (d >= min) continue;
      if (d < 1e-4) {
        position.x = o.x + min;
        continue;
      }
      const push = (min - d) / d;
      position.x += dx * push;
      position.z += dz * push;
    }
  }

  update(dt: number, elapsed: number) {
    this.meetingTimer -= dt;
    if (this.meetingTimer <= 0) {
      this.meetingTimer = 9 + Math.random() * 9;
      this.tryMeeting();
    }

    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];
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
        rig.root.rotation.y = Math.atan2(-heading.x, -heading.z);

        agent.phase += dt * 9.5;
        const swing = Math.sin(agent.phase);
        rig.legL.rotation.x = swing * 0.46;
        rig.legR.rotation.x = -swing * 0.46;
        rig.armL.rotation.x = -swing * 0.3;
        rig.armR.rotation.x = swing * 0.3;
        rig.torso.position.y = Math.abs(swing) * 0.05;
        continue;
      }

      // Arrived.
      rig.legL.rotation.x *= 0.82;
      rig.legR.rotation.x *= 0.82;
      rig.torso.position.y *= 0.82;

      if (agent.partner) {
        // Face each other and talk with their hands.
        const other = agent.partner.rig.root.position;
        rig.root.rotation.y = Math.atan2(-(other.x - position.x), -(other.z - position.z));
        const gesture = Math.sin(elapsed * 2.6 + i) * 0.26;
        rig.armL.rotation.x = -0.5 + gesture;
        rig.armR.rotation.x = -0.4 - gesture;
        agent.state = 'meeting';
        agent.meetingHold -= dt;
        if (agent.meetingHold <= 0) this.endMeeting(agent);
        continue;
      }

      const idle = Math.sin(elapsed * 1.1 + i) * 0.13;
      rig.armL.rotation.x = idle;
      rig.armR.rotation.x = -idle;

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
