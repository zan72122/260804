import * as THREE from 'three';
import * as TX from './textures.js';
import { limbGeometry, mergeGeometries, TAU, clamp, lerp, smoothstep, rand } from './util.js';

/*
 * The training ground is a grassy headland: a flat-topped plateau with the
 * meadow cropped short, falling away on all sides into rolling farmland that
 * runs out to hazy blue hills. Standing the falconer on high ground is what
 * gives the hawk somewhere to *be* — it can swing out over the drop and come
 * back in over open air, and the flight reads as height rather than as a bird
 * skimming a lawn.
 */

const PLATEAU_R = 26; // the mown training ground itself
const NEAR_R = 60; // detailed terrain radius
const FAR_R = 900; // out to the horizon

/* ---------- terrain ---------- */

/*
 * The field sits on a low rise. The land falls away *gently* — enough that the
 * hawk gets air beneath it and the eye reads height, but never so steeply that
 * the ground's own edge cuts off the horizon. From standing height you want to
 * see all the way out to the hills; a sharp lip would put a hard line two
 * metres in front of the falconer's boots and flatten the whole picture.
 */

/** Low-frequency rolling for the farmland beyond the field. */
function lowland(x, z) {
  return (
    Math.sin(x * 0.019 + 1.1) * 2.6 +
    Math.cos(z * 0.016 - 2.0) * 3.2 +
    Math.sin((x * 0.6 + z * 0.8) * 0.011 + 0.4) * 4.4 +
    Math.cos((x * 0.9 - z * 0.5) * 0.005) * 6.0
  );
}

/** Distant ranges, only rising once you are well past the fields. */
function mountains(x, z) {
  const d = Math.hypot(x, z);
  const t = smoothstep(d, 330, 760);
  if (t <= 0) return 0;
  const a = Math.atan2(z, x);
  const ridge =
    Math.abs(Math.sin(a * 2.3 + 0.7)) * 22 +
    Math.abs(Math.sin(a * 4.1 - 1.4)) * 14 +
    Math.abs(Math.sin(a * 7.7 + 2.2)) * 8;
  return t * t * (ridge + 10);
}

export function groundHeight(x, z) {
  const d = Math.hypot(x, z);
  // Gentle swells on the field itself, flattened where the falconer stands.
  const swell =
    (Math.sin(x * 0.11 + 0.4) * 0.34 +
      Math.cos(z * 0.09 - 0.9) * 0.3 +
      Math.sin((x + z) * 0.19) * 0.13) *
    clamp((d - 3.0) / 6, 0, 1);

  // A long, shallow shoulder falling away from the field.
  const t = smoothstep(d, PLATEAU_R, 150);
  const drop = -9 * Math.pow(t, 1.4);

  return swell * (1 - t * 0.7) + drop + lowland(x, z) * t + mountains(x, z);
}

/**
 * A radial terrain sheet. `rAt` maps ring index to radius, which lets the near
 * mesh stay dense over the training ground while the far mesh spends its
 * vertices on the horizon.
 */
