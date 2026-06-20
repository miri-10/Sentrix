import {
  Component,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

/**
 * Landing / hero page for Sentrix.
 *
 * A faithful Angular port of the "horizon" Three.js + GSAP hero, recoloured
 * for an industrial worker-safety product: a calm, dark observation deck
 * rather than a bright marketing splash. A starfield + drifting haze + layered
 * ridge line sit behind the copy, and scrolling glides the camera through
 * three sections that introduce the three live tools (dashboard, helmet
 * detection, advanced detection).
 *
 * Everything Three.js / GSAP related is loaded and run ONLY in the browser via
 * dynamic import() so the SSR prerender (see app.routes.server.ts) never
 * touches `window`, `document` or WebGL.
 */
@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly canvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  // Scroll-driven UI state (bound in the template).
  readonly scrollProgress = signal(0);
  readonly currentSection = signal(0);
  readonly totalSections = 2;

  // The three live tools this page introduces / links to.
  readonly tools = [
    {
      tag: '01',
      name: 'Live Dashboard',
      desc: 'Heart-rate, gas, temperature and headcount for every worker on site, streaming in real time.',
      link: '/test1',
      cta: 'Open dashboard',
    },
    {
      tag: '02',
      name: 'Helmet Detection',
      desc: 'Computer-vision check on the live camera feed — a hard-hat lights up the lock-on reticle.',
      link: '/helmet',
      cta: 'Open camera',
    },
    {
      tag: '03',
      name: 'Advanced Detection',
      desc: 'Face-gated detector that only flags a helmet actually worn on a head — fewer false positives.',
      link: '/helmet2',
      cta: 'Open detector',
    },
  ];

  // Smoothed camera state, eased toward the scroll target each frame.
  private smoothCam = { x: 0, y: 30, z: 100 };

  // Mutable Three.js bag — kept loose since the lib is loaded dynamically.
  private three: any = {
    THREE: null,
    scene: null,
    camera: null,
    renderer: null,
    composer: null,
    stars: [],
    nebula: null,
    mountains: [],
    locations: [],
    animationId: 0,
    targetCameraX: undefined,
    targetCameraY: undefined,
    targetCameraZ: undefined,
  };

  private onScroll = (): void => this.handleScroll();
  private onResize = (): void => this.handleResize();
  private gsapTimeline: any = null;

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser) return;

    // Pull heavy, browser-only libs in here so SSR is never affected.
    const THREE = await import('three');
    const { EffectComposer } = await import(
      'three/examples/jsm/postprocessing/EffectComposer.js'
    );
    const { RenderPass } = await import(
      'three/examples/jsm/postprocessing/RenderPass.js'
    );
    const { UnrealBloomPass } = await import(
      'three/examples/jsm/postprocessing/UnrealBloomPass.js'
    );

    this.three.THREE = THREE;
    this.initThree(THREE, EffectComposer, RenderPass, UnrealBloomPass);

    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onResize);
    this.handleScroll();

    await this.runIntro();
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    const r = this.three;
    cancelAnimationFrame(r.animationId);
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onResize);
    this.gsapTimeline?.kill();

    r.stars.forEach((s: any) => {
      s.geometry.dispose();
      s.material.dispose();
    });
    r.mountains.forEach((m: any) => {
      m.geometry.dispose();
      m.material.dispose();
    });
    r.nebula?.geometry.dispose();
    r.nebula?.material.dispose();
    r.renderer?.dispose();
  }

  // ---- Three.js scene -----------------------------------------------------

  private initThree(
    THREE: any,
    EffectComposer: any,
    RenderPass: any,
    UnrealBloomPass: any,
  ): void {
    const r = this.three;

    r.scene = new THREE.Scene();
    r.scene.fog = new THREE.FogExp2(0x05070a, 0.00028);

    r.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000,
    );
    r.camera.position.set(0, 20, 100);

    r.renderer = new THREE.WebGLRenderer({
      canvas: this.canvasRef().nativeElement,
      antialias: true,
      alpha: true,
    });
    r.renderer.setSize(window.innerWidth, window.innerHeight);
    r.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Toned right down — this is a control room, not a fireworks show.
    r.renderer.toneMappingExposure = 0.42;

    r.composer = new EffectComposer(r.renderer);
    r.composer.addPass(new RenderPass(r.scene, r.camera));
    // Gentle bloom only — keeps the scene from ever feeling bright/glary.
    r.composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.35,
        0.4,
        0.9,
      ),
    );

    this.createStarField(THREE);
    this.createNebula(THREE);
    this.createMountains(THREE);
    this.createAtmosphere(THREE);
    r.locations = r.mountains.map((m: any) => m.position.z);

    this.animate();
  }

  private createStarField(THREE: any): void {
    const r = this.three;
    const starCount = 4000;

    for (let i = 0; i < 3; i++) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(starCount * 3);
      const colors = new Float32Array(starCount * 3);
      const sizes = new Float32Array(starCount);

      for (let j = 0; j < starCount; j++) {
        const radius = 200 + Math.random() * 800;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);

        positions[j * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[j * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[j * 3 + 2] = radius * Math.cos(phi);

        // Dim, mostly cool-white stars with a few faint amber sensor specks.
        const color = new THREE.Color();
        const choice = Math.random();
        if (choice < 0.8) color.setHSL(0.58, 0.15, 0.55 + Math.random() * 0.2);
        else if (choice < 0.95) color.setHSL(0.11, 0.5, 0.55);
        else color.setHSL(0.45, 0.4, 0.55);

        colors[j * 3] = color.r;
        colors[j * 3 + 1] = color.g;
        colors[j * 3 + 2] = color.b;
        sizes[j] = Math.random() * 1.6 + 0.4;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      const material = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, depth: { value: i } },
        vertexShader: `
          attribute float size;
          attribute vec3 color;
          varying vec3 vColor;
          uniform float time;
          uniform float depth;
          void main() {
            vColor = color;
            vec3 pos = position;
            float angle = time * 0.04 * (1.0 - depth * 0.3);
            mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
            pos.xy = rot * pos.xy;
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = size * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          void main() {
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;
            float opacity = 1.0 - smoothstep(0.0, 0.5, dist);
            gl_FragColor = vec4(vColor, opacity * 0.85);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const stars = new THREE.Points(geometry, material);
      r.scene.add(stars);
      r.stars.push(stars);
    }
  }

  private createNebula(THREE: any): void {
    const r = this.three;
    const geometry = new THREE.PlaneGeometry(8000, 4000, 100, 100);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        // Muted industrial haze: deep slate-teal into a low amber.
        color1: { value: new THREE.Color(0x0a2630) },
        color2: { value: new THREE.Color(0x3a2a12) },
        opacity: { value: 0.16 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vElevation;
        uniform float time;
        void main() {
          vUv = uv;
          vec3 pos = position;
          float elevation = sin(pos.x * 0.01 + time) * cos(pos.y * 0.01 + time) * 18.0;
          pos.z += elevation;
          vElevation = elevation;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color1;
        uniform vec3 color2;
        uniform float opacity;
        uniform float time;
        varying vec2 vUv;
        varying float vElevation;
        void main() {
          float mixFactor = sin(vUv.x * 10.0 + time) * cos(vUv.y * 10.0 + time);
          vec3 color = mix(color1, color2, mixFactor * 0.5 + 0.5);
          float alpha = opacity * (1.0 - length(vUv - 0.5) * 2.0);
          alpha *= 1.0 + vElevation * 0.01;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const nebula = new THREE.Mesh(geometry, material);
    nebula.position.z = -1050;
    r.scene.add(nebula);
    r.nebula = nebula;
  }

  private createMountains(THREE: any): void {
    const r = this.three;
    // Cool, dark slate ridge line — reads as a distant industrial skyline.
    const layers = [
      { distance: -50, height: 60, color: 0x14181f, opacity: 1 },
      { distance: -100, height: 80, color: 0x172230, opacity: 0.8 },
      { distance: -150, height: 100, color: 0x142c3c, opacity: 0.6 },
      { distance: -200, height: 120, color: 0x123642, opacity: 0.4 },
    ];

    layers.forEach((layer, index) => {
      const points: any[] = [];
      const segments = 50;
      for (let i = 0; i <= segments; i++) {
        const x = (i / segments - 0.5) * 1000;
        const y =
          Math.sin(i * 0.1) * layer.height +
          Math.sin(i * 0.05) * layer.height * 0.5 +
          Math.random() * layer.height * 0.2 -
          100;
        points.push(new THREE.Vector2(x, y));
      }
      points.push(new THREE.Vector2(5000, -300));
      points.push(new THREE.Vector2(-5000, -300));

      const shape = new THREE.Shape(points);
      const geometry = new THREE.ShapeGeometry(shape);
      const material = new THREE.MeshBasicMaterial({
        color: layer.color,
        transparent: true,
        opacity: layer.opacity,
        side: THREE.DoubleSide,
      });

      const mountain = new THREE.Mesh(geometry, material);
      mountain.position.z = layer.distance;
      mountain.position.y = layer.distance;
      mountain.userData = { baseZ: layer.distance, index };
      r.scene.add(mountain);
      r.mountains.push(mountain);
    });
  }

  private createAtmosphere(THREE: any): void {
    const r = this.three;
    const geometry = new THREE.SphereGeometry(600, 32, 32);
    const material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform float time;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          // Faint teal rim — subdued, not the bright sky blue of the original.
          vec3 atmosphere = vec3(0.14, 0.27, 0.32) * intensity;
          float pulse = sin(time * 2.0) * 0.1 + 0.9;
          atmosphere *= pulse;
          gl_FragColor = vec4(atmosphere, intensity * 0.16);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    r.scene.add(new THREE.Mesh(geometry, material));
  }

  private animate = (): void => {
    const r = this.three;
    r.animationId = requestAnimationFrame(this.animate);
    const time = Date.now() * 0.001;

    r.stars.forEach((s: any) => {
      if (s.material.uniforms) s.material.uniforms.time.value = time;
    });
    if (r.nebula?.material.uniforms) {
      r.nebula.material.uniforms.time.value = time * 0.5;
    }

    if (r.camera && r.targetCameraX !== undefined) {
      const k = 0.05;
      this.smoothCam.x += (r.targetCameraX - this.smoothCam.x) * k;
      this.smoothCam.y += (r.targetCameraY - this.smoothCam.y) * k;
      this.smoothCam.z += (r.targetCameraZ - this.smoothCam.z) * k;

      const floatX = Math.sin(time * 0.1) * 2;
      const floatY = Math.cos(time * 0.15) * 1;
      r.camera.position.x = this.smoothCam.x + floatX;
      r.camera.position.y = this.smoothCam.y + floatY;
      r.camera.position.z = this.smoothCam.z;
      r.camera.lookAt(0, 10, -600);
    }

    r.mountains.forEach((m: any, i: number) => {
      const parallax = 1 + i * 0.5;
      m.position.x = Math.sin(time * 0.1) * 2 * parallax;
      m.position.y = 50 + Math.cos(time * 0.15) * 1 * parallax;
    });

    r.composer?.render();
  };

  // ---- Scroll + intro -----------------------------------------------------

  private handleScroll(): void {
    const scrollY = window.scrollY;
    const maxScroll =
      document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? Math.min(scrollY / maxScroll, 1) : 0;

    this.scrollProgress.set(progress);
    const section = Math.floor(progress * this.totalSections);
    this.currentSection.set(section);

    const r = this.three;
    if (!r.camera) return;

    const totalProgress = progress * this.totalSections;
    const sectionProgress = totalProgress % 1;

    const positions = [
      { x: 0, y: 30, z: 300 },
      { x: 0, y: 40, z: -50 },
      { x: 0, y: 50, z: -700 },
    ];
    const cur = positions[section] || positions[0];
    const next = positions[section + 1] || cur;

    r.targetCameraX = cur.x + (next.x - cur.x) * sectionProgress;
    r.targetCameraY = cur.y + (next.y - cur.y) * sectionProgress;
    r.targetCameraZ = cur.z + (next.z - cur.z) * sectionProgress;

    r.mountains.forEach((m: any, i: number) => {
      const speed = 1 + i * 0.9;
      const targetZ = m.userData.baseZ + scrollY * speed * 0.5;
      if (r.nebula) r.nebula.position.z = targetZ + progress * speed * 0.01 - 100;
      m.position.z = progress > 0.7 ? 600000 : r.locations[i];
    });
    if (r.nebula && r.mountains[3]) {
      r.nebula.position.z = r.mountains[3].position.z;
    }
  }

  private handleResize(): void {
    const r = this.three;
    if (!r.camera || !r.renderer || !r.composer) return;
    r.camera.aspect = window.innerWidth / window.innerHeight;
    r.camera.updateProjectionMatrix();
    r.renderer.setSize(window.innerWidth, window.innerHeight);
    r.composer.setSize(window.innerWidth, window.innerHeight);
  }

  private async runIntro(): Promise<void> {
    const { gsap } = await import('gsap');
    const el = this.host.nativeElement as HTMLElement;
    const q = (sel: string) => el.querySelectorAll(sel);

    gsap.set(
      [el.querySelector('.side-menu'), ...q('.reveal')],
      { visibility: 'visible' },
    );

    const tl = gsap.timeline();
    this.gsapTimeline = tl;

    const menu = el.querySelector('.side-menu');
    if (menu) {
      tl.from(menu, { x: -60, opacity: 0, duration: 1, ease: 'power3.out' });
    }
    tl.from(
      q('.hero-title .title-char'),
      { y: 160, opacity: 0, duration: 1.2, stagger: 0.05, ease: 'power4.out' },
      '-=0.5',
    );
    tl.from(
      q('.hero-subtitle .subtitle-line'),
      { y: 40, opacity: 0, duration: 1, stagger: 0.18, ease: 'power3.out' },
      '-=0.8',
    );
    tl.from(
      q('.hero-actions .reveal'),
      { y: 24, opacity: 0, duration: 0.8, stagger: 0.12, ease: 'power2.out' },
      '-=0.6',
    );
    const scroll = el.querySelector('.scroll-progress');
    if (scroll) {
      tl.from(scroll, { opacity: 0, y: 40, duration: 1, ease: 'power2.out' }, '-=0.4');
    }
  }

  // Split a heading into per-character spans for the staggered GSAP intro.
  splitTitle(text: string): string[] {
    return text.split('');
  }
}
