import * as THREE from 'three';
import { BASE_DEPTH, ROUTE_LENGTH, type RouteDef, type TerrainKind } from '../core/content';
import { clamp01, fbm, makeNoise2D, makeRng, smoothstep } from '../core/util';
import { textures } from '../core/textures';

/**
 * Seabed height field. Three distinct terrains, all authored so the cable
 * route itself stays walkable for the plough (no cliffs across the corridor).
 */
export class SeabedField {
  readonly kind: TerrainKind;
  private n: (x: number, y: number) => number;
  private n2: (x: number, y: number) => number;

  constructor(kind: TerrainKind, seed: number) {
    this.kind = kind;
    this.n = makeNoise2D(seed);
    this.n2 = makeNoise2D(seed + 991);
  }

  /** Returns world Y (negative) of the seabed at (x, z). */
  heightAt(x: number, z: number): number {
    const nx = x / 120;
    const nz = z / 120;
    let h = -BASE_DEPTH;
    switch (this.kind) {
      case 'sandflat': {
        h += fbm(this.n, nx * 1.6, nz * 1.6, 4) * 3.2;
        h += fbm(this.n2, nx * 6, nz * 6, 3) * 0.7;
        // long, low sand waves running across the route
        h += Math.sin(x / 26 + fbm(this.n, nx * 2, nz * 2, 2) * 2) * 0.55;
        h += 5 * smoothstep(0.15, 0.0, Math.abs(x - ROUTE_LENGTH * 0.5) / ROUTE_LENGTH); // gentle central rise
        break;
      }
      case 'ridge': {
        // a rocky ridge system running obliquely; the route crosses a saddle
        const ridge = Math.exp(-Math.pow((z - 40 + Math.sin(x / 90) * 30) / 46, 2)) * 17;
        const ridge2 = Math.exp(-Math.pow((z + 62 + Math.cos(x / 70) * 20) / 40, 2)) * 13;
        h += ridge + ridge2;
        h += fbm(this.n, nx * 3, nz * 3, 5) * 5.5;
        h += fbm(this.n2, nx * 10, nz * 10, 3) * 1.1;
        break;
      }
      case 'canyon': {
        // a broad canyon; route runs along its floor, walls rise either side
        const centre = Math.sin(x / 150) * 14;
        const d = Math.abs(z - centre);
        const wall = smoothstep(34, 105, d) * 34;
        h -= 16;
        h += wall;
        h += fbm(this.n, nx * 2.2, nz * 2.2, 5) * 4.2;
        h += fbm(this.n2, nx * 8, nz * 8, 3) * 0.9;
        break;
      }
    }
    return h;
  }

  /**
   * Lateral offset of (x, z) from the cable route, using a z-by-x table. The
   * route is always shallow-angled in x, so this is close enough to the true
   * perpendicular distance for carving purposes and costs nothing.
   */
  private routeZ: Float32Array | null = null;
  private routeX0 = 0;
  private routeX1 = 1;