function terrainSheet(rings, sectors, rAt, colorFn) {
  const verts = [];
  const cols = [];
  const idx = [];
  const uvs = [];
  const c = new THREE.Color();
  for (let i = 0; i <= rings; i++) {
    const r = rAt(i / rings);
    for (let j = 0; j <= sectors; j++) {
      const a = (j / sectors) * TAU;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      verts.push(x, groundHeight(x, z), z);
      uvs.push(x / 14, z / 14);
      colorFn(c, x, z, r);
      cols.push(c.r, c.g, c.b);
    }
  }
  const stride = sectors + 1;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sectors; j++) {
      const a = i * stride + j;
      const b = a + stride;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function makeTerrain() {
  const group = new THREE.Group();
  const meadowTex = TX.meadow();
  meadowTex.map.repeat.set(1, 1);

  // Near ground: textured meadow, takes shadows.
  const near = terrainSheet(
    72,
    132,
    (t) => t * NEAR_R,
    (c, x, z, r) => {
      // Warm, drier grass toward the exposed lip of the headland.
      const dry = smoothstep(r, PLATEAU_R - 7, PLATEAU_R + 5);
      c.setRGB(1, 1, 1).lerp(new THREE.Color(0xd8c391), dry * 0.45);
    },
  );
  const nearMesh = new THREE.Mesh(
    near,
    new THREE.MeshStandardMaterial({
      map: meadowTex.map,
      roughness: 0.97,
      metalness: 0,
      vertexColors: true,
    }),
  );
  nearMesh.receiveShadow = true;
  group.add(nearMesh);

  // Far ground: no texture, just a patchwork of field colours washed out by
  // fog. Cheap, and it is what puts a real horizon behind the action.
  const fieldA = new THREE.Color(0x82985c);
  const fieldB = new THREE.Color(0x9cab6c);
  const fieldC = new THREE.Color(0xc0b485);
  const fieldD = new THREE.Color(0x6b8253);
  const far = terrainSheet(
    64,
    120,
    (t) => NEAR_R - 2 + (FAR_R - NEAR_R + 2) * Math.pow(t, 2.4),
    (c, x, z, r) => {
      // Blocky farmland patches, then bare rock once the mountains start.
      const n = TX.fbm(x * 0.012, z * 0.012, 3, 64, 9);
      const m = TX.fbm(x * 0.05 + 11, z * 0.05, 2, 64, 21);
      c.copy(fieldA).lerp(fieldB, n);
      if (m > 0.62) c.lerp(fieldC, (m - 0.62) * 2.2);
      if (n < 0.36) c.lerp(fieldD, (0.36 - n) * 2.4);
      const rock = smoothstep(r, 330, 640);
      c.lerp(new THREE.Color(0x7d8390), rock);
    },
  );
  const farMesh = new THREE.Mesh(
    far,
    new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, vertexColors: true }),
  );
  group.add(farMesh);

  return group;
}

/* ---------- sky ---------- */

