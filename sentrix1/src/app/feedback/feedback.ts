import { Component } from '@angular/core';

interface Testimonial {
  text: string;
  image: string;
  name: string;
  role: string;
}

/**
 * Feedback — Angular port of the "testimonials columns" component.
 *
 * Three columns of cards scroll vertically and infinitely (CSS keyframes
 * replace the original framer-motion translateY loop). Each column duplicates
 * its cards so the -50% loop is seamless. Recast as Sentrix customer feedback
 * from safety/operations roles, styled dark to match the landing page.
 *
 * Mounted in the app shell under the landing route only — the landing
 * component is never touched.
 */
@Component({
  selector: 'app-feedback',
  imports: [],
  templateUrl: './feedback.html',
  styleUrl: './feedback.scss',
})
export class Feedback {
  private readonly all: Testimonial[] = [
    {
      text: 'Sentrix caught three missing-helmet incidents in our first week. The live camera check is now part of every shift handover.',
      image: 'landing/avatars/women-1.jpg',
      name: 'Briana Patton',
      role: 'Operations Manager',
    },
    {
      text: 'Rolling it out was painless. The dashboard reads our gas and heart-rate sensors straight away — no integration headache.',
      image: 'landing/avatars/men-2.jpg',
      name: 'Bilal Ahmed',
      role: 'EHS Lead',
    },
    {
      text: 'The face-gated detector stopped the false alarms we used to get from yellow gear. Now an alert actually means something.',
      image: 'landing/avatars/women-3.jpg',
      name: 'Saman Malik',
      role: 'Safety Officer',
    },
    {
      text: 'One screen for headcount, vitals and PPE means my supervisors stop chasing clipboards and start watching the floor.',
      image: 'landing/avatars/men-4.jpg',
      name: 'Omar Raza',
      role: 'Plant Director',
    },
    {
      text: 'We dropped our reportable incidents noticeably after a month. Knowing who is on site and healthy in real time is huge.',
      image: 'landing/avatars/women-5.jpg',
      name: 'Zainab Hussain',
      role: 'Project Manager',
    },
    {
      text: 'Setup took an afternoon. The helmet detection just works off a normal webcam, which kept our hardware budget flat.',
      image: 'landing/avatars/women-6.jpg',
      name: 'Aliza Khan',
      role: 'Site Engineer',
    },
    {
      text: 'Hot-work zones are the riskiest part of our day. Seeing temperature and gas trend live has changed how we run them.',
      image: 'landing/avatars/men-7.jpg',
      name: 'Farhan Siddiqui',
      role: 'Shift Foreman',
    },
    {
      text: 'Audits used to take days of paperwork. With Sentrix logging presence and PPE, our compliance reviews are a formality now.',
      image: 'landing/avatars/women-8.jpg',
      name: 'Sana Sheikh',
      role: 'Compliance Lead',
    },
    {
      text: 'The crew trusts it because it is not intrusive — no wearables, just a camera and a clear readout. Adoption was immediate.',
      image: 'landing/avatars/men-9.jpg',
      name: 'Hassan Ali',
      role: 'Floor Supervisor',
    },
  ];

  readonly columns: Testimonial[][] = [
    this.all.slice(0, 3),
    this.all.slice(3, 6),
    this.all.slice(6, 9),
  ];

  // Duplicate each column so the vertical -50% scroll loops seamlessly.
  loop(col: Testimonial[]): Testimonial[] {
    return [...col, ...col];
  }
}
