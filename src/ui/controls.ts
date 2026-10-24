import { el } from './dom';

export interface ControlHandlers {
  onRunToggle: (running: boolean) => void;
  onTourToggle: (touring: boolean) => void;
  onLabelsToggle: (visible: boolean) => void;
  onSpeedChange: (multiplier: number) => void;
  onZoom: (direction: 1 | -1) => void;
  onHome: () => void;
}

const SPEEDS = [1, 2, 4, 8];

/** Footer chips, camera buttons and the two live readouts. */
export class Controls {
  private running = true;
  private touring = false;
  private labels = true;
  private speedIndex = 0;

  private readonly runButton = el<HTMLButtonElement>('toggle-run');
  private readonly tourButton = el<HTMLButtonElement>('toggle-tour');
  private readonly labelButton = el<HTMLButtonElement>('toggle-labels');
  private readonly speedButton = el<HTMLButtonElement>('toggle-speed');
  private readonly clock = el('clock');
  private readonly phase = el('phase');
  private readonly state = el('stat-state');
  private readonly fps = el('stat-fps');
  private readonly awake = el('meta-awake');
  private readonly sceneTitle = el('scene-title');
  private readonly sceneSubtitle = el('scene-subtitle');

  constructor(private readonly handlers: ControlHandlers) {
    this.runButton.addEventListener('click', () => this.setRunning(!this.running));
    this.tourButton.addEventListener('click', () => this.setTouring(!this.touring));
    this.labelButton.addEventListener('click', () => {
      this.labels = !this.labels;
      this.labelButton.classList.toggle('is-on', this.labels);
      this.labelButton.textContent = this.labels ? 'Labels' : 'Labels Off';
      this.handlers.onLabelsToggle(this.labels);
    });
    this.speedButton.addEventListener('click', () => {
      this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
      const speed = SPEEDS[this.speedIndex];
      this.speedButton.textContent = `Speed ${speed}×`;
      this.speedButton.classList.toggle('is-on', speed !== 1);
      this.handlers.onSpeedChange(speed);
    });

    el('zoom-in').addEventListener('click', () => this.handlers.onZoom(1));
    el('zoom-out').addEventListener('click', () => this.handlers.onZoom(-1));
    el('camera-home').addEventListener('click', () => this.handlers.onHome());

    window.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.code === 'Space') {
        event.preventDefault();
        this.setRunning(!this.running);
      } else if (event.key === 't' || event.key === 'T') {
        this.setRunning(true);
        this.setTouring(!this.touring);
      } else if (event.key === 'Escape') {
        this.handlers.onHome();
      }
    });
  }

  setRunning(running: boolean) {
    this.running = running;
    this.runButton.textContent = running ? 'Pause World' : 'Resume World';
    this.runButton.classList.toggle('is-on', running);
    this.state.textContent = running ? 'Working' : 'Paused';
    this.handlers.onRunToggle(running);
  }

  setTouring(touring: boolean) {
    this.touring = touring;
    this.tourButton.textContent = touring ? 'End Tour' : 'Guided Tour';
    this.tourButton.classList.toggle('is-on', touring);
    this.handlers.onTourToggle(touring);
  }

  setClock(time: string, phase: string) {
    this.clock.textContent = time;
    this.phase.textContent = phase;
  }

  setFps(value: number) {
    this.fps.textContent = `${value} FPS`;
  }

  setAwake(count: number) {
    this.awake.textContent = String(count);
  }

  setHeading(title: string, subtitle: string) {
    this.sceneTitle.textContent = title;
    this.sceneSubtitle.textContent = subtitle;
  }
}
