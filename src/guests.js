// パーティーのおきゃくさま：こけし人形風のゲスト。
// フィナーレで大扉から入場し、席について音楽に合わせて揺れる。

import * as THREE from 'three';

const SKIN = [0xffe0c2, 0xf5cfa5, 0xe8b98a, 0xffd9c9];
const HAIR = [0x4a3423, 0x2b2320, 0x8a5a2e, 0xd9b06a, 0x6b6b6b];
const DRESS = [0xf6c6d8, 0xc9dff2, 0xf7e3b1, 0xd8ccf0, 0xc9ecd4, 0xf5c9b2, 0xe8e2f6, 0xf3d9e8];

export class Guests {
  constructor(scene, flowers) {
    this.scene = scene;
    this.flowers = flowers;
    this.guests = [];
    this.time = 0;
  }

  // flowerType/colorHex: 選んだ花を髪飾りにして入場する
  spawnParty(seats, flowerType, colorHex, startDelay = 0) {
    const n = seats.length;
    for (let i = 0; i < n; i++) {
      const g = this._makeGuest(i);
      const lane = (i % 2 === 0) ? -1.0 : 1.0;
      g.group.position.set(lane + (Math.random() - 0.5) * 0.3, 0, 12.5 + (i >> 1) * 1.1);
      g.state = 'wait';
      g.delay = startDelay + i * 0.55;
      g.lane = lane;
      g.seat = seats[i];
      g.walkSpeed = 1.5 + Math.random() * 0.4;
      this.scene.add(g.group);
      // 髪に選んだ色の小さな花
      const fl = this.flowers.add(flowerType, colorHex, {
        parent: g.head,
        position: new THREE.Vector3(0.055, 0.055, 0),
        quaternion: new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.7, 0.7, 0).normalize()),
        scale: 0.8, bloom: 0.9, dynamic: true,
      });
      g.flower = fl;
      this.guests.push(g);
    }
  }

  _makeGuest(i) {
    const group = new THREE.Group();
    const dressMat = new THREE.MeshStandardMaterial({ color: DRESS[i % DRESS.length], roughness: 0.75 });
    const skinMat = new THREE.MeshStandardMaterial({ color: SKIN[i % SKIN.length], roughness: 0.6 });
    const hairMat = new THREE.MeshStandardMaterial({ color: HAIR[i % HAIR.length], roughness: 0.5 });
    const h = 0.9 + Math.random() * 0.35; // 身長（子どもと大人）
    const body = new THREE.Group();
    const dress = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.52, 12), dressMat);
    dress.position.y = 0.26;
    dress.castShadow = true;
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), dressMat);
    chest.position.y = 0.52;
    const head = new THREE.Group();
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), skinMat);
    face.castShadow = true;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hair.scale.set(1.04, 1.05, 1.04);
    hair.position.y = 0.005;
    head.add(face, hair);
    head.position.y = 0.66;
    body.add(dress, chest, head);
    body.scale.setScalar(h);
    group.add(body);
    return { group, body, head, phase: Math.random() * 6.28, hopT: -1 };
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    for (const g of this.guests) {
      if (g.state === 'wait') {
        g.delay -= dt;
        if (g.delay <= 0) g.state = 'walk';
        continue;
      }
      if (g.state === 'walk') {
        const p = g.group.position;
        const seat = g.seat;
        // 通路を進み、テーブルの手前で自分の席へ折れる
        const branchZ = seat.z + 1.3;
        if (p.z > branchZ) {
          p.z -= g.walkSpeed * dt;
          p.x += (g.lane - p.x) * Math.min(1, dt * 2);
          g.group.rotation.y = Math.PI; // -z向き
        } else {
          const to = new THREE.Vector3(seat.x, 0, seat.z);
          const d = to.clone().sub(p); d.y = 0;
          const dist = d.length();
          if (dist < 0.08) {
            g.state = 'dance';
            g.group.rotation.y = seat.faceY;
          } else {
            d.normalize();
            p.addScaledVector(d, Math.min(dist, g.walkSpeed * dt));
            g.group.rotation.y = Math.atan2(d.x, d.z);
          }
        }
        // 歩きの弾み
        g.body.position.y = Math.abs(Math.sin(t * 7 + g.phase)) * 0.045;
        g.body.rotation.z = Math.sin(t * 7 + g.phase) * 0.07;
        continue;
      }
      // dance：音楽に合わせてゆらゆら、ときどきジャンプ
      g.body.rotation.z = Math.sin(t * 2.8 + g.phase) * 0.09;
      g.head.rotation.z = Math.sin(t * 2.8 + g.phase + 0.6) * 0.12;
      if (g.hopT >= 0) {
        g.hopT += dt * 3;
        if (g.hopT >= 1) g.hopT = -1;
        else g.body.position.y = Math.sin(g.hopT * Math.PI) * 0.14;
      } else {
        g.body.position.y = Math.abs(Math.sin(t * 2.8 + g.phase)) * 0.025;
        if (Math.random() < dt * 0.08) g.hopT = 0;
      }
    }
  }
}
