import * as THREE from 'three';
import { V3, clamp01, srange } from './util.js';
import { LAYOUT } from './world.js';

const SPEED = 3.4;       // water head speed, m/s
const START_DELAY = 0.5; // splash-at-gate moment before water enters the channel

/**
 * Drives everything that happens after the sluice gate opens.
 * The water's route is exactly the channel network the child completed,
 * and the flowers that bloom in the beds are the seeds the child planted.
 */
export class Finale {
  constructor(world, fx, snd, ui) {
    this.world = world;
    this.fx = fx;
    this.snd = snd;
    this.ui = ui;
    this.started = false;
    this.clock = 0;
    this.flags = {
      junction: false, fountainFill: false, fountainOn: false,
      wheelOn: false, pond: false, westPool: false, allWater: false,
      creatures: false, fanfare: false, done: false,
    };
    this.life = 0;
    this.camFocus = 'overview'; // camera tour: overview→fountain→wheel→beds→overview
    this._prepBranches();
  }

  _prepBranches() {
    const B = this.world.channels.branches;
    const mainLen = B.main.reduce((s, r) => s + r.len, 0);
    this.tBranch = START_DELAY + mainLen / SPEED;
    const mk = (runs, t0) => {
      let acc = 0;
      const list = runs.map((r) => {
        const item = { run: r, start: acc };
        acc += r.len;
        return item;
      });
      return { runs: list, total: acc, t0 };
    };
    this.branches = {
      main: mk(B.main, START_DELAY),
      west: mk(B.west, this.tBranch),
      east: mk(B.east, this.tBranch),
      center: mk(B.center, this.tBranch),
    };
    this.tEnd = Math.max(
      ...Object.values(this.branches).map((b) => b.t0 + b.total / SPEED)
    );
    // waterwheel sits 15m along the east branch (9m to the corner + 6m north)
    this.tWheel = this.tBranch + 15 / SPEED;
    // beds along the west branch
    this.bedTimes = LAYOUT.beds.map(
      (c) => this.tBranch + (9 + (c.z - -6)) / SPEED
    );
    this.bedFired = [false, false, false];
    // the planted seeds bloom once water has arrived AND the camera is watching
    this.bedBloomTimes = this.bedTimes.map((bt, i) => Math.max(bt, 10.4 + i * 1.0));
    this.bedBloomFired = [false, false, false];
  }

  /** finale-time at which water reaches the point nearest `pos` */
  arrivalTime(pos) {
    const line = new THREE.Line3();
    const tmp = V3();
    let best = Infinity, bestT = this.tEnd;
    for (const b of Object.values(this.branches)) {
      for (const { run, start } of b.runs) {
        line.set(run.a, run.b);
        line.closestPointToPoint(pos, true, tmp);
        const d = tmp.distanceTo(pos);
        if (d < best) {
          best = d;
          bestT = b.t0 + (start + run.a.distanceTo(tmp)) / SPEED;
        }
      }
    }
    return bestT;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.clock = 0;
    this.snd.rumble();
    this.snd.splash();
    this.snd.setWater(0.5);
    this.world.chuteWater.visible = true;
    const gatePos = V3(0, 1.2, -13.6);
    this.fx.splash.burst(gatePos, 40, 1.6, 3.2, 1.0);
    this.fx.startBloomWave((pos) => this.arrivalTime(pos));
  }

