/**
 * The cranberries — the one thing the whole game is about.
 *
 * Every berry is a row in a few typed arrays and one instance in one of two
 * InstancedMeshes (a detailed one near the camera, a cheap one far away).
 * There is no rigid-body solver: buoyancy is a per-berry spring with a
 * staggered delay, crowd motion is a flow field plus a grid-based separation
 * pass, and containment is the signed distance to the boom. That is enough
 * for the causal chain to read, and it stays stable with a thousand berries
 * on a phone.
 *
 * Life of a berry:
 *   ON_VINE → (reel passes) DETACHED → RISING → FLOATING
 *           → (pump) INTAKE → IN_HOSE → DROPPING → IN_BED
 */

import * as THREE from 'three';
import { BERRY_R, bogInset, clampToBog, type FieldVariant } from './layout';
import type { Water } from './water';
import { clamp, damp, smoothstep } from '../core/math';

export const enum S {
  ON_VINE = 0,
  DETACHED = 1,
  RISING = 2,
  FLOATING = 3,
  INTAKE = 4,
  IN_HOSE = 5,
  DROPPING = 6,
  IN_BED = 7,
}

export interface BerryEvents {
  /** A berry broke the surface at this point. */
  onSurface(x: number, y: number, z: number, speed: number): void;
  /** A berry is rising and should trail bubbles. */
  onBubble(x: number, y: number, z: number): void;
  /** A berry landed in the truck bed. */
  onBedLand(x: number, y: number, z: number): void;
}

/**
 * Build a berry: a slightly oblate, faintly irregular sphere with a calyx
 * dimple at the top and a stem nub underneath. Smooth-shaded on purpose —
 * a faceted low-poly ball reads as a crystal, not as fruit.
 */
function berryGeometry(radius: number, rings: number, segs: number): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(radius, rings, segs);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    // gently oblate — a cranberry is a barrel, not a marble
    v.y *= 0.9;
    v.x *= 1.04;
    // calyx: a small pinched dimple at the top, and a nub at the bottom
    const up = clamp(n.y, 0, 1);
    const dimple = Math.pow(up, 6) * 0.34;
    v.multiplyScalar(1 - dimple);
    if (n.y < -0.86) v.y -= radius * 0.05;
    // faint irregularity so a hundred berries are not a hundred clones
    const wob = Math.sin(n.x * 7.3) * Math.cos(n.z * 6.1) * 0.018;
    v.multiplyScalar(1 + wob);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

const FAR_DIST_SQ = 13 * 13;
/** Fruit in the truck bed is drawn at this fraction of its size. */
const BED_SCALE = 0.45;

export class BerryField {
  readonly group = new THREE.Group();
  private readonly near: THREE.InstancedMesh;
  private readonly far: THREE.InstancedMesh;
  private readonly geoNear: THREE.BufferGeometry;
  private readonly geoFar: THREE.BufferGeometry;
  private readonly matNear: THREE.MeshPhysicalMaterial;
  private readonly matFar: THREE.MeshStandardMaterial;

  readonly n: number;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly pz: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly vz: Float32Array;
  private readonly state: Uint8Array;
  private readonly delay: Float32Array;
  private readonly scale: Float32Array;
  private readonly spin: Float32Array; // 3 per berry
  private readonly spinRate: Float32Array; // 3 per berry
  private readonly hoseT: Float32Array;
  private readonly hoseOff: Float32Array; // 2 per berry
  private readonly bedSlot: Int32Array;
  private readonly baseCol: Float32Array; // 3 per berry
  private readonly wobble: Float32Array;
  /** Where this berry grew — used by the sandbox to put fruit back. */
  private readonly homeX: Float32Array;
  private readonly homeY: Float32Array;
  private readonly homeZ: Float32Array;
  /** Berries that slipped under the boom: never picked up, left on the water. */
  private readonly stray: Uint8Array;
  /** Sandbox: fruit that reaches the end of the hose grows back. */
  recycleToVine = false;
  /**
   * How tightly the raft is allowed to pack, 1 = one layer, 0.55 = heaped.
   * The boom drives this down as the ring shrinks, which is what turns
   * "a lot of berries" into "one solid red mass" instead of a fixed grid.
   */
  packFactor = 1;
  /** Local crowding per berry, 0..1 — lifts fruit into a visible heap. */
  private readonly crowd: Float32Array;
  private readonly dropScale: Float32Array;

  /** Packed bed positions, filled bottom-up as fruit arrives. */
  private bedSlots: THREE.Vector3[] = [];
  private bedUsed = 0;
  private bedOrigin = new THREE.Vector3();

  /**
   * Fruit size. A smaller crop gets slightly larger berries so that the
   * flooded surface still turns red on a low-end phone — the signature
   * moment must survive every quality tier.
   */
  readonly radius: number;

