// The world behind the counter: sky, light, terrace, town, hills.
//
// Everything here exists to make depth readable at a glance. The stall stands
// on a hillside terrace, so the layers stack down and away from the player:
//
//   near   — the counter you play on (stall.js), 0.5–1.5 m
//   mid    — the terrace: neighbouring stalls, lamp posts, people, parapet, 2–8 m
//   far    — the town spilling down the slope below the parapet, 25–110 m
//   sky    — water/plain and hills dissolving into haze, 150 m+
//
// The parapet is the hinge: it is the last thing with sharp contrast and full
// saturation, and everything past it is progressively eaten by aerial haze.

import * as THREE from 'three';
import * as M from '../engine/materials.js';
import * as G from '../engine/geo.js';
import * as TEX from '../engine/textures.js';
import { makeRng, lerp } from '../engine/util.js';
import { buildPerson, walkPose } from './people.js';

// Terrace geometry — shared by everything that stands on it.
export const TERRACE = {
  frontZ: 4.0,        // behind the camera
  edgeZ: -6.2,        // where the parapet runs
  halfWidth: 11,
  wallH: 0.9,
  slope: 0.19,        // ~11 deg: gentle enough that you see over the rooftops
  valleyY: -22,       // where the hillside finally bottoms out
  valleyZ: -120,
};

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = (modelMatrix * vec4(position, 1.0)).xyz - cameraPosition;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform vec3 uTop, uHigh, uHorizon, uLow, uSunColor, uSunDir, uCloudColor, uCloudDark;
uniform float uSunSize, uStars, uCloud, uTime;

