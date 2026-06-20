import {
  Component,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  PLATFORM_ID,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GlobalvarService } from '../services/globalvar.service';

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
}

@Component({
  selector: 'app-helmet',
  imports: [],
  templateUrl: './helmet.html',
  styleUrl: './helmet.scss',
})
export class Helmet implements AfterViewInit, OnDestroy {
  private readonly global = inject(GlobalvarService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // expose globals to template
  readonly hatOn = this.global.hatOn;
  readonly yellowRatio = this.global.yellowRatio;

  // UI state
  readonly cameraReady = signal(false);
  readonly errorMsg = signal('');
  readonly scanY = signal(0); // moving CV scan-line position (0..100 %)

  private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('overlay');

  // off-screen canvas we sample pixels from (downscaled for speed).
  // Created lazily in the browser so SSR never touches `document`.
  private sample!: HTMLCanvasElement;
  private readonly SAMPLE_W = 160;
  private readonly SAMPLE_H = 120;

  // A worn hard-hat fills roughly 4–8% of the frame at desk distance, while
  // stray yellow specks are well under 1%. Require a LOT of yellow so only a
  // real helmet flips the flag. Bump this up if it triggers too easily.
  private readonly YELLOW_THRESHOLD = 0.045;

  private stream: MediaStream | null = null;
  private rafId = 0;
  private running = false;

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser) return; // no camera/DOM on the server
    this.sample = document.createElement('canvas');
    this.sample.width = this.SAMPLE_W;
    this.sample.height = this.SAMPLE_H;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      const video = this.videoRef().nativeElement;
      video.srcObject = this.stream;
      await video.play();
      this.cameraReady.set(true);
      this.running = true;
      this.loop();
    } catch (err) {
      this.errorMsg.set(
        'Camera access denied or unavailable. Allow webcam to run helmet detection.',
      );
      console.error('[helmet] getUserMedia failed', err);
    }
  }

  ngOnDestroy(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.stream?.getTracks().forEach((t) => t.stop());
  }

  /** Main analysis + render loop. */
  private loop = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    const video = this.videoRef().nativeElement;
    if (video.readyState < 2) return;

    const sctx = this.sample.getContext('2d', { willReadFrequently: true });
    if (!sctx) return;

    // draw current frame into the small sampling canvas (mirrored)
    sctx.save();
    sctx.translate(this.SAMPLE_W, 0);
    sctx.scale(-1, 1);
    sctx.drawImage(video, 0, 0, this.SAMPLE_W, this.SAMPLE_H);
    sctx.restore();

    const { data } = sctx.getImageData(0, 0, this.SAMPLE_W, this.SAMPLE_H);
    const { yellowCount, box, points } = this.detectYellow(data);

    const total = this.SAMPLE_W * this.SAMPLE_H;
    const ratio = yellowCount / total;
    this.global.yellowRatio.set(+ratio.toFixed(3));
    this.global.hatOn.set(ratio >= this.YELLOW_THRESHOLD);

    this.render(box, points, ratio);
  };

  /** Classify each pixel as yellow; collect bounding box + sample points. */
  private detectYellow(data: Uint8ClampedArray) {
    let yellowCount = 0;
    let minX = this.SAMPLE_W,
      minY = this.SAMPLE_H,
      maxX = 0,
      maxY = 0;
    const points: { x: number; y: number }[] = [];

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // yellow = high red & green, low blue, R and G close together
      if (r > 110 && g > 110 && b < 110 && Math.abs(r - g) < 60) {
        yellowCount++;
        const x = p % this.SAMPLE_W;
        const y = (p / this.SAMPLE_W) | 0;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if ((p & 31) === 0) points.push({ x, y }); // sparse sample for CV dots
      }
    }

    const box: Box | null =
      yellowCount > 0
        ? {
            minX,
            minY,
            maxX,
            maxY,
            cx: (minX + maxX) / 2,
            cy: (minY + maxY) / 2,
          }
        : null;

    return { yellowCount, box, points };
  }

  /** Draw the CV-style overlay: scan line, tracked points, lines to target. */
  private render(box: Box | null, points: { x: number; y: number }[], ratio: number): void {
    const canvas = this.canvasRef().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const sx = W / this.SAMPLE_W;
    const sy = H / this.SAMPLE_H;
    ctx.clearRect(0, 0, W, H);

    // moving scan line — pure "computer vision" eye candy
    const scan = (this.scanY() + 1.6) % 100;
    this.scanY.set(scan);
    const scanPx = (scan / 100) * H;
    ctx.strokeStyle = 'rgba(0,255,170,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, scanPx);
    ctx.lineTo(W, scanPx);
    ctx.stroke();

    // crosshair at frame center (the "face" anchor)
    const fx = W / 2;
    const fy = H * 0.55;
    ctx.strokeStyle = 'rgba(0,255,170,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(fx, fy, 26, 0, Math.PI * 2);
    ctx.moveTo(fx - 36, fy);
    ctx.lineTo(fx + 36, fy);
    ctx.moveTo(fx, fy - 36);
    ctx.lineTo(fx, fy + 36);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,255,170,0.9)';
    ctx.font = '12px Consolas, monospace';
    ctx.fillText('FACE', fx + 30, fy - 30);

    if (!box) {
      this.hud(ctx, W, ratio, false);
      return;
    }

    const bx = box.minX * sx;
    const by = box.minY * sy;
    const bw = (box.maxX - box.minX) * sx;
    const bh = (box.maxY - box.minY) * sy;
    const tcx = box.cx * sx;
    const tcy = box.cy * sy;

    // bounding box around the helmet
    ctx.strokeStyle = '#f5c518';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);
    this.corners(ctx, bx, by, bw, bh);

    // tracked yellow points
    ctx.fillStyle = 'rgba(245,197,24,0.9)';
    for (const pt of points) {
      ctx.fillRect(pt.x * sx - 1, pt.y * sy - 1, 2, 2);
    }

    // connector lines from the face anchor to the helmet target
    ctx.strokeStyle = 'rgba(0,255,170,0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(tcx, tcy);
    // lines to each corner for a "lock-on" effect
    ctx.moveTo(fx, fy);
    ctx.lineTo(bx, by);
    ctx.moveTo(fx, fy);
    ctx.lineTo(bx + bw, by);
    ctx.stroke();
    ctx.setLineDash([]);

    // target reticle on the helmet
    ctx.strokeStyle = '#f5c518';
    ctx.beginPath();
    ctx.arc(tcx, tcy, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f5c518';
    ctx.fillText('HELMET ✔', bx, by - 6);

    this.hud(ctx, W, ratio, true);
  }

  private corners(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const c = 14;
    ctx.lineWidth = 3;
    ctx.beginPath();
    // TL
    ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y);
    // TR
    ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + c);
    // BL
    ctx.moveTo(x, y + h - c); ctx.lineTo(x, y + h); ctx.lineTo(x + c, y + h);
    // BR
    ctx.moveTo(x + w - c, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - c);
    ctx.stroke();
  }

  private hud(ctx: CanvasRenderingContext2D, _W: number, ratio: number, locked: boolean): void {
    ctx.font = '13px Consolas, monospace';
    ctx.fillStyle = locked ? '#43d17a' : '#ff4d4f';
    ctx.fillText(
      `HELMET: ${locked ? 'DETECTED' : 'NONE'}  yellow=${(ratio * 100).toFixed(1)}%`,
      12,
      22,
    );
  }
}
