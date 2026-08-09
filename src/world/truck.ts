/**
 * The collection truck and the pump skid on the dike.
 *
 * The bed is the payoff meter: it has no number on it, it just fills. The
 * fill slots are a jittered lattice inside the bed that heaps into a mound
 * above the sideboards, handed to the berry field so every berry that goes
 * down the hose has a real place to land.
 */

import * as THREE from 'three';
import { truckPosition, type FieldVariant } from './layout';

/** The truck is modelled at a comfortable working size and then scaled down
 *  so it reads as farm equipment beside the bog rather than a landmark. */
const TRUCK_SCALE = 0.72;

export class Truck {
  readonly group = new THREE.Group();
  readonly bedOrigin = new THREE.Vector3();
  readonly slots: THREE.Vector3[] = [];
  /** Where the hose lets go of the fruit. */
  readonly discharge = new THREE.Vector3();
  /** Pump body position on the dike. */
  readonly pump = new THREE.Vector3();
  /** Where the hose leaves the pump toward the bog. */
  readonly pumpIntake = new THREE.Vector3();

  private readonly wheels: THREE.Mesh[] = [];
  private readonly disposables: Array<{ dispose(): void }> = [];
  private driveT = -1;
  private idle = 0;
  private readonly home = new THREE.Vector3();
  private readonly bedHome = new THREE.Vector3();
  private readonly dischargeHome = new THREE.Vector3();
  pumpGroup: THREE.Group | null = null;

