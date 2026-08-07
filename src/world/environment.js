import * as THREE from 'three';
import { PALETTE, WALK } from '../core/config.js';
import {
  beamWood,
  hemp,
  plankFloor,
  plaster,
  polishedWood,
  skyTex,
  softDisc,
  stone,
  ground,
  woodPost,
} from '../core/textures.js';
import { makeRandom, lerp } from '../core/util.js';

// ---------------------------------------------------------------------------
// 長い綱作り小屋。
//   遠景 … 空、霞んだ山なみ、戸口の外の明るさ
//   中景 … 果てまで続く柱・梁・光の筋・作業場の道具
//   近景 … 手が届く距離の籠、麻束、作業台、床板の傷
// 奥行きは、輪郭・材質・明暗・空気の濁りの四つで読ませる。
// ---------------------------------------------------------------------------

function hillTexture(seed, ridge, colorTop, colorBottom) {
  const W = 1024;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const rnd = makeRandom(seed);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, colorTop);
  g.addColorStop(1, colorBottom);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, H);
  const pts = 26;
  let y = H * (1 - ridge);
  for (let i = 0; i <= pts; i++) {
    const x = (i / pts) * W;
    y = H * (1 - ridge) + Math.sin(i * 0.7 + seed) * H * 0.13 + (rnd() - 0.5) * H * 0.2;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function shaftTexture() {
  const W = 32;
  const H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,236,196,0.55)');
  g.addColorStop(0.45, 'rgba(255,228,178,0.22)');
  g.addColorStop(1, 'rgba(255,220,160,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const sg = ctx.createLinearGradient(0, 0, W, 0);
  sg.addColorStop(0, 'rgba(0,0,0,0.9)');
  sg.addColorStop(0.15, 'rgba(0,0,0,0)');
  sg.addColorStop(0.85, 'rgba(0,0,0,0)');
  sg.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.rnd = makeRandom(2024);

    this._sky();
    this._land();
    this._floor();
    this._frame();
    this._roof();
    this._gableEnd();
    this._lightShafts();
    this._props();
    this._dust();
  }

  // --- 遠景 ---------------------------------------------------------------

  _sky() {
    const tex = skyTex(PALETTE.skyTop, PALETTE.skyHorizon, 0x9a927e);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(260, 32, 20),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    dome.renderOrder = -10;
    this.group.add(dome);

    // 霞んだ山なみ。遠いものほど彩度も明暗差も失う。
    const layers = [
      { d: 190, h: 34, ridge: 0.5, top: '#96a6ab', bot: '#b7bcb4', y: -2 },
      { d: 140, h: 24, ridge: 0.55, top: '#7e938f', bot: '#a4ada2', y: -2 },
      { d: 96, h: 16, ridge: 0.6, top: '#6c7f6a', bot: '#8d9a86', y: -2 },
    ];
    layers.forEach((L, i) => {
      const t = hillTexture(11 + i * 7, L.ridge, L.top, L.bot);
      t.repeat.set(3, 1);
      const w = L.d * 2.6;
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, L.h),
        new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: false, depthWrite: false })
      );
      m.position.set(WALK.x0 + WALK.span * 0.5, L.y + L.h / 2, -L.d);
      m.renderOrder = -9 + i;
      this.group.add(m);
      const m2 = m.clone();
      m2.position.z = L.d;
      m2.rotation.y = Math.PI;
      this.group.add(m2);
      const m3 = m.clone();
      m3.position.set(WALK.x0 + WALK.span * 0.5 + L.d, L.y + L.h / 2, 0);
      m3.rotation.y = -Math.PI / 2;
      this.group.add(m3);
      const m4 = m.clone();
      m4.position.set(WALK.x0 + WALK.span * 0.5 - L.d, L.y + L.h / 2, 0);
      m4.rotation.y = Math.PI / 2;
      this.group.add(m4);
    });
  }

  _land() {
    const t = ground();
    t.repeat.set(120, 120);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({ map: t, color: 0xffffff, roughness: 1 })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = -0.36;
    m.receiveShadow = true;
    this.group.add(m);
  }

  // --- 中景：建物 ---------------------------------------------------------

  _floor() {
    const L = WALK.shedTo - WALK.shedFrom;
    const cx = (WALK.shedTo + WALK.shedFrom) / 2;
    const wz = WALK.halfWidth * 2;

    const t = plankFloor();
    t.repeat.set(L / 3.4, wz / 1.075);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(L, wz),
      new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, metalness: 0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, 0);
    floor.receiveShadow = true;
    this.group.add(floor);

    // 石の布基礎。板の小口を隠し、床が浮いていることを示す。
    const st = stone();
    st.repeat.set(L / 1.2, 0.4);
    const sillMat = new THREE.MeshStandardMaterial({ map: st, roughness: 0.95 });
    for (const sgn of [-1, 1]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(L, 0.42, 0.22), sillMat);
      s.position.set(cx, -0.16, sgn * (WALK.halfWidth + 0.11));
      s.receiveShadow = true;
      s.castShadow = true;
      this.group.add(s);
    }
  }

  _frame() {
    const bays = Math.ceil((WALK.shedTo - WALK.shedFrom) / WALK.bayStep);
    const postGeo = new THREE.BoxGeometry(0.17, WALK.eaves, 0.17);
    postGeo.translate(0, WALK.eaves / 2, 0);
    const postMat = new THREE.MeshStandardMaterial({ map: woodPost(3), roughness: 0.85 });
    const posts = new THREE.InstancedMesh(postGeo, postMat, bays * 2 + 2);
    posts.castShadow = true;
    posts.receiveShadow = true;
    const d = new THREE.Object3D();
    let n = 0;
    for (let k = 0; k <= bays; k++) {
      const x = WALK.shedFrom + k * WALK.bayStep;
      for (const sgn of [-1, 1]) {
        d.position.set(x, 0, sgn * WALK.halfWidth);
        d.rotation.set(0, (this.rnd() - 0.5) * 0.02, (this.rnd() - 0.5) * 0.008);
        d.updateMatrix();
        posts.setMatrixAt(n++, d.matrix);
      }
    }
    posts.count = n;
    this.group.add(posts);

    // 腰壁。ここから上が開いていて、光と風景が入る。
    const pt = plaster();
    pt.repeat.set(2.2, 0.8);
    const wallMat = new THREE.MeshStandardMaterial({ map: pt, roughness: 0.96 });
    const wallGeo = new THREE.BoxGeometry(WALK.bayStep - 0.17, 0.92, 0.1);
    wallGeo.translate(0, 0.46, 0);
    const walls = new THREE.InstancedMesh(wallGeo, wallMat, bays * 2);
    walls.castShadow = true;
    walls.receiveShadow = true;
    n = 0;
    for (let k = 0; k < bays; k++) {
      const x = WALK.shedFrom + (k + 0.5) * WALK.bayStep;
      for (const sgn of [-1, 1]) {
        d.position.set(x, 0, sgn * WALK.halfWidth);
        d.rotation.set(0, 0, 0);
        d.updateMatrix();
        walls.setMatrixAt(n++, d.matrix);
      }
    }
    walls.count = n;
    this.group.add(walls);

    // 梁。奥へ続くリズムが、距離をそのまま目盛りにする。
    const bt = beamWood();
    bt.repeat.set(3, 1);
    const beamMat = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.88 });
    const beamGeo = new THREE.BoxGeometry(0.15, 0.2, WALK.halfWidth * 2 + 0.2);
    const beams = new THREE.InstancedMesh(beamGeo, beamMat, bays + 1);
    beams.castShadow = true;
    beams.receiveShadow = true;
    n = 0;
    for (let k = 0; k <= bays; k++) {
      d.position.set(WALK.shedFrom + k * WALK.bayStep, WALK.eaves - 0.1, 0);
      d.rotation.set(0, 0, (this.rnd() - 0.5) * 0.01);
      d.updateMatrix();
      beams.setMatrixAt(n++, d.matrix);
    }
    beams.count = n;
    this.group.add(beams);

    // 筋交い。時々入れると、単調な連続に強弱がつく。
    const braceGeo = new THREE.BoxGeometry(0.09, 1.5, 0.09);
    const braces = new THREE.InstancedMesh(braceGeo, beamMat, bays);
    n = 0;
    for (let k = 0; k <= bays; k += 3) {
      const x = WALK.shedFrom + k * WALK.bayStep;
      const sgn = k % 6 === 0 ? -1 : 1;
      d.position.set(x + 0.5, WALK.eaves - 0.75, sgn * WALK.halfWidth);
      d.rotation.set(0, 0, 0.62);
      d.updateMatrix();
      braces.setMatrixAt(n++, d.matrix);
    }
    braces.count = n;
    braces.castShadow = true;
    this.group.add(braces);
  }

  _roof() {
    const L = WALK.shedTo - WALK.shedFrom;
    const cx = (WALK.shedTo + WALK.shedFrom) / 2;
    const dz = WALK.halfWidth + 0.3;
    const dy = WALK.ridge - WALK.eaves;
    const slope = Math.hypot(dz, dy);
    const t = beamWood();
    t.repeat.set(L / 1.6, slope / 0.5);
    const mat = new THREE.MeshStandardMaterial({
      map: t,
      color: 0xb59d80,
      roughness: 1,
      side: THREE.DoubleSide,
    });
    for (const sgn of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(L, slope), mat);
      m.position.set(cx, WALK.eaves + dy / 2, (sgn * dz) / 2);
      m.rotation.order = 'YXZ';
      m.rotation.y = sgn > 0 ? 0 : Math.PI;
      m.rotation.x = -Math.atan2(dy, dz) - Math.PI / 2;
      m.receiveShadow = true;
      m.castShadow = true;
      this.group.add(m);
    }
    const ridgeBeam = new THREE.Mesh(
      new THREE.BoxGeometry(L, 0.16, 0.18),
      new THREE.MeshStandardMaterial({ map: beamWood(), roughness: 0.9 })
    );
    ridgeBeam.position.set(cx, WALK.ridge - 0.06, 0);
    this.group.add(ridgeBeam);

    // 母屋（もや）。屋根裏の線が奥行きを稼ぐ。
    for (const sgn of [-1, 1]) {
      for (const f of [0.42, 0.78]) {
        const p = new THREE.Mesh(
          new THREE.BoxGeometry(L, 0.1, 0.1),
          new THREE.MeshStandardMaterial({ map: beamWood(), roughness: 0.9 })
        );
        p.position.set(cx, lerp(WALK.ridge, WALK.eaves, f) - 0.09, sgn * dz * f);
        this.group.add(p);
      }
    }
  }

  /** 近端の妻壁。まんなかが大きく開いていて、外の明るさが差し込む。 */
  _gableEnd() {
    const x = WALK.shedFrom;
    const wood = new THREE.MeshStandardMaterial({ map: woodPost(29), roughness: 0.88 });
    const board = new THREE.MeshStandardMaterial({ map: beamWood(), color: 0xa08a6e, roughness: 0.95 });
    const hw = WALK.halfWidth + 0.1;
    const openHalf = 0.95;

    for (const sgn of [-1, 1]) {
      const w = hw - openHalf;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.12, WALK.eaves, w), board);
      panel.position.set(x, WALK.eaves / 2, sgn * (openHalf + w / 2));
      panel.castShadow = true;
      panel.receiveShadow = true;
      this.group.add(panel);
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.2, WALK.eaves + 0.2, 0.2), wood);
      jamb.position.set(x, (WALK.eaves + 0.2) / 2, sgn * openHalf);
      jamb.castShadow = true;
      this.group.add(jamb);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, openHalf * 2 + 0.4), wood);
    lintel.position.set(x, WALK.eaves - 0.13, 0);
    lintel.castShadow = true;
    this.group.add(lintel);

    // 切妻の三角
    const shape = new THREE.Shape();
    shape.moveTo(-hw, 0);
    shape.lineTo(hw, 0);
    shape.lineTo(0, WALK.ridge - WALK.eaves);
    shape.closePath();
    const gable = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false }),
      board
    );
    gable.rotation.y = Math.PI / 2;
    gable.position.set(x + 0.05, WALK.eaves, 0);
    gable.castShadow = true;
    gable.receiveShadow = true;
    this.group.add(gable);
  }

  _lightShafts() {
    const tex = shaftTexture();
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      opacity: 0.85,
    });
    const dir = new THREE.Vector3(-6, 7.5, 11).normalize().multiplyScalar(-1); // 進む向き
    const travel = (WALK.eaves - 0.05) / -dir.y;
    const bays = 20;
    this.shafts = new THREE.Group();
    for (let k = 0; k < bays; k++) {
      const x = WALK.shedFrom + (k + 0.5) * WALK.bayStep;
      const w = WALK.bayStep - 0.24;
      const g = new THREE.BufferGeometry();
      const z0 = WALK.halfWidth;
      const y0 = WALK.eaves - 0.16;
      const ex = dir.x * travel;
      const ey = dir.y * travel;
      const ez = dir.z * travel;
      const verts = new Float32Array([
        x - w / 2, y0, z0,
        x + w / 2, y0, z0,
        x + w / 2 + ex, y0 + ey, z0 + ez,
        x - w / 2 + ex, y0 + ey, z0 + ez,
      ]);
      g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      const m = new THREE.Mesh(g, mat);
      m.renderOrder = 6;
      this.shafts.add(m);

      // 床に落ちた明るみ
      const patch = new THREE.Mesh(
        new THREE.PlaneGeometry(w, 1.5),
        new THREE.MeshBasicMaterial({
          map: softDisc('rgba(255,231,184,0.5)'),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: true,
        })
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(x + ex, 0.012, z0 + ez);
      patch.renderOrder = 5;
      this.shafts.add(patch);
    }
    this.group.add(this.shafts);
  }

  // --- 近景：道具と材料 ---------------------------------------------------

  /** 遊びの道具を置く手元だけは空けておく */
  _clear(x) {
    return x < -1.9 || x > 2.4;
  }

  _props() {
    const rnd = this.rnd;
    const woodMat = new THREE.MeshStandardMaterial({ map: woodPost(8), roughness: 0.82 });
    const benchMat = new THREE.MeshStandardMaterial({ map: polishedWood(), roughness: 0.6 });
    const hempMat = new THREE.MeshStandardMaterial({ map: hemp(1), roughness: 0.95 });
    const hempDark = new THREE.MeshStandardMaterial({ map: hemp(0.5), roughness: 0.98 });

    const props = new THREE.Group();

    // できあがったロープの巻き。壁の上端に掛けてある。
    const coilGeo = new THREE.TorusGeometry(0.24, 0.028, 7, 26);
    const coilMat = hempDark;
    for (let x = WALK.shedFrom + 4; x < WALK.shedTo - 4; x += 5.6) {
      const sgn = rnd() > 0.5 ? 1 : -1;
      const c = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const r = new THREE.Mesh(coilGeo, coilMat);
        r.position.set(i * 0.045, -i * 0.02, 0);
        r.scale.setScalar(1 - i * 0.05);
        r.castShadow = true;
        c.add(r);
      }
      c.position.set(x + rnd() * 2, 1.62 + rnd() * 0.4, sgn * (WALK.halfWidth - 0.09));
      c.rotation.y = Math.PI / 2;
      props.add(c);
    }

    // 麻束の棚
    for (let x = WALK.shedFrom + 2; x < WALK.shedTo - 6; x += 7.3) {
      if (!this._clear(x)) continue;
      const sgn = rnd() > 0.5 ? 1 : -1;
      const rack = new THREE.Group();
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.42), woodMat);
      shelf.position.y = 0.98;
      shelf.castShadow = true;
      shelf.receiveShadow = true;
      rack.add(shelf);
      for (const lx of [-0.68, 0.68]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.98, 0.07), woodMat);
        leg.position.set(lx, 0.49, 0);
        leg.castShadow = true;
        rack.add(leg);
      }
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.34, 4, 10), hempMat);
        b.rotation.z = Math.PI / 2;
        b.position.set(-0.55 + i * 0.36, 1.07, (rnd() - 0.5) * 0.1);
        b.castShadow = true;
        rack.add(b);
      }
      rack.position.set(x, 0, sgn * (WALK.halfWidth - 0.45));
      rack.rotation.y = sgn > 0 ? Math.PI : 0;
      props.add(rack);
    }

    // 麻を入れた籠
    const basketGeo = new THREE.CylinderGeometry(0.29, 0.22, 0.34, 16, 1, true);
    for (let x = WALK.shedFrom + 1; x < WALK.shedTo - 8; x += 6.1) {
      if (!this._clear(x)) continue;
      const sgn = rnd() > 0.5 ? 1 : -1;
      const b = new THREE.Mesh(
        basketGeo,
        new THREE.MeshStandardMaterial({ map: hemp(0.5), roughness: 1, side: THREE.DoubleSide })
      );
      b.position.set(x + rnd() * 3, 0.17, sgn * (WALK.halfWidth - 0.55) + (rnd() - 0.5) * 0.4);
      b.castShadow = true;
      b.receiveShadow = true;
      props.add(b);
      const fill = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), hempMat);
      fill.scale.y = 0.42;
      fill.position.copy(b.position).setY(0.3);
      fill.castShadow = true;
      props.add(fill);
    }

    // 作業台と道具
    for (let x = WALK.shedFrom + 6; x < WALK.shedTo - 10; x += 11.4) {
      if (!this._clear(x)) continue;
      const t = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.62), benchMat);
      top.position.y = 0.78;
      top.castShadow = true;
      top.receiveShadow = true;
      t.add(top);
      for (const lx of [-0.75, 0.75]) {
        for (const lz of [-0.24, 0.24]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.78, 0.08), woodMat);
          leg.position.set(lx, 0.39, lz);
          leg.castShadow = true;
          t.add(leg);
        }
      }
      const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.2, 12), woodMat);
      bucket.position.set(0.5, 0.92, 0.05);
      bucket.castShadow = true;
      t.add(bucket);
      const mallet = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.17, 10), benchMat);
      mallet.rotation.z = Math.PI / 2;
      mallet.position.set(-0.45, 0.86, -0.06);
      mallet.castShadow = true;
      t.add(mallet);
      t.position.set(x, 0, (rnd() > 0.5 ? 1 : -1) * (WALK.halfWidth - 0.6));
      t.rotation.y = rnd() * 0.4 - 0.2;
      props.add(t);
    }

    // 吊り提灯。奥へ点々と続く小さな灯り。
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xffe0a8,
      emissive: 0xffb95e,
      emissiveIntensity: 1.5,
      roughness: 0.7,
    });
    for (let x = WALK.shedFrom + 5; x < WALK.shedTo; x += 9) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), lampMat);
      l.scale.y = 1.3;
      l.position.set(x, WALK.eaves - 0.42, (this.rnd() - 0.5) * 1.2);
      props.add(l);
      const cord = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, 0.3, 5),
        new THREE.MeshStandardMaterial({ color: 0x3a2c1a })
      );
      cord.position.copy(l.position).setY(WALK.eaves - 0.19);
      props.add(cord);
    }

    this.group.add(props);
    this.props = props;
  }

  _dust() {
    const N = 700;
    const pos = new Float32Array(N * 3);
    const spd = new Float32Array(N * 3);
    const rnd = this.rnd;
    const from = WALK.shedFrom;
    const len = 34;
    for (let i = 0; i < N; i++) {
      pos[i * 3] = from + rnd() * len;
      pos[i * 3 + 1] = 0.15 + rnd() * 2.4;
      pos[i * 3 + 2] = (rnd() - 0.5) * 4.6;
      spd[i * 3] = (rnd() - 0.5) * 0.05;
      spd[i * 3 + 1] = 0.012 + rnd() * 0.035;
      spd[i * 3 + 2] = (rnd() - 0.5) * 0.05;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.PointsMaterial({
      size: 0.016,
      map: softDisc('rgba(255,240,214,1)'),
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      fog: false,
    });
    this.dust = new THREE.Points(g, m);
    this.dust.frustumCulled = false;
    this.dustSpeed = spd;
    this.dustRange = { from, len };
    this.group.add(this.dust);
  }

  setQuality(level, q) {
    this.shafts.visible = q.shafts;
    this.dust.visible = q.dust;
  }

  update(dt, cameraX) {
    if (!this.dust.visible) return;
    const p = this.dust.geometry.attributes.position.array;
    const s = this.dustSpeed;
    // 埃はカメラのまわりに巻き取る。長い作業場ぜんぶに撒く必要はない。
    const from = cameraX - 6;
    const len = 34;
    for (let i = 0; i < p.length; i += 3) {
      p[i] += s[i] * dt;
      p[i + 1] += s[i + 1] * dt;
      p[i + 2] += s[i + 2] * dt;
      if (p[i + 1] > 2.6) p[i + 1] = 0.1;
      if (p[i] < from) p[i] += len;
      else if (p[i] > from + len) p[i] -= len;
    }
    this.dust.geometry.attributes.position.needsUpdate = true;
  }
}
