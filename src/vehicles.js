/**
 * ダンプカー と ロードローラー
 */
import * as THREE from 'three';
import { clamp, lerp, damp, roundedBox, matteMaterial, addMesh, bakeStatic, easeInOutCubic } from './util.js';
import { AREA, GRADE } from './terrain.js';

/* =======================================================
   ダンプカー
   ======================================================= */

export class DumpTruck {
  constructor(opts = {}) {
    this.group = new THREE.Group();
    this.home = new THREE.Vector3(opts.x ?? -12.1, 0, opts.z ?? -1.8);
    this.exitDir = opts.exitDir ?? -1;          // -1 = ひだりへ さっていく
    this.facing = (this.exitDir > 0 ? 1 : -1) * Math.PI / 2;
    this.group.position.copy(this.home);
    this.group.rotation.y = this.facing;

    this.fill = 0;
    this.fillShown = 0;
    this.bounce = 0;
    this.wheelSpin = 0;
    this.state = 'parked';   // parked | leaving | gone | arriving
    this.t = 0;

    this._build();
    // ダンプの あな（ここに おとせば OK）の ワールドいち
    this.dropPoint = new THREE.Vector3();
    this.updateDropPoint();
  }

  _build() {
    const red = matteMaterial('#e8503a', { roughness: 0.42, metalness: 0.12 });
    const redD = matteMaterial('#c53f2d', { roughness: 0.5 });
    const dark = matteMaterial('#39404b', { roughness: 0.7, metalness: 0.2 });
    const steel = matteMaterial('#9aa2ad', { roughness: 0.3, metalness: 0.6 });
    const glass = matteMaterial('#5f7f96', { roughness: 0.08, metalness: 0.25 });
    const bedMat = matteMaterial('#f0b429', { roughness: 0.45, metalness: 0.15 });
    const bedIn = matteMaterial('#d69a1e', { roughness: 0.6 });

    const body = new THREE.Group();
    this.group.add(body);
    this.body = body;

    // シャーシ
    addMesh(body, roundedBox(1.9, 0.3, 4.6, 0.08), dark, [0, 0.62, 0]);

    // うんてんせき（まえ = +Z）
    addMesh(body, roundedBox(2.0, 1.15, 1.5, 0.16), red, [0, 1.32, 1.5]);
    addMesh(body, roundedBox(1.86, 0.62, 0.08, 0.03), glass, [0, 1.62, 2.26]);
    addMesh(body, roundedBox(0.08, 0.55, 1.1, 0.03), glass, [1.0, 1.6, 1.45]);
    addMesh(body, roundedBox(0.08, 0.55, 1.1, 0.03), glass, [-1.0, 1.6, 1.45]);
    addMesh(body, roundedBox(2.06, 0.14, 1.56, 0.06), redD, [0, 1.92, 1.5]);
    // ボンネット と バンパー
    addMesh(body, roundedBox(1.96, 0.5, 0.5, 0.1), red, [0, 1.0, 2.42]);
    addMesh(body, roundedBox(2.1, 0.26, 0.24, 0.08), steel, [0, 0.72, 2.62]);
    const lamp = matteMaterial('#fff4cf', { roughness: 0.25, extra: { emissive: new THREE.Color('#ffe9a8'), emissiveIntensity: 0.6 } });
    addMesh(body, roundedBox(0.34, 0.2, 0.08, 0.04), lamp, [0.7, 1.02, 2.68]);
    addMesh(body, roundedBox(0.34, 0.2, 0.08, 0.04), lamp, [-0.7, 1.02, 2.68]);

    // にだい（うしろ）— タイヤの うえに のせる
    const bed = new THREE.Group();
    bed.position.set(0, 1.06, -0.55);
    body.add(bed);
    this.bed = bed;
    addMesh(bed, roundedBox(2.3, 0.18, 3.1, 0.05), bedMat, [0, 0.1, 0]);        // ゆか
    addMesh(bed, roundedBox(0.14, 0.8, 3.1, 0.05), bedMat, [1.08, 0.52, 0]);    // よこ
    addMesh(bed, roundedBox(0.14, 0.8, 3.1, 0.05), bedMat, [-1.08, 0.52, 0]);
    addMesh(bed, roundedBox(2.3, 0.92, 0.14, 0.05), bedMat, [0, 0.58, -1.55]);  // うしろ
    addMesh(bed, roundedBox(2.3, 0.8, 0.14, 0.05), bedIn, [0, 0.52, 1.55]);     // まえ
    addMesh(bed, roundedBox(2.36, 0.1, 0.14, 0.04), bedIn, [0, 0.98, 1.55]);
    // フェンダー
    for (const s of [-1, 1]) {
      addMesh(body, roundedBox(0.3, 0.12, 2.2, 0.05), redD, [s * 1.05, 1.02, -1.1]);
    }

    // つみに（つち）
    const soilMat = matteMaterial('#7d5636', { roughness: 0.98 });
    const soilGeo = new THREE.SphereGeometry(1, 20, 12);
    this.soil = new THREE.Mesh(soilGeo, soilMat);
    this.soil.position.set(0, 0.16, 0);
    this.soil.castShadow = true;
    this.soil.receiveShadow = true;
    this.soil.visible = false;
    bed.add(this.soil);

    // タイヤ
    this.wheels = [];
    const tireGeo = new THREE.CylinderGeometry(0.56, 0.56, 0.44, 18);
    tireGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.48, 12);
    rimGeo.rotateZ(Math.PI / 2);
    for (const [x, z] of [[1.0, 1.55], [-1.0, 1.55], [1.02, -0.7], [-1.02, -0.7], [1.02, -1.55], [-1.02, -1.55]]) {
      const w = new THREE.Group();
      w.position.set(x, 0.56, z);
      addMesh(w, tireGeo, dark);
      addMesh(w, rimGeo, matteMaterial('#e3e6ea', { roughness: 0.35, metalness: 0.4 }));
      body.add(w);
      this.wheels.push(w);
    }

