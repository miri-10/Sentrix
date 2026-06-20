import { Component, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { Insights } from './insights/insights';
import { Feedback } from './feedback/feedback';
import { Footer } from './footer/footer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Insights, Feedback, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly router = inject(Router);
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly title = signal('sentrix1');

  /**
   * Whether the landing page ('/') is the active route. The insights section
   * is rendered under the router-outlet ONLY here, so the landing component
   * itself is never modified and its GSAP intro stays intact.
   *
   * The initial value is read from the real URL (location on the browser,
   * router on the server) so the client's first render MATCHES the SSR output
   * and hydration never strips the server-rendered section. After that it
   * tracks client-side navigation via NavigationEnd.
   */
  private isRoot(url: string): boolean {
    return url === '/' || url === '';
  }
  private readonly initialIsLanding = this.isBrowser
    ? this.isRoot(this.doc.location.pathname)
    : this.isRoot(this.router.url);

  protected readonly isLanding = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => this.isRoot(e.urlAfterRedirects)),
    ),
    { initialValue: this.initialIsLanding },
  );
}
