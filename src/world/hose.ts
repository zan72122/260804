/**
 * The suction hose.
 *
 * A Catmull-Rom spline from the floating nozzle, over the dike, through the
 * pump and up to the truck chute. The tube mesh is built once and its
 * vertex buffer is rewritten in place whenever the nozzle moves — no
 * geometry churn, no soft-body solver.
 *
 * The middle stretch uses a second, translucent material so the fruit
 * riding the spline is visible going past. That window is the whole reason
 * the hose exists as a hero material.
 */

import * as THREE from 'three';
import { clamp, damp } from '../core/math';

const RADIAL = 12;
const TUBULAR = 96;
/** Fraction of the run that is see-through. */
/**
 * Fraction of the run that is see-through. Chosen to cover the stretch from
 * just above the bell to the arch out of the water — the part that is
 * physically closest to the camera in both suction shots, and therefore the
 * part where a berry going past is actually legible.
 */
const WINDOW_A = 0.02;
const WINDOW_B = 0.34;

export class Hose {
  readonly group = new THREE.Group();
  readonly nozzle = new THREE.Group();
  /** Where the fruit enters — the mouth of the bell. */
  readonly mouth = new THREE.Vector3();
  /** The floating coupling ring the nozzle wants to click into. */
  readonly coupling = new THREE.Group();
  readonly couplingPos = new THREE.Vector3();

  curve: THREE.CatmullRomCurve3;
  connected = false;

  private readonly mesh: THREE.Mesh;
  private readonly geo: THREE.BufferGeometry;
  private readonly matBody: THREE.MeshStandardMaterial;
  private readonly matClear: THREE.MeshStandardMaterial;
  private readonly disposables: Array<{ dispose(): void }> = [];
  private readonly ctrl: THREE.Vector3[] = [];
  private readonly nozzlePos = new THREE.Vector2();
  private readonly ringMat: THREE.MeshStandardMaterial;
  private collars: THREE.Mesh[] = [];
  private time = 0;

  constructor(
    private readonly pumpIntake: THREE.Vector3,
    private readonly pump: THREE.Vector3,
    private readonly discharge: THREE.Vector3,
  ) {
    this.group.name = 'hose';

    for (let i = 0; i < 7; i++) this.ctrl.push(new THREE.Vector3());
    this.curve = new THREE.CatmullRomCurve3(this.ctrl, false, 'catmullrom', 0.4);

    this.matBody = new THREE.MeshStandardMaterial({
      color: '#4d5763',
      roughness: 0.6,
      metalness: 0.18,
      side: THREE.DoubleSide,
    });
    // Front faces only: we blend the near wall over the fruit inside and let
    // the far wall be culled, which is what actually reads as glass. Drawing
    // both walls just doubles the haze and hides the flow.
    this.matClear = new THREE.MeshStandardMaterial({
      color: '#7e9a97',
      roughness: 0.14,
      metalness: 0.06,
      transparent: true,
      opacity: 0.5,
      side: THREE.FrontSide,
      depthWrite: false,
    });
    this.disposables.push(this.matBody, this.matClear);

    this.geo = this.buildTube();
    this.mesh = new THREE.Mesh(this.geo, [this.matBody, this.matClear]);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    this.group.add(this.mesh);
    this.disposables.push(this.geo);

    // steel collars at each end of the glass, so the see-through stretch
    // reads as a deliberate sight window rather than a hole in the model
    const collar = new THREE.TorusGeometry(0.33, 0.055, 8, 18);
    const collarMat = new THREE.MeshStandardMaterial({
      color: '#aeb6bc',
      roughness: 0.32,
      metalness: 0.85,
    });
    this.collars = [new THREE.Mesh(collar, collarMat), new THREE.Mesh(collar, collarMat)];
    this.collars.forEach((c) => {
      c.frustumCulled = false;
      this.group.add(c);
    });
    this.disposables.push(collar, collarMat);

    this.buildNozzle();
    this.buildCoupling();
    this.ringMat = this.coupling.userData.mat as THREE.MeshStandardMaterial;
  }

