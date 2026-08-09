import * as THREE from 'three';
import {
  makeChouxGeometry, makeCoatGeometry, bakeryEnvTexture, plateTexture,
  woodTexture, blobShadowTexture, sparkTexture, backdropTexture,
} from './geo.js';

export const LAYOUT = {
  chouxR: 0.42,
  plateR: 1.28,
  plateH: 0.10,
  potR: 0.52,
  potSurfaceY: 0.215,
  trayR: 0.52,
  // The bench is re-composed per orientation so the tower never runs off screen:
  // side by side in landscape, pulled toward the viewer in portrait.
  bench: {
    landscape: { pot: new THREE.Vector3(-1.90, 0, 1.02), tray: new THREE.Vector3(1.92, 0, 1.12) },
    portrait: { pot: new THREE.Vector3(-0.86, 0, 1.98), tray: new THREE.Vector3(0.92, 0, 2.08) },
  },
  pot: new THREE.Vector3(-1.90, 0, 1.02),
  tray: new THREE.Vector3(1.92, 0, 1.12),
  // ring sizes: 6 -> 5 -> 4 -> 2 -> 1. Each ring is a little smaller and a
  // little higher, which is what turns a pile of choux into a cone.
  layers: [
    { n: 6, r: 0.840, y: 0.520 },
    { n: 5, r: 0.714, y: 1.120 },
    { n: 4, r: 0.594, y: 1.720 },
    { n: 2, r: 0.420, y: 2.320 },
    { n: 1, r: 0.000, y: 2.880 },
  ],
};

export const TOTAL_CHOUX = LAYOUT.layers.reduce((a, l) => a + l.n, 0); // 18
export const TOWER_TOP_Y = LAYOUT.layers[LAYOUT.layers.length - 1].y + LAYOUT.chouxR;

// Radius of the finished cone at a given height - used to wrap the spun sugar.
export function coneRadiusAt(y) {
  const ls = LAYOUT.layers;
  const R = LAYOUT.chouxR;
  if (y <= ls[0].y) return ls[0].r + R;
  for (let i = 0; i < ls.length - 1; i++) {
    const a = ls[i], b = ls[i + 1];
    if (y <= b.y) {
      const t = (y - a.y) / (b.y - a.y);
      return THREE.MathUtils.lerp(a.r + R, b.r + R, t);
    }
  }
  const last = ls[ls.length - 1];
  const t = THREE.MathUtils.clamp((y - last.y) / R, 0, 1);
  return THREE.MathUtils.lerp(last.r + R, 0.06, t);
}

