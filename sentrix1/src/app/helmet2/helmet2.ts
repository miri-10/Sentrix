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
  count: number;
}

/**
 * helmet2 — stricter detector than `helmet`.
 *
 * It does NOT trust raw yellow pixels. Instead it:
 *   1. finds the FACE via skin-tone detection (largest skin region),
 *   2. classifies yellow in HSV with a tight hue + high-saturation band so
 *      skin / pale walls never qualify,
 *   3. only counts yellow that sits ABOVE the face center and within the
 *      face's horizontal span — i.e. an actual hard-hat on a head.
 *
 * Result: a yellow t-shirt (below the face), skin, or stray yellow off to
 * the side are all rejected. The flag flips only for a helmet on a face.
 */
@Component({
  selector: 'app-helmet2',
  imports: [],
  templateUrl: './helmet2.html',
  styleUrl: './helmet2.scss',
})
export class Helmet2 implements AfterViewInit, OnDestroy {
  private readonly global = inject(GlobalvarService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly hatOn = this.global.hatOn;

  readonly cameraReady = signal(false);
  readonly errorMsg = signal('');
  readonly scanY = signal(0);

  // live HUD metrics
  readonly faceFound = signal(false);
  readonly skinPct = signal(0);
  readonly helmetPct = signal(0);

  private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('overlay');

  private sample!: HTMLCanvasElement;
  private readonly SAMPLE_W = 160;
  private readonly SAMPLE_H = 120;

  // gates (fractions of the whole frame)
  private readonly SKIN_MIN_RATIO = 0.015; // a face must cover at least this
  private readonly HELMET_MIN_RATIO = 0.02; // gated yellow needed for "hat on"

  private stream: MediaStream | null = null;
  private rafId = 0;
  private running = false;

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser) return;
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
      console.error('[helmet2] getUserMedia failed', err);
    }
  }

  ngOnDestroy(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.stream?.getTracks().forEach((t) => t.stop());
  }

  private loop = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    const video = this.videoRef().nativeElement;
    if (video.readyState < 2) return;

    const sctx = this.sample.getContext('2d', { willReadFrequently: true });
    if (!sctx) return;

    sctx.save();
    sctx.translate(this.SAMPLE_W, 0);
    sctx.scale(-1, 1);
    sctx.drawImage(video, 0, 0, this.SAMPLE_W, this.SAMPLE_H);
    sctx.restore();

    const { data } = sctx.getImageData(0, 0, this.SAMPLE_W, this.SAMPLE_H);
    this.analyse(data);
  };

  /** Classify pixels, locate face, gate yellow to the helmet, update signals. */
  private analyse(data: Uint8ClampedArray): void {
    const total = this.SAMPLE_W * this.SAMPLE_H;

    // --- pass 1: build skin + yellow masks -------------------------------
    let skin: Box = this.emptyBox();
    const yellowPts: { x: number; y: number }[] = [];

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const x = p % this.SAMPLE_W;
      const y = (p / this.SAMPLE_W) | 0;

      if (this.isSkin(r, g, b)) {
        this.grow(skin, x, y);
      } else if (this.isYellow(r, g, b)) {
        yellowPts.push({ x, y });
      }
    }

    const faceFound = skin.count / total >= this.SKIN_MIN_RATIO;
    this.faceFound.set(faceFound);
    this.skinPct.set(+((skin.count / total) * 100).toFixed(1));

    // --- pass 2: keep only yellow that is a helmet ON the face -----------
    let helmet: Box = this.emptyBox();
    if (faceFound) {
      const spanW = skin.maxX - skin.minX;
      const xLo = skin.minX - spanW * 0.25;
      const xHi = skin.maxX + spanW * 0.25;
      for (const pt of yellowPts) {
        const aboveFaceCenter = pt.y <= skin.cy; // helmet sits on top of head
        const withinHeadWidth = pt.x >= xLo && pt.x <= xHi;
        if (aboveFaceCenter && withinHeadWidth) this.grow(helmet, pt.x, pt.y);
      }
    }

    const helmetRatio = helmet.count / total;
    this.helmetPct.set(+(helmetRatio * 100).toFixed(1));

    const hatOn = faceFound && helmetRatio >= this.HELMET_MIN_RATIO;
    this.global.hatOn.set(hatOn);
    this.global.yellowRatio.set(+helmetRatio.toFixed(3));

    this.render(faceFound ? skin : null, helmet.count ? helmet : null, hatOn);
  }

  // ---- pixel classifiers ------------------------------------------------

  /** Skin-tone rule (Kovac, uniform daylight). */
  private isSkin(r: number, g: number, b: number): boolean {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return (
      r > 95 &&
      g > 40 &&
      b > 20 &&
      max - min > 15 &&
      Math.abs(r - g) > 15 &&
      r > g &&
      r > b
    );
  }

  /**
   * Helmet yellow in HSV. A construction hard-hat is an orange-yellow with
   * hue ~32-50° and HIGH saturation (~0.6-0.85). Skin and a tan t-shirt land
   * in a similar hue range but are washed out (saturation ~0.3-0.4), so the
   * saturation floor is what actually rejects them.
   */
  private isYellow(r: number, g: number, b: number): boolean {
    const { h, s, v } = this.rgbToHsv(r, g, b);
    return h >= 28 && h <= 66 && s >= 0.5 && v >= 0.4;
  }

  private rgbToHsv(r: number, g: number, b: number) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : d / max;
    return { h, s, v: max };
  }

  // ---- bounding-box helpers --------------------------------------------

  private emptyBox(): Box {
    return { minX: 1e9, minY: 1e9, maxX: -1e9, maxY: -1e9, cx: 0, cy: 0, count: 0 };
  }

  private grow(box: Box, x: number, y: number): void {
    if (x < box.minX) box.minX = x;
    if (y < box.minY) box.minY = y;
    if (x > box.maxX) box.maxX = x;
    if (y > box.maxY) box.maxY = y;
    box.count++;
    box.cx = (box.minX + box.maxX) / 2;
    box.cy = (box.minY + box.maxY) / 2;
  }

  // ---- overlay rendering ------------------------------------------------

  private render(face: Box | null, helmet: Box | null, hatOn: boolean): void {
    const canvas = this.canvasRef().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const sx = W / this.SAMPLE_W;
    const sy = H / this.SAMPLE_H;
    ctx.clearRect(0, 0, W, H);
    ctx.font = '12px Consolas, monospace';

    // moving scan line
    const scan = (this.scanY() + 1.6) % 100;
    this.scanY.set(scan);
    const scanPx = (scan / 100) * H;
    ctx.strokeStyle = 'rgba(0,255,170,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, scanPx);
    ctx.lineTo(W, scanPx);
    ctx.stroke();

    // face box
    if (face) {
      const fx = face.minX * sx;
      const fy = face.minY * sy;
      const fw = (face.maxX - face.minX) * sx;
      const fh = (face.maxY - face.minY) * sy;
      ctx.strokeStyle = '#00ffaa';
      ctx.lineWidth = 2;
      ctx.strokeRect(fx, fy, fw, fh);
      this.corners(ctx, fx, fy, fw, fh, '#00ffaa');
      ctx.fillStyle = '#00ffaa';
      ctx.fillText('FACE', fx, fy - 6);

      // helmet box + lock-on line to the face
      if (helmet) {
        const hx = helmet.minX * sx;
        const hy = helmet.minY * sy;
        const hw = (helmet.maxX - helmet.minX) * sx;
        const hh = (helmet.maxY - helmet.minY) * sy;
        ctx.strokeStyle = '#f5c518';
        ctx.lineWidth = 2;
        ctx.strokeRect(hx, hy, hw, hh);
        this.corners(ctx, hx, hy, hw, hh, '#f5c518');
        ctx.fillStyle = '#f5c518';
        ctx.fillText('HELMET ✔', hx, hy - 6);

        ctx.strokeStyle = 'rgba(245,197,24,0.85)';
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(helmet.cx * sx, helmet.cy * sy);
        ctx.lineTo(face.cx * sx, face.cy * sy);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // HUD
    ctx.fillStyle = hatOn ? '#43d17a' : '#ff4d4f';
    ctx.fillText(
      `FACE:${this.faceFound() ? 'Y' : 'N'}  HELMET:${hatOn ? 'ON' : 'OFF'}  ` +
        `skin=${this.skinPct()}%  helmet=${this.helmetPct()}%`,
      12,
      H - 12,
    );
  }

  private corners(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
  ): void {
    const c = 14;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y);
    ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + c);
    ctx.moveTo(x, y + h - c); ctx.lineTo(x, y + h); ctx.lineTo(x + c, y + h);
    ctx.moveTo(x + w - c, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - c);
    ctx.stroke();
  }
}
