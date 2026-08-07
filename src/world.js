/* ============================================================
 *  world.js — 地山・切羽・素掘り坑・セグメントリング・土砂
 * ============================================================ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as C from './config.js';
import {
  makeStrataTextures, makeFaceTextures, makeBoreTextures, makeConcreteTextures,
  makeMarkTexture, makeDustTexture, makeGlowTexture, canvas, texFromCanvas, mulberry32,
} from './textures.js';
import { BELT_PATH } from './tbm.js';

const D2R = Math.PI / 180;
const TILE = 9;    // 地層テクスチャ 1 タイル = 9 m

/* ============================================================
 *  セグメント形状
 * ============================================================ */
export function makeSegmentGeometry(spanDeg, { key = false } = {}) {
  const ri = C.SEG_RI + 0.02, ro = C.SEG_RO - 0.02;
  const half = (spanDeg / 2 - 0.9) * D2R;          // 継手のすき間
  const s = new THREE.Shape();
  s.moveTo(Math.cos(-half) * ri, Math.sin(-half) * ri);
  s.lineTo(Math.cos(-half) * ro, Math.sin(-half) * ro);
  s.absarc(0, 0, ro, -half, half, false);
  s.lineTo(Math.cos(half) * ri, Math.sin(half) * ri);
  s.absarc(0, 0, ri, half, -half, true);
  s.closePath();

  const depth = C.RING_W - 0.05;
  const g = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: true, bevelSize: 0.022, bevelThickness: 0.022,
    bevelSegments: 1, curveSegments: Math.max(10, Math.round(spanDeg / 2.2)), steps: 1,
  });
  g.translate(0, 0, -depth / 2);

  if (key) {
    // K セグメント：前端（+Z）を細くして楔状にする
    const p = g.attributes.position;
    const kFront = 0.86;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const r = Math.hypot(x, y), th = Math.atan2(y, x);
      const t = (z + depth / 2) / depth;           // 0=後端 1=前端
      const k = 1 + (kFront - 1) * t;
      p.setXY(i, Math.cos(th * k) * r, Math.sin(th * k) * r);
    }
    p.needsUpdate = true;
  }
  g.computeVertexNormals();

  // UV を円筒展開（テクスチャの向きを揃える）
  const p = g.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    uv[i * 2] = Math.atan2(y, x) * C.SEG_RO / 2.4;
    uv[i * 2 + 1] = z / 2.4 + Math.hypot(x, y) * 0.4;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** マークのアトラス（2x2） */
