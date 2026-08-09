// 筐体・バー・景品・爪の見た目。形状もテクスチャもコード生成。
// 描画予算はバー / 景品 / 爪の可読性へ寄せ、背景装飾は最小。

import * as THREE from '../vendor/three.module.js';
import { CAB, BAR, PANEL_T, HANDLE, SLOT_X, SLOT_Y, CLAW, PRIZE, TRAY } from './config.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _norm = new THREE.Vector3();
const _quat = new THREE.Quaternion();

export const COLORS = {
  barLeft: 0x2ec5ff,
  barRight: 0xffb020,
  socketLeft: 0x1c7fb8,
  socketRight: 0xc07310,
  capsule: 0xff4f8b,
  box: 0x6ee36e,
  chrome: 0xdfe7ee,
};

function makeEnv(renderer) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0.0, '#ffffff');
  grad.addColorStop(0.42, '#cfe4f5');
  grad.addColorStop(0.55, '#8fa6b8');
  grad.addColorStop(1.0, '#2b3440');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 128);
  // 天井の四角い光源（クロームに写り込む）
  g.fillStyle = '#ffffff';
  g.fillRect(30, 6, 74, 26);
  g.fillRect(150, 10, 60, 18);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return env;
}

function stripeTexture(color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = color;
  for (let i = 0; i < 4; i++) g.fillRect(i * 64 + 14, 0, 36, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function stripeAlpha() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#4a4a4a';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) g.fillRect(i * 64 + 14, 0, 36, 64);
  return new THREE.CanvasTexture(c);
}

function boxFaceTexture(color) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 10;
  g.strokeRect(5, 5, 118, 118);
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(64, 64, 26, 0, Math.PI * 2); g.fill();
  g.fillStyle = color;
  g.beginPath(); g.arc(64, 64, 14, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Stage {
  constructor(renderer) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101a26);
    this.env = makeEnv(renderer);
    this.scene.environment = this.env;

    this._lights();
    this._cabinet();
    this._sockets();
    this._bars();
    this._prizes();
    this._claw();
    this._tray();
    this._ghost();
    this.chuteFlash = 0;
  }

  _lights() {
    this.scene.add(new THREE.HemisphereLight(0xdfefff, 0x2a3240, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(0.42, 1.15, 0.62);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const s = key.shadow.camera;
    s.left = -0.38; s.right = 0.38; s.top = 0.55; s.bottom = -0.45;
    s.near = 0.2; s.far = 2.2;
    key.shadow.bias = -0.0012;
    key.shadow.normalBias = 0.004;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd4ff, 0.7);
    rim.position.set(-0.7, 0.5, -0.6);
    this.scene.add(rim);
  }

  _cabinet() {
    const g = new THREE.Group();
    this.scene.add(g);
    this.cabinet = g;

    const shell = new THREE.MeshStandardMaterial({ color: 0x24405c, roughness: 0.62, metalness: 0.15 });
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x3a6ea8, roughness: 0.35, metalness: 0.1 });

    // 下の斜面（奥が高い）。落ちた景品はここを滑ってシュートへ。
    const dy = CAB.rampFarY - CAB.rampNearY;
    const dl = CAB.rampNearZ - CAB.farZ;
    const rampLen = Math.hypot(dy, dl);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(CAB.hx * 2, 0.02, rampLen), rampMat);
    ramp.position.set(0, (CAB.rampFarY + CAB.rampNearY) / 2 - 0.01, (CAB.farZ + CAB.rampNearZ) / 2);
    ramp.rotation.x = -Math.atan2(dy, dl);
    ramp.receiveShadow = true;
    g.add(ramp);

    // シュート（斜面の続き）
    const cdy = CAB.rampNearY - CAB.chuteY;
    const cdl = CAB.chuteNearZ - CAB.rampNearZ;
    const chute = new THREE.Mesh(
      new THREE.BoxGeometry(CAB.hx * 2, 0.02, Math.hypot(cdy, cdl)),
      new THREE.MeshStandardMaterial({ color: 0x18cfa0, roughness: 0.3, metalness: 0.2 }),
    );
    chute.rotation.x = -Math.atan2(cdy, cdl);
    chute.position.set(0, (CAB.rampNearY + CAB.chuteY) / 2 - 0.01, (CAB.rampNearZ + CAB.chuteNearZ) / 2);
    chute.receiveShadow = true;
    g.add(chute);
    this.chuteMesh = chute;

    const depth = CAB.chuteNearZ - CAB.farZ;
    const sideGeo = new THREE.BoxGeometry(0.018, 0.5, depth);
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(sideGeo, shell);
      w.position.set(sx * (CAB.hx + 0.009), 0.16, (CAB.farZ + CAB.chuteNearZ) / 2);
      w.receiveShadow = true;
      g.add(w);
    }
    const lip = new THREE.Mesh(new THREE.BoxGeometry(CAB.hx * 2 + 0.036, 0.13, 0.018), shell);
    lip.position.set(0, CAB.chuteY + 0.05, CAB.chuteNearZ + 0.009);
    g.add(lip);

    // 手前と奥のソケット盤。手前は透明アクリルにして内部を隠さない。
    const panelGeo = new THREE.BoxGeometry(CAB.hx * 2, 0.135, PANEL_T);
    const farPanelMat = new THREE.MeshStandardMaterial({ color: 0x16283a, roughness: 0.5, metalness: 0.25 });
    const nearPanelMat = new THREE.MeshPhysicalMaterial({
      color: 0xbfe4ff, transparent: true, opacity: 0.16, roughness: 0.08,
      metalness: 0, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide,
    });
    for (const [z, sign, mat] of [[CAB.nearZ, 1, nearPanelMat], [CAB.farZ, -1, farPanelMat]]) {
      const p = new THREE.Mesh(panelGeo, mat);
      p.position.set(0, (SLOT_Y[0] + SLOT_Y[1]) / 2, z + sign * PANEL_T * 0.5);
      p.receiveShadow = mat === farPanelMat;
      p.renderOrder = mat === farPanelMat ? 0 : 2;
      g.add(p);
    }

    // 上のガントリーレール（爪が走る）
    const railMat = new THREE.MeshStandardMaterial({ color: 0xb9c6d2, roughness: 0.25, metalness: 0.9 });
    this.railMat = railMat;
    const railGeo = new THREE.CylinderGeometry(0.006, 0.006, CAB.hx * 2, 12);
    railGeo.rotateZ(Math.PI / 2);
    for (const dzr of [-0.03, 0.03]) {
      const r = new THREE.Mesh(railGeo, railMat);
      r.position.set(0, CAB.topY - 0.02, dzr);
      g.add(r);
    }

    // 枠（角のパイプ）
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xff6a3d, roughness: 0.4, metalness: 0.35 });
    const vGeo = new THREE.CylinderGeometry(0.008, 0.008, CAB.topY - CAB.chuteY, 10);
    for (const sx of [-1, 1]) {
      for (const z of [CAB.chuteNearZ, CAB.farZ]) {
        const m = new THREE.Mesh(vGeo, frameMat);
        m.position.set(sx * (CAB.hx + 0.012), (CAB.topY + CAB.chuteY) / 2, z);
        g.add(m);
      }
    }
    const topGeoZ = new THREE.CylinderGeometry(0.008, 0.008, depth, 10);
    topGeoZ.rotateX(Math.PI / 2);
    const topGeoX = new THREE.CylinderGeometry(0.008, 0.008, (CAB.hx + 0.012) * 2, 10);
    topGeoX.rotateZ(Math.PI / 2);
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(topGeoZ, frameMat);
      m.position.set(sx * (CAB.hx + 0.012), CAB.topY, (CAB.farZ + CAB.chuteNearZ) / 2);
      g.add(m);
    }
    for (const z of [CAB.chuteNearZ, CAB.farZ]) {
      const m = new THREE.Mesh(topGeoX, frameMat);
      m.position.set(0, CAB.topY, z);
      g.add(m);
    }
  }

  _sockets() {
    // ソケット = 大きな色付きの丸穴。対象のものだけ光る。
    this.sockets = [];
    const ringGeo = new THREE.RingGeometry(0.0112, 0.0138, 20);
    const holeGeo = new THREE.CircleGeometry(0.0115, 18);
    for (const end of [-1, 1]) {
      const z = end < 0 ? CAB.nearZ : CAB.farZ;
      for (const side of [-1, 1]) {
        const base = side < 0 ? COLORS.socketLeft : COLORS.socketRight;
        for (let xi = 0; xi < SLOT_X.length; xi++) {
          for (let yi = 0; yi < SLOT_Y.length; yi++) {
            const gsock = new THREE.Group();
            const face = end < 0 ? z + PANEL_T + 0.0012 : z + 0.0012;
            gsock.position.set(side * SLOT_X[xi], SLOT_Y[yi], face);
            const mat = new THREE.MeshStandardMaterial({
              color: base, roughness: 0.35, metalness: 0.3,
              emissive: new THREE.Color(base), emissiveIntensity: 0.0,
            });
            const ring = new THREE.Mesh(ringGeo, mat);
            gsock.add(ring);
            const hole = new THREE.Mesh(holeGeo, new THREE.MeshBasicMaterial({ color: 0x08121c }));
            hole.position.z = -0.0008;
            gsock.add(hole);
            this.cabinet.add(gsock);
            this.sockets.push({ group: gsock, mat, end, side, xi, yi, glow: 0 });
          }
        }
      }
    }
  }

  _bars() {
    this.bars = [];
    const tubeGeo = new THREE.CylinderGeometry(BAR.radius, BAR.radius, 1, 20, 1, true);
    tubeGeo.rotateX(Math.PI / 2);
    const coreGeo = new THREE.CylinderGeometry(0.0075, 0.0075, 1, 14);
    coreGeo.rotateX(Math.PI / 2);
    const handleGeo = new THREE.SphereGeometry(HANDLE.radius, 20, 14);
    const collarGeo = new THREE.CylinderGeometry(0.0155, 0.0155, 0.016, 16);
    collarGeo.rotateX(Math.PI / 2);

    for (let i = 0; i < 2; i++) {
      const color = i === 0 ? COLORS.barLeft : COLORS.barRight;
      const g = new THREE.Group();
      const tubeMat = new THREE.MeshPhysicalMaterial({
        color: 0xeaf6ff, transparent: true, opacity: 0.42, roughness: 0.05,
        metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03,
        envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide,
      });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.renderOrder = 3;
      const coreMat = new THREE.MeshStandardMaterial({
        color, roughness: 0.28, metalness: 0.15,
        emissive: new THREE.Color(color), emissiveIntensity: 0.35,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.castShadow = true;
      g.add(tube); g.add(core);

      const handleMat = new THREE.MeshStandardMaterial({
        color, roughness: 0.22, metalness: 0.35,
        emissive: new THREE.Color(color), emissiveIntensity: 0.2,
      });
      const collarMat = new THREE.MeshStandardMaterial({ color: 0xf2f6fa, roughness: 0.25, metalness: 0.8 });
      const handles = [];
      const collars = [];
      for (let e = 0; e < 2; e++) {
        const h = new THREE.Mesh(handleGeo, handleMat.clone());
        h.castShadow = true;
        this.scene.add(h);
        handles.push(h);
        const c = new THREE.Mesh(collarGeo, collarMat);
        this.scene.add(c);
        collars.push(c);
      }
      this.scene.add(g);
      this.bars.push({
        group: g, tube, core, coreMat, handles, collars, handleMat,
        color, flash: 0, a: new THREE.Vector3(), b: new THREE.Vector3(),
      });
    }
  }

  setBarEnds(index, a, b, opts = {}) {
    const bar = this.bars[index];
    bar.a.copy(a); bar.b.copy(b);
    const dir = _dir.subVectors(b, a);
    const len = dir.length();
    const mid = _mid.addVectors(a, b).multiplyScalar(0.5);
    const q = _quat.setFromUnitVectors(Z_AXIS, _norm.copy(dir).normalize());
    bar.group.position.copy(mid);
    bar.group.quaternion.copy(q);
    bar.tube.scale.set(1, 1, len);
    bar.core.scale.set(1, 1, len);
    const showHandles = opts.handles !== false;
    for (let e = 0; e < 2; e++) {
      const p = e === 0 ? a : b;
      const inward = e === 0 ? -1 : 1; // 端から筐体の内側へ
      bar.handles[e].visible = showHandles;
      bar.collars[e].visible = showHandles;
      // ハンドルは常に手前側（+Z）へ出して、奥のソケット盤に隠れないようにする
      bar.handles[e].position.set(p.x, p.y + HANDLE.dy, p.z + HANDLE.dz);
      bar.collars[e].position.set(p.x, p.y, p.z + inward * 0.012);
      bar.collars[e].quaternion.copy(q);
    }
  }

  _prizes() {
    this.prizeGroup = new THREE.Group();
    this.scene.add(this.prizeGroup);

    // カプセル：縞のある透明シェル + 中の小景品
    const cap = PRIZE.capsule;
    const capGeo = new THREE.CapsuleGeometry(cap.radius, cap.halfLen * 2, 8, 24);
    capGeo.rotateZ(Math.PI / 2);
    const map = stripeTexture('#' + COLORS.capsule.toString(16).padStart(6, '0'));
    const alpha = stripeAlpha();
    const capMat = new THREE.MeshPhysicalMaterial({
      map, alphaMap: alpha, transparent: true, roughness: 0.07, metalness: 0.0,
      clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.5, depthWrite: false,
      side: THREE.DoubleSide,
    });
    const capMesh = new THREE.Mesh(capGeo, capMat);
    capMesh.renderOrder = 4;
    capMesh.castShadow = true;
    const trinket = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.021, 1),
      new THREE.MeshStandardMaterial({ color: 0xffe14d, roughness: 0.3, metalness: 0.4, emissive: 0x553f00, emissiveIntensity: 0.5 }),
    );
    const capGroup = new THREE.Group();
    capGroup.add(capMesh); capGroup.add(trinket);
    this.prizeGroup.add(capGroup);

    // 箱：光沢 + 白い輪郭
    const b = PRIZE.box;
    const boxGeo = new THREE.BoxGeometry(b.hx * 2, b.hy * 2, b.hz * 2);
    const boxMat = new THREE.MeshPhysicalMaterial({
      map: boxFaceTexture('#' + COLORS.box.toString(16).padStart(6, '0')), roughness: 0.14, metalness: 0.05,
      clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.1,
    });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.castShadow = true;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(boxGeo),
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    );
    const boxGroup = new THREE.Group();
    boxGroup.add(boxMesh); boxGroup.add(edges);
    this.prizeGroup.add(boxGroup);

    this.prizeMeshes = { capsule: capGroup, box: boxGroup };
    this.trinket = trinket;
    capGroup.visible = false;
    boxGroup.visible = false;
  }

  showPrize(kind) {
    this.prizeMeshes.capsule.visible = kind === 'capsule';
    this.prizeMeshes.box.visible = kind === 'box';
  }

  _claw() {
    const g = new THREE.Group();
    this.scene.add(g);
    this.clawGroup = g;
    const chrome = new THREE.MeshStandardMaterial({ color: COLORS.chrome, roughness: 0.13, metalness: 1.0, envMapIntensity: 1.4 });
    this.chromeMat = chrome;

    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.020, 0.030, 16), chrome);
    head.castShadow = true;
    g.add(head);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.050, 12), chrome);
    stem.position.y = 0.036;
    g.add(stem);

    for (const sx of [-1, 1]) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(CLAW.bladeHalfX * 2, CLAW.rodLength, CLAW.bladeHalfZ * 2),
        chrome,
      );
      blade.position.set(sx * CLAW.spacing, -CLAW.rodLength / 2 - 0.010, 0);
      blade.castShadow = true;
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(CLAW.bladeHalfX, 10, 8), chrome,
      );
      tip.position.set(sx * CLAW.spacing, -CLAW.rodLength - 0.010, 0);
      g.add(blade); g.add(tip);
    }

    // ガントリー（横棒）
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(CAB.hx * 2, 0.016, 0.020), this.railMat);
    this.scene.add(bridge);
    this.bridge = bridge;
  }

  setClaw(x, y, z) {
    this.clawGroup.position.set(x, y, z);
    this.bridge.position.set(0, CAB.topY - 0.02, z);
  }

  _tray() {
    // 工具台：画面下にバーを置いておく棚
    const zMid = (TRAY.z[0] + TRAY.z[1]) / 2;
    const depth = Math.abs(TRAY.z[0] - TRAY.z[1]) + 0.07;
    const g = new THREE.Group();
    g.position.set(0, TRAY.y, zMid);
    this.scene.add(g);
    this.tray = g;
    const mat = new THREE.MeshStandardMaterial({ color: 0x2c3a4c, roughness: 0.7, metalness: 0.1 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(TRAY.width, 0.018, depth), mat);
    top.receiveShadow = true;
    g.add(top);
    const notchMat = new THREE.MeshStandardMaterial({ color: 0x0e1622, roughness: 0.9 });
    for (const z of TRAY.z) {
      const n = new THREE.Mesh(new THREE.BoxGeometry(TRAY.width - 0.06, 0.008, 0.028), notchMat);
      n.position.set(0, 0.011, z - zMid);
      g.add(n);
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.10, 0.018), mat);
        leg.position.set(sx * (TRAY.width / 2 - 0.02), -0.055, sz * (depth / 2 - 0.02));
        g.add(leg);
      }
    }
  }

  _ghost() {
    const MAX = 260;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    line.renderOrder = 8;
    this.scene.add(line);
    this.ghost = { line, geo, mat, max: MAX };
  }

  setGhost(points) {
    const { geo, max } = this.ghost;
    const pos = geo.attributes.position.array;
    const col = geo.attributes.color.array;
    const n = Math.min(points.length, max);
    for (let i = 0; i < n; i++) {
      const p = points[i];
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      const t = n > 1 ? i / (n - 1) : 1;
      const f = 0.25 + 0.75 * t;
      col[i * 3] = 0.55 * f; col[i * 3 + 1] = 0.95 * f; col[i * 3 + 2] = 1.0 * f;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.setDrawRange(0, n);
  }

  setGhostOpacity(o) {
    this.ghost.mat.opacity = Math.max(0, Math.min(1, o));
    this.ghost.line.visible = this.ghost.mat.opacity > 0.01;
  }

  update(dt) {
    if (this.chuteFlash > 0) {
      this.chuteFlash = Math.max(0, this.chuteFlash - dt * 0.9);
      this.chuteMesh.material.emissive.setHex(0x18cfa0);
      this.chuteMesh.material.emissiveIntensity = Math.sin(this.chuteFlash * Math.PI * 3) * 0.6 * this.chuteFlash;
    }
    for (const s of this.sockets) {
      const target = s.glow;
      const cur = s.mat.emissiveIntensity;
      s.mat.emissiveIntensity = cur + (target - cur) * Math.min(1, dt * 12);
      const sc = 1 + s.mat.emissiveIntensity * 0.22;
      s.group.scale.setScalar(sc);
    }
    for (const bar of this.bars) {
      if (bar.flash > 0) {
        bar.flash = Math.max(0, bar.flash - dt * 1.6);
        const v = Math.sin(bar.flash * Math.PI) * 1.6;
        bar.coreMat.emissiveIntensity = 0.15 + v;
        for (const h of bar.handles) h.material.emissiveIntensity = 0.2 + v * 0.7;
      }
    }
  }

  flashBar(index) {
    this.bars[index].flash = 1;
  }

  flashChute() {
    this.chuteFlash = 1;
  }

  setSocketGlow(pred) {
    for (const s of this.sockets) s.glow = pred ? pred(s) : 0;
  }
}

