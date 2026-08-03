import { SFX } from "./audio";
import {
  Crack, detectability, fluxAngleForYoke, generateCracks, meanAccum, meanReveal
} from "./cracks";
import {
  C, DirtBlob, drawBackground, drawCloth, drawCurtain, drawCurtainTab,
  drawDemagRing, drawDirt, drawFieldLines, drawGear, drawMagnetButton,
  drawMeter, drawNozzle, drawRobot, drawTable, drawUvLamp, drawYoke,
  RobotMood, rr
} from "./draw";
import { mulberry32 } from "./rng";
import {
  advance, chooseFromComplete, CompleteChoice, passOf, Phase
} from "./statemachine";

interface Vec2 { x: number; y: number; }

interface FlowParticle {
  x: number; y: number; vx: number; vy: number;
  age: number; ttl: number;
}

interface DriftParticle {
  x: number; y: number; vx: number; vy: number; age: number; ttl: number;
}

interface Photo { cnv: HTMLCanvasElement; pass: 1 | 2; }

interface Layout {
  w: number; h: number; portrait: boolean;
  partC: Vec2; partR: number; tableY: number;
  robot: { x: number; y: number; s: number };
  yokeHome: Vec2;
  magnetBtn: { x: number; y: number; r: number };
  meter: { x: number; y: number; w: number };
  demag: { ringX: number; ringY: number; ringR: number; startX: number; endX: number; scale: number };
}

const STYLES = [
  { teeth: 12, hue: 215 },
  { teeth: 10, hue: 32 },
  { teeth: 14, hue: 272 }
];

