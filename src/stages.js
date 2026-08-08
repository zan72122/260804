// The nine steps of the casting, plus the shape choice and the burn-out.
//
// Order matters more than anything else in this game: each step only makes
// sense because of the one before it.  Nothing here has a fail state, a timer
// or a score -- the only thing a player can do is not finish yet.

import * as THREE from './core/three.js';
import { audio } from './core/audio.js';
import { STEP_ICONS } from './ui/hud.js';
import { ParticlePool, FX } from './world/particles.js';
import { CrackField } from './world/cracks.js';
import {
  SHAPES, SHAPE_KEYS, outerR, innerR, coreR, moldR, moldHeight, moldInnerR, SPRUE_R,
} from './world/profiles.js';
import { METALS, METAL_KEYS, moltenMaterial, makeDotTexture } from './world/materials.js';
import { DECOR_KEYS, decorSvg } from './world/decorations.js';
import {
  makeSweepBoard, makeSweepCarriage, makeBrush, makeIngot, Stream, makeClapper,
  makeHeadstock, Rope,
} from './world/props.js';
import { founderWalkTo, founderLook, founderReach } from './world/workshop.js';
import {
  clamp, clamp01, lerp, smoothstep, damp, TAU, angDelta, sampleCurve,
} from './core/util.js';

export const STAGE_ORDER = [
  'pick', 'core', 'falsebell', 'decor', 'mold', 'bake',
  'furnace', 'pour', 'cool', 'breakup', 'lift', 'ring',
];

/* ================================================================== *
 *  shared helpers                                                     *
 * ================================================================== */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);

// Jib angle that stows the ladle over by the furnace.  The jib's pivot happens
// to stand about one ladle-radius from the casting axis, so most angles sweep
// the ladle straight across the bell -- this one is the far side.
const LADLE_PARK = 2.10;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

/**
 * Frame whatever is standing on the casting axis.
 *
 * A phone held upright is far narrower than a bell is tall, so insisting that
 * the full width fit would push the camera back until the bell was a thumbnail.
 * Portrait therefore fits the HEIGHT and lets the mouth run past the edges --
 * which is also the shot the brief asks for.  Landscape does the opposite and
 * pulls back to hold the furnace, the flask and the crane together.
 */
function frameAxis(g, { top, pad = 0.45, yaw = 0.17, pitch = 0.16, widthScale = 1.0, radius = null } = {}) {
  const S = SHAPES[g.state.shapeKey];
  const r = radius ?? Math.max(S.rim, 0.85);
  const h = top + pad;
  g.rig.setShot(
    { target: V(0, h * 0.5, 0), w: r * 2 * widthScale * 0.92, h: h * 1.04, yaw, pitch },
    { target: V(0, h * 0.47, 0), w: r * 2 * widthScale * 2.4, h: h * 1.0, yaw: yaw + 0.06, pitch: pitch + 0.02 }
  );
}

/** silhouette of a bell shape as an svg path, for the picker and the title */
export function bellSvgPath(key, W = 100, H = 118) {
  const S = SHAPES[key];
  const N = 44;
  let maxR = 0;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, r = outerR(S, t);
    maxR = Math.max(maxR, r);
    pts.push([r, t]);
  }
  const sx = (W * 0.46) / maxR;
  const sy = H * 0.80 / 1;
  const cx = W / 2, base = H * 0.90;
  const right = pts.map(([r, t]) => [cx + r * sx, base - t * sy]);
  const left = [...right].reverse().map(([x, y]) => [cx - (x - cx), y]);
  const all = [...right, ...left];
  return all.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z';
}

export function bellSvg(key, fill = '#d9a04c') {
  const crown = { tulip: 'M50 22 a9 9 0 1 1 .1 0 z', temple: 'M42 24 h16 v-8 h-16 z', squat: 'M50 20 a10 8 0 1 1 .1 0 z' }[key];
  return `<svg viewBox="-5 -6 110 134" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="bg${key}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#8a5f28"/><stop offset=".42" stop-color="${fill}"/>
      <stop offset=".7" stop-color="#f0cf8e"/><stop offset="1" stop-color="#7a5322"/>
    </linearGradient></defs>
    <path d="${crown}" fill="url(#bg${key})" stroke="rgba(40,22,8,.6)" stroke-width="2.5"/>
    <path d="${bellSvgPath(key)}" fill="url(#bg${key})" stroke="rgba(40,22,8,.6)" stroke-width="2.5"
      stroke-linejoin="round"/>
  </svg>`;
}