  setRoute(curve: THREE.Curve<THREE.Vector3>) {
    const N = 256;
    const p = new THREE.Vector3();
    const xs: number[] = [];
    const zs: number[] = [];
    for (let i = 0; i < N; i++) {
      curve.getPointAt(i / (N - 1), p);
      xs.push(p.x);
      zs.push(p.z);
    }
    this.routeX0 = xs[0];
    this.routeX1 = xs[N - 1];
    const table = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = this.routeX0 + ((this.routeX1 - this.routeX0) * i) / (N - 1);
      // xs is monotonic for every authored route
      let k = 0;
      while (k < N - 2 && xs[k + 1] < x) k++;
      const span = xs[k + 1] - xs[k];
      const t = span > 1e-6 ? (x - xs[k]) / span : 0;
      table[i] = zs[k] + (zs[k + 1] - zs[k]) * t;
    }
    this.routeZ = table;
  }

  lateralOffset(x: number, z: number) {
    if (!this.routeZ) return 1e6;
    const N = this.routeZ.length;
    const t = clamp01((x - this.routeX0) / (this.routeX1 - this.routeX0 || 1));
    const f = t * (N - 1);
    const i = Math.min(N - 2, Math.floor(f));
    const u = f - i;
    const rz = this.routeZ[i] * (1 - u) + this.routeZ[i + 1] * u;
    const ends = smoothstep(0, 30, x - this.routeX0) * smoothstep(0, 30, this.routeX1 - x);
    return Math.abs(z - rz) / Math.max(0.15, ends);
  }

  /**
   * How far the ground mesh is dropped along the corridor. The trench ribbon
   * is drawn on top at virgin-seabed height and is wider than this gutter, so
   * the ribbon's groove has somewhere to go: without the carve the groove sinks
   * inside the solid ground mesh and the trench is simply invisible.
   */
  carveAt(x: number, z: number) {
    return -2.6 * smoothstep(4.4, 1.6, this.lateralOffset(x, z));
  }

  /** Flattened corridor height used by the plough and the trench ribbon. */
  corridorHeight(x: number, z: number) {
    // sample a little across-track and take the low value so the trench never
    // floats above a bump
    const a = this.heightAt(x, z);
    const b = this.heightAt(x, z + 3);
    const c = this.heightAt(x, z - 3);
    return Math.min(a, b, c);
  }
}

export interface SeabedBuild {
  group: THREE.Group;
  ground: THREE.Mesh;
  field: SeabedField;
}

const GROUND_X0 = -90;
const GROUND_X1 = ROUTE_LENGTH + 120;
const GROUND_Z0 = -170;
const GROUND_Z1 = 170;

