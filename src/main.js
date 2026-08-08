// 「かなざわ きんぱく」 — 4歳児向けの金箔づくり体験
//
// Five signature actions, each with its own feel:
//   トントン tap   ペロン drag   フワッ swipe   ぺたっ big drag   キラッ stroke
// No failure, no timer, no score. The loop simply comes round again with a new
// lacquered object to gild.

import { mat4, vec3, clamp, lerp, damp, smoothstep } from './core/math.js';
import { Renderer, Camera } from './core/renderer.js';
import { Audio } from './core/audio.js';
import { Input } from './core/input.js';
import { buildAtelier, buildMotes, MAT } from './scene/atelier.js';
import { buildProps, baseHeight, LAYOUT, BOARD_TOP } from './scene/props.js';
import { GoldLeaf } from './scene/leaf.js';
import { PeelSheet } from './scene/peel.js';
import { UI } from './ui.js';

const PACKET_TOP = BOARD_TOP + 24 * 0.0021;   // top of the 24-sheet bundle
const HAMMER_PIVOT = [0, 0.246, -0.055];
const HAMMER_ARM = 0.140;

// Camera framing per phase. `span` is the world width that must fit on screen,
// so the same code frames a tall phone and a wide tablet correctly.
const SHOTS = {
  intro: { target: [0, 0.03, -0.03], yaw: 0.22, pitch: 0.40, span: 1.15 },
  uchi: { target: [0, 0.055, -0.055], yaw: 0.16, pitch: 0.46, span: 0.46 },
  peron: { target: [0, 0.055, -0.055], yaw: 0.04, pitch: 0.36, span: 0.36 },
  fuwa: { target: [0, 0.066, -0.055], yaw: -0.12, pitch: 0.26, span: 0.25 },
  peta: { target: [0, 0.035, 0.055], yaw: 0.04, pitch: 0.52, span: 0.50 },
  kira: { target: [0, 0.030, 0.185], yaw: 0.10, pitch: 0.34, span: 0.32 },
  done: { target: [0, 0.034, 0.185], yaw: 0.10, pitch: 0.32, span: 0.30 },
};

const WORDS = {
  intro: ['きんぱく', 'tap', 'さわってね'],
  uchi: ['トントン', 'tap', ''],
  peron: ['ぺろん', 'swipeUp', ''],
  fuwa: ['ふわっ', 'wave', ''],
  peta: ['ぺたっ', 'drag', ''],
  kira: ['キラッ', 'stroke', ''],
  done: ['できた！', null, ''],
};

class Game {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.gl = this.renderer.gl;
    this.camera = new Camera();
    this.audio = new Audio();
    this.ui = new UI(uiRoot);
    this.input = new Input(canvas);

    this.time = 0;
    this.phase = 'intro';
    this.phaseTime = 0;
    this.started = false;
    this.baseKind = 0;
    this.round = 0;

    // camera state
    this.camPos = vec3.create(0, 0.5, 0.9);
    this.camTarget = vec3.create(0, 0.03, 0);
    this.shake = 0;
    this.shakeSeed = 0;

