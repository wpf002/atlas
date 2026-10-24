import type { ResidentRecord } from '../data/districts';
import { RHYTHMS, type RhythmId } from '../data/rhythms';
import type { ActivityEvent, ActivityFeed } from '../sim/activity';
import { el, make } from './dom';

const RHYTHM_LABELS: Record<RhythmId, string> = {
  early: 'Early Riser',
  standard: 'Standard Day',
  late: 'Night Owl',
  roaming: 'Field Circuit',
};

interface InspectorHandlers {
  onFollow: () => void;
  onVisit: () => void;
}

/** Right rail: the selected resident's dossier plus the world activity feed. */
export class Inspector {
  private readonly monogram = el('portrait-monogram');
  private readonly glyph = el('portrait-glyph');
  private readonly tag = el('portrait-tag');
  private readonly name = el('dossier-name');
  private readonly title = el('dossier-title');
  private readonly district = el('dossier-district');
  private readonly tags = el('dossier-tags');
  private readonly bio = el('dossier-bio');
  private readonly now = el('dossier-now');
  private readonly rhythm = el('dossier-rhythm');
  private readonly followButton = el<HTMLButtonElement>('follow');
  private readonly visitButton = el<HTMLButtonElement>('visit');
  private readonly activity = el('activity');

  constructor(feed: ActivityFeed, handlers: InspectorHandlers) {
    this.followButton.addEventListener('click', handlers.onFollow);
    this.visitButton.addEventListener('click', handlers.onVisit);
    feed.subscribe((event) => this.pushEvent(event));
  }

  show(resident: ResidentRecord) {
    this.monogram.textContent = resident.name.slice(0, 1);
    this.glyph.textContent = resident.district.glyph;
    this.tag.textContent = `Resident ${String(resident.number).padStart(2, '0')} · ${resident.district.venue}`;
    this.name.textContent = resident.name;
    this.title.textContent = resident.title;
    this.district.textContent = resident.district.name;
    this.bio.textContent = resident.bio;
    this.rhythm.textContent = `${RHYTHM_LABELS[resident.rhythm]} · ${RHYTHMS[resident.rhythm].length} Blocks`;

    this.tags.replaceChildren(
      ...resident.expertise.map((skill) => make('li', undefined, skill)),
    );

    this.followButton.disabled = false;
    this.visitButton.disabled = false;
  }

  /** Live line: what the resident is doing at the current sim hour. */
  setNow(note: string) {
    this.now.textContent = note;
  }

  setFollowing(following: boolean) {
    this.followButton.textContent = following ? 'Stop Following' : 'Follow Resident';
    this.followButton.classList.toggle('is-on', following);
  }

  private pushEvent(event: ActivityEvent) {
    const entry = make('article', 'event');
    if (event.accent) entry.style.borderLeftColor = event.accent;
    entry.append(make('p', 'event-time', event.time));
    entry.append(make('h4', 'event-headline', event.headline));
    entry.append(make('p', 'event-detail', event.detail));
    this.activity.prepend(entry);
    while (this.activity.children.length > 6) this.activity.lastElementChild?.remove();
  }
}
