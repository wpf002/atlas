export interface ActivityEvent {
  time: string;
  headline: string;
  detail: string;
  /** District accent, used as the entry's edge colour. */
  accent?: string;
}

type Listener = (event: ActivityEvent) => void;

/** Rolling world activity feed. The inspector subscribes to it. */
export class ActivityFeed {
  private readonly listeners = new Set<Listener>();
  readonly events: ActivityEvent[] = [];
  private readonly limit: number;

  constructor(limit = 6) {
    this.limit = limit;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  push(event: ActivityEvent) {
    this.events.unshift(event);
    if (this.events.length > this.limit) this.events.length = this.limit;
    for (const listener of this.listeners) listener(event);
  }
}

export const MEETING_SUBJECTS = [
  'compared notes on an open problem',
  'argued about a result for twenty minutes',
  'traded a reference neither had read',
  'sketched a joint experiment on a napkin',
  'reviewed something that should not have worked',
  'planned a cross-district session',
  'disagreed, usefully',
  'found the same pattern from two directions',
];
