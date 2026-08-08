// 根鉢（＝地面から抜ける円錐台の土のかたまり）。移植先の「土の栓」も同じクラス。
import * as THREE from '../vendor/three.module.js';
import * as TEX from './textures.js';
import { makeRng, rr, lerp, clamp01 } from './util.js';
import { DIM, applyCutaway, makeConeWallGeometry, mergeGeoms } from './world.js';

export class Plug {
  /**
   * @param soil 土質定義
   * @param opts { grassTone, withCutRoots:[{p,r}], seed }
   */
  constructor(soil, opts = {}) {
    const D = DIM;
    const seed = opts.seed || 1;
    const rng = makeRng(seed * 131 + 7);
    this.group = new THREE.Group();
    this.soil = soil;

    const topR = D.BALL_TOP_R, botR = D.BALL_BOT_R, depth = D.BALL_DEPTH;
    this.topR = topR; this.depth = depth;

    // --- 側面（切られた土の断面） ---
    const sideMap = TEX.soilTexture(soil.seed + 1, soil.wet, 0.0);
    sideMap.repeat.set(3.2, 1.5);
    const sideMat = applyCutaway(new THREE.MeshStandardMaterial({
      map: sideMap, bumpMap: TEX.soilBumpTexture(soil.seed + 1), bumpScale: 1.15,
      emissiveMap: sideMap, emissive: 0x000000,
      color: new THREE.Color(0.95, 0.90, 0.84),
      roughness: 1.0, metalness: 0.0, side: THREE.DoubleSide,
    }));
    this.sideMat = sideMat;
    const sideGeo = makeConeWallGeometry(topR, botR, depth, 44, 10, 0.055, seed + 3);
    this.side = new THREE.Mesh(sideGeo, sideMat);
    this.side.castShadow = true;
    this.side.receiveShadow = true;
    this.group.add(this.side);

    // --- 底（丸みのある切断面） ---
    const botGeo = new THREE.SphereGeometry(botR * 1.06, 20, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
    botGeo.scale(1, 0.55, 1);
    botGeo.translate(0, -depth + 0.02, 0);
    const bp = botGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const n = (rng() - 0.5) * 0.07;
      bp.setXYZ(i, bp.getX(i) * (1 + n), bp.getY(i) + n * 0.5, bp.getZ(i) * (1 + n));
    }
    botGeo.computeVertexNormals();
    this.bottom = new THREE.Mesh(botGeo, sideMat);
    this.bottom.castShadow = true;
    this.group.add(this.bottom);

    // --- 上面（草） ---
    const capMat = applyCutaway(new THREE.MeshStandardMaterial({
      map: TEX.grassTexture(11, opts.grassTone || [96, 132, 62]),
      roughness: 0.97, metalness: 0.0,
    }));
    capMat.map.repeat.set(0.62, 0.62);
    this.capMat = capMat;
    const capGeo = new THREE.CircleGeometry(DIM.HOLE_R + 0.02, 44);
    capGeo.rotateX(-Math.PI / 2);
    const cp = capGeo.attributes.position;
    const cuv = capGeo.attributes.uv;
    for (let i = 0; i < cp.count; i++) {
      cuv.setXY(i, cp.getX(i) / 6 + 0.5, cp.getZ(i) / 6 + 0.5);
    }
    this.cap = new THREE.Mesh(capGeo, capMat);
    this.cap.position.y = 0.005;
    this.cap.receiveShadow = true;
    this.group.add(this.cap);

    // --- 上面のふち（土がのぞく） ---
    const lipMat = sideMat;
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(DIM.HOLE_R + 0.018, topR * 0.995, 0.18, 44, 1, true), lipMat);
    lip.position.y = -0.085;
    this.group.add(lip);

    // --- 切られた根の断面 ---
    const stubGeos = [];
    const pale = new THREE.Color(0xd9c39a);
    const list = (opts.withCutRoots || []).slice(0, 34);
    for (const c of list) {
      const g = new THREE.CylinderGeometry(c.r * 1.15, c.r * 0.9, 0.12, 6);
      const p = c.p.clone();
      const radial = new THREE.Vector3(p.x, 0, p.z);
      const rl = radial.length() || 0.001;
      // 側面から少しだけ出す
      const dir = new THREE.Vector3(p.x / rl, 0.32, p.z / rl).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      g.applyQuaternion(q);
      g.translate(p.x, p.y, p.z);
      stubGeos.push(g);
    }
    // 表面付近の細根
    for (let i = 0; i < 30; i++) {
      const v = rr(rng, 0.15, 0.95);
      const r = lerp(topR, botR, v) * 0.99;
      const a = rng() * Math.PI * 2;
      const g = new THREE.CylinderGeometry(0.017, 0.008, rr(rng, 0.10, 0.26), 4);
      const p = new THREE.Vector3(Math.cos(a) * r, -depth * v, Math.sin(a) * r);
      const dir = new THREE.Vector3(Math.cos(a), rr(rng, -0.4, 0.6), Math.sin(a)).normalize();
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
      g.translate(p.x, p.y, p.z);
      stubGeos.push(g);
    }
    if (stubGeos.length) {
      const stubMat = applyCutaway(new THREE.MeshStandardMaterial({
        color: pale, roughness: 0.9, metalness: 0,
      }));
      this.stubs = new THREE.Mesh(mergeGeoms(stubGeos), stubMat);
      this.group.add(this.stubs);
    }

    // --- 下にぶら下がる土のかたまり（抜けた後の「重さ」表現） ---
    const clumpGeos = [];
    for (let i = 0; i < 7; i++) {
      const a = rng() * Math.PI * 2;
      const v = rr(rng, 0.55, 0.98);
      const r = lerp(topR, botR, v) * rr(rng, 0.5, 0.95);
      const s = rr(rng, 0.12, 0.30);
      const g = new THREE.IcosahedronGeometry(s, 0);
      g.scale(1, 1.5, 1);
      g.translate(Math.cos(a) * r, -depth * v - s * 0.6, Math.sin(a) * r);
      clumpGeos.push(g);
    }
    this.clumps = new THREE.Mesh(mergeGeoms(clumpGeos), sideMat);
    this.clumps.visible = false;
    this.clumps.castShadow = true;
    this.group.add(this.clumps);

    // 湿り具合（水やり）
    this.wetness = 0;
  }

  setDangling(on) { this.clumps.visible = on; }

  setWetness(v) {
    v = clamp01(v);
    if (Math.abs(v - this.wetness) < 0.01) return;
    this.wetness = v;
    const k = 1 - v * 0.45;
    this.sideMat.color.setRGB(k, k * 0.985, k * 0.97);
    this.sideMat.roughness = lerp(1.0, 0.55, v);
  }

  // 土粒を出す位置（側面上のランダム点）
  randomSurfacePoint(rng) {
    const v = rng();
    const r = lerp(this.topR, DIM.BALL_BOT_R, v);
    const a = rng() * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * r, -this.depth * v, Math.sin(a) * r);
  }

  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}