function makeSky() {
  const geo = new THREE.SphereGeometry(1400, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color(0x3a74ac).convertSRGBToLinear() },
      uMid: { value: new THREE.Color(0x8fc0dd).convertSRGBToLinear() },
      uHorizon: { value: new THREE.Color(0xdfe3d9).convertSRGBToLinear() },
      uSunDir: { value: new THREE.Vector3(-0.46, 0.42, 0.78).normalize() },
      uSunCol: { value: new THREE.Color(0xffe6bb).convertSRGBToLinear() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uZenith, uMid, uHorizon, uSunDir, uSunCol;
      void main() {
        float h = vDir.y;
        vec3 col = mix(uHorizon, uMid, smoothstep(-0.02, 0.22, h));
        col = mix(col, uZenith, smoothstep(0.16, 0.9, h));
        // Broad warm scatter around the low sun.
        float s = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
        col += uSunCol * pow(s, 14.0) * 0.20;
        col += uSunCol * pow(s, 300.0) * 1.2;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = -1000;
  return m;
}

function makeClouds() {
  const group = new THREE.Group();
  const r = rand(4242);
  for (let i = 0; i < 30; i++) {
    const mat = new THREE.SpriteMaterial({
      map: TX.cloudSprite(1 + (i % 5)),
      transparent: true,
      depthWrite: false,
      opacity: 0.42 + r() * 0.36,
      fog: false,
    });
    const s = new THREE.Sprite(mat);
    const ang = r() * TAU;
    const dist = 420 + r() * 480;
    const scale = 70 + r() * 150;
    s.position.set(Math.cos(ang) * dist, 90 + r() * 240, Math.sin(ang) * dist);
    s.scale.set(scale, scale * 0.72, 1);
    s.userData.drift = (r() - 0.5) * 0.0016;
    s.userData.ang = ang;
    s.userData.dist = dist;
    s.renderOrder = -900;
    group.add(s);
  }
  group.userData.update = (dt) => {
    for (const s of group.children) {
      s.userData.ang += s.userData.drift * dt * 10;
      s.position.x = Math.cos(s.userData.ang) * s.userData.dist;
      s.position.z = Math.sin(s.userData.ang) * s.userData.dist;
    }
  };
  return group;
}

/* ---------- wind-driven grass ---------- */

function makeGrass(count = 14000, lowDetail = false) {
  // One instance is a small tuft of four crossed blades rather than a single
  // leaf. Grass only reads as turf when it is dense, and merging the tuft buys
  // four times the coverage for the same draw call and instance count.
  const H = 0.17;
  const blades = [];
  const bladeAngles = [0.0, 1.6, 3.1, 4.7];
  for (let b = 0; b < bladeAngles.length; b++) {
    const hh = H * (0.6 + (b % 4) * 0.15);
    const g = new THREE.PlaneGeometry(0.016, hh, 1, 3);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) + hh / 2;
      const t = y / hh;
      p.setX(i, p.getX(i) * (1 - t * 0.9));
      p.setY(i, y);
      // Blades lean outward from the centre of the tuft.
      p.setZ(i, p.getZ(i) - t * t * 0.055);
    }
    g.rotateY(bladeAngles[b]);
    g.translate(Math.cos(bladeAngles[b] * 1.7) * 0.013, 0, Math.sin(bladeAngles[b] * 1.7) * 0.013);
    blades.push(g);
  }
  const g = mergeGeometries(blades);
  g.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0,
    side: THREE.DoubleSide,
    vertexColors: true,
  });

  const uniforms = {
    uTime: { value: 0 },
    uBladeH: { value: H },
    uGustO: { value: new THREE.Vector2(0, 0) },
    uGustR: { value: 0 },
    uGustS: { value: 0 },
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        attribute float aYaw;
        attribute float aPhase;
        uniform float uTime, uBladeH, uGustR, uGustS;
        uniform vec2 uGustO;
        varying float vBladeAo;
      `,
      )
      .replace(
        '#include <beginnormal_vertex>',
        /* glsl */ `
        float _c = cos(aYaw), _s = sin(aYaw);
        vec3 objectNormal = vec3(
          normal.x * _c - normal.z * _s, normal.y, normal.x * _s + normal.z * _c);
      `,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        // Instances carry no rotation in their matrix; the blade is spun here so
        // the wind offset below can stay in world-aligned axes and blow every
        // blade the same way instead of dissolving into noise.
        vec3 transformed = vec3(
          position.x * _c - position.z * _s, position.y, position.x * _s + position.z * _c);

        vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float bend = clamp(position.y / uBladeH, 0.0, 1.0);
        bend *= bend;
        float ph = iPos.x * 0.9 + iPos.z * 1.2 + aPhase;
        float w = sin(uTime * 1.9 + ph) * 0.5 + sin(uTime * 3.1 + ph * 1.7) * 0.2;
        // Slow travelling gusts sweeping across the whole meadow.
        float gust = smoothstep(0.2, 1.0, sin(uTime * 0.45 + iPos.x * 0.07 + iPos.z * 0.04));
        w += gust * 1.0;
        transformed.x += bend * w * 0.075;
        transformed.z += bend * w * 0.04;
        transformed.y -= bend * abs(w) * 0.018;

        // Radial shock ring, fired when the hawk beats off the fist.
        vec2 d = iPos.xz - uGustO;
        float dist = length(d) + 1e-4;
        float ring = exp(-pow(dist - uGustR, 2.0) * 1.6) * uGustS;
        transformed.xz += (d / dist) * bend * ring * 0.7;

        // Cheap ambient occlusion down the blade: light does not reach the
        // bottom of a thick sward, and this alone turns spikes into turf.
        vBladeAo = mix(0.34, 1.0, clamp(position.y / uBladeH, 0.0, 1.0));
      `,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vBladeAo;')
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb *= vBladeAo;',
      );
  };
  mat.userData.uniforms = uniforms;

  const mesh = new THREE.InstancedMesh(g, mat, count);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  const yaws = new Float32Array(count);
  const phases = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const dummy = new THREE.Object3D();
  const r = rand(1337);
  const c = new THREE.Color();
  let n = 0;
  while (n < count) {
    // Dense in the middle of the field where the action happens, thinning out.
    const a = r() * TAU;
    // Biased inward, so the turf is thick around the falconer and thins out
    // toward the fence rather than being evenly sprinkled everywhere.
    const rad = 0.3 + Math.pow(r(), 1.35) * (PLATEAU_R + 16);
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    dummy.position.set(x, groundHeight(x, z) - 0.012, z);
    const s = 0.7 + r() * 0.85;
    dummy.scale.set(s * (0.8 + r() * 0.5), s, s);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(n, dummy.matrix);
    yaws[n] = r() * TAU;
    phases[n] = r() * TAU;
    const dry = clamp((rad - PLATEAU_R + 8) / 14, 0, 1);
    c.setHSL(
      lerp(0.245, 0.16, dry * 0.75 + r() * 0.12),
      lerp(0.5, 0.42, dry) - r() * 0.07,
      lerp(0.26, 0.44, r() * 0.7 + dry * 0.2),
    );
    c.toArray(colors, n * 3);
    n++;
  }
  g.setAttribute('aYaw', new THREE.InstancedBufferAttribute(yaws, 1));
  g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  g.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));
  mesh.instanceMatrix.needsUpdate = true;

  return { mesh, uniforms };
}

