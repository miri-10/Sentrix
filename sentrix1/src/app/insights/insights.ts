import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Post {
  title: string;
  category: string;
  image: string;
}

interface Slide {
  title: string;
  image: string;
}

/**
 * Insights — standalone page (route: /insights).
 *
 * Angular port of the "Latest Blog" card grid + marquee carousel, recast as
 * Sentrix's safety-resources page: a row of article cards over a slow image
 * marquee of real site photography (downloaded into /public/landing).
 * Styled dark to match the landing page rather than the bright white original.
 *
 * Pure template + CSS — prerenders fine under SSR.
 */
@Component({
  selector: 'app-insights',
  imports: [RouterLink],
  templateUrl: './insights.html',
  styleUrl: './insights.scss',
})
export class Insights {
  // Pause the marquee on hover (mirrors the React stopScroll state).
  readonly paused = signal(false);

  readonly posts: Post[] = [
    {
      title: 'Why hard-hat compliance is the metric that matters most',
      category: 'Site Safety',
      image: 'landing/helmet-ppe.jpg',
    },
    {
      title: 'Reading worker vitals in real time, without wearables',
      category: 'Monitoring',
      image: 'landing/worker-vitals.jpg',
    },
    {
      title: 'Computer vision on the factory floor: what it sees',
      category: 'Detection',
      image: 'landing/camera-cv.jpg',
    },
  ];

  readonly slides: Slide[] = [
    { title: 'Live site overview', image: 'landing/construction-site.jpg' },
    { title: 'PPE & high-vis checks', image: 'landing/safety-vest.jpg' },
    { title: 'Hot-work zones', image: 'landing/welding.jpg' },
    { title: 'Central control room', image: 'landing/control-room.jpg' },
    { title: 'Floor-level coverage', image: 'landing/factory-floor.jpg' },
  ];

  // Duplicate the list so the -50% marquee loops seamlessly.
  get loop(): Slide[] {
    return [...this.slides, ...this.slides];
  }

  get marqueeDuration(): string {
    return this.slides.length * 3000 + 'ms';
  }
}