    this.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  updateDropPoint() {
    this.group.updateMatrixWorld(true);
    this.dropPoint.set(0, 1.9, -0.55).applyMatrix4(this.group.matrixWorld);
  }

  addSoil(amount) {
    this.fill = clamp(this.fill + amount, 0, 1);
    this.bounce = Math.min(1, this.bounce + amount * 2.2);
    return this.fill;
  }

  leave() { if (this.state === 'parked') { this.state = 'leaving'; this.t = 0; } }

  reset() {
    this.fill = 0;
    this.fillShown = 0;
    this.state = 'parked';
    this.t = 0;
    this.group.position.copy(this.home);
    this.group.rotation.y = this.facing;
    this.updateDropPoint();
  }

  update(dt) {
    this.fillShown = damp(this.fillShown, this.fill, 6, dt);
    const f = this.fillShown;
    this.soil.visible = f > 0.01;
    this.soil.scale.set(
      1.02 * Math.min(1, 0.68 + f * 0.5),
      0.28 + f * 0.5,
      1.5 * Math.min(1, 0.7 + f * 0.5)
    );
    this.soil.position.y = 0.06 + f * 0.34;

    // サスペンションの ゆれ
    if (this.bounce > 0.0001) {
      this.body.position.y = -Math.sin(this.bounce * 22) * this.bounce * 0.06;
      this.body.rotation.x = Math.sin(this.bounce * 18) * this.bounce * 0.018;
      this.bounce = Math.max(0, this.bounce - dt * 1.9);
    } else {
      this.body.position.y = 0;
      this.body.rotation.x = 0;
    }

    if (this.state === 'leaving') {
      this.t += dt;
      const speed = Math.min(6.5, this.t * 3.4);
      this.group.position.x += speed * dt * this.exitDir;
      this.wheelSpin += speed * dt / 0.56;
      for (const w of this.wheels) w.rotation.x = this.wheelSpin;
      if (Math.abs(this.group.position.x - this.home.x) > 30) this.state = 'gone';
    }
    return this;
  }
}