function makeMarkAtlas() {
  const S = 256;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  const kinds = [['star', '#ffd45e'], ['heart', '#ff8fb8'], ['flower', '#9ce6ff'], ['dot', '#b6ff9c']];
  kinds.forEach((k, i) => {
    const t = makeMarkTexture(k[0], k[1]);
    ctx.drawImage(t.image, (i % 2) * 128, Math.floor(i / 2) * 128, 128, 128);
    t.dispose();
  });
  const tex = texFromCanvas(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/* ============================================================
 *  地山（断面表示）
 * ============================================================ */
export class Geology {
  constructor(scene) {
    this.scene = scene;
    this.strata = makeStrataTextures();
    this.faceTex = makeFaceTextures();
    this.boreTex = makeBoreTextures();

    // 断面を作るクリップ面（手前側 x<0 の地山を取り除く）
    this.clip = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0.08);
    this.clipOn = 0.08;

    const strataMat = () => new THREE.MeshStandardMaterial({
      map: this.strata.map.clone(),
      normalMap: this.strata.normalMap.clone(),
      roughnessMap: this.strata.roughnessMap,
      normalScale: new THREE.Vector2(1.5, 1.5),
      roughness: 1.0, metalness: 0.0,
      side: THREE.DoubleSide,
    });

    this.sectionGroup = new THREE.Group();
    scene.add(this.sectionGroup);

    const LEN = 340, H = 46;
    const mkCap = (sign) => {
      const g = new THREE.PlaneGeometry(LEN, H, 1, 1);
      g.rotateY(-Math.PI / 2);
      const m = strataMat();
      m.map.repeat.set(LEN / TILE, H / TILE);
      m.normalMap.repeat.copy(m.map.repeat);
      m.normalMap.wrapS = m.normalMap.wrapT = THREE.RepeatWrapping;
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(0, sign * (C.BORE_R + H / 2), 0);
      mesh.userData.baseY = sign * (C.BORE_R + H / 2);
      mesh.userData.halfH = H / 2;
      mesh.userData.halfL = LEN / 2;
      return mesh;
    };
    this.capUp = mkCap(1);
    this.capDn = mkCap(-1);
    this.sectionGroup.add(this.capUp, this.capDn);

    // 未掘削帯（切羽の前方に残る地山）
    const bg = new THREE.PlaneGeometry(240, C.BORE_R * 2, 1, 1);
    bg.rotateY(-Math.PI / 2);
    const bm = strataMat();
    bm.map.repeat.set(240 / TILE, (C.BORE_R * 2) / TILE);
    bm.normalMap.repeat.copy(bm.map.repeat);
    bm.normalMap.wrapS = bm.normalMap.wrapT = THREE.RepeatWrapping;
    this.forwardBand = new THREE.Mesh(bg, bm);
    this.sectionGroup.add(this.forwardBand);

    // 断面の縁（掘削境界を強調する暗いライン）
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x140f0a });
    for (const sy of [1, -1]) {
      const e = new THREE.Mesh(new THREE.PlaneGeometry(LEN, 0.34), edgeMat);
      e.rotateY(-Math.PI / 2);
      e.position.set(0.02, sy * C.BORE_R, 0);
      e.userData.edge = sy;
      this.sectionGroup.add(e);
      if (sy === 1) this.edgeUp = e; else this.edgeDn = e;
    }

    // 素掘り坑（内面）
    const boreMat = new THREE.MeshStandardMaterial({
      map: this.boreTex.map, normalMap: this.boreTex.normalMap,
      roughnessMap: this.boreTex.roughnessMap,
      normalScale: new THREE.Vector2(1.6, 1.6),
      color: 0x554a3e,
      roughness: 1.0, metalness: 0.0, side: THREE.BackSide,
    });
    this.boreTex.map.repeat.set(6, 30);
    this.boreTex.normalMap.repeat.set(6, 30);
    this.boreTex.roughnessMap.repeat.set(6, 30);
    const bore = new THREE.CylinderGeometry(C.BORE_R, C.BORE_R, 1, 56, 1, true);
    bore.rotateX(Math.PI / 2);
    this.bore = new THREE.Mesh(bore, boreMat);
    scene.add(this.bore);

    // 切羽
    const faceGeo = new THREE.CircleGeometry(C.BORE_R, 64, 0, Math.PI * 2);
    {   // 中心をわずかに凹ませる（皿状）
      const p = faceGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const r = Math.hypot(p.getX(i), p.getY(i));
        p.setZ(i, 0.28 * (1 - (r / C.BORE_R) ** 2));
      }
      faceGeo.computeVertexNormals();
    }
    this.faceMat = new THREE.MeshStandardMaterial({
      map: this.faceTex.map, normalMap: this.faceTex.normalMap,
      normalScale: new THREE.Vector2(1.8, 1.8),
      color: 0xa08d72, roughness: 0.97, metalness: 0.0,
      side: THREE.DoubleSide,
    });
    this.face = new THREE.Mesh(faceGeo, this.faceMat);
    scene.add(this.face);

    // クリップ適用（手前半分を取り除いて断面にする）
    for (const m of [this.capUp.material, this.capDn.material,
      this.forwardBand.material, boreMat, edgeMat]) {
      m.clippingPlanes = [this.clip];
      m.clipShadows = true;
    }

    this.tunnelStart = -C.PRESET_RINGS * C.RING_W - 30;
  }

  setStratum(st) {
    this.faceMat.color.setHex(st.face);
  }

  /** 断面表示のオン／オフ（トンネル内部視点では地山を閉じる） */
  setSectionMode(on) {
    this.sectionGroup.visible = on;
    this.clip.constant = on ? this.clipOn : 1e5;
  }

  update(faceZ, cameraZ) {
    // 帯・切羽の位置
    this.face.position.z = faceZ;
    this.forwardBand.position.z = faceZ + 120;

    // 断面パネルをカメラに追従させ、テクスチャを世界固定にする
    const zc = cameraZ;
    for (const m of [this.capUp, this.capDn]) {
      m.position.z = zc;
      const off = (zc - m.userData.halfL) / TILE;
      m.material.map.offset.x = off;
      m.material.normalMap.offset.x = off;
      const offY = (m.userData.baseY - m.userData.halfH) / TILE;
      m.material.map.offset.y = offY;
      m.material.normalMap.offset.y = offY;
    }
    this.edgeUp.position.z = zc; this.edgeDn.position.z = zc;
    {
      const fb = this.forwardBand;
      const off = (fb.position.z - 120) / TILE;
      fb.material.map.offset.x = off;
      fb.material.normalMap.offset.x = off;
      const offY = (-C.BORE_R) / TILE;
      fb.material.map.offset.y = offY;
      fb.material.normalMap.offset.y = offY;
    }

    // 素掘り坑
    const z0 = this.tunnelStart, z1 = faceZ - 0.05;
    this.bore.scale.z = Math.max(1, z1 - z0);
    this.bore.position.z = (z0 + z1) / 2;
  }
}

