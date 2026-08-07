import * as THREE from 'three';
import { CABLES, DECORS, defaultSelection, ROUTES, ROVS, type Selection } from '../core/content';
import { Input } from '../core/input';
import { sound } from '../core/audio';
import { Hud } from '../ui/hud';
import { MapStage } from './map';
import { SeaStage } from './sea';
import { clamp, clamp01 } from '../core/util';

type Stage = 'title' | 'select' | 'sea' | 'finale';

const FINALE_TOTAL = (i: number) => 1.5 + i * 0.42 + 1.0;

export class Game {
  private renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;
  private hud: Hud;
  private input: Input;
  private map: MapStage;
  private sea: SeaStage;
  private sel: Selection = defaultSelection();

  private stage: Stage = 'title';
  private w = 1;
  private h = 1;
  private portrait = false;
  private last = 0;
  private raf = 0;
  private doneHold = 0;
  private finaleT = 0;
  private transition = 0;
  private pendingStage: (() => void) | null = null;
  private seaBuilt = false;
  private titleT = 0;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.setClearColor(0x04121f, 1);

    this.hud = new Hud(uiRoot);
    this.input = new Input(canvas);
    this.map = new MapStage();
    this.sea = new SeaStage({
      onPhase: (p) => this.onSeaPhase(p),
      onFirstWater: () => this.hud.flashOnce(0.18, 320),
      onLightsOn: () => this.hud.flashOnce(0.1, 300),
    });

    this.hud.onButton = (b) => this.onButton(b);
    this.input.onTap = () => this.onTap();
    this.input.onDown = () => sound.unlock();

