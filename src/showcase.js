// Two side scenes that share the renderer with the game:
//   Reveal — the "you got it!" close-up of the prize
//   Room   — おへや, where every toy you have won actually lives

import * as THREE from '../vendor/three/three.module.min.js';
import { Plush, SPECIES_INFO } from './plush.js';
import { wallpaperTexture, softBlob, matTexture } from './textures.js';
import { plasticMaterial } from './materials.js';
import { clamp, easeOutBack, lerp } from './util.js';

/* ------------------------------------------------------------------ */
/* Reveal                                                              */
/* ------------------------------------------------------------------ */

export class RevealScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a2340);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);

    this.scene.add(new THREE.HemisphereLight(0xfff0e0, 0x50406a, 1.0));
    const key = new THREE.DirectionalLight(0xfff4e6, 2.4);
    key.position.set(2.2, 3.4, 3.0);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xa9d0ff, 1.3);
    rim.position.set(-2.6, 1.4, -2.2);
    this.scene.add(rim);
    const fill = new THREE.PointLight(0xffc8e0, 2.0, 8, 2);
    fill.position.set(-1.2, 0.4, 1.8);
    this.scene.add(fill);

    // warm pool of light the toy sits in
    const disc = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 4.4),
      new THREE.MeshBasicMaterial({ map: softBlob('255,200,140', 0.85), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    disc.position.set(0, 0, -1.6);
    this.scene.add(disc);
    this.disc = disc;

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.9),
      new THREE.MeshBasicMaterial({ map: softBlob('30,10,40', 0.8), transparent: true, depthWrite: false, opacity: 0.55 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.92;
    this.scene.add(shadow);
    this.shadow = shadow;

    this.holder = new THREE.Group();
    this.scene.add(this.holder);

    this._sparkles();
    this.t = 0;
    this.plush = null;
  }

  _sparkles() {
    const N = 90;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    this.sparkSeed = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.7 + Math.random() * 1.7;
      this.sparkSeed.push({ a, r, y: -1 + Math.random() * 2.6, sp: 0.4 + Math.random() * 1.2, ph: Math.random() * 6.28 });
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      size: 0.075, map: softBlob('255,245,200', 1), transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9, sizeAttenuation: true,
    });
    this.sparkles = new THREE.Points(g, m);
    this.scene.add(this.sparkles);
  }

  show(record, quality = 1) {
    this.clear();
    const p = new Plush(record.species, record.variant, { quality: 1, fuzz: quality > 0.4, seed: 4242 });
    this.holder.add(p.root);

    // fit by measured height, not a magic number — a rabbit's ears and a
    // chick's body must both land at the same size on screen
    p.root.scale.setScalar(1);
    p.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(p.root);
    const h = Math.max(0.2, box.max.y - box.min.y);
    const scale = 2.25 / h;
    this.baseScale = scale;
    this.baseY = -((box.min.y + box.max.y) / 2) * scale - 0.05;
    p.root.scale.setScalar(scale);
    p.root.position.y = this.baseY;
    this.shadow.position.y = box.min.y * scale + this.baseY - 0.1;
    this.shadow.scale.setScalar(Math.max(0.6, (box.max.x - box.min.x) * scale * 0.8));

    this.plush = p;
    this.t = 0;
    this.name = SPECIES_INFO[record.species]?.name ?? '';
  }

  clear() {
    if (this.plush) {
      this.holder.remove(this.plush.root);
      this.plush.dispose();
      this.plush = null;
    }
  }

  resize(w, h) {
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 0.8 ? 44 : 36;
    const dist = aspect < 0.8 ? 4.7 : 5.2;
    this.camera.position.set(0.35, 0.55, dist);
    this.camera.lookAt(0, -0.02, 0);
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    if (this.plush) {
      const pop = easeOutBack(clamp(t / 0.55, 0, 1));
      const s = this.baseScale * lerp(0.55, 1, pop);
      this.plush.root.scale.setScalar(s);
      this.plush.root.rotation.y = -0.5 + Math.sin(t * 0.55) * 0.55;
      this.plush.root.position.y = this.baseY + Math.sin(t * 1.5) * 0.045;
      // let the limbs swing from the presentation turn
      _v.set(Math.cos(t * 0.55) * 0.3, Math.cos(t * 1.5) * 0.07, 0);
      this.plush.update(dt, _v, 1);
      if (t < 0.6) this.plush.setSquash(0.25 * (1 - t / 0.6));
      else this.plush.setSquash(0.04 + Math.sin(t * 1.5) * 0.03);
    }
    const pos = this.sparkles.geometry.attributes.position;
    for (let i = 0; i < this.sparkSeed.length; i++) {
      const s = this.sparkSeed[i];
      const y = ((s.y + t * s.sp) % 3.2) - 1.3;
      const a = s.a + t * 0.25;
      const r = s.r + Math.sin(t * 0.8 + s.ph) * 0.12;
      pos.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r - 0.4);
    }
    pos.needsUpdate = true;
    this.sparkles.material.opacity = 0.35 + Math.sin(t * 3) * 0.12;
  }
}