/* ============================================================
 *  セグメントリング管理
 * ============================================================ */
export class Rings {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    const ct = makeConcreteTextures();
    this.concrete = new THREE.MeshStandardMaterial({
      map: ct.map, normalMap: ct.normalMap, roughnessMap: ct.roughnessMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      color: 0xb4b0a8, roughness: 0.93, metalness: 0.0,
    });
    this.concrete.map.repeat.set(1, 1);

    // 組立中／ゴースト用
    this.ghostMat = new THREE.MeshStandardMaterial({
      color: 0x7fe4ff, emissive: 0x2aa8d8, emissiveIntensity: 0.9,
      transparent: true, opacity: 0.30, roughness: 0.5,
      depthWrite: false, side: THREE.DoubleSide,
    });
    this.heldMat = this.concrete.clone();
    this.heldMat.color = new THREE.Color(0xf6f3ea);
    this.heldMat.emissive = new THREE.Color(0x54687a);
    this.heldMat.emissiveIntensity = 0.75;
    // 据え付けたばかりのピース。完成までは少し明るく見せて、
    // 周囲の既設リングに埋もれないようにする。
    this.freshMat = this.concrete.clone();
    this.freshMat.color = new THREE.Color(0xf4f1e8);
    this.freshMat.emissive = new THREE.Color(0x4a5a66);
    this.freshMat.emissiveIntensity = 0.6;

    this.markAtlas = makeMarkAtlas();
    this.markMat = new THREE.MeshStandardMaterial({
      map: this.markAtlas, transparent: true, alphaTest: 0.35,
      roughness: 0.6, metalness: 0.0,
      emissive: 0xffffff, emissiveIntensity: 0.18,
    });

    this.geoStd = makeSegmentGeometry(C.STD_SPAN);
    this.geoKey = makeSegmentGeometry(C.KEY_SPAN, { key: true });

    // 裏込め（グラウト）層
    const grout = new THREE.CylinderGeometry(C.GROUT_R, C.GROUT_R, C.RING_W, 40, 1, true);
    grout.rotateX(Math.PI / 2);
    this.groutMesh = new THREE.InstancedMesh(grout, new THREE.MeshStandardMaterial({
      color: 0x6a625a, roughness: 1.0, metalness: 0.0, side: THREE.DoubleSide,
    }), 40);
    this.groutMesh.count = 0;
    this.groutMesh.frustumCulled = false;
    scene.add(this.groutMesh);

    // トンネル照明（リングごとの小さな灯り）
    const lampGeo = new THREE.BoxGeometry(0.5, 0.14, 0.16);
    this.lampMesh = new THREE.InstancedMesh(lampGeo, new THREE.MeshStandardMaterial({
      color: 0xfff4dc, emissive: 0xffca70, emissiveIntensity: 2.4, roughness: 0.4,
    }), 40);
    this.lampMesh.count = 0;
    this.lampMesh.frustumCulled = false;
    scene.add(this.lampMesh);