/* =======================================================
   ロードローラー
   ======================================================= */

export class RoadRoller {
  constructor(terrain, opts = {}) {
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.home = new THREE.Vector3(opts.x ?? AREA.minX - 3.4, 0, opts.z ?? 0);
    this.group.position.copy(this.home);
    this.group.rotation.y = Math.PI / 2; // +X むき

    this.pos = new THREE.Vector2(this.home.x, this.home.z);
    this.target = new THREE.Vector2(this.home.x, this.home.z);
    this.heading = 0;    // +X = 0
    this.speed = 0;
    this.drumSpin = 0;
    this.active = false;
    this.onRoll = null;  // (pos, moved, speed) => void

    this.DRUM_R = 0.62;
    this.DRUM_W = 2.6;
    this.WHEELBASE = 2.0;

    this._build();
  }

  _build() {
    const orange = matteMaterial('#f5a623', { roughness: 0.42, metalness: 0.12 });
    const orangeD = matteMaterial('#d98a12', { roughness: 0.5 });
    const dark = matteMaterial('#3a414c', { roughness: 0.7, metalness: 0.2 });
    const steel = matteMaterial('#b9c0c8', { roughness: 0.22, metalness: 0.75 });
    const glass = matteMaterial('#2b3a4a', { roughness: 0.12, metalness: 0.35 });

    const body = new THREE.Group();
    this.group.add(body);
    this.body = body;

    // ローラー（ドラム） まえ・うしろ
    const drumGeo = new THREE.CylinderGeometry(this.DRUM_R, this.DRUM_R, this.DRUM_W, 26);
    drumGeo.rotateZ(Math.PI / 2);
    this.drums = [];
    for (const z of [this.WHEELBASE / 2, -this.WHEELBASE / 2]) {
      const d = new THREE.Group();
      d.position.set(0, this.DRUM_R, z);
      const drum = addMesh(d, drumGeo, steel);
      drum.receiveShadow = true;
      // ドラムの もよう（まわって いるのが わかる）
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const stripe = addMesh(d, roundedBox(this.DRUM_W + 0.02, 0.09, 0.09, 0.03),
          matteMaterial('#8e959d', { roughness: 0.3, metalness: 0.6 }),
          [0, Math.cos(a) * this.DRUM_R * 0.99, Math.sin(a) * this.DRUM_R * 0.99],
          [a, 0, 0]);
        stripe.castShadow = false;
      }
      bakeStatic(d);       // ドラム＋もようを 1つに
      body.add(d);
      this.drums.push(d);
      // スクレーパーは まわらない（ドラムの そとに つける）
      addMesh(body, roundedBox(this.DRUM_W - 0.1, 0.1, 0.1, 0.03), orangeD,
              [0, this.DRUM_R * 1.2, z - this.DRUM_R - 0.14]);
    }

    // フレーム
    addMesh(body, roundedBox(1.3, 0.42, 2.6, 0.12), orange, [0, this.DRUM_R + 0.22, 0]);
    addMesh(body, roundedBox(1.6, 0.5, 1.3, 0.14), orange, [0, this.DRUM_R + 0.5, -0.5]);
    addMesh(body, roundedBox(1.5, 0.2, 1.1, 0.06), orangeD, [0, this.DRUM_R + 0.82, -0.5]);