float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(vec3(i, 0.0));
  float b = hash(vec3(i + vec2(1.0, 0.0), 0.0));
  float c = hash(vec3(i + vec2(0.0, 1.0), 0.0));
  float d = hash(vec3(i + vec2(1.0, 1.0), 0.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -1.0, 1.0);

  // Four-stop vertical gradient: the horizon band is the widest because that
  // is where the atmosphere is thickest and where depth reads.
  vec3 col = mix(uLow, uHorizon, smoothstep(-0.06, 0.035, h));
  col = mix(col, uHigh, smoothstep(0.02, 0.28, h));
  col = mix(col, uTop, smoothstep(0.22, 0.85, h));

  // Sun disc plus the wide forward-scatter glow that sells the time of day.
  vec3 sd = normalize(uSunDir);
  float sdot = max(dot(d, sd), 0.0);
  col += uSunColor * pow(sdot, 8.0) * 0.30;
  col += uSunColor * pow(sdot, 220.0) * 1.4;
  float disc = smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.35, sdot);
  col = mix(col, uSunColor * 2.6, disc);

  // Stars fade in only well above the horizon and only at dusk.
  if (uStars > 0.001 && h > 0.02) {
    vec3 sp = floor(d * 320.0);
    float st = hash(sp);
    float tw = 0.6 + 0.4 * sin(uTime * 2.4 + st * 40.0);
    float mask = smoothstep(0.02, 0.5, h) * uStars;
    col += vec3(step(0.9975, st) * tw * mask);
  }

  // Cloud deck projected onto a virtual plane — the drift is slow enough to be
  // felt rather than watched.
  if (uCloud > 0.001) {
    float hh = max(h, 0.045);
    vec2 cp = d.xz / hh * 0.55 + vec2(uTime * 0.0035, uTime * 0.0012);
    float n = fbm(cp * 1.7);
    float n2 = fbm(cp * 3.9 + 12.3);
    float cov = smoothstep(0.52 - uCloud * 0.22, 0.78, n * 0.75 + n2 * 0.25);
    cov *= smoothstep(0.015, 0.30, h) * (1.0 - smoothstep(0.75, 1.0, h) * 0.45);
    vec3 cc = mix(uCloudDark, uCloudColor, smoothstep(0.35, 0.85, n));
    cc += uSunColor * pow(sdot, 6.0) * 0.35;
    col = mix(col, cc, cov * 0.9);
  }

  // Ordered dither: kills banding in the big smooth gradients.
  float dith = (hash(vec3(gl_FragCoord.xy, 1.0)) - 0.5) / 255.0;
  gl_FragColor = vec4(col + dith, 1.0);
}`;

export class Environment {
  constructor(view) {
    this.view = view;
    this.scene = view.scene;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.movers = [];
    this.lampLights = [];
    this.time = 0;
  }

  // ------------------------------------------------------------ build ----
  build(dest) {
    this.dispose();
    this.dest = dest;
    const rng = makeRng(1337);

    this.view.renderer.toneMappingExposure = dest.exposure;

    this._sky(dest);
    this._lights(dest);
    this._terrace(dest, rng);
    this._slope(dest, rng);
    this._town(dest, rng);
    this._water(dest);
    this._hills(dest, rng);
    this._streetLife(dest, rng);
    this._crowd(dest, rng);
    return this.root;
  }

  _sky(dest) {
    const s = dest.sky;
    const uni = {
      uTop: { value: new THREE.Color(s.top) },
      uHigh: { value: new THREE.Color(s.high) },
      uHorizon: { value: new THREE.Color(s.horizon) },
      uLow: { value: new THREE.Color(s.low) },
      uSunColor: { value: new THREE.Color(s.sunColor) },
      uCloudColor: { value: new THREE.Color(s.cloudColor) },
      uCloudDark: { value: new THREE.Color(s.cloudDark) },
      uSunDir: { value: new THREE.Vector3(...s.sunDir).normalize() },
      uSunSize: { value: s.sunSize },
      uStars: { value: s.stars },
      uCloud: { value: s.cloud },
      uTime: { value: 0 },
    };
    this.skyUniforms = uni;
    const mat = new THREE.ShaderMaterial({
      uniforms: uni, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: true,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 20), mat);
    dome.renderOrder = -1000;
    this.root.add(dome);
    this._dome = dome;

    // Exponential haze tinted to the horizon: this is the aerial perspective
    // that separates terrace from town and town from hills.
    this.scene.fog = new THREE.FogExp2(new THREE.Color(dest.fog.color), dest.fog.density);
    this.scene.background = null;
  }

  _lights(dest) {
    const sunDir = new THREE.Vector3(...dest.sun.dir).normalize();

    const sun = new THREE.DirectionalLight(new THREE.Color(dest.sun.color), dest.sun.intensity);
    sun.position.copy(sunDir).multiplyScalar(26);
    sun.castShadow = true;
    // Tight ortho frustum around the playable stall keeps texel density high
    // enough for real contact shadows under every ingredient.
    const s = 3.6;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 6; sun.shadow.camera.far = 48;
    sun.shadow.mapSize.set(this.view.shadowSize, this.view.shadowSize);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.012;
    sun.shadow.radius = 2.2;
    sun.target.position.set(0, 0.8, -0.4);
    this.root.add(sun, sun.target);
    this.sun = sun;

    const hemi = new THREE.HemisphereLight(
      new THREE.Color(dest.hemi.sky), new THREE.Color(dest.hemi.ground), dest.hemi.intensity);
    hemi.position.set(0, 12, 0);
    this.root.add(hemi);

    // Warm bounce off the pavement, from the sun side, no shadow: this is what
    // keeps the underside of jars and crates from going pure black.
    const bounce = new THREE.DirectionalLight(
      new THREE.Color(dest.bounce.color), dest.bounce.intensity);
    bounce.position.set(-sunDir.x * 8, 1.2, -sunDir.z * 8);
    bounce.target.position.set(0, 0.9, 0);
    this.root.add(bounce, bounce.target);
  }

  // ---------------------------------------------------------- terrace ----
  _terrace(dest, rng) {
    const T = TERRACE;
    const depth = T.frontZ - T.edgeZ;
    const paving = M.paving(14, dest.ground);
    const deck = G.mesh(new THREE.PlaneGeometry(T.halfWidth * 2, depth), paving, {
      rot: [-Math.PI / 2, 0, 0], pos: [0, 0, (T.frontZ + T.edgeZ) / 2], cast: false, parent: this.root,
    });
    deck.geometry.userData.shared = false;
    deck.receiveShadow = true;

    // Parapet: rendered wall with a stone coping. This is the silhouette line
    // that separates everything you can touch from everything you cannot.
    const wallMat = M.wall(dest.walls[0], 6, 0.9);
    const coping = M.wall(dest.trim, 3, 0.5);
    const wall = G.mesh(new THREE.BoxGeometry(T.halfWidth * 2, T.wallH, 0.34), wallMat, {
      pos: [0, T.wallH / 2, T.edgeZ], parent: this.root,
    });
    wall.geometry.userData.shared = false;
    wall.receiveShadow = true;
    const cap = G.mesh(new THREE.BoxGeometry(T.halfWidth * 2 + 0.12, 0.08, 0.46), coping, {
      pos: [0, T.wallH + 0.04, T.edgeZ], parent: this.root,
    });
    cap.geometry.userData.shared = false;

    // Side walls running back toward the camera, cut off by the frame edges.
    for (const sx of [-1, 1]) {
      const sw = G.mesh(new THREE.BoxGeometry(0.34, T.wallH, depth * 0.55), wallMat, {
        pos: [sx * T.halfWidth, T.wallH / 2, T.edgeZ + depth * 0.28], parent: this.root,
      });
      sw.geometry.userData.shared = false;
    }

    // Potted trees and a bench along the parapet: mid-ground mass that breaks
    // the wall's straight line and casts long shadows across the paving.
    for (let i = 0; i < 5; i++) {
      const x = -7.2 + i * 3.6 + rng.range(-0.4, 0.4);
      const t = this._tree(dest, rng);
      t.position.set(x, 0, T.edgeZ + 0.75);
      t.rotation.y = rng.range(0, 6.28);
      this.root.add(G.freeze(t));
    }
    const bench = this._bench(dest);
    bench.position.set(-4.6, 0, T.edgeZ + 1.5);
    bench.rotation.y = 0.12;
    this.root.add(G.freeze(bench));

    // Bunting strung along the parapet — cheap, and it reads instantly as
    // "market" while adding a mid-depth cue that crosses the frame.
    this._bunting(dest, rng);
  }

  _bench(dest) {
    const g = new THREE.Group();
    const slat = M.paintedWood(dest.shutter, 3);
    const iron = M.iron();
    for (let i = 0; i < 3; i++) {
      G.mesh(G.box(1.7, 0.045, 0.12, 0.01), slat, { pos: [0, 0.44, -0.16 + i * 0.15], parent: g });
    }
    for (let i = 0; i < 3; i++) {
      G.mesh(G.box(1.7, 0.045, 0.11, 0.01), slat, { pos: [0, 0.62 + i * 0.14, -0.24], parent: g });
    }
    for (const sx of [-1, 1]) {
      G.mesh(G.box(0.06, 0.44, 0.5, 0.01), iron, { pos: [sx * 0.75, 0.22, -0.05], parent: g });
      G.mesh(G.box(0.05, 0.5, 0.06, 0.01), iron, { pos: [sx * 0.75, 0.66, -0.26], parent: g });
    }
    return g;
  }

  _tree(dest, rng) {
    const g = new THREE.Group();
    const potMat = M.terracotta(dest.id === 'kyoto' ? 0x6d6a5c : 0xa85c38);
    G.mesh(G.lathe([[0.001, 0], [0.3, 0], [0.34, 0.08], [0.4, 0.56], [0.43, 0.62], [0.39, 0.62], [0.36, 0.08], [0.001, 0.08]], 20),
      potMat, { parent: g });
    G.mesh(G.cyl(0.34, 0.34, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0x3a2c20, roughness: 1 }),
      { pos: [0, 0.6, 0], parent: g });

    const trunkMat = M.crateWood(2);
    const h = rng.range(1.5, 2.3);
    G.mesh(G.cyl(0.05, 0.075, h, 8), trunkMat, { pos: [0, 0.6 + h / 2, 0], parent: g });

    const leafMat = M.leaf(dest.id === 'marrakech' ? 0x5f7a3a : dest.id === 'kyoto' ? 0x7a5a3a : 0x4a6f2c);
    if (dest.tree === 'palm') {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const frond = G.mesh(G.plane(0.26, 1.5), leafMat, {
          pos: [Math.cos(a) * 0.18, 0.6 + h, Math.sin(a) * 0.18], parent: g,
        });
        frond.rotation.set(-1.1 + rng.range(-0.25, 0.25), a, rng.range(-0.3, 0.3));
      }
    } else {
      const crown = rng.int(9, 13);
      for (let i = 0; i < crown; i++) {
        const a = rng.range(0, 6.28), r = rng.range(0, 0.55);
        G.mesh(G.sphere(rng.range(0.28, 0.46), 10), leafMat, {
          pos: [Math.cos(a) * r, 0.6 + h + rng.range(-0.15, 0.45), Math.sin(a) * r], parent: g,
        });
      }
    }
    return g;
  }

  _bunting(dest, rng) {
    const T = TERRACE;
    const wire = new THREE.MeshStandardMaterial({ color: 0x1a1613, roughness: 0.9 });
    const flagCols = [dest.awning.b, dest.awning.a, dest.shutter, dest.roof];
    const bulbMat = M.emissive(dest.lantern.color, 2.2);

    const spans = [
      [new THREE.Vector3(-8.6, 3.3, T.edgeZ + 0.4), new THREE.Vector3(-2.4, 2.9, T.edgeZ + 0.2)],
      [new THREE.Vector3(-2.4, 2.9, T.edgeZ + 0.2), new THREE.Vector3(4.2, 3.2, T.edgeZ + 0.5)],
      [new THREE.Vector3(4.2, 3.2, T.edgeZ + 0.5), new THREE.Vector3(9.0, 3.6, T.edgeZ - 0.1)],
    ];
    spans.forEach(([a, b], si) => {
      const curve = G.catenary(a, b, 0.5, 20);
      const t = new THREE.Mesh(G.tube(curve, 0.007, 24, 5), wire);
      t.castShadow = false;
      this.root.add(t);
      const n = 12;
      for (let i = 1; i < n; i++) {
        const p = curve.getPoint(i / n);
        if (i % 3 === 0) {
          const bulb = G.mesh(G.sphere(0.05, 8), bulbMat, {
            pos: [p.x, p.y - 0.06, p.z], cast: false, receive: false, parent: this.root,
          });
          const glow = new THREE.Sprite(M.halo(dest.lantern.color, 0.55));
          glow.position.copy(bulb.position);
          glow.scale.setScalar(0.42);
          this.root.add(glow);
          this.movers.push({ kind: 'bulb', obj: bulb, glow, phase: i * 1.7 + si });
        } else {
          const flag = G.mesh(G.plane(0.2, 0.26), M.cloth(flagCols[i % flagCols.length], 0.95), {
            pos: [p.x, p.y - 0.14, p.z], parent: this.root, cast: false,
          });
          flag.material.side = THREE.DoubleSide;
          this.movers.push({ kind: 'flag', obj: flag, phase: i * 0.8 + si });
        }
      }
    });
  }

  /**
   * Terrain height at a given z. Flat on the terrace, then a constant 11°
   * grade down to the valley floor. Houses, the hillside mesh and the town all
   * read from this one function so nothing ever floats or sinks.
   */
  static groundY(z) {
    const T = TERRACE;
    if (z >= T.edgeZ) return 0;
    return Math.max(T.valleyY, -(T.edgeZ - z) * T.slope);
  }

  /**
   * Tallest a house at this z can be before it blocks the view.
   *
   * The player's eye sits only ~0.75 m above the parapet, so the sightline
   * that grazes the coping is what decides whether the town below is visible
   * at all. Roofs are allowed to rise a few metres through that line — enough
   * to be seen and to overlap each other — and no further.
   */
  static maxHouseHeight(z, band = 0.035) {
    const EYE_Y = 1.65, EYE_Z = 1.24;
    const grazeSlope = (TERRACE.wallH - EYE_Y) / (EYE_Z - TERRACE.edgeZ);
    const dist = EYE_Z - z;
    const rayY = EYE_Y + grazeSlope * dist;
    // Headroom scales with distance, so every row of roofs rises the same few
    // degrees above the parapet line instead of the near ones swallowing the
    // frame. `band` is roughly the angle (in radians) they are allowed to fill.
    return Math.max(2.6, rayY - Environment.groundY(z) + band * dist + 0.4);
  }

  // ------------------------------------------------------------ slope ----
  _slope(dest, rng) {
    const T = TERRACE;
    // The hillside itself, built as a strip that follows groundY() step by
    // step so it meets the parapet exactly and flattens out at the valley.
    const X = 420;
    const zs = [T.edgeZ + 0.2];
    for (let z = T.edgeZ - 4; z >= T.valleyZ - 40; z -= 8) zs.push(z);
    const pos = [], uv = [];
    for (let i = 0; i < zs.length - 1; i++) {
      const z0 = zs[i], z1 = zs[i + 1];
      const y0 = Environment.groundY(z0), y1 = Environment.groundY(z1);
      const v0 = i, v1 = i + 1;
      pos.push(-X, y0, z0, X, y0, z0, X, y1, z1);
      pos.push(-X, y0, z0, X, y1, z1, -X, y1, z1);
      uv.push(0, v0, 26, v0, 26, v1, 0, v0, 26, v1, 0, v1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    const hill = new THREE.Mesh(geo, M.wall(dest.walls[3], 30, 0.9));
    hill.castShadow = false; hill.receiveShadow = false;
    this.root.add(hill);

    // The town cascading down the hillside. Because the grade is gentle and
    // the parapet is low, the roofs step away below the sightline instead of
    // hiding behind the wall — this is the layer that carries the distance.
    this._houses(dest, rng, {
      count: 180,
      zRange: [-18, -80],
      bias: 0.85,
      xSpread: (t) => 16 + t * 95,
      size: (t, z) => [
        rng.range(3.4, 7.5), rng.range(3.4, 7),
        Math.min(rng.range(3.6, 9), Environment.maxHouseHeight(z)),
      ],
      onSlope: true,
    });
  }

  /**
   * Build a field of houses and merge them into one mesh per material.
   * @param {object} o count / z range / horizontal spread / size sampler
   */
  _houses(dest, rng, o) {
    const wallGeos = dest.walls.map(() => []);
    const roofGeos = [];
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);

    for (let i = 0; i < o.count; i++) {
      const t = Math.pow(rng(), o.bias ?? 1);
      const z = lerp(o.zRange[0], o.zRange[1], t);
      const y = o.onSlope ? Environment.groundY(z) - 0.4 : TERRACE.valleyY;
      const spread = o.xSpread(t);
      const x = rng.range(-spread, spread);
      const [w, d, h] = o.size(t, z);
      const ry = rng.range(-0.45, 0.45);

      const wall = new THREE.BoxGeometry(w, h, d);
      e.set(0, ry, 0); q.setFromEuler(e);
      wall.applyMatrix4(m4.compose(v.set(x, y + h / 2, z), q, one));
      wallGeos[i % wallGeos.length].push(wall);

      // Hipped tile roof with an eave lip — the silhouette that makes a box
      // read as a house from 40 m away.
      const rh = Math.min(w, d) * 0.36;
      const roof = new THREE.CylinderGeometry(0.001, Math.max(w, d) * 0.78, rh, 4);
      roof.scale(1, 1, d / w);
      e.set(0, ry + Math.PI / 4, 0); q.setFromEuler(e);
      roof.applyMatrix4(m4.compose(v.set(x, y + h + rh / 2, z), q, one));
      roofGeos.push(roof);

      const eave = new THREE.BoxGeometry(w + 0.5, 0.22, d + 0.5);
      e.set(0, ry, 0); q.setFromEuler(e);
      eave.applyMatrix4(m4.compose(v.set(x, y + h + 0.11, z), q, one));
      roofGeos.push(eave);

      // Occasional chimney.
      if (rng() < 0.35) {
        const ch = new THREE.BoxGeometry(0.5, 1.3, 0.5);
        ch.applyMatrix4(m4.compose(v.set(x + rng.range(-w / 3, w / 3), y + h + 0.9, z + rng.range(-d / 3, d / 3)), q, one));
        roofGeos.push(ch);
      }
    }

    const mats = o.facade
      ? dest.walls.map((wallCol, i) => M.facadeMat({
        wall: wallCol, trim: dest.trim, shutter: dest.shutter,
        floors: 3 + (i % 3), bays: 2 + (i % 3), seed: 5 + i * 13,
        litChance: dest.windowLit, emissive: dest.windowColor,
        emissiveIntensity: dest.id === 'lisbon' ? 1.6 : 0.5,
      }))
      : dest.walls.map((c, i) => M.facadeMat({
        wall: c, trim: dest.trim, shutter: dest.shutter,
        floors: 2, bays: 2, seed: 41 + i * 7,
        litChance: dest.windowLit * 0.8, emissive: dest.windowColor,
        emissiveIntensity: dest.id === 'lisbon' ? 1.4 : 0.45,
      }));

    wallGeos.forEach((bucket, i) => {
      if (!bucket.length) return;
      const merged = G.mergeGeometries(bucket, false);
      bucket.forEach((b) => b.dispose());
      const mesh = new THREE.Mesh(merged, mats[i]);
      mesh.castShadow = false; mesh.receiveShadow = false;
      this.root.add(mesh);
    });
    if (roofGeos.length) {
      const merged = G.mergeGeometries(roofGeos, false);
      roofGeos.forEach((b) => b.dispose());
      const mesh = new THREE.Mesh(merged, M.roofTile(dest.roof));
      mesh.castShadow = false; mesh.receiveShadow = false;
      this.root.add(mesh);
    }
  }

  // ------------------------------------------------------------- town ----
  _town(dest, rng) {
    // The lower town: bigger blocks, further out, dissolving into haze.
    this._houses(dest, rng, {
      count: 120,
      zRange: [-72, -180],
      bias: 0.7,
      xSpread: (t) => 55 + t * 190,
      size: (t, z) => [
        rng.range(7, 16), rng.range(7, 15),
        Math.min(rng.range(7, 12) + t * 16, Environment.maxHouseHeight(z, 0.085)),
      ],
      onSlope: true,
      facade: true,
    });
    this._landmark(dest);
  }

  _landmark(dest) {
    const fog = new THREE.Color(dest.fog.color);
    const g = new THREE.Group();
    const stoneCol = new THREE.Color(dest.id === 'kyoto' ? 0x6a5a4a : dest.id === 'marrakech' ? 0xc08a52 : 0xbaa88c)
      .lerp(fog, 0.3);
    const stone = new THREE.MeshStandardMaterial({ color: stoneCol, roughness: 1, metalness: 0 });
    const roof = new THREE.MeshStandardMaterial({ color: new THREE.Color(dest.roof).lerp(fog, 0.35), roughness: 1 });

    if (dest.landmark === 'castle') {
      G.mesh(new THREE.BoxGeometry(46, 11, 12), stone, { pos: [0, 5.5, 0], parent: g, cast: false, receive: false });
      for (const x of [-20, 20]) {
        G.mesh(G.cyl(6.5, 7.2, 22, 14), stone, { pos: [x, 11, 0], parent: g, cast: false, receive: false });
        G.mesh(G.cone(8, 7, 14), roof, { pos: [x, 25, 0], parent: g, cast: false, receive: false });
      }
      G.mesh(new THREE.BoxGeometry(14, 26, 12), stone, { pos: [0, 13, -2], parent: g, cast: false, receive: false });
      G.mesh(G.cone(11, 9, 4), roof, { pos: [0, 30, -2], rot: [0, Math.PI / 4, 0], parent: g, cast: false, receive: false });
    } else if (dest.landmark === 'pagoda') {
      for (let i = 0; i < 5; i++) {
        const s = 1 - i * 0.13;
        const y = 6 + i * 7.4;
        G.mesh(new THREE.BoxGeometry(12 * s, 5.6, 12 * s), stone, { pos: [0, y, 0], parent: g, cast: false, receive: false });
        G.mesh(G.cone(12.5 * s, 3.4, 4), roof, { pos: [0, y + 4.2, 0], rot: [0, Math.PI / 4, 0], parent: g, cast: false, receive: false });
      }
      G.mesh(G.cyl(0.35, 0.5, 9, 8), stone, { pos: [0, 46, 0], parent: g, cast: false, receive: false });
    } else {
      G.mesh(new THREE.BoxGeometry(11, 44, 11), stone, { pos: [0, 22, 0], parent: g, cast: false, receive: false });
      G.mesh(new THREE.BoxGeometry(7.5, 9, 7.5), stone, { pos: [0, 48, 0], parent: g, cast: false, receive: false });
      G.mesh(G.cone(6.2, 8, 4), roof, { pos: [0, 56, 0], rot: [0, Math.PI / 4, 0], parent: g, cast: false, receive: false });
      G.mesh(G.sphere(1.1, 10), roof, { pos: [0, 61, 0], parent: g, cast: false, receive: false });
    }

    const lz = -86;
    g.position.set(dest.landmark === 'pagoda' ? -52 : 44, Environment.groundY(lz), lz);
    this.root.add(g);
  }

  _water(dest) {
    // Sea / river / plain past the town, sitting a touch below the valley
    // floor. At this distance the haze does the work; it just needs to catch
    // the sky and give the far layer a horizontal.
    const isWater = dest.id !== 'marrakech';
    const col = new THREE.Color(dest.id === 'kyoto' ? 0x8fa8b4 : 0x6f6488)
      .lerp(new THREE.Color(dest.fog.color), 0.45);
    const mat = new THREE.MeshStandardMaterial({
      color: isWater ? col : new THREE.Color(dest.ground).lerp(new THREE.Color(dest.fog.color), 0.5),
      roughness: isWater ? 0.14 : 0.95,
      metalness: isWater ? 0.4 : 0,
      roughnessMap: isWater ? TEX.grunge({ scale: 22, seed: 301, lo: 0.06, hi: 0.3 }) : null,
    });
    const w = new THREE.Mesh(new THREE.PlaneGeometry(2400, 900), mat);
    w.rotation.x = -Math.PI / 2;
    w.position.set(0, TERRACE.valleyY - 1.2, -560);
    w.receiveShadow = false;
    this.root.add(w);

    // Valley floor under the far town, so there is never a gap to the sky.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 320), new THREE.MeshStandardMaterial({
      color: new THREE.Color(dest.ground).lerp(new THREE.Color(dest.fog.color), 0.4), roughness: 1,
    }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, TERRACE.valleyY - 0.05, -230);
    this.root.add(ground);
  }

  _hills(dest, rng) {
    // Silhouette-only bands. Colour is pulled almost all the way to the fog so
    // they read as distance, not as objects.
    const fog = new THREE.Color(dest.fog.color);
    const base = new THREE.Color(dest.id === 'kyoto' ? 0x4e6656 : dest.id === 'marrakech' ? 0x8a6a44 : 0x4a4258);
    // Placed so their crests rise above the player's eye line: from a
    // hillside terrace the far hills are the one thing above the horizon.
    const bands = [
      { z: -900, h: 150, w: 3000, mix: 0.9, base: -30 },
      { z: -620, h: 110, w: 2200, mix: 0.78, base: -28 },
      { z: -420, h: 76, w: 1600, mix: 0.62, base: -26 },
    ];
    bands.forEach((b, i) => {
      const geo = G.ridge(b.w, b.h, 30 + i * 8, makeRng(90 + i * 7), 0.55);
      const col = base.clone().lerp(fog, b.mix);
      const mat = new THREE.MeshBasicMaterial({ color: col, fog: false });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(0, b.base + b.h, b.z);
      m.renderOrder = -900 + i;
      this.root.add(m);
    });
  }

  // ------------------------------------------------------ street life ----
  _streetLife(dest, rng) {
    const T = TERRACE;
    // Neighbouring stalls at 3–7 m: same construction language as the player's
    // stall, so the eye reads them as the same kind of object further away.
    const spots = [[-3.4, -3.2, 0.45], [3.9, -4.4, -0.5], [-5.2, -5.6, 0.3], [6.4, -6.0, -0.7]];
    spots.forEach(([x, z, ry], i) => {
      const a = dest.stallAwnings[i % dest.stallAwnings.length];
      const st = this._neighbourStall(a, rng);
      st.position.set(x, 0, z);
      st.rotation.y = ry;
      this.root.add(G.freeze(st));
    });

    for (const [x, z] of [[-2.0, -6.2], [4.6, -6.3], [-7.4, -5.4]]) {
      this.root.add(G.freeze(this._lampPost(dest, x, z)));
    }

    for (let i = 0; i < 5; i++) {
      const b = this._barrel(rng);
      b.position.set(rng.sign() * rng.range(2.4, 8), 0, rng.range(-2, -6.4));
      b.rotation.y = rng.range(0, Math.PI);
      this.root.add(G.freeze(b));
    }

    // Crate stacks straight down the middle of the terrace. Without them the
    // centre of frame is bare paving and the mid ground drops out.
    for (const [x, z, n] of [[-1.5, -4.6, 3], [1.3, -5.8, 2], [-3.6, -7.2, 2], [2.9, -2.9, 1]]) {
      const stack = new THREE.Group();
      for (let i = 0; i < n; i++) {
        const c = G.crate(rng.range(0.44, 0.54), 0.3, rng.range(0.38, 0.46), M.crateWood(i % 3), M.darkWood(), 3);
        c.position.set(rng.range(-0.05, 0.05), 0.15 + i * 0.3, rng.range(-0.05, 0.05));
        c.rotation.y = rng.range(-0.35, 0.35);
        stack.add(c);
        if (i === n - 1) {
          const col = rng.pick([0xc23a2b, 0xd98a2b, 0x6f9b3a, 0xe0c25a]);
          for (let k = 0; k < 8; k++) {
            G.mesh(G.sphere(0.045, 10), M.food(col, { rough: 0.45, clearcoat: 0.25 }), {
              pos: [rng.range(-0.16, 0.16), 0.3 + i * 0.3 + 0.03, rng.range(-0.14, 0.14)], parent: stack,
            });
          }
        }
      }
      stack.position.set(x, 0, z);
      this.root.add(G.freeze(stack));
    }

    // Pigeons working the paving — small, but they set the scale of everything.
    const birdBody = M.cloth(0x6b6f78, 0.85);
    const birdHead = M.cloth(0x4a4f58, 0.8);
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Group();
      G.mesh(G.blob(0.075, 1, 0.85, 1.4, 10), birdBody, { pos: [0, 0.09, 0], parent: b });
      G.mesh(G.sphere(0.035, 8), birdHead, { pos: [0, 0.16, 0.07], parent: b });
      G.mesh(G.cone(0.012, 0.03, 6), M.food(0xc9a05c, { rough: 0.6 }), {
        pos: [0, 0.155, 0.105], rot: [1.5, 0, 0], parent: b, cast: false,
      });
      G.mesh(G.cone(0.05, 0.1, 4), birdBody, { pos: [0, 0.1, -0.1], rot: [-1.3, 0, 0], parent: b, cast: false });
      for (const sx of [-1, 1]) {
        G.mesh(G.cyl(0.006, 0.006, 0.05, 5), M.food(0xc2705c, { rough: 0.7 }), {
          pos: [sx * 0.025, 0.03, 0], parent: b, cast: false,
        });
      }
      b.position.set(rng.range(-5, 5), 0, rng.range(-3, -7.5));
      b.rotation.y = rng.range(0, 6.28);
      this.root.add(b);
      this.movers.push({ kind: 'bird', obj: b, phase: rng.range(0, 10), home: b.position.clone() });
    }

    // A hand cart parked to one side, wheels and all.
    const cart = new THREE.Group();
    const bed = G.mesh(G.box(1.5, 0.1, 0.85, 0.02), M.crateWood(0), { pos: [0, 0.62, 0], parent: cart });
    for (const sx of [-1, 1]) {
      G.mesh(G.box(1.5, 0.3, 0.05, 0.01), M.crateWood(1), { pos: [0, 0.78, sx * 0.42], parent: cart });
      const wheel = G.group({ pos: [sx * 0.45, 0.4, 0.5], rot: [0, 0, 0], parent: cart });
      G.mesh(G.torus(0.38, 0.05, 20, 6), M.crateWood(2), { parent: wheel });
      for (let s = 0; s < 8; s++) {
        G.mesh(G.box(0.04, 0.72, 0.04, 0.01), M.crateWood(2), { rot: [0, 0, (s / 8) * Math.PI], parent: wheel });
      }
      G.mesh(G.cyl(0.06, 0.06, 0.1, 10), M.iron(), { rot: [Math.PI / 2, 0, 0], parent: wheel });
    }
    G.mesh(G.cyl(0.035, 0.035, 1.1, 8), M.crateWood(1), { pos: [-0.7, 0.5, -0.3], rot: [0, 0, 1.1], parent: cart });
    for (let i = 0; i < 3; i++) {
      const c = G.crate(0.5, 0.32, 0.4, M.crateWood(0), M.darkWood(), 3);
      c.position.set(-0.45 + i * 0.45, 0.83, rng.range(-0.1, 0.1));
      c.rotation.y = rng.range(-0.3, 0.3);
      cart.add(c);
    }
    cart.position.set(-6.6, 0, -3.4);
    cart.rotation.y = 0.5;
    this.root.add(G.freeze(cart));
  }

  _neighbourStall(awn, rng) {
    const g = new THREE.Group();
    const post = M.darkWood();
    const w = rng.range(1.9, 2.5), d = 1.15, h = 2.15;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      G.mesh(G.box(0.062, h, 0.062, 0.006), post, { pos: [sx * w / 2, h / 2, sz * d / 2], parent: g });
    }
    G.mesh(G.box(w + 0.12, 0.055, d + 0.08, 0.008), M.crateWood(1), { pos: [0, 0.92, 0], parent: g });
    G.mesh(G.box(w, 0.62, 0.04, 0.006), M.crateWood(2), { pos: [0, 0.6, d / 2 - 0.02], parent: g });

    const awnMat = M.awning(awn.a, awn.b, rng.int(1, 40));
    for (const s of [-1, 1]) {
      const cloth = new THREE.Mesh(G.draped(w + 0.3, 0.95, 0.05, 0.02, 12), awnMat);
      cloth.position.set(0, h, s * 0.42);
      cloth.rotation.x = -Math.PI / 2 + s * 0.42;
      cloth.castShadow = true; cloth.receiveShadow = true;
      g.add(cloth);
    }
    G.mesh(G.box(w + 0.34, 0.05, 0.05, 0.008), post, { pos: [0, h + 0.2, 0], parent: g });

    const veg = [0xc23a2b, 0xd98a2b, 0x6f9b3a, 0xa8492f, 0xe0c25a];
    for (let i = 0; i < 3; i++) {
      const cw = rng.range(0.3, 0.42);
      const c = G.crate(cw, 0.16, 0.3, M.crateWood(0), M.darkWood(), 2);
      c.position.set(-w / 2 + 0.28 + i * (w - 0.5) / 2, 1.02, rng.range(-0.1, 0.1));
      c.rotation.y = rng.range(-0.2, 0.2);
      g.add(c);
      const col = rng.pick(veg);
      for (let k = 0; k < 7; k++) {
        G.mesh(G.sphere(0.035, 10), M.food(col, { rough: 0.42, clearcoat: 0.3 }), {
          pos: [c.position.x + rng.range(-cw / 2 + 0.05, cw / 2 - 0.05), 1.11, rng.range(-0.1, 0.1)],
          scale: rng.range(0.8, 1.15), parent: g,
        });
      }
    }
    return g;
  }

  _lampPost(dest, x, z) {
    const g = new THREE.Group();
    const iron = M.iron();
    G.mesh(G.cyl(0.09, 0.13, 0.22, 12), iron, { pos: [0, 0.11, 0], parent: g });
    G.mesh(G.cyl(0.045, 0.06, 3.3, 10), iron, { pos: [0, 1.75, 0], parent: g });
    G.mesh(G.torus(0.075, 0.016, 12, 6), iron, { pos: [0, 0.95, 0], rot: [Math.PI / 2, 0, 0], parent: g });
    G.mesh(G.cyl(0.11, 0.05, 0.14, 10), iron, { pos: [0, 3.45, 0], parent: g });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xfff0d0, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.28, side: THREE.DoubleSide,
    });
    G.mesh(G.box(0.24, 0.3, 0.24, 0.02), glassMat, { pos: [0, 3.68, 0], parent: g, cast: false });
    G.mesh(G.cone(0.2, 0.14, 4), iron, { pos: [0, 3.9, 0], rot: [0, Math.PI / 4, 0], parent: g });
    const bulb = G.mesh(G.sphere(0.055, 10), M.emissive(dest.lantern.color, 3.0), {
      pos: [0, 3.66, 0], cast: false, receive: false, parent: g,
    });
    // Scattered-light halo: the lamp's glow, minus a post-processing chain.
    const glow = new THREE.Sprite(M.halo(dest.lantern.color, 0.75 * dest.lantern.intensity));
    glow.position.set(0, 3.66, 0);
    glow.scale.setScalar(1.5);
    g.add(glow);

    // Candela with inverse-square falloff: bright at the post, gone by 10 m.
    const light = new THREE.PointLight(new THREE.Color(dest.lantern.color), dest.lantern.intensity * 6, 12, 2);
    light.position.set(0, 3.66, 0);
    g.add(light);
    this.lampLights.push(light);
    this.movers.push({ kind: 'lamp', obj: light, bulb, base: dest.lantern.intensity * 6, phase: x * 3 + z });

    g.position.set(x, 0, z);
    return g;
  }

  _barrel(rng) {
    const g = new THREE.Group();
    const staveMat = M.crateWood(rng.int(0, 2));
    G.mesh(G.lathe([[0.001, 0], [0.19, 0], [0.235, 0.16], [0.245, 0.32], [0.235, 0.48], [0.19, 0.64], [0.001, 0.64]], 18),
      staveMat, { parent: g });
    const band = M.steel(0.55);
    for (const y of [0.09, 0.32, 0.56]) {
      const r = y === 0.32 ? 0.248 : 0.215;
      G.mesh(G.torus(r, 0.012, 18, 6), band, { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0], parent: g });
    }
    return g;
  }

  _crowd(dest, rng) {
    // Passers-by on the terrace. They are simple, but they are correctly
    // 1.6–1.86 m tall, which is what makes everything else read at true size.
    for (let i = 0; i < 8; i++) {
      const p = buildPerson(rng, { height: rng.range(1.6, 1.86), detail: 'far' });
      const x = rng.range(-8, 8), z = rng.range(-3.4, -7.6);
      p.position.set(x, 0, z);
      p.rotation.y = rng.range(0, Math.PI * 2);
      this.root.add(p);
      this.movers.push({
        kind: 'walker', obj: p, phase: rng.range(0, 10),
        speed: rng.range(0.3, 0.6) * rng.sign(),
        axis: rng() < 0.7 ? 'x' : 'z', home: { x, z }, span: rng.range(1.5, 4),
      });
    }
  }

  // ----------------------------------------------------------- update ----
  update(dt, elapsed) {
    this.time += dt;
    if (this.skyUniforms) this.skyUniforms.uTime.value = this.time;
    if (this._dome) this._dome.position.copy(this.view.camera.position);

    for (const m of this.movers) {
      if (m.kind === 'walker') {
        const t = this.time * m.speed + m.phase;
        const off = Math.sin(t * 0.35) * m.span;
        if (m.axis === 'x') {
          m.obj.position.x = m.home.x + off;
          m.obj.rotation.y = Math.cos(t * 0.35) > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          m.obj.position.z = m.home.z + off;
          m.obj.rotation.y = Math.cos(t * 0.35) > 0 ? 0 : Math.PI;
        }
        const gait = Math.min(1, Math.abs(Math.cos(t * 0.35) * 2.6));
        m.obj.position.y = walkPose(m.obj, this.time * 4.2 * Math.abs(m.speed) * 2 + m.phase, gait);
      } else if (m.kind === 'lamp') {
        // Tiny, slow flicker — filament wobble, not a strobe.
        const f = 1 + Math.sin(this.time * 2.1 + m.phase) * 0.02 + Math.sin(this.time * 7.3 + m.phase) * 0.012;
        m.obj.intensity = m.base * f;
      } else if (m.kind === 'bulb') {
        const f = 1 + Math.sin(this.time * 1.6 + m.phase) * 0.06;
        m.obj.scale.setScalar(f);
        if (m.glow) m.glow.scale.setScalar(0.42 * f);
      } else if (m.kind === 'bird') {
        // Peck, step, peck: two beats of stillness for every one of movement.
        const t = this.time * 0.7 + m.phase;
        const cycle = (t % 6) / 6;
        m.obj.position.x = m.home.x + Math.sin(t * 0.5) * 0.35;
        m.obj.position.z = m.home.z + Math.cos(t * 0.37) * 0.28;
        m.obj.rotation.y = Math.atan2(Math.cos(t * 0.5) * 0.5, -Math.sin(t * 0.37) * 0.37);
        m.obj.children[1].position.y = 0.16 - (cycle > 0.7 ? Math.abs(Math.sin(cycle * 40)) * 0.05 : 0);
      } else if (m.kind === 'flag') {
        m.obj.rotation.z = Math.sin(this.time * 1.6 + m.phase) * 0.16;
        m.obj.rotation.y = Math.sin(this.time * 1.1 + m.phase * 1.7) * 0.3;
      }
    }
  }

  setLightBudget(quality) {
    // Low quality drops the point lights entirely; the scene still reads
    // because the key/fill/bounce rig carries it.
    const on = quality !== 'low';
    for (const l of this.lampLights) l.visible = on;
  }

  dispose() {
    for (const child of [...this.root.children]) {
      this.root.remove(child);
      child.traverse?.((o) => {
        if (o.isMesh && o.geometry && !o.geometry.userData.shared) o.geometry.dispose?.();
      });
    }
    this.movers.length = 0;
    this.lampLights.length = 0;
  }
}
