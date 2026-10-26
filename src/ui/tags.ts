import { Vector3, type PerspectiveCamera } from 'three';
import type { Agent } from '../sim/agents';
import { el } from './dom';

/** Most tags the overview may show at once. Forty is unreadable. */
const MAX = 7;
/** Past this distance a tag is too small to read, so it is dropped. */
const RANGE = 110;

interface Candidate {
  agent: Agent;
  x: number;
  y: number;
  distance: number;
}

/**
 * Name tags drawn as HTML over the canvas rather than as sprites in the scene.
 * Sprites scale with distance, sit inside the fog, and stack on top of each
 * other when residents bunch up. These stay at one size, cull to the nearest
 * few, and keep the crisp text the rest of the interface uses.
 */
export class NameTags {
  private readonly host = el<HTMLDivElement>('tags');
  private readonly pool: HTMLElement[] = [];
  private readonly point = new Vector3();
  private enabled = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.host.hidden = !enabled;
  }

  update(agents: Agent[], camera: PerspectiveCamera, width: number, height: number, selected: Agent | null) {
    if (!this.enabled) return;

    const candidates: Candidate[] = [];
    for (const agent of agents) {
      if (!agent.rig.root.visible) continue;
      const root = agent.rig.root.position;
      const distance = camera.position.distanceTo(root);
      if (distance > RANGE && agent !== selected) continue;

      this.point.set(root.x, root.y + agent.rig.labelHeight, root.z).project(camera);
      // Behind the camera, or outside the frame with a margin.
      if (this.point.z > 1 || Math.abs(this.point.x) > 1.15 || Math.abs(this.point.y) > 1.15) continue;

      candidates.push({
        agent,
        x: (this.point.x * 0.5 + 0.5) * width,
        y: (-this.point.y * 0.5 + 0.5) * height,
        distance: agent === selected ? -1 : distance,
      });
    }

    candidates.sort((a, b) => a.distance - b.distance);
    const shown = candidates.slice(0, MAX);

    for (let i = 0; i < shown.length; i++) {
      const { agent, x, y } = shown[i];
      const tag = this.at(i);
      tag.textContent = agent.resident.name;
      tag.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      tag.classList.toggle('is-active', agent === selected);
      tag.hidden = false;
    }
    for (let i = shown.length; i < this.pool.length; i++) this.pool[i].hidden = true;
  }

  private at(index: number): HTMLElement {
    let tag = this.pool[index];
    if (!tag) {
      tag = document.createElement('span');
      tag.className = 'tag';
      this.host.appendChild(tag);
      this.pool[index] = tag;
    }
    return tag;
  }
}