  update(dt, time) {
    if (!this.started || this.flags.done) return;
    this.clock += dt;
    const t = this.clock;
    const F = this.flags;

    // ---- advance water along every branch ----
    for (const b of Object.values(this.branches)) {
      const head = (t - b.t0) * SPEED;
      if (head <= 0) continue;
      for (const { run, start } of b.runs) {
        run.setFill((head - start) / run.len);
      }
      // sparkling water head
      if (head < b.total && Math.random() < 0.5) {
        for (const { run, start } of b.runs) {
          if (head >= start && head <= start + run.len) {
            this.fx.splash.burst(run.headPos(), 2, 0.25, 1.2, 0.4);
          }
        }
      }
    }

    // ---- junction ----
    if (!F.junction && t >= this.tBranch) {
      F.junction = true;
      this.world.junctionWater.visible = true;
      this.snd.splash();
      this.snd.setWater(0.75);
      this.fx.splash.burst(V3(0, 0.6, -6), 24, 0.8, 2.4, 0.8);
    }

    // ---- fountain ----
    const bc = this.branches.center;
    const tCenterDone = bc.t0 + bc.total / SPEED;
    if (!F.fountainFill && t >= tCenterDone) {
      F.fountainFill = true;
      this.world.basinWater.visible = true;
      this.world.basinWater.scale.setScalar(0.05);
      this.snd.splash();
    }
    if (F.fountainFill && !F.fountainOn) {
      const k = clamp01((t - tCenterDone) / 1.3);
      this.world.basinWater.scale.setScalar(Math.max(0.05, k));
      if (k >= 1) {
        F.fountainOn = true;
        this.fountainJetT = t;
        this.world.plume.visible = true;
      }
    }
    if (F.fountainOn) {
      const jt = t - this.fountainJetT;
      this.world.plumeOn = clamp01(jt / 0.8);
      this.world.nozzles.forEach((n, i) => {
        const k = clamp01((jt - 0.4 - i * 0.35) / 0.6);
        if (k > 0 && !n.jet.visible) {
          n.jet.visible = true;
          this.snd.chimeNote(i * 2, 0, 0.18);
          this.snd.splash();
        }
        n.jetOn = k;
      });
      if (Math.random() < 0.35) {
        const f = LAYOUT.fountain;
        this.fx.splash.burst(V3(f.x + srange(-1.4, 1.4), 1.6, f.z + srange(-1.4, 1.4)), 3, 0.5, 1.6, 0.7);
      }
    }

    // ---- waterwheel ----
    if (!F.wheelOn && t >= this.tWheel) {
      F.wheelOn = true;
      this.snd.splash();
    }
    if (F.wheelOn) {
      this.world.wheelSpeed = Math.min(2.3, (this.world.wheelSpeed || 0) + dt * 1.4);
      if (Math.random() < 0.4) {
        const w = LAYOUT.wheelPos;
        this.fx.splash.burst(V3(w.x + srange(-0.5, 0.5), 0.6, w.z + srange(-0.9, 0.3)), 2, 0.6, 1.8, 0.6);
      }
      if (Math.random() < dt * 2.5) this.snd.creakLoopTick();
    }

    // ---- branch-end pools ----
    const be = this.branches.east, bw = this.branches.west;
    if (!F.pond && t >= be.t0 + be.total / SPEED) {
      F.pond = true;
      this.world.pond.water.visible = true;
      this.fx.splash.burst(V3(LAYOUT.pond.x, 0.4, LAYOUT.pond.z), 16, 0.6, 2, 0.7);
      this.snd.splash();
    }
    if (!F.westPool && t >= bw.t0 + bw.total / SPEED) {
      F.westPool = true;
      this.world.westPool.water.visible = true;
      this.fx.splash.burst(V3(LAYOUT.westPool.x, 0.4, LAYOUT.westPool.z), 14, 0.5, 2, 0.7);
      this.snd.splash();
    }

    // ---- camera tour schedule ----
    this.camFocus =
      t < 5.0 ? 'overview' :
      t < 7.9 ? 'fountain' :
      t < 10.3 ? 'wheel' :
      t < 14.4 ? 'beds' : 'overview';

    // ---- water reaches each bed: soil darkens + sparkle ----
    this.bedTimes.forEach((bt, i) => {
      if (!this.bedFired[i] && t >= bt) {
        this.bedFired[i] = true;
        this.fx.sparkle.burst(V3(this.world.beds[i].center.x, 0.6, this.world.beds[i].center.z), 12, 1.0, 1.8, 0.9);
      }
    });
    // ---- the child's planted seeds bloom (camera is on the beds) ----
    this.bedBloomTimes.forEach((bt, i) => {
      if (!this.bedBloomFired[i] && t >= bt) {
        this.bedBloomFired[i] = true;
        const bed = this.world.beds[i];
        this.fx.sparkle.burst(V3(bed.center.x, 0.8, bed.center.z), 20, 1.2, 2.2, 1.0);
        bed.plants.forEach((p, j) => {
          this.world.bloomPlant(p, 0.2 + j * 0.45);
          this.snd.chimeNote(i * 2 + j, 0.5 + j * 0.45, 0.2);
        });
      }
    });

    // ---- everything watered: the park comes back to life ----
    if (!F.allWater && t >= Math.max(this.tEnd + 0.4, 14.4)) {
      F.allWater = true;
      this.lifeT0 = t;
      this.snd.setWater(1.0);
      this.snd.fanfare();
    }
    if (F.allWater && this.life < 1) {
      this.life = clamp01((t - this.lifeT0) / 5.5);
      this.world.setLife(this.life);
    }
    if (!F.creatures && this.life > 0.4) {
      F.creatures = true;
      const perches = [
        V3(0, 3.6, -14.3), this.world.benchTop,
        ...this.world.lamps.map((l) => l.top),
        V3(1.4, 3.4, -9), V3(-15, 3.4, -8),
      ];
      this.fx.releaseCreatures(perches);
    }
    if (F.creatures && Math.random() < dt * 0.5) this.snd.bird();
    if (!F.fanfare && this.life >= 1) {
      F.fanfare = true;
      this.snd.bigFanfare();
      const c = LAYOUT.fountain;
      this.fx.sparkle.burst(V3(c.x, 2.5, c.z), 60, 4, 3, 1.6);
      setTimeout(() => { this.flags.done = true; }, 100);
    }
  }
}
