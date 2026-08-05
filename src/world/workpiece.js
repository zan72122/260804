// 木材そのもの。切る・磨く・組む状態を持ち、見た目が連続的に変わる。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  makeWoodTexture, createWoodMaterial, makePencilTexture, makeDashTexture,
  makeRoughFaceTexture, setMaterialSand,
} from '../core/materials.js';
import { makeContactShadow } from '../core/fx.js';
import { clamp, lerp } from '../core/util.js';

const _woodCache = new Map();
export function woodMaterial(wood) {
  if (!_woodCache.has(wood.id)) {
    const map = makeWoodTexture(wood);
    const mat = createWoodMaterial({ ...wood, map });
    _woodCache.set(wood.id, mat);
  }
  return _woodCache.get(wood.id);
}
export function resetWoodSand() {
  for (const m of _woodCache.values()) setMaterialSand(m, 0);
}

let _pencilTex = null, _dashTex = null, _roughTex = null;
const pencilTex = () => (_pencilTex ||= makePencilTexture());
const dashTex = () => (_dashTex ||= makeDashTexture('#ffffff'));
const roughTex = () => (_roughTex ||= makeRoughFaceTexture());

/** 角の丸い板ジオメトリ（穴あきにも対応） */
export function plankGeometry(w, h, d, hole = null) {
  if (!hole) {
    const r = Math.min(0.008, Math.min(w, h, d) * 0.28);
    return new RoundedBoxGeometry(w, h, d, 2, r);
  }
  const shape = new THREE.Shape();
  const rr = Math.min(0.02, Math.min(w, h) * 0.2);
  const x0 = -w / 2, y0 = -h / 2;
  shape.moveTo(x0 + rr, y0);
  shape.lineTo(x0 + w - rr, y0);
  shape.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + rr);
  shape.lineTo(x0 + w, y0 + h - rr);
  shape.quadraticCurveTo(x0 + w, y0 + h, x0 + w - rr, y0 + h);
  shape.lineTo(x0 + rr, y0 + h);
  shape.quadraticCurveTo(x0, y0 + h, x0, y0 + h - rr);
  shape.lineTo(x0, y0 + rr);
  shape.quadraticCurveTo(x0, y0, x0 + rr, y0);
  const path = new THREE.Path();
  path.absarc(0, hole.y ?? 0, hole.r, 0, Math.PI * 2, true);
  shape.holes.push(path);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1, curveSegments: 18 });
  geo.translate(0, 0, -d / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 作業対象の板。
 * ローカル軸: 長さ = X / 厚み = Y / 幅 = Z
 */
export class Plank {
  constructor({ len, thick, wide, wood, hole = null }) {
    this.len = len; this.thick = thick; this.wide = wide;
    this.wood = wood;
    this.hole = hole;
    this.group = new THREE.Group();
    this.mat = woodMaterial(wood);
    this.mesh = new THREE.Mesh(plankGeometry(len, thick, wide, hole), this.mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.userData.plank = this;
    this.group.add(this.mesh);
    this.shadow = makeContactShadow(Math.max(len, wide) * 1.25, 0.55);
    this.shadow.position.y = -thick / 2 + 0.001;
    this.group.add(this.shadow);
    this.sanded = 0;
    this.pencil = null;
    this.kerf = null;
    this.rough = null;
    this.clampedBy = null;
  }

  get object() { return this.group; }

  setPosition(x, y, z) { this.group.position.set(x, y, z); return this; }

  /** 上面のワールド Y */
  topY() { return this.group.position.y + this.thick / 2; }

  /** ローカル X（板の長手方向の位置）→ ワールド座標 */
  localToWorld(x, y = 0, z = 0) {
    return this.group.localToWorld(new THREE.Vector3(x, y, z));
  }

  /* ---------- 鉛筆の線 ---------- */
  ensurePencilLine(atX) {
    if (this.pencil) return this.pencil;
    const geo = new THREE.PlaneGeometry(0.018, this.wide * 1.02);
    const mat = new THREE.MeshBasicMaterial({
      map: pencilTex(), transparent: true, depthWrite: false, opacity: 1, toneMapped: false,
      color: '#6b5340',
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(atX, this.thick / 2 + 0.0012, 0);
    m.renderOrder = 3;
    m.scale.y = 0.001;
    this.group.add(m);
    this.pencil = m;
    return m;
  }
  /** 0..1 の進み具合で線が残っていく（指の後ろに線が残る） */
  setPencilProgress(t) {
    if (!this.pencil) return;
    const s = clamp(t, 0.0001, 1);
    this.pencil.scale.y = s;
    // 端から伸びるように位置を寄せる
    this.pencil.position.z = -this.wide * 1.02 / 2 + (this.wide * 1.02 * s) / 2;
  }

  /* ---------- 点線ガイド ---------- */
  addDashedGuide(atX) {
    const geo = new THREE.PlaneGeometry(0.02, this.wide * 1.05);
    const tex = dashTex().clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, Math.max(2, Math.round(this.wide * 26)));
    tex.wrapT = THREE.RepeatWrapping;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: '#ffffff', toneMapped: false, opacity: 0.95 });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(atX, this.thick / 2 + 0.0008, 0);
    m.renderOrder = 2;
    this.group.add(m);
    this.guide = m;
    return m;
  }
  removeGuide() {
    if (this.guide) { this.group.remove(this.guide); this.guide = null; }
  }

  /* ---------- のこぎりの切れ目 ---------- */
  ensureKerf(atX) {
    if (this.kerf) return this.kerf;
    const g = new THREE.Group();
    const w = 0.008;
    const geo = new THREE.BoxGeometry(w, 1, this.wide * 1.01);
    const mat = new THREE.MeshStandardMaterial({ color: '#6b4a2c', roughness: 1, metalness: 0 });
    const m = new THREE.Mesh(geo, mat);
    m.position.y = -0.5;   // 上端を原点に合わせる
    g.add(m);
    // 切り口のふち（少し明るい木肌）
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(w * 2.6, 0.004, this.wide * 1.01),
      new THREE.MeshStandardMaterial({ color: '#dcbb8b', roughness: 0.9 }),
    );
    edge.position.y = -0.001;
    g.add(edge);
    g.position.set(atX, this.thick / 2, 0);
    g.scale.y = 0.0001;
    this.group.add(g);
    this.kerf = g;
    this.kerfInner = m;
    return g;
  }
  setKerfDepth(d) {
    if (!this.kerf) return;
    this.kerf.scale.y = Math.max(0.0001, d);
  }

  /* ---------- 切断 ---------- */
  /** ローカル X で切り、[左, 右] の 2 本を返す */
  split(atX) {
    const leftLen = atX + this.len / 2;
    const rightLen = this.len / 2 - atX;
    const mk = (len, centerX) => {
      const p = new Plank({ len, thick: this.thick, wide: this.wide, wood: this.wood });
      p.group.position.copy(this.group.position);
      p.group.rotation.copy(this.group.rotation);
      p.group.translateX(centerX);
      p.parentWood = this.wood;
      return p;
    };
    const left = mk(leftLen, -this.len / 2 + leftLen / 2);
    const right = mk(rightLen, atX + rightLen / 2);
    left.cutFace = +1;   // 右端が切断面
    right.cutFace = -1;  // 左端が切断面
    return [left, right];
  }

  /* ---------- ざらざらの切断面（紙やすりで消す層） ---------- */
  addRoughFace(side = +1) {
    const S = 128;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, S, S);
    const alphaTex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshStandardMaterial({
      map: roughTex(),
      alphaMap: alphaTex,
      transparent: true,
      roughness: 1.0,
      metalness: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const geo = new THREE.PlaneGeometry(this.wide * 0.96, this.thick * 0.96);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    m.position.set(side * (this.len / 2 + 0.0018), 0, 0);
    m.renderOrder = 4;
    m.userData.roughFace = true;
    this.group.add(m);
    this.rough = { mesh: m, canvas: c, ctx: g, tex: alphaTex, size: S, coverage: 0 };
    return this.rough;
  }
  /** uv 位置（0..1）を削る */
  sandAt(u, v, radius = 0.16) {
    const r = this.rough;
    if (!r) return 0;
    const g = r.ctx;
    const S = r.size;
    const x = u * S, y = (1 - v) * S;
    const rad = radius * S;
    g.save();
    g.globalCompositeOperation = 'destination-out';
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)');
    grd.addColorStop(0.7, 'rgba(0,0,0,0.28)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
    g.restore();
    r.tex.needsUpdate = true;
    return this.roughCoverage();
  }
  roughCoverage() {
    const r = this.rough;
    if (!r) return 1;
    const d = r.ctx.getImageData(0, 0, r.size, r.size).data;
    let clear = 0, tot = 0;
    for (let i = 3; i < d.length; i += 4 * 7) {
      tot++;
      if (d[i] < 90) clear++;
    }
    r.coverage = tot ? clear / tot : 0;
    return r.coverage;
  }
  finishSanding() {
    const r = this.rough;
    if (!r) return;
    r.ctx.clearRect(0, 0, r.size, r.size);
    r.tex.needsUpdate = true;
    this.sanded = 1;
    setMaterialSand(this.mat, 1);
  }
  removeRough() {
    if (this.rough) {
      this.group.remove(this.rough.mesh);
      this.rough.mesh.geometry.dispose();
      this.rough.mesh.material.dispose();
      this.rough = null;
    }
  }

  setShadowVisible(v) { this.shadow.visible = v; }
  dispose(scene) {
    if (this.group.parent) this.group.parent.remove(this.group);
    this.mesh.geometry.dispose();
  }
}

/** 組み立て後の部品（板と同じマテリアルを使うが、切断状態は持たない） */
export function makePartMesh(size, wood, hole = null) {
  const [w, h, d] = size;
  const mesh = new THREE.Mesh(plankGeometry(w, h, d, hole), woodMaterial(wood));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** 完成見本（半透明シルエット） */
export function makeGhost(size, hole = null) {
  const [w, h, d] = size;
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.35,
    roughness: 0.35,
    metalness: 0,
    depthWrite: false,
    emissive: '#fff0c8',
    emissiveIntensity: 0.35,
  });
  const mesh = new THREE.Mesh(plankGeometry(w, h, d, hole), mat);
  mesh.renderOrder = 2;
  return mesh;
}
