// 背景の簡略オブジェクト（描画予算はほとんど使わない）
import * as THREE from '../vendor/three.module.js';
import { makeRng, rr, lerp } from './util.js';
import { mergeGeoms } from './world.js';

export function buildProps(kind, grassTone) {
  const g = new THREE.Group();
  const rng = makeRng(kind.length * 71 + 5);

  // 遠景の木（低ポリ）
  const trunkGeos = [], crownGeos = [];
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2;
    const r = rr(rng, 24, 39);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (x > 6 && Math.abs(z) < 8 && x < 32) continue;   // 機械の走行帯を避ける
    const h = rr(rng, 3.2, 7.0);
    const t = new THREE.CylinderGeometry(0.14, 0.26, h, 6);
    t.translate(x, h / 2, z);
    trunkGeos.push(t);
    const cr = rr(rng, 1.5, 3.0);
    const tall = rng() < 0.3;
    const c = tall
      ? new THREE.ConeGeometry(cr * 0.7, cr * 3.0, 7)
      : new THREE.IcosahedronGeometry(cr, 1);
    c.translate(x, h + (tall ? cr * 1.2 : cr * 0.4), z);
    crownGeos.push(c);
  }
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4634, roughness: 1, metalness: 0 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x3d6b32, roughness: 0.95, metalness: 0 });
  if (trunkGeos.length) {
    const m1 = new THREE.Mesh(mergeGeoms(trunkGeos), trunkMat); m1.castShadow = false;
    g.add(m1);
    const m2 = new THREE.Mesh(mergeGeoms(crownGeos), crownMat); m2.castShadow = false;
    g.add(m2);
  }

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9, metalness: 0 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x5d6469, roughness: 0.5, metalness: 0.6 });

  const bench = (x, z, ry) => {
    const b = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.09, 0.5), woodMat);
    seat.position.y = 0.45; seat.castShadow = true; b.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.42, 0.08), woodMat);
    back.position.set(0, 0.72, -0.22); back.castShadow = true; b.add(back);
    for (const sx of [-0.75, 0.75]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.44), metalMat);
      l.position.set(sx, 0.22, 0); b.add(l);
    }
    b.position.set(x, 0, z); b.rotation.y = ry;
    g.add(b);
  };

  if (kind === 'park') {
    bench(-7.5, 7.5, -0.5);
    bench(-9.5, -6.0, 2.3);
    // 街灯
    for (const [x, z] of [[-11, 4], [-13, -7]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.2, 8), metalMat);
      p.position.set(x, 2.1, z); p.castShadow = true; g.add(p);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0x554422, roughness: 0.3 }));
      l.position.set(x, 4.3, z); g.add(l);
    }
  } else if (kind === 'field') {
    // 柵
    const postGeos = [], railGeos = [];
    for (let i = 0; i < 22; i++) {
      const x = -14 + i * 1.7, z = 11.5;
      const p = new THREE.BoxGeometry(0.12, 1.1, 0.12); p.translate(x, 0.55, z); postGeos.push(p);
    }
    for (const y of [0.55, 0.92]) {
      const r = new THREE.BoxGeometry(36, 0.09, 0.07); r.translate(4, y, 11.5); railGeos.push(r);
    }
    const fm = new THREE.Mesh(mergeGeoms(postGeos.concat(railGeos)), woodMat);
    fm.castShadow = true; g.add(fm);
    bench(-8.5, 8.0, 0.1);
  } else if (kind === 'school') {
    // 校舎（簡略）
    const bMat = new THREE.MeshStandardMaterial({ color: 0xd8cdb8, roughness: 0.92, metalness: 0 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(16, 7, 8), bMat);
    b.position.set(-6, 3.5, -20); b.castShadow = true; g.add(b);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(16.6, 0.5, 8.6),
      new THREE.MeshStandardMaterial({ color: 0x7c8a94, roughness: 0.8 }));
    roof.position.set(-6, 7.2, -20); g.add(roof);
    const winMat = new THREE.MeshStandardMaterial({ color: 0x6f93a8, roughness: 0.25, metalness: 0.3 });
    const wins = [];
    for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) {
      const w = new THREE.BoxGeometry(1.4, 1.2, 0.1);
      w.translate(-12.5 + i * 2.1, 2.2 + r * 2.6, -15.95); wins.push(w);
    }
    g.add(new THREE.Mesh(mergeGeoms(wins), winMat));
    // 植え込み
    const hedge = [];
    for (let i = 0; i < 14; i++) {
      const h = new THREE.IcosahedronGeometry(0.62, 1);
      h.scale(1.3, 0.8, 1);
      h.translate(-14 + i * 1.5, 0.4, -11);
      hedge.push(h);
    }
    g.add(new THREE.Mesh(mergeGeoms(hedge),
      new THREE.MeshStandardMaterial({ color: 0x476b32, roughness: 0.95 })));
  }
  return g;
}
