import * as THREE from 'three';

// ---------------------------------------------------------------------------
// 作業場のねこ。大きさの物差しにもなるし、ひとりぼっちの作業場にならずにすむ。
// ---------------------------------------------------------------------------

export class Cat {
  constructor({ color = 0xd9c3a2, x = 0, z = 1.4, rot = 0, seed = 0 } = {}) {
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    this.group.rotation.y = rot;
    this.seed = seed;

    const fur = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x6d5842, roughness: 0.95 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), fur);
    body.scale.set(1.0, 0.98, 1.35);
    body.position.set(0, 0.115, 0);
    body.castShadow = true;
    this.group.add(body);
    this.body = body;

    this.head = new THREE.Group();
    this.head.position.set(0, 0.235, 0.075);
    this.group.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 12), fur);
    skull.scale.set(1, 0.92, 0.95);
    skull.castShadow = true;
    this.head.add(skull);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), fur);
    muzzle.position.set(0, -0.018, 0.058);
    muzzle.scale.set(1.2, 0.8, 0.9);
    this.head.add(muzzle);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), dark);
    nose.position.set(0, -0.012, 0.088);
    this.head.add(nose);
    this.ears = [];
    for (const sgn of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.05, 4), fur);
      ear.position.set(sgn * 0.04, 0.062, 0.005);
      ear.rotation.z = sgn * 0.22;
      ear.castShadow = true;
      this.head.add(ear);
      this.ears.push(ear);
    }
    for (const sgn of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 8, 6), dark);
      eye.position.set(sgn * 0.03, 0.008, 0.064);
      this.head.add(eye);
    }

    for (const sgn of [-1, 1]) {
      const paw = new THREE.Mesh(new THREE.CapsuleGeometry(0.021, 0.05, 3, 8), fur);
      paw.rotation.x = Math.PI / 2;
      paw.position.set(sgn * 0.045, 0.022, 0.125);
      paw.castShadow = true;
      this.group.add(paw);
    }

    // しっぽ
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.1, -0.13),
      new THREE.Vector3(0.05, 0.045, -0.2),
      new THREE.Vector3(0.13, 0.03, -0.19),
      new THREE.Vector3(0.19, 0.06, -0.12),
    ]);
    this.tailCurve = curve;
    this.tail = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.017, 6, false), fur);
    this.tail.castShadow = true;
    this.group.add(this.tail);
  }

  update(t) {
    const s = this.seed;
    const breathe = 1 + Math.sin(t * 1.7 + s) * 0.022;
    this.body.scale.y = 0.98 * breathe;
    this.head.rotation.y = Math.sin(t * 0.4 + s) * 0.28;
    this.head.rotation.x = Math.sin(t * 0.31 + s * 2) * 0.09;
    const tw = Math.max(0, Math.sin(t * 2.3 + s * 3) - 0.94) * 12;
    this.ears[0].rotation.z = 0.22 * -1 + tw * 0.4;
    this.ears[1].rotation.z = 0.22 + Math.max(0, Math.sin(t * 1.9 + 2 + s) - 0.95) * 5;
    this.tail.rotation.y = Math.sin(t * 0.8 + s) * 0.35;
  }
}
