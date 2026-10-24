import { DISTRICTS, RESIDENTS, type ResidentRecord } from '../data/districts';
import { el, make } from './dom';

export type DistrictFilter = number | 'all';

interface SidebarHandlers {
  onDistrict: (filter: DistrictFilter) => void;
  onResident: (resident: ResidentRecord) => void;
}

/** District filter list, resident list, and the search box that narrows both. */
export class Sidebar {
  private readonly districtButtons: HTMLButtonElement[] = [];
  private readonly residentButtons = new Map<string, HTMLButtonElement>();
  private readonly search = el<HTMLInputElement>('search');
  private readonly count = el('resident-count');
  private filter: DistrictFilter = 'all';

  constructor(private readonly handlers: SidebarHandlers) {
    this.buildDistricts();
    this.buildResidents();
    this.search.addEventListener('input', () => this.applyFilter());
    this.applyFilter();
  }

  private buildDistricts() {
    const list = el('districts');

    const all = make('button', 'district is-active');
    all.type = 'button';
    const allSwatch = make('span', 'district-swatch');
    allSwatch.style.background = 'var(--brass)';
    all.append(allSwatch, make('span', 'district-name', 'All Districts'));
    all.append(make('span', 'district-count', String(RESIDENTS.length)));
    all.addEventListener('click', () => this.setFilter('all'));
    list.append(all);
    this.districtButtons.push(all);

    DISTRICTS.forEach((district, index) => {
      const button = make('button', 'district');
      button.type = 'button';
      button.title = district.venue;
      const swatch = make('span', 'district-swatch');
      swatch.style.background = district.accent;
      button.append(swatch, make('span', 'district-name', district.name));
      button.append(make('span', 'district-count', String(district.residents.length)));
      button.addEventListener('click', () => this.setFilter(index));
      list.append(button);
      this.districtButtons.push(button);
    });
  }

  private buildResidents() {
    const list = el('residents');
    for (const resident of RESIDENTS) {
      const button = make('button', 'resident');
      button.type = 'button';
      button.dataset.residentId = resident.id;
      button.title = resident.title;

      const badge = make('span', 'resident-badge', resident.name.slice(0, 1));
      badge.style.background = resident.district.accent;
      button.append(badge, make('span', 'resident-name', resident.name));
      button.append(make('span', 'resident-role', resident.district.glyph));

      button.addEventListener('click', () => this.handlers.onResident(resident));
      list.append(button);
      this.residentButtons.set(resident.id, button);
    }
  }

  private setFilter(filter: DistrictFilter) {
    this.filter = filter;
    this.applyFilter();
    this.handlers.onDistrict(filter);
  }

  /** Called from outside when the scene selects a resident. */
  setActiveResident(id: string | null) {
    for (const [residentId, button] of this.residentButtons) {
      button.classList.toggle('is-active', residentId === id);
    }
    if (!id) return;
    this.residentButtons.get(id)?.scrollIntoView({ block: 'nearest' });
  }

  setActiveDistrict(filter: DistrictFilter) {
    this.filter = filter;
    this.applyFilter();
  }

  private applyFilter() {
    const query = this.search.value.trim().toLowerCase();
    let visible = 0;

    for (const resident of RESIDENTS) {
      const button = this.residentButtons.get(resident.id);
      if (!button) continue;
      const haystack = [
        resident.name,
        resident.title,
        resident.district.name,
        resident.district.venue,
        ...resident.expertise,
      ]
        .join(' ')
        .toLowerCase();
      const matches =
        (this.filter === 'all' || resident.districtIndex === this.filter) &&
        haystack.includes(query);
      button.classList.toggle('is-hidden', !matches);
      if (matches) visible++;
    }

    this.count.textContent = String(visible);
    this.districtButtons.forEach((button, index) => {
      const target = this.filter === 'all' ? 0 : this.filter + 1;
      button.classList.toggle('is-active', index === target);
    });
  }
}