  private buildTube(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const vCount = (TUBULAR + 1) * (RADIAL + 1);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vCount * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vCount * 3), 3));
    const uv = new Float32Array(vCount * 2);
    for (let i = 0; i <= TUBULAR; i++) {
      for (let j = 0; j <= RADIAL; j++) {
        const k = i * (RADIAL + 1) + j;
        uv[k * 2] = i / TUBULAR;
        uv[k * 2 + 1] = j / RADIAL;
      }
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

    // index buffer ordered by tubular segment, so material groups are ranges
    const idx: number[] = [];
    const bounds: Array<[number, number, number]> = [];
    let start = 0;
    let currentMat = 0;
    for (let i = 0; i < TUBULAR; i++) {
      const t = (i + 0.5) / TUBULAR;
      const mat = t > WINDOW_A && t < WINDOW_B ? 1 : 0;
      if (mat !== currentMat) {
        bounds.push([start, idx.length - start, currentMat]);
        start = idx.length;
        currentMat = mat;
      }
      for (let j = 0; j < RADIAL; j++) {
        const a = i * (RADIAL + 1) + j;
        const b = (i + 1) * (RADIAL + 1) + j;
        // wound so that front faces point outward, matching the outward
        // vertex normals below — the clear section is single-sided
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    bounds.push([start, idx.length - start, currentMat]);
    geo.setIndex(idx);
    for (const [s, c, m] of bounds) geo.addGroup(s, c, m);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);
    return geo;
  }

  private buildNozzle(): void {
    const steel = new THREE.MeshStandardMaterial({
      color: '#b9c2c8',
      roughness: 0.34,
      metalness: 0.85,
    });
    const grip = new THREE.MeshStandardMaterial({ color: '#ef7d3c', roughness: 0.6 });
    const foam = new THREE.MeshStandardMaterial({ color: '#f6f2e6', roughness: 0.85 });
    this.disposables.push(steel, grip, foam);

    const bellGeo = new THREE.CylinderGeometry(0.47, 0.28, 0.58, 16, 1, true);
    const bell = new THREE.Mesh(bellGeo, steel);
    bell.material.side = THREE.DoubleSide;
    bell.position.y = -0.12;
    this.nozzle.add(bell);

    const collarGeo = new THREE.TorusGeometry(0.3, 0.06, 8, 16);
    const collar = new THREE.Mesh(collarGeo, grip);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.18;
    this.nozzle.add(collar);

    // flotation collar keeps the bell at the surface and gives a fat target
    const floatGeo = new THREE.TorusGeometry(0.56, 0.135, 10, 20);
    const flt = new THREE.Mesh(floatGeo, foam);
    flt.rotation.x = Math.PI / 2;
    flt.position.y = 0.1;
    this.nozzle.add(flt);

    const handleGeo = new THREE.TorusGeometry(0.2, 0.04, 8, 14, Math.PI);
    const handle = new THREE.Mesh(handleGeo, grip);
    handle.position.y = 0.42;
    this.nozzle.add(handle);

    const stubGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.3, 12);
    const stub = new THREE.Mesh(stubGeo, steel);
    stub.position.y = 0.34;
    this.nozzle.add(stub);

    this.disposables.push(bellGeo, collarGeo, floatGeo, handleGeo, stubGeo);
    this.group.add(this.nozzle);
  }

  private buildCoupling(): void {
    const mat = new THREE.MeshStandardMaterial({
      color: '#ffd166',
      emissive: '#ffae2b',
      emissiveIntensity: 0.5,
      roughness: 0.5,
      transparent: true,
      opacity: 0.9,
    });
    const g1 = new THREE.TorusGeometry(0.7, 0.075, 8, 22);
    const ring = new THREE.Mesh(g1, mat);
    ring.rotation.x = -Math.PI / 2;
    this.coupling.add(ring);
    const g2 = new THREE.TorusGeometry(0.45, 0.045, 8, 18);
    const inner = new THREE.Mesh(g2, mat);
    inner.rotation.x = -Math.PI / 2;
    this.coupling.add(inner);
    this.coupling.userData.mat = mat;
    this.disposables.push(mat, g1, g2);
    this.group.add(this.coupling);
  }

  /** Put the nozzle in the water at the near edge of the raft. */
  place(x: number, z: number, couplingAt: THREE.Vector2): void {
    this.nozzlePos.set(x, z);
    this.couplingPos.set(couplingAt.x, 0, couplingAt.y);
    this.connected = false;
  }

  dragTo(x: number, z: number, dt: number): void {
    const max = 14 * dt;
    const dx = x - this.nozzlePos.x;
    const dz = z - this.nozzlePos.y;
    const d = Math.hypot(dx, dz);
    if (d > 1e-4) {
      const step = Math.min(d, max);
      this.nozzlePos.x += (dx / d) * step;
      this.nozzlePos.y += (dz / d) * step;
    }
  }

  /** Distance from the nozzle to the coupling, on the water plane. */
  distanceToCoupling(): number {
    return Math.hypot(
      this.nozzlePos.x - this.couplingPos.x,
      this.nozzlePos.y - this.couplingPos.z,
    );
  }

  /** Magnet snap. Generous on purpose: "nearly there" counts as connected. */
  trySnap(radius = 3.6): boolean {
    if (this.connected) return false;
    if (this.distanceToCoupling() > radius) return false;
    this.connected = true;
    return true;
  }

  update(dt: number, waterHeight: (x: number, z: number) => number, pumping: number): void {
    this.time += dt;
    if (this.connected) {
      this.nozzlePos.x = damp(this.nozzlePos.x, this.couplingPos.x, 9, dt);
      this.nozzlePos.y = damp(this.nozzlePos.y, this.couplingPos.z, 9, dt);
    }

    const nx = this.nozzlePos.x;
    const nz = this.nozzlePos.y;
    const wy = waterHeight(nx, nz);
    const suck = pumping * 0.1;
    this.nozzle.position.set(nx, wy + 0.07 - suck * 0.6 + Math.sin(this.time * 2.1) * 0.02, nz);
    this.nozzle.rotation.z = Math.sin(this.time * 1.4) * 0.05;
    this.mouth.set(nx, wy - 0.2, nz);

    this.coupling.position.set(
      this.couplingPos.x,
      waterHeight(this.couplingPos.x, this.couplingPos.z) + 0.05,
      this.couplingPos.z,
    );
    const pulse = 0.5 + Math.sin(this.time * 3.2) * 0.35;
    this.ringMat.emissiveIntensity = this.connected ? 0.15 : pulse;
    this.coupling.visible = !this.connected;
    const s = this.connected ? 1 : 1 + Math.sin(this.time * 3.2) * 0.06;
    this.coupling.scale.setScalar(s);

    /* control points: nozzle → rise → over the dike → pump → arc → chute */
    const p = this.ctrl;
    p[0].set(nx, wy - 0.1, nz);
    p[1].set(nx, wy + 0.32, nz);
    const toPump = new THREE.Vector3(this.pumpIntake.x - nx, 0, this.pumpIntake.z - nz);
    const dist = toPump.length() || 1;
    toPump.divideScalar(dist);
    p[2].set(
      nx + toPump.x * dist * 0.42,
      wy + 0.72 + Math.sin(this.time * 1.6) * 0.04,
      nz + toPump.z * dist * 0.42,
    );
    p[3].copy(this.pumpIntake);
    p[4].copy(this.pump).add(new THREE.Vector3(0, 0.55, 0));
    p[5].set(
      (this.pump.x + this.discharge.x) / 2,
      Math.max(this.pump.y, this.discharge.y) + 1.9,
      (this.pump.z + this.discharge.z) / 2,
    );
    p[6].copy(this.discharge);
    this.curve.updateArcLengths();

    this.rebuildTube();
  }

  /** Rewrite the tube's vertex buffer along the current spline. */
  private rebuildTube(): void {
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    const nrm = this.geo.attributes.normal as THREE.BufferAttribute;
    const pa = pos.array as Float32Array;
    const na = nrm.array as Float32Array;

    const point = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const binormal = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const prevNormal = new THREE.Vector3(1, 0, 0);

    for (let i = 0; i <= TUBULAR; i++) {
      const t = i / TUBULAR;
      this.curve.getPointAt(t, point);
      this.curve.getTangentAt(t, tangent).normalize();
      // parallel-transport-ish frame: stable, no twisting flip
      normal.copy(prevNormal).sub(tangent.clone().multiplyScalar(prevNormal.dot(tangent)));
      if (normal.lengthSq() < 1e-6) normal.crossVectors(up, tangent);
      normal.normalize();
      prevNormal.copy(normal);
      binormal.crossVectors(tangent, normal).normalize();

      // fat at the pump end, slimmer at the bell; a gentle pulse when pumping
      // wide enough that a berry rides *inside* the bore, never through it
      const r = 0.25 + 0.05 * Math.sin(t * Math.PI) + 0.008 * Math.sin(this.time * 7 - t * 12);
      for (let j = 0; j <= RADIAL; j++) {
        const a = (j / RADIAL) * Math.PI * 2;
        const cx = Math.cos(a);
        const sy = Math.sin(a);
        const k = (i * (RADIAL + 1) + j) * 3;
        const nxv = normal.x * cx + binormal.x * sy;
        const nyv = normal.y * cx + binormal.y * sy;
        const nzv = normal.z * cx + binormal.z * sy;
        pa[k] = point.x + nxv * r;
        pa[k + 1] = point.y + nyv * r;
        pa[k + 2] = point.z + nzv * r;
        na[k] = nxv;
        na[k + 1] = nyv;
        na[k + 2] = nzv;
      }
    }
    pos.needsUpdate = true;
    nrm.needsUpdate = true;

    const axis = new THREE.Vector3(0, 0, 1);
    [WINDOW_A, WINDOW_B].forEach((t, i) => {
      const c = this.collars[i];
      if (!c) return;
      this.curve.getPointAt(t, point);
      this.curve.getTangentAt(t, tangent).normalize();
      c.position.copy(point);
      c.quaternion.setFromUnitVectors(axis, tangent);
    });
  }

  /** Where the fruit should be pulled toward while the pump runs. */
  intakePoint(out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.mouth);
  }

  /** Point on the transparent window — the camera looks here in scene 7. */
  windowPoint(out = new THREE.Vector3()): THREE.Vector3 {
    return this.curve.getPointAt(clamp((WINDOW_A + WINDOW_B) / 2, 0, 1), out);
  }

  /**
   * Where the hose arches out of the water on its way to the dike. The
   * suction camera parks here — an authored point rather than a computed
   * perpendicular, because a computed one can walk into the pump skid.
   */
  archPoint(out = new THREE.Vector3()): THREE.Vector3 {
    return this.curve.getPointAt(0.22, out);
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