    // うんてんせき
    const cab = new THREE.Group();
    cab.position.set(0, this.DRUM_R + 0.55, 0.35);
    body.add(cab);
    addMesh(cab, roundedBox(1.25, 0.24, 0.7, 0.08), dark, [0, 0.12, 0]);     // ゆか
    addMesh(cab, roundedBox(0.8, 0.5, 0.16, 0.06), orange, [0, 0.48, -0.28]); // せもたれ
    addMesh(cab, roundedBox(0.85, 0.16, 0.6, 0.06), matteMaterial('#5c6470', { roughness: 0.8 }), [0, 0.32, 0.02]);
    // ハンドル
    const wheelGeo = new THREE.TorusGeometry(0.19, 0.045, 8, 18);
    const hw = addMesh(cab, wheelGeo, dark, [0, 0.62, 0.42], [1.15, 0, 0]);
    hw.castShadow = true;
    addMesh(cab, new THREE.CylinderGeometry(0.045, 0.045, 0.3, 8), dark, [0, 0.48, 0.36], [0.45, 0, 0]);
    // ひよけ の やね
    for (const s of [-1, 1]) {
      addMesh(cab, roundedBox(0.08, 1.0, 0.08, 0.03), orangeD, [s * 0.6, 0.95, -0.2]);
    }
    const canopy = addMesh(cab, roundedBox(1.5, 0.12, 1.5, 0.05), matteMaterial('#ffd45e', { roughness: 0.5 }), [0, 1.5, 0.1]);
    canopy.castShadow = true;
    // ライト
    addMesh(body, roundedBox(0.3, 0.18, 0.1, 0.04),
      matteMaterial('#fff4cf', { roughness: 0.25, extra: { emissive: new THREE.Color('#ffe9a8'), emissiveIntensity: 0.6 } }),
      [0, this.DRUM_R + 0.5, 1.28]);

    this.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  setTarget(x, z) {
    this.target.set(
      clamp(x, AREA.minX - 0.9, AREA.maxX + 0.9),
      clamp(z, AREA.minZ + 0.15, AREA.maxZ - 0.15)
    );
  }

  driveIn() {
    this.active = true;
    this.target.set(AREA.maxX - 1.6, 0);
  }

  reset() {
    this.pos.set(this.home.x, this.home.z);
    this.target.copy(this.pos);
    this.group.position.copy(this.home);
    this.group.rotation.y = Math.PI / 2;
    this.active = false;
    this.speed = 0;
    this.heading = 0;
  }

