/**
 * One harvest day: every object that belongs to a single playthrough, built
 * from a seed and thrown away when the child asks for another field.
 */

import * as THREE from 'three';
import { makeVariant, WATER_DRY, type FieldVariant } from '../world/layout';
import { Terrain } from '../world/terrain';
import { Water } from '../world/water';
import { Vines } from '../world/vines';
import { BerryField } from '../world/berries';
import { Particles, PKind } from '../world/particles';
import { Gate } from '../world/gate';
import { Reel } from '../world/reel';
import { Boom } from '../world/boom';
import { Hose } from '../world/hose';
import { Truck } from '../world/truck';
import { quality, currentTier } from '../core/settings';
import { sfxPop } from '../core/audio';

export class World {
  readonly root = new THREE.Group();
  readonly variant: FieldVariant;
  readonly terrain: Terrain;
  readonly water: Water;
  readonly vines: Vines;
  readonly berries: BerryField;
  readonly particles: Particles;
  readonly gate: Gate;
  readonly reel: Reel;
  readonly boom: Boom;
  readonly hose: Hose;
  readonly truck: Truck;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;

  private readonly bubbleColor = new THREE.Color('#dff2f0');
  private readonly dropColor = new THREE.Color('#cfe8ea');
  private readonly foamColor = new THREE.Color('#f4faf7');
  private readonly leafColor = new THREE.Color('#6d7c3a');
  private popBudget = 0;

  constructor(seed: number) {
    const q = quality();
    const v = makeVariant(seed);
    this.variant = v;
    this.root.name = 'world';

    this.terrain = new Terrain(v, q.decor);
    this.water = new Water(v, q.waterSegments, currentTier() === 'low' ? 0 : 1);
    this.vines = new Vines(v, q.vines);
    this.particles = new Particles(q.particles);

    this.berries = new BerryField(
      v,
      this.water,
      this.vines.anchors,
      q.berries,
      {
        onSurface: (x, y, z, speed) => this.onSurface(x, y, z, speed),
        onBubble: (x, y, z) => this.onBubble(x, y, z),
        onBedLand: (x, y, z) => this.onBedLand(x, y, z),
      },
      currentTier() === 'low',
    );
    v.berryCount = this.berries.n;

    this.gate = new Gate(v);
    this.reel = new Reel(v);
    this.boom = new Boom(v);
    this.truck = new Truck(v, this.berries.n);
    this.hose = new Hose(this.truck.pumpIntake, this.truck.pump, this.truck.discharge);
    this.berries.setBed(this.truck.bedOrigin, this.truck.slots);

    /* ---- lighting: one warm key, one cool sky fill ---- */
    // one warm key with real punch, plus a cool sky fill; the contrast
    // between them is what keeps the machinery and the fruit readable
    this.hemi = new THREE.HemisphereLight(v.skyTop.clone(), new THREE.Color('#4a3f28'), 0.8);
    this.sun = new THREE.DirectionalLight(v.sunColor.clone(), 3.1);
    this.sun.position.set(16, 26, 13);
    if (q.shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(1024, 1024);
      const c = this.sun.shadow.camera;
      const r = Math.max(v.halfX, v.halfZ) + 10;
      c.left = -r;
      c.right = r;
      c.top = r;
      c.bottom = -r;
      c.near = 1;
      c.far = 80;
      this.sun.shadow.bias = -0.0016;
      this.sun.shadow.normalBias = 0.05;
    }

    this.root.add(
      this.terrain.group,
      this.vines.mesh,
      this.berries.group,
      this.water.mesh,
      this.particles.points,
      this.gate.group,
      this.reel.group,
      this.boom.group,
      this.hose.group,
      this.truck.group,
      this.hemi,
      this.sun,
      this.sun.target,
    );
    if (this.truck.pumpGroup) this.root.add(this.truck.pumpGroup);

    // machines that have not entered the story yet stay off stage
    this.reel.group.visible = false;
    this.boom.group.visible = false;
    this.hose.group.visible = false;

    this.water.level = WATER_DRY;
    this.water.targetLevel = WATER_DRY;
  }

  /* ---------------- particle reactions ---------------- */

  private onSurface(x: number, y: number, z: number, speed: number): void {
    const p = this.particles;
    const n = speed > 1.4 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      p.spawn(
        PKind.Droplet,
        x + (Math.random() - 0.5) * 0.2,
        y + 0.08,
        z + (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 1.3,
        0.9 + Math.random() * 1.5,
        (Math.random() - 0.5) * 1.3,
        0.07 + Math.random() * 0.07,
        0.45 + Math.random() * 0.3,
        this.dropColor,
      );
    }
    p.spawn(PKind.Foam, x, y, z, 0, 0, 0, 0.34, 0.55, this.foamColor);
    // a pop for roughly one berry in four — a hundred clicks at once is noise
    if (this.popBudget <= 0) {
      sfxPop(0.55 + Math.random() * 0.5);
      this.popBudget = 2 + Math.floor(Math.random() * 4);
    } else {
      this.popBudget--;
    }
  }

  private onBubble(x: number, y: number, z: number): void {
    this.particles.spawn(
      PKind.Bubble,
      x + (Math.random() - 0.5) * 0.16,
      y,
      z + (Math.random() - 0.5) * 0.16,
      (Math.random() - 0.5) * 0.15,
      0.5 + Math.random() * 0.5,
      (Math.random() - 0.5) * 0.15,
      0.09 + Math.random() * 0.09,
      0.7 + Math.random() * 0.6,
      this.bubbleColor,
    );
  }

  private onBedLand(x: number, y: number, z: number): void {
    if (Math.random() < 0.22) {
      this.particles.spawn(
        PKind.Spark,
        x,
        y + 0.1,
        z,
        (Math.random() - 0.5) * 0.6,
        0.3,
        (Math.random() - 0.5) * 0.6,
        0.06,
        0.3,
        this.leafColor,
      );
    }
  }

  /** Debris the reel kicks loose alongside the fruit. */
  spawnChurn(x: number, y: number, z: number, intensity: number): void {
    const p = this.particles;
    const n = Math.min(3, 1 + Math.floor(intensity * 3));
    for (let i = 0; i < n; i++) {
      p.spawn(
        PKind.Droplet,
        x + (Math.random() - 0.5) * 1.6,
        y + 0.1,
        z + (Math.random() - 0.5) * 1.6,
        (Math.random() - 0.5) * 3.2,
        1.4 + Math.random() * 2.4 * intensity,
        (Math.random() - 0.5) * 3.2,
        0.07 + Math.random() * 0.08,
        0.4 + Math.random() * 0.4,
        this.dropColor,
      );
    }
    if (Math.random() < 0.4 * intensity) {
      p.spawn(PKind.Foam, x, y, z, 0, 0, 0, 0.5, 0.7, this.foamColor);
    }
    if (Math.random() < 0.1) {
      p.spawn(
        PKind.Leaf,
        x + (Math.random() - 0.5) * 2,
        y + 0.3,
        z + (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 1.4,
        0.6,
        (Math.random() - 0.5) * 1.4,
        0.13,
        4 + Math.random() * 4,
        this.leafColor,
      );
    }
  }

  dispose(): void {
    this.terrain.dispose();
    this.water.dispose();
    this.vines.dispose();
    this.berries.dispose();
    this.particles.dispose();
    this.gate.dispose();
    this.reel.dispose();
    this.boom.dispose();
    this.hose.dispose();
    this.truck.dispose();
    this.root.removeFromParent();
    this.root.clear();
  }
}