    this.completed = [];      // {index, mesh, marks, z}
    this.MAX_KEEP = 26;
  }

  /** 完成済みリングをまとめて 1 メッシュにする（描画コール削減） */
  addCompleted(index, zc, pieces) {
    const geos = [], marks = [];
    const tmp = new THREE.Matrix4();
    for (const p of pieces) {
      p.mesh.updateMatrix();
      const g = p.mesh.geometry.clone();
      g.applyMatrix4(p.mesh.matrix);
      geos.push(g);
      if (p.mark) {
        p.mark.updateMatrix();
        const mg = p.mark.geometry.clone();
        // マークはセグメントの子なので、親の行列を掛けてリング座標へ移す
        tmp.multiplyMatrices(p.mesh.matrix, p.mark.matrix);
        mg.applyMatrix4(tmp);
        marks.push(mg);
      }
    }
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, this.concrete);
    mesh.position.z = zc;
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.group.add(mesh);

    let markMesh = null;
    if (marks.length) {
      const mm = mergeGeometries(marks, false);
      marks.forEach((g) => g.dispose());
      markMesh = new THREE.Mesh(mm, this.markMat);
      markMesh.position.z = zc;
      this.group.add(markMesh);
    }

    this.completed.push({ index, mesh, markMesh, z: zc });
    while (this.completed.length > this.MAX_KEEP) {
      const old = this.completed.shift();
      this.group.remove(old.mesh); old.mesh.geometry.dispose();
      if (old.markMesh) { this.group.remove(old.markMesh); old.markMesh.geometry.dispose(); }
    }
    this._refreshExtras();
    return mesh;
  }

  _refreshExtras() {
    const m4 = new THREE.Matrix4();
    let n = 0;
    for (const r of this.completed) {
      m4.identity(); m4.setPosition(0, 0, r.z);
      this.groutMesh.setMatrixAt(n, m4);
      n++;
    }
    this.groutMesh.count = n;
    this.groutMesh.instanceMatrix.needsUpdate = true;

    let l = 0;
    const q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1);
    for (const r of this.completed) {
      if (r.index % 2) continue;
      for (const side of [-1, 1]) {
        const a = (side > 0 ? 62 : 118) * D2R;
        pos.set(Math.cos(a) * (C.SEG_RI - 0.1), Math.sin(a) * (C.SEG_RI - 0.1), r.z);
        q.setFromEuler(new THREE.Euler(0, 0, a));
        m4.compose(pos, q, scl);
        this.lampMesh.setMatrixAt(l++, m4);
        if (l >= 40) break;
      }
      if (l >= 40) break;
    }
    this.lampMesh.count = l;
    this.lampMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * マークの小板。セグメント自身のローカル座標（中心角 0 = +X 方向）で作り、
   * セグメントメッシュの子として付ける。内面に貼り、法線は軸側(-X)を向く。
   */
  makeMark(idx) {
    const g = new THREE.PlaneGeometry(0.62, 0.62, 1, 1);
    const u0 = (idx % 2) * 0.5, v0 = 1 - (Math.floor(idx / 2) + 1) * 0.5;
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, u0 + uv.getX(i) * 0.5, v0 + uv.getY(i) * 0.5);
    }
    const m = new THREE.Mesh(g, this.markMat);
    m.position.set(C.SEG_RI + 0.014, 0, 0);
    m.rotation.set(0, -Math.PI / 2, 0);
    return m;
  }
}

/* ============================================================
 *  土砂（切羽 → スクリュー → ベルト → ズリ鋼車）
 * ============================================================ */
const SCREW_A = new THREE.Vector3(0, -2.62, 9.85);
const SCREW_B = new THREE.Vector3(0, -1.30, 6.15);