  /**
   * Uniform grid for the separation pass, as a counting sort over flat typed
   * arrays: `cellStart` holds the prefix sum and `cellItems` the berry
   * indices bucketed by cell. A Map of per-cell arrays would allocate every
   * frame and dominate the whole simulation.
   *
   * The cell is sized to the *largest* separation distance, so a 3x3
   * neighbourhood is exactly enough. Coarser is not free: every factor of
   * cell size squares the candidate pairs each berry has to test.
   */
  private readonly cell: number;
  private readonly gw: number;
  private readonly gh: number;
  private readonly gx0: number;
  private readonly gz0: number;
  private readonly cellCount: Int32Array;
  private readonly cellStart: Int32Array;
  private readonly cellItems: Int32Array;

  private readonly tmpM = new THREE.Matrix4();
  private readonly tmpQ = new THREE.Quaternion();
  private readonly tmpE = new THREE.Euler();
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpS = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector2();
  private readonly col = new THREE.Color();

  /**
   * Coarse map of how much fruit is floating where, handed to the water
   * shader. A raft of cranberries is a solid red mass at any distance — you
   * only resolve individual fruit within a couple of metres. Painting the
   * mass into the surface is what lets the *instances* be a believable size
   * instead of beach balls: the density carries the colour, the instances
   * carry the detail.
   */
  readonly densityTex: THREE.DataTexture;
  private readonly densityData: Uint8Array<ArrayBuffer>;
  private readonly densityRaw: Float32Array;
  private readonly dw: number;
  private readonly dh: number;
  private densityClock = 0;

  private time = 0;
  floatingCount = 0;
  onVineCount = 0;
  bedCount = 0;
  inHoseCount = 0;
  /** Berries that have surfaced at least once — drives the reveal trigger. */
  surfacedCount = 0;

