import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FooterLink {
  label: string;
  link?: string; // internal route
  href?: string; // external / placeholder
}
interface FooterCol {
  title: string;
  links: FooterLink[];
}

/**
 * Footer — site footer for the landing page, modelled on the WHOOP footer
 * (link columns + brand/mission band + email signup + copyright/locale).
 * Recast for Sentrix and styled dark to match the rest of the page.
 *
 * Mounted in the app shell under the landing route only, so the landing
 * component is never modified.
 */
@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  readonly email = signal('');
  readonly submitted = signal(false);

  readonly year = new Date().getFullYear();

  readonly columns: FooterCol[] = [
    {
      title: 'Product',
      links: [
        { label: 'Live Dashboard', link: '/test1' },
        { label: 'Helmet Detection', link: '/helmet' },
        { label: 'Advanced Detection', link: '/helmet2' },
        { label: 'Insights', href: '#' },
        { label: 'Request a Demo', href: '#' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '#' },
        { label: 'Careers', href: '#' },
        { label: 'Engineering', href: '#' },
        { label: 'Our Mission', href: '#' },
        { label: 'Press', href: '#' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { label: 'Documentation', href: '#' },
        { label: 'API Reference', href: '#' },
        { label: 'System Status', href: '#' },
        { label: 'Changelog', href: '#' },
        { label: 'Support', href: '#' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Terms of Use', href: '#' },
        { label: 'Privacy Policy', href: '#' },
        { label: 'Security', href: '#' },
        { label: 'Data Protection', href: '#' },
        { label: 'Compliance', href: '#' },
      ],
    },
    {
      title: 'Connect',
      links: [
        { label: 'Contact Sales', href: '#' },
        { label: 'Become a Partner', href: '#' },
        { label: 'Integrations', href: '#' },
        { label: 'Community', href: '#' },
      ],
    },
  ];

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.email().trim().length > 0) {
      this.submitted.set(true);
    }
  }
}