export class Muck {
  constructor(parent, capacity = 130) {
    const rand = mulberry32(41);
    const g = new THREE.DodecahedronGeometry(0.18, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(i, p.getX(i) * (0.6 + rand() * 0.9),
        p.getY(i) * (0.6 + rand() * 0.9), p.getZ(i) * (0.6 + rand() * 0.9));
    }
    g.computeVertexNormals();

    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.95, metalness: 0.02,
    }), capacity);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(capacity * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    parent.add(this.mesh);

    this.items = [];
    this.capacity = capacity;
    this.rand = rand;

    // ベルト経路
    this.beltCurve = new THREE.CatmullRomCurve3(BELT_PATH.map((v) => v.clone()), false, 'catmullrom', 0.02);
    this.beltLen = this.beltCurve.getLength();

    this._m4 = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._col = new THREE.Color();
  }

  spawn(headZ, color, hard) {
    if (this.items.length >= this.capacity) return;
    const r = this.rand;
    const a = r() * Math.PI * 2;
    const rr = 0.6 + r() * (C.HEAD_R - 1.0);
    this.items.push({
      st: 0, t: 0,
      p0: new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, headZ + 0.15),
      sc: 0.55 + r() * 0.85 * (0.6 + hard * 0.6),
      spin: new THREE.Vector3(r() * 6, r() * 6, r() * 6),
      rot: new THREE.Vector3(r() * 6, r() * 6, r() * 6),
      sway: r() * 6.28,
      lane: (r() - 0.5) * 0.9,
      color: new THREE.Color(color).offsetHSL(0, (r() - 0.5) * 0.06, (r() - 0.5) * 0.16),
      vel: new THREE.Vector3(0, 0, 0),
    });
  }

  update(dt, beltRunning) {
    const items = this.items;
    const chamber = new THREE.Vector3(0, -2.45, 9.9);
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.rot.x += it.spin.x * dt; it.rot.y += it.spin.y * dt; it.rot.z += it.spin.z * dt;
      if (it.st === 0) {
        // 切羽 → チャンバ底
        it.t += dt / 0.85;
        if (it.t >= 1) { it.st = 1; it.t = 0; continue; }
        const t = it.t;
        it.pos = it.p0.clone().lerp(chamber, t * t * (3 - 2 * t));
        it.pos.y += Math.sin(t * Math.PI) * 0.5 - t * 0.4;
        it.pos.z -= t * 0.5;
      } else if (it.st === 1) {
        // スクリューコンベアを螺旋で上がる
        it.t += dt / 2.0;
        if (it.t >= 1) { it.st = 2; it.t = 0; continue; }
        const t = it.t;
        const base = SCREW_A.clone().lerp(SCREW_B, t);
        const ang = t * Math.PI * 2 * 4 + it.sway;
        base.x += Math.cos(ang) * 0.28;
        base.y += Math.sin(ang) * 0.14;
        it.pos = base;
      } else if (it.st === 2) {
        // ベルトで後方へ
        it.t += (beltRunning ? dt / 5.0 : 0);
        if (it.t >= 1) { it.st = 3; it.t = 0; it.vel.set(0, -0.5, -1.2); continue; }
        const p = this.beltCurve.getPointAt(Math.min(0.999, it.t));
        p.x += it.lane;
        p.y += 0.14;
        it.pos = p;
        it.spin.set(0.4, 0.2, 0.3);
      } else {
        // シュートからズリ鋼車へ落下
        it.t += dt;
        it.vel.y -= 9.8 * dt * 0.35;
        if (!it.pos) { items.splice(i, 1); continue; }
        it.pos = it.pos.clone().addScaledVector(it.vel, dt);
        if (it.pos.y < -3.0 || it.t > 2.2) { items.splice(i, 1); continue; }
      }
    }

    // 描画
    const n = Math.min(items.length, this.capacity);
    for (let i = 0; i < n; i++) {
      const it = items[i];
      if (!it.pos) { this._m4.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, this._m4); continue; }
      this._e.set(it.rot.x, it.rot.y, it.rot.z);
      this._q.setFromEuler(this._e);
      this._s.set(it.sc, it.sc, it.sc);
      this._m4.compose(it.pos, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m4);
      this.mesh.setColorAt(i, it.color);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/* ============================================================
 *  粉じん・きらめき
 * ============================================================ */
export class Particles {
  constructor(parent, { count = 220, size = 0.55, tex, color = 0xd8c6a8, opacity = 0.5 } = {}) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.PointsMaterial({
      size, map: tex, color, transparent: true, opacity,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    parent.add(this.points);
    this.count = count;
    this.data = [];
    this.pos = pos;
    for (let i = 0; i < count; i++) this.data.push({ life: 0 });
    this.rand = mulberry32(97);
  }
  emit(x, y, z, spread, vel, life) {
    for (const d of this.data) {
      if (d.life <= 0) {
        const r = this.rand;
        d.life = life * (0.6 + r() * 0.8); d.max = d.life;
        d.x = x + (r() - 0.5) * spread;
        d.y = y + (r() - 0.5) * spread;
        d.z = z + (r() - 0.5) * spread * 0.5;
        d.vx = vel.x + (r() - 0.5) * 0.7;
        d.vy = vel.y + (r() - 0.5) * 0.7;
        d.vz = vel.z + (r() - 0.5) * 0.7;
        return;
      }
    }
  }
  update(dt) {
    let n = 0;
    for (let i = 0; i < this.count; i++) {
      const d = this.data[i];
      if (d.life > 0) {
        d.life -= dt;
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        d.vy -= 0.35 * dt;
        d.vx *= 0.985; d.vz *= 0.985;
        this.pos[n * 3] = d.x; this.pos[n * 3 + 1] = d.y; this.pos[n * 3 + 2] = d.z;
        n++;
      }
    }
    for (let i = n; i < this.count; i++) {
      this.pos[i * 3] = 0; this.pos[i * 3 + 1] = -9999; this.pos[i * 3 + 2] = 0;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

export function makeParticleTextures() {
  return { dust: makeDustTexture(), glow: makeGlowTexture('rgba(255,255,255,1)', 'rgba(160,220,255,0)') };
}