/* ---------- meadow flowers ---------- */

function makeFlowers() {
  const group = new THREE.Group();
  // Small enough to read as clover and daisies rather than parasols.
  const petal = new THREE.SphereGeometry(0.014, 6, 4);
  petal.scale(1, 0.5, 1.5);
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const p = petal.clone();
    const a = (i / 6) * TAU;
    p.rotateY(-a);
    p.translate(Math.cos(a) * 0.016, 0.09, Math.sin(a) * 0.016);
    parts.push(p);
  }
  const head = mergeGeometries(parts);
  const stem = new THREE.CylinderGeometry(0.0035, 0.005, 0.09, 4);
  stem.translate(0, 0.045, 0);
  const core = new THREE.SphereGeometry(0.011, 6, 5);
  core.translate(0, 0.093, 0);

  const palettes = [0xf6b8ce, 0xfdfbf4, 0xf7e08a, 0xd3bdee, 0xffd0dd];
  const r = rand(88);
  const N = 420;
  const headMat = palettes.map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, metalness: 0 }),
  );
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xefb949, roughness: 0.65 });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x5f8039, roughness: 0.95 });

  const byPalette = palettes.map(() => []);
  const all = [];
  // Flowers grow in patches, not evenly sprinkled.
  const clumps = [];
  for (let i = 0; i < 26; i++) {
    const a = r() * TAU;
    const rad = 2.0 + Math.pow(r(), 0.6) * (PLATEAU_R - 3);
    clumps.push([Math.cos(a) * rad, Math.sin(a) * rad]);
  }
  for (let i = 0; i < N; i++) {
    const cl = clumps[Math.floor(r() * clumps.length)];
    const x = cl[0] + (r() - 0.5) * 2.6;
    const z = cl[1] + (r() - 0.5) * 2.6;
    const y = groundHeight(x, z);
    const s = 0.7 + r() * 0.8;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler((r() - 0.5) * 0.3, r() * TAU, (r() - 0.5) * 0.3),
      ),
      new THREE.Vector3(s, s, s),
    );
    byPalette[Math.floor(r() * palettes.length)].push(m);
    all.push(m);
  }
  byPalette.forEach((mats, i) => {
    if (!mats.length) return;
    const im = new THREE.InstancedMesh(head, headMat[i], mats.length);
    mats.forEach((m, k) => im.setMatrixAt(k, m));
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
  });
  for (const [geo, mtl] of [
    [stem, stemMat],
    [core, coreMat],
  ]) {
    const im = new THREE.InstancedMesh(geo, mtl, all.length);
    all.forEach((m, k) => im.setMatrixAt(k, m));
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
  }
  return group;
}

/* ---------- trees ---------- */