export function buildWorld(renderer) {
  const scene = new THREE.Scene();

  // ---- environment ------------------------------------------------------
  const envTex = bakeryEnvTexture();
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(envTex);
  scene.environment = envRT.texture;
  envTex.dispose();
  pmrem.dispose();

  scene.background = backdropTexture();
  scene.backgroundBlurriness = 0.35;
  scene.backgroundIntensity = 1.0;
  scene.fog = new THREE.Fog('#3a2416', 11, 26);

  // ---- lights -----------------------------------------------------------
  scene.add(new THREE.HemisphereLight('#ffe9c8', '#4a2c1e', 0.65));

  const key = new THREE.DirectionalLight('#fff1d6', 1.85);
  key.position.set(-3.4, 6.2, 3.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1.5;
  key.shadow.camera.far = 16;
  const sc = key.shadow.camera;
  sc.left = -5.0; sc.right = 5.0; sc.top = 6.0; sc.bottom = -3.0;
  sc.updateProjectionMatrix();
  key.shadow.bias = -0.0012;
  key.shadow.normalBias = 0.024;
  key.target.position.set(0, 1.0, 0);
  scene.add(key, key.target);

  const rim = new THREE.DirectionalLight('#ffc47c', 0.85);
  rim.position.set(3.8, 2.6, -3.2);
  scene.add(rim);

  // ---- table ------------------------------------------------------------
  const table = new THREE.Mesh(
    new THREE.CylinderGeometry(7.4, 7.4, 0.5, 40),
    new THREE.MeshStandardMaterial({
      map: woodTexture(), color: '#bd8b58', roughness: 0.74, metalness: 0.0, envMapIntensity: 0.25,
    })
  );
  table.position.y = -0.25;
  table.receiveShadow = true;
  scene.add(table);

  // ---- shared geometry + materials --------------------------------------
  const VARIANTS = 5;
  const chouxGeos = [];
  const coatGeos = [];
  for (let i = 0; i < VARIANTS; i++) {
    const g = makeChouxGeometry(i * 13 + 3);
    chouxGeos.push(g);
    coatGeos.push(makeCoatGeometry(g, i * 13 + 3));
  }

  const chouxMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.9, metalness: 0.0, envMapIntensity: 0.4,
  });

  // Amber caramel. Standard rather than physical: a clearcoat lobe on top of a
  // smooth dielectric washed the colour out to near-white under this env, and
  // it costs more on a phone for nothing.
  const caramelMat = new THREE.MeshStandardMaterial({
    color: '#8c4406', roughness: 0.15, metalness: 0.0,
    transparent: true, opacity: 0.9,
    emissive: '#4a2200', emissiveIntensity: 0.34,
    envMapIntensity: 0.7, side: THREE.DoubleSide,
  });

  // strands of caramel pulled between choux
  const threadMat = new THREE.MeshStandardMaterial({
    color: '#db9130', roughness: 0.08, metalness: 0.0,
    transparent: true, opacity: 0.92,
    emissive: '#6b3b06', emissiveIntensity: 0.55,
    envMapIntensity: 2.0,
  });

  // the final spun sugar veil
  const sugarMat = new THREE.MeshStandardMaterial({
    color: '#ffd98c', roughness: 0.06, metalness: 0.0,
    transparent: true, opacity: 0.92,
    emissive: '#a06a14', emissiveIntensity: 1.1,
    envMapIntensity: 2.2,
  });

  // pale cream oozing out of each joint
  const creamMat = new THREE.MeshStandardMaterial({
    color: '#fff3dc', roughness: 0.42, metalness: 0.0, envMapIntensity: 0.7,
  });

  const ghostMat = new THREE.MeshStandardMaterial({
    color: '#ffd9a0', roughness: 0.6, metalness: 0.0,
    transparent: true, opacity: 0.24, depthWrite: false,
    emissive: '#ffb15e', emissiveIntensity: 0.5,
  });

  // ---- base plate (nougatine disc) --------------------------------------
  const plate = new THREE.Group();
  const plateTop = new THREE.Mesh(
    new THREE.CylinderGeometry(LAYOUT.plateR, LAYOUT.plateR * 0.96, LAYOUT.plateH, 48),
    new THREE.MeshStandardMaterial({
      map: plateTexture(), color: '#d8a45f', roughness: 0.45, metalness: 0.0, envMapIntensity: 0.9,
    })
  );
  plateTop.position.y = LAYOUT.plateH / 2;
  plateTop.castShadow = true;
  plateTop.receiveShadow = true;
  plate.add(plateTop);

  // a ring of piped cream on the plate, so the first choux has something to sit in
  const creamRing = new THREE.Mesh(
    new THREE.TorusGeometry(LAYOUT.layers[0].r, 0.055, 8, 40),
    creamMat
  );
  creamRing.rotation.x = Math.PI / 2;
  creamRing.position.y = LAYOUT.plateH + 0.03;
  creamRing.receiveShadow = true;
  plate.add(creamRing);
  scene.add(plate);

  // glowing halo under the plate to say "the tower goes here"
  const plateGlow = new THREE.Mesh(
    new THREE.RingGeometry(LAYOUT.plateR * 1.02, LAYOUT.plateR * 1.5, 48),
    new THREE.MeshBasicMaterial({
      color: '#ffb457', transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  plateGlow.rotation.x = -Math.PI / 2;
  plateGlow.position.y = 0.012;
  scene.add(plateGlow);

  // ---- caramel pot -------------------------------------------------------
  const pot = new THREE.Group();
  pot.position.copy(LAYOUT.pot);
  const copper = new THREE.MeshStandardMaterial({
    color: '#c9793a', roughness: 0.28, metalness: 0.95, envMapIntensity: 1.4,
  });
  const potBody = new THREE.Mesh(
    new THREE.CylinderGeometry(LAYOUT.potR, LAYOUT.potR * 0.82, 0.3, 36, 1, true), copper
  );
  potBody.material.side = THREE.DoubleSide;
  potBody.position.y = 0.15;
  potBody.castShadow = true;
  pot.add(potBody);
  const potBottom = new THREE.Mesh(new THREE.CircleGeometry(LAYOUT.potR * 0.82, 36), copper);
  potBottom.rotation.x = -Math.PI / 2;
  potBottom.position.y = 0.005;
  pot.add(potBottom);
  const potRim = new THREE.Mesh(new THREE.TorusGeometry(LAYOUT.potR, 0.032, 8, 36), copper);
  potRim.rotation.x = Math.PI / 2;
  potRim.position.y = 0.3;
  potRim.castShadow = true;
  pot.add(potRim);

  const potCaramel = new THREE.Mesh(
    new THREE.CircleGeometry(LAYOUT.potR * 0.965, 44),
    new THREE.MeshStandardMaterial({
      color: '#6d2f03', roughness: 0.11, metalness: 0.0,
      emissive: '#3c1b00', emissiveIntensity: 0.42,
      envMapIntensity: 0.85,
    })
  );
  potCaramel.rotation.x = -Math.PI / 2;
  potCaramel.position.y = LAYOUT.potSurfaceY;
  pot.add(potCaramel);

  // warm halo that invites the child to dip
  const potGlow = new THREE.Mesh(
    new THREE.RingGeometry(LAYOUT.potR * 1.02, LAYOUT.potR * 1.9, 40),
    new THREE.MeshBasicMaterial({
      color: '#ffb45a', transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  potGlow.rotation.x = -Math.PI / 2;
  potGlow.position.y = 0.014;
  pot.add(potGlow);
  scene.add(pot);

  // ---- choux tray --------------------------------------------------------
  const tray = new THREE.Group();
  tray.position.copy(LAYOUT.tray);
  const bowlMat = new THREE.MeshStandardMaterial({
    color: '#efe3d0', roughness: 0.5, metalness: 0.0, envMapIntensity: 0.8, side: THREE.DoubleSide,
  });
  // a bowl that actually rests on the bench: sphere bottom sits at y = 0
  const bowlTheta = 1.924;                       // rim height ~0.34
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(
      LAYOUT.trayR, 34, 20, 0, Math.PI * 2, bowlTheta, Math.PI - bowlTheta
    ),
    bowlMat
  );
  bowl.position.y = LAYOUT.trayR;
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  tray.add(bowl);
  const bowlRim = new THREE.Mesh(
    new THREE.TorusGeometry(LAYOUT.trayR * Math.sin(bowlTheta), 0.026, 8, 36), bowlMat
  );
  bowlRim.rotation.x = Math.PI / 2;
  bowlRim.position.y = LAYOUT.trayR * (1 + Math.cos(bowlTheta));
  tray.add(bowlRim);
  scene.add(tray);

  // ---- fake contact shadows ---------------------------------------------
  const shadowMat = new THREE.MeshBasicMaterial({
    map: blobShadowTexture(), transparent: true, depthWrite: false, opacity: 0.5, color: '#000000',
  });
  const mkShadow = (size) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(size, size), shadowMat);
    s.rotation.x = -Math.PI / 2;
    s.position.y = 0.006;
    scene.add(s);
    return s;
  };
  const potShadow = mkShadow(1.5);
  const trayShadow = mkShadow(1.5);
  const plateShadow = mkShadow(2.4);

  return {
    scene, key, table, plate, plateGlow, pot, potCaramel, potGlow, tray,
    potShadow, trayShadow, plateShadow,
    chouxGeos, coatGeos,
    mats: { chouxMat, caramelMat, threadMat, sugarMat, creamMat, ghostMat },
  };
}

// ---------------------------------------------------------------------------
// Additive point sparkles (ring completion, attaching, the finale)
// ---------------------------------------------------------------------------

export class Sparkles {
  constructor(scene, max = 420) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.cursor = 0;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: sparkTexture() },
        uScale: { value: 380.0 },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        varying float vA;
        uniform float uScale;
        void main() {
          vA = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (uScale / max(0.001, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uTex;
        varying float vA;
        void main() {
          vec4 t = texture2D(uTex, gl_PointCoord);
          gl_FragColor = vec4(t.rgb, t.a * vA);
          if (gl_FragColor.a < 0.01) discard;
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.geo = g;
    scene.add(this.points);
  }

  burst(center, count, opts = {}) {
    const spread = opts.spread ?? 0.22;
    const speed = opts.speed ?? 1.0;
    const up = opts.up ?? 0.9;
    const life = opts.life ?? 0.8;
    const size = opts.size ?? 0.11;
    for (let k = 0; k < count; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * spread;
      this.pos[i * 3 + 0] = center.x + Math.cos(a) * rr;
      this.pos[i * 3 + 1] = center.y + (Math.random() - 0.35) * spread;
      this.pos[i * 3 + 2] = center.z + Math.sin(a) * rr;
      this.vel[i * 3 + 0] = Math.cos(a) * speed * (0.3 + Math.random() * 0.8);
      this.vel[i * 3 + 1] = up * (0.4 + Math.random());
      this.vel[i * 3 + 2] = Math.sin(a) * speed * (0.3 + Math.random() * 0.8);
      this.maxLife[i] = life * (0.6 + Math.random() * 0.8);
      this.life[i] = this.maxLife[i];
      this.size[i] = size * (0.6 + Math.random() * 0.9);
    }
  }

  // a ring of sparks spinning outward - used when a layer closes
  ring(y, radius, count) {
    for (let k = 0; k < count; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const a = (k / count) * Math.PI * 2 + Math.random() * 0.2;
      this.pos[i * 3 + 0] = Math.cos(a) * radius;
      this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.1;
      this.pos[i * 3 + 2] = Math.sin(a) * radius;
      this.vel[i * 3 + 0] = Math.cos(a) * 0.75;
      this.vel[i * 3 + 1] = 0.55 + Math.random() * 0.5;
      this.vel[i * 3 + 2] = Math.sin(a) * 0.75;
      this.maxLife[i] = 0.85 + Math.random() * 0.5;
      this.life[i] = this.maxLife[i];
      this.size[i] = 0.09 + Math.random() * 0.08;
    }
  }

  update(dt) {
    const { pos, vel, life, maxLife, alpha } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) { alpha[i] = 0; continue; }
      life[i] -= dt;
      if (life[i] <= 0) { alpha[i] = 0; continue; }
      vel[i * 3 + 1] -= 1.25 * dt;
      pos[i * 3 + 0] += vel[i * 3 + 0] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const t = life[i] / maxLife[i];
      alpha[i] = t * t * (3 - 2 * t);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}
