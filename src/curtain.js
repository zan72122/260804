// 幕。平面の絵を動かすのではなく、指に合わせて「ひだ」が寄り、揺れ、
// 止まったあとにも余韻が残るように、毎フレーム布の形をつくり直す。
import * as THREE from '../vendor/three.module.min.js';
import { clamp, lerp, smoothstep, damp, Spring, hash1, rand } from './util.js';
import { velvetTexture, goldTexture } from './textures.js';

// 布のひとかたまり（片袖ぶん、または一枚もの）
class Panel {
  constructor({ cols, rows, material, trimMaterial = null }) {
    this.cols = cols;
    this.rows = rows;
    const geom = new THREE.BufferGeometry();
    const n = cols * rows;
    this.pos = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    const idx = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        uv[i * 2] = c / (cols - 1);
        uv[i * 2 + 1] = 1 - r / (rows - 1);
      }
    }
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    }
    geom.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geom.setIndex(idx);
    this.geom = geom;
    this.mesh = new THREE.Mesh(geom, material);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;

    // 裾の飾り（金の縁取り）
    this.trim = null;
    if (trimMaterial) {
      const tg = new THREE.BufferGeometry();
      this.trimPos = new Float32Array(cols * 2 * 3);
      const tuv = new Float32Array(cols * 2 * 2);
      const tidx = [];
      for (let c = 0; c < cols; c++) {
        tuv[c * 2] = c / (cols - 1); tuv[c * 2 + 1] = 1;
        tuv[(cols + c) * 2] = c / (cols - 1); tuv[(cols + c) * 2 + 1] = 0;
      }
      for (let c = 0; c < cols - 1; c++) {
        const a = c, b = c + 1, d = cols + c, e = cols + c + 1;
        tidx.push(a, d, b, b, d, e);
      }
      tg.setAttribute('position', new THREE.BufferAttribute(this.trimPos, 3));
      tg.setAttribute('uv', new THREE.BufferAttribute(tuv, 2));
      tg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(cols * 2 * 3), 3));
      tg.setIndex(tidx);
      this.trimGeom = tg;
      this.trim = new THREE.Mesh(tg, trimMaterial);
      this.trim.frustumCulled = false;
    }

    // 行ごとの遅れと揺れ（下ほどゆっくり、大きく揺れる）
    this.rowOpen = new Float32Array(rows);
    this.rowSway = [];
    for (let r = 0; r < rows; r++) {
      const v = r / (rows - 1);
      this.rowSway.push(new Spring(0, {
        stiffness: lerp(120, 15, v),
        damping: lerp(13, 3.1, v),
      }));
    }
  }

  setPos(i, x, y, z) {
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
  }

  finish() {
    this.geom.attributes.position.needsUpdate = true;
    this.geom.computeVertexNormals();
    if (this.trim) {
      const { cols, rows } = this;
      const base = (rows - 1) * cols;
      for (let c = 0; c < cols; c++) {
        const s = (base + c) * 3;
        const up = (base - cols + c) * 3;
        // 裾の少し上から、下へ垂れる帯をつくる
        const dx = this.pos[s] - this.pos[up];
        const dy = this.pos[s + 1] - this.pos[up + 1];
        const dz = this.pos[s + 2] - this.pos[up + 2];
        const L = Math.hypot(dx, dy, dz) || 1;
        this.trimPos[c * 3] = this.pos[s] - dx / L * 0.20;
        this.trimPos[c * 3 + 1] = this.pos[s + 1] - dy / L * 0.20;
        this.trimPos[c * 3 + 2] = this.pos[s + 2] - dz / L * 0.20 + 0.012;
        this.trimPos[(cols + c) * 3] = this.pos[s] + dx / L * 0.04;
        this.trimPos[(cols + c) * 3 + 1] = this.pos[s + 1] + dy / L * 0.04;
        this.trimPos[(cols + c) * 3 + 2] = this.pos[s + 2] + dz / L * 0.04 + 0.012;
      }
      this.trimGeom.attributes.position.needsUpdate = true;
      this.trimGeom.computeVertexNormals();
    }
  }
}