    this.buildScene();
    this.bindInput();
    this.setPhase('intro');
  }

  buildScene() {
    const gl = this.gl;
    this.atelier = buildAtelier(gl);
    const props = buildProps(gl);
    this.props = props.refs;
    this.leaf = new GoldLeaf(gl);
    this.peel = new PeelSheet(gl);
    this.peelNode = {
      mesh: this.peel.mesh,
      model: this.peel.model,
      // One sheet of beaten paper: thin enough to glow when the light is behind it
      mat: { ...MAT.washi, doubleSided: true, translucency: 1.0 },
      castShadow: true,
      visible: true,
    };
    this.peelProgress = 0;
    this.motes = buildMotes(gl, 360);

    this.scene = {
      nodes: [...this.atelier, ...props.nodes, this.peelNode],
      transparent: [this.leaf.renderNode],
      light: {
        dir: vec3.normalize(vec3.create(), vec3.create(-0.34, 0.60, -0.72)),
        color: [3.15, 2.72, 2.16],
        target: [0, 0.03, 0.02],
        radius: 0.46,
      },
      fog: { density: 0.062, color: [0.052, 0.038, 0.028] },
      clearColor: [0.010, 0.008, 0.007],
      motes: this.motes,
      time: 0,
    };

    // Rest transforms we animate away from and back to.
    this.hammerAngle = 1.15;
    this.hammerActive = 0;
    this.packetSquash = 1;
    this.packetSquashVel = 0;
    this.brushT = vec3.create(0.33, 0.006, 0.20);
    this.brushR = vec3.create(0, 0.7, 0);
    this.chopT = vec3.create(0.30, 0.012, 0.03);
    this.chopR = vec3.create(0, -0.5, 0);
    this.setBaseKind(0);
  }

  setBaseKind(k) {
    this.baseKind = k;
    this.props.bases.forEach((b, i) => { b.visible = i === k; });
    this.leaf.baseKind = k;
  }

  // ---------------------------------------------------------------- phases
  setPhase(name) {
    this.phase = name;
    this.phaseTime = 0;
    const [word, gesture, sub] = WORDS[name] || ['', null, ''];
    this.ui.setAction(word, gesture, sub);
    this.ui.showAgain(false);
    this.ui.setBeads(name === 'uchi' ? 3 : 0, this.hits || 0);

    if (name === 'intro') {
      this.hits = 0;
      this.peelProgress = 0;
      this.leaf.visible = false;
      this.props.packet.visible = true;
      this.hammerAngle = 1.15;
      this.hammerActive = 0;
    }
    if (name === 'uchi') {
      this.hits = 0;
      this.ui.setBeads(3, 0);
      this.hammerActive = 1;
      this.peelNode.visible = false;
      this.leaf.visible = false;
      this.props.packet.visible = true;
    }
    if (name === 'peron') {
      this.hammerActive = 0;
      this.peelProgress = 0;
      this.peelSounded = false;
      // The leaf lies between the papers: flat, barely lifted, half covered.
      this.leaf.reset();
      this.leaf.visible = true;
      this.leaf.mode = 'flat';
      this.leaf.adhesion = 0.55;
      this.leaf.liftAmp = 0.18;
      this.leaf.conform = 0;
      this.leaf.place(LAYOUT.board[0], PACKET_TOP + 0.0004, LAYOUT.board[2]);
    }
    if (name === 'fuwa') {
      this.gusts = 0;
      this.leaf.adhesion = 0;
      this.leaf.liftAmp = 1;
      this.leaf.mode = 'flat';
    }
    if (name === 'peta') {
      this.leaf.mode = 'free';
      this.leaf.posTarget[1] = PACKET_TOP + 0.045;
      this.landed = false;
    }
    if (name === 'kira') {
      this.leaf.mode = 'onBase';
      this.brushWork = 0;
      this.brushing = false;
      this.finished = false;
      this.sweepT = -1;
    }
    if (name === 'done') {
      this.round++;
    }
  }

  bindInput() {
    const inp = this.input;
    inp.on('down', (s) => {
      this.audio.init();
      this.audio.resume();
      if (!this.started) {
        this.started = true;
        this.setPhase('uchi');
        return;
      }
      if (this.phase === 'kira' && !this.finished) {
        this.audio.brushStart();
        this.brushing = true;
      }
      if (this.phase === 'done' && this.phaseTime > 1.6) this.nextRound();
    });

    inp.on('tap', () => {
      if (this.phase === 'uchi') this.strike();
    });

    inp.on('move', (s) => {
      if (!this.started) return;
      switch (this.phase) {
        case 'peron': this.onPeelDrag(s); break;
        case 'fuwa': this.onFan(s); break;
        case 'peta': this.onCarry(s); break;
        case 'kira': this.onBrush(s); break;
        default: break;
      }
    });

    inp.on('up', (s) => {
      if (this.phase === 'peron') this.onPeelRelease();
      if (this.phase === 'peta') this.onRelease();
      if (this.phase === 'kira') {
        this.brushing = false;
        this.audio.brushStop();
      }
    });

    this.ui.again.addEventListener('click', () => this.nextRound());
  }

  nextRound() {
    this.setBaseKind((this.baseKind + 1) % 3);
    this.leaf.reset();
    this.leaf.visible = false;
    this.leaf.adhesion = 0;
    this.leaf.conform = 0;
    this.leaf.sparkle = 0;
    this.leaf.sweep = 0;
    this.peel.update(0);
    this.motes.color = [1.0, 0.86, 0.62];
    this.brushWork = 0;
    this.setPhase('uchi');
  }

  // ------------------------------------------------------------ 1. トントン
  strike() {
    // Every tap lands, even if the previous swing has not finished: a child
    // drumming on the glass should get a beat for every touch. If the last
    // swing never reached contact (a dropped frame), settle it now.
    const sw = this.hammerSwing;
    if (sw && !sw.hit) {
      sw.hit = true;
      this.onHit();
    }
    this.hammerSwing = { t: 0, hit: false };
  }

  updateStrike(dt) {
    const sw = this.hammerSwing;
    // hovering, breathing hammer when idle
    let target = 1.15 + Math.sin(this.time * 1.6) * 0.05;
    if (sw) {
      sw.t += dt;
      const down = 0.12, up = 0.34;
      if (sw.t < down) {
        target = lerp(1.15, -0.03, smoothstep(0, 1, sw.t / down) ** 0.65);
      } else if (sw.t < down + up) {
        const k = (sw.t - down) / up;
        target = lerp(-0.03, 1.15, smoothstep(0, 1, k));
      } else {
        this.hammerSwing = null;
      }
      if (!sw.hit && sw.t >= down * 0.92) {
        sw.hit = true;
        this.onHit();
      }
    }
    this.hammerAngle = damp(this.hammerAngle, target, 26, dt);

    // packet squash as a small spring
    const rest = 1;
    this.packetSquashVel += (rest - this.packetSquash) * 260 * dt - this.packetSquashVel * 14 * dt;
    this.packetSquash += this.packetSquashVel * dt;
  }

  onHit() {
    this.hits++;
    this.audio.tonton(1);
    this.packetSquash = 0.80;
    this.packetSquashVel = 0;
    this.shake = 0.9;
    this.shakeSeed = Math.random() * 100;
    this.renderer.flash = 0.10;
    this.motes.intensity = 1.5;
    this.ui.setBeads(3, this.hits);
    if (this.hits >= 3) {
      setTimeout(() => { if (this.phase === 'uchi') this.setPhase('peron'); }, 620);
    }
  }

  // -------------------------------------------------------------- 2. ペロン
  onPeelDrag(s) {
    if (!s.down) return;
    // Any direction works; pulling toward the child works best. Very forgiving.
    const gain = 1 / (this.canvas.clientHeight * 0.42);
    // Pushing the sheet away (up the screen) is the natural motion, but a
    // downward or sideways scrub opens it too — nothing a child does is wrong.
    const contribution = (Math.max(-s.dy, 0) * 1.0 + Math.abs(s.dx) * 0.35 + Math.max(s.dy, 0) * 0.45) * gain;
    this.peelProgress = clamp(this.peelProgress + contribution, 0, 1);
    if (!this.peelSounded && this.peelProgress > 0.06) {
      this.peelSounded = true;
      this.audio.peron(1);
    }
    this.ui.fadeHint(clamp(1 - this.peelProgress * 2.2, 0, 1));
    // The leaf feels the paper come off it: it stops being pressed flat, its
    // edges start to lift, and the sheet swinging overhead drags air across it.
    // By the time the paper is out of the way the leaf is already breathing.
    const k = smoothstep(0.18, 0.9, this.peelProgress);
    this.leaf.adhesion = lerp(0.55, 0.04, k);
    this.leaf.liftAmp = lerp(0.18, 1.0, k);
    if (k > 0.02 && contribution > 0.003) {
      this.leaf.gust(this.leaf.pos, vec3.create(0, 0, -1),
        clamp(contribution * 2.2, 0.004, 0.05), 0.075);
    }
    if (this.peelProgress >= 0.999 && this.phase === 'peron') {
      this.setPhase('fuwa');
      this.audio.fuwa(0.6);
    }
  }

  onPeelRelease() {
    if (this.peelProgress > 0.42 && this.peelProgress < 0.999) {
      this.peelSnap = true;   // let go past halfway and it opens on its own
    } else if (this.peelProgress <= 0.42) {
      this.peelSnap = false;
    }
  }

  // --------------------------------------------------------------- 3. フワッ
  onFan(s) {
    if (!s.down || s.speed < 40) return;
    const p = this.camera.rayPlane(s.ndc[0], s.ndc[1], this.leaf.pos[1] + 0.01);
    if (!p) return;
    // screen motion -> a horizontal air current in world space
    const right = vec3.normalize(vec3.create(),
      vec3.cross(vec3.create(), vec3.sub(vec3.create(), this.camTarget, this.camPos), [0, 1, 0]));
    const fwd = vec3.normalize(vec3.create(), vec3.create(
      this.camTarget[0] - this.camPos[0], 0, this.camTarget[2] - this.camPos[2]));
    const dir = vec3.normalize(vec3.create(), vec3.create(
      right[0] * s.dx - fwd[0] * s.dy,
      0,
      right[2] * s.dx - fwd[2] * s.dy));
    const power = clamp(s.speed / 900, 0.08, 1);
    this.leaf.gust(p, dir, power * 0.085, 0.050);
    this.gustEnergy = (this.gustEnergy || 0) + power * 0.02;
    if (!this._fuwaCool || this.time - this._fuwaCool > 0.55) {
      this._fuwaCool = this.time;
      this.audio.fuwa(clamp(power * 1.2, 0.3, 1));
      this.gusts++;
      this.ui.fadeHint(clamp(1 - this.gusts * 0.4, 0, 1));
    }
    if (this.gusts >= 3 && this.phase === 'fuwa') {
      this.setPhase('peta');
      this.leaf.velWorld[1] += 0.05;
    }
  }

  // --------------------------------------------------------------- 4. ぺたっ
  onCarry(s) {
    if (!s.down || this.landed) return;
    const p = this.camera.rayPlane(s.ndc[0], s.ndc[1], 0.06);
    if (!p) return;
    this.leaf.posTarget[0] = clamp(p[0], -0.34, 0.34);
    this.leaf.posTarget[2] = clamp(p[2], -0.26, 0.30);
    this.leaf.posTarget[1] = 0.055 + Math.sin(this.time * 2.1) * 0.004;
    this.leaf.mode = 'free';
    // the sheet lags behind the tool and flutters as it travels
    const dx = this.leaf.posTarget[0] - this.leaf.pos[0];
    const dz = this.leaf.posTarget[2] - this.leaf.pos[2];
    this.leaf.rotTarget[2] = clamp(-dx * 3.2, -0.42, 0.42);
    this.leaf.rotTarget[0] = clamp(dz * 3.2, -0.42, 0.42);
    if (s.speed > 90 && (!this._carryCool || this.time - this._carryCool > 0.4)) {
      this._carryCool = this.time;
      this.leaf.gust(this.leaf.pos, vec3.create(dx, 0, dz), 0.045, 0.07);
      this.audio.fuwa(0.35);
    }
    // Measured from where the finger is, not from where the sheet has drifted
    // to — the sheet lags on purpose, and the child should not have to wait for
    // it to catch up before the drop registers.
    const d = Math.hypot(this.leaf.posTarget[0] - LAYOUT.base[0],
      this.leaf.posTarget[2] - LAYOUT.base[2]);
    // The piece pulls the leaf in once it is close: aiming precisely is not a
    // skill a four-year-old should need.
    if (d < 0.13) {
      const k = clamp(1 - d / 0.13, 0, 1) * 0.55;
      this.leaf.posTarget[0] = lerp(this.leaf.posTarget[0], LAYOUT.base[0], k);
      this.leaf.posTarget[2] = lerp(this.leaf.posTarget[2], LAYOUT.base[2], k);
    }
    this.ui.fadeHint(clamp(d * 4, 0, 1));
    if (d < 0.075) this.land();
  }

  onRelease() {
    if (this.landed) return;
    const d = Math.hypot(this.leaf.posTarget[0] - LAYOUT.base[0],
      this.leaf.posTarget[2] - LAYOUT.base[2]);
    if (d < 0.17) this.land();
    else {
      // never a failure: it just drifts back up and waits
      this.leaf.posTarget[1] = 0.055;
    }
  }

  land() {
    if (this.landed) return;
    this.landed = true;
    this.leaf.mode = 'landing';
    this.leaf.posTarget[0] = LAYOUT.base[0];
    this.leaf.posTarget[2] = LAYOUT.base[2];
    this.leaf.posTarget[1] = 0;
    this.leaf.rotTarget[0] = 0;
    this.leaf.rotTarget[2] = 0;
    this.leaf.velWorld[1] = -0.012;
    // the air trapped underneath escapes as the sheet meets the lacquer
    this.leaf.gust(this.leaf.pos, vec3.create(0, 0, 1), 0.05, 0.075);
    // Descent is an explicit tween, not a spring: when the leaf finishes taking
    // the shape of the piece it must be exactly on it, never hovering above.
    this.landFrom = [this.leaf.pos[0], this.leaf.pos[1], this.leaf.pos[2]];
    this.landT = 0;
    this.ui.setAction('', null);
    setTimeout(() => this.audio.peta(), 620);
    setTimeout(() => { if (this.phase === 'peta') this.setPhase('kira'); }, 1150);
  }

  // --------------------------------------------------------------- 5. キラッ
  onBrush(s) {
    if (!s.down || this.finished) return;
    // Aim at the height of the piece being gilded, not at an arbitrary plane —
    // at this shallow camera angle a few centimetres of error puts the stroke
    // on the far side of the bench.
    const p = this.camera.rayPlane(s.ndc[0], s.ndc[1], baseHeight(this.baseKind, 0));
    if (!p) return;
    // Anywhere near the piece counts as stroking it.
    p[0] = clamp(p[0], LAYOUT.base[0] - 0.075, LAYOUT.base[0] + 0.075);
    p[2] = clamp(p[2], LAYOUT.base[2] - 0.075, LAYOUT.base[2] + 0.075);
    this.brushTarget = p;
    const speed = clamp(s.speed / 700, 0, 1);
    this.audio.brushLevel(0.25 + speed * 0.9);
    // Drive the smoothing by distance travelled, not by event count, so a
    // 120 Hz iPad and a 60 Hz iPhone need the same amount of stroking.
    const moved = clamp(Math.hypot(s.dx, s.dy) / 30, 0.06, 1.2);
    const removed = this.leaf.burnish(p, moved * 0.95, 0.040);
    this.brushWork = (this.brushWork || 0) + removed;
    this.leaf.adhesion = clamp(0.45 + this.brushWork * 3.2, 0, 1);
    if (removed > 0.0002 && (!this._kiraCool || this.time - this._kiraCool > 0.75)) {
      this._kiraCool = this.time;
      this.leaf.sparkle = Math.min(1, this.leaf.sparkle + 0.35);
      this.audio.kira(Math.floor(Math.random() * 3) * 2);
    }
    const w = this.leaf.wrinkleAmountCached ?? 1;
    this.ui.fadeHint(clamp((w - 0.09) * 6, 0, 1));
    // Two ways to arrive: the leaf is genuinely smooth, or enough stroking has
    // happened that a child deserves the payoff regardless.
    if (w < 0.10 || this.brushWork > 0.26) this.finish();
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.brushing = false;
    this.audio.brushStop();
    this.sweepT = 0;
    this.leaf.adhesion = 1;
    this.motes.intensity = 2.4;
    this.motes.color = [1.0, 0.82, 0.45];
    this.audio.kira(0);
    setTimeout(() => this.audio.joy(), 320);
    setTimeout(() => { if (this.phase === 'kira') this.setPhase('done'); }, 1500);
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    this.time += dt;
    this.phaseTime += dt;
    this.scene.time = this.time;

    if (this.phase === 'uchi' || this.phase === 'intro') this.updateStrike(dt);

    // ---- props follow the phase -----------------------------------------
    this.updateHammer(dt);
    this.updatePacket();
    this.updateTools(dt);

    // ---- ペロン: paper springs to whichever side it was released toward ---
    if (this.phase === 'peron') {
      if (!this.input.down) {
        const goal = this.peelSnap ? 1 : 0;
        this.peelProgress = damp(this.peelProgress, goal, this.peelSnap ? 6 : 4, dt);
        if (this.peelSnap && this.peelProgress > 0.985) {
          this.peelProgress = 1;
          this.setPhase('fuwa');
          this.audio.fuwa(0.6);
        }
      }
    }
    this.peel.update(this.peelProgress ?? 0, this.time);

    // ---- landing: the sheet settles and takes the shape of the base ------
    if (this.landed && this.leaf.conform < 1) {
      this.landT = (this.landT || 0) + dt;
      const k = smoothstep(0, 1, clamp(this.landT / 0.9, 0, 1));
      this.leaf.conform = k;
      this.leaf.adhesion = k * 0.45;
      // sink slowly at first, then settle — a sheet with no weight to speak of
      const fall = 1 - Math.pow(1 - k, 2.6);
      const f = this.landFrom;
      vec3.set(this.leaf.pos,
        lerp(f[0], LAYOUT.base[0], fall),
        lerp(f[1], 0, fall),
        lerp(f[2], LAYOUT.base[2], fall));
      vec3.set(this.leaf.posTarget, LAYOUT.base[0], 0, LAYOUT.base[2]);
      vec3.set(this.leaf.velWorld, 0, 0, 0);
    }

    // ---- キラッ sweep -----------------------------------------------------
    if (this.sweepT >= 0) {
      this.sweepT += dt;
      const k = clamp(this.sweepT / 1.25, 0, 1);
      this.leaf.sweep = k;
      this.leaf.sparkle = Math.sin(k * Math.PI) * 1.0;
      this.renderer.flash = Math.max(this.renderer.flash, Math.sin(k * Math.PI) * 0.16);
    } else {
      this.leaf.sparkle = damp(this.leaf.sparkle, 0, 2.2, dt);
    }

    // ---- ambient decay ---------------------------------------------------
    this.motes.intensity = damp(this.motes.intensity, this.phase === 'done' ? 0.9 : 0.35, 1.4, dt);
    this.renderer.flash = damp(this.renderer.flash, 0, 6, dt);
    this.shake = damp(this.shake, 0, 7, dt);

    this.leaf.update(dt, this.time);
    this.scene.transparent[0] = this.leaf.renderNode;

    this.updateCamera(dt);

    if (this.phase === 'done') {
      this.ui.showAgain(this.phaseTime > 1.4);
    }
  }

  updateHammer(dt) {
    const a = this.hammerAngle;
    const show = this.phase === 'uchi' || this.phase === 'intro';
    const parkT = [-0.30, 0.035, 0.02];
    let t, r;
    if (show) {
      t = [
        HAMMER_PIVOT[0],
        HAMMER_PIVOT[1] - Math.cos(a) * HAMMER_ARM,
        HAMMER_PIVOT[2] + Math.sin(a) * HAMMER_ARM,
      ];
      r = [-a, 0, 0];
    } else {
      t = parkT;
      r = [0, 0.3, Math.PI / 2];
    }
    mat4.fromTRS(this.props.hammerHead.model, t, r, [1, 1, 1]);
    mat4.fromTRS(this.props.hammerHandle.model, t, r, [1, 1, 1]);
  }

  updatePacket() {
    // The bundle stays on the board for the whole session; the sheet that was
    // peeled open stays lying beside it, exactly as it would in a workshop.
    const p = this.props.packet;
    p.visible = true;
    mat4.fromTRS(p.model, [LAYOUT.board[0], BOARD_TOP, LAYOUT.board[2]], [0, 0, 0],
      [1, this.packetSquash, 1]);
    const top = BOARD_TOP + (PACKET_TOP - BOARD_TOP) * this.packetSquash;
    this.peel.setTransform([LAYOUT.board[0], top + 0.0012, LAYOUT.board[2]]);
    this.peelNode.model = this.peel.model;
  }

  updateTools(dt) {
    // 箔箸 rise to carry the leaf during ぺたっ
    const carrying = this.phase === 'peta' && !this.landed;
    // The tips rest on the leaf's near edge; the shafts run up and back toward
    // where a hand would be.
    const ct = carrying
      ? [this.leaf.pos[0] + 0.022, this.leaf.pos[1] + 0.005, this.leaf.pos[2] + 0.034]
      : [0.30, 0.006, -0.06];
    const cr = carrying ? [-0.55, 0.10, 0.04] : [0.06, -0.5, 0];
    for (let i = 0; i < 3; i++) {
      this.chopT[i] = damp(this.chopT[i], ct[i], 9, dt);
      this.chopR[i] = damp(this.chopR[i], cr[i], 9, dt);
    }
    mat4.fromTRS(this.props.chopsticks.model, this.chopT, this.chopR, [1, 1, 1]);

    // 毛棒 follows the stroking finger during キラッ
    const brushing = this.phase === 'kira' && this.brushing && this.brushTarget && !this.finished;
    const bt = brushing
      ? [this.brushTarget[0], 0.058 + (this.baseKind === 2 ? 0.055 : 0.02), this.brushTarget[2] + 0.052]
      : (this.phase === 'kira' || this.phase === 'done' ? [0.30, 0.006, 0.24] : [0.33, 0.006, 0.20]);
    const br = brushing ? [-0.75, 0.0, 0] : [0, 0.7, 0];
    for (let i = 0; i < 3; i++) {
      this.brushT[i] = damp(this.brushT[i], bt[i], 12, dt);
      this.brushR[i] = damp(this.brushR[i], br[i], 12, dt);
    }
    mat4.fromTRS(this.props.brushHandle.model, this.brushT, this.brushR, [1, 1, 1]);
    mat4.fromTRS(this.props.brushHair.model, this.brushT, this.brushR, [1, 1, 1]);
  }

  updateCamera(dt) {
    const shot = SHOTS[this.phase] || SHOTS.intro;
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    const cam = this.camera;
    // Fit `span` across the screen width; on a tall phone that means backing off,
    // which leaves the upper frame for the workshop behind — good composition.
    const tanHalf = Math.tan(cam.fov / 2);
    // A portrait phone is treated as a 3:4 frame: the sides crop, the workshop
    // fills the space above the bench instead of shrinking the subject.
    let dist = shot.span / (2 * tanHalf * clamp(aspect, 0.74, 2.4));
    dist = clamp(dist, 0.16, 3.2);
    const portrait = aspect < 0.95;
    const pitch = shot.pitch + (portrait ? 0.05 : 0);
    let yaw = shot.yaw;
    if (this.phase === 'done') yaw += Math.sin(this.time * 0.30) * 0.32;
    if (this.phase === 'intro') yaw += Math.sin(this.time * 0.16) * 0.10;

    const tx = shot.target[0], ty = shot.target[1], tz = shot.target[2];
    const eye = [
      tx + Math.sin(yaw) * Math.cos(pitch) * dist,
      ty + Math.sin(pitch) * dist,
      tz + Math.cos(yaw) * Math.cos(pitch) * dist,
    ];
    // Portrait: drop the subject toward the lower third of the frame, leaving
    // the tall upper half for the workshop behind it.
    const lookAtY = ty + (portrait ? dist * tanHalf * 0.15 : 0);
    const l = this.phaseTime < 0.05 ? 3.2 : 2.6;
    this.camPos[0] = damp(this.camPos[0], eye[0], l, dt);
    this.camPos[1] = damp(this.camPos[1], eye[1], l, dt);
    this.camPos[2] = damp(this.camPos[2], eye[2], l, dt);
    this.camTarget[0] = damp(this.camTarget[0], tx, l, dt);
    this.camTarget[1] = damp(this.camTarget[1], lookAtY, l, dt);
    this.camTarget[2] = damp(this.camTarget[2], tz, l, dt);

    const sh = this.shake * 0.006;
    vec3.set(cam.position,
      this.camPos[0] + Math.sin(this.time * 61 + this.shakeSeed) * sh,
      this.camPos[1] + Math.sin(this.time * 73 + this.shakeSeed) * sh,
      this.camPos[2] + Math.cos(this.time * 67 + this.shakeSeed) * sh);
    vec3.set(cam.target, this.camTarget[0], this.camTarget[1], this.camTarget[2]);
    cam.update(aspect);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

// -------------------------------------------------------------------- boot
function boot() {
  const canvas = document.getElementById('gl');
  const uiRoot = document.getElementById('ui');
  let game;
  try {
    game = new Game(canvas, uiRoot);
  } catch (err) {
    console.error(err);
    document.getElementById('fallback').style.display = 'flex';
    return;
  }
  window.__game = game;

  let last = performance.now();
  let fpsAccum = 0, fpsFrames = 0;
  function frame(now) {
    const raw = (now - last) / 1000;
    const dt = Math.min(raw, 1 / 20);
    last = now;
    fpsAccum += raw; fpsFrames++;
    if (fpsAccum > 0.5) {
      game.fps = fpsFrames / fpsAccum;
      fpsAccum = 0; fpsFrames = 0;
    }
    game.update(dt);
    game.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const onResize = () => game.renderer.resize();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 250));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) last = performance.now();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
