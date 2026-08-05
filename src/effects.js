import * as THREE from 'three';
import {
  V3, srand, srange, clamp01, easeOutBack, mergeGeoms, mat4,
  makeDotTexture, dampV3,
} from './util.js';

/* ---------------- particle pool (THREE.Points) ---------------- */
class Pool {
  constructor(scene, n, { color, size, blending, gravity = 0, drag = 1 }) {
    this.n = n;
    this.gravity = gravity;
    this.drag = drag;
    this.parts = [];
    for (let i = 0; i < n; i++) this.parts.push({ life: 0 });
    const geo = new THREE.BufferGeometry();
    this.posArr = new Float32Array(n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3));
    const mat = new THREE.PointsMaterial({
      color, size, sizeAttenuation: true, map: makeDotTexture(),
      transparent: true, depthWrite: false, blending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.cursor = 0;
  }

  spawn(pos, vel, ttl) {
    const p = this.parts[this.cursor];
    this.cursor = (this.cursor + 1) % this.n;
    p.x = pos.x; p.y = pos.y; p.z = pos.z;
    p.vx = vel.x; p.vy = vel.y; p.vz = vel.z;
    p.life = ttl; p.ttl = ttl;
  }

  burst(pos, count, spread, up, ttl = 0.8) {
    for (let i = 0; i < count; i++) {
      this.spawn(
        pos,
        V3(srange(-spread, spread), up * (0.5 + srand()), srange(-spread, spread)),
        ttl * (0.6 + srand() * 0.6)
      );
    }
  }

  update(dt) {
    let alive = 0;
    for (let i = 0; i < this.n; i++) {
      const p = this.parts[i];
      if (p.life > 0) {
        p.life -= dt;
        p.vy -= this.gravity * dt;
        const d = Math.pow(this.drag, dt * 60);
        p.vx *= d; p.vy *= d; p.vz *= d;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.02 && this.gravity > 0) { p.y = 0.02; p.life = Math.min(p.life, 0.1); }
        this.posArr[i * 3] = p.x;
        this.posArr[i * 3 + 1] = p.y;
        this.posArr[i * 3 + 2] = p.z;
        alive++;
      } else {
        this.posArr[i * 3 + 1] = -50;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.visible = alive > 0;
  }
}

/* ---------------- ambient flower field (instanced) ---------------- */
const AMBIENT_N = 230;

function flowerHeadGeom() {
  const items = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    items.push({
      geom: new THREE.SphereGeometry(0.055, 6, 4),
      matrix: mat4(Math.cos(a) * 0.075, 0, Math.sin(a) * 0.075, 0, 0, 0, 1, 0.35, 1.6),
    });
  }
  return mergeGeoms(items);
}

export class Effects {
  constructor(scene, waterLines, layout) {
    this.scene = scene;
    this.sparkle = new Pool(scene, 260, {
      color: 0xfff3b8, size: 0.22, blending: THREE.AdditiveBlending, gravity: 0.6, drag: 0.97,
    });
    this.splash = new Pool(scene, 300, {
      color: 0xbfe6ff, size: 0.16, blending: THREE.AdditiveBlending, gravity: 5.5, drag: 0.995,
    });
    this.dust = new Pool(scene, 160, {
      color: 0xc3a377, size: 0.2, blending: THREE.NormalBlending, gravity: 1.4, drag: 0.94,
    });

    this._buildFlowers(scene, waterLines, layout);
    this._buildButterflies(scene);
    this._buildBirds(scene);
    this.creaturesOn = false;
  }