export function buildSeabed(def: RouteDef, curve: THREE.Curve<THREE.Vector3>): SeabedBuild {
  const tex = textures();
  const field = new SeabedField(def.terrain, def.seed);
  field.setRoute(curve);
  const group = new THREE.Group();

  const segX = 150;
  const segZ = 76;
  const geo = new THREE.PlaneGeometry(GROUND_X1 - GROUND_X0, GROUND_Z1 - GROUND_Z0, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const cx = (GROUND_X0 + GROUND_X1) / 2;
  const cz = (GROUND_Z0 + GROUND_Z1) / 2;
  const rockCol = new THREE.Color(0x5d6168);
  const sandCol = new THREE.Color(0xbfae90);
  const deepCol = new THREE.Color(0x6f6a5c);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx;
    const z = pos.getZ(i) + cz;
    const y = field.heightAt(x, z) + field.carveAt(x, z);
    pos.setY(i, y);
    // steeper + higher => rock, low & flat => sand
    const h1 = field.heightAt(x + 2.5, z);
    const h2 = field.heightAt(x, z + 2.5);
    const slope = clamp01((Math.abs(h1 - y) + Math.abs(h2 - y)) / 2.2);
    tmp.copy(sandCol).lerp(deepCol, clamp01((-y - BASE_DEPTH) / 40 + 0.4));
    tmp.lerp(rockCol, slope * 0.85);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const sand = tex.sand.clone();
  sand.needsUpdate = true;
  sand.repeat.set(74, 43);
  const sandN = tex.sandNormal.clone();
  sandN.needsUpdate = true;
  sandN.wrapS = sandN.wrapT = THREE.RepeatWrapping;
  sandN.repeat.set(74, 43);

  const mat = new THREE.MeshStandardMaterial({
    map: sand,
    normalMap: sandN,
    normalScale: new THREE.Vector2(0.5, 0.5),
    vertexColors: true,
    roughness: 0.97,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(geo, mat);
  ground.position.set(cx, 0, cz);
  ground.receiveShadow = false;
  group.add(ground);

  // ---- boulders / outcrops -------------------------------------------------
  const rng = makeRng(def.seed * 7 + 3);
  const boulderCount = def.terrain === 'sandflat' ? 26 : def.terrain === 'ridge' ? 90 : 62;
  const bGeo = new THREE.IcosahedronGeometry(1, 1);
  {
    const bp = bGeo.attributes.position as THREE.BufferAttribute;
    const bn = makeNoise2D(5);
    for (let i = 0; i < bp.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(bp, i);
      const k = 1 + fbm(bn, v.x * 1.7, v.z * 1.7 + v.y, 3) * 0.42;
      v.multiplyScalar(k);
      v.y *= 0.72;
      bp.setXYZ(i, v.x, v.y, v.z);
    }
    bGeo.computeVertexNormals();
  }
  const bMat = new THREE.MeshStandardMaterial({ map: tex.rock, roughness: 0.94, metalness: 0.02, color: 0x9aa0a4 });
  const boulders = new THREE.InstancedMesh(bGeo, bMat, boulderCount);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const scl = new THREE.Vector3();
  const p3 = new THREE.Vector3();
  let placed = 0;
  for (let i = 0; i < boulderCount * 4 && placed < boulderCount; i++) {
    const x = GROUND_X0 + rng() * (GROUND_X1 - GROUND_X0);
    const z = GROUND_Z0 + rng() * (GROUND_Z1 - GROUND_Z0);
    // keep the cable corridor clear
    if (Math.abs(z - routeZAt(def, x)) < 9) continue;
    const s = 0.8 + Math.pow(rng(), 2.2) * 6.5;
    p3.set(x, field.heightAt(x, z) + s * 0.28, z);
    e.set(rng() * 0.5, rng() * 6.28, rng() * 0.5);
    q.setFromEuler(e);
    scl.set(s * (0.8 + rng() * 0.5), s * (0.6 + rng() * 0.4), s * (0.8 + rng() * 0.5));
    m4.compose(p3, q, scl);
    boulders.setMatrixAt(placed++, m4);
  }
  boulders.count = placed;
  boulders.instanceMatrix.needsUpdate = true;
  group.add(boulders);

  // ---- gentle sea pens / soft corals for scale -----------------------------
  const stalkGeo = new THREE.CylinderGeometry(0.045, 0.09, 1, 5, 1);
  stalkGeo.translate(0, 0.5, 0);
  const stalkMat = new THREE.MeshStandardMaterial({ color: 0xd7b08a, roughness: 0.85, emissive: 0x241a12 });
  const stalks = new THREE.InstancedMesh(stalkGeo, stalkMat, 120);
  let sp = 0;
  for (let i = 0; i < 400 && sp < 120; i++) {
    const x = GROUND_X0 + rng() * (GROUND_X1 - GROUND_X0);
    const z = GROUND_Z0 + rng() * (GROUND_Z1 - GROUND_Z0);
    if (Math.abs(z - routeZAt(def, x)) < 6) continue;
    const s = 0.7 + rng() * 1.9;
    p3.set(x, field.heightAt(x, z), z);
    e.set((rng() - 0.5) * 0.5, rng() * 6.28, (rng() - 0.5) * 0.5);
    q.setFromEuler(e);
    scl.set(1, s, 1);
    m4.compose(p3, q, scl);
    stalks.setMatrixAt(sp++, m4);
  }
  stalks.count = sp;
  stalks.instanceMatrix.needsUpdate = true;
  group.add(stalks);

  return { group, ground, field };
}

/** Cheap approximation of the route's z at a given x (used for clearing). */
function routeZAt(def: RouteDef, x: number) {
  const t = clamp01(x / ROUTE_LENGTH);
  const [w0, w1, w2] = def.wander;
  // matches buildRouteCurve closely enough for clearance tests
  const ks = [0, w0, w1, w2, 0];
  const f = t * 4;
  const i = Math.min(3, Math.floor(f));
  const u = f - i;
  return ks[i] * (1 - u) + ks[i + 1] * u;
}

// ---------------------------------------------------------------------------
// Trench ribbon: dig -> lay -> bury, all three visible at once behind the plough
// ---------------------------------------------------------------------------

export const TRENCH_HALF_WIDTH = 4.9;
const TRENCH_DEPTH = 1.7;
const BERM_HEIGHT = 0.78;

function grooveProfile(s: number) {
  const a = Math.abs(s);
  return smoothstep(2.1, 0.6, a);
}
function bermProfile(s: number) {
  const a = Math.abs(s);
  return Math.exp(-Math.pow((a - 3.0) / 0.9, 2));
}

export class TrenchRibbon {
  mesh: THREE.Mesh;
  private mat: THREE.MeshStandardMaterial;
  uniforms: {
    uDig: { value: number };
    uLay: { value: number };
    uBury: { value: number };
    uFresh: { value: THREE.Color };
  };

  constructor(curve: THREE.Curve<THREE.Vector3>, field: SeabedField, samples = 300, across = 25) {
    const tex = textures();
    const N = samples;
    const M = across;
    const verts = new Float32Array(N * M * 3);
    const uvs = new Float32Array(N * M * 2);
    const aU = new Float32Array(N * M);
    const aGroove = new Float32Array(N * M);
    const aGrooveD = new Float32Array(N * M);
    const aBerm = new Float32Array(N * M);
    const aBermD = new Float32Array(N * M);
    const aTan = new Float32Array(N * M * 3);
    const aAcr = new Float32Array(N * M * 3);

    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    const acr = new THREE.Vector3();

    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      curve.getPointAt(u, p);
      curve.getTangentAt(u, t).normalize();
      acr.copy(up).cross(t).normalize();
      for (let j = 0; j < M; j++) {
        const v = (j / (M - 1)) * 2 - 1;
        const s = v * TRENCH_HALF_WIDTH;
        const idx = i * M + j;
        const x = p.x + acr.x * s;
        const z = p.z + acr.z * s;
        const y = field.corridorHeight(p.x, p.z) + (field.heightAt(x, z) - field.corridorHeight(p.x, p.z)) * 0.25;
        verts[idx * 3] = x;
        verts[idx * 3 + 1] = y + 0.06;
        verts[idx * 3 + 2] = z;
        // roughly 3 m per texture tile in both directions, matching the ground
        uvs[idx * 2] = u * 126;
        uvs[idx * 2 + 1] = (v * 0.5 + 0.5) * 3.3;
        aU[idx] = u;
        const h = 0.02;
        aGroove[idx] = grooveProfile(s);
        aGrooveD[idx] = (grooveProfile(s + h) - grooveProfile(s - h)) / (2 * h);
        aBerm[idx] = bermProfile(s);
        aBermD[idx] = (bermProfile(s + h) - bermProfile(s - h)) / (2 * h);
        aTan[idx * 3] = t.x;
        aTan[idx * 3 + 1] = t.y;
        aTan[idx * 3 + 2] = t.z;
        aAcr[idx * 3] = acr.x;
        aAcr[idx * 3 + 1] = acr.y;
        aAcr[idx * 3 + 2] = acr.z;
      }
    }

    const indices: number[] = [];
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < M - 1; j++) {
        const a = i * M + j;
        const b = a + 1;
        const c = a + M;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
    geo.setAttribute('aGroove', new THREE.BufferAttribute(aGroove, 1));
    geo.setAttribute('aGrooveD', new THREE.BufferAttribute(aGrooveD, 1));
    geo.setAttribute('aBerm', new THREE.BufferAttribute(aBerm, 1));
    geo.setAttribute('aBermD', new THREE.BufferAttribute(aBermD, 1));
    geo.setAttribute('aTan', new THREE.BufferAttribute(aTan, 3));
    geo.setAttribute('aAcr', new THREE.BufferAttribute(aAcr, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N * M * 3), 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const sand = tex.sand.clone();
    sand.needsUpdate = true;
    sand.repeat.set(1, 1);
    const sandN = tex.sandNormal.clone();
    sandN.needsUpdate = true;
    sandN.wrapS = sandN.wrapT = THREE.RepeatWrapping;
    sandN.repeat.set(1, 1);

    this.uniforms = {
      uDig: { value: 0 },
      uLay: { value: 0 },
      uBury: { value: 0 },
      uFresh: { value: new THREE.Color(0x8a7c63) },
    };

    this.mat = new THREE.MeshStandardMaterial({
      map: sand,
      normalMap: sandN,
      // low normal detail on purpose: ripple noise competes with the shape of
      // the groove, and the shape is the thing the child has to read
      normalScale: new THREE.Vector2(0.3, 0.3),
      // matches the ground mesh's vertex tint at working depth, so the worked
      // corridor is a corridor and not a stripe of a different beach
      color: 0xa2977e,
      roughness: 0.98,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const U = this.uniforms;
    this.mat.onBeforeCompile = (shader) => {
      shader.uniforms.uDig = U.uDig;
      shader.uniforms.uLay = U.uLay;
      shader.uniforms.uBury = U.uBury;
      shader.uniforms.uFresh = U.uFresh;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           attribute float aU;
           attribute float aGroove;
           attribute float aGrooveD;
           attribute float aBerm;
           attribute float aBermD;
           attribute vec3 aTan;
           attribute vec3 aAcr;
           uniform float uDig;
           uniform float uLay;
           uniform float uBury;
           varying float vDig;
           varying float vBury;
           varying float vGroove;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float dig  = smoothstep(0.0, 0.030, uDig - aU);
           float bury = smoothstep(0.0, 0.040, uBury - aU);
           float open = dig * (1.0 - bury);
           float yOff = -aGroove * ${TRENCH_DEPTH.toFixed(3)} * open + aBerm * ${BERM_HEIGHT.toFixed(3)} * dig * (1.0 - bury * 0.94);
           float dOff = -aGrooveD * ${TRENCH_DEPTH.toFixed(3)} * open + aBermD * ${BERM_HEIGHT.toFixed(3)} * dig * (1.0 - bury * 0.94);
           // slight settle so buried ground reads a touch proud of virgin sand
           yOff += bury * dig * 0.10;
           transformed += vec3(0.0, yOff, 0.0);
           vDig = dig;
           vBury = bury;
           vGroove = aGroove;`,
        )
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
           {
             float dig2  = smoothstep(0.0, 0.030, uDig - aU);
             float bury2 = smoothstep(0.0, 0.040, uBury - aU);
             float open2 = dig2 * (1.0 - bury2);
             float dOff2 = -aGrooveD * ${TRENCH_DEPTH.toFixed(3)} * open2 + aBermD * ${BERM_HEIGHT.toFixed(3)} * dig2 * (1.0 - bury2 * 0.94);
             vec3 dAcross = normalize(aAcr + vec3(0.0, 1.0, 0.0) * dOff2);
             vec3 nn = normalize(cross(dAcross, aTan));
             if (nn.y < 0.0) nn = -nn;
             objectNormal = nn;
           }`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform vec3 uFresh;
           varying float vDig;
           varying float vBury;
           varying float vGroove;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           // Freshly turned spoil is darker and wetter than virgin sand; the
           // open groove is darker again because almost no light reaches the
           // bottom of it.
           float open = vDig * (1.0 - vBury);
           float disturbed = vDig * (1.0 - vBury * 0.4);
           // freshly cut sand is damp and slightly darker, but the cut faces
           // still catch the raking work light - keep them readable, not black
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uFresh * 2.3, disturbed * (0.3 + vGroove * 0.5));
           diffuseColor.rgb *= 1.0 - vGroove * open * 0.5;
           // and the closed-over strip is lighter, dried-out spoil
           diffuseColor.rgb *= 1.0 + vGroove * vBury * vDig * 0.22;`,
        );
    };

    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  set(dig: number, lay: number, bury: number) {
    this.uniforms.uDig.value = dig;
    this.uniforms.uLay.value = lay;
    this.uniforms.uBury.value = bury;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
