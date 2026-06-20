import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { GlobalvarService } from '../services/globalvar.service';

/**
 * Shape of a single worker row in the monitoring table.
 * NOTE: For now ALL rows are dummy. Later the first row (isReal = true)
 * will be populated from the backend with live sensor data, while the
 * rest stay dummy fillers for the UI.
 */
export interface Worker {
  id: string;
  name: string;
  isPresent: boolean;     // attendance presence
  work: string;           // current task / "attendence"
  heartbeat: number;      // bpm
  isHatOn: boolean;       // helmet detection
  gyro: { x: number; y: number; z: number };
  isReal: boolean;        // only the first row will eventually be real data
}

@Component({
  selector: 'app-test1',
  imports: [],
  templateUrl: './test1.html',
  styleUrl: './test1.scss',
})
export class Test1 implements OnInit, OnDestroy {
  private readonly global = inject(GlobalvarService);

  // Live helmet flag coming from the Helmet (computer-vision) component.
  readonly hatOn = this.global.hatOn;

  // ---- Company / header -------------------------------------------------
  readonly companyName = signal('Sentrix Industries');

  // ---- Environment sensor signals (the real ones we get from backend) ---
  // For now these are dummy and tick live so the UI feels interactive.
  readonly humidity = signal(54);        // %
  readonly temperature = signal(31);     // °C
  readonly gasDetect = signal(420);      // ppm

  // ---- Headcount --------------------------------------------------------
  readonly workers = signal<Worker[]>([
    this.makeWorker('SX-001', 'Ramesh K.', true),  // first row -> will be REAL later
    this.makeWorker('SX-002', 'Sita M.', false),
    this.makeWorker('SX-003', 'Bikash T.', false),
    this.makeWorker('SX-004', 'Anita R.', false),
    this.makeWorker('SX-005', 'Hari P.', false),
  ]);

  /**
   * Workers as shown in the table. The first row is the "real" one, so its
   * "is hat on" is driven LIVE by the helmet detector's global signal rather
   * than the dummy value. The rest stay dummy.
   */
  readonly displayWorkers = computed(() => {
    const list = this.workers();
    const hatOn = this.hatOn();
    return list.map((w, i) => (i === 0 ? { ...w, isHatOn: hatOn } : w));
  });

  // total healthy workers = present + helmet on + heartbeat in safe range
  readonly totalHealthyWorkers = computed(() =>
    this.displayWorkers().filter(
      (w) => w.isPresent && w.isHatOn && w.heartbeat >= 60 && w.heartbeat <= 110,
    ).length,
  );

  readonly totalWorkers = computed(() => this.workers().length);

  // Status of the gas reading drives the "danger" styling.
  readonly gasStatus = computed(() => {
    const g = this.gasDetect();
    if (g > 600) return 'danger';
    if (g > 450) return 'warn';
    return 'safe';
  });

  // The one real worker (first row) — heartbeat feeds the 3D anatomy.
  readonly primaryWorker = computed(() => this.displayWorkers()[0]);

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    // Simulate live signals streaming in. Replace with backend polling later.
    this.timer = setInterval(() => this.tick(), 1500);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Build a dummy worker row. */
  private makeWorker(id: string, name: string, isReal: boolean): Worker {
    return {
      id,
      name,
      isPresent: Math.random() > 0.2,
      work: ['Welding', 'Scaffolding', 'Inspection', 'Idle', 'Hauling'][
        Math.floor(Math.random() * 5)
      ],
      heartbeat: 70 + Math.floor(Math.random() * 40),
      isHatOn: Math.random() > 0.25,
      gyro: this.randGyro(),
      isReal,
    };
  }

  private randGyro() {
    return {
      x: +(Math.random() * 360 - 180).toFixed(0),
      y: +(Math.random() * 360 - 180).toFixed(0),
      z: +(Math.random() * 360 - 180).toFixed(0),
    };
  }

  /** Advance all dummy signals one step so the dashboard looks alive. */
  private tick(): void {
    this.humidity.update((v) => this.clamp(v + this.jitter(3), 20, 95));
    this.temperature.update((v) => this.clamp(v + this.jitter(1), 10, 55));
    this.gasDetect.update((v) => this.clamp(v + this.jitter(40), 100, 900));

    this.workers.update((list) =>
      list.map((w) => ({
        ...w,
        heartbeat: this.clamp(w.heartbeat + this.jitter(4), 55, 140),
        gyro: this.randGyro(),
      })),
    );
  }

  private jitter(mag: number): number {
    return Math.round((Math.random() * 2 - 1) * mag);
  }

  private clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
  }

  /** Heartbeat-driven animation duration for the 3D anatomy pulse (seconds). */
  readonly pulseDuration = computed(() => (60 / this.primaryWorker().heartbeat).toFixed(2));
}