function ingotSvg(metalKey) {
  const M = METALS[metalKey];
  const hex = '#' + M.color.toString(16).padStart(6, '0');
  const hi = '#' + M.name.toString(16).padStart(6, '0');
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 66 L32 40 L68 40 L78 66 Z" fill="${hex}" stroke="rgba(30,18,8,.6)" stroke-width="3" stroke-linejoin="round"/>
    <path d="M32 40 L36 32 L64 32 L68 40 Z" fill="${hi}" stroke="rgba(30,18,8,.6)" stroke-width="3" stroke-linejoin="round"/>
  </svg>`;
}

/** pulsing marker that says "touch this" without saying anything */
class Beacon {
  constructor(scene) {
    const tex = makeDotTexture(0.72, 128);
    const mat = new THREE.SpriteMaterial({
      map: tex, color: 0xffd08a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false,
    });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.renderOrder = 20;
    this.sprite.visible = false;
    scene.add(this.sprite);
    this.mat = mat;
    this.size = 1;
  }
  show(pos, size = 1) {
    this.sprite.visible = true;
    this.sprite.position.copy(pos);
    this.size = size;
  }
  hide() { this.sprite.visible = false; this.mat.opacity = 0; }
  update(t) {
    if (!this.sprite.visible) return;
    const p = 0.5 + 0.5 * Math.sin(t * 3.4);
    this.mat.opacity = 0.30 + p * 0.34;
    const s = this.size * (1.0 + p * 0.22);
    this.sprite.scale.set(s, s, s);
  }
}

let beacon = null;
function getBeacon(g) {
  if (!beacon) beacon = new Beacon(g.scene);
  return beacon;
}

/* ================================================================== *
 *  1. pick a bell                                                     *
 * ================================================================== */
const pick = {
  enter(g) {
    g.hud.hideProgress();
    // Portrait cannot hold a whole room; asking it to just pushes the camera
    // into the fog.  Show a tall slice of the shop instead.
    g.rig.setShot(
      { target: V(-0.7, 2.5, 0), w: 3.8, h: 6.4, yaw: 0.10, pitch: 0.12 },
      { target: V(-1.0, 2.5, -0.2), w: 14.0, h: 7.2, yaw: 0.14, pitch: 0.12 },
      true
    );
    audio.ambient(1);
    g.hud.showChoice(
      SHAPE_KEYS.map((k) => ({ svg: bellSvg(k), value: k })),
      (key) => {
        audio.blip(1.2);
        g.makeMold(key);
        g.setStage('core');
      }
    );
  },
  exit(g) { g.hud.hideChoice(); },
  update(g, dt) { getBeacon(g).update(g.clock); },
};

/* ================================================================== *
 *  shared sweep logic for the core and the false bell                 *
 * ================================================================== */
function makeSweepStage({
  icon, hintDelay, profileFn, colsOf, progressOf, refresh, boardColor, sparkFx,
  onDone, topOf, intro, rate = 0.235, excess = 0.20,
}) {
  return {
    enter(g) {
      const S = SHAPES[g.state.shapeKey];
      this.S = S;
      // The board hangs off a pivot so it can also ride OUT along its own
      // radius.  On the first pass the clay still stands proud of the finished
      // profile, and a rigid steel edge parked at the finished radius simply
      // buried itself in the lump -- a tool passing through solid material.
      // Riding out by the remaining excess makes it take successive cuts, the
      // way a turner actually works down to a line.
      this.boardPivot = new THREE.Group();
      this.board = makeSweepBoard((t) => profileFn(S, t) + 0.006, S.height, { color: boardColor });
      this.boardPivot.add(this.board);
      this.boardPivot.add(makeSweepCarriage(S.height, this.board.userData.rMax + excess));
      g.rigMold.group.add(this.boardPivot);
      // how far the raw lump stands proud of the finished profile
      this.excess = excess;
      this.boardOut = excess;

      this.angle = 0;
      this.prevAngle = 0;
      this.spark = 0;
      this.done = false;
      this.sound = 0;
      this.age = 0;
      this.offered = false;
      frameAxis(g, { top: topOf(S), widthScale: 1.35 });
      g.hud.setProgress(0, icon);
      g.hud.setHint('circle', V(0, S.height * 0.55, 0), hintDelay);
      if (intro) intro(g, S);
    },
    exit(g) {
      if (this.boardPivot) g.rigMold.group.remove(this.boardPivot);
      audio.setLoop('scrape', 0);
    },
    resize(g) { frameAxis(g, { top: topOf(this.S), widthScale: 1.35 }); },
    down(g) { g.anchorCircle(_v.set(0, this.S.height * 0.5, 0.0).add(g.rigMold.group.position)); },
    update(g, dt) {
      const S = this.S;
      this.age += dt;
      getBeacon(g).update(g.clock);
      // nobody gets stuck: after a while, offer to finish the sweep for them
      if (!this.offered && !this.done && this.age > 42) {
        this.offered = true;
        g.hud.showNext(true, () => {
          const cols = colsOf(g.rigMold);
          for (let i = 0; i < cols.length; i++) cols[i] = 1;
          refresh(g.rigMold);
          g.hud.showNext(false);
        });
      }
      // keep the gesture anchored even while the camera drifts
      g.anchorCircle(_v.set(0, S.height * 0.5, 0).add(g.rigMold.group.position));

      const input = g.input;
      let speed = 0;
      if (input.active && input.circleCenter) {
        const target = input.circleAngle;
        this.prevAngle = this.angle;
        // follow the finger by the short way round, so crossing the seam is fine
        this.angle += angDelta(this.angle, target);
        speed = Math.abs(this.angle - this.prevAngle) / Math.max(dt, 0.001);
        const cols = colsOf(g.rigMold);
        sweepColumns(this.prevAngle, this.angle, cols.length, (c, frac) => {
          cols[c] = clamp01(cols[c] + rate * frac);
        });
        if (Math.abs(this.angle - this.prevAngle) > 1e-4) {
          refresh(g.rigMold);
          this.spark += Math.abs(this.angle - this.prevAngle);
          if (this.spark > 0.16) {
            this.spark = 0;
            const t = Math.random();
            const r = profileFn(S, t) + 0.05 + Math.random() * 0.14;
            const a = this.angle;
            g.pDust.spawn(sparkFx(
              _v.set(Math.cos(a) * r, t * S.height + g.rigMold.group.position.y, Math.sin(a) * r).clone(),
              {
                x: -Math.sin(a) * 0.8 + (Math.random() - 0.5) * 0.5,
                y: 0.4 + Math.random() * 0.6,
                z: Math.cos(a) * 0.8 + (Math.random() - 0.5) * 0.5,
              }
            ));
          }
        }
      }
      // the board rides the finger, and leans into the clay as it cuts
      this.boardPivot.rotation.y = -this.angle;
      const push = clamp01(speed * 0.35);
      // depth of cut: sit on the clay that is actually there right now
      const cols0 = colsOf(g.rigMold);
      const col = ((Math.round((this.angle / TAU) * cols0.length) % cols0.length) + cols0.length) % cols0.length;
      const want = this.excess * (1 - smoothstep(0, 1, cols0[col])) * 0.9;
      this.boardOut = damp(this.boardOut, want, 9, dt);
      this.board.position.x = this.boardOut;
      this.board.rotation.z = Math.sin(g.clock * 22) * 0.006 * push;

      this.sound = damp(this.sound, input.active ? clamp01(speed * 0.7) : 0, 9, dt);
      audio.scrape(this.sound * 0.9, clamp01(speed / 7));

      const p = progressOf(g.rigMold);
      g.hud.setProgress(p, icon);
      if (p > 0.6) g.hud.suppress();

      if (!this.done && p > 0.965) {
        this.done = true;
        const cols = colsOf(g.rigMold);
        for (let i = 0; i < cols.length; i++) cols[i] = 1;
        refresh(g.rigMold);
        audio.blip(1.4);
        audio.setLoop('scrape', 0);
        this.finishT = 0;
      }
      if (this.done) {
        this.finishT += dt;
        // the board lifts away and the finished form is left standing
        this.board.position.x = this.boardOut + this.finishT * 1.6;
        this.boardPivot.rotation.y -= dt * 0.7;
        if (this.finishT > 0.75) onDone(g);
      }
    },
  };
}

/** walk the angular columns crossed between two board angles */
function sweepColumns(a0, a1, n, cb) {
  const d = a1 - a0;
  if (Math.abs(d) < 1e-6) return;
  const steps = Math.min(96, Math.max(1, Math.ceil(Math.abs(d) / (TAU / n))));
  // full contact needs the board to actually dwell on a column
  const frac = clamp01(Math.abs(d) / (steps * (TAU / n)));
  for (let s = 0; s < steps; s++) {
    const a = a0 + (d * (s + 1)) / steps;
    const c = ((Math.round((a / TAU) * n) % n) + n) % n;
    cb(c, frac);
  }
}

/* ---- 2. the core (芯型) ---- */
const core = makeSweepStage({
  icon: STEP_ICONS.core,
  hintDelay: 1.4,
  profileFn: coreR,
  topOf: (S) => S.height,
  colsOf: (r) => r.coreProgress,
  progressOf: (r) => r.coreDone,
  refresh: (r) => r.refreshCore(),
  boardColor: 0x6b4a30,
  sparkFx: FX.claySpeck,
  excess: 0.21,
  onDone: (g) => g.setStage('falsebell'),
});

/* ---- 3. the false bell (仮鐘) ---- */
const falsebell = makeSweepStage({
  icon: STEP_ICONS.core,
  hintDelay: 1.6,
  profileFn: outerR,
  topOf: (S) => S.height,
  colsOf: (r) => r.falseProgress,
  progressOf: (r) => r.falseDone,
  refresh: (r) => r.refreshFalse(),
  boardColor: 0x7a4630,
  sparkFx: FX.redSpeck,
  rate: 0.32,
  excess: 0.17,
  onDone: (g) => g.setStage('decor'),
  intro: (g, S) => {
    // a fresh skin of clay is thrown over the finished core
    g.rigMold.showFalse();
    audio.clayPat(0.8);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * TAU, t = Math.random();
      g.pDust.spawn(FX.redSpeck(
        V(Math.cos(a) * (outerR(S, t) + 0.1), t * S.height + g.rigMold.group.position.y, Math.sin(a) * (outerR(S, t) + 0.1)),
        { x: Math.cos(a) * 0.5, y: 0.5 + Math.random(), z: Math.sin(a) * 0.5 }
      ));
    }
  },
});

/* ================================================================== *
 *  4. decoration                                                      *
 * ================================================================== */
const decor = {
  enter(g) {
    const S = SHAPES[g.state.shapeKey];
    this.S = S;
    this.selected = null;
    this.dragging = false;
    this.pops = [];
    this.count = 0;
    g.rigMold.decorGroup.visible = true;
    frameAxis(g, { top: S.height, widthScale: 1.08, yaw: 0.14, pitch: 0.12 });
    g.hud.setProgress(0, STEP_ICONS.decor);
    g.hud.setHint('tap', V(0, S.height * 0.55, Math.max(S.rim, 0.8)), 2.0);
    g.hud.showTray(DECOR_KEYS, (key, e, btn) => this._pick(g, key, e, btn));
    this._onMove = (e) => this._drag(g, e);
    this._onUp = (e) => this._drop(g, e);
    window.addEventListener('pointermove', this._onMove, { passive: false });
    window.addEventListener('pointerup', this._onUp, { passive: false });
    window.addEventListener('pointercancel', this._onUp, { passive: false });
  },
  exit(g) {
    g.hud.hideTray();
    g.hud.hideGhost();
    if (this._sleeve) { g.rigMold.group.remove(this._sleeve); this._sleeve.geometry.dispose(); this._sleeve = null; }
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onUp);
  },
  resize(g) { frameAxis(g, { top: this.S.height, widthScale: 1.08, yaw: 0.14, pitch: 0.12 }); },

  _pick(g, key, e, btn) {
    audio.unlock();
    audio.blip(1.5);
    this.selected = key;
    this.dragging = true;
    this._btn = btn;
    for (const c of g.hud.tray.children) c.style.outline = '';
    btn.style.outline = '3px solid rgba(255,225,160,.95)';
    g.hud.showGhost(key, e.clientX, e.clientY);
    g.hud.poke();
  },
  _drag(g, e) {
    if (!this.dragging) return;
    g.hud.moveGhost(e.clientX, e.clientY);
    e.preventDefault();
  },
  _drop(g, e) {
    if (!this.dragging) return;
    this.dragging = false;
    g.hud.hideGhost();
    const p = this._aimAt(g, e.clientX, e.clientY);
    if (p) this._place(g, p);
    // if they missed entirely, the chip stays selected -- they can tap the bell
  },

  /** tapping the bell places whatever is currently selected */
  tap(g) {
    if (!this.selected) return;
    const p = this._aimAt(g, g.input.x, g.input.y);
    if (p) this._place(g, p);
  },

  /**
   * Where on the bell did they mean?  The clay surface first; failing that a
   * generous invisible sleeve around it, so a small hand that lands beside the
   * bell still gets a decoration instead of nothing.
   */
  _aimAt(g, x, y) {
    const rm = g.rigMold;
    const hit = g.hitAt(x, y, [rm.falseMesh]);
    if (hit) return hit.point;
    if (!this._sleeve) {
      const S = this.S;
      const geo = new THREE.CylinderGeometry(S.rim * 1.5, S.rim * 1.7, S.height * 1.25, 16, 1, true);
      geo.translate(0, S.height * 0.5, 0);
      this._sleeve = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
      rm.group.add(this._sleeve);
    }
    const soft = g.hitAt(x, y, [this._sleeve]);
    if (!soft) return null;
    // pull the loose hit back onto the real surface
    const local = _v.copy(soft.point).sub(rm.group.position);
    const theta = Math.atan2(local.z, local.x);
    const t = clamp(local.y / this.S.height, this.S.decorBand[0], this.S.decorBand[1]);
    const r = outerR(this.S, t);
    return _v2.set(Math.cos(theta) * r, t * this.S.height, Math.sin(theta) * r).add(rm.group.position).clone();
  },

  _place(g, worldPoint) {
    const S = this.S;
    const rm = g.rigMold;
    const local = _v.copy(worldPoint).sub(rm.group.position);
    const theta = Math.atan2(local.z, local.x);
    const band = S.decorBand;
    const t = clamp(local.y / S.height, band[0], band[1]);
    const size = 0.19 + Math.random() * 0.05;
    const rec = rm.addDecoration(this.selected, theta, t, size);
    rec.mesh.scale.setScalar(0.001);
    this.pops.push({ mesh: rec.mesh, t: 0, size });
    this.count++;
    g.state.decorCount = this.count;
    audio.clayPat(1.3);
    audio.blip(0.9 + Math.random() * 0.4);
    // clay squeezing out from under the relief
    for (let i = 0; i < 8; i++) {
      g.pDust.spawn(FX.redSpeck(worldPoint.clone(), {
        x: (Math.random() - 0.5) * 0.9, y: 0.3 + Math.random() * 0.5, z: (Math.random() - 0.5) * 0.9,
      }));
    }
    g.hud.suppress();
    g.hud.setProgress(clamp01(this.count / 5), STEP_ICONS.decor);
    if (this.count >= 2) g.hud.showNext(true, () => g.setStage('mold'));
    if (this.count >= 10) g.setStage('mold');
  },

  update(g, dt) {
    getBeacon(g).update(g.clock);
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.t += dt * 3.4;
      if (p.t >= 1) { p.mesh.scale.setScalar(p.size); this.pops.splice(i, 1); continue; }
      // overshoot then settle: it should feel pressed into the clay
      const k = 1 + Math.sin(p.t * Math.PI) * 0.35;
      p.mesh.scale.setScalar(p.size * k * smoothstep(0, 0.5, p.t));
    }
  },
};

/* ================================================================== *
 *  5. the outer mould                                                 *
 * ================================================================== */
const mold = {
  enter(g) {
    const S = SHAPES[g.state.shapeKey];
    this.S = S;
    this.H = moldHeight(S);
    g.rigMold.buildMold();
    this.brush = makeBrush();
    this.brush.visible = false;
    g.scene.add(this.brush);
    this.autofill = 0;
    this.fitting = 0;
    this.cupLanded = false;
    this.done = false;
    this.painted = 0;
    this.sound = 0;
    this.spin = 0;
    frameAxis(g, { top: this.H, widthScale: 1.02, pitch: 0.16, radius: moldR(this.S, 0.08) });
    g.hud.setProgress(0, STEP_ICONS.mold);
    g.hud.setHint('paint', V(0, this.H * 0.5, Math.max(S.rim, 0.8) + 0.3), 1.8);
  },
  exit(g) {
    g.scene.remove(this.brush);
    audio.setLoop('brush', 0);
  },
  resize(g) { frameAxis(g, { top: this.H, widthScale: 1.02, pitch: 0.16, radius: moldR(this.S, 0.08) }); },

  down(g) { this.prevTheta = null; this.prevU = null; },
  up(g) { this.brush.visible = false; this.prevTheta = null; },

  update(g, dt) {
    const rm = g.rigMold, S = this.S;
    getBeacon(g).update(g.clock);
    let painting = 0;

    // Turn the table.  Without this the far side of the flask is unreachable
    // and the child could never finish -- and watching it come round is half
    // the pleasure of the job anyway.
    if (!this.done) {
      this.spin += dt * 0.34;
      rm.group.rotation.y = this.spin;
      g.world.plinth.rotation.y = this.spin;
    }

    if (!this.done && g.input.active) {
      const hit = g.hit([rm.paintProxy]);
      if (hit) {
        // into the flask's own frame, so the turntable does not smear the daub
        const local = rm.group.worldToLocal(_v.copy(hit.point));
        const theta = (Math.atan2(local.z, local.x) + TAU) % TAU;
        const u = clamp01(local.y / this.H);
        // Lay a band along the path since the last frame; a child's swipe is
        // fast and should never leave holes behind the brush.
        const amt = Math.min(0.55, dt * 7.0 + 0.10);
        const added = this.prevTheta == null
          ? rm.paintMold(theta, u, 0.62, amt)
          : rm.paintMoldPath(this.prevTheta, this.prevU, theta, u, 0.62, amt);
        this.prevTheta = theta; this.prevU = u;
        if (added > 0.0004) {
          rm.refreshMold();
          painting = clamp01(added * 6);
          this.painted += added;
          // mud flicking off the bristles
          if (Math.random() < 0.6) {
            g.pDust.spawn(FX.mudSpeck(hit.point.clone(), {
              x: (Math.random() - 0.5) * 1.1, y: 0.2 + Math.random() * 0.7, z: (Math.random() - 0.5) * 1.1,
            }));
          }
        }
        // stand the brush on the surface, tilted the way a hand would hold it
        this.brush.visible = true;
        _v2.copy(hit.face.normal).transformDirection(rm.paintProxy.matrixWorld);
        this.brush.position.copy(hit.point).addScaledVector(_v2, 0.09);
        this.brush.quaternion.setFromUnitVectors(V(0, -1, 0), _v2);
        this.brush.rotateY(g.clock * 2.0);
        this.lastHit = hit.point.clone();
      } else {
        this.brush.visible = false;
        this.prevTheta = null;
      }
    } else if (!g.input.active) {
      this.brush.visible = false;
    }

    this.sound = damp(this.sound, painting, 10, dt);
    audio.brush(this.sound);

    const p = rm.moldDone;
    g.hud.setProgress(clamp01(p / 0.55), STEP_ICONS.mold);
    if (p > 0.2) g.hud.suppress();
    if (!this.done && !this._offered && p > 0.26) {
      this._offered = true;
      g.hud.showNext(true, () => { this.done = true; g.hud.showNext(false); });
    }

    if (!this.done && p > 0.55) {
      this.done = true;
      audio.blip(1.3);
      audio.setLoop('brush', 0);
      this.brush.visible = false;
    }
    if (this.done) {
      // close up whatever the child missed, so nobody has to be thorough
      this.autofill += dt;
      if (rm.fillMold(dt * 1.6)) rm.refreshMold();
      else if (this.autofill > 0.6) {
        // The banding hoops and the pouring cup used to blink into existence.
        // Things do not appear in a workshop; somebody puts them there.  So
        // they drop down over the flask, lowest first, and each one lands.
        rm.hideInnards();
        if (!this.fitting) {
          this.fitting = 0;
          rm.sprueCup.visible = true;
          for (const h of rm.hoops) { h.visible = true; h.userData.restY = h.position.y; }
          this.cupRestY = rm.sprueCup.position.y;
        }
        this.fitting += dt;
        const F = this.fitting;
        let allDown = true;
        rm.hoops.forEach((h, i) => {
          const k = clamp01((F - i * 0.26) / 0.34);
          h.position.y = h.userData.restY + (1 - k * k) * 1.9;
          h.visible = k > 0;
          if (k < 1) allDown = false;
          if (k >= 1 && !h.userData.landed) { h.userData.landed = true; audio.clank(0.55 + i * 0.12); }
        });
        const ck = clamp01((F - 0.85) / 0.35);
        rm.sprueCup.position.y = this.cupRestY + (1 - ck * ck) * 1.4;
        if (ck < 1) allDown = false;
        else if (!this.cupLanded) { this.cupLanded = true; audio.clayPat(0.7); }
        if (allDown) g.setStage('bake');
      }
    }
  },
};

/* ================================================================== *
 *  6. burn-out: dry the flask and take the false bell away            *
 * ================================================================== */
const bake = {
  enter(g) {
    const S = SHAPES[g.state.shapeKey];
    this.S = S;
    this.H = moldHeight(S);
    this.t = 0;
    this.xray = false;
    const rm = g.rigMold;
    rm.setMoldFill(-1, 0);
    frameAxis(g, { top: this.H, widthScale: 1.0, pitch: 0.15, radius: moldR(S, 0.08) });
    g.hud.setProgress(0, STEP_ICONS.fire);
    g.hud.setHint('wait', null, 99);
    audio.furnace(0.35);
    // fire under the flask
    this.light = new THREE.PointLight(0xff8a3a, 0, 9, 2);
    this.light.position.set(0, 0.5, 0);
    g.scene.add(this.light);
  },
  exit(g) {
    g.scene.remove(this.light);
    const rm = g.rigMold;
    rm.moldMat.transparent = false;
    rm.moldMat.opacity = 1;
    rm.moldMat.depthWrite = true;
    rm.moldMat.needsUpdate = true;
    rm.falseMesh.visible = false;
    rm.decorGroup.visible = false;
    rm.falseMesh.material.emissive.setRGB(0, 0, 0);
    rm.decorMat.emissive.setRGB(0, 0, 0);
    audio.setLoop('furnace', 0);
  },
  resize(g) { frameAxis(g, { top: this.H, widthScale: 1.0, pitch: 0.15, radius: moldR(this.S, 0.08) }); },

  update(g, dt) {
    const rm = g.rigMold, S = this.S;
    this.t += dt;
    const T = this.t;
    g.hud.setProgress(clamp01(T / 5.2), STEP_ICONS.fire);

    // steam and smoke leaving the drying earth
    if (Math.random() < dt * 26) {
      const a = Math.random() * TAU, u = Math.random();
      const r = moldR(S, u) + 0.03;
      g.pDust.spawn(FX.steam(
        V(Math.cos(a) * r, u * this.H + rm.group.position.y, Math.sin(a) * r),
        { x: Math.cos(a) * 0.1, y: 0.5 + Math.random() * 0.4, z: Math.sin(a) * 0.1 }
      ));
    }
    this.light.intensity = 3.2 * Math.exp(-Math.abs(T - 1.6) * 0.9) * (0.85 + Math.sin(T * 12) * 0.15);
    rm.setMoldDry(smoothstep(2.6, 5.0, T));

    // --- the x-ray beat: show the false bell burning out of the cavity ---
    if (!this.xray && T > 1.2) {
      this.xray = true;
      rm.moldMat.transparent = true;
      rm.moldMat.depthWrite = false;
      rm.moldMat.needsUpdate = true;
      rm.falseMesh.visible = true;
      rm.decorGroup.visible = true;
      rm.falseMesh.material.transparent = true;
      rm.decorMat.transparent = true;
      audio.dustPuff();
    }
    if (this.xray) {
      const k = smoothstep(1.2, 2.0, T) * (1 - smoothstep(3.2, 4.1, T));
      rm.moldMat.opacity = lerp(1, 0.22, k);
      // The false bell has to be unmistakable inside the flask, or the whole
      // point of this beat -- "the red bell burns away and leaves a hole" --
      // is lost.  So it lights up the moment the flask turns see-through.
      const burn = smoothstep(2.1, 3.5, T);
      const op = 1 - burn;
      rm.falseMesh.material.opacity = op;
      rm.decorMat.opacity = op;
      const glow = smoothstep(1.2, 2.1, T) * (1 - smoothstep(3.0, 3.5, T)) * 1.7;
      rm.falseMesh.material.emissive.setRGB(glow * 1.0, glow * 0.30, glow * 0.06);
      rm.decorMat.emissive.copy(rm.falseMesh.material.emissive);
      const shrink = 1 - burn * 0.07;
      rm.falseMesh.scale.setScalar(shrink);
      rm.decorGroup.scale.setScalar(shrink);
      if (burn > 0.02 && burn < 0.98 && Math.random() < dt * 34) {
        const a = Math.random() * TAU, t = Math.random();
        const r = outerR(S, t);
        g.pDust.spawn(FX.smoke(
          V(Math.cos(a) * r, t * S.height + rm.group.position.y, Math.sin(a) * r),
          { x: 0, y: 0.8, z: 0 }
        ));
      }
      if (T > 3.5) {
        rm.falseMesh.visible = false; rm.decorGroup.visible = false;
        rm.falseMesh.scale.setScalar(1); rm.decorGroup.scale.setScalar(1);
      }
    }

    if (T > 5.2) {
      audio.blip(0.8);
      g.setStage('furnace');
    }
  },
};

/* ================================================================== *
 *  7. the furnace                                                     *
 * ================================================================== */
const furnace = {
  enter(g) {
    const W = g.world;
    this.step = 'gear';     // gear -> metal -> door -> ignite -> melt
    this.gearIdx = 0;
    this.doorK = 0;
    this.doorV = 0;
    this.meltT = 0;
    this.ingots = [];
    this._walking2 = false;
    this._backAtPost = false;
    this.fire = 0;
    g.hud.setProgress(0, STEP_ICONS.fire);
    this._shot(g);

    // He walks to his post rather than appearing at it, and stands beside the
    // hearth, never in front of it -- he must not hide the mouth, the ingots
    // or the safety door.
    founderWalkTo(W, -4.95, 1.05, -3.85, -1.0);
    founderLook(W, -3.4, 1.9, -1.0);

    if (!W.igniteLever) {
      const grp = new THREE.Group();
      const iron = new THREE.MeshStandardMaterial({ color: 0x3b3630, roughness: 0.6, metalness: 0.85 });
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.24), iron);
      grp.add(base);
      const arm = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.72, 8), iron);
      shaft.position.y = 0.36; arm.add(shaft);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10),
        new THREE.MeshStandardMaterial({ color: 0xb03a22, roughness: 0.5 }));
      knob.position.y = 0.74; arm.add(knob);
      grp.add(arm);
      grp.position.set(1.52, 2.15, 1.36);
      grp.userData.arm = arm;
      grp.userData.knob = knob;
      W.furnace.add(grp);
      W.igniteLever = grp;
    }
    W.igniteLever.userData.arm.rotation.z = 0;
    this._aim(g);
  },
  exit(g) { getBeacon(g).hide(); },
  resize(g) { this._shot(g); },

  _shot(g) {
    g.rig.setShot(
      // Straight down the room at the hearth.  Standing square to the mouth
      // (yaw 0.34, matching the furnace's own rotation) puts the ladle jib's
      // mast exactly between the camera and the fire, and a post through the
      // middle of the shot costs more than a slightly glancing angle does.
      { target: V(-3.55, 1.80, -0.35), w: 3.6, h: 4.6, yaw: 0.06, pitch: 0.07 },
      { target: V(-2.4, 2.10, -0.8), w: 10.0, h: 5.4, yaw: 0.14, pitch: 0.10 }
    );
  },

  /** put the beacon and the gesture hint on whatever is next */
  _aim(g) {
    const W = g.world, B = getBeacon(g);
    if (this.step === 'gear') {
      W.founder.getWorldPosition(_v); _v.y += 1.55;
      B.show(_v, 1.5);
      g.hud.setHint('tap', _v.clone(), 1.4);
    } else if (this.step === 'metal') {
      B.hide();
      g.hud.setHint('tap', this.ingots.length ? this.ingots[1].position.clone().setY(0.6) : null, 1.4);
    } else if (this.step === 'door') {
      W.door.getWorldPosition(_v);
      B.show(_v, 1.15);
      g.hud.setHint('dragSide', _v.clone(), 1.2);
    } else if (this.step === 'ignite') {
      W.igniteLever.userData.knob.getWorldPosition(_v);
      B.show(_v, 1.1);
      g.hud.setHint('tap', _v.clone(), 1.2);
    } else {
      B.hide();
      g.hud.clearHint();
    }
  },

  _spawnIngots(g) {
    const W = g.world;
    METAL_KEYS.forEach((k, i) => {
      const ing = makeIngot(k);
      const a = -0.5 + i * 0.5;
      ing.position.set(-4.25 + i * 0.55, 0.14, 1.60 - i * 0.14);
      ing.rotation.y = a;
      ing.userData.metal = k;
      ing.userData.home = ing.position.clone();
      g.scene.add(ing);
      this.ingots.push(ing);
    });
  },

  tap(g) {
    const W = g.world;
    if (this.step === 'gear') {
      const order = ['apron', 'gloves', 'helmet'];
      const k = order[this.gearIdx];
      for (const m of W.gear[k]) m.visible = true;
      // he pulls it on: arms up for the helmet, down for the apron and gloves
      founderReach(W, k === 'helmet' ? 1.0 : 0.45);
      setTimeout(() => { if (g.stageName === 'furnace') founderReach(W, 0); }, 620);
      audio.clayPat(0.6); audio.blip(0.8 + this.gearIdx * 0.15);
      this.gearIdx++;
      g.hud.poke();
      if (this.gearIdx >= order.length) {
        this.step = 'metal';
        this._spawnIngots(g);
        audio.clank(1.2);
      }
      this._aim(g);
      return;
    }
    if (this.step === 'metal') {
      let obj = null;
      const hit = g.hit(this.ingots, true);
      if (hit) {
        obj = hit.object;
        while (obj && !obj.userData.metal) obj = obj.parent;
      }
      if (!obj) {
        // small hands miss small ingots: take whichever one they aimed nearest
        let best = 1e9;
        for (const ing of this.ingots) {
          if (ing.userData.fade != null) continue;
          const s2 = g.screen(ing.position, {});
          const d = Math.hypot(s2.x - g.input.x, s2.y - g.input.y);
          if (d < best && d < 170) { best = d; obj = ing; }
        }
      }
      if (!obj) return;
      g.state.metal = obj.userData.metal;
      this.chosen = obj;
      this.step = 'carry';
      this.carryT = 0;
      audio.clank(1.0);
      // the others are put away
      for (const i of this.ingots) if (i !== obj) i.userData.fade = 0;
      this._aim(g);
      return;
    }
    if (this.step === 'ignite') {
      this.step = 'melt';
      audio.ratchet();
      audio.clank(0.7);
      audio.furnace(1);
      g.shake(0.4);
      this._aim(g);
    }
  },

  move(g, i) {
    if (this.step !== 'door') return;
    // The hand pushes the door; it does not teleport it.  A steel shutter on
    // rails takes a moment to get going and keeps rolling when you stop, so
    // the drag adds VELOCITY and the door carries it.  Precision is still not
    // required: any rightward travel at all counts.
    if (i.dx > 0) this.doorV += i.dx * 0.0075;
  },

  update(g, dt) {
    const W = g.world;
    getBeacon(g).update(g.clock);

    // ingots being cleared away / carried into the hearth
    for (let n = this.ingots.length - 1; n >= 0; n--) {
      const ing = this.ingots[n];
      if (ing.userData.fade != null) {
        ing.userData.fade += dt * 1.8;
        ing.position.y = ing.userData.home.y - ing.userData.fade * 0.5;
        ing.scale.setScalar(Math.max(0.001, 1 - ing.userData.fade));
        if (ing.userData.fade > 1) { g.scene.remove(ing); this.ingots.splice(n, 1); }
      }
    }

    if (this.step === 'carry') {
      // Somebody has to carry the metal.  It used to fly to the furnace on its
      // own, spinning, which is the sort of thing that quietly tells a player
      // that nothing in the room has weight or an owner.
      this.carryT += dt;
      const T = this.carryT;
      const from = this.chosen.userData.home;
      W.crucible.getWorldPosition(this._crucible ??= new THREE.Vector3());
      const drop = this._crucible.clone(); drop.y += 0.55;

      if (T < 1.05) {                         // walking over, bending down
        founderReach(W, smoothstep(0.55, 1.05, T) * 0.75);
      } else if (T < 1.5) {                   // lifting it
        founderReach(W, 0.75);
        const k = smoothstep(0, 1, (T - 1.05) / 0.45);
        W.rig.arms[1].hand.getWorldPosition(_v);
        this.chosen.position.lerpVectors(from, _v, k);
      } else if (T < 2.9) {                   // carrying it to the hearth
        if (!this._walking2) {
          this._walking2 = true;
          founderWalkTo(W, -4.75, 0.35, W.furnace.position.x, W.furnace.position.z, 0.95);
          founderLook(W, this._crucible.x, this._crucible.y + 0.4, this._crucible.z);
        }
        founderReach(W, 0.62);
        W.rig.arms[1].hand.getWorldPosition(this.chosen.position);
        this.chosen.position.y += 0.05;
      } else if (T < 3.5) {                   // reaching in and letting go
        founderReach(W, 0.95);
        const k = smoothstep(0, 1, (T - 2.9) / 0.6);
        W.rig.arms[1].hand.getWorldPosition(_v);
        this.chosen.position.lerpVectors(_v, drop, k);
        if (k >= 1 && this.chosen.visible) {
          this.chosen.visible = false;
          audio.clank(0.9);
          W.crucibleMelt.visible = false;
        }
      } else {
        founderReach(W, 0);
        if (!this._backAtPost) {
          this._backAtPost = true;
          founderWalkTo(W, -4.95, 1.05, -3.85, -1.0);
        }
        if (T > 4.4) {
          g.scene.remove(this.chosen);
          this.ingots = this.ingots.filter((i) => i !== this.chosen);
          this.step = 'door';
          founderLook(W, W.door.getWorldPosition(_v).x, _v.y, _v.z);
          this._aim(g);
        }
      }
    }

    if (this.step === 'melt') {
      this.meltT += dt;
      const k = clamp01(this.meltT / 3.4);
      this.fire = k;
      const M = METALS[g.state.metal];
      W.furnaceGlowMat.opacity = 0.55 * k;
      W.furnaceGlowMat.color.setHex(M.molten);
      W.hearthMat.color.setRGB(0.08 + k * 0.9, 0.03 + k * 0.34, 0.02 + k * 0.08);
      W.fireLight.intensity = 22 * k * (0.88 + Math.sin(g.clock * 7.3) * 0.07 + Math.sin(g.clock * 3.1) * 0.05);
      W.fireLight.color.setHex(M.molten);
      W.crucibleMelt.visible = k > 0.35;
      W.crucibleMelt.material.color.setHex(M.molten);
      W.crucibleMelt.material.color.multiplyScalar(0.4 + k * 0.6);
      // the shut door is all the player can see, so let it come up to heat
      const flick = 0.86 + Math.sin(g.clock * 5.1) * 0.09 + Math.sin(g.clock * 2.3) * 0.05;
      W.doorMat.emissive.setRGB(0.85 * k * flick, 0.20 * k * flick, 0.03 * k * flick);
      W.doorMat.emissiveIntensity = 1.4;
      if (Math.random() < dt * 30 * k) {
        W.chimneyPos = W.chimneyPos || V(-3.85, 6.5, -2.4);
        g.pDust.spawn(FX.smoke(W.chimneyPos.clone().add(V((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4)),
          { x: 0.2, y: 1.2 + Math.random(), z: 0 }));
      }
      if (Math.random() < dt * 26 * k) {
        // embers streaming up past the door seams
        g.pGlow.spawn(FX.emberFloat(V(-3.6 + (Math.random() - 0.5) * 1.3, 2.9, 0.1 + (Math.random() - 0.5) * 0.5),
          { x: 0.1 + Math.random() * 0.4, y: 1.2 + Math.random() * 0.8, z: 0.3 }));
      }
      if (Math.random() < dt * 16 * k) {
        g.pGlow.spawn(FX.spark(V(-3.55 + (Math.random() - 0.5) * 1.2, 1.2, 0.35),
          { x: (Math.random() - 0.5) * 1.2, y: 0.9 + Math.random() * 1.4, z: 0.6 }));
      }
      g.hud.setProgress(k, STEP_ICONS.fire);
      if (this.meltT > 3.9) g.setStage('pour');
    } else {
      const steps = { gear: 0, metal: 1, carry: 1.5, door: 2, ignite: 2.7 };
      g.hud.setProgress((steps[this.step] ?? 0) / 4 + (this.step === 'gear' ? this.gearIdx / 12 : 0), STEP_ICONS.fire);
      if (this.step === 'door') {
        // The shutter rolls: rail friction bleeds the speed the hand gave it,
        // and it clunks home against the jamb rather than arriving silently.
        this.doorV = Math.max(0, this.doorV - dt * (0.55 + this.doorV * 1.6));
        if (this.doorV > 0) {
          this.doorK = clamp01(this.doorK + this.doorV * dt);
          W.door.position.x = lerp(W.doorOpenX, W.doorShutX, this.doorK);
          if (!this._slideSnd || g.clock - this._slideSnd > 0.5) {
            this._slideSnd = g.clock;
            audio.doorSlide(clamp01(this.doorV));
          }
          if (this.doorK >= 0.999) {
            audio.clank(1.2);
            g.shake(0.12);
            this.doorV = 0;
            this.step = 'ignite';
            W.igniteLever.userData.knob.getWorldPosition(_v2);
            founderLook(W, _v2.x, _v2.y, _v2.z);
            this._aim(g);
          }
        }
        W.door.getWorldPosition(_v);
        getBeacon(g).show(_v, 1.15);
      }
    }
  },
};

/* ================================================================== *
 *  8. pouring                                                         *
 * ================================================================== */
const pour = {
  enter(g) {
    const S = SHAPES[g.state.shapeKey], W = g.world;
    this.S = S;
    this.H = moldHeight(S);
    this.cupY = this.H + 0.30 + g.rigMold.group.position.y;
    this.swing = 0;
    this.pull = 0;
    this.tilt = 0;
    this.flow = 0;
    this.fill = 0;
    this.grabbed = false;
    this.finish = -1;
    this.ladleLeft = 1;
    this._q = new THREE.Quaternion();
    this._flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    this._lip = new THREE.Vector3();
    this.age = 0;
    this._offered = false;

    W.ladleRig.rotation.y = LADLE_PARK;
    W.ladleMelt.visible = true;
    W.ladleMelt.material.color.setHex(METALS[g.state.metal].molten);
    W.lever.rotation.z = 0;

    this.streamMat = moltenMaterial(g.state.metal);
    this.stream = new Stream(this.streamMat);
    g.scene.add(this.stream.mesh);

    // the bloom of heat where the metal goes in -- the pour needs a glare of
    // its own, not just a light, or it reads as coloured water
    this.glowMat = new THREE.SpriteMaterial({
      map: makeDotTexture(0.5, 128), color: METALS[g.state.metal].molten,
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false, fog: false,
    });
    this.glow = new THREE.Sprite(this.glowMat);
    this.glow.renderOrder = 6;
    g.scene.add(this.glow);

    g.rigMold.setMoldFill(-1, 0);
    g.rigMold.sprueMelt.material.color.setHex(METALS[g.state.metal].molten);

    // he stands clear of the stream and watches the cup, as anyone would
    founderWalkTo(W, -2.6, 2.15, 0, 0);
    founderLook(W, 0, this.cupY, 0);

    this._shot(g);
    g.hud.setProgress(0, STEP_ICONS.pour);
    W.leverKnob.getWorldPosition(_v);
    g.hud.setHint('dragDown', _v.clone(), 1.6);
    audio.furnace(0.55);
  },
  exit(g) {
    g.scene.remove(this.stream.mesh);
    g.scene.remove(this.glow);
    this.glowMat.map.dispose(); this.glowMat.dispose();
    this.stream.geo.dispose();
    this.streamMat.dispose();
    g.world.ladleMelt.visible = false;
    audio.setLoop('pour', 0);
    g.world.pourLight.intensity = 0;
  },
  resize(g) { this._shot(g); },

  _shot(g) {
    const top = this.cupY + 1.5;
    g.rig.setShot(
      { target: V(-0.15, top * 0.52, 0.1), w: 4.4, h: top * 1.02, yaw: 0.12, pitch: 0.10 },
      { target: V(-0.5, top * 0.5, 0), w: 9.0, h: top * 0.98, yaw: 0.02, pitch: 0.08 }
    );
  },

  down(g) { this.grabbed = true; this.grabY = g.input.y; },
  up(g) { this.grabbed = false; },

  update(g, dt) {
    const W = g.world, S = this.S, rm = g.rigMold;
    this.age += dt;
    getBeacon(g).update(g.clock);
    if (!this._offered && this.age > 40 && this.fill < 0.2) {
      this._offered = true;
      g.hud.showNext(true, () => { this.fill = 1; g.hud.showNext(false); });
    }

    // the ladle swings across from the furnace before anything can happen
    this.swing = Math.min(1, this.swing + dt / 1.8);
    W.ladleRig.rotation.y = lerp(LADLE_PARK, 0, smoothstep(0, 1, this.swing));
    if (this.swing < 1) { audio.chain(0.2); } else audio.chain(0);

    // ---- the lever: hold and drag down, let go and it springs back ----
    if (this.grabbed && this.swing >= 1 && this.finish < 0) {
      const dy = g.input.y - this.grabY;
      this.pull = clamp01(dy / (g._h * 0.24));
    } else {
      this.pull = damp(this.pull, 0, 4.2, dt);
    }
    W.lever.rotation.z = -this.pull * 1.05;
    // the ladle is heavy and the linkage is geared: it follows the lever, but
    // it takes its time, and it comes back slower than it goes over
    const tiltTarget = this.pull * 1.30;
    this.tilt = damp(this.tilt, tiltTarget, tiltTarget > this.tilt ? 4.2 : 2.6, dt);
    W.ladle.rotation.z = -this.tilt;

    // Molten metal stays level however far the ladle is tipped: cancel the
    // parent's rotation instead of guessing an Euler order.
    const melt = W.ladleMelt;
    W.ladle.getWorldQuaternion(this._q).invert();
    melt.quaternion.copy(this._q).multiply(this._flat);
    melt.position.set(Math.sin(this.tilt) * 0.30, -0.10 - (1 - this.ladleLeft) * 0.34, 0);
    melt.scale.setScalar(clamp(0.35 + this.ladleLeft * 0.65, 0.2, 1));

    // ---- flow ----
    const targetFlow = this.finish >= 0 ? 0
      : smoothstep(0.30, 0.95, this.tilt) * clamp01(this.ladleLeft * 4);
    this.flow = damp(this.flow, targetFlow, 9, dt);

    const lipW = W.ladleLip.getWorldPosition(this._lip);
    const cup = _v2.set(0, this.cupY, 0);

    if (this.flow > 0.02) {
      this.stream.mesh.visible = true;
      const r0 = 0.050 + this.flow * 0.095;
      const r1 = 0.040 + this.flow * 0.070;
      this.stream.update(lipW, cup, r0, r1, 1, g.clock);
      this.streamMat.userData.uniforms.uTime.value = g.clock;

      this.fill = clamp01(this.fill + dt * this.flow * 0.30);
      this.ladleLeft = clamp01(this.ladleLeft - dt * this.flow * 0.26);

      // impact: sparks, smoke, and light thrown onto the flask
      W.pourLight.position.set(0, this.cupY - 0.1, 0.35);
      W.pourLight.intensity = 16 * this.flow;
      W.pourLight.color.setHex(METALS[g.state.metal].molten);
      if (Math.random() < dt * 90 * this.flow) {
        g.pGlow.spawn(FX.spark(cup.clone().add(V((Math.random() - 0.5) * 0.2, 0.04, (Math.random() - 0.5) * 0.2)), {
          x: (Math.random() - 0.5) * 2.4, y: 0.8 + Math.random() * 2.4, z: (Math.random() - 0.5) * 2.4,
        }));
      }
      if (Math.random() < dt * 26 * this.flow) {
        g.pDust.spawn(FX.smoke(cup.clone().add(V(0, 0.12, 0)), { x: (Math.random() - 0.5) * 0.4, y: 1.1, z: (Math.random() - 0.5) * 0.4 }));
      }
      if (Math.random() < dt * 14 * this.flow) {
        g.pGlow.spawn(FX.emberFloat(cup.clone(), { x: (Math.random() - 0.5) * 1.1, y: 1.3 + Math.random(), z: (Math.random() - 0.5) * 1.1 }));
      }
      audio.pour(clamp01(this.flow * 1.2), this.flow);
      this.glow.position.copy(cup).setY(this.cupY + 0.06);
      const pulse = 1 + Math.sin(g.clock * 8.3) * 0.06 + Math.sin(g.clock * 3.7) * 0.04;
      this.glow.scale.setScalar((0.85 + this.flow * 0.85) * pulse);
      this.glowMat.opacity = 0.34 * this.flow;
    } else {
      this.stream.mesh.visible = false;
      W.pourLight.intensity = damp(W.pourLight.intensity, 0, 4, dt);
      this.glowMat.opacity = Math.max(0, this.glowMat.opacity - dt * 1.4);
      audio.pour(0, 0);
    }

    // ---- what the player can actually see of the fill ----
    const fillY = this.fill * this.H;
    rm.setMoldFill(fillY, clamp01(this.fill * 0.9 + this.flow * 0.2) * 0.85);
    rm.sprueMelt.visible = this.fill > 0.965;
    if (rm.sprueMelt.visible) {
      rm.sprueMelt.position.y = this.H + 0.02 + (this.fill - 0.965) * 6.0;
    }
    g.hud.setProgress(this.fill, STEP_ICONS.pour);
    if (this.fill > 0.12) g.hud.suppress();

    if (this.fill >= 1 && this.finish < 0) {
      this.finish = 0;
      audio.blip(0.7);
    }
    if (this.finish >= 0) {
      this.finish += dt;
      if (this.finish > 1.6) g.setStage('cool');
    }
  },
};

/* ================================================================== *
 *  9. cooling                                                         *
 * ================================================================== */
const cool = {
  enter(g) {
    const S = SHAPES[g.state.shapeKey];
    this.S = S;
    this.H = moldHeight(S);
    this.t = 0;
    this.DUR = 5.5;
    // the bell now exists -- sealed inside the flask, where nobody can see it
    g.rigMold.buildBell(g.state.metal);
    g.rigMold.setBellHeat(1);
    this.park = 0;
    frameAxis(g, { top: this.H, widthScale: 1.0, pitch: 0.15, radius: moldR(S, 0.08) });
    g.hud.setProgress(0, STEP_ICONS.cool);
    g.hud.setHint('wait', null, 99);
    audio.furnace(0.18);
  },
  exit(g) { audio.setLoop('furnace', 0); },
  resize(g) { frameAxis(g, { top: this.H, widthScale: 1.0, pitch: 0.15, radius: moldR(this.S, 0.08) }); },

  update(g, dt) {
    const rm = g.rigMold, S = this.S;
    this.t += dt;
    const k = clamp01(this.t / this.DUR);
    // orange -> dark metal, slowly, the way real bronze lets go of its heat
    const heat = Math.pow(1 - k, 1.7);
    rm.setMoldFill(this.H, heat);
    rm.setBellHeat(heat);
    const c = new THREE.Color(METALS[g.state.metal].molten);
    c.multiplyScalar(0.25 + heat * 0.75);
    rm.sprueMelt.material.color.copy(c);
    // swing the empty ladle back to the furnace so it is not hanging over the
    // flask when the mould comes off
    this.park = Math.min(1, this.park + dt / 2.2);
    g.world.ladleRig.rotation.y = smoothstep(0, 1, this.park) * LADLE_PARK;
    g.world.ladle.rotation.z = lerp(g.world.ladle.rotation.z, 0, 1 - Math.exp(-2 * dt));
    // Heat spilling out onto the sand around the pit.  Aimed at the ground,
    // not at the flask: a lamp pointed at the shell would read as a spotlight,
    // when the whole point is that the glow is coming from inside.
    g.world.pourLight.position.set(0, 0.35, 0);
    g.world.pourLight.intensity = 9 * heat;
    g.world.pourLight.color.setHex(METALS[g.state.metal].molten);

    if (Math.random() < dt * 20 * (0.3 + heat)) {
      const a = Math.random() * TAU, u = Math.random() * 0.9;
      const r = moldR(S, u) + 0.03;
      g.pDust.spawn(FX.steam(
        V(Math.cos(a) * r, u * this.H + rm.group.position.y, Math.sin(a) * r),
        { x: Math.cos(a) * 0.12, y: 0.4 + Math.random() * 0.5, z: Math.sin(a) * 0.12 }
      ));
    }
    g.hud.setProgress(k, STEP_ICONS.cool);
    if (k >= 1) {
      g.world.pourLight.intensity = 0;
      audio.blip(0.6);
      g.setStage('breakup');
    }
  },
};

/* ================================================================== *
 *  10. breaking the mould -- the moment the bell first exists          *
 * ================================================================== */
const breakup = {
  enter(g) {
    const S = SHAPES[g.state.shapeKey], rm = g.rigMold;
    this.S = S;
    this.H = moldHeight(S);
    this.hits = 0;
    this.collapsed = false;
    this.revealT = -1;
    this.dragDist = 0;
    this.lastCrack = -1;
    rm.sprueCup.visible = false;
    rm.sprueMelt.visible = false;
    for (const h of rm.hoops) h.visible = false;
    // nothing may hang over the bell as it appears
    g.world.ladleRig.rotation.y = LADLE_PARK;
    g.world.ladle.rotation.z = 0;
    g.world.ladleMelt.visible = false;
    this.chunks = rm.buildChunks(26);
    founderLook(g.world, 0, this.H * 0.55, 0);
    this.cracks = new CrackField(rm.group, S);
    this.cracks.setHeat(0.55);

    // The light that finds the bell.  It comes up as the earth comes off, so
    // the casting does not merely become visible -- it arrives.
    this.reveal = new THREE.SpotLight(0xfff0d6, 0, 12, 0.66, 0.5, 1.4);
    this.reveal.position.set(2.0, 5.6, 3.4);
    this.reveal.target.position.set(0, S.height * 0.45, 0);
    g.scene.add(this.reveal); g.scene.add(this.reveal.target);
    this.revealBack = new THREE.PointLight(0xbcd6ff, 0, 10, 2);
    this.revealBack.position.set(-1.6, 2.6, -2.2);
    g.scene.add(this.revealBack);

    this._shot(g);
    g.hud.setProgress(0, STEP_ICONS.break);
    g.hud.setHint('tap', V(0, this.H * 0.5, moldR(S, 0.5)), 1.4);
    rm.setBellClean(0);
    rm.setBellHeat(0.10);
  },
  exit(g) {
    this.cracks.clear();
    g.scene.remove(this.reveal); g.scene.remove(this.reveal.target);
    g.scene.remove(this.revealBack);
  },
  resize(g) { this._shot(g); },
  _shot(g) {
    const S = this.S;
    g.rig.setShot(
      { target: V(0, this.H * 0.5, 0), w: moldR(S, 0.08) * 2.05, h: this.H * 1.10, yaw: 0.16, pitch: 0.14 },
      { target: V(0, this.H * 0.48, 0), w: moldR(S, 0.08) * 4.2, h: this.H * 1.08, yaw: 0.2, pitch: 0.13 }
    );
  },

  tap(g) { this._strike(g); },

  move(g, i) {
    // dragging across the shell keeps tearing it, without needing taps
    if (this.collapsed) return;
    this.dragDist += Math.hypot(i.dx, i.dy);
    if (this.dragDist > 130) { this.dragDist = 0; this._strike(g, 0.7); }
  },

  _strike(g, power = 1) {
    if (this.collapsed) return;
    const rm = g.rigMold, S = this.S;
    const hit = g.hit(this.chunks.filter((c) => c.state === 0).map((c) => c.mesh));
    if (!hit) return;
    const local = _v.copy(hit.point).sub(rm.group.position);
    const theta = Math.atan2(local.z, local.x);
    const u = clamp01(local.y / this.H);
    this.hits++;
    g.hud.suppress();

    this.cracks.add(theta, u, {
      branches: 3 + Math.min(3, this.hits),
      length: 0.30 + this.hits * 0.08,
      width: 0.03 + this.hits * 0.006,
    });

    if (this.hits === 1) {
      // BAKI -- one hard report, and nothing falls yet
      audio.crackSnap(1.15);
      g.shake(0.85);
      g.shakeRoom(0.35);
      this._dust(g, hit.point, 16, 0.5, 0.6);
    } else {
      audio.crackSnap(0.55 * power);
      g.shake(0.5 * power);
      this._dust(g, hit.point, 26, 0.8, 0.75);
      // PARA-PARA -- pieces start letting go around the blow
      // A blow does not free a ring of pieces at once: the failure runs
      // outward from the impact, so each piece lets go a little later than
      // the one nearer the crack.
      const radius = 0.55 + this.hits * 0.22;
      let n = 0;
      for (const c of this.chunks) {
        if (c.state !== 0) continue;
        const dth = Math.abs(angDelta(c.theta, theta));
        const d = Math.hypot(dth * 0.9, (c.u - u) * 2.4);
        if (d < radius && n < 3 + this.hits * 2) {
          this._detach(c, 0.9 + Math.random() * 0.4, d * 0.28 + Math.random() * 0.12);
          n++;
        }
      }
    }

    const gone = this.chunks.filter((c) => c.state !== 0).length / this.chunks.length;
    g.hud.setProgress(clamp01(Math.max(this.hits / 4, gone)), STEP_ICONS.break);
    if (this.hits >= 4 || gone > 0.5) this._collapse(g);
  },

  _detach(c, power, delay = 0) {
    c.state = 1;
    if (this.cracks) this.cracks.retireNear(c.theta, c.u, 0.42);
    c.age = 0;
    c.hold = delay;                       // it lets go a moment after the blow
    // Earth peels off a casting; it is not launched.  Just enough outward
    // push to clear the bell's belly, and then gravity does the work.
    const dir = _v.set(Math.cos(c.theta), 0, Math.sin(c.theta));
    const push = (0.30 + Math.random() * 0.5) * power;
    c.vel.set(dir.x * push, -0.05 * Math.random(), dir.z * push);
    // a small shard tumbles faster than a big slab: less inertia to turn
    const spin = (0.85 / Math.max(0.2, c.radius)) * power;
    c.spin.set(
      (Math.random() - 0.5) * spin,
      (Math.random() - 0.5) * spin * 0.5,
      (Math.random() - 0.5) * spin
    );
    // where it ends up lying: on its back, outer face to the sky
    c.restQuat = new THREE.Quaternion()
      .setFromAxisAngle(UP, Math.random() * TAU)
      .multiply(new THREE.Quaternion().setFromUnitVectors(dir.clone().normalize(), UP));
    c.settle = -1;
    c.landed = false;
  },

  /** the height of whatever this piece is about to land on, in rig space */
  _ground(x, z) {
    const d = Math.hypot(x, z);
    if (d < 1.30) return 0.0;             // the brick plinth
    if (d < 1.88) return -0.13;           // the sand ring around it
    return -0.22;                          // the shop floor
  },

  _dust(g, at, n, size, scale = 1) {
    for (let i = 0; i < n; i++) {
      g.pDust.spawn(FX.dustCloud(
        at.clone().add(V((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5)),
        { x: (Math.random() - 0.5) * 1.8 * size, y: 0.3 + Math.random() * 1.1, z: (Math.random() - 0.5) * 1.8 * size },
        scale
      ));
    }
  },

  _collapse(g) {
    if (this.collapsed) return;
    this.collapsed = true;
    this.revealT = 0;
    const rm = g.rigMold;
    // the whole shell fails, but it fails as a wave from the last blow down
    for (const c of this.chunks) {
      if (c.state !== 0) continue;
      this._detach(c, 1.0 + Math.random() * 0.5, (1 - c.u) * 0.45 + Math.random() * 0.25);
    }
    audio.crackSnap(1.4);
    audio.dustPuff();
    g.shake(1.3);
    g.shakeRoom(0.7);
    // the ground disappears in earth
    for (let i = 0; i < 150; i++) {
      const a = Math.random() * TAU, u = Math.random();
      const r = moldR(this.S, u) * (0.8 + Math.random() * 0.5);
      // the cloud rolls outward along the ground, densest at the base
      const low = Math.pow(Math.random(), 2.2);
      g.pDust.spawn(FX.dustCloud(
        V(Math.cos(a) * r, low * this.H * 0.85 + rm.group.position.y, Math.sin(a) * r),
        {
          x: Math.cos(a) * (1.4 + Math.random() * 2.2),
          y: 0.15 + Math.random() * 0.9 * (1 - low),
          z: Math.sin(a) * (1.4 + Math.random() * 2.2),
        },
        1.1 + Math.random() * 0.8
      ));
    }
    // pull back so the bell arrives at full size
    const S = this.S;
    g.rig.setShot(
      { target: V(0, S.height * 0.52, 0), w: (S.rim + 0.75) * 2.3, h: S.height * 1.4, yaw: 0.14, pitch: 0.13 },
      { target: V(0, S.height * 0.50, 0), w: (S.rim + 0.75) * 4.0, h: S.height * 1.35, yaw: 0.18, pitch: 0.12 }
    );
    this._shot = () => {};
  },

  update(g, dt) {
    const rm = g.rigMold;
    this.cracks.update(dt, 3.0);
    getBeacon(g).update(g.clock);

    // Broken earth falls, thuds and stays.  Fired clay has essentially no
    // restitution, so a bounce is the fastest way to make two-metre slabs of
    // mould read as plastic chips.  Each piece topples onto its back and the
    // rubble is still lying there when the bell is hoisted out of it.
    for (const c of this.chunks) {
      if (c.state !== 1) continue;
      if (c.hold > 0) { c.hold -= dt; continue; }
      c.age += dt;

      if (c.settle < 0) {
        c.vel.y -= 9.81 * dt;
        c.mesh.position.addScaledVector(c.vel, dt);
        c.mesh.rotation.x += c.spin.x * dt;
        c.mesh.rotation.y += c.spin.y * dt;
        c.mesh.rotation.z += c.spin.z * dt;
        const gy = this._ground(c.mesh.position.x, c.mesh.position.z);
        if (c.mesh.position.y <= gy + c.radius * 0.42) {
          c.settle = 0;
          c.settleFrom = c.mesh.quaternion.clone();
          c.settleY0 = c.mesh.position.y;
          c.settleY1 = gy + c.thick * 0.55;
          c.slide = c.vel.clone().setY(0).multiplyScalar(0.28);
          const impact = Math.abs(c.vel.y);
          audio.earthThud(clamp01(impact / 5.5), c.radius);
          this._dust(g, c.mesh.position.clone().add(rm.group.position), 3, 0.35, 0.5);
        }
      } else {
        // it tips over onto its face and slides a hand's width to a stop
        c.settle = Math.min(1, c.settle + dt / 0.38);
        const k = smoothstep(0, 1, c.settle);
        c.mesh.quaternion.slerpQuaternions(c.settleFrom, c.restQuat, k);
        c.mesh.position.y = lerp(c.settleY0, c.settleY1, k);
        c.mesh.position.x += c.slide.x * dt * (1 - k);
        c.mesh.position.z += c.slide.z * dt * (1 - k);
        if (c.settle >= 1) c.state = 2;
      }
    }

    if (this.revealT >= 0) {
      this.revealT += dt;
      const T = this.revealT;
      this.cracks.setHeat(Math.max(0, 0.55 - T * 0.5));
      // the crack web belonged to a shell that no longer exists; take it away
      // under cover of the dust rather than leaving it hanging in the air
      if (T > 0.1) this.cracks.retireAll();
      // the dust thins, the light comes up, and the bell is simply there
      rm.setBellClean(smoothstep(0.9, 2.6, T) * 0.62);
      this.reveal.intensity = 90 * smoothstep(0.5, 2.4, T);
      this.revealBack.intensity = 26 * smoothstep(0.8, 2.8, T);
      if (T > 1.15 && !this._sparkled) {
        this._sparkled = true;
        audio.sparkle();
      }
      if (T > 1.0 && Math.random() < dt * 18) {
        const S = this.S, t = Math.random();
        const a = Math.random() * TAU;
        g.pDust.spawn(FX.claySpeck(
          V(Math.cos(a) * outerR(S, t), t * S.height + rm.group.position.y, Math.sin(a) * outerR(S, t)),
          { x: 0, y: -0.2, z: 0 }
        ));
      }
      // Let it stand there.  This is the moment the whole game is built
      // around, and cutting away 1.6 s after the dust starts to thin threw it
      // away; the earth is still settling at that point.
      g.hud.setProgress(clamp01(T / 5.0), STEP_ICONS.break);
      if (T > 5.0) g.setStage('lift');
    }
  },
};

/* ================================================================== *
 *  11. hoist it up and hang the clapper                               *
 * ================================================================== */
const lift = {
  enter(g) {
    const S = SHAPES[g.state.shapeKey], rm = g.rigMold, W = g.world;
    this.S = S;
    this.lift = 0;
    this.phase = 'hook';        // hook -> hoist -> clapper -> place
    this.hookT = 0;
    this.clapper = null;
    this.grabbed = false;
    this.age = 0;
    this._offered = 0;
    this.crownY = () => S.height + rm.group.position.y + rm.bellGroup.position.y;
    this._shot(g);
    g.hud.setProgress(0, STEP_ICONS.lift);
    g.hud.setHint('wait', null, 99);
    rm.spindle.visible = false;
    rm.basePlate.visible = true;
    W.ladleRig.rotation.y = LADLE_PARK; // swing the ladle clear of the bell
    W.ladle.rotation.z = 0;
  },
  exit(g) { audio.chain(0); getBeacon(g).hide(); },
  resize(g) { this._shot(g); },
  _shot(g) {
    const S = this.S;
    const top = S.height + 1.9;
    g.rig.setShot(
      { target: V(0, top * 0.48, 0), w: (S.rim + 0.7) * 2.2, h: top * 1.05, yaw: 0.14, pitch: 0.12 },
      { target: V(0, top * 0.46, 0), w: (S.rim + 0.7) * 4.2, h: top * 1.0, yaw: 0.18, pitch: 0.11 }
    );
  },

  down(g) {
    if (this.phase !== 'clapper' || !this.clapper) return;
    const s = g.screen(this.clapper.position, {});
    if (Math.hypot(s.x - g.input.x, s.y - g.input.y) < 190) {
      this.grabbed = true;
      getBeacon(g).hide();
      audio.clank(1.4);
    }
  },
  up(g) {
    if (!this.grabbed) return;
    this.grabbed = false;
    const rm = g.rigMold, S = this.S;
    const p = this.clapper.position;
    // Judge the drop by what the child can SEE, not by world distance.  The
    // drag runs on a plane facing the camera, so the clapper stays at its own
    // depth however far it is dragged -- measuring in metres from the axis
    // would mean it could never be let go anywhere near the bell.
    const c = g.screen(_v.set(0, rm.group.position.y + rm.bellGroup.position.y + S.height * 0.5, 0), {});
    const s = g.screen(p, {});
    const reach = Math.min(g._w, g._h) * 0.42;   // generous on purpose
    const near = Math.hypot(c.x - s.x, c.y - s.y) < reach;
    if (near && p.y > 0.35) {
      this.phase = 'place';
      this.placeT = 0;
      this.placeFrom = p.clone();
      audio.clank(1.1);
    }
  },

  move(g, i) {
    const W = g.world, S = this.S, rm = g.rigMold;
    if (this.phase === 'hoist') {
      if (i.dy < 0) {
        this.lift = clamp01(this.lift + (-i.dy) / (g._h * 0.45));
        g.hud.suppress();
      }
    } else if (this.phase === 'clapper' && this.grabbed) {
      // drag on a plane facing the camera, through the clapper
      const n = g.rig.camera.getWorldDirection(_v3).clone().negate();
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, this.clapper.position);
      const p = g.hitPlane(plane, _v2);
      if (p) {
        this.clapper.position.set(clamp(p.x, -3.2, 3.2), clamp(p.y, 0.42, S.height + 1.6), clamp(p.z, -2.0, 3.0));
      }
    }
  },

  update(g, dt) {
    const S = this.S, rm = g.rigMold, W = g.world;
    this.age += dt;
    getBeacon(g).update(g.clock);

    // escape hatches, one per phase
    if (this.phase === 'hoist' && this._offered !== 1 && this.age > 34) {
      this._offered = 1;
      g.hud.showNext(true, () => { this.lift = 1; g.hud.showNext(false); });
    }
    if (this.phase === 'clapper' && this._offered !== 2 && this.age > 60) {
      this._offered = 2;
      g.hud.showNext(true, () => {
        g.hud.showNext(false);
        this.phase = 'place'; this.placeT = 0; this.placeFrom = this.clapper.position.clone();
        audio.clank(1.1);
      });
    }

    if (this.phase === 'hook') {
      this.hookT += dt;
      const k = clamp01(this.hookT / 1.5);
      const y = lerp(4.6, this.crownY() + 0.42, smoothstep(0, 1, k));
      W.hook.position.set(0, y, 0);
      W.setChain(5.5, y + 0.3, 0, 0, 0.04);
      audio.chain(0.5 * (1 - k * 0.6));
      if (k >= 1) {
        this.phase = 'hoist';
        audio.chain(0);
        audio.clank(1.2);
        g.hud.setHint('dragUp', V(0, S.height * 0.6, 0), 1.2);
      }
    }

    if (this.phase === 'hoist' || this.phase === 'clapper' || this.phase === 'place') {
      const rise = smoothstep(0, 1, this.lift) * 1.25;
      rm.bellGroup.position.y = damp(rm.bellGroup.position.y, rise, 6, dt);
      rm.bellGroup.rotation.y += dt * (0.12 + this.lift * 0.24);
      const crown = this.crownY();
      W.hook.position.set(0, crown + 0.42, 0);
      W.setChain(5.5, crown + 0.3, 0, 0, 0.03 + this.lift * 0.02);
      rm.setBellClean(0.5 + this.lift * 0.5);
      rm.basePlate.visible = rm.bellGroup.position.y < 0.05;

      if (this.phase === 'hoist') {
        audio.chain(clamp01(Math.abs(g.input.dy) * 0.05) * (g.input.active ? 1 : 0));
        // dust and dry earth shaken off as it comes up into the light
        if (this.lift < 1 && Math.random() < dt * 40 * (g.input.active ? 1 : 0.1)) {
          const a = Math.random() * TAU, t = Math.random();
          g.pDust.spawn(FX.claySpeck(
            V(Math.cos(a) * outerR(S, t), t * S.height + rm.group.position.y + rm.bellGroup.position.y, Math.sin(a) * outerR(S, t)),
            { x: 0, y: -0.3, z: 0 }
          ));
        }
        g.hud.setProgress(this.lift * 0.6, STEP_ICONS.lift);
        if (this.lift >= 0.995) {
          this.phase = 'clapper';
          audio.chain(0);
          audio.sparkle();
          this._spawnClapper(g);
        }
      }
    }

    if (this.phase === 'clapper' && this.clapper && !this.grabbed) {
      // bob gently on the sand so it reads as pick-up-able
      this.clapper.position.y = damp(this.clapper.position.y, this.clapper.userData.arm + this.clapper.userData.ball * 2.6, 5, dt);
      this.clapper.rotation.z = Math.sin(g.clock * 1.7) * 0.06;
      getBeacon(g).show(this.clapper.position, 1.2);
      g.hud.moveHint(this.clapper.position);
    }

    if (this.phase === 'place') {
      this.placeT += dt;
      const k = clamp01(this.placeT / 0.8);
      const target = V(0, rm.group.position.y + rm.bellGroup.position.y + S.height * 0.74, 0);
      this.clapper.position.lerpVectors(this.placeFrom, target, smoothstep(0, 1, k));
      this.clapper.rotation.z = lerp(this.clapper.rotation.z, 0, k);
      g.hud.setProgress(0.6 + k * 0.4, STEP_ICONS.lift);
      if (k >= 1 && !this._done) {
        this._done = true;
        audio.clank(1.5);
        g.state.clapper = this.clapper;
        g.setStage('ring');
      }
    }
  },

  _spawnClapper(g) {
    const S = this.S;
    // long enough that its ball can actually reach the sound bow
    const arm = S.height * 0.62;
    const ball = clamp(S.rim * 0.25, 0.17, 0.28);
    const c = makeClapper(g.state.metal, { arm, ball });
    // Stands on the sand beside the pit, leaning, waiting to be picked up.
    // Kept well inside the portrait frame -- a phone held upright sees barely
    // three metres across here, and anything past that is unreachable.
    // Its tip is a full ball-and-flight below the eye, so it has to be set
    // this high or it would be buried to the knee in the floor.
    c.position.set(1.15, arm + ball * 2.6, 1.95);
    c.rotation.z = 0.16;
    g.scene.add(c);
    this.clapper = c;
    g.state.clapper = c;
    g.hud.setHint('dragSide', c.position.clone(), 1.4);
    getBeacon(g).show(c.position, 1.2);
    audio.blip(1.1);
  },
};

/* ================================================================== *
 *  12. the first ring                                                 *
 * ================================================================== */
const ring = {
  enter(g) {
    const S = SHAPES[g.state.shapeKey], rm = g.rigMold, W = g.world;
    this.S = S;
    this.bellAng = 0; this.bellVel = 0;
    this.clapAng = 0; this.clapVel = 0;
    this.lastStrike = -9;
    this.strikes = 0;
    this.pulling = false;
    this.pullPx = 0;

    // hang the bell from a headstock on the crane hook
    const baseY = rm.group.position.y + rm.bellGroup.position.y;
    this.pivotY = baseY + S.height + 0.34;
    const swing = new THREE.Group();
    swing.position.set(0, this.pivotY, 0);
    g.scene.add(swing);
    this.swing = swing;

    // move the bell (and its clapper) under the swinging pivot
    rm.group.remove(rm.bellGroup);
    swing.add(rm.bellGroup);
    rm.bellGroup.position.set(0, -(S.height + 0.34), 0);
    rm.bellGroup.rotation.y += rm.group.rotation.y;

    // Built in the bell's own frame, then dropped so its gudgeons land exactly
    // on the swing pivot -- the beam, the straps and the crown all line up.
    const head = makeHeadstock(S.height, S.rim);
    head.position.y = -(S.height + 0.34);
    swing.add(head);
    this.head = head;
    this.wheelR = head.userData.wheelR;
    this.wheelZ = head.userData.wheelZ;        // the wheel stands off to one side

    // clapper: swings on its own inside the bell
    const clap = g.state.clapper;
    if (clap) {
      g.scene.remove(clap);
      const cs = new THREE.Group();
      cs.position.set(0, 0, 0);
      swing.add(cs);
      cs.add(clap);
      clap.position.set(0, -(S.height * 0.26), 0);
      clap.rotation.set(0, 0, 0);
      this.clapSwing = cs;
      // How far the clapper can swing inside the bell before it touches the
      // wall.  Derived, not guessed: the ball has to actually arrive at the
      // metal, or the strike sound would have nothing to look at.
      const arm = clap.userData.arm ?? S.height * 0.62;
      const ballR = clap.userData.ball ?? 0.16;
      const ballFromPivot = S.height * 0.26 + arm;
      const bellRimY = S.height + 0.34;                  // below the pivot
      const tBall = clamp01((bellRimY - ballFromPivot) / S.height);
      const clearance = Math.max(0.10, innerR(S, tBall) - ballR * 0.92);
      this.clapLimit = clamp(Math.asin(clamp(clearance / ballFromPivot, 0, 0.9)), 0.14, 0.5);
    }

    W.hook.position.set(0, this.pivotY + 0.55, 0);
    W.setChain(5.5, this.pivotY + 0.45);
    rm.basePlate.visible = false;
    rm.setBellClean(1);

    // the rope, and the handle a child pulls
    this.rope = new Rope(g.scene, 0.026);
    this.handleY0 = Math.max(0.9, this.pivotY - this.wheelR - 2.6);
    this.handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.42, 12),
      new THREE.MeshStandardMaterial({ color: 0x8a6a3c, roughness: 0.85 })
    );
    this.handle.position.set(0, this.handleY0, this.wheelZ);
    g.scene.add(this.handle);
    for (const s of [-1, 1]) {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xa8863f, roughness: 0.95 }));
      tuft.position.y = s * 0.22;
      this.handle.add(tuft);
    }

    // Expanding shells of sound.  A plain translucent sphere just greys the
    // picture out; a fresnel rim reads as a wave front leaving the bell.
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uFade: { value: 0 }, uCol: { value: new THREE.Color(0xffd9a8) } },
        vertexShader: `
          varying vec3 vN; varying vec3 vV;
          void main(){
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform float uFade; uniform vec3 uCol;
          varying vec3 vN; varying vec3 vV;
          void main(){
            float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
            gl_FragColor = vec4(uCol, pow(f, 4.0) * uFade);
          }`,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, fog: false,
      });
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat);
      m.visible = false; m.renderOrder = 5; m.frustumCulled = false;
      g.scene.add(m);
    }

    // The finished bell should be the brightest thing in the room.  Everything
    // before this was work; this is the reward, and it gets its own light.
    this.key = new THREE.SpotLight(0xfff2dc, 130, 16, 0.6, 0.55, 1.3);
    this.key.position.set(2.4, this.pivotY + 2.2, 4.2);
    this.key.target.position.set(0, this.pivotY - S.height * 0.5, 0);
    g.scene.add(this.key); g.scene.add(this.key.target);
    this.backLight = new THREE.PointLight(0xa8c6ff, 34, 12, 2);
    this.backLight.position.set(-1.9, this.pivotY - 0.4, -2.6);
    g.scene.add(this.backLight);

    this._shot(g);
    g.hud.setProgress(1, STEP_ICONS.ring);
    g.hud.setHint('dragDown', this.handle.position.clone(), 1.2);
    audio.ambient(1);
  },

  exit(g) {
    const rm = g.rigMold;
    // hand the bell back to the rig so newRun() can dispose of it properly
    if (rm?.bellGroup && rm.bellGroup.parent === this.swing) {
      this.swing.remove(rm.bellGroup);
      rm.group.add(rm.bellGroup);
    }
    g.scene.remove(this.swing);
    g.scene.remove(this.handle);
    g.scene.remove(this.key); g.scene.remove(this.key.target);
    g.scene.remove(this.backLight);
    if (this.rope) g.scene.remove(this.rope.mesh);

  },
  resize(g) { this._shot(g); },
  _shot(g) {
    const S = this.S;
    const top = this.pivotY + 1.2;
    g.rig.setShot(
      { target: V(0, top * 0.47, 0.1), w: (S.rim + 0.9) * 2.3, h: top * 1.02, yaw: 0.10, pitch: 0.10 },
      { target: V(0, top * 0.46, 0), w: (S.rim + 0.9) * 4.4, h: top * 0.98, yaw: 0.16, pitch: 0.09 }
    );
  },

  down(g) { this.pulling = true; this.pullStartY = g.input.y; this.pullStartAng = this.bellAng; },
  up(g) { this.pulling = false; },

  update(g, dt) {
    const S = this.S, rm = g.rigMold, W = g.world;
    getBeacon(g).update(g.clock);

    /* ---- rope, wheel, bell ---- *
     * The rope does not steer the bell, it pulls on it.  Slaving the angle
     * straight to the finger gave a three-quarter-tonne casting an angular
     * velocity of 3 rad/s within 100 ms of first touch, which is the single
     * clearest way to tell a player that nothing here has any mass.  So the
     * pull becomes a TORQUE: the rope goes taut, the bell leans into it, and
     * it keeps going after the hand stops.  A child still gets an immediate
     * response, because the rope itself moves under the finger at once. */
    const L = Math.max(0.7, S.height * 0.55);
    const gravAcc = -(9.81 / L) * Math.sin(this.bellAng);
    let acc = gravAcc - 0.42 * this.bellVel;

    if (this.pulling) {
      const mpp = g.metresPerPixel(this.handle.position);
      const pulled = (g.input.y - this.pullStartY) * mpp;      // metres of rope taken in
      // how far the hand is ahead of where the wheel has actually turned to
      const want = this.pullStartAng + pulled / (this.wheelR * 2.6);
      const lead = clamp(want - this.bellAng, -0.9, 0.9);
      // rope tension only pulls, never pushes, and it slackens near the stop
      const tension = lead > 0 ? lead : lead * 0.25;
      acc += tension * 26 - this.bellVel * 0.9;
      this.ropeLead = lead;
      g.hud.suppress();
    } else {
      this.ropeLead = damp(this.ropeLead ?? 0, 0, 6, dt);
    }

    this.bellVel = clamp(this.bellVel + acc * dt, -4.2, 4.2);
    this.bellAng = clamp(this.bellAng + this.bellVel * dt, -0.85, 0.85);
    // air moved by a swinging bell, at the speed it is actually moving
    if (Math.abs(this.bellVel) > 1.1 && Math.random() < dt * 5) {
      audio.whoosh(clamp01((Math.abs(this.bellVel) - 1.0) / 2.6));
    }

    /* ---- the clapper lags behind, then catches up and hits ---- */
    const Lc = Math.max(0.35, S.height * 0.33);
    const cAcc = -(9.81 / Lc) * Math.sin(this.clapAng) - 0.5 * this.clapVel;
    this.clapVel += cAcc * dt;
    this.clapAng += this.clapVel * dt;

    const LIMIT = this.clapLimit ?? 0.26;
    const rel = this.clapAng - this.bellAng;
    if (Math.abs(rel) > LIMIT) {
      this.clapAng = this.bellAng + Math.sign(rel) * LIMIT;
      const impact = Math.abs(this.clapVel - this.bellVel);
      this.clapVel = this.bellVel - (this.clapVel - this.bellVel) * 0.38;
      if (impact > 0.62 && g.clock - this.lastStrike > 0.3) {
        this.lastStrike = g.clock;
        this._strike(g, clamp01(impact / 3.4));
      }
    }

    this.swing.rotation.z = this.bellAng;
    if (this.clapSwing) this.clapSwing.rotation.z = this.clapAng;

    /* ---- rope and handle follow the wheel, so cause and effect stay visible ---- */
    const wx = Math.sin(this.bellAng) * this.wheelR;
    const wy = this.pivotY - Math.cos(this.bellAng) * this.wheelR;
    _v.set(wx, wy, this.wheelZ);
    // rope pays out as the wheel turns, which is why pulling it turns the bell
    const handleY = this.handleY0 - this.bellAng * this.wheelR * 2.6;
    this.handle.position.set(wx * 0.35, clamp(handleY, 0.35, this.handleY0 + 1.4), this.wheelZ);
    this.rope.set(_v, this.handle.position);
    if (!this.strikes) g.hud.moveHint(this.handle.position);

    /* ---- the crane keeps hold of it ---- */
    W.hook.position.set(0, this.pivotY + 0.55, 0);
    W.hook.rotation.z = this.bellAng * 0.12;
    W.setChain(5.5, this.pivotY + 0.45, 0, 0, Math.abs(this.bellVel) * 0.02);

  },

  _strike(g, power) {
    const S = this.S, rm = g.rigMold;
    this.strikes++;
    g.state.strikes = this.strikes;
    g.hud.suppress();          // they know how to ring it now
    audio.bellStrike({
      voice: S.voice,
      bright: METALS[g.state.metal].bright,
      decor: rm.decorLoad,
      power: 0.45 + power * 0.55,
    });
    g.shake(0.35 + power * 0.5);
    g.shakeRoom(0.6 + power * 0.6);
    g.hud.doRipple();
    if (this.strikes === 1) g.hud.doFlash();

    // Dust shaken off the roof timbers, drifting down through the window
    // shafts.  This is the sound made visible: not a drawn wave, but the room
    // reacting to a pressure it cannot ignore.
    const p = 0.5 + power * 0.5;
    for (let i = 0; i < Math.round(40 * p); i++) {
      g.pDust.spawn(FX.dustCloud(
        V((Math.random() - 0.5) * 10, 4.6 + Math.random() * 2.4, -5 + Math.random() * 7.5),
        { x: (Math.random() - 0.5) * 0.4, y: -0.30 - Math.random() * 0.35, z: (Math.random() - 0.5) * 0.35 },
        0.5 + Math.random() * 0.5
      ));
    }
    // and the motes already hanging in the air around the bell are pushed out
    for (let i = 0; i < Math.round(30 * p); i++) {
      const a = Math.random() * TAU;
      const rr = S.rim + 0.2 + Math.random() * 1.4;
      const spd = (2.6 / rr) * p;
      g.pGlow.spawn({
        ...FX.mote(
          V(Math.cos(a) * rr, this.pivotY - S.height * (0.25 + Math.random() * 0.6), Math.sin(a) * rr),
          { x: Math.cos(a) * spd, y: 0.25 * p, z: Math.sin(a) * spd }
        ),
        life: 1.6 + Math.random() * 1.6, drag: 1.5,
        color0: [1, 0.9, 0.76, 0.5], color1: [1, 0.9, 0.76, 0],
      });
    }
    if (this.strikes === 1) {
      setTimeout(() => { if (g.stageName === 'ring') g.hud.showReplay(true); }, 2600);
    }
  },
};

/* ================================================================== */
export const STAGES = {
  pick, core, falsebell, decor, mold, bake, furnace, pour, cool, breakup, lift, ring,
};