  /* ---- ambient flowers, biased near the waterways ---- */
  _buildFlowers(scene, waterLines, layout) {
    const stemGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.34, 5);
    stemGeo.translate(0, 0.17, 0);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4e8f3a, flatShading: true });
    this.fStems = new THREE.InstancedMesh(stemGeo, stemMat, AMBIENT_N);
    const headGeo = flowerHeadGeom();
    headGeo.translate(0, 0.36, 0);
    const headMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.75 });
    this.fHeads = new THREE.InstancedMesh(headGeo, headMat, AMBIENT_N);
    const coreGeo = new THREE.SphereGeometry(0.045, 6, 5);
    coreGeo.translate(0, 0.36, 0);
    this.fCores = new THREE.InstancedMesh(coreGeo,
      new THREE.MeshStandardMaterial({ color: 0xffd94d, flatShading: true }), AMBIENT_N);

    const palette = [0xffffff, 0xff9ec2, 0xffd23e, 0xb487f0, 0xff8b5e, 0xff6fa5, 0x9fd0ff];
    const line = new THREE.Line3();
    const tmp = V3();
    this.flowers = [];
    const c = new THREE.Color();

    const isClear = (p) => {
      // keep flowers off the channels, plaza centre, beds, structures
      for (const [a, b] of waterLines) {
        line.set(a, b);
        line.closestPointToPoint(p, true, tmp);
        if (tmp.distanceTo(p) < 1.0) return false;
      }
      if (p.distanceTo(layout.fountain) < 3.2) return false;
      if (p.distanceTo(layout.pond) < 1.5) return false;
      if (p.distanceTo(layout.westPool) < 1.2) return false;
      for (const b of layout.beds) {
        if (Math.abs(p.x - b.x) < 2.1 && Math.abs(p.z - b.z) < 1.7) return false;
      }
      if (Math.abs(p.x - 11.6) < 2.2 && Math.abs(p.z - 0.4) < 2.2) return false; // mill
      if (p.z < -11.5) return false; // terrace
      return true;
    };

    let placed = 0, guard = 0;
    while (placed < AMBIENT_N && guard++ < 4000) {
      let p;
      if (placed % 3 !== 0) {
        // near a waterway
        const [a, b] = waterLines[Math.floor(srand() * waterLines.length) % waterLines.length];
        const t = srand();
        p = V3().lerpVectors(a, b, t);
        const ang = srand() * Math.PI * 2, r = 1.1 + srand() * 2.4;
        p.x += Math.cos(ang) * r;
        p.z += Math.sin(ang) * r;
      } else {
        p = V3(srange(-16, 16), 0, srange(-11, 12));
      }
      if (!isClear(p)) continue;
      // distance along nearest waterway (used to time the bloom wave)
      let best = Infinity, bestD = 0;
      for (const [a, b] of waterLines) {
        line.set(a, b);
        line.closestPointToPoint(p, true, tmp);
        const d = tmp.distanceTo(p);
        if (d < best) { best = d; bestD = d; }
      }
      this.flowers.push({
        i: placed, pos: p, lateral: bestD,
        scaleT: 0.75 + srand() * 0.55, rot: srand() * Math.PI * 2,
        bloomAt: Infinity, k: 0, phase: srand() * 6.28,
      });
      c.setHex(palette[placed % palette.length]);
      this.fHeads.setColorAt(placed, c);
      placed++;
    }
    this.fHeads.instanceColor.needsUpdate = true;
    const zero = new THREE.Matrix4().makeScale(0.001, 0.001, 0.001);
    for (let i = 0; i < AMBIENT_N; i++) {
      this.fStems.setMatrixAt(i, zero);
      this.fHeads.setMatrixAt(i, zero);
      this.fCores.setMatrixAt(i, zero);
    }
    for (const m of [this.fStems, this.fHeads, this.fCores]) {
      m.instanceMatrix.needsUpdate = true;
      m.count = AMBIENT_N;
      m.frustumCulled = false;
      scene.add(m);
    }
    this.bloomStarted = false;
    this.bloomClock = 0;
    this.bloomedCount = 0;
  }

  /**
   * Schedule the bloom wave. arrivalFn(pos) returns the moment (finale seconds)
   * water reaches the channel point nearest to the flower, or a fallback.
   */
  startBloomWave(arrivalFn) {
    for (const f of this.flowers) {
      f.bloomAt = arrivalFn(f.pos) + 0.3 + f.lateral * 0.55 + srand() * 0.7;
    }
    this.bloomStarted = true;
    this.bloomClock = 0;
  }

  _writeFlower(f, mat4Tmp, quatTmp, eulTmp, sclTmp) {
    const s = Math.max(0.001, easeOutBack(f.k) * f.scaleT);
    eulTmp.set(Math.sin(f.phase + this.bloomClock * 1.7) * 0.06 * f.k, f.rot, 0);
    quatTmp.setFromEuler(eulTmp);
    sclTmp.setScalar(s);
    mat4Tmp.compose(f.pos, quatTmp, sclTmp);
    this.fStems.setMatrixAt(f.i, mat4Tmp);
    this.fHeads.setMatrixAt(f.i, mat4Tmp);
    this.fCores.setMatrixAt(f.i, mat4Tmp);
  }

  /* ---- butterflies ---- */
  _buildButterflies(scene) {
    this.butterflies = [];
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.bezierCurveTo(0.16, 0.12, 0.2, 0.02, 0.14, -0.05);
    wingShape.bezierCurveTo(0.1, -0.1, 0.02, -0.06, 0, 0);
    const wingGeo = new THREE.ShapeGeometry(wingShape, 4);
    const colors = [0xffd23e, 0xffffff, 0xff9ec2, 0x9fd0ff, 0xffb066, 0xd8a7f0, 0xfff3b0, 0xa7e8b0];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({
        color: colors[i], side: THREE.DoubleSide, transparent: true, opacity: 0.95,
      });
      const wl = new THREE.Mesh(wingGeo, mat);
      const wr = new THREE.Mesh(wingGeo, mat);
      wl.rotation.z = Math.PI / 2; wl.rotation.y = Math.PI;
      wr.rotation.z = Math.PI / 2;
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.02, 0.12, 2, 5),
        new THREE.MeshBasicMaterial({ color: 0x5a4632 })
      );
      body.rotation.x = Math.PI / 2;
      g.add(wl, wr, body);
      g.visible = false;
      g.scale.setScalar(1.4);
      scene.add(g);
      this.butterflies.push({
        g, wl, wr, pos: V3(srange(-8, 8), 3, srange(-4, 8)),
        target: V3(), retarget: 0, phase: srand() * 6.28, speed: 0.9 + srand() * 0.5,
      });
    }
  }

  /* ---- birds ---- */
  _buildBirds(scene) {
    this.birds = [];
    const cols = [0x5a8fd0, 0xd06a5a, 0xe8c05a, 0x8ad0a0, 0xffffff];
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: cols[i], flatShading: true });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), mat);
      body.scale.set(1, 0.9, 1.5);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat);
      head.position.set(0, 0.08, 0.15);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 5),
        new THREE.MeshStandardMaterial({ color: 0xf0a030, flatShading: true }));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.07, 0.26);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.16), mat);
      tail.position.set(0, 0.02, -0.22);
      const wingGeo = new THREE.PlaneGeometry(0.3, 0.14);
      wingGeo.translate(0.15, 0, 0);
      const wmat = new THREE.MeshStandardMaterial({ color: cols[i], side: THREE.DoubleSide, flatShading: true });
      const wl = new THREE.Mesh(wingGeo, wmat);
      const wr = new THREE.Mesh(wingGeo, wmat);
      wr.rotation.y = Math.PI;
      wl.rotation.x = wr.rotation.x = -Math.PI / 2 + 0.4;
      g.add(body, head, beak, tail, wl, wr);
      g.visible = false;
      scene.add(g);
      this.birds.push({
        g, wl, wr, phase: srand() * 6.28, mode: 'fly',
        angle: srand() * 6.28, radius: 8 + i * 2.2, h: 5 + srand() * 3,
        speed: 0.35 + srand() * 0.2, perch: null, perchTimer: 6 + i * 4,
      });
    }
    this.perches = [];
  }

  releaseCreatures(perches) {
    this.creaturesOn = true;
    this.perches = perches || [];
    for (const b of this.butterflies) b.g.visible = true;
    for (const b of this.birds) b.g.visible = true;
  }

  /* ---- main update ---- */
  update(dt, time) {
    this.sparkle.update(dt);
    this.splash.update(dt);
    this.dust.update(dt);

    if (this.bloomStarted) {
      this.bloomClock += dt;
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(),
        e = new THREE.Euler(), s = new THREE.Vector3();
      let dirty = false, count = 0;
      for (const f of this.flowers) {
        if (this.bloomClock > f.bloomAt && f.k < 1) {
          f.k = clamp01(f.k + dt * 1.6);
          this._writeFlower(f, m4, q, e, s);
          dirty = true;
          if (f.k >= 1) this.bloomedCount++;
        } else if (f.k >= 1 && Math.random() < 0.15) {
          // occasional sway refresh (cheap, staggered)
          this._writeFlower(f, m4, q, e, s);
          dirty = true;
        }
        if (f.k > 0) count++;
      }
      if (dirty) {
        this.fStems.instanceMatrix.needsUpdate = true;
        this.fHeads.instanceMatrix.needsUpdate = true;
        this.fCores.instanceMatrix.needsUpdate = true;
      }
    }

    if (this.creaturesOn) {
      this._updateButterflies(dt, time);
      this._updateBirds(dt, time);
    }
  }

  _updateButterflies(dt, time) {
    for (const b of this.butterflies) {
      b.retarget -= dt;
      if (b.retarget <= 0) {
        b.retarget = 2.5 + srand() * 3;
        const f = this.flowers[Math.floor(srand() * this.flowers.length)];
        b.target.copy(f && f.k > 0.5 ? f.pos : V3(srange(-8, 8), 0, srange(-4, 8)));
        b.target.y = 0.7 + srand() * 1.6;
        b.target.x += srange(-1, 1);
        b.target.z += srange(-1, 1);
      }
      dampV3(b.pos, b.target, 0.55 * b.speed, dt);
      const bobY = Math.sin(time * 5 + b.phase) * 0.12;
      b.g.position.set(b.pos.x, b.pos.y + bobY, b.pos.z);
      const flap = Math.sin(time * 22 + b.phase) * 1.0;
      b.wl.rotation.x = flap;
      b.wr.rotation.x = -flap;
      const dir = V3().subVectors(b.target, b.pos);
      if (dir.lengthSq() > 0.01) b.g.rotation.y = Math.atan2(dir.x, dir.z);
    }
  }

  _updateBirds(dt, time) {
    for (const b of this.birds) {
      if (b.mode === 'fly') {
        b.perchTimer -= dt;
        b.angle += dt * b.speed;
        const x = Math.cos(b.angle) * b.radius;
        const z = -2 + Math.sin(b.angle) * b.radius * 0.75;
        const y = b.h + Math.sin(time * 0.7 + b.phase) * 0.6;
        b.g.position.set(x, y, z);
        b.g.rotation.y = Math.atan2(-Math.sin(b.angle), Math.cos(b.angle) * 0.75) + Math.PI / 2;
        const flap = Math.sin(time * 10 + b.phase) * 0.9;
        b.wl.rotation.x = -Math.PI / 2 + 0.4 + flap * 0.5;
        b.wr.rotation.x = -Math.PI / 2 + 0.4 - flap * 0.5;
        if (b.perchTimer <= 0 && this.perches.length) {
          b.perch = this.perches[Math.floor(srand() * this.perches.length)];
          b.mode = 'land';
        }
      } else if (b.mode === 'land') {
        dampV3(b.g.position, b.perch, 1.2, dt);
        b.g.rotation.y += (Math.sin(time) * 0.3 - b.g.rotation.y) * 0.05;
        const flap = Math.sin(time * 14 + b.phase) * 0.6;
        b.wl.rotation.x = -Math.PI / 2 + 0.4 + flap * 0.5;
        b.wr.rotation.x = -Math.PI / 2 + 0.4 - flap * 0.5;
        if (b.g.position.distanceTo(b.perch) < 0.12) {
          b.mode = 'sit';
          b.sitTimer = 5 + srand() * 6;
        }
      } else {
        // sitting: fold wings, little hops
        b.wl.rotation.x = -Math.PI / 2 + 0.9;
        b.wr.rotation.x = -Math.PI / 2 + 0.9;
        b.g.position.y = b.perch.y + Math.abs(Math.sin(time * 3 + b.phase)) * 0.03;
        b.sitTimer -= dt;
        if (b.sitTimer <= 0) {
          b.mode = 'fly';
          b.perchTimer = 8 + srand() * 8;
          b.h = 5 + srand() * 3;
        }
      }
    }
  }
}
