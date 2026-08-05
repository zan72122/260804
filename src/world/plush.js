// 完成したものを実際に使ってくれる子たち。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { tween, easeOutCubic, easeInOutCubic, easeOutBack, rand, lerp, clamp } from '../core/util.js';

const fuzzy = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 });

/** ぬいぐるみのくま */
export function makeTeddy(color = '#d8a06a') {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 16), fuzzy(color));
  body.scale.set(1, 1.05, 0.9);
  body.position.y = 0.075;
  g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 14), fuzzy('#f0dcc0'));
  belly.scale.set(1, 0.9, 0.6);
  belly.position.set(0, 0.07, 0.045);
  g.add(belly);
  const head = new THREE.Group();
  head.position.y = 0.185;
  g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.062, 20, 16), fuzzy(color));
  head.add(skull);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 12), fuzzy('#f0dcc0'));
  muzzle.scale.set(1, 0.75, 0.8);
  muzzle.position.set(0, -0.014, 0.05);
  head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), fuzzy('#4a3527'));
  nose.position.set(0, -0.004, 0.076);
  head.add(nose);
  for (const x of [-0.04, 0.04]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.023, 12, 10), fuzzy(color));
    ear.scale.set(1, 1, 0.55);
    ear.position.set(x, 0.05, 0);
    head.add(ear);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), fuzzy('#f0c8b4'));
    inner.scale.set(1, 1, 0.4);
    inner.position.set(x, 0.05, 0.012);
    head.add(inner);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshStandardMaterial({ color: '#2a1e16', roughness: 0.3 }));
    eye.position.set(x * 0.62, 0.012, 0.052);
    head.add(eye);
  }
  const limbs = [];
  for (const [x, y, z, s] of [[-0.062, 0.09, 0.02, 1], [0.062, 0.09, 0.02, 1], [-0.038, 0.018, 0.03, 1.1], [0.038, 0.018, 0.03, 1.1]]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.026 * s, 12, 10), fuzzy(color));
    l.scale.set(0.8, 1.1, 0.9);
    l.position.set(x, y, z);
    g.add(l);
    limbs.push(l);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, head, limbs, body };
}

/** ことり */
export function makeBird(color = '#7fc6f5') {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.035, 18, 14), fuzzy(color));
  body.scale.set(1, 0.95, 1.15);
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), fuzzy(color));
  head.position.set(0, 0.032, 0.026);
  g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.02, 8), fuzzy('#ffb43f'));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.03, 0.05);
  g.add(beak);
  for (const x of [-0.01, 0.01]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 8), new THREE.MeshStandardMaterial({ color: '#21303c' }));
    eye.position.set(x, 0.038, 0.042);
    g.add(eye);
  }
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), fuzzy('#ffffff'));
    w.scale.set(0.32, 0.8, 1.1);
    w.position.set(s * 0.032, 0.006, -0.004);
    g.add(w);
    wings.push(w);
  }
  const tail = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.008, 0.04, 2, 0.004), fuzzy('#ffffff'));
  tail.position.set(0, 0.004, -0.045);
  tail.rotation.x = -0.3;
  g.add(tail);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, wings, head };
}

/** ごほん */
export function makeBook(color, w = 0.045, h = 0.11, d = 0.11) {
  const g = new THREE.Group();
  const cover = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.005), new THREE.MeshStandardMaterial({ color, roughness: 0.65 }));
  g.add(cover);
  const pages = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, h * 0.92, d * 0.94), new THREE.MeshStandardMaterial({ color: '#fdf6e6', roughness: 0.9 }));
  pages.position.x = w * 0.12;
  g.add(pages);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g };
}

/** ふわりと弧を描いて移動する */
export function hopTo(obj, from, to, { height = 0.12, dur = 0.7, spin = 0 } = {}) {
  return tween({
    from: 0, to: 1, dur, ease: easeInOutCubic,
    onUpdate: (v) => {
      obj.position.lerpVectors(from, to, v);
      obj.position.y += Math.sin(v * Math.PI) * height;
      if (spin) obj.rotation.y = lerp(0, spin, v);
    },
  });
}