const FONT = "'Hiragino Maru Gothic ProN','Rounded Mplus 1c','Arial Rounded MT Bold',sans-serif";

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function easeOut(t: number): number { return 1 - (1 - t) * (1 - t) * (1 - t); }
function smooth(t: number): number { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); }
function hash1(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export class Game {
  private ctx: CanvasRenderingContext2D;
  private sfx = new SFX();
  private w = 0; private h = 0; private dpr = 1;
  private L!: Layout;
  private time = 0;

  phase: Phase = "title";
  private phaseT = 0;
  private pendingAdvance = -1;

  private playCount = 0;
  private styleIdx = 0;
  private seedBase: number;
  private cracks: Crack[] = [];
  private dirt: DirtBlob[] = [];

  // part transform (screen)
  private partPos: Vec2 = { x: 0, y: 0 };
  private partScale = 1;
  private arriveFrom: Vec2 = { x: 0, y: 0 };

  // pointer
  private ptrId: number | null = null;
  private ptrDown = false;
  private ptr: Vec2 = { x: 0, y: 0 };
  private ptrPrev: Vec2 = { x: 0, y: 0 };
  private ptrDownAt: Vec2 = { x: 0, y: 0 };
  private ptrDownT = 0;
  private ptrMoved = false;
  private ptrSpeed = 0;

  // smoothed tool position
  private tool: Vec2 = { x: 0, y: 0 };
  private toolSet = false;

  // yoke
  private yokePos: Vec2 = { x: 0, y: 0 };
  private yokePlaced = false;
  private yokeGrabbed = false;
  private yokeAngle = 0;           // displayed, degrees
  private yokeSnapT = -1;
  private rotAccum = 0;
  private rotDir = 1;
  private energized = false;
  private fieldFx = 0;
  private yokeOff = 0;             // slides away during demag

  // curtain / darkness
  private curtainMode: "open" | "drag" | "settle" | "hold" | "fade" | "dark" | "opening" = "open";
  private cover = 0.055;
  private fabricAlpha = 1;
  private dark = 0;
  private curtainTimer = 0;

  // bath
  private particles: FlowParticle[] = [];
  private drifts: DriftParticle[] = [];
  private wet = 0;
  private pouring = false;
  private fluidDone = false;

  // uv
  private lampActive = false;
  private foundFx = -1;
  private foundAt: Vec2 = { x: 0, y: 0 };

  // record
  private photoAnim = -1;
  private photoFrom: Vec2 = { x: 0, y: 0 };
  private photos: Photo[] = [];

  // demag
  private residual = 1;
  private demagIntro = 0;
  private ringIn = 0;

  // hints
  private idleT = 0;
  private hintPing = 0;
  private cleanShine = -1;

  constructor(private canvas: HTMLCanvasElement) {
    const c = canvas.getContext("2d");
    if (!c) throw new Error("no 2d context");
    this.ctx = c;
    const q = new URLSearchParams(location.search);
    this.seedBase = q.has("seed") ? Number(q.get("seed")) : ((Math.random() * 1e9) | 0);
    this.resize();
    this.newInspection(true);
    window.addEventListener("resize", () => this.resize());
    window.visualViewport?.addEventListener("resize", () => this.resize());
    canvas.addEventListener("pointerdown", (e) => this.onDown(e));
    canvas.addEventListener("pointermove", (e) => this.onMove(e));
    canvas.addEventListener("pointerup", (e) => this.onUp(e));
    canvas.addEventListener("pointercancel", (e) => this.onUp(e));
    document.addEventListener("gesturestart", (e) => e.preventDefault());
  }

  // ---------------------------------------------------------------- layout

  private resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.L = this.layout();
    // keep the part glued to its layout slot (state survives rotation)
    if (this.phase !== "arrive" && this.phase !== "demag") {
      this.partPos = { ...this.L.partC };
    }
    if (this.phase === "demag") {
      this.partPos.y = this.L.demag.ringY;
      this.partPos.x = clamp(this.partPos.x, this.L.demag.endX, this.L.demag.startX);
    }
    if (this.yokePlaced) this.yokePos = { ...this.L.partC };
  }

  private layout(): Layout {
    const w = this.w, h = this.h;
    const portrait = h >= w;
    const m = Math.min(w, h);
    const partR = clamp(m * 0.3, 90, Math.min(220, h * 0.26));
    const partC = portrait
      ? { x: w * 0.5, y: h * 0.4 }
      : { x: w * 0.52, y: h * 0.44 };
    const tableY = partC.y + partR * 1.12;
    const robot = portrait
      ? { x: w * 0.13, y: h * 0.84, s: m * 0.15 }
      : { x: w * 0.1, y: h * 0.76, s: m * 0.17 };
    const yokeHome = portrait
      ? { x: w * 0.82, y: h * 0.82 }
      : { x: w * 0.88, y: h * 0.72 };
    const br = clamp(m * 0.09, 36, 56);
    const magnetBtn = portrait
      ? { x: w * 0.82, y: Math.min(h * 0.82, tableY + (h - tableY) * 0.5), r: br }
      : { x: w * 0.88, y: h * 0.68, r: br };
    const mw = clamp(w * 0.28, 110, 160);
    const meter = { x: w - mw / 2 - 12, y: h * 0.055 + 8, w: mw };
    const ringR = m * 0.24;
    const demag = {
      ringX: w * 0.3, ringY: portrait ? h * 0.42 : h * 0.44, ringR,
      startX: w * 0.78, endX: w * 0.12, scale: 0.6
    };
    return { w, h, portrait, partC, partR, tableY, robot, yokeHome, magnetBtn, meter, demag };
  }

  // ------------------------------------------------------------ inspection

  private newInspection(freshStyle: boolean): void {
    if (freshStyle) this.styleIdx = this.styleIdx % STYLES.length;
    this.cracks = generateCracks(this.seedBase + this.playCount * 131 + this.styleIdx * 17);
    const rnd = mulberry32(this.seedBase + this.playCount * 977 + 5);
    this.dirt = [];
    for (let i = 0; i < 5; i++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * 0.5;
      this.dirt.push({
        x: Math.cos(a) * d, y: Math.sin(a) * d,
        r: 0.26 + rnd() * 0.2, a: 0.75 + rnd() * 0.25
      });
    }
    this.particles = [];
    this.drifts = [];
    this.wet = 0;
    this.fluidDone = false;
    this.yokePlaced = false;
    this.yokeGrabbed = false;
    this.yokeAngle = 0;
    this.rotAccum = 0;
    this.energized = false;
    this.fieldFx = 0;
    this.yokeOff = 0;
    this.curtainMode = "open";
    this.cover = 0.055;
    this.fabricAlpha = 1;
    this.dark = 0;
    this.lampActive = false;
    this.foundFx = -1;
    this.photoAnim = -1;
    this.photos = [];
    this.residual = 1;
    this.demagIntro = 0;
    this.ringIn = 0;
    this.partScale = 1;
    this.yokePos = { ...this.L.yokeHome };
    this.partPos = { ...this.L.partC };
    this.sfx.stopLoops();
    this.sfx.setDark(0);
  }

  private go(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
    this.idleT = 0;
    this.pendingAdvance = -1;
    this.toolSet = false;
    switch (p) {
      case "arrive": {
        this.arriveFrom = { x: this.L.w + this.L.partR * 1.4, y: this.L.partC.y };
        this.partPos = { ...this.arriveFrom };
        break;
      }
      case "yoke":
        this.yokePos = { ...this.L.yokeHome };
        break;
      case "fluid": case "fluid2":
        this.fluidDone = false;
        break;
      case "curtain": case "curtain2":
        this.curtainMode = "open";
        this.cover = 0.055;
        this.fabricAlpha = 1;
        break;
      case "uv": case "uv2": case "free":
        this.lampActive = false;
        this.foundFx = -1;
        if (p === "free") {
          // bring the part back onto the bench for free UV play
          this.partPos = { ...this.L.partC };
          this.partScale = 1;
          this.ringIn = 0;
          if (this.curtainMode !== "dark") {
            this.curtainMode = "dark";
            this.fabricAlpha = 0;
            this.cover = 1;
          }
        }
        break;
      case "rotate":
        this.rotAccum = 0;
        this.openCurtain();
        this.energized = false;
        this.sfx.humStop();
        break;
      case "demag":
        this.openCurtain();
        this.energized = false;
        this.sfx.humStop();
        this.demagIntro = 0;
        this.residual = 1;
        this.sfx.demagStart();
        break;
      case "complete":
        this.sfx.stopLoops();
        this.openCurtain();
        this.sfx.jingle();
        break;
      default:
        break;
    }
  }

  private openCurtain(): void {
    if (this.curtainMode !== "open") {
      this.curtainMode = "opening";
      this.curtainTimer = 0;
    }
  }

  private scheduleAdvance(delay: number): void {
    if (this.pendingAdvance < 0) this.pendingAdvance = delay;
  }

  // ---------------------------------------------------------------- input

  private toLocal(e: PointerEvent): Vec2 {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown(e: PointerEvent): void {
    e.preventDefault();
    if (this.ptrId !== null) return;
    this.ptrId = e.pointerId;
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ok */ }
    this.sfx.unlock();
    const p = this.toLocal(e);
    this.ptrDown = true;
    this.ptr = p;
    this.ptrPrev = { ...p };
    this.ptrDownAt = { ...p };
    this.ptrDownT = this.time;
    this.ptrMoved = false;
    this.idleT = 0;
    this.downPhase(p);
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId !== this.ptrId || !this.ptrDown) return;
    e.preventDefault();
    const p = this.toLocal(e);
    const dx = p.x - this.ptr.x, dy = p.y - this.ptr.y;
    if (Math.hypot(p.x - this.ptrDownAt.x, p.y - this.ptrDownAt.y) > 14) this.ptrMoved = true;
    this.ptrPrev = { ...this.ptr };
    this.ptr = p;
    this.ptrSpeed = Math.hypot(dx, dy);
    this.idleT = 0;
    this.movePhase(p, dx, dy);
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId !== this.ptrId) return;
    this.ptrId = null;
    this.ptrDown = false;
    const p = this.toLocal(e);
    const isTap = !this.ptrMoved && this.time - this.ptrDownT < 0.45;
    this.idleT = 0;
    this.upPhase(p, isTap);
  }

  private downPhase(p: Vec2): void {
    switch (this.phase) {
      case "yoke":
        this.yokeGrabbed = true;
        this.yokePos = { x: p.x, y: p.y - 46 };
        break;
      case "fluid": case "fluid2":
        if (!this.fluidDone) {
          this.pouring = true;
          this.sfx.pourStart();
        }
        break;
      case "curtain": case "curtain2":
        if (this.curtainMode === "open" || this.curtainMode === "drag") {
          this.curtainMode = "drag";
        }
        break;
      case "uv": case "uv2": case "free":
        if (this.curtainMode === "dark") {
          this.lampActive = true;
          this.sfx.uvStart();
        }
        break;
      default:
        break;
    }
  }

  private movePhase(p: Vec2, dx: number, dy: number): void {
    switch (this.phase) {
      case "clean":
        if (this.ptrSpeed > 1.2) this.wipeAt(p);
        break;
      case "yoke":
        if (this.yokeGrabbed) {
          this.yokePos = { x: p.x, y: p.y - 46 };
          const d = Math.hypot(p.x - this.L.partC.x, (p.y - 46) - this.L.partC.y);
          if (d < this.L.partR * 0.6) this.placeYoke();
        }
        break;
      case "curtain": case "curtain2":
        if (this.curtainMode === "drag") {
          const c = clamp(p.y / (this.h * 0.72), 0.055, 1);
          if (c > this.cover) this.cover = c;
          else this.cover = lerp(this.cover, c, 0.4);
          if (this.cover >= 0.995) this.settleCurtain();
        }
        break;
      case "rotate": {
        const cx = this.L.partC.x, cy = this.L.partC.y;
        const a1 = Math.atan2(this.ptrPrev.y - cy, this.ptrPrev.x - cx);
        const a2 = Math.atan2(p.y - cy, p.x - cx);
        let da = a2 - a1;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        da = clamp(da, -0.25, 0.25);
        // straight swipes far from center barely arc — amplify by radius falloff
        const dist = Math.hypot(p.x - cx, p.y - cy);
        const gain = clamp(this.L.partR * 1.4 / Math.max(40, dist), 0.6, 2.2);
        this.rotAccum += da * gain;
        if (Math.abs(this.rotAccum) > 0.08) this.rotDir = Math.sign(this.rotAccum) || 1;
        if (this.yokeSnapT < 0) {
          const prog = clamp(Math.abs(this.rotAccum) / 1.05, 0, 1);
          this.yokeAngle = this.rotDir * prog * 90;
          if (prog >= 1) {
            this.yokeSnapT = 0;
            this.sfx.clack();
          }
        }
        break;
      }
      case "demag":
        if (this.demagIntro >= 1) {
          this.partPos.x = clamp(
            lerp(this.partPos.x, p.x, 0.35),
            this.L.demag.endX, this.L.demag.startX
          );
        }
        break;
      default:
        void dx; void dy;
        break;
    }
  }

  private upPhase(p: Vec2, isTap: boolean): void {
    switch (this.phase) {
      case "title":
        if (isTap) this.startGame();
        break;
      case "yoke":
        this.yokeGrabbed = false;
        break;
      case "magnetize": case "magnetize2": {
        const b = this.L.magnetBtn;
        if (isTap && Math.hypot(p.x - b.x, p.y - b.y) < b.r * 2) this.pressMagnet();
        break;
      }
      case "fluid": case "fluid2":
        this.pouring = false;
        this.sfx.pourStop();
        break;
      case "curtain": case "curtain2":
        if (this.curtainMode === "drag") {
          if (this.cover > 0.5) this.settleCurtain();
          else this.curtainMode = "open";
        }
        break;
      case "uv": case "uv2": case "free":
        this.lampActive = false;
        this.sfx.uvStop();
        break;
      case "record": case "record2": {
        if (isTap && this.photoAnim < 0) {
          const target = this.targetCrack();
          if (target) {
            const c = this.crackCentroidScreen(target);
            if (Math.hypot(p.x - c.x, p.y - c.y) < Math.max(150, this.L.partR * 0.8)) {
              this.takePhoto(target, c);
            } else {
              this.sfx.pin();
              this.idleT = 5; // nudge the hint immediately
            }
          }
        }
        break;
      }
      case "complete":
        if (isTap) this.completeTap(p);
        break;
      default:
        break;
    }
    if (this.phase === "free" && isTap) {
      const b = this.freeHomeBtn();
      if (Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.6) {
        this.sfx.clack();
        this.dark = 0.0;
        this.curtainMode = "open";
        this.cover = 0.055; this.fabricAlpha = 1;
        this.go("complete");
      }
    }
  }

  private startGame(): void {
    this.playCount = 0;
    this.newInspection(true);
    this.sfx.ding();
    this.go("arrive");
  }

  private placeYoke(): void {
    this.yokeGrabbed = false;
    this.yokePlaced = true;
    this.yokePos = { ...this.L.partC };
    this.sfx.clack();
    this.scheduleAdvance(0.45);
  }

  private pressMagnet(): void {
    this.energized = true;
    this.fieldFx = 1.8;
    this.sfx.humStart();
    this.sfx.clack();
    this.scheduleAdvance(1.3);
  }

  private settleCurtain(): void {
    if (this.curtainMode === "settle" || this.curtainMode === "hold") return;
    this.curtainMode = "settle";
    this.curtainTimer = 0;
    this.sfx.whoosh();
  }

  private takePhoto(target: Crack, at: Vec2): void {
    this.sfx.camera();
    target.recorded = true;
    this.photoAnim = 0;
    this.photoFrom = at;
    this.photos.push({ cnv: this.renderPhoto(target), pass: target.pass });
    this.scheduleAdvance(1.3);
  }

  private completeTap(p: Vec2): void {
    const btns = this.completeButtons();
    for (const b of btns) {
      if (Math.abs(p.x - b.x) < b.s * 0.75 && Math.abs(p.y - b.y) < b.s * 0.75) {
        this.sfx.ding();
        if (b.id === "free") {
          this.go("free");
          return;
        }
        this.playCount++;
        if (b.id === "newPart") this.styleIdx = (this.styleIdx + 1) % STYLES.length;
        this.newInspection(true);
        this.go(chooseFromComplete(b.id as CompleteChoice));
        return;
      }
    }
  }

  // -------------------------------------------------------------- helpers

  private targetCrack(): Crack | null {
    const pass = passOf(this.phase);
    if (pass === 0) return null;
    return this.cracks.find((c) => c.pass === pass) ?? null;
  }

  private partXform(): { x: number; y: number; s: number } {
    return { x: this.partPos.x, y: this.partPos.y, s: this.partScale * this.L.partR };
  }

  private crackPtScreen(c: Crack, pi: number, i: number): Vec2 {
    const t = this.partXform();
    return { x: t.x + c.polys[pi][i].x * t.s, y: t.y + c.polys[pi][i].y * t.s };
  }

  private crackCentroidScreen(c: Crack): Vec2 {
    let sx = 0, sy = 0, n = 0;
    for (let pi = 0; pi < c.polys.length; pi++) {
      for (let i = 0; i < c.polys[pi].length; i++) {
        const p = this.crackPtScreen(c, pi, i);
        sx += p.x; sy += p.y; n++;
      }
    }
    return { x: sx / n, y: sy / n };
  }

  private lampLight(): { c: Vec2; r: number } {
    const off = this.lampOffset();
    return {
      c: { x: this.tool.x + off.x, y: this.tool.y + off.y },
      r: this.L.partR * 0.85
    };
  }

  lampOffset(): Vec2 {
    return { x: 0, y: -Math.max(72, this.L.partR * 0.5) };
  }

  private freeHomeBtn(): { x: number; y: number; r: number } {
    return { x: 46, y: 46, r: 34 };
  }

  private wipeAt(p: Vec2): void {
    const t = this.partXform();
    const lx = (p.x - t.x) / t.s;
    const ly = (p.y - 34 - t.y) / t.s;
    let any = false;
    for (const b of this.dirt) {
      const d = Math.hypot(lx - b.x, ly - b.y);
      if (d < b.r + 0.22 && b.a > 0) {
        b.a = Math.max(0, b.a - 0.05 - this.ptrSpeed * 0.0016);
        any = true;
      }
    }
    if (any || Math.hypot(lx, ly) < 1) this.sfx.wipe();
    const left = this.dirt.reduce((s, b) => s + b.a, 0);
    if (left < 0.3 && this.pendingAdvance < 0) {
      this.dirt.forEach((b) => { b.a = Math.min(b.a, 0.12); });
      this.cleanShine = 0;
      this.sfx.ding();
      this.scheduleAdvance(0.9);
    }
  }

  // -------------------------------------------------------------- update

  update(dt: number): void {
    this.time += dt;
    this.phaseT += dt;
    this.idleT += dt;

    // smoothed tool follow
    if (this.ptrDown) {
      if (!this.toolSet) { this.tool = { ...this.ptr }; this.toolSet = true; }
      this.tool.x = lerp(this.tool.x, this.ptr.x, 1 - Math.pow(0.0005, dt));
      this.tool.y = lerp(this.tool.y, this.ptr.y, 1 - Math.pow(0.0005, dt));
    }

    if (this.pendingAdvance >= 0) {
      this.pendingAdvance -= dt;
      if (this.pendingAdvance < 0) {
        this.pendingAdvance = -1;
        this.go(advance(this.phase));
      }
    }

    this.updateCurtain(dt);
    this.updateParticles(dt);
    if (this.fieldFx > 0) this.fieldFx -= dt;
    if (this.foundFx >= 0) this.foundFx += dt;
    if (this.photoAnim >= 0) {
      this.photoAnim += dt;
      if (this.photoAnim > 1.2) this.photoAnim = -1;
    }
    if (this.cleanShine >= 0) this.cleanShine += dt;
    if (this.hintPing > 0) this.hintPing -= dt;
    this.wet = Math.max(0, this.wet - dt * 0.08);

    switch (this.phase) {
      case "arrive": {
        const t = smooth(this.phaseT / 1.5);
        this.partPos.x = lerp(this.arriveFrom.x, this.L.partC.x, easeOut(t));
        this.partPos.y = this.L.partC.y;
        if (this.phaseT >= 1.5 && this.pendingAdvance < 0) {
          this.sfx.clack();
          this.scheduleAdvance(0.5);
        }
        break;
      }
      case "fluid": case "fluid2": {
        if (this.pouring && !this.fluidDone) {
          this.wet = Math.min(1, this.wet + dt * 0.7);
          this.spawnBath(dt);
          this.accumulate(dt);
        }
        const target = this.targetCrack();
        if (target && !this.fluidDone && meanAccum(target) > 0.5) {
          this.fluidDone = true;
          this.pouring = false;
          this.sfx.pourStop();
          this.sfx.ding();
          this.scheduleAdvance(1.0);
        }
        break;
      }
      case "uv": case "uv2": case "free": {
        if (this.lampActive && this.curtainMode === "dark") {
          this.exposeUv(dt);
          this.sfx.uvLevel(this.ptrDown ? clamp(this.ptrSpeed / 14, 0.1, 1) : 0);
          this.ptrSpeed *= 0.9;
        }
        if (this.phase !== "free") {
          const target = this.targetCrack();
          if (target && this.foundFx < 0 && meanReveal(target) > 0.78) {
            this.foundFx = 0;
            this.foundAt = this.crackCentroidScreen(target);
            this.lampActive = false;
            this.sfx.uvStop();
            this.sfx.ding();
            this.scheduleAdvance(1.4);
          }
        }
        break;
      }
      case "rotate": {
        if (this.yokeSnapT >= 0) {
          this.yokeSnapT += dt;
          this.yokeAngle = lerp(this.yokeAngle, this.rotDir * 90, 1 - Math.pow(0.001, dt));
          if (this.yokeSnapT > 0.5 && this.pendingAdvance < 0) {
            this.yokeAngle = this.rotDir * 90;
            this.yokeSnapT = -1;
            this.scheduleAdvance(0.3);
          }
        }
        break;
      }
      case "demag": {
        if (this.demagIntro < 1) {
          this.demagIntro = Math.min(1, this.demagIntro + dt / 0.9);
          const t = smooth(this.demagIntro);
          this.partPos.x = lerp(this.L.partC.x, this.L.demag.startX, t);
          this.partPos.y = lerp(this.L.partC.y, this.L.demag.ringY, t);
          this.partScale = lerp(1, this.L.demag.scale, t);
          this.yokeOff = t;
        } else {
          const prog = clamp(
            (this.L.demag.startX - this.partPos.x) / (this.L.demag.startX - this.L.demag.endX),
            0, 1
          );
          this.residual = Math.min(this.residual, 1 - prog);
          this.sfx.demagLevel(this.residual);
          if (this.residual > 0.05 && Math.random() < dt * 14 * (1 - this.residual)) {
            this.spawnDrift();
          }
          if (this.residual <= 0.05 && this.pendingAdvance < 0) {
            this.residual = 0;
            this.sfx.demagStop();
            this.sfx.ding();
            this.scheduleAdvance(1.0);
          }
        }
        this.ringIn = Math.min(1, this.ringIn + dt / 0.7);
        break;
      }
      default:
        break;
    }

    // non-verbal idle hint ping
    if (this.idleT > 4 && this.hintPing <= 0 && this.interactivePhase()) {
      this.hintPing = 4;
      this.sfx.pin();
    }

    this.sfx.setDark(this.dark);
  }

  private interactivePhase(): boolean {
    return !["title", "arrive", "complete"].includes(this.phase) && this.pendingAdvance < 0;
  }

  private updateCurtain(dt: number): void {
    switch (this.curtainMode) {
      case "drag":
        this.dark = clamp((this.cover - 0.2) * 0.5, 0, 0.4);
        break;
      case "settle":
        this.cover = lerp(this.cover, 1, 1 - Math.pow(0.0001, dt));
        this.dark = clamp((this.cover - 0.2) * 0.5, 0, 0.4);
        if (this.cover > 0.985) {
          this.cover = 1;
          this.curtainMode = "hold";
          this.curtainTimer = 0;
        }
        break;
      case "hold":
        this.curtainTimer += dt;
        if (this.curtainTimer > 0.55) {
          this.curtainMode = "fade";
          this.curtainTimer = 0;
        }
        break;
      case "fade": {
        this.curtainTimer += dt;
        const t = clamp(this.curtainTimer / 0.9, 0, 1);
        this.fabricAlpha = 1 - t;
        this.dark = lerp(0.4, 1, t);
        if (t >= 1) {
          this.curtainMode = "dark";
          if (this.phase === "curtain" || this.phase === "curtain2") {
            this.go(advance(this.phase));
          }
        }
        break;
      }
      case "dark":
        this.dark = lerp(this.dark, 1, 1 - Math.pow(0.01, dt));
        break;
      case "opening": {
        this.curtainTimer += dt;
        const t = clamp(this.curtainTimer / 0.7, 0, 1);
        this.dark = 1 - t;
        this.cover = lerp(1, 0.055, t);
        this.fabricAlpha = t < 0.4 ? t / 0.4 : 1;
        if (t >= 1) this.curtainMode = "open";
        break;
      }
      case "open":
        this.dark = Math.max(0, this.dark - dt * 2);
        break;
    }
  }

  private spawnBath(dt: number): void {
    const t = this.partXform();
    const lx = (this.tool.x - t.x) / t.s;
    const ly = (this.tool.y - t.y) / t.s;
    const onFace = Math.hypot(lx, ly) < 0.95;
    const n = Math.round(90 * dt);
    for (let k = 0; k < n; k++) {
      if (this.particles.length > 260) break;
      this.particles.push({
        x: lx + (Math.random() - 0.5) * 0.14,
        y: ly + (Math.random() - 0.5) * 0.08,
        vx: (Math.random() - 0.5) * 0.5,
        vy: 0.2 + Math.random() * 0.4,
        age: 0,
        ttl: onFace ? 1.2 + Math.random() * 0.9 : 0.5
      });
    }
  }

  private accumulate(dt: number): void {
    const flux = fluxAngleForYoke(this.yokeAngle);
    const t = this.partXform();
    const lx = (this.tool.x - t.x) / t.s;
    const ly = (this.tool.y - t.y) / t.s;
    if (Math.hypot(lx, ly) > 1.1 || !this.energized) return;
    // the bath sheets over the whole face; leakage fields comb particles
    // into rows wherever a crack fights the current flux direction.
    // Weak leakage (crack nearly parallel to the flux) cannot hold
    // particles against the flowing bath — soft threshold on top of sin^2.
    for (const c of this.cracks) {
      for (let pi = 0; pi < c.polys.length; pi++) {
        const pts = c.polys[pi];
        for (let i = 0; i < pts.length; i++) {
          const eff = smooth((detectability(c.tang[pi][i], flux) - 0.12) / 0.5);
          if (eff < 0.01) continue;
          const near = clamp(1.6 - Math.hypot(pts[i].x - lx, pts[i].y - ly), 0.25, 1.4);
          c.accum[pi][i] = Math.min(1, c.accum[pi][i] + dt * eff * 0.9 * near);
        }
      }
    }
  }

  private updateParticles(dt: number): void {
    const flux = fluxAngleForYoke(this.yokeAngle);
    const magnet = this.energized;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      p.vy += 1.6 * dt;
      p.vx *= Math.pow(0.2, dt);
      // gentle pull toward leaking crack points
      if (magnet) {
        for (const c of this.cracks) {
          for (let pi = 0; pi < c.polys.length; pi++) {
            const pts = c.polys[pi];
            for (let j = 0; j < pts.length; j += 3) {
              const dx = pts[j].x - p.x, dy = pts[j].y - p.y;
              const dd = dx * dx + dy * dy;
              if (dd < 0.06) {
                const eff = smooth((detectability(c.tang[pi][j], flux) - 0.12) / 0.5);
                if (eff > 0.03) {
                  const k = (eff * 2.4 * dt) / Math.max(0.015, dd);
                  p.vx += dx * k * 0.05;
                  p.vy += dy * k * 0.05;
                  if (dd < 0.004 && Math.random() < eff * 0.5) {
                    c.accum[pi][j] = Math.min(1, c.accum[pi][j] + 0.08 * eff);
                    this.sfx.shimmer();
                    p.age = p.ttl;
                  }
                }
              }
            }
          }
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.age >= p.ttl || p.y > 1.6) this.particles.splice(i, 1);
    }
    for (let i = this.drifts.length - 1; i >= 0; i--) {
      const p = this.drifts[i];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.age >= p.ttl) this.drifts.splice(i, 1);
    }
  }

  private spawnDrift(): void {
    const c = this.cracks[Math.floor(Math.random() * this.cracks.length)];
    const pi = Math.floor(Math.random() * c.polys.length);
    const i = Math.floor(Math.random() * c.polys[pi].length);
    if (c.accum[pi][i] < 0.1) return;
    const a = Math.random() * Math.PI * 2;
    this.drifts.push({
      x: c.polys[pi][i].x, y: c.polys[pi][i].y,
      vx: Math.cos(a) * 0.25, vy: Math.sin(a) * 0.25 - 0.1,
      age: 0, ttl: 0.9
    });
  }

  private exposeUv(dt: number): void {
    const { c: lc, r: lr } = this.lampLight();
    for (const c of this.cracks) {
      for (let pi = 0; pi < c.polys.length; pi++) {
        for (let i = 0; i < c.polys[pi].length; i++) {
          if (c.accum[pi][i] < 0.03) continue;
          const p = this.crackPtScreen(c, pi, i);
          const d = Math.hypot(p.x - lc.x, p.y - lc.y);
          if (d < lr) {
            const fall = 1 - (d / lr) * 0.6;
            c.reveal[pi][i] = Math.min(1, c.reveal[pi][i] + dt * 0.85 * fall);
          }
        }
      }
    }
  }

  // -------------------------------------------------------------- render

  render(): void {
    const ctx = this.ctx;
    const { w, h } = this;
    ctx.clearRect(0, 0, w, h);
    drawBackground(ctx, w, h);

    if (this.phase === "title") {
      this.renderTitle();
      return;
    }

    drawTable(ctx, w, this.L.tableY, h);

    // demag ring behind the part
    if (this.phase === "demag" || (this.phase === "complete" && this.ringIn > 0)) {
      const d = this.L.demag;
      const x = lerp(-d.ringR, d.ringX, smooth(this.ringIn));
      drawDemagRing(ctx, x, d.ringY, d.ringR, this.residual);
    }

    // ---- the part and everything glued to its face
    const t = this.partXform();
    const style = STYLES[this.styleIdx];
    drawGear(ctx, t.x, t.y, t.s, style.teeth, style.hue);
    if (this.phase === "clean" || this.phase === "arrive") {
      drawDirt(ctx, t.x, t.y, t.s, this.dirt);
    }
    if (this.cleanShine >= 0 && this.cleanShine < 1) {
      const sh = this.cleanShine;
      ctx.save();
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.s * 0.76, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = 0.35 * (1 - sh);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      const sx = t.x - t.s + sh * t.s * 2.4;
      ctx.moveTo(sx - 30, t.y - t.s);
      ctx.lineTo(sx + 20, t.y - t.s);
      ctx.lineTo(sx - 40, t.y + t.s);
      ctx.lineTo(sx - 90, t.y + t.s);
      ctx.fill();
      ctx.restore();
    }
    this.renderWetFilm();
    this.renderBathParticles();

    // yoke
    this.renderYoke();

    // demag drifting particles
    if (this.drifts.length) {
      ctx.save();
      ctx.fillStyle = "rgba(190,225,120,0.5)";
      for (const p of this.drifts) {
        const a = 1 - p.age / p.ttl;
        ctx.globalAlpha = a * 0.5;
        ctx.beginPath();
        ctx.arc(t.x + p.x * t.s, t.y + p.y * t.s, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // robot
    this.renderRobot();

    // held tools drawn above the part
    if (this.phase === "clean" && this.ptrDown) {
      drawCloth(ctx, this.tool.x, this.tool.y - 34, this.L.partR * 0.32, this.time);
    }
    if ((this.phase === "fluid" || this.phase === "fluid2") && this.ptrDown && !this.fluidDone) {
      this.renderStream();
      drawNozzle(ctx, this.tool.x + 10, this.tool.y - 40, this.L.partR * 0.3, this.pouring, w, h);
    }

    // ---- darkness + UV glow
    this.renderDarkness();
    this.renderIndications();
    if (this.foundFx >= 0 && this.foundFx < 1.2) this.renderFoundPulse();
    if ((this.phase === "record" || this.phase === "record2") && this.photoAnim < 0) {
      const target = this.targetCrack();
      if (target) {
        const cc = this.crackCentroidScreen(target);
        const p = (this.time % 1.6) / 1.6;
        const ctx2 = this.ctx;
        ctx2.save();
        ctx2.globalCompositeOperation = "lighter";
        ctx2.strokeStyle = `rgba(255,245,200,${0.4 * (1 - p)})`;
        ctx2.lineWidth = 4;
        ctx2.beginPath();
        ctx2.arc(cc.x, cc.y, this.L.partR * (0.45 + p * 0.3), 0, Math.PI * 2);
        ctx2.stroke();
        ctx2.restore();
      }
    }
    if ((this.phase === "uv" || this.phase === "uv2" || this.phase === "free") &&
        this.lampActive) {
      const { c: lc } = this.lampLight();
      drawUvLamp(ctx, lc.x + this.L.partR * 0.34, lc.y - this.L.partR * 0.4, this.L.partR * 0.26, true);
    }

    // meter during demag
    if (this.phase === "demag") {
      drawMeter(ctx, this.L.meter.x, this.L.meter.y, this.L.meter.w, this.residual);
      if (this.demagIntro >= 1 && this.residual > 0.1) {
        // big soft arrow: pull the part left through the ring
        const y = this.L.demag.ringY - this.L.demag.ringR * 1.25;
        this.drawSoftArrow(this.partPos.x - 20, y, this.L.demag.ringX, y);
      }
    }

    // magnet button
    if (this.phase === "magnetize" || this.phase === "magnetize2") {
      const b = this.L.magnetBtn;
      const pulse = Math.sin(this.time * 3.4) * 0.5 + 0.5;
      drawMagnetButton(ctx, b.x, b.y, b.r, pulse * 0.7, this.energized ? 1 : 0);
    }

    // rotation affordance
    if (this.phase === "rotate" && this.yokeSnapT < 0 && Math.abs(this.rotAccum) < 1.0) {
      this.renderRotateArrow();
    }

    // curtain
    drawCurtain(ctx, w, h, this.cover, this.fabricAlpha, this.time);
    if ((this.phase === "curtain" || this.phase === "curtain2") &&
        (this.curtainMode === "open" || this.curtainMode === "drag")) {
      const pulse = Math.sin(this.time * 3.2) * 0.5 + 0.5;
      drawCurtainTab(ctx, w / 2, this.cover * h, clamp(this.L.partR * 0.3, 26, 42), pulse);
    }

    // album chip
    if (this.photos.length > 0 && this.phase !== "complete" && this.phase !== "free") {
      this.renderAlbumChip();
    }
    if (this.photoAnim >= 0 && this.photoAnim < 1.1) this.renderPhotoAnim();

    if (this.phase === "free") this.renderFreeHome();
    if (this.phase === "complete") this.renderComplete();

    this.renderIdleHint();
  }

  // ---- part-glued visuals

  private renderWetFilm(): void {
    if (this.wet <= 0.02) return;
    const ctx = this.ctx;
    const t = this.partXform();
    ctx.save();
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.s * 0.76, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = this.wet * 0.16;
    const g = ctx.createLinearGradient(t.x, t.y - t.s, t.x, t.y + t.s);
    g.addColorStop(0, "#b7e88a");
    g.addColorStop(1, "#7fc46a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.s * 0.76, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = this.wet * 0.1;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(t.x - t.s * 0.2, t.y - t.s * 0.25, t.s * 0.3, t.s * 0.14, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderBathParticles(): void {
    if (!this.particles.length) return;
    const ctx = this.ctx;
    const t = this.partXform();
    ctx.save();
    for (const p of this.particles) {
      const a = clamp(1 - p.age / p.ttl, 0, 1);
      ctx.globalAlpha = a * 0.55;
      ctx.fillStyle = "rgba(196,235,120,1)";
      ctx.beginPath();
      ctx.arc(t.x + p.x * t.s, t.y + p.y * t.s, 1.6 + a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderStream(): void {
    const ctx = this.ctx;
    const nx = this.tool.x + 10, ny = this.tool.y - 40;
    const sx = this.tool.x, sy = this.tool.y + 14;
    ctx.save();
    ctx.strokeStyle = "rgba(190,230,140,0.5)";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(nx - 18, ny - 8);
    ctx.quadraticCurveTo(sx - 6, (ny + sy) / 2, sx, sy);
    ctx.stroke();
    ctx.strokeStyle = "rgba(235,255,190,0.5)";
    ctx.lineWidth = 3.5;
    ctx.stroke();
    // splash
    ctx.fillStyle = "rgba(200,240,150,0.35)";
    ctx.beginPath();
    ctx.ellipse(sx, sy, 16 + Math.sin(this.time * 14) * 3, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderYoke(): void {
    if (this.phase === "title" || this.phase === "complete") return;
    const show = this.yokePlaced || this.phase === "yoke";
    if (!show) return;
    const ctx = this.ctx;
    const span = this.L.partR * 1.7;
    const angle = (this.yokeAngle * Math.PI) / 180;
    if (this.yokePlaced) {
      if (this.yokeOff > 0) {
        // slides away while the part heads to the demag ring
        const x = lerp(this.L.partC.x, this.w + span, smooth(this.yokeOff));
        if (this.yokeOff < 1) drawYoke(ctx, x, this.L.partC.y, span, angle, 30, false);
        return;
      }
      drawYoke(ctx, this.L.partC.x, this.L.partC.y, span, angle, 0, this.energized);
      if (this.fieldFx > 0) {
        drawFieldLines(
          ctx, this.L.partC.x, this.L.partC.y, span, angle,
          clamp(this.fieldFx / 1.8, 0, 1) * 0.9, this.time
        );
      }
    } else {
      const lift = this.yokeGrabbed ? 26 : 8;
      drawYoke(ctx, this.yokePos.x, this.yokePos.y, span * 0.82, 0, lift, false);
    }
  }

  private renderRobot(): void {
    const r = this.L.robot;
    const target = this.hintTarget();
    let mood: RobotMood = "idle";
    if (this.phase === "complete" || this.foundFx >= 0 || this.cleanShine >= 0) mood = "happy";
    else if (this.idleT > 4) mood = "point";
    let lx = 0, ly = 0;
    if (target) {
      lx = clamp((target.x - r.x) / (this.w * 0.5), -1, 1);
      ly = clamp((target.y - r.y) / (this.h * 0.5), -1, 1);
    }
    drawRobot(this.ctx, r.x, r.y, r.s, lx, ly, mood, this.time);
  }

  // ---- darkness and glow

  private renderDarkness(): void {
    if (this.dark <= 0.01) return;
    const ctx = this.ctx;
    const hasLamp =
      (this.phase === "uv" || this.phase === "uv2" || this.phase === "free") && this.lampActive;
    ctx.save();
    if (hasLamp) {
      const { c: lc, r: lr } = this.lampLight();
      const g = ctx.createRadialGradient(lc.x, lc.y, lr * 0.1, lc.x, lc.y, lr * 1.7);
      g.addColorStop(0, `rgba(14,9,38,${this.dark * 0.1})`);
      g.addColorStop(0.5, `rgba(14,9,38,${this.dark * 0.52})`);
      g.addColorStop(1, `rgba(14,9,38,${this.dark * 0.82})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
      // violet pool
      ctx.globalCompositeOperation = "lighter";
      const v = ctx.createRadialGradient(lc.x, lc.y, 0, lc.x, lc.y, lr);
      v.addColorStop(0, `rgba(122,86,224,${0.22 * this.dark})`);
      v.addColorStop(1, "rgba(122,86,224,0)");
      ctx.fillStyle = v;
      ctx.beginPath();
      ctx.arc(lc.x, lc.y, lr, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = `rgba(14,9,38,${this.dark * 0.66})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    ctx.restore();
  }

  private renderIndications(): void {
    const ctx = this.ctx;
    const t = this.partXform();
    const hasLamp =
      (this.phase === "uv" || this.phase === "uv2" || this.phase === "free") && this.lampActive;
    const lamp = hasLamp ? this.lampLight() : null;
    const accumScale = this.phase === "demag" || this.phase === "complete"
      ? Math.pow(this.residual, 0.75)
      : 1;
    if (accumScale <= 0.01) return;
    const pxScale = t.s / 110;
    ctx.save();
    for (const c of this.cracks) {
      for (let pi = 0; pi < c.polys.length; pi++) {
        const pts = c.polys[pi];
        const n = pts.length;
        const I: number[] = new Array(n);
        const P: Vec2[] = new Array(n);
        for (let i = 0; i < n; i++) {
          const a = c.accum[pi][i] * accumScale;
          const th = 0.12 + hash1(pi * 57 + i) * 0.38;
          const rv = c.reveal[pi][i];
          const growth = rv <= th ? 0 : smooth((rv - th) / (1 - th));
          // reveal drives the line forming; accumulation gives it a body —
          // a whisper of powder can never form a full bright line
          I[i] = growth * smooth((a - 0.05) / 0.45);
          P[i] = { x: t.x + pts[i].x * t.s, y: t.y + pts[i].y * t.s };
        }
        // brightness per point — once revealed the indication keeps glowing
        // (a persistent local light, never a strobe)
        const B: number[] = new Array(n);
        for (let i = 0; i < n; i++) {
          let lit = 0.75;
          if (lamp) {
            const d = Math.hypot(P[i].x - lamp.c.x, P[i].y - lamp.c.y);
            lit = d < lamp.r ? 0.55 + 0.45 * (1 - d / lamp.r) : 0.45;
          }
          const inDark = this.dark * (0.05 + 0.95 * lit);
          const inLight = (1 - this.dark) * 0.11;
          B[i] = inDark + inLight;
        }
        // faint pre-reveal accumulation (visible up close in normal light,
        // whisper-quiet in the dark until UV touches it)
        for (let i = 0; i < n; i++) {
          const a = c.accum[pi][i] * accumScale;
          if (a < 0.05 || I[i] > 0.4) continue;
          const alpha = a * ((1 - this.dark) * 0.14 + this.dark * 0.03);
          if (alpha < 0.01) continue;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = "#9db86a";
          for (let k = 0; k < 2; k++) {
            const ox = (hash1(i * 13 + k * 71 + pi) - 0.5) * 6 * pxScale;
            const oy = (hash1(i * 29 + k * 37 + pi) - 0.5) * 6 * pxScale;
            ctx.beginPath();
            ctx.arc(P[i].x + ox, P[i].y + oy, 1.5 * pxScale * (0.7 + a), 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // glowing revealed indication
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < n - 1; i++) {
          const s = Math.min(I[i], I[i + 1]);
          if (s < 0.5) continue;
          const a = (s - 0.5) * 2 * B[i];
          if (a < 0.02) continue;
          ctx.strokeStyle = `rgba(158,255,70,${a * 0.28})`;
          ctx.lineWidth = 8 * pxScale;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(P[i].x, P[i].y);
          ctx.lineTo(P[i + 1].x, P[i + 1].y);
          ctx.stroke();
          ctx.strokeStyle = `rgba(214,255,140,${a * 0.85})`;
          ctx.lineWidth = 2.6 * pxScale;
          ctx.stroke();
          if (s > 0.85) {
            ctx.strokeStyle = `rgba(244,255,214,${a * 0.7})`;
            ctx.lineWidth = 1.2 * pxScale;
            ctx.stroke();
          }
        }
        for (let i = 0; i < n; i++) {
          if (I[i] < 0.03) continue;
          const tw = 1 + Math.sin(this.time * 2.1 + i * 1.3) * 0.08;
          const a = I[i] * B[i] * tw;
          if (a < 0.015) continue;
          ctx.fillStyle = `rgba(200,255,90,${clamp(a, 0, 1)})`;
          for (let k = 0; k < 3; k++) {
            const ox = (hash1(i * 17 + k * 91 + pi * 7) - 0.5) * 7 * pxScale * (1.3 - I[i]);
            const oy = (hash1(i * 41 + k * 53 + pi * 3) - 0.5) * 7 * pxScale * (1.3 - I[i]);
            ctx.beginPath();
            ctx.arc(P[i].x + ox, P[i].y + oy, (1.2 + I[i] * 1.6) * pxScale, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalCompositeOperation = "source-over";
      }
    }
    ctx.restore();
  }

  private renderFoundPulse(): void {
    const ctx = this.ctx;
    const t = this.foundFx;
    const r = this.L.partR * (0.4 + easeOut(clamp(t / 1.2, 0, 1)) * 0.7);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(200,255,120,${0.5 * (1 - t / 1.2)})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(this.foundAt.x, this.foundAt.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ---- affordances & UI

  private renderRotateArrow(): void {
    const ctx = this.ctx;
    const c = this.L.partC;
    const rr2 = this.L.partR * 1.28;
    const a0 = -Math.PI * 0.75 + Math.sin(this.time * 2.4) * 0.06;
    const a1 = a0 + Math.PI * 0.42;
    ctx.save();
    ctx.strokeStyle = "rgba(255,220,150,0.85)";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(c.x, c.y, rr2, a0, a1);
    ctx.stroke();
    const hx = c.x + Math.cos(a1) * rr2;
    const hy = c.y + Math.sin(a1) * rr2;
    const dir = a1 + Math.PI / 2;
    ctx.fillStyle = "rgba(255,220,150,0.9)";
    ctx.beginPath();
    ctx.moveTo(hx + Math.cos(dir) * 20, hy + Math.sin(dir) * 20);
    ctx.lineTo(hx + Math.cos(dir + 2.5) * 15, hy + Math.sin(dir + 2.5) * 15);
    ctx.lineTo(hx + Math.cos(dir - 2.5) * 15, hy + Math.sin(dir - 2.5) * 15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawSoftArrow(x0: number, y0: number, x1: number, y1: number): void {
    const ctx = this.ctx;
    const wob = Math.sin(this.time * 3) * 4;
    ctx.save();
    ctx.strokeStyle = "rgba(255,220,150,0.75)";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0 + wob, y0);
    ctx.lineTo(x1 + wob, y1);
    ctx.stroke();
    const dir = Math.atan2(y1 - y0, x1 - x0);
    ctx.fillStyle = "rgba(255,220,150,0.85)";
    ctx.beginPath();
    ctx.moveTo(x1 + wob + Math.cos(dir) * 18, y1 + Math.sin(dir) * 18);
    ctx.lineTo(x1 + wob + Math.cos(dir + 2.4) * 14, y1 + Math.sin(dir + 2.4) * 14);
    ctx.lineTo(x1 + wob + Math.cos(dir - 2.4) * 14, y1 + Math.sin(dir - 2.4) * 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private renderAlbumChip(): void {
    const ctx = this.ctx;
    const s = 44;
    ctx.save();
    ctx.translate(14 + s / 2, 14 + s / 2);
    ctx.rotate(-0.06);
    ctx.fillStyle = "#fff";
    rr(ctx, -s / 2, -s / 2, s, s * 0.82, 4);
    ctx.fill();
    const ph = this.photos[this.photos.length - 1];
    if (ph) ctx.drawImage(ph.cnv, -s / 2 + 3, -s / 2 + 3, s - 6, s * 0.82 - 12);
    ctx.fillStyle = C.pink;
    ctx.beginPath();
    ctx.arc(0, -s / 2 + 2, 4, 0, Math.PI * 2);
    ctx.fill();
    // count dots
    for (let i = 0; i < this.photos.length; i++) {
      ctx.fillStyle = C.fluor;
      ctx.beginPath();
      ctx.arc(-6 + i * 12, s / 2 - 4, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderPhotoAnim(): void {
    const ctx = this.ctx;
    const t = clamp(this.photoAnim / 0.9, 0, 1);
    const e = smooth(t);
    const from = this.photoFrom;
    const to = { x: 14 + 22, y: 14 + 22 };
    const x = lerp(from.x, to.x, e);
    const y = lerp(from.y, to.y, e);
    const s = lerp(this.L.partR * 1.15, 44, e);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lerp(0, -0.06, e));
    ctx.globalAlpha = 1 - t * 0.15;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(3, s * 0.06);
    rr(ctx, -s / 2, -s / 2 * 0.82, s, s * 0.82, 6);
    ctx.stroke();
    const ph = this.photos[this.photos.length - 1];
    if (ph && t > 0.15) {
      ctx.globalAlpha = (t - 0.15)
      ctx.drawImage(ph.cnv, -s / 2, -s / 2 * 0.82, s, s * 0.82);
    }
    ctx.restore();
  }

  private renderFreeHome(): void {
    const ctx = this.ctx;
    const b = this.freeHomeBtn();
    ctx.save();
    ctx.fillStyle = "rgba(247,242,231,0.92)";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.pinkDeep;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = "#3a4152";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(b.x + 10, b.y);
    ctx.lineTo(b.x - 8, b.y);
    ctx.moveTo(b.x - 1, b.y - 9);
    ctx.lineTo(b.x - 10, b.y);
    ctx.lineTo(b.x - 1, b.y + 9);
    ctx.stroke();
    ctx.restore();
  }

  private renderIdleHint(): void {
    if (this.idleT < 4 || !this.interactivePhase()) return;
    const target = this.hintTarget();
    if (!target) return;
    const ctx = this.ctx;
    const p = (this.time % 1.4) / 1.4;
    ctx.save();
    ctx.strokeStyle = `rgba(255,235,170,${0.55 * (1 - p)})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 30 + p * 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private hintTarget(): Vec2 | null {
    switch (this.phase) {
      case "clean": {
        let best: DirtBlob | null = null;
        for (const b of this.dirt) if (!best || b.a > best.a) best = b;
        const t = this.partXform();
        if (best && best.a > 0.1) {
          return { x: t.x + best.x * t.s, y: t.y + best.y * t.s };
        }
        return { x: t.x, y: t.y };
      }
      case "yoke":
        return this.yokeGrabbed ? { ...this.L.partC } : { ...this.yokePos };
      case "magnetize": case "magnetize2":
        return { x: this.L.magnetBtn.x, y: this.L.magnetBtn.y };
      case "fluid": case "fluid2":
        return { ...this.L.partC };
      case "curtain": case "curtain2":
        return { x: this.w / 2, y: this.cover * this.h + 10 };
      case "uv": case "uv2": case "free":
        return { ...this.L.partC };
      case "record": case "record2": {
        const c = this.targetCrack();
        return c ? this.crackCentroidScreen(c) : null;
      }
      case "rotate":
        return { x: this.L.partC.x, y: this.L.partC.y - this.L.partR * 1.2 };
      case "demag":
        return { x: this.partPos.x, y: this.partPos.y };
      default:
        return null;
    }
  }

  // ---- screens

  private renderTitle(): void {
    const ctx = this.ctx;
    const { w, h } = this;
    const m = Math.min(w, h);
    // slowly turning hero gear
    ctx.save();
    ctx.translate(w / 2, h * 0.38);
    ctx.rotate(this.time * 0.1);
    ctx.globalAlpha = 0.9;
    drawGear(ctx, 0, 0, m * 0.24, 12, 215);
    ctx.restore();
    // faint fluorescent zig across the gear face — the promise of the game
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(200,255,90,0.75)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(w / 2 - m * 0.08, h * 0.34);
    ctx.quadraticCurveTo(w / 2, h * 0.38, w / 2 + m * 0.02, h * 0.42);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = C.fluor;
    ctx.shadowColor = "rgba(200,255,90,0.6)";
    ctx.shadowBlur = 18;
    ctx.font = `bold ${Math.round(m * 0.11)}px ${FONT}`;
    ctx.fillText("ピカッ！", w / 2, h * 0.14);
    ctx.shadowBlur = 0;
    ctx.fillStyle = C.cream;
    ctx.font = `bold ${Math.round(m * 0.075)}px ${FONT}`;
    ctx.fillText("かくれひびラボ", w / 2, h * 0.22);
    ctx.restore();
    drawRobot(ctx, w * 0.24, h * 0.72, m * 0.15, 0.6, -0.3, "happy", this.time);
    // start button
    const bx = w * 0.62, by = h * 0.72, br = clamp(m * 0.11, 44, 66);
    const pulse = 1 + Math.sin(this.time * 3) * 0.04;
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "#c9503c";
    ctx.beginPath();
    ctx.arc(0, 6, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.coral;
    ctx.beginPath();
    ctx.arc(0, 0, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(-br * 0.28, -br * 0.42);
    ctx.lineTo(br * 0.5, 0);
    ctx.lineTo(-br * 0.28, br * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private completeButtons(): { id: CompleteChoice | "free"; x: number; y: number; s: number }[] {
    const { w, h } = this;
    const s = clamp(Math.min(w, h) * 0.2, 84, 130);
    const y = h * (this.L.portrait ? 0.78 : 0.78);
    const gap = Math.min(s * 1.35, w / 3.4);
    return [
      { id: "again", x: w / 2 - gap, y, s },
      { id: "newPart", x: w / 2, y, s },
      { id: "free", x: w / 2 + gap, y, s }
    ];
  }

  private renderComplete(): void {
    const ctx = this.ctx;
    const { w, h } = this;
    ctx.save();
    ctx.fillStyle = "rgba(18,16,46,0.88)";
    ctx.fillRect(0, 0, w, h);
    const m = Math.min(w, h);
    // header ribbon: robot + big check
    drawRobot(ctx, w * 0.18, h * 0.16, m * 0.11, 0.5, 0, "happy", this.time);
    ctx.strokeStyle = C.fluor;
    ctx.lineWidth = m * 0.02;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(w * 0.32, h * 0.14);
    ctx.lineTo(w * 0.36, h * 0.18);
    ctx.lineTo(w * 0.44, h * 0.1);
    ctx.stroke();
    // polaroids of both indications
    const pw = clamp(m * 0.34, 130, 230);
    const py = h * 0.42;
    this.photos.forEach((ph, i) => {
      const px = w / 2 + (i - (this.photos.length - 1) / 2) * pw * 1.18;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(i === 0 ? -0.05 : 0.05);
      ctx.fillStyle = "#fff";
      rr(ctx, -pw / 2, -pw * 0.43, pw, pw * 0.95, 6);
      ctx.fill();
      ctx.drawImage(ph.cnv, -pw / 2 + 8, -pw * 0.43 + 8, pw - 16, pw * 0.72);
      // which yoke direction found it: mini yoke glyph
      ctx.translate(0, pw * 0.4);
      ctx.rotate(ph.pass === 2 ? Math.PI / 2 : 0);
      drawYoke(ctx, 0, 0, pw * 0.2, 0, 0, false);
      ctx.restore();
      ctx.save();
      ctx.fillStyle = C.pink;
      ctx.beginPath();
      ctx.arc(px + pw * 0.36, py - pw * 0.4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    // choice buttons
    for (const b of this.completeButtons()) {
      const pulse = b.id === "again" ? Math.sin(this.time * 3) * 0.03 : 0;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(1 + pulse, 1 + pulse);
      ctx.fillStyle = "#f7f2e7";
      rr(ctx, -b.s / 2, -b.s / 2, b.s, b.s, b.s * 0.2);
      ctx.fill();
      ctx.strokeStyle = b.id === "free" ? C.uvViolet : C.pinkDeep;
      ctx.lineWidth = 4;
      rr(ctx, -b.s / 2, -b.s / 2, b.s, b.s, b.s * 0.2);
      ctx.stroke();
      if (b.id === "again") {
        drawGear(ctx, 0, 4, b.s * 0.23, STYLES[this.styleIdx].teeth, STYLES[this.styleIdx].hue);
        ctx.strokeStyle = "#3a4152";
        ctx.lineWidth = b.s * 0.07;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(0, 4, b.s * 0.34, -Math.PI * 0.8, Math.PI * 0.6);
        ctx.stroke();
        const aa = Math.PI * 0.6;
        const ax = Math.cos(aa) * b.s * 0.34, ay = 4 + Math.sin(aa) * b.s * 0.34;
        ctx.fillStyle = "#3a4152";
        ctx.beginPath();
        ctx.moveTo(ax + b.s * 0.12, ay + b.s * 0.02);
        ctx.lineTo(ax - b.s * 0.06, ay + b.s * 0.12);
        ctx.lineTo(ax - b.s * 0.02, ay - b.s * 0.12);
        ctx.closePath();
        ctx.fill();
      } else if (b.id === "newPart") {
        const ns = (this.styleIdx + 1) % STYLES.length;
        drawGear(ctx, 0, 4, b.s * 0.26, STYLES[ns].teeth, STYLES[ns].hue);
        ctx.fillStyle = C.fluor;
        for (const [sx, sy] of [[-0.3, -0.32], [0.34, -0.2], [0.24, 0.3]] as const) {
          this.sparkle(ctx, sx * b.s, sy * b.s + 4, b.s * 0.06);
        }
      } else {
        drawUvLamp(ctx, 0, 6, b.s * 0.22, true);
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(200,255,90,0.9)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-b.s * 0.26, b.s * 0.3);
        ctx.quadraticCurveTo(0, b.s * 0.36, b.s * 0.26, b.s * 0.28);
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.restore();
    }
    ctx.restore();
  }

  private sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.time * 0.8);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
    }
    ctx.strokeStyle = ctx.fillStyle as string;
    ctx.lineWidth = s * 0.35;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
  }

  private renderPhoto(target: Crack): HTMLCanvasElement {
    const cnv = document.createElement("canvas");
    cnv.width = 240; cnv.height = 180;
    const ctx = cnv.getContext("2d");
    if (!ctx) return cnv;
    ctx.fillStyle = "#161233";
    ctx.fillRect(0, 0, 240, 180);
    // fit the crack into the frame
    let minX = 9, maxX = -9, minY = 9, maxY = -9;
    for (const poly of target.polys) {
      for (const p of poly) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const span = Math.max(maxX - minX, maxY - minY, 0.2);
    const scale = 130 / span;
    ctx.save();
    ctx.translate(120, 90);
    // hint of the steel face behind
    ctx.fillStyle = "rgba(110,120,140,0.25)";
    ctx.beginPath();
    ctx.arc(-cx * scale, -cy * scale, scale * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    for (const [wd, col] of [
      [9, "rgba(158,255,70,0.3)"], [3.4, "rgba(214,255,140,0.95)"], [1.4, "rgba(246,255,220,0.9)"]
    ] as const) {
      ctx.lineWidth = wd;
      ctx.strokeStyle = col;
      ctx.lineCap = "round";
      for (const poly of target.polys) {
        ctx.beginPath();
        poly.forEach((p, i) => {
          const x = (p.x - cx) * scale, y = (p.y - cy) * scale;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    }
    ctx.restore();
    return cnv;
  }

  // ------------------------------------------------------------- test API

  snapshot(): Record<string, unknown> {
    const target = this.targetCrack();
    const crackPts = (c: Crack | null): [number, number][] => {
      if (!c) return [];
      const out: [number, number][] = [];
      for (let pi = 0; pi < c.polys.length; pi++) {
        for (let i = 0; i < c.polys[pi].length; i += 3) {
          const p = this.crackPtScreen(c, pi, i);
          out.push([Math.round(p.x), Math.round(p.y)]);
        }
      }
      return out;
    };
    return {
      phase: this.phase,
      dark: this.dark,
      cover: this.cover,
      curtainMode: this.curtainMode,
      yokeAngle: this.yokeAngle,
      energized: this.energized,
      residual: this.residual,
      photos: this.photos.length,
      meanAccumTarget: target ? meanAccum(target) : 0,
      meanRevealTarget: target ? meanReveal(target) : 0,
      partC: [Math.round(this.partPos.x), Math.round(this.partPos.y)],
      partR: Math.round(this.L.partR),
      yokeHome: [Math.round(this.L.yokeHome.x), Math.round(this.L.yokeHome.y)],
      yokePos: [Math.round(this.yokePos.x), Math.round(this.yokePos.y)],
      magnetBtn: [Math.round(this.L.magnetBtn.x), Math.round(this.L.magnetBtn.y)],
      curtainTab: [Math.round(this.w / 2), Math.round(this.cover * this.h)],
      lampOffset: [this.lampOffset().x, this.lampOffset().y],
      targetPts: crackPts(target),
      targetDetail: target
        ? {
            accum: target.accum.map((a) => a.map((v) => Math.round(v * 100) / 100)),
            reveal: target.reveal.map((a) => a.map((v) => Math.round(v * 100) / 100))
          }
        : null,
      demag: {
        partX: Math.round(this.partPos.x),
        ringX: Math.round(this.L.demag.ringX),
        startX: Math.round(this.L.demag.startX),
        endX: Math.round(this.L.demag.endX),
        y: Math.round(this.L.demag.ringY)
      },
      buttons: Object.fromEntries(
        this.completeButtons().map((b) => [b.id, [Math.round(b.x), Math.round(b.y)]])
      ),
      freeHome: [this.freeHomeBtn().x, this.freeHomeBtn().y],
      size: [this.w, this.h]
    };
  }
}