function makeTree(seed) {
  const r = rand(seed);
  const g = new THREE.Group();
  const barkTex = TX.wood(0x4c3722, 0x7d5f3e, 5 + (seed % 7));
  barkTex.map.repeat.set(1.5, 3);
  barkTex.normalMap.repeat.set(1.5, 3);
  const barkMat = new THREE.MeshStandardMaterial({
    map: barkTex.map,
    normalMap: barkTex.normalMap,
    roughness: 0.95,
    metalness: 0,
  });

  const trunkH = 2.6 + r() * 1.5;
  const trunk = new THREE.Mesh(
    limbGeometry(trunkH, 0.11, 0.3, 12, 12, 0.05 * (r() - 0.5)),
    barkMat,
  );
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  g.add(trunk);

  // A couple of boughs so the canopy has something to sit on.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + r();
    const bough = new THREE.Mesh(limbGeometry(1.0, 0.035, 0.075, 6, 8, 0.25), barkMat);
    bough.position.set(0, trunkH * (0.55 + r() * 0.2), 0);
    bough.rotation.set(0, -a, 0.85 + r() * 0.25);
    bough.castShadow = true;
    g.add(bough);
  }

  const canopy = new THREE.Group();
  canopy.position.y = trunkH * 0.95;
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x4a6d34, roughness: 0.92, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x5c8140, roughness: 0.9, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x709a4c, roughness: 0.88, flatShading: true }),
  ];
  const blobs = 7 + Math.floor(r() * 3);
  for (let i = 0; i < blobs; i++) {
    const rad = 0.65 + r() * 0.6;
    const geo = new THREE.IcosahedronGeometry(rad, 1);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const n = 1 + (r() - 0.5) * 0.3;
      p.setXYZ(k, p.getX(k) * n, p.getY(k) * n * 0.82, p.getZ(k) * n);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, leafMats[i % leafMats.length]);
    const a = (i / blobs) * TAU + r() * 0.6;
    const rr = i === 0 ? 0 : 0.6 + r() * 0.8;
    m.position.set(Math.cos(a) * rr, (i === 0 ? 0.45 : 0) + r() * 0.8, Math.sin(a) * rr);
    m.castShadow = true;
    m.receiveShadow = true;
    canopy.add(m);
  }
  g.add(canopy);
  g.userData.canopy = canopy;
  g.userData.phase = r() * TAU;
  return g;
}

/** Cheap silhouette trees for the fields below — no shadows, no detail. */
function makeDistantWoods() {
  const group = new THREE.Group();
  const r = rand(9182);
  // A crown on a short trunk: enough silhouette to read as woodland at range.
  // IcosahedronGeometry is non-indexed and CylinderGeometry is indexed;
  // mergeGeometries returns null for a mismatched pair, so flatten both first.
  const crown = new THREE.IcosahedronGeometry(1, 0).toNonIndexed();
  crown.scale(1, 1.15, 1);
  crown.translate(0, 0.55, 0);
  const bole = new THREE.CylinderGeometry(0.16, 0.24, 1.0, 5).toNonIndexed();
  bole.translate(0, -0.4, 0);
  const geo = mergeGeometries([crown, bole]);
  const mats = [0x4a6438, 0x3f5730, 0x56704a].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }),
  );
  const buckets = mats.map(() => []);
  for (let i = 0; i < 520; i++) {
    const a = r() * TAU;
    const rad = 68 + Math.pow(r(), 1.5) * 320;
    const x = Math.cos(a) * rad,
      z = Math.sin(a) * rad;
    const s = 1.9 + r() * 2.8;
    buckets[Math.floor(r() * 3)].push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, groundHeight(x, z) + s * 0.42, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * TAU, 0)),
        new THREE.Vector3(s, s * (1.1 + r() * 0.5), s),
      ),
    );
  }
  buckets.forEach((ms, i) => {
    const im = new THREE.InstancedMesh(geo, mats[i], ms.length);
    ms.forEach((m, k) => im.setMatrixAt(k, m));
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
  });
  return group;
}

/* ---------- rocks ---------- */