  constructor(
    private readonly v: FieldVariant,
    private readonly water: Water,
    anchors: THREE.Vector3[],
    count: number,
    private readonly events: BerryEvents,
    lowDetail: boolean,
  ) {
    this.n = Math.min(count, anchors.length * 3);
    this.radius = BERRY_R * clamp(Math.sqrt(1700 / Math.max(1, this.n)), 1, 1.2);
    this.cell = this.radius * 1.95;
    // one margin of bog around the playfield, so nothing can fall out of grid
    this.gx0 = -(v.halfX + 3);
    this.gz0 = -(v.halfZ + 3);
    this.gw = Math.ceil(((v.halfX + 3) * 2) / this.cell) + 1;
    this.gh = Math.ceil(((v.halfZ + 3) * 2) / this.cell) + 1;
    this.cellCount = new Int32Array(this.gw * this.gh + 1);
    this.cellStart = new Int32Array(this.gw * this.gh + 1);
    const n = this.n;
    this.cellItems = new Int32Array(n);
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.vz = new Float32Array(n);
    this.state = new Uint8Array(n);
    this.delay = new Float32Array(n);
    this.scale = new Float32Array(n);
    this.spin = new Float32Array(n * 3);
    this.spinRate = new Float32Array(n * 3);
    this.hoseT = new Float32Array(n);
    this.hoseOff = new Float32Array(n * 2);
    this.bedSlot = new Int32Array(n).fill(-1);
    this.baseCol = new Float32Array(n * 3);
    this.wobble = new Float32Array(n);
    this.homeX = new Float32Array(n);
    this.homeY = new Float32Array(n);
    this.homeZ = new Float32Array(n);
    this.stray = new Uint8Array(n);
    this.crowd = new Float32Array(n);
    this.dropScale = new Float32Array(n).fill(1);

    // density map: about one texel per half metre of bog
    this.dw = Math.max(8, Math.round((v.halfX + 2) * 2 / 0.55));
    this.dh = Math.max(8, Math.round((v.halfZ + 2) * 2 / 0.55));
    this.densityRaw = new Float32Array(this.dw * this.dh);
    this.densityData = new Uint8Array(new ArrayBuffer(this.dw * this.dh));
    this.densityTex = new THREE.DataTexture(
      this.densityData,
      this.dw,
      this.dh,
      THREE.RedFormat,
      THREE.UnsignedByteType,
    );
    this.densityTex.minFilter = THREE.LinearFilter;
    this.densityTex.magFilter = THREE.LinearFilter;
    this.densityTex.wrapS = THREE.ClampToEdgeWrapping;
    this.densityTex.wrapT = THREE.ClampToEdgeWrapping;
    this.densityTex.needsUpdate = true;

    const r = v.rng;
    for (let i = 0; i < n; i++) {
      const a = anchors[i % anchors.length];
      this.px[i] = a.x + r.range(-0.5, 0.5);
      this.pz[i] = a.z + r.range(-0.5, 0.5);
      this.py[i] = a.y + r.range(-0.02, 0.2);
      this.homeX[i] = this.px[i];
      this.homeY[i] = this.py[i];
      this.homeZ[i] = this.pz[i];
      this.state[i] = S.ON_VINE;
      this.scale[i] = r.range(0.82, 1.22);
      this.wobble[i] = r.range(0, Math.PI * 2);
      for (let k = 0; k < 3; k++) {
        this.spin[i * 3 + k] = r.range(0, Math.PI * 2);
        this.spinRate[i * 3 + k] = r.range(-1.4, 1.4);
      }
      this.hoseOff[i * 2] = r.range(-1, 1);
      this.hoseOff[i * 2 + 1] = r.range(-1, 1);

      // colour mix: mostly deep cranberry, some bright, a few pale
      const roll = r();
      if (roll < v.paleRatio) {
        this.col.setHSL(r.range(0.03, 0.07), r.range(0.3, 0.5), r.range(0.62, 0.76));
      } else if (roll < 0.3) {
        this.col.setHSL(r.range(0.965, 0.995), r.range(0.62, 0.78), r.range(0.31, 0.4));
      } else if (roll < 0.78) {
        this.col.setHSL(r.range(0.975, 1.005), r.range(0.7, 0.86), r.range(0.24, 0.32));
      } else {
        this.col.setHSL(r.range(0.955, 0.985), r.range(0.55, 0.72), r.range(0.16, 0.23));
      }
      this.baseCol[i * 3] = this.col.r;
      this.baseCol[i * 3 + 1] = this.col.g;
      this.baseCol[i * 3 + 2] = this.col.b;
    }
    this.onVineCount = n;

    this.geoNear = lowDetail
      ? berryGeometry(this.radius, 9, 7)
      : berryGeometry(this.radius, 14, 10);
    this.geoFar = berryGeometry(this.radius, 7, 5);
    this.matNear = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.34,
      metalness: 0,
      clearcoat: lowDetail ? 0 : 0.75,
      clearcoatRoughness: 0.14,
      sheen: 0,
    });
    this.matFar = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0 });

    this.near = new THREE.InstancedMesh(this.geoNear, this.matNear, n);
    this.far = new THREE.InstancedMesh(this.geoFar, this.matFar, n);
    for (const m of [this.near, this.far]) {
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      m.frustumCulled = false;
      m.count = 0;
      m.castShadow = false;
      m.receiveShadow = true;
    }
    this.near.name = 'berries-near';
    this.far.name = 'berries-far';
    this.group.add(this.near, this.far);
    this.group.name = 'berries';
  }

  /** Turn self-shadowing on for the near fruit only — the far mesh is a wash. */
  set castShadow(on: boolean) {
    this.near.castShadow = on;
  }

  /* ---------------- queries used by the game loop ---------------- */

  /** Fraction of berries already knocked off the vines, 0..1. */
  get harvested(): number {
    return 1 - this.onVineCount / this.n;
  }

  /** Fraction of the crop already in the truck. */
  get collected(): number {
    return this.bedCount / this.n;
  }

  /** Berries still on the water (floating or being pulled in). */
  get onWater(): number {
    return this.floatingCount;
  }

  /* ---------------- the reel knocks fruit loose ---------------- */

  /**
   * Called while the reel is churning. Berries inside the swept disc come
   * off the vine with a small random delay so the surfacing reads as a
   * shimmer of individual pops, never a single flat wave.
   */
  harvestAt(x: number, z: number, radius: number, strength: number): number {
    let freed = 0;
    const r2 = radius * radius;
    for (let i = 0; i < this.n; i++) {
      if (this.state[i] !== S.ON_VINE) continue;
      const dx = this.px[i] - x;
      const dz = this.pz[i] - z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      if (Math.random() > strength) continue;
      const d = Math.sqrt(d2) || 0.001;
      this.state[i] = S.DETACHED;
      // knocked sideways and slightly *down* first — then buoyancy wins
      this.vx[i] = (dx / d) * (0.5 + Math.random() * 1.5);
      this.vz[i] = (dz / d) * (0.5 + Math.random() * 1.5);
      this.vy[i] = -0.35 - Math.random() * 0.5;
      this.delay[i] = Math.random() * 0.55;
      this.onVineCount--;
      freed++;
    }
    return freed;
  }

  /** Free every remaining berry (used if the child never sweeps a corner). */
  harvestAll(): void {
    for (let i = 0; i < this.n; i++) {
      if (this.state[i] !== S.ON_VINE) continue;
      this.state[i] = S.DETACHED;
      this.vy[i] = -0.2;
      this.delay[i] = Math.random() * 1.4;
      this.onVineCount--;
    }
  }

  /* ---------------- the pump takes fruit away ---------------- */

  private intakePoint = new THREE.Vector3();
  private intakeActive = false;
  private intakeRadius = 3.2;
  /** Berries per second the pump can take. A token bucket, so the flow in
   *  the transparent window is a steady stream instead of one huge gulp. */
  intakeRate = 18;
  private intakeTokens = 0;

  setIntake(active: boolean, p?: THREE.Vector3, radius = 3.2): void {
    this.intakeActive = active;
    this.intakeRadius = radius;
    if (p) this.intakePoint.copy(p);
    if (!active) this.intakeTokens = Math.min(this.intakeTokens, 1);
  }

  /**
   * Bed geometry is handed over by the truck once it is placed. We keep the
   * origin *by reference* so the load travels with the truck at the end.
   */
  setBed(origin: THREE.Vector3, slots: THREE.Vector3[]): void {
    this.bedOrigin = origin;
    this.bedSlots = slots;
    this.bedUsed = 0;
  }

  /* ---------------- external forces ---------------- */

  /** Finger stirring the floating fruit. */
  private stirAt: THREE.Vector2 | null = null;
  private stirStrength = 0;

  setStir(p: THREE.Vector2 | null, strength = 1): void {
    this.stirAt = p;
    this.stirStrength = strength;
  }

  /** The boom returns how far outside its ring a point sits (<=0 inside). */
  private containFn: ((x: number, z: number, out: THREE.Vector3) => number) | null = null;

  setContainment(fn: ((x: number, z: number, out: THREE.Vector3) => number) | null): void {
    this.containFn = fn;
  }

  /** The hose curve the sucked berries ride along. */
  private hoseCurve: THREE.Curve<THREE.Vector3> | null = null;
  private hoseSpeed = 0;

  setHose(curve: THREE.Curve<THREE.Vector3> | null, speed: number): void {
    this.hoseCurve = curve;
    this.hoseSpeed = speed;
  }

  /* ---------------- simulation ---------------- */

  /** Grid column/row for a world position, clamped into the fixed grid. */
  private gcol(x: number): number {
    const i = Math.floor((x - this.gx0) / this.cell);
    return i < 0 ? 0 : i >= this.gw ? this.gw - 1 : i;
  }

  private grow(z: number): number {
    const j = Math.floor((z - this.gz0) / this.cell);
    return j < 0 ? 0 : j >= this.gh ? this.gh - 1 : j;
  }

  update(dt: number, camera: THREE.Camera): void {
    this.time += dt;
    if (this.intakeActive) {
      this.intakeTokens = Math.min(this.intakeTokens + this.intakeRate * dt, this.intakeRate * 0.5);
    }
    const water = this.water;
    const surf = this.radius * 0.15; // how deep a floating berry sits

    let floating = 0;
    let bed = 0;
    let inHose = 0;

    /* --- rebuild the neighbour grid for floating fruit (counting sort) --- */
    const cells = this.gw * this.gh;
    this.cellCount.fill(0, 0, cells + 1);
    for (let i = 0; i < this.n; i++) {
      const s = this.state[i];
      if (s !== S.FLOATING && s !== S.INTAKE) continue;
      this.cellCount[this.grow(this.pz[i]) * this.gw + this.gcol(this.px[i])]++;
    }
    let running = 0;
    for (let c = 0; c < cells; c++) {
      this.cellStart[c] = running;
      running += this.cellCount[c];
      this.cellCount[c] = this.cellStart[c];
    }
    this.cellStart[cells] = running;
    for (let i = 0; i < this.n; i++) {
      const s = this.state[i];
      if (s !== S.FLOATING && s !== S.INTAKE) continue;
      const c = this.grow(this.pz[i]) * this.gw + this.gcol(this.px[i]);
      this.cellItems[this.cellCount[c]++] = i;
    }

    for (let i = 0; i < this.n; i++) {
      const s = this.state[i];

      switch (s) {
        case S.ON_VINE: {
          // sway with the vines once they are underwater
          const w = this.wobble[i];
          const amt = water.flood * 0.05;
          this.px[i] += Math.sin(this.time * 1.3 + w) * amt * dt;
          this.pz[i] += Math.cos(this.time * 1.1 + w) * amt * dt;
          break;
        }

        case S.DETACHED: {
          this.delay[i] -= dt;
          this.px[i] += this.vx[i] * dt;
          this.pz[i] += this.vz[i] * dt;
          this.py[i] += this.vy[i] * dt;
          this.vx[i] = damp(this.vx[i], 0, 3.4, dt);
          this.vz[i] = damp(this.vz[i], 0, 3.4, dt);
          this.vy[i] = damp(this.vy[i], 0, 2.6, dt);
          if (this.delay[i] <= 0) {
            this.state[i] = S.RISING;
            this.vy[i] = 0.25;
          }
          break;
        }

        case S.RISING: {
          const target = water.heightAt(this.px[i], this.pz[i]) - surf;
          // buoyancy: accelerate up, then the surface catches it
          this.vy[i] += (1.9 + this.scale[i] * 0.5) * dt;
          this.vy[i] = Math.min(this.vy[i], 2.4);
          this.py[i] += this.vy[i] * dt;
          // spiral drift while rising — reads as water, not as a lift shaft
          const w = this.wobble[i];
          this.px[i] += Math.sin(this.time * 2.6 + w) * 0.24 * dt;
          this.pz[i] += Math.cos(this.time * 2.2 + w * 1.7) * 0.24 * dt;
          if (Math.random() < dt * 5) {
            this.events.onBubble(this.px[i], this.py[i], this.pz[i]);
          }
          if (this.py[i] >= target) {
            this.py[i] = target;
            this.events.onSurface(this.px[i], this.py[i], this.pz[i], this.vy[i]);
            this.vy[i] *= -0.28; // small rebound, then it settles
            this.state[i] = S.FLOATING;
            this.surfacedCount++;
          }
          break;
        }

        case S.FLOATING:
        case S.INTAKE: {
          floating++;
          let ax = 0;
          let az = 0;

          // slow bog circulation so the raft is never dead still
          const t = this.time * 0.22;
          ax += Math.sin(this.pz[i] * 0.16 + t) * 0.16;
          az += Math.cos(this.px[i] * 0.14 - t * 1.1) * 0.16;

          // finger stir
          if (this.stirAt) {
            const dx = this.px[i] - this.stirAt.x;
            const dz = this.pz[i] - this.stirAt.y;
            const d2 = dx * dx + dz * dz;
            if (d2 < 3.6) {
              const d = Math.sqrt(d2) || 0.001;
              const f = (1 - d / 1.9) * 7 * this.stirStrength;
              ax += (dx / d) * f;
              az += (dz / d) * f;
            }
          }

          // boom containment — a soft wall, fruit never tunnels through
          if (this.containFn && !this.stray[i]) {
            const out = this.containFn(this.px[i], this.pz[i], this.tmpV);
            if (out > 0) {
              const f = Math.min(out, 1.2) * 16;
              ax += this.tmpV.x * f;
              az += this.tmpV.z * f;
            }
          }

          // separation from neighbours: this is what makes "ぎゅっ" feel packed
          const gi = this.gcol(this.px[i]);
          const gj = this.grow(this.pz[i]);
          const minD = this.radius * 1.92 * this.packFactor;
          let near = 0;
          const oi0 = gi > 0 ? -1 : 0;
          const oi1 = gi < this.gw - 1 ? 1 : 0;
          const oj0 = gj > 0 ? -1 : 0;
          const oj1 = gj < this.gh - 1 ? 1 : 0;
          for (let oi = oi0; oi <= oi1; oi++) {
            for (let oj = oj0; oj <= oj1; oj++) {
              const c = (gj + oj) * this.gw + (gi + oi);
              const end = this.cellCount[c]; // scatter left this at the cell end
              for (let k = this.cellStart[c]; k < end; k++) {
                const j = this.cellItems[k];
                if (j === i) continue;
                const dx = this.px[i] - this.px[j];
                const dz = this.pz[i] - this.pz[j];
                const d2 = dx * dx + dz * dz;
                if (d2 > minD * minD || d2 < 1e-6) continue;
                const d = Math.sqrt(d2);
                const push = (minD - d) / minD;
                ax += (dx / d) * push * 9;
                az += (dz / d) * push * 9;
                near++;
              }
            }
          }

          if (s === S.INTAKE) {
            const dx = this.intakePoint.x - this.px[i];
            const dz = this.intakePoint.z - this.pz[i];
            const d = Math.hypot(dx, dz) || 0.001;
            const pull = 26 / Math.max(d, 0.6);
            ax += (dx / d) * pull;
            az += (dz / d) * pull;
            if (d < 0.62) {
              this.state[i] = S.IN_HOSE;
              this.hoseT[i] = 0;
              this.spinRate[i * 3] = (Math.random() - 0.5) * 9;
              this.spinRate[i * 3 + 1] = (Math.random() - 0.5) * 9;
              this.spinRate[i * 3 + 2] = (Math.random() - 0.5) * 9;
              floating--;
              break;
            }
          } else if (this.intakeActive && !this.stray[i] && this.intakeTokens >= 1) {
            const dx = this.intakePoint.x - this.px[i];
            const dz = this.intakePoint.z - this.pz[i];
            const d2 = dx * dx + dz * dz;
            if (d2 < this.intakeRadius * this.intakeRadius) {
              // the closest fruit goes first, so the raft drains from the hose out
              if (Math.random() < dt * (7 - Math.sqrt(d2) * 1.2)) {
                this.state[i] = S.INTAKE;
                this.intakeTokens -= 1;
              }
            }
          }

          this.vx[i] = damp(this.vx[i] + ax * dt, 0, 3.2, dt);
          this.vz[i] = damp(this.vz[i] + az * dt, 0, 3.2, dt);
          const sp = Math.hypot(this.vx[i], this.vz[i]);
          const maxSp = s === S.INTAKE ? 9 : 3.4;
          if (sp > maxSp) {
            this.vx[i] *= maxSp / sp;
            this.vz[i] *= maxSp / sp;
          }
          this.px[i] += this.vx[i] * dt;
          this.pz[i] += this.vz[i] * dt;

          // stay in the bog
          const inset = bogInset(this.v, this.px[i], this.pz[i]);
          if (inset < 0.45) {
            const p2 = this.tmp2.set(this.px[i], this.pz[i]);
            clampToBog(this.v, p2, 0.45);
            this.px[i] = p2.x;
            this.pz[i] = p2.y;
            this.vx[i] *= 0.4;
            this.vz[i] *= 0.4;
          }

          // crowded fruit rides higher: a corralled raft heaps up, it does
          // not stay one berry thick
          this.crowd[i] = damp(this.crowd[i], clamp(near / 6, 0, 1), 4, dt);

          // ride the surface
          const h =
            water.heightAt(this.px[i], this.pz[i]) - surf + this.crowd[i] * this.radius * 1.5;
          this.py[i] = damp(this.py[i], h, 12, dt);
          // roll slowly with the swell
          this.spin[i * 3] += (this.vz[i] * 0.9 + Math.sin(this.time + this.wobble[i]) * 0.2) * dt;
          this.spin[i * 3 + 2] -= (this.vx[i] * 0.9) * dt;
          break;
        }

        case S.IN_HOSE: {
          inHose++;
          if (!this.hoseCurve) break;
          this.hoseT[i] += this.hoseSpeed * dt * (0.85 + this.scale[i] * 0.2);
          if (this.hoseT[i] >= 1) {
            if (this.recycleToVine) {
              // free-play mode: the crop never runs out
              this.px[i] = this.homeX[i];
              this.py[i] = this.homeY[i];
              this.pz[i] = this.homeZ[i];
              this.vx[i] = this.vy[i] = this.vz[i] = 0;
              this.state[i] = S.ON_VINE;
              this.onVineCount++;
              break;
            }
            this.state[i] = S.DROPPING;
            this.dropScale[i] = 1;
            const end = this.hoseCurve.getPointAt(1, this.tmpV);
            this.px[i] = end.x;
            this.py[i] = end.y;
            this.pz[i] = end.z;
            this.vx[i] = (Math.random() - 0.5) * 0.8;
            this.vz[i] = (Math.random() - 0.5) * 0.8;
            this.vy[i] = -0.4;
            this.bedSlot[i] = this.bedUsed < this.bedSlots.length ? this.bedUsed++ : -1;
            break;
          }
          const p = this.hoseCurve.getPointAt(clamp(this.hoseT[i], 0, 1), this.tmpV);
          // spread across the bore so the flow is fruit, not a red rope
          const tan = this.hoseCurve.getTangentAt(clamp(this.hoseT[i], 0, 1), this.tmpS);
          const nx = -tan.z;
          const nz = tan.x;
          const len = Math.hypot(nx, nz) || 1;
          const o1 = this.hoseOff[i * 2] * 0.075;
          const o2 = this.hoseOff[i * 2 + 1] * 0.075;
          const wig = Math.sin(this.time * 6 + this.wobble[i]) * 0.04;
          this.px[i] = p.x + (nx / len) * (o1 + wig);
          this.pz[i] = p.z + (nz / len) * (o1 + wig);
          this.py[i] = p.y + o2;
          for (let k = 0; k < 3; k++) this.spin[i * 3 + k] += this.spinRate[i * 3 + k] * dt;
          break;
        }

        case S.DROPPING: {
          this.dropScale[i] = damp(this.dropScale[i], BED_SCALE, 7, dt);
          this.vy[i] -= 9.2 * dt;
          this.px[i] += this.vx[i] * dt;
          this.py[i] += this.vy[i] * dt;
          this.pz[i] += this.vz[i] * dt;
          for (let k = 0; k < 3; k++) this.spin[i * 3 + k] += this.spinRate[i * 3 + k] * dt;
          const slot = this.bedSlot[i];
          const target = slot >= 0 ? this.bedSlots[slot] : null;
          if (target) {
            const ty = this.bedOrigin.y + target.y;
            if (this.py[i] <= ty) {
              this.px[i] = this.bedOrigin.x + target.x;
              this.py[i] = ty;
              this.pz[i] = this.bedOrigin.z + target.z;
              this.state[i] = S.IN_BED;
              this.events.onBedLand(this.px[i], this.py[i], this.pz[i]);
            } else {
              // steer toward its slot as it falls
              this.px[i] = damp(this.px[i], this.bedOrigin.x + target.x, 4, dt);
              this.pz[i] = damp(this.pz[i], this.bedOrigin.z + target.z, 4, dt);
            }
          } else if (this.py[i] < this.bedOrigin.y) {
            this.state[i] = S.IN_BED;
          }
          break;
        }

        case S.IN_BED: {
          bed++;
          // the load rides with the truck when it pulls away
          const slot = this.bedSlot[i];
          if (slot >= 0) {
            const t = this.bedSlots[slot];
            this.px[i] = this.bedOrigin.x + t.x;
            this.py[i] = this.bedOrigin.y + t.y;
            this.pz[i] = this.bedOrigin.z + t.z;
          }
          break;
        }
      }
    }

    this.floatingCount = floating;
    this.bedCount = bed;
    this.inHoseCount = inHose;

    // The density map only feeds a soft colour wash, so a third of the frame
    // rate is plenty and the interpolation hides the staleness.
    this.densityClock -= dt;
    if (this.densityClock <= 0) {
      this.densityClock = 0.1;
      this.updateDensity();
    }

    this.writeInstances(camera);
  }

  /**
   * Splat every floating berry into the coarse map, blur it once, and push
   * it to the GPU. One berry covers roughly one texel, so the raw counts are
   * already close to a coverage fraction.
   */
  private updateDensity(): void {
    const raw = this.densityRaw;
    raw.fill(0);
    const sx = this.dw / ((this.v.halfX + 2) * 2);
    const sz = this.dh / ((this.v.halfZ + 2) * 2);
    const perBerry = (this.radius * this.radius * Math.PI) / (0.55 * 0.55);
    for (let i = 0; i < this.n; i++) {
      const st = this.state[i];
      if (st !== S.FLOATING && st !== S.INTAKE) continue;
      const u = Math.floor((this.px[i] + this.v.halfX + 2) * sx);
      const vv = Math.floor((this.pz[i] + this.v.halfZ + 2) * sz);
      if (u < 0 || vv < 0 || u >= this.dw || vv >= this.dh) continue;
      raw[vv * this.dw + u] += perBerry;
    }
    // separable 1-2-1 blur, in place along each axis
    const w = this.dw;
    const h = this.dh;
    for (let y = 0; y < h; y++) {
      let prev = raw[y * w];
      for (let x = 0; x < w; x++) {
        const cur = raw[y * w + x];
        const next = x + 1 < w ? raw[y * w + x + 1] : cur;
        raw[y * w + x] = (prev + cur * 2 + next) * 0.25;
        prev = cur;
      }
    }
    for (let x = 0; x < w; x++) {
      let prev = raw[x];
      for (let y = 0; y < h; y++) {
        const cur = raw[y * w + x];
        const next = y + 1 < h ? raw[(y + 1) * w + x] : cur;
        raw[y * w + x] = (prev + cur * 2 + next) * 0.25;
        prev = cur;
      }
    }
    for (let k = 0; k < raw.length; k++) {
      this.densityData[k] = Math.min(255, Math.round(raw[k] * 255 * 1.25));
    }
    this.densityTex.needsUpdate = true;
  }

  /** Push the simulation state into the two instanced meshes. */
  private writeInstances(camera: THREE.Camera): void {
    const cam = camera.position;
    let nNear = 0;
    let nFar = 0;
    const nearCol = this.near.instanceColor!.array as Float32Array;
    const farCol = this.far.instanceColor!.array as Float32Array;
    const waterLevel = this.water.level;

    for (let i = 0; i < this.n; i++) {
      const x = this.px[i];
      const y = this.py[i];
      const z = this.pz[i];
      const dx = x - cam.x;
      const dy = y - cam.y;
      const dz = z - cam.z;
      const dist2 = dx * dx + dy * dy + dz * dz;

      // fruit settles into the load: the heap in the bed is drawn smaller so
      // a whole crop actually fits in a truck-sized bed
      const st0 = this.state[i];
      const sc =
        this.scale[i] *
        (st0 === S.IN_BED ? BED_SCALE : st0 === S.DROPPING ? this.dropScale[i] : 1);
      this.tmpE.set(this.spin[i * 3], this.spin[i * 3 + 1], this.spin[i * 3 + 2]);
      this.tmpQ.setFromEuler(this.tmpE);
      this.tmpV.set(x, y, z);
      this.tmpS.set(sc, sc * 0.98, sc);
      this.tmpM.compose(this.tmpV, this.tmpQ, this.tmpS);

      // submerged fruit is read through the water: desaturate toward the tint
      let r = this.baseCol[i * 3];
      let g = this.baseCol[i * 3 + 1];
      let b = this.baseCol[i * 3 + 2];
      const st = this.state[i];
      if (st === S.ON_VINE || st === S.DETACHED || st === S.RISING) {
        // Water absorbs red before anything else, so fruit under the surface
        // goes dark and loses its warmth. Tinting it *toward* the water made
        // it pale, which read as grey pebbles on the bottom.
        const under = clamp((waterLevel - y) / 0.8, 0, 1) * smoothstep(this.water.flood * 2);
        const k = under * 0.68;
        const tint = this.v.waterTint;
        const dim = 1 - under * 0.38;
        r = (r * (1 - k * 0.92) + tint.r * k * 0.45) * dim;
        g = (g * (1 - k * 0.6) + tint.g * k * 0.6) * dim;
        b = (b * (1 - k * 0.5) + tint.b * k * 0.7) * dim;
      }

      if (dist2 < FAR_DIST_SQ) {
        this.near.setMatrixAt(nNear, this.tmpM);
        nearCol[nNear * 3] = r;
        nearCol[nNear * 3 + 1] = g;
        nearCol[nNear * 3 + 2] = b;
        nNear++;
      } else {
        this.far.setMatrixAt(nFar, this.tmpM);
        farCol[nFar * 3] = r;
        farCol[nFar * 3 + 1] = g;
        farCol[nFar * 3 + 2] = b;
        nFar++;
      }
    }

    this.near.count = nNear;
    this.far.count = nFar;
    this.near.instanceMatrix.needsUpdate = true;
    this.far.instanceMatrix.needsUpdate = true;
    this.near.instanceColor!.needsUpdate = true;
    this.far.instanceColor!.needsUpdate = true;
  }

  /* ---------------- helpers for the boom & camera ---------------- */

  /** Centroid of the floating raft (for framing and for the boom's start). */
  floatCentroid(out = new THREE.Vector2()): THREE.Vector2 {
    let sx = 0;
    let sz = 0;
    let c = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.state[i] !== S.FLOATING && this.state[i] !== S.INTAKE) continue;
      sx += this.px[i];
      sz += this.pz[i];
      c++;
    }
    return c ? out.set(sx / c, sz / c) : out.set(0, 0);
  }

  /** Mean distance of floating fruit from a point — our "packed" metric. */
  spread(cx: number, cz: number): number {
    let sum = 0;
    let c = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.state[i] !== S.FLOATING && this.state[i] !== S.INTAKE) continue;
      sum += Math.hypot(this.px[i] - cx, this.pz[i] - cz);
      c++;
    }
    return c ? sum / c : 0;
  }

  /** Position of a floating berry near a point — used to aim the hose hint. */
  nearestFloating(x: number, z: number, out: THREE.Vector3): boolean {
    let best = Infinity;
    let bi = -1;
    for (let i = 0; i < this.n; i++) {
      if (this.state[i] !== S.FLOATING) continue;
      const d = (this.px[i] - x) ** 2 + (this.pz[i] - z) ** 2;
      if (d < best) {
        best = d;
        bi = i;
      }
    }
    if (bi < 0) return false;
    out.set(this.px[bi], this.py[bi], this.pz[bi]);
    return true;
  }

  /**
   * A few berries slip under the boom before the pump starts. They are never
   * collected, so the bog is left with a scatter of fruit instead of a
   * suspiciously clean mirror — and the child gets something to poke at.
   */
  makeStrays(count: number, awayFrom: THREE.Vector2): number {
    let made = 0;
    const r = this.v.rng;
    for (let i = 0; i < this.n && made < count; i++) {
      if (this.state[i] !== S.FLOATING || this.stray[i]) continue;
      const ang = r.range(0, Math.PI * 2);
      const rad = r.range(0.55, 0.9);
      const x = awayFrom.x + Math.cos(ang) * this.v.halfX * rad;
      const z = awayFrom.y + Math.sin(ang) * this.v.halfZ * rad;
      const p2 = new THREE.Vector2(x, z);
      clampToBog(this.v, p2, 1.6);
      this.px[i] = p2.x;
      this.pz[i] = p2.y;
      this.stray[i] = 1;
      made++;
    }
    this.strayCount = made;
    return made;
  }

  private strayCount = 0;

  get strays(): number {
    return this.strayCount;
  }

  dispose(): void {
    this.densityTex.dispose();
    this.geoNear.dispose();
    this.geoFar.dispose();
    this.matNear.dispose();
    this.matFar.dispose();
  }
}