  constructor(v: FieldVariant, berryCount: number) {
    const base = truckPosition(v);
    this.group.name = 'truck';
    this.group.position.copy(base);
    this.group.rotation.y = -Math.PI / 2 + 0.16;
    this.group.scale.setScalar(TRUCK_SCALE);

    const body = new THREE.MeshStandardMaterial({
      color: v.truckColor.clone(),
      roughness: 0.42,
      metalness: 0.24,
    });
    const dark = new THREE.MeshStandardMaterial({ color: '#2f3436', roughness: 0.72, metalness: 0.3 });
    const glass = new THREE.MeshStandardMaterial({
      color: '#8fb9c4',
      roughness: 0.12,
      metalness: 0.1,
      transparent: true,
      opacity: 0.72,
    });
    const steel = new THREE.MeshStandardMaterial({ color: '#9aa3ab', roughness: 0.4, metalness: 0.8 });
    const bedMat = new THREE.MeshStandardMaterial({ color: '#6f7a72', roughness: 0.66, metalness: 0.35 });
    this.disposables.push(body, dark, glass, steel, bedMat);

    /* ---- chassis ---- */
    const frameGeo = new THREE.BoxGeometry(9.4, 0.42, 2.9);
    const frame = new THREE.Mesh(frameGeo, dark);
    frame.position.set(0, 1.06, 0);
    frame.castShadow = true;
    this.group.add(frame);
    this.disposables.push(frameGeo);

    /* ---- cab ---- */
    const cabGeo = new THREE.BoxGeometry(2.5, 2.1, 2.7);
    const cab = new THREE.Mesh(cabGeo, body);
    cab.position.set(3.3, 2.35, 0);
    cab.castShadow = true;
    this.group.add(cab);
    this.disposables.push(cabGeo);

    const noseGeo = new THREE.BoxGeometry(1.3, 1.2, 2.6);
    const nose = new THREE.Mesh(noseGeo, body);
    nose.position.set(4.9, 1.85, 0);
    nose.castShadow = true;
    this.group.add(nose);
    this.disposables.push(noseGeo);

    const winGeo = new THREE.BoxGeometry(0.14, 1.0, 2.3);
    const win = new THREE.Mesh(winGeo, glass);
    win.position.set(4.56, 2.72, 0);
    this.group.add(win);
    const sideWinGeo = new THREE.BoxGeometry(1.9, 0.9, 0.12);
    for (const dz of [-1.36, 1.36]) {
      const w = new THREE.Mesh(sideWinGeo, glass);
      w.position.set(3.35, 2.72, dz);
      this.group.add(w);
    }
    this.disposables.push(winGeo, sideWinGeo);

    /* ---- open bed ---- */
    const inHalfX = 3.05; // along the truck's length
    const inHalfZ = 1.42;
    const wallH = 1.55;
    const floorY = 1.32;

    const bedFloorGeo = new THREE.BoxGeometry(inHalfX * 2 + 0.3, 0.22, inHalfZ * 2 + 0.3);
    const bedFloor = new THREE.Mesh(bedFloorGeo, bedMat);
    bedFloor.position.set(-1.5, floorY - 0.14, 0);
    bedFloor.receiveShadow = true;
    this.group.add(bedFloor);
    this.disposables.push(bedFloorGeo);

    const longWallGeo = new THREE.BoxGeometry(inHalfX * 2 + 0.3, wallH, 0.16);
    for (const dz of [-inHalfZ - 0.06, inHalfZ + 0.06]) {
      const w = new THREE.Mesh(longWallGeo, body);
      w.position.set(-1.5, floorY + wallH / 2, dz);
      w.castShadow = true;
      this.group.add(w);
    }
    this.disposables.push(longWallGeo);

    const endWallGeo = new THREE.BoxGeometry(0.16, wallH, inHalfZ * 2 + 0.3);
    for (const dx of [-1.5 - inHalfX - 0.07, -1.5 + inHalfX + 0.07]) {
      const w = new THREE.Mesh(endWallGeo, body);
      w.position.set(dx, floorY + wallH / 2, 0);
      w.castShadow = true;
      this.group.add(w);
    }
    this.disposables.push(endWallGeo);

    // ribs so the bed does not read as a plain crate
    const ribGeo = new THREE.BoxGeometry(0.12, wallH * 0.92, 0.3);
    for (let i = 0; i < 5; i++) {
      for (const dz of [-inHalfZ - 0.16, inHalfZ + 0.16]) {
        const rib = new THREE.Mesh(ribGeo, dark);
        rib.position.set(-1.5 - inHalfX + 0.6 + i * 1.45, floorY + wallH / 2, dz);
        this.group.add(rib);
      }
    }
    this.disposables.push(ribGeo);

    /* ---- wheels ---- */
    const tyreGeo = new THREE.CylinderGeometry(0.82, 0.82, 0.62, 16);
    tyreGeo.rotateX(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.66, 10);
    hubGeo.rotateX(Math.PI / 2);
    for (const dx of [3.4, -1.1, -2.5]) {
      for (const dz of [-1.55, 1.55]) {
        const t = new THREE.Mesh(tyreGeo, dark);
        t.position.set(dx, 0.86, dz);
        t.castShadow = true;
        this.group.add(t);
        this.wheels.push(t);
        const h = new THREE.Mesh(hubGeo, steel);
        h.position.set(dx, 0.86, dz * 1.02);
        this.group.add(h);
      }
    }
    this.disposables.push(tyreGeo, hubGeo);

    /* ---- discharge stand: the hose ends over the bed, on a light frame ---- */
    const postGeo = new THREE.BoxGeometry(0.16, 2.6, 0.16);
    for (const dz of [-inHalfZ - 0.1, inHalfZ + 0.1]) {
      const post = new THREE.Mesh(postGeo, steel);
      post.position.set(-1.5, floorY + wallH + 0.6, dz);
      this.group.add(post);
    }
    const railTopGeo = new THREE.BoxGeometry(0.9, 0.16, inHalfZ * 2 + 0.4);
    const railTop = new THREE.Mesh(railTopGeo, steel);
    railTop.position.set(-1.5, floorY + wallH + 1.9, 0);
    this.group.add(railTop);
    this.disposables.push(postGeo, railTopGeo);

    /* ---- bed fill slots ---- */
    this.buildSlots(berryCount, inHalfX, inHalfZ, wallH);
    this.group.updateMatrixWorld(true);
    this.bedOrigin.set(-1.5, floorY, 0);
    this.group.localToWorld(this.bedOrigin);
    this.bedHome.copy(this.bedOrigin);

    this.discharge.set(-1.5, floorY + wallH + 0.95, 0);
    this.group.localToWorld(this.discharge);
    this.dischargeHome.copy(this.discharge);
    this.home.copy(this.group.position);

    /* ---- pump skid on the dike, between bog and truck ---- */
    this.pump.set(v.halfX * 0.72, 1.55, v.halfZ + 3.1);
    this.pumpIntake.set(v.halfX * 0.72, 1.2, v.halfZ + 0.55);
    this.buildPump(v, body, dark, steel);
  }

