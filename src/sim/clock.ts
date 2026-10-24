/** Sim clock. One real second is `scale` sim minutes. */
export class Clock {
  /** Minutes since midnight, wrapping at 1440. */
  minutes: number;
  scale: number;
  private lastHour: number;

  constructor(startHour = 8, scale = 2.2) {
    this.minutes = startHour * 60;
    this.scale = scale;
    this.lastHour = Math.floor(startHour);
  }

  advance(dt: number): { hourChanged: boolean } {
    this.minutes = (this.minutes + dt * this.scale) % 1440;
    const hour = Math.floor(this.minutes / 60);
    const hourChanged = hour !== this.lastHour;
    this.lastHour = hour;
    return { hourChanged };
  }

  get hour(): number {
    return Math.floor(this.minutes / 60);
  }

  /** Fractional hour, for the sun arc. */
  get hourFraction(): number {
    return this.minutes / 60;
  }

  get label(): string {
    const total = Math.floor(this.minutes);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