export const CURTAIN_TYPES = ['velvet', 'austrian', 'starlight'];

const PRESETS = {
  velvet: {
    color: 0xffffff, sheen: 0xff8ea8, base: '#b01e3a',
    folds: 9, fullness: 1.62, mode: 'travel', trim: true,
    sheenRoughness: 0.5, roughness: 0.88,
  },
  austrian: {
    color: 0xffffff, sheen: 0xffd6f2, base: '#a35cb4',
    folds: 7, fullness: 1.5, mode: 'austrian', trim: true,
    sheenRoughness: 0.42, roughness: 0.75,
  },
  starlight: {
    color: 0x7fbfff, sheen: 0xdff2ff, base: '#3a72b8',
    folds: 11, fullness: 1.7, mode: 'fly', trim: false,
    sheenRoughness: 0.3, roughness: 0.42, sheer: true,
  },
};

function starMapTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 520; i++) {
    const x = rand(0, 512), y = rand(0, 512), r = rand(0.6, 3.2);
    const grd = g.createRadialGradient(x, y, 0, x, y, r * 3.2);
    const a = rand(0.35, 1);
    grd.addColorStop(0, `rgba(255,255,235,${a})`);
    grd.addColorStop(1, 'rgba(255,255,235,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r * 3.2, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 1.2);
  return t;
}

export class Curtain {
  constructor(type = 'velvet', {
    halfWidth = 6.7, top = 7.55, height = 7.45, z = -0.55,
  } = {}) {
    this.type = type;
    this.p = PRESETS[type];
    this.halfWidth = halfWidth;
    this.top = top;
    this.height = height;
    this.z = z;

    this.group = new THREE.Group();
    this.group.position.z = z;

    const matOpts = {
      color: this.p.color,
      roughness: this.p.roughness,
      metalness: 0.0,
      sheen: 1.0,
      sheenColor: new THREE.Color(this.p.sheen),
      sheenRoughness: this.p.sheenRoughness,
      side: THREE.DoubleSide,
      map: velvetTexture(this.p.base),
    };
    if (this.p.sheer) {
      matOpts.transparent = true;
      matOpts.opacity = 0.52;
      matOpts.emissive = new THREE.Color(0x6fa8ff);
      matOpts.emissiveIntensity = 0.42;
      matOpts.emissiveMap = starMapTexture();
      matOpts.map = null;
    }
    this.material = new THREE.MeshPhysicalMaterial(matOpts);
    this.trimMaterial = this.p.trim
      ? new THREE.MeshStandardMaterial({
        map: goldTexture(), color: 0xffffff, roughness: 0.32, metalness: 0.85,
        emissive: 0x2a1a00, side: THREE.DoubleSide,
      })
      : null;

    this.panels = [];
    if (this.p.mode === 'travel') {
      for (const side of [-1, 1]) {
        const pn = new Panel({ cols: 44, rows: 20, material: this.material, trimMaterial: this.trimMaterial });
        pn.side = side;
        this.group.add(pn.mesh);
        if (pn.trim) this.group.add(pn.trim);
        this.panels.push(pn);
      }
    } else {
      const pn = new Panel({ cols: 72, rows: 22, material: this.material, trimMaterial: this.trimMaterial });
      pn.side = 0;
      this.group.add(pn.mesh);
      if (pn.trim) this.group.add(pn.trim);
      this.panels.push(pn);
    }

    this.open = 0;        // 目標
    this.openNow = 0;     // いま
    this.openVel = 0;
    this.billow = new Spring(0, { stiffness: 26, damping: 4.2 });
    this.time = 0;
    this.settleTimer = 0;
    this._lastOpen = 0;
    this.autoGlide = false;   // 指を離したら、そのまま気持ちよく開ききる
    this.onOpened = null;
    this._openedFired = false;
    this.build();
  }

  get object3d() { return this.group; }

  setOpen(v) {
    this.open = clamp(v, 0, 1);
    this.settleTimer = 0;
  }

  nudge(d) { this.setOpen(this.open + d); }

  glideOpen() { this.autoGlide = true; this.open = 1; }
  close() { this.autoGlide = true; this.open = 0; this._openedFired = false; }

  build() { this.update(0.016, true); }

  update(dt, force = false) {
    this.time += dt;
    const prev = this.openNow;
    const rate = this.autoGlide ? 2.2 : 13.0;
    this.openNow = damp(this.openNow, this.open, rate, dt);
    this.openVel = dt > 0 ? (this.openNow - prev) / dt : 0;

    if (!this._openedFired && this.openNow > 0.93 && this.open >= 1) {
      this._openedFired = true;
      const cb = this.onOpened;
      this.onOpened = null;
      if (cb) cb();
    }

    // 動きの勢いを、揺れと膨らみに変える
    const accel = (this.openNow - prev);
    this.billow.target = 0;
    this.billow.kick(accel * 26);
    this.billow.step(dt);

    const moving = Math.abs(this.openVel) > 0.0015;
    if (moving) this.settleTimer = 0; else this.settleTimer += dt;

    for (const pn of this.panels) {
      for (let r = 0; r < pn.rows; r++) {
        const v = r / (pn.rows - 1);
        const lagRate = lerp(24, 5.5, v * v);
        const before = pn.rowOpen[r];
        pn.rowOpen[r] = damp(pn.rowOpen[r], this.openNow, lagRate, dt);
        const sp = pn.rowSway[r];
        // 動いた勢いを横揺れに。下ほどよく揺れる。
        sp.kick(-(pn.rowOpen[r] - before) * lerp(2.0, 14.0, v * v) * (pn.side || 1));
        // 止まったあとも、しばらくゆらゆら（余韻）
        sp.step(dt);
      }
      this._shapePanel(pn, dt);
      pn.finish();
    }
  }

  _shapePanel(pn, dt) {
    const mode = this.p.mode;
    const { cols, rows } = pn;
    const H = this.height, TOP = this.top;
    const t = this.time;
    const bil = this.billow.value;

    if (mode === 'travel') {
      const side = pn.side;
      const outerX = side * this.halfWidth;
      const W0 = this.halfWidth * this.p.fullness;      // 布の本当の幅
      const F = this.p.folds;
      for (let r = 0; r < rows; r++) {
        const v = r / (rows - 1);
        const o = pn.rowOpen[r];
        const sway = pn.rowSway[r].value;
        // 先端は袖へ。開ききっても壁までは行かず、ふくらんだ束になる。
        const leadX = lerp(-side * 0.42, outerX * 0.87, o);
        const span = leadX - outerX;                     // 符号つき
        const width = Math.abs(span);
        const c = clamp(width / W0, 0.06, 1.0);
        // 布の長さは変わらない → 縮んだぶんだけ、ひだが深くなる
        let A = (width / (Math.PI * F)) * Math.sqrt(Math.max(0, 1 / c - 1));
        A = Math.min(A, 0.62);
        const ampV = 0.72 + 0.42 * v;
        const phase = t * 0.55 + sway * 2.4 + side * 1.7;
        for (let i = 0; i < cols; i++) {
          const u = i / (cols - 1);
          const taper = smoothstep(0, 0.09, u);
          const x = outerX + span * u + sway * u * 0.9;
          const fold = Math.sin(Math.PI * 2 * F * u + phase);
          const fold2 = Math.sin(Math.PI * 2 * F * 0.5 * u - phase * 0.7) * 0.28;
          let z = (fold + fold2) * A * taper * ampV;
          // 動くと客席側へふわっとふくらむ
          z += bil * Math.sin(Math.PI * u) * (0.35 + v * 0.8) * 0.55;
          // 裾のもたつき
          const hem = smoothstep(0.82, 1.0, v) * (1 - Math.abs(fold)) * 0.07;
          const y = TOP - v * H + hem
            + Math.abs(fold) * A * 0.10 * (1 - v)          // 上の吊り位置でわずかに持ち上がる
            - o * o * 0.10 * v;                            // 束ねると裾が少し上がる
          pn.setPos(r * cols + i, x, y, z);
        }
      }
      return;
    }

    if (mode === 'austrian') {
      const SW = 5;                                 // 引き上げ紐の本数
      const F = this.p.folds;
      const fullW = this.halfWidth * 2;
      for (let r = 0; r < rows; r++) {
        const v = r / (rows - 1);
        const o = pn.rowOpen[r];
        const sway = pn.rowSway[r].value;
        for (let i = 0; i < cols; i++) {
          const u = i / (cols - 1);
          // 紐の位置（s=0）でいちばん高く持ち上がり、あいだはふっくら垂れる
          const sn = Math.sin(Math.PI * SW * u);
          const s = Math.pow(sn * sn, 0.62);
          const lift = o * (0.74 + 0.24 * (1 - s));
          const h = H * (1 - lift * 0.86);            // その列の垂れ下がる長さ
          const gather = 1 - o * 0.16 * (1 - s);
          const x = (u - 0.5) * fullW * gather + sway * 0.45 * v;
          const y = TOP - v * h;
          // ちぢんだぶんだけ、横向きのひだが深くなる
          const comp = clamp(h / H, 0.12, 1);
          const Av = 0.06 + 0.42 * (1 - comp);
          const Nr = 2.5 + 7.0 * (1 - comp);
          const ruffle = Math.sin(v * Math.PI * Nr + t * 0.5 + u * 1.7) * Av * (0.35 + v * 0.9);
          const fold = Math.sin(Math.PI * 2 * F * u + t * 0.4 + sway * 2.0)
            * (0.11 + o * 0.16) * (0.45 + v * 0.75);
          let z = ruffle + fold;
          z += bil * Math.sin(Math.PI * u) * (0.3 + v) * 0.4;
          pn.setPos(r * cols + i, x, y, z);
        }
      }
      return;
    }

    // fly：まっすぐ上へ。うすい布なので、ゆったり波打つ。
    const F = this.p.folds;
    const fullW = this.halfWidth * 2;
    for (let r = 0; r < rows; r++) {
      const v = r / (rows - 1);
      const o = pn.rowOpen[r];
      const sway = pn.rowSway[r].value;
      for (let i = 0; i < cols; i++) {
        const u = i / (cols - 1);
        const x = (u - 0.5) * fullW + sway * 0.6 * (0.3 + v);
        const y = TOP - v * H + o * (H + 0.9);
        const wave = Math.sin(Math.PI * 2 * F * u + t * 0.9 + v * 2.4)
          * (0.10 + Math.abs(this.openVel) * 0.9) * (0.35 + v * 0.85);
        const swell = Math.sin(Math.PI * u * 1.5 + t * 0.6) * 0.14 * (0.2 + v);
        let z = wave + swell;
        z += bil * Math.sin(Math.PI * u) * (0.3 + v) * 0.7;
        pn.setPos(r * cols + i, x, y, z);
      }
    }
  }

  // 指が布のどのあたりを触っているか（0=閉じ 1=開き）へざっくり変換
  dragToOpen(dxPx, refPx) {
    const k = this.p.mode === 'travel' ? 1.35 : 1.15;
    return clamp(Math.abs(dxPx) / (refPx * 0.42) * k, 0, 1);
  }

  dispose() {
    for (const pn of this.panels) {
      pn.geom.dispose();
      if (pn.trimGeom) pn.trimGeom.dispose();
    }
    this.material.dispose();
    if (this.trimMaterial) this.trimMaterial.dispose();
  }
}
