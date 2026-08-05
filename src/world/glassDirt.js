/**
 * ガラスに付いたコケ汚れ。
 * 汚れは「しみ（blob）」の集まりとして持ち、なぞられた分だけ薄くなる。
 * 画面外のしみは、なぞった量に応じて一緒に薄くなる（＝縦持ちでも詰まらない）。
 */
import * as THREE from 'three';
import { TANK } from './config.js';
import { makeRandom, randRange, clamp } from '../core/util.js';

const TEX_W = 640;
const TEX_H = 428;

/** 手の動きの量に対して、まわりへにじませる強さ。 */
const BLEED = 1.7;

export class GlassDirt {
  constructor(scene, shared) {
    this.width = TANK.halfW * 2;
    this.height = TANK.waterY;
    this.centerY = TANK.waterY / 2;
    this.z = TANK.glassZ - 0.04;

    this.canvas = document.createElement('canvas');
    this.canvas.width = TEX_W;
    this.canvas.height = TEX_H;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    const mat = new THREE.MeshStandardMaterial({
      map: this.texture,
      transparent: true,
      roughness: 0.88,
      metalness: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.material = mat;

    const geo = new THREE.PlaneGeometry(this.width, this.height);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(0, this.centerY, this.z);
    this.mesh.renderOrder = 6;
    scene.add(this.mesh);

    this._buildBlobs();
    this._touched = new Set();
    this._bleedBuf = [];
    this._dirty = true;
    this.redraw();
  }

  _buildBlobs() {
    const rng = makeRandom(777);
    this.blobs = [];
    // 汚れはガラスの中央 68% の帯に置く。
    // 端に置くと縦持ちのとき指が届かず、いつまでも終わらないため。
    const cols = 9, rows = 5;
    const BAND = 0.68, BAND_TOP = 0.16;
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        // 格子をずらして自然なばらつきに
        const u = BAND_TOP + ((ix + 0.5) / cols) * BAND + randRange(rng, -0.035, 0.035);
        const v = BAND_TOP + ((iy + 0.5) / rows) * BAND + randRange(rng, -0.045, 0.045);
        if (rng() < 0.12) continue; // ところどころ抜く
        const x = (u - 0.5) * this.width;
        const y = (0.5 - v) * this.height + this.centerY;
        const parts = [];
        const n = 3 + Math.floor(rng() * 3);
        for (let k = 0; k < n; k++) {
          parts.push({
            dx: randRange(rng, -26, 26),
            dy: randRange(rng, -20, 20),
            r: randRange(rng, 16, 40),
            hue: randRange(rng, 72, 106),
            sat: randRange(rng, 40, 66),
            lit: randRange(rng, 17, 31),
          });
        }
        this.blobs.push({ x, y, life: 1, parts, dots: this._dots(rng) });
      }
    }
    this.total = this.blobs.length;
  }

  _dots(rng) {
    const dots = [];
    const n = 4 + Math.floor(rng() * 5);
    for (let i = 0; i < n; i++) {
      dots.push({
        dx: randRange(rng, -30, 30),
        dy: randRange(rng, -24, 24),
        r: randRange(rng, 2.5, 7),
        a: randRange(rng, 0.25, 0.6),
      });
    }
    return dots;
  }

  worldToCanvas(x, y) {
    return {
      cx: ((x + this.width / 2) / this.width) * TEX_W,
      cy: ((this.centerY + this.height / 2 - y) / this.height) * TEX_H,
    };
  }

