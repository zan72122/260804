// 出演者。小さな踊り子が3人。光を当てると、うれしそうにする。
import * as THREE from '../vendor/three.module.min.js';
import { lerp, clamp, damp, rand, easeOutCubic, easeOutBack, smoothstep, Spring } from './util.js';
import { faceTexture, glowSprite } from './textures.js';

const SKIN = 0xffd9c0;

function dressGeometry(h = 1.05, r = 0.62) {
  const pts = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = t * h;
    // 上はきゅっと、裾はふわっと
    const rr = lerp(0.20, r, Math.pow(t, 1.7)) * (1 + Math.sin(t * Math.PI * 3) * 0.03);
    pts.push(new THREE.Vector2(rr, y));
  }
  return new THREE.LatheGeometry(pts, 26);
}

export class Performer {
  constructor({ dress = 0xffa8c8, hair = 0x4a3040, accent = 0xfff0a0, faceKind = 0, homeX = 0, homeZ = -3.0, fromX = -10 } = {}) {
    this.group = new THREE.Group();
    this.homeX = homeX; this.homeZ = homeZ; this.fromX = fromX;
    this.group.position.set(fromX, 0, homeZ);
    this.t = rand(0, 10);
    this.state = 'wing';
    this.enterT = 0;
    this.spotlit = 0;
    this.joy = new Spring(0, { stiffness: 60, damping: 6 });

    const body = new THREE.Group();
    this.body = body;
    this.group.add(body);

    const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.7 });
    const dressMat = new THREE.MeshPhysicalMaterial({
      color: dress, roughness: 0.62, metalness: 0.02,
      sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.5,
    });
    this.dressMat = dressMat;
    const hairMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.55 });

    // からだ
    const skirt = new THREE.Mesh(dressGeometry(1.08, 0.60), dressMat);
    skirt.position.y = 0.30;
    skirt.castShadow = true;
    skirt.receiveShadow = true;
    body.add(skirt);
    this.skirt = skirt;

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.20, 0.24, 8, 16), dressMat);
    torso.position.y = 1.30;
    torso.castShadow = true;
    body.add(torso);

    // あし
    this.legs = [];
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.24, 6, 10), skinMat);
      leg.position.set(sx * 0.14, 0.22, 0);
      leg.castShadow = true;
      body.add(leg);
      this.legs.push(leg);
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfff2f6, roughness: 0.4 }));
      shoe.scale.set(1, 0.7, 1.3);
      shoe.position.set(sx * 0.14, 0.08, 0.03);
      body.add(shoe);
    }

    // うで
    this.arms = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.22, 1.44, 0);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.36, 6, 10), skinMat);
      arm.position.y = -0.22;
      arm.castShadow = true;
      pivot.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), skinMat);
      hand.position.y = -0.44;
      pivot.add(hand);
      body.add(pivot);
      this.arms.push(pivot);
    }

    // あたま
    const head = new THREE.Group();
    head.position.y = 1.74;
    body.add(head);
    this.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.34, 28, 22), skinMat);
    skull.castShadow = true;
    head.add(skull);

    const face = new THREE.Mesh(
      new THREE.SphereGeometry(0.348, 28, 22, Math.PI / 2 - 0.66, 1.32, 0.66, 1.24),
      new THREE.MeshStandardMaterial({
        map: faceTexture(faceKind), transparent: true, roughness: 0.7, depthWrite: false,
      })
    );
    head.add(face);

    // かみ
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.362, 26, 14, 0, Math.PI * 2, 0, Math.PI * 0.30), hairMat);
    cap.position.y = 0.005;
    cap.castShadow = true;
    head.add(cap);
    const backHair = new THREE.Mesh(
      new THREE.SphereGeometry(0.358, 26, 18, Math.PI * 1.06, Math.PI * 0.88, 0, Math.PI * 0.66), hairMat);
    backHair.castShadow = true;
    head.add(backHair);
    // 前髪
    const fringe = new THREE.Mesh(
      new THREE.SphereGeometry(0.366, 26, 16, Math.PI * 0.22, Math.PI * 0.56, 0, Math.PI * 0.30), hairMat);
    fringe.position.y = 0.01;
    head.add(fringe);
    for (const sx of [-1, 1]) {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), hairMat);
      bun.position.set(sx * 0.33, 0.06, -0.10);
      bun.castShadow = true;
      head.add(bun);
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.035, 8, 14), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4, emissive: accent, emissiveIntensity: 0.15 }));
      rib.position.set(sx * 0.33, 0.21, -0.10);
      rib.rotation.x = Math.PI / 2;
      head.add(rib);
    }

    // 光を浴びたときの、ふわっとした暈
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite('rgba(255,255,255,0.85)', 'rgba(255,255,255,0.22)'),
      color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false,
      transparent: true, toneMapped: false, opacity: 0,
    }));
    this.aura.scale.setScalar(4.2);
    this.aura.position.y = 1.1;
    this.group.add(this.aura);
  }

  enter(delay = 0) {
    if (this.state !== 'wing') return;
    this.state = 'entering';
    this.enterT = -delay;
  }
  bow() { if (this.state === 'dancing') { this.state = 'bowing'; this.bowT = 0; } }
  dance() { if (this.state === 'standing') this.state = 'dancing'; }

  setSpotlit(v) {
    if (v > 0.5 && this.spotlit <= 0.5) this.joy.kick(6);
    this.spotlit = v;
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    this.joy.target = this.spotlit;
    this.joy.step(dt);
    const joy = clamp(this.joy.value, 0, 1.6);

    if (this.state === 'entering') {
      this.enterT += dt;
      const k = clamp(this.enterT / 2.0, 0, 1);
      if (k > 0) {
        this.group.position.x = lerp(this.fromX, this.homeX, easeOutCubic(k));
        // とことこ歩く
        const step = Math.sin(this.enterT * 9) * (1 - k);
        this.legs[0].rotation.x = step * 0.6;
        this.legs[1].rotation.x = -step * 0.6;
        this.body.position.y = Math.abs(Math.sin(this.enterT * 9)) * 0.045 * (1 - k);
        this.body.rotation.y = lerp(Math.sign(this.homeX - this.fromX) * 1.3, 0, easeOutCubic(k));
      }
      if (k >= 1) { this.state = 'standing'; this.legs[0].rotation.x = 0; this.legs[1].rotation.x = 0; }
      return;
    }

    if (this.state === 'bowing') {
      this.bowT += dt;
      const k = clamp(this.bowT / 1.1, 0, 1);
      const a = Math.sin(k * Math.PI) * 0.85;
      this.body.rotation.x = a * 0.6;
      this.head.rotation.x = a * 0.35;
      this.arms[0].rotation.z = a * 0.9;
      this.arms[1].rotation.z = -a * 0.9;
      this.arms[0].rotation.x = -a * 0.3;
      this.arms[1].rotation.x = -a * 0.3;
      if (k >= 1) { this.state = 'dancing'; this.body.rotation.x = 0; this.head.rotation.x = 0; }
      return;
    }

    const dancing = this.state === 'dancing';
    const amp = dancing ? 1 : 0.32;
    const sw = Math.sin(t * (dancing ? 2.4 : 1.1));
    const bob = Math.sin(t * (dancing ? 4.8 : 2.2));

    this.body.rotation.z = sw * 0.055 * amp;
    this.body.rotation.y = sw * 0.22 * amp;
    this.body.position.y = (dancing ? Math.abs(bob) * 0.075 : 0) + joy * 0.05 * Math.abs(Math.sin(t * 6));
    this.head.rotation.z = -sw * 0.09 * amp;
    this.head.rotation.y = sw * 0.12 * amp;

    const raise = dancing ? lerp(0.7, 2.1, (Math.sin(t * 2.4) * 0.5 + 0.5)) : 0.35;
    const extra = joy * 0.7;
    this.arms[0].rotation.z = (raise + extra) * 0.9 + sw * 0.25;
    this.arms[1].rotation.z = -(raise + extra) * 0.9 + sw * 0.25;
    this.arms[0].rotation.x = -0.15 - joy * 0.2;
    this.arms[1].rotation.x = -0.15 - joy * 0.2;

    this.skirt.scale.set(1 + Math.abs(sw) * 0.05 * amp, 1, 1 + Math.abs(sw) * 0.05 * amp);
    this.skirt.rotation.y = sw * 0.3 * amp;

    this.aura.material.opacity = joy * 0.5;
    this.aura.scale.setScalar(3.6 + joy * 1.4);
  }

  get worldPos() {
    return new THREE.Vector3(this.group.position.x, 0, this.group.position.z);
  }
}