/* ------------------------------------------------------------------ */
/* Collection room                                                     */
/* ------------------------------------------------------------------ */

export class RoomScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
    this.scene.background = new THREE.Color(0xf3dfc8);

    this.scene.add(new THREE.HemisphereLight(0xfff4e2, 0x7a6050, 0.5));
    const key = new THREE.DirectionalLight(0xfff0d8, 1.9);
    key.position.set(2.6, 4.2, 3.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const c = key.shadow.camera;
    c.left = -4; c.right = 4; c.top = 4; c.bottom = -4; c.near = 1; c.far = 14;
    key.shadow.bias = -0.0015;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);
    const warm = new THREE.PointLight(0xffd9a0, 1.5, 9, 2);
    warm.position.set(-2.2, 2.2, 1.6);
    this.scene.add(warm);

    // floor
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xd9a86f, roughness: 0.72, metalness: 0.02 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), woodMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // rug
    const rugTex = matTexture();
    const rug = new THREE.Mesh(
      new THREE.CircleGeometry(3.1, 48),
      new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.95, color: 0xffc9dd })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = 0.004;
    rug.receiveShadow = true;
    this.scene.add(rug);

    // walls
    const wallMat = new THREE.MeshStandardMaterial({ map: wallpaperTexture(), roughness: 0.9, color: 0xf2dcbe });
    wallMat.map.repeat.set(4, 2);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), wallMat);
    back.position.set(0, 4, -5);
    back.receiveShadow = true;
    this.scene.add(back);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), wallMat);
    side.rotation.y = Math.PI / 2;
    side.position.set(-6.5, 4, 0);
    this.scene.add(side);

    // skirting + a low shelf for depth
    const trim = plasticMaterial(0xfff6ea, { roughness: 0.5, metalness: 0 });
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(16, 0.34, 0.12), trim);
    skirt.position.set(0, 0.17, -4.94);
    this.scene.add(skirt);

    const shelf = new THREE.Group();
    this.scene.add(shelf);
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0xf6d9bb, roughness: 0.6 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.16, 0.9), shelfMat);
    board.position.set(0, 1.05, -4.2);
    board.castShadow = true; board.receiveShadow = true;
    shelf.add(board);
    for (const x of [-2.2, 0, 2.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.05, 0.7), shelfMat);
      leg.position.set(x, 0.52, -4.2);
      leg.castShadow = true;
      shelf.add(leg);
    }
    this.shelfY = 1.13;

    // window light patch on the floor, sells "afternoon in a kid's room"
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(4.5, 4.5),
      new THREE.MeshBasicMaterial({ map: softBlob('255,225,170', 0.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(1.4, 0.008, 1.2);
    this.scene.add(patch);

    /** @type {Plush[]} */
    this.plushes = [];
    this.picks = [];
    this.shadows = [];
    this.raycaster = new THREE.Raycaster();
    this.t = 0;
    this.reactionOrder = ['hop', 'wave', 'tilt', 'spin'];
    this.reactionIdx = 0;
  }

  clear() {
    for (const p of this.plushes) {
      this.scene.remove(p.root);
      p.dispose();
    }
    for (const s of this.picks) this.scene.remove(s);
    for (const s of this.shadows) this.scene.remove(s);
    this.plushes.length = 0;
    this.picks.length = 0;
    this.shadows.length = 0;
    if (this.ghost) { this.scene.remove(this.ghost); this.ghost = null; }
  }

  /** @param {{species:string,variant:number}[]} records */
  populate(records, quality = 1) {
    this.clear();
    const list = records.slice(-24);
    this.count = list.length;

    if (list.length === 0) {
      // a soft ghost so the empty room still explains itself visually
      const g = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 20, 14),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false })
      );
      g.position.set(0, 0.45, 0);
      g.scale.set(1, 1.15, 1);
      this.scene.add(g);
      this.ghost = g;
      this.rows = 1;
      this.cols = 3;
      this.layoutCam();
      return;
    }

    const portrait = (this._aspect || 1) < 1;
    const cols = clamp(Math.ceil(Math.sqrt(list.length * (portrait ? 0.45 : 2.0))), portrait ? 2 : 3, portrait ? 4 : 6);
    const rows = Math.ceil(list.length / cols);
    this.cols = cols;
    const gapX = 0.94, gapZ = 0.9;

    list.forEach((rec, i) => {
      const p = new Plush(rec.species, rec.variant, {
        quality, fuzz: quality > 0.5, seed: 1000 + i,
        detail: list.length <= 9 ? 'hero' : 'game',
      });
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = (col - (cols - 1) / 2) * gapX + (row % 2 ? 0.16 : -0.16);
      const z = 1.1 - row * gapZ;
      const scale = 1.6;
      p.root.scale.setScalar(scale);
      p.root.position.set(x, p.size * 0.93 * scale, z);
      p.root.rotation.y = -0.35 + ((i * 37) % 70) / 100;
      p.root.traverse((o) => { if (o.isMesh) o.castShadow = o.castShadow || false; });
      p.rememberPose();
      this.scene.add(p.root);
      this.plushes.push(p);

      // generous invisible hit sphere — small fingers, no precision required
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(p.size * 1.45 * scale, 8, 6),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.copy(p.root.position);
      hit.userData.plush = p;
      this.scene.add(hit);
      this.picks.push(hit);

      // grounded contact shadow — soft room light alone leaves them floating
      const sh = new THREE.Mesh(
        new THREE.PlaneGeometry(p.size * 3.4 * scale, p.size * 3.4 * scale),
        new THREE.MeshBasicMaterial({ map: softBlob('90,50,30', 0.65), transparent: true, depthWrite: false, opacity: 0.5 })
      );
      sh.rotation.x = -Math.PI / 2;
      sh.position.set(x, 0.012, z);
      this.scene.add(sh);
      this.shadows.push(sh);
    });

    this.rows = rows;
    this.layoutCam();
  }

  /** Frame whatever is actually in the room (projected fit, like the arcade). */
  layoutCam() {
    const aspect = this._aspect || 1;
    const portrait = aspect < 1.0;
    const fov = portrait ? 44 : 38;
    const el = (portrait ? 33 : 23) * Math.PI / 180;
    this.camera.fov = fov;
    this.camera.aspect = aspect;

    // bounding box of the toys (or a default patch of rug when empty)
    let minX = -1.1, maxX = 1.1, minZ = -0.7, maxZ = 0.9, top = 1.0;
    if (this.plushes.length) {
      minX = Infinity; maxX = -Infinity; minZ = Infinity; maxZ = -Infinity; top = 0;
      for (const p of this.plushes) {
        const r = p.size * 1.5 * p.root.scale.x;
        minX = Math.min(minX, p.root.position.x - r);
        maxX = Math.max(maxX, p.root.position.x + r);
        minZ = Math.min(minZ, p.root.position.z - r);
        maxZ = Math.max(maxZ, p.root.position.z + r);
        top = Math.max(top, p.root.position.y + r);
      }
    }
    const corners = [];
    for (const x of [minX, maxX]) for (const y of [0, top]) for (const z of [minZ, maxZ]) {
      corners.push(new THREE.Vector3(x, y, z));
    }

    const dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el));
    const target = new THREE.Vector3((minX + maxX) / 2, top * 0.45, (minZ + maxZ) / 2);
    let dist = 7;
    const mx = 0.94, my = 0.9;
    const project = () => {
      this.camera.position.copy(target).addScaledVector(dir, dist);
      this.camera.lookAt(target);
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld(true);
      let nx = -Infinity, ny = -Infinity, lo = Infinity, hi = -Infinity;
      for (const c of corners) {
        const p = _p3.copy(c).project(this.camera);
        nx = Math.max(nx, Math.abs(p.x)); ny = Math.max(ny, Math.abs(p.y));
        lo = Math.min(lo, p.y); hi = Math.max(hi, p.y);
      }
      return { nx, ny, lo, hi };
    };
    let b = project();
    for (let i = 0; i < 6; i++) {
      const k = Math.max(b.nx / mx, b.ny / my);
      dist *= 0.35 + 0.65 * k;
      b = project();
      if (Math.abs(k - 1) < 0.005) break;
    }
    // lift the group a touch above centre so the "あそぶ" button never covers it
    const halfH = Math.tan((fov * Math.PI) / 360) * dist;
    target.y += ((b.lo + b.hi) / 2 - 0.05) * halfH;
    this.camera.position.copy(target).addScaledVector(dir, dist);
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
    this.camTarget = target;
  }

  resize(w, h) {
    this._aspect = w / h;
    this.camera.aspect = this._aspect;
    this.layoutCam();
  }

  /** @returns {Plush|null} the toy that was touched */
  pick(nx, ny) {
    if (!this.picks.length) return null;
    this.raycaster.setFromCamera(_v2.set(nx, ny), this.camera);
    const hits = this.raycaster.intersectObjects(this.picks, false);
    if (!hits.length) return null;
    return hits[0].object.userData.plush;
  }

  react(plush) {
    const kind = this.reactionOrder[this.reactionIdx % this.reactionOrder.length];
    this.reactionIdx++;
    plush.rememberPose();
    plush.playReaction(kind);
    if (kind === 'hop') plush.impact(0.6);
    return kind;
  }

  update(dt) {
    this.t += dt;
    for (const p of this.plushes) {
      p.updateReaction(dt);
      // a barely-there idle sway keeps the room alive without looking animatronic
      const sway = Math.sin(this.t * 0.9 + p.root.position.x * 2.1) * 0.16;
      p.update(dt, _v.set(sway, 0, 0), 0.15);
    }
    if (this.ghost) {
      this.ghost.position.y = 0.45 + Math.sin(this.t * 1.6) * 0.06;
      this.ghost.material.opacity = 0.16 + Math.sin(this.t * 2.2) * 0.05;
    }
  }
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector2();
const _p3 = new THREE.Vector3();