function makeRocks() {
  const group = new THREE.Group();
  const r = rand(515);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xa8a294,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });
  for (let i = 0; i < 16; i++) {
    const geo = new THREE.DodecahedronGeometry(0.16 + r() * 0.34, 0);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const n = 1 + (r() - 0.5) * 0.45;
      p.setXYZ(k, p.getX(k) * n, p.getY(k) * n * 0.6, p.getZ(k) * n);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    const a = r() * TAU;
    const rad = 4 + Math.pow(r(), 0.6) * 20;
    const x = Math.cos(a) * rad,
      z = Math.sin(a) * rad;
    m.position.set(x, groundHeight(x, z) - 0.06, z);
    m.rotation.set(r(), r() * TAU, r() * 0.4);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

/* ---------- rustic fence marking the training ground ---------- */

function makeFence() {
  const group = new THREE.Group();
  const woodTex = TX.wood(0x5a4128, 0x9b7c53, 31);
  woodTex.map.repeat.set(1, 2);
  woodTex.normalMap.repeat.set(1, 2);
  const mat = new THREE.MeshStandardMaterial({
    map: woodTex.map,
    normalMap: woodTex.normalMap,
    roughness: 0.9,
    metalness: 0,
  });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xbfa273, roughness: 1 });
  const r = rand(707);
  const posts = [];
  const N = 14;
  // A shallow arc of posts behind the falconer, framing the shot.
  for (let i = 0; i < N; i++) {
    const a = Math.PI * (0.6 + (i / (N - 1)) * 1.05);
    const rad = 13.5 + Math.sin(i * 1.7) * 0.8;
    const x = Math.cos(a) * rad,
      z = Math.sin(a) * rad;
    const y = groundHeight(x, z);
    const h = 1.05 + r() * 0.2;
    const post = new THREE.Mesh(limbGeometry(h, 0.055, 0.075, 8, 8, 0), mat);
    post.position.set(x, y - 0.08, z);
    post.rotation.set((r() - 0.5) * 0.1, r() * TAU, (r() - 0.5) * 0.1);
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);
    posts.push(new THREE.Vector3(x, y + h * 0.8, z));
  }
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i],
      b = posts[i + 1];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y -= 0.18;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.018, 5, false), ropeMat);
    tube.castShadow = true;
    group.add(tube);
  }
  return group;
}

/* ---------- the bow perch the hawk starts on ---------- */

function makePerch() {
  const group = new THREE.Group();
  const woodTex = TX.wood(0x5c3f26, 0xa07a4c, 12);
  woodTex.map.repeat.set(1, 3);
  woodTex.normalMap.repeat.set(1, 3);
  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex.map,
    normalMap: woodTex.normalMap,
    roughness: 0.82,
    metalness: 0,
  });
  const leatherTex = TX.leather(0x5c3218, 0x9a6337, 3);
  const leatherMat = new THREE.MeshStandardMaterial({
    map: leatherTex.map,
    normalMap: leatherTex.normalMap,
    roughness: 0.62,
    metalness: 0.02,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xd7ac5c,
    roughness: 0.32,
    metalness: 0.85,
  });

  // Classic bow perch: a wooden arc staked into the turf.
  const H = 0.95,
    W = 0.5;
  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(-W, -0.2, 0),
    new THREE.Vector3(-W * 0.95, H * 1.0, 0),
    new THREE.Vector3(W * 0.95, H * 1.0, 0),
    new THREE.Vector3(W, -0.2, 0),
  );
  const bow = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.038, 10, false), woodMat);
  bow.castShadow = true;
  bow.receiveShadow = true;
  group.add(bow);

  // Leather-wrapped standing area at the crown.
  const wrapCurve = new THREE.CubicBezierCurve3(
    curve.getPoint(0.34),
    curve.getPoint(0.45),
    curve.getPoint(0.55),
    curve.getPoint(0.66),
  );
  const wrap = new THREE.Mesh(new THREE.TubeGeometry(wrapCurve, 22, 0.056, 12, false), leatherMat);
  wrap.castShadow = true;
  group.add(wrap);

  // Swivel ring where the leash is normally tied off.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 16), brass);
  ring.position.set(0, 0.03, 0);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // A falconer's hood resting on the turf beside the perch — a small, very
  // specific prop that says "falconry" even in a still frame.
  const hood = new THREE.Group();
  const hoodBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 16, 12, 0, TAU, 0, Math.PI * 0.62),
    leatherMat,
  );
  hoodBody.scale.set(1, 1.2, 1.05);
  hoodBody.castShadow = true;
  hood.add(hoodBody);
  const plume = new THREE.Mesh(
    new THREE.ConeGeometry(0.016, 0.1, 7),
    new THREE.MeshStandardMaterial({ color: 0xe58fb0, roughness: 0.7 }),
  );
  plume.position.y = 0.085;
  plume.rotation.z = 0.3;
  hood.add(plume);
  hood.position.set(0.5, 0.02, 0.3);
  hood.rotation.z = 0.3;
  group.add(hood);

  const perchPoint = new THREE.Vector3(0, H * 0.755, 0);
  return { group, perchPoint };
}