export class Troupe {
  constructor(theme) {
    this.group = new THREE.Group();
    const palette = [
      { dress: 0xff9ec4, hair: 0x53324a, accent: 0xfff0a8, faceKind: 0 },
      { dress: 0x9fe6d0, hair: 0x3a3f5c, accent: 0xffd0e0, faceKind: 1 },
      { dress: 0xc2b0ff, hair: 0x6a4630, accent: 0xbff0ff, faceKind: 0 },
    ];
    const spots = [
      { homeX: -2.3, homeZ: -3.0, fromX: -10 },
      { homeX: 0.2, homeZ: -2.2, fromX: 10 },
      { homeX: 2.6, homeZ: -3.2, fromX: 10 },
    ];
    this.members = palette.map((p, i) => {
      const perf = new Performer({ ...p, ...spots[i] });
      this.group.add(perf.group);
      return perf;
    });
  }

  enter() { this.members.forEach((m, i) => m.enter(i * 0.55)); }
  dance() { this.members.forEach((m) => m.dance()); }
  bow() { this.members.forEach((m, i) => setTimeout(() => m.bow(), i * 220)); }

  updateSpot(aim) {
    for (const m of this.members) {
      const d = Math.hypot(m.group.position.x - aim.x, m.group.position.z - aim.z);
      m.setSpotlit(smoothstep(2.4, 0.9, d));
    }
  }

  update(dt) { for (const m of this.members) m.update(dt); }
  attractorPoints() { return this.members.map((m) => m.worldPos); }
  get onStage() { return this.members.some((m) => m.state !== 'wing' && m.state !== 'entering'); }
}