  /**
   * Slots are stored in the truck's LOCAL frame around bedOrigin, but the
   * berry field works in world space, so we bake the yaw in here.
   */
  private buildSlots(count: number, inHalfX: number, inHalfZ: number, wallH: number): void {
    const yaw = this.group.rotation.y;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    for (let spacing = 0.42; spacing >= 0.27; spacing -= 0.02) {
      this.slots.length = 0;
      const nx = Math.floor((inHalfX * 2) / spacing);
      const nz = Math.floor((inHalfZ * 2) / spacing);
      const layerH = spacing * 0.84;
      const maxLayers = 26;
      for (let ly = 0; ly < maxLayers && this.slots.length < count; ly++) {
        const y = 0.2 + ly * layerH;
        const above = Math.max(0, y - wallH);
        const shrink = above > 0 ? Math.max(0, 1 - above / 1.15) : 1;
        if (shrink <= 0.05) break;
        for (let i = 0; i < nx; i++) {
          for (let j = 0; j < nz; j++) {
            const lx = (-inHalfX + spacing * 0.5 + i * spacing) * (above > 0 ? shrink : 1);
            const lz = (-inHalfZ + spacing * 0.5 + j * spacing) * (above > 0 ? shrink : 1);
            const jx = lx + (Math.random() - 0.5) * spacing * 0.3;
            const jz = lz + (Math.random() - 0.5) * spacing * 0.3;
            const jy = y + (Math.random() - 0.5) * layerH * 0.25;
            // rotate into world orientation around the bed origin, and take
            // the group scale with us — the berry field works in world space
            this.slots.push(
              new THREE.Vector3(
                (jx * cos + jz * sin) * TRUCK_SCALE,
                jy * TRUCK_SCALE,
                (-jx * sin + jz * cos) * TRUCK_SCALE,
              ),
            );
          }
        }
      }
      if (this.slots.length >= count) break;
    }
    this.slots.sort((a, b) => a.y - b.y);
  }

  private buildPump(
    v: FieldVariant,
    body: THREE.Material,
    dark: THREE.Material,
    steel: THREE.Material,
  ): void {
    const g = new THREE.Group();
    g.position.set(this.pump.x, 0, this.pump.z);
    g.rotation.y = Math.PI;
    g.scale.setScalar(0.62);

    const skidGeo = new THREE.BoxGeometry(3.2, 0.34, 2.2);
    const skid = new THREE.Mesh(skidGeo, dark);
    skid.position.y = 1.25;
    g.add(skid);

    const caseGeo = new THREE.CylinderGeometry(0.92, 0.92, 1.9, 16);
    caseGeo.rotateZ(Math.PI / 2);
    const casing = new THREE.Mesh(caseGeo, body);
    casing.position.set(0, 2.1, 0);
    casing.castShadow = true;
    g.add(casing);

    const volGeo = new THREE.TorusGeometry(0.72, 0.42, 10, 20);
    const volute = new THREE.Mesh(volGeo, steel);
    volute.position.set(-0.9, 2.1, 0);
    volute.rotation.y = Math.PI / 2;
    g.add(volute);

    const stackGeo = new THREE.CylinderGeometry(0.14, 0.18, 1.3, 8);
    const stack = new THREE.Mesh(stackGeo, dark);
    stack.position.set(0.7, 3.1, -0.5);
    g.add(stack);

    const railGeo = new THREE.TorusGeometry(1.15, 0.06, 6, 18, Math.PI);
    const rail = new THREE.Mesh(railGeo, steel);
    rail.position.set(0, 2.4, 1.0);
    rail.rotation.x = Math.PI / 2;
    g.add(rail);

    this.pumpGroup = g;
    this.disposables.push(skidGeo, caseGeo, volGeo, stackGeo, railGeo);
    void v;
  }

  /** Start the closing drive-away. */
  driveAway(): void {
    if (this.driveT < 0) this.driveT = 0;
  }

  get leaving(): boolean {
    return this.driveT >= 0;
  }

  update(dt: number, pumping: number): void {
    this.idle += dt;
    // engine idle shiver, stronger while the pump is running
    const shake = 0.006 + pumping * 0.016;
    this.group.position.y = this.home.y + Math.sin(this.idle * 22) * shake;

    if (this.driveT >= 0) {
      this.driveT += dt;
      // straight line only: the bed slots are baked in world space, so the
      // load rides along exactly as long as we do not re-yaw the truck
      const speed = Math.min(4.2, this.driveT * 1.5);
      const dx = Math.cos(this.group.rotation.y) * speed * dt;
      const dz = -Math.sin(this.group.rotation.y) * speed * dt;
      this.group.position.x += dx;
      this.group.position.z += dz;
      this.bedOrigin.set(
        this.bedHome.x + (this.group.position.x - this.home.x),
        this.bedHome.y,
        this.bedHome.z + (this.group.position.z - this.home.z),
      );
      this.discharge.set(
        this.dischargeHome.x + (this.group.position.x - this.home.x),
        this.dischargeHome.y,
        this.dischargeHome.z + (this.group.position.z - this.home.z),
      );
      for (const w of this.wheels) w.rotation.z -= speed * dt * 1.2;
    }
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.pumpGroup?.removeFromParent();
  }
}
