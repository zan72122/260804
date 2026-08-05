// 養生シート：家具にかける布のドレープ、壁の吊りシート、床シート、一斉リムーブ
import * as THREE from 'three';
import { sheetTexture } from './textures.js';
import { ROOM } from './room.js';

let sheetTex = null;
function getSheetMat(opacity = 1) {
  if (!sheetTex) sheetTex = sheetTexture();
  return new THREE.MeshStandardMaterial({
    map: sheetTex,
    roughness: 0.92,
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    opacity,
  });
}

// 半透明の壁用ポリシート
function getPlasticMat() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xdfe9ee,
    roughness: 0.32,
    transparent: true,
    opacity: 0.62,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

export class SheetManager {
  constructor(scene, root) {
    this.scene = scene;
    this.root = root;
    this.sheets = [];       // { mesh, kind, sway, baseGeo }
    this.anims = [];        // 進行中アニメーション
    this.time = 0;
  }

  // ---- 家具の上にかける布（レイキャストでドレープ形状を計算） ----
  drapeOver(furnitureGroup, sizeX, sizeZ, centerX, centerZ, topY) {
    const seg = 22;
    const geo = new THREE.PlaneGeometry(sizeX, sizeZ, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const ray = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const heights = new Float32Array(pos.count);

    // 家具の高さ場をサンプリング（各点5レイの最大値で薄い角も拾う）
    const cellX = sizeX / seg, cellZ = sizeZ / seg;
    const offsets = [[0, 0], [0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]];
    for (let i = 0; i < pos.count; i++) {
      const wx = centerX + pos.getX(i);
      const wz = centerZ + pos.getZ(i);
      let h = 0.015;
      for (const [ox, oz] of offsets) {
        ray.set(new THREE.Vector3(wx + ox * cellX, 3.2, wz + oz * cellZ), down);
        const hits = ray.intersectObject(furnitureGroup, true);
        if (hits.length) h = Math.max(h, 3.2 - hits[0].distance);
      }
      heights[i] = h;
    }
    // 布のたわみ：隣接点より急に下がれない（距離変換で自然なドレープ）
    const n = seg + 1;
    const cell = Math.max(sizeX, sizeZ) / seg;
    const slope = cell * 0.85;
    for (let pass = 0; pass < n; pass++) {
      let changed = false;
      for (let iy = 0; iy < n; iy++) {
        for (let ix = 0; ix < n; ix++) {
          const i = iy * n + ix;
          let maxN = 0;
          if (ix > 0) maxN = Math.max(maxN, heights[i - 1]);
          if (ix < n - 1) maxN = Math.max(maxN, heights[i + 1]);
          if (iy > 0) maxN = Math.max(maxN, heights[i - n]);
          if (iy < n - 1) maxN = Math.max(maxN, heights[i + n]);
          const want = Math.max(heights[i], maxN - slope);
          if (want > heights[i] + 1e-4) { heights[i] = want; changed = true; }
        }
      }
      if (!changed) break;
    }
    // 軽いスムージング＋しわ
    const sm = heights.slice();
    for (let iy = 1; iy < n - 1; iy++) {
      for (let ix = 1; ix < n - 1; ix++) {
        const i = iy * n + ix;
        sm[i] = (heights[i] * 2 + heights[i - 1] + heights[i + 1] + heights[i - n] + heights[i + n]) / 6;
      }
    }
    // 布が家具より下がらないように（貫通防止）
    for (let i = 0; i < pos.count; i++) sm[i] = Math.max(sm[i], heights[i]);
    for (let i = 0; i < pos.count; i++) {
      const wrinkle = Math.sin(pos.getX(i) * 21 + pos.getZ(i) * 17) * 0.008
        + Math.sin(pos.getX(i) * 47 - pos.getZ(i) * 31) * 0.005;
      pos.setY(i, sm[i] + 0.05 + wrinkle);
    }
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, getSheetMat());
    mesh.position.set(centerX, 0, centerZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);

    // 落下アニメーション用に開始形状（上空で平ら）を持つ
    const targetY = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) targetY[i] = pos.getY(i);
    const startY = topY + 0.9;
    const rec = { mesh, kind: 'drape', geo, targetY, drop: 0, dropping: true, revealDelay: 0 };
    for (let i = 0; i < pos.count; i++) pos.setY(i, startY);
    pos.needsUpdate = true;
    this.sheets.push(rec);
    return rec;
  }

  // ---- 壁の吊りシート（半透明ポリ、上端をテープ留め） ----
  hangOnWall(kind, opts) {
    // kind: 'left' | 'right' | 'back'
    const { w, h } = opts;
    const geo = new THREE.PlaneGeometry(w, h, 20, 12);
    const mesh = new THREE.Mesh(geo, opts.cloth ? getSheetMat() : getPlasticMat());
    if (kind === 'left') {
      mesh.rotation.y = Math.PI / 2;
      mesh.position.set(ROOM.leftX + 0.1, h / 2 + 0.02, 0);
    } else if (kind === 'right') {
      mesh.rotation.y = -Math.PI / 2;
      mesh.position.set(ROOM.rightX - 0.1, h / 2 + 0.02, 0);
    } else {
      mesh.position.set(0, h / 2 + 0.02, ROOM.backZ + 0.06);
    }
    mesh.renderOrder = 2;
    this.root.add(mesh);
    // テープ
    const tapeMat = new THREE.MeshStandardMaterial({ color: 0xd9c896, roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const tape = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.012), tapeMat);
      tape.position.set(-w / 2 + (i + 0.5) * (w / 4), h / 2 - 0.02, 0.012);
      mesh.add(tape);
    }
    const rec = {
      mesh, kind: 'wall', geo, wallKind: kind,
      sway: Math.random() * Math.PI * 2,
      dropFrom: h + 1.2, dropping: false, dropT: 0,
    };
    this.sheets.push(rec);
    return rec;
  }

  // 上から降ろすアニメーション付きで壁シートを掛ける
  dropWallSheet(rec) {
    rec.dropping = true;
    rec.dropT = 0;
    rec.baseY = rec.mesh.position.y;
    rec.mesh.position.y = rec.baseY + 2.4;
  }

  // ---- 床のシート（しわのある大きな布・手前にめくり用の角） ----
  coverFloor() {
    const w = ROOM.W - 0.12, d = ROOM.D - 0.12;
    const geo = new THREE.PlaneGeometry(w, d, 30, 26);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = 0.02
        + Math.abs(Math.sin(x * 3.1) * Math.cos(z * 2.3)) * 0.035
        + Math.sin(x * 13 + z * 7) * 0.008;
      pos.setY(i, y);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, getSheetMat());
    mesh.position.set(0, 0, 0);
    mesh.receiveShadow = true;
    this.root.add(mesh);

    const targetY = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) targetY[i] = pos.getY(i);
    const rec = { mesh, kind: 'floor', geo, targetY, drop: 0, dropping: true };
    for (let i = 0; i < pos.count; i++) pos.setY(i, 1.6);
    pos.needsUpdate = true;
    this.sheets.push(rec);
    this.floorSheet = rec;
    return rec;
  }

  // ---- 毎フレーム更新 ----
  update(dt) {
    this.time += dt;
    for (const s of this.sheets) {
      if (s.removed) continue;
      if (s.kind === 'drape' || s.kind === 'floor') {
        if (s.dropping) {
          s.drop = Math.min(1, s.drop + dt * 1.9);
          const t = s.drop;
          // バウンドしながら着地
          const e = 1 - Math.pow(1 - t, 3);
          const bounce = t > 0.85 ? Math.sin((t - 0.85) / 0.15 * Math.PI) * 0.05 * (1 - t) : 0;
          const pos = s.geo.attributes.position;
          const startY = s.kind === 'floor' ? 1.6 : 2.4;
          for (let i = 0; i < pos.count; i++) {
            const wave = Math.sin(this.time * 9 + pos.getX(i) * 5) * 0.05 * (1 - e);
            pos.setY(i, startY + (s.targetY[i] - startY) * e + wave + bounce);
          }
          pos.needsUpdate = true;
          if (t >= 1) {
            s.dropping = false;
            for (let i = 0; i < pos.count; i++) pos.setY(i, s.targetY[i]);
            pos.needsUpdate = true;
            s.geo.computeVertexNormals();
          }
        }
      } else if (s.kind === 'wall') {
        if (s.dropping) {
          s.dropT = Math.min(1, s.dropT + dt * 1.7);
          const e = 1 - Math.pow(1 - s.dropT, 3);
          s.mesh.position.y = s.baseY + 2.4 * (1 - e);
          if (s.dropT >= 1) s.dropping = false;
        }
        // かすかな揺れ（生きている布感）
        const pos = s.geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i);
          const hang = THREE.MathUtils.clamp(1 - (y / (s.mesh.geometry.parameters.height / 2) + 1) / 2, 0, 1);
          pos.setZ(i, Math.sin(this.time * 1.3 + s.sway + x * 2.2 + y * 1.7) * 0.035 * (0.25 + hang));
        }
        pos.needsUpdate = true;
      } else if (s.kind === 'flyoff') {
        s.t += dt / s.dur;
        const t = Math.min(1, s.t);
        const e = t * t * (3 - 2 * t);
        s.mesh.position.lerpVectors(s.p0, s.p1, e);
        s.mesh.position.y += Math.sin(t * Math.PI) * s.arc;
        s.mesh.rotation.x = s.r0.x + s.spin.x * e;
        s.mesh.rotation.y = s.r0.y + s.spin.y * e;
        s.mesh.rotation.z = s.r0.z + s.spin.z * e;
        const sc = 1 - 0.55 * e;
        s.mesh.scale.set(sc, sc, sc);
        s.mesh.material.opacity = 1 - Math.max(0, (t - 0.55) / 0.45);
        s.mesh.material.transparent = true;
        if (t >= 1) {
          s.removed = true;
          this.root.remove(s.mesh);
          s.mesh.geometry.dispose();
        }
      }
    }
    // めくり中の床シート角
    if (this.pullGrab && this.floorSheet && !this.floorSheet.removed) {
      this.applyPull(this.pullGrab.amount);
    }
  }

  // ---- 大きなシートの「めくり」変形（引っぱり量 0..1） ----
  applyPull(amount) {
    const s = this.floorSheet;
    if (!s || s.removed || s.kind === 'flyoff') return;
    const pos = s.geo.attributes.position;
    const d = ROOM.D - 0.12;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      // 手前(z 大)から持ち上がる
      const front = THREE.MathUtils.clamp((z / (d / 2)), -1, 1);
      const lift = Math.max(0, front) * amount;
      pos.setY(i, s.targetY[i] + lift * (1.3 + Math.sin(x * 2.5) * 0.15));
    }
    pos.needsUpdate = true;
    s.geo.computeVertexNormals();
  }

  setPull(amount) {
    this.pullGrab = { amount };
  }

  releasePull() {
    if (!this.pullGrab) return;
    const start = this.pullGrab.amount;
    this.pullGrab = null;
    // ゆっくり元に戻す
    const s = this.floorSheet;
    if (!s || s.removed) return;
    const startTime = this.time;
    const settle = () => {
      const t = Math.min(1, (this.time - startTime) / 0.4);
      this.applyPull(start * (1 - t));
      if (t < 1 && !s.removed) requestAnimationFrame(settle);
    };
    settle();
  }

  // ---- 一斉リムーブ：全シートが順に飛んでいく ----
  flyOffAll(onEach) {
    let idx = 0;
    for (const s of this.sheets) {
      if (s.removed) continue;
      const delay = 0.12 + idx * 0.22;
      idx++;
      const rec = s;
      setTimeout(() => {
        if (rec.removed) return;
        const wp = new THREE.Vector3();
        rec.mesh.getWorldPosition(wp);
        rec.kind = 'flyoff';
        rec.t = 0;
        rec.dur = 0.9 + Math.random() * 0.3;
        rec.p0 = rec.mesh.position.clone();
        // 部屋の手前上方へ飛んで消える
        rec.p1 = rec.mesh.position.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 3 + (wp.x > 0 ? 2 : -2),
          2.6 + Math.random() * 1.2,
          3.4 + Math.random() * 1.4
        ));
        rec.arc = 0.7 + Math.random() * 0.5;
        rec.r0 = rec.mesh.rotation.clone();
        rec.spin = new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 5
        );
        rec.mesh.material = rec.mesh.material.clone();
        rec.mesh.material.transparent = true;
        if (onEach) onEach(rec, wp);
      }, delay * 1000);
    }
    return idx; // シート枚数
  }
}
