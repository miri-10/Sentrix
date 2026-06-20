import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * App-wide shared state. Provided in root so every component (helmet
 * detector, dashboard, etc.) reads/writes the SAME signal instances.
 *
 * Because the helmet detector and the dashboard are often opened in
 * SEPARATE BROWSER TABS — and each tab is its own JS context with its own
 * service instance — the signals are mirrored across tabs over a
 * BroadcastChannel. Set the flag in any tab and every tab updates.
 */
@Injectable({ providedIn: 'root' })
export class GlobalvarService {
  /**
   * Helmet ("hat") detection flag.
   * Set to TRUE by the Helmet component when a significant amount of
   * yellow pixels (the hard hat) is seen in the webcam frame, FALSE when
   * the yellow object disappears. The dashboard's primary worker row
   * binds its "is hat on" status to this signal.
   */
  readonly hatOn = signal(false);

  /** Approx. share of the frame that is yellow (0..1) — for debug/HUD. */
  readonly yellowRatio = signal(0);

  private channel: BroadcastChannel | null = null;
  /** Suppress re-broadcasting a value we just received from another tab. */
  private applyingRemote = false;

  constructor() {
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    if (!isBrowser || typeof BroadcastChannel === 'undefined') return;

    this.channel = new BroadcastChannel('sentrix-global');

    // Receive updates from other tabs and apply them locally.
    this.channel.onmessage = (ev: MessageEvent) => {
      const data = ev.data ?? {};
      this.applyingRemote = true;
      if (typeof data.hatOn === 'boolean') this.hatOn.set(data.hatOn);
      if (typeof data.yellowRatio === 'number') this.yellowRatio.set(data.yellowRatio);
      this.applyingRemote = false;
    };

    // Broadcast local changes to every other tab.
    effect(() => {
      const payload = { hatOn: this.hatOn(), yellowRatio: this.yellowRatio() };
      if (this.applyingRemote) return; // don't echo what we just received
      this.channel?.postMessage(payload);
    });
  }
}
