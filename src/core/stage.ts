import {
  ACESFilmicToneMapping,
  FogExp2,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { damp } from './util';

export type Orientation = 'portrait' | 'landscape';

interface CamLayout {
  fov: number;
  pos: Vector3;
  look: Vector3;
  /** How far apart the birds fan out across the river. */
  spread: number;
}

/**
 * Two hand-authored camera compositions rather than one camera that gets
 * squeezed: portrait looks along the river so the fire sits high and the water
 * fills the frame; landscape pulls back and widens the fan of ropes.
 */
const LAYOUTS: Record<Orientation, CamLayout> = {
  portrait: {
    fov: 55,
    pos: new Vector3(3.1, 2.5, 3.0),
    look: new Vector3(-0.8, 0.2, -6.0),
    spread: 1.0,
  },
  landscape: {
    fov: 42,
    pos: new Vector3(3.5, 2.15, 2.5),
    look: new Vector3(-0.9, 0.45, -5.4),
    spread: 1.28,
  },
};

export class Stage {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;

  orientation: Orientation = 'portrait';
  spread = LAYOUTS.portrait.spread;
  width = 1;
  height = 1;
  dpr = 1;

  /** Camera offsets driven by the game (boat rocking, finale drift). */
  readonly camOffset = new Vector3();
  readonly lookOffset = new Vector3();

  private basePos = new Vector3();
  private baseLook = new Vector3();
  private curPos = new Vector3();
  private curLook = new Vector3();
  private maxDpr: number;
  private perfSamples: number[] = [];
  private snapNext = true;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = 2; // PCFSoftShadowMap
    this.renderer.setClearColor(0x05070f, 1);

    this.maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = this.maxDpr;

    this.camera = new PerspectiveCamera(56, 1, 0.1, 320);
    this.scene.fog = new FogExp2(0x070d1d, 0.026);

    this.applyLayout(true);
    this.resize();
  }

  private currentOrientation(): Orientation {
    return window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape';
  }

  private applyLayout(snap: boolean): void {
    const l = LAYOUTS[this.orientation];
    this.camera.fov = l.fov;
    this.basePos.copy(l.pos);
    this.baseLook.copy(l.look);
    this.spread = l.spread;
    if (snap) {
      this.curPos.copy(this.basePos);
      this.curLook.copy(this.baseLook);
      this.camera.position.copy(this.curPos);
      this.camera.lookAt(this.curLook);
    }
    this.camera.updateProjectionMatrix();
  }

  resize(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const nextOrientation = this.currentOrientation();
    const changed = nextOrientation !== this.orientation;
    this.orientation = nextOrientation;
    this.width = w;
    this.height = h;

    // Very tall/short phones get a nudge so the boat never leaves the frame.
    const aspect = w / h;
    this.applyLayout(this.snapNext || changed);
    this.snapNext = false;

    if (this.orientation === 'portrait') {
      // Shorter portraits (iPad) need a wider lens to keep the fan of ropes in.
      const stubby = Math.max(0, 1.62 - h / w);
      this.camera.fov = LAYOUTS.portrait.fov + stubby * 9;
      this.basePos.multiplyScalar(1 + stubby * 0.06);
    } else {
      // Very wide phones already show plenty across; squat 4:3 tablets need a
      // step back and a tighter fan so nothing runs off the sides.
      const wide = Math.max(0, aspect - 1.9);
      this.camera.fov = LAYOUTS.landscape.fov - wide * 2.2;
      const squat = Math.max(0, 1.55 - aspect);
      this.basePos.z += squat * 2.2;
      this.basePos.y += squat * 0.5;
      this.spread = LAYOUTS.landscape.spread - squat * 0.5;
    }

    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
  }

  /** Smoothly track the authored composition plus any gameplay offsets. */
  update(dt: number): void {
    const tp = this.basePos.clone().add(this.camOffset);
    const tl = this.baseLook.clone().add(this.lookOffset);
    const k = 3.2;
    this.curPos.set(
      damp(this.curPos.x, tp.x, k, dt),
      damp(this.curPos.y, tp.y, k, dt),
      damp(this.curPos.z, tp.z, k, dt),
    );
    this.curLook.set(
      damp(this.curLook.x, tl.x, k, dt),
      damp(this.curLook.y, tl.y, k, dt),
      damp(this.curLook.z, tl.z, k, dt),
    );
    this.camera.position.copy(this.curPos);
    this.camera.lookAt(this.curLook);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Drop resolution if a device is struggling; never raise it back up abruptly. */
  monitorPerf(dt: number): void {
    if (dt <= 0) return;
    this.perfSamples.push(dt);
    if (this.perfSamples.length < 90) return;
    const avg = this.perfSamples.reduce((a, b) => a + b, 0) / this.perfSamples.length;
    this.perfSamples.length = 0;
    if (avg > 1 / 40 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.35);
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(this.width, this.height, false);
    }
  }

  /** Framing override used while art-directing; never called in play. */
  debugCamera(
    px: number,
    py: number,
    pz: number,
    lx: number,
    ly: number,
    lz: number,
    fov: number,
  ): void {
    this.basePos.set(px, py, pz);
    this.baseLook.set(lx, ly, lz);
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.curPos.copy(this.basePos);
    this.curLook.copy(this.baseLook);
  }

  /** Project a world point to CSS pixels for the 2D hint overlay. */
  project(p: Vector3, out: { x: number; y: number }): boolean {
    const v = p.clone().project(this.camera);
    out.x = (v.x * 0.5 + 0.5) * this.width;
    out.y = (-v.y * 0.5 + 0.5) * this.height;
    return v.z < 1;
  }
}