  redraw() {
    const g = this.ctx;
    g.clearRect(0, 0, TEX_W, TEX_H);
    for (const b of this.blobs) {
      if (b.life <= 0.004) continue;
      const { cx, cy } = this.worldToCanvas(b.x, b.y);
      const a = Math.pow(b.life, 0.7);
      for (const p of b.parts) {
        const r = p.r * (0.55 + 0.45 * b.life);
        const grad = g.createRadialGradient(cx + p.dx, cy + p.dy, 0, cx + p.dx, cy + p.dy, r);
        // 飼育員さんの顔が透けて見える程度に留める（隠しきらない）
        grad.addColorStop(0, `hsla(${p.hue}, ${p.sat}%, ${p.lit}%, ${0.80 * a})`);
        grad.addColorStop(0.5, `hsla(${p.hue}, ${p.sat}%, ${p.lit}%, ${0.52 * a})`);
        grad.addColorStop(1, `hsla(${p.hue}, ${p.sat}%, ${p.lit}%, 0)`);
        g.fillStyle = grad;
        g.beginPath();
        g.arc(cx + p.dx, cy + p.dy, r, 0, Math.PI * 2);
        g.fill();
      }
      // ざらっとした粒。近くで見たときの情報量になる。
      for (const d of b.dots) {
        g.fillStyle = `hsla(96, 40%, 26%, ${d.a * a})`;
        g.beginPath();
        g.arc(cx + d.dx, cy + d.dy, d.r * (0.5 + 0.5 * b.life), 0, Math.PI * 2);
        g.fill();
      }
    }
    this.texture.needsUpdate = true;
  }

  /**
   * ガラス上の一点をなぞる。
   * @returns 実際に落ちた汚れの量（0..1、しみ数で正規化）
   */
  wipe(x, y, radius, strength) {
    let removed = 0;
    const r2 = radius * radius;
    this._touched.clear();
    for (const b of this.blobs) {
      if (b.life <= 0) continue;
      const dx = b.x - x, dy = b.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const falloff = 1 - Math.sqrt(d2) / radius;
      const cut = Math.min(b.life, strength * (0.35 + falloff * 0.85));
      b.life -= cut;
      removed += cut;
      this._touched.add(b);
      if (b.life < 0.004) b.life = 0;
    }
    // にじみは「落ちた量」ではなく「こすっている手の動き」に対して起きる。
    // そうしないと、こすっている所が先にきれいになった瞬間に進行が止まる。
    const bled = this._bleed(strength * BLEED, x, y);
    if (removed > 0 || bled > 0) this._dirty = true;
    return (removed + bled) / this.total;
  }

  /**
   * こすった所のまわりにも、きれいが少しずつにじんでいく。
   *
   * 4 歳児は一か所をぐりぐり擦りがちなので、これが無いと
   * 「触っていない場所だけ永遠に残る」状態になってしまう。
   * 近い順に配るので、見た目は「きれいが広がっていく」ように読める。
   */
  _bleed(amount, fromX, fromY) {
    if (amount <= 0) return 0;
    const rest = this._bleedBuf;
    rest.length = 0;
    for (const b of this.blobs) {
      if (b.life > 0 && !this._touched.has(b)) rest.push(b);
    }
    if (!rest.length) return 0;
    rest.sort((a, b) =>
      (a.x - fromX) ** 2 + (a.y - fromY) ** 2 - ((b.x - fromX) ** 2 + (b.y - fromY) ** 2));
    let left = amount;
    let done = 0;
    for (const b of rest) {
      if (left <= 0) break;
      const cut = Math.min(b.life, left, 0.14);
      b.life -= cut;
      left -= cut;
      done += cut;
      if (b.life < 0.004) b.life = 0;
    }
    return done;
  }

  /** 仕上げの自動クリア。最後の一点で詰まらせない。 */
  autoFinish(dt, rate = 0.55) {
    let changed = false;
    for (const b of this.blobs) {
      if (b.life > 0) {
        b.life = Math.max(0, b.life - rate * dt);
        changed = true;
      }
    }
    if (changed) this._dirty = true;
  }

  get progress() {
    let sum = 0;
    for (const b of this.blobs) sum += b.life;
    return clamp(1 - sum / this.total, 0, 1);
  }

  /** まだ汚れている所のうち、指定点にいちばん近いものを返す（ヒント用）。 */
  nearestDirty(x, y, rect) {
    let best = null, bestD = Infinity;
    for (const b of this.blobs) {
      if (b.life <= 0.05) continue;
      if (rect && (b.x < rect.minX || b.x > rect.maxX || b.y < rect.minY || b.y > rect.maxY)) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  reset() {
    for (const b of this.blobs) b.life = 1;
    this._dirty = true;
    this.redraw();
  }

  update() {
    if (this._dirty) {
      this.redraw();
      this._dirty = false;
    }
  }
}
