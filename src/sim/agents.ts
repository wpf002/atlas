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
    a.dest.set(midpoint.x - offset, 0, midpoint.z);
    best.dest.set(midpoint.x + offset, 0, midpoint.z);
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
      const dx = agent.dest.x - position.x;
      const dz = agent.dest.z - position.z;
      const distance = Math.hypot(dx, dz);

      if (distance > ARRIVE) {
        const step = Math.min(distance, dt * agent.speed * 2.1);
        position.x += (dx / distance) * step;
        position.z += (dz / distance) * step;
        rig.root.rotation.y = Math.atan2(-dx, -dz);

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