/* ---------- assembly ---------- */

export function createWorld(scene, opts = {}) {
  const low = opts.quality === 'low';
  const world = new THREE.Group();
  scene.add(world);

  scene.fog = new THREE.FogExp2(new THREE.Color(0xd2d9cf), 0.0019);

  scene.add(makeSky());
  const clouds = makeClouds();
  scene.add(clouds);

  world.add(makeTerrain());
  const grass = makeGrass(low ? 3500 : 14000, low);
  world.add(grass.mesh);
  world.add(makeFlowers());
  world.add(makeRocks());
  world.add(makeFence());
  if (!low) world.add(makeDistantWoods());

  const trees = [];
  const treeSpots = [
    [-9.5, -8.0, 1.15],
    [11.0, -9.5, 1.0],
    [-14.0, 3.5, 0.9],
    [15.5, 2.0, 0.8],
    [-3.5, -14.0, 1.05],
    [6.5, -16.0, 0.85],
    [-19, -6, 0.75],
  ];
  treeSpots.forEach(([x, z, s], i) => {
    const t = makeTree(101 + i * 13);
    t.position.set(x, groundHeight(x, z) - 0.08, z);
    t.scale.setScalar(s);
    t.rotation.y = i * 1.7;
    world.add(t);
    trees.push(t);
  });

  const perch = makePerch();
  const perchAt = new THREE.Vector3(-1.55, 0, 0.7);
  perch.group.position.set(perchAt.x, groundHeight(perchAt.x, perchAt.z), perchAt.z);
  perch.group.rotation.y = 0.5;
  world.add(perch.group);
  const perchPoint = perch.perchPoint.clone();
  perch.group.localToWorld(perchPoint);

  /* ---- lighting ---- */

  const hemi = new THREE.HemisphereLight(0xc6dcf2, 0x6c7d46, 0.42);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2dc, 2.9);
  sun.position.set(-13, 13, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  const S = 20;
  sun.shadow.camera.left = -S;
  sun.shadow.camera.right = S;
  sun.shadow.camera.top = S;
  sun.shadow.camera.bottom = -S;
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.028;
  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.set(0, 1, 0);

  // Cool bounce from the sky side, keeping shadow interiors from going muddy.
  const fill = new THREE.DirectionalLight(0x9cc0e8, 0.3);
  fill.position.set(11, 4, 2);
  scene.add(fill);

  // Warm kicker behind the action for rim light on wings and shoulders.
  const rim = new THREE.DirectionalLight(0xffcf96, 1.15);
  rim.position.set(4, 3.2, -13);
  scene.add(rim);

  let time = 0;
  function update(dt) {
    time += dt;
    grass.uniforms.uTime.value = time;
    if (grass.uniforms.uGustS.value > 0.001) {
      grass.uniforms.uGustR.value += dt * 11;
      grass.uniforms.uGustS.value *= Math.exp(-dt * 1.9);
    }
    clouds.userData.update(dt);
    for (const t of trees) {
      const p = t.userData.phase;
      t.userData.canopy.rotation.z = Math.sin(time * 0.8 + p) * 0.03;
      t.userData.canopy.rotation.x = Math.cos(time * 0.65 + p * 1.3) * 0.025;
    }
  }

  /** Fire a ring of wind through the grass — the hawk's downdraft. */
  function gust(pos, strength = 0.5) {
    grass.uniforms.uGustO.value.set(pos.x, pos.z);
    grass.uniforms.uGustR.value = 0.3;
    grass.uniforms.uGustS.value = strength;
  }

  return { group: world, update, gust, perch: perch.group, perchPoint, sun, PLATEAU_R };
}