    this.map.setHighlight(0);
    this.resize();
    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('orientationchange', () => {
      window.setTimeout(this.onResize, 60);
      window.setTimeout(this.onResize, 320);
    });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) sound.silenceLoops();
      this.last = performance.now();
    });
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      cancelAnimationFrame(this.raf);
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    });

    this.enterTitle();
  }

  // -------------------------------------------------------------------------
  private onResize = () => this.resize();

  private resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.w = w;
    this.h = h;
    const wasPortrait = this.portrait;
    this.portrait = h >= w;
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.sea.setPixelRatio(dpr);
    this.input.resize();
    this.hud.setOrientationClass(this.portrait);
    if (wasPortrait !== this.portrait && this.stage === 'select') this.map.framePicker(this.portrait);
    // nothing else to do: every stage recomputes its shot from `portrait`
    // each frame, so rotating never disturbs game state.
  }

  // -------------------------------------------------------------------------
  // stage flow
  // -------------------------------------------------------------------------
  private enterTitle() {
    this.stage = 'title';
    this.map.focusPair(null);
    this.map.setDusk(0);
    this.titleT = 0;
    this.map.framePicker(this.portrait);
    this.hud.setTitle(true);
    this.hud.setLever(false);
    this.hud.setRail(false);
    this.hud.hidePicker();
    this.hud.setButton('go', false);
    this.hud.setButton('replay', false);
    this.hud.setButton('home', false);
    this.hud.setButton('mute', true);
    this.hud.setVignette(0);
  }

  private enterSelect() {
    this.stage = 'select';
    this.hud.setTitle(false);
    this.hud.setRail(false);
    this.hud.setLever(false);
    this.hud.setButton('replay', false);
    this.hud.setButton('home', false);
    this.hud.setButton('go', true);
    this.map.framePicker(this.portrait);
    this.map.setHighlight(this.sel.routeIndex);
    this.map.resetFinale(this.sel.routeIndex);
    this.map.focusPair(null);
    this.map.setDusk(0);
    this.buildPicker();
  }

  private enterSea() {
    this.stage = 'sea';
    this.hud.hidePicker();
    this.hud.setButton('go', false);
    this.hud.setButton('replay', false);
    this.hud.setButton('home', true);
    this.hud.setRail(true, 0);
    this.hud.setLever(false);
    this.hud.setVignette(0);
    this.sea.build(this.sel);
    this.seaBuilt = true;
    this.doneHold = 0;
  }

  private enterFinale() {
    this.stage = 'finale';
    this.finaleT = 0;
    // the sea stage stops updating here, so its continuous voices have to be
    // told to stop rather than left humming under the celebration
    sound.silenceLoops();
    sound.setSubmersion(0);
    this.hud.setLever(false);
    this.hud.setRail(false);
    this.hud.setHand(false);
    this.hud.setButton('home', false);
    this.hud.setButton('replay', false);
    this.map.setHighlight(this.sel.routeIndex);
    this.map.setLinkColor(CABLES[this.sel.cableIndex].glow, this.sel.routeIndex);
    this.map.resetFinale(this.sel.routeIndex);
    this.map.frameResult(this.sel.routeIndex, this.portrait, 0);
    this.map.focusPair(this.sel.routeIndex);
    sound.fanfare();
    this.hud.flashOnce(0.5, 700);
  }

  /** Cross-fade helper so stage swaps never pop. */
  private go(fn: () => void) {
    if (this.pendingStage) return;
    this.pendingStage = fn;
    this.transition = 0.0001;
    this.hud.setFade(1, 380);
  }

  private onSeaPhase(p: string) {
    this.hud.setLever(p === 'payout');
    this.hud.setHand(false);
    if (p === 'payout') sound.blip(700, 0.25, 'triangle', 0.14);
    if (p === 'done') this.doneHold = 0;
  }

  // -------------------------------------------------------------------------
  private onTap() {
    sound.unlock();
    if (this.stage === 'title') {
      sound.tap();
      this.go(() => this.enterSelect());
      return;
    }
    if (this.stage === 'select') {
      const i = this.map.pick(this.input.ndc);
      if (i >= 0 && i !== this.sel.routeIndex) {
        this.sel.routeIndex = i;
        this.map.setHighlight(i);
        sound.tap();
      } else if (i >= 0) {
        sound.blip(560, 0.14, 'sine', 0.1);
      }
    }
  }

  private onButton(b: 'mute' | 'home' | 'replay' | 'go') {
    sound.unlock();
    switch (b) {
      case 'mute':
        sound.setMuted(!sound.muted);
        this.hud.setMuteIcon(sound.muted);
        break;
      case 'go':
        sound.tap();
        this.go(() => this.enterSea());
        break;
      case 'replay':
        sound.tap();
        this.go(() => this.enterSea());
        break;
      case 'home':
        sound.tap();
        sound.silenceLoops();
        this.go(() => this.enterSelect());
        break;
    }
  }

  // -------------------------------------------------------------------------
  private buildPicker() {
    const drawCable = (i: number) => (c: HTMLCanvasElement) => {
      const x = c.getContext('2d')!;
      const d = CABLES[i];
      x.clearRect(0, 0, 96, 96);
      x.lineCap = 'round';
      for (let k = 4; k >= 0; k--) {
        x.beginPath();
        x.arc(48, 48, 12 + k * 7, 0, Math.PI * 2);
        x.strokeStyle = `#${d.jacket.toString(16).padStart(6, '0')}`;
        x.lineWidth = 6;
        x.stroke();
        x.beginPath();
        x.arc(48, 48, 12 + k * 7, -0.9 + k * 0.7, -0.2 + k * 0.7);
        x.strokeStyle = `#${d.stripe.toString(16).padStart(6, '0')}`;
        x.lineWidth = 5;
        x.stroke();
      }
      x.beginPath();
      x.arc(48, 48, 5, 0, Math.PI * 2);
      x.fillStyle = `#${d.glow.toString(16).padStart(6, '0')}`;
      x.fill();
    };
    const drawRov = (i: number) => (c: HTMLCanvasElement) => {
      const x = c.getContext('2d')!;
      const d = ROVS[i];
      x.clearRect(0, 0, 96, 96);
      x.fillStyle = `#${d.frame.toString(16).padStart(6, '0')}`;
      x.strokeStyle = `#${d.frame.toString(16).padStart(6, '0')}`;
      x.lineWidth = 5;
      if (d.shape === 'boxy') {
        x.strokeRect(20, 30, 56, 38);
        x.fillStyle = `#${d.body.toString(16).padStart(6, '0')}`;
        x.fillRect(24, 22, 48, 14);
        x.fillStyle = '#0d1a20';
        x.fillRect(14, 68, 68, 6);
      } else {
        x.fillStyle = `#${d.body.toString(16).padStart(6, '0')}`;
        x.beginPath();
        x.ellipse(48, 46, 34, 15, 0, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = `#${d.frame.toString(16).padStart(6, '0')}`;
        x.fillRect(70, 30, 10, 32);
        x.fillStyle = '#0d1a20';
        x.fillRect(18, 62, 60, 5);
      }
      // lamps
      x.fillStyle = '#fff3c8';
      for (let k = 0; k < d.lampCount; k++) {
        x.beginPath();
        x.arc(24 + k * 10, 56, 5, 0, Math.PI * 2);
        x.fill();
      }
    };
    const drawDecor = (i: number) => (c: HTMLCanvasElement) => {
      const x = c.getContext('2d')!;
      const d = DECORS[i];
      x.clearRect(0, 0, 96, 96);
      if (d.rainbow) {
        const g = x.createLinearGradient(16, 16, 80, 80);
        ['#ff5a5a', '#ffa64d', '#ffe34d', '#6fdc6f', '#5ab7ff', '#a87bff'].forEach((col, k, arr) =>
          g.addColorStop(k / (arr.length - 1), col),
        );
        x.fillStyle = g;
      } else {
        x.fillStyle = `#${d.accent.toString(16).padStart(6, '0')}`;
      }
      x.beginPath();
      x.arc(48, 48, 30, 0, Math.PI * 2);
      x.fill();
      if (d.stars) {
        x.fillStyle = '#ffffff';
        x.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
          const r = k % 2 === 0 ? 16 : 7;
          const px = 48 + Math.cos(a) * r;
          const py = 48 + Math.sin(a) * r;
          k === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
        }
        x.closePath();
        x.fill();
      } else {
        x.strokeStyle = '#2b3136';
        x.lineWidth = 7;
        x.beginPath();
        x.arc(48, 48, 15, 0, Math.PI * 2);
        x.stroke();
      }
    };

    this.hud.setPicker(
      [
        { key: 'cable', options: CABLES.map((_, i) => ({ draw: drawCable(i) })), selected: this.sel.cableIndex },
        { key: 'rov', options: ROVS.map((_, i) => ({ draw: drawRov(i) })), selected: this.sel.rovIndex },
        { key: 'decor', options: DECORS.map((_, i) => ({ draw: drawDecor(i) })), selected: this.sel.decorIndex },
      ],
      (key, i) => {
        sound.tap();
        if (key === 'cable') this.sel.cableIndex = i;
        if (key === 'rov') this.sel.rovIndex = i;
        if (key === 'decor') this.sel.decorIndex = i;
      },
    );
  }

  // -------------------------------------------------------------------------
  start() {
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) dt = 1 / 60;
    dt = Math.min(dt, 1 / 20);

    this.input.update(dt);

    // stage cross-fade
    if (this.pendingStage) {
      this.transition += dt;
      if (this.transition > 0.4) {
        const fn = this.pendingStage;
        this.pendingStage = null;
        this.transition = 0;
        fn();
        this.hud.setFade(0, 420);
      }
    }

    switch (this.stage) {
      case 'title':
        this.titleT += dt;
        this.map.update(dt, this.w / this.h);
        this.map.setHighlight(Math.floor(this.titleT / 2.2) % ROUTES.length);
        this.renderer.render(this.map.scene, this.map.camera);
        break;

      case 'select':
        this.map.framePicker(this.portrait);
        this.map.update(dt, this.w / this.h);
        this.renderer.render(this.map.scene, this.map.camera);
        this.updateSelectHud();
        break;

      case 'sea':
        this.updateSea(dt);
        this.renderer.render(this.sea.scene, this.sea.camera);
        break;

      case 'finale':
        this.finaleT += dt;
        this.map.setDusk(clamp01(this.finaleT / 2.2));
        this.map.frameResult(this.sel.routeIndex, this.portrait, this.finaleT);
        this.map.applyFinale(this.sel.routeIndex, this.finaleT, (i) => sound.spark(i));
        this.map.update(dt, this.w / this.h);
        this.renderer.render(this.map.scene, this.map.camera);
        {
          const total = FINALE_TOTAL(
            this.map.pairs[this.sel.routeIndex].a.buildingCount + this.map.pairs[this.sel.routeIndex].b.buildingCount,
          );
          const show = this.finaleT > total;
          this.hud.setButton('replay', show);
          this.hud.setButton('home', show);
        }
        break;
    }
  };

  private updateSelectHud() {
    // point the hint hand at the currently highlighted pair so the child sees
    // that islands are tappable
    const p = this.map.pairs[this.sel.routeIndex];
    const out = { x: 0, y: 0 };
    this.map.project(p.centre, this.w, this.h, out);
    this.hud.setHand(true, out.x, out.y);
  }

  private updateSea(dt: number) {
    if (!this.seaBuilt) return;
    this.sea.update(dt, this.input, this.portrait, this.hud.isLeverHeld());
    this.hud.setRail(true, this.sea.progress);
    this.hud.setLeverAmount(this.sea.payoutAmount);
    // gentle darkening at the frame edges as the world goes deep
    this.hud.setVignette(clamp01((-this.sea.camera.position.y - 4) / 26) * 0.5);

    const hp = this.sea.hintScreenPoint(this.w, this.h);
    if (hp && this.stage === 'sea') this.hud.setHand(true, hp.x, hp.y);
    else this.hud.setHand(false);

    if (this.sea.finished) {
      this.doneHold += dt;
      if (this.doneHold > 4.2) this.go(() => this.enterFinale());
    }
  }
}