  update(dt) {
    const prevX = this.pos.x, prevZ = this.pos.y;

    // ゆびの ほうへ ゆっくり（おもい きかい）
    const dx = this.target.x - this.pos.x;
    const dz = this.target.y - this.pos.y;
    const dist = Math.hypot(dx, dz);
    const maxSpeed = 4.2;
    const desired = clamp(dist * 3.0, 0, maxSpeed);
    this.speed = damp(this.speed, desired, 3.2, dt);
    if (dist > 1e-3) {
      const step = Math.min(dist, this.speed * dt);
      this.pos.x += (dx / dist) * step;
      this.pos.y += (dz / dist) * step;
      if (this.speed > 0.25) {
        const h = Math.atan2(dx, dz);
        // すすむ むき（バックも できる ように 180° は そのまま）
        let target = h;
        const cur = this.heading;
        let diff = ((target - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (Math.abs(diff) > Math.PI * 0.62) { target = h + Math.PI; }
        this.heading = this.heading + (((target - this.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * (1 - Math.exp(-4.5 * dt));
      }
    }

    const moved = Math.hypot(this.pos.x - prevX, this.pos.y - prevZ);
    this.drumSpin += moved / this.DRUM_R * (Math.cos(this.heading) >= 0 ? 1 : 1);
    for (const d of this.drums) d.rotation.x = this.drumSpin;

    this.group.position.set(this.pos.x, 0, this.pos.y);
    this.group.rotation.y = this.heading;

    // じめん を ならす
    if (this.active && this.terrain) {
      const cos = Math.cos(this.heading), sin = Math.sin(this.heading);
      let total = 0;
      // ドラムの じくは すすむ むきと ちょっこう（ローカル X じく）
      // みための ドラムより すこし ひろめ に ならす（こどもへの ほじょ）
      const halfW = this.DRUM_W * 0.5 + 0.34;
      const rx = Math.abs(cos) * halfW + Math.abs(sin) * this.DRUM_R * 0.95 + 0.16;
      const rz = Math.abs(sin) * halfW + Math.abs(cos) * this.DRUM_R * 0.95 + 0.16;
      const strength = clamp(dt * 5.0, 0, 0.6);
      for (const off of [this.WHEELBASE / 2, 0, -this.WHEELBASE / 2]) {
        const px = this.pos.x + sin * off;
        const pz = this.pos.y + cos * off;
        total += this.terrain.roll(px, pz, rx, rz, strength);
      }
      if (this.onRoll && moved > 1e-4) this.onRoll(this.group.position, total, this.speed);
    }

    // ドラムの したの じめんの たかさに あわせて うきしずみ
    if (this.terrain) {
      const cos = Math.cos(this.heading), sin = Math.sin(this.heading);
      const hf = this.terrain.heightAt(this.pos.x + sin * this.WHEELBASE / 2, this.pos.y + cos * this.WHEELBASE / 2);
      const hr = this.terrain.heightAt(this.pos.x - sin * this.WHEELBASE / 2, this.pos.y - cos * this.WHEELBASE / 2);
      const base = Math.max(GRADE, (hf + hr) * 0.5);
      this.group.position.y = damp(this.group.position.y, base, 9, dt);
      const pitch = Math.atan2(hf - hr, this.WHEELBASE);
      this.body.rotation.x = damp(this.body.rotation.x, -pitch, 7, dt);
    }
    return this;
  }
}

/* =======================================================
   さいごに はしる ちいさな くるま
   ======================================================= */

export class LittleCar {
  constructor(color = '#68c6f0') {
    this.group = new THREE.Group();
    const body = matteMaterial(color, { roughness: 0.35, metalness: 0.15 });
    const dark = matteMaterial('#39404b', { roughness: 0.7 });
    const glass = matteMaterial('#2b3a4a', { roughness: 0.12, metalness: 0.35 });

    addMesh(this.group, roundedBox(1.5, 0.5, 2.7, 0.22), body, [0, 0.52, 0]);
    addMesh(this.group, roundedBox(1.24, 0.52, 1.5, 0.24), body, [0, 0.88, -0.15]);
    addMesh(this.group, roundedBox(1.16, 0.34, 0.08, 0.03), glass, [0, 0.92, 0.6]);
    addMesh(this.group, roundedBox(0.08, 0.3, 1.0, 0.03), glass, [0.6, 0.92, -0.18]);
    addMesh(this.group, roundedBox(0.08, 0.3, 1.0, 0.03), glass, [-0.6, 0.92, -0.18]);
    const lamp = matteMaterial('#fff4cf', {
      roughness: 0.25, extra: { emissive: new THREE.Color('#ffe9a8'), emissiveIntensity: 0.7 },
    });
    addMesh(this.group, roundedBox(0.26, 0.16, 0.08, 0.03), lamp, [0.45, 0.6, 1.34]);
    addMesh(this.group, roundedBox(0.26, 0.16, 0.08, 0.03), lamp, [-0.45, 0.6, 1.34]);

    this.wheels = [];
    const tire = new THREE.CylinderGeometry(0.3, 0.3, 0.24, 14);
    tire.rotateZ(Math.PI / 2);
    for (const [x, z] of [[0.72, 0.9], [-0.72, 0.9], [0.72, -0.9], [-0.72, -0.9]]) {
      const w = new THREE.Group();
      w.position.set(x, 0.3, z);
      addMesh(w, tire, dark);
      this.group.add(w);
      this.wheels.push(w);
    }
    this.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.group.visible = false;
    this.spin = 0;
  }

  start(fromX, z, speed = 4.2) {
    this.group.visible = true;
    this.group.position.set(fromX, 0, z);
    this.group.rotation.y = Math.PI / 2;
    this.speed = speed;
    this.running = true;
  }

  update(dt) {
    if (!this.running) return;
    this.group.position.x += this.speed * dt;
    this.spin += this.speed * dt / 0.3;
    for (const w of this.wheels) w.rotation.x = this.spin;
    this.group.position.y = Math.abs(Math.sin(this.spin * 0.5)) * 0.012;
    if (this.group.position.x > 26) { this.running = false; this.group.visible = false; }
  }
}
