// Pinball mode: lifecycle, the ball on the table, and the plunger.
//
// Phase 1 scope — one ball, launch it, keep it alive with the flippers, lose it
// down the drain and get it back. No transformations yet; this exists so the
// feel of the table can be judged before anything is built on top of it.

import * as THREE from 'three';
import * as TEX from '../engine/textures.js';
import { PinballWorld, Ball } from './physics.js';
import { Table, TABLE } from './table.js';
import { buildMesh } from '../game/items.js';
import { clamp, damp } from '../engine/util.js';

const STUCK_NUDGE = 2.5;    // seconds before the table shakes itself
const STUCK_GIVEUP = 9.0;   // …and before the ball is written off

export class Pinball {
  constructor(view, stall, fx, audio) {
    this.view = view;
    this.stall = stall;
    this.fx = fx;
    this.audio = audio;

    this.table = new Table(view);
    this.world = new PinballWorld({ gravity: TABLE.gravity, damping: 0.22 });
    this.active = false;
    this.balls = [];
    this.root = new THREE.Group();
    this.root.visible = false;
    view.scene.add(this.root);

    this.plungerV = TABLE.plungerRest;
    this.pull = 0;            // 0..1 charge
    this.charging = false;
    this.respawn = 0;
    this.drains = 0;          // balls lost this session
    this.tiltWarn = 0;
    this._q = new THREE.Quaternion();
    this._axis = new THREE.Vector3();
    this._pos = new THREE.Vector3();
  }

  // ------------------------------------------------------- lifecycle ----
  enter(dest) {
    if (this.active) return;
    this.active = true;
    this.table.build(this.world, dest);
    this.table.setVisible(true);
    this.root.visible = true;
    this.stall.setCounterMode('pinball');

    // Frame the whole tilted table without losing the town behind it.
    this.savedView = {
      az: this.view.want.az, el: this.view.want.el, dist: this.view.want.dist,
      target: this.view.wantTarget.clone(),
    };
    this.view.want.az = 0;
    this.view.want.el = 0.54;
    this.view.want.dist = 1.70;
    this.view.wantTarget.set(0, 1.00, -0.16);

    this.world.reset();
    this.balls.length = 0;
    this.drains = 0;
    this.spawnBall('veg2');
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    for (const b of [...this.balls]) this.despawn(b);
    this.world.reset();
    this.table.setVisible(false);
    this.root.visible = false;
    this.stall.setCounterMode('merge');
    if (this.savedView) {
      this.view.want.az = this.savedView.az;
      this.view.want.el = this.savedView.el;
      this.view.want.dist = this.savedView.dist;
      this.view.wantTarget.copy(this.savedView.target);
    }
  }

  // ------------------------------------------------------------ balls ----
  spawnBall(itemId, u = TABLE.laneCentre, v = TABLE.plungerRest + TABLE.ballR + 0.004) {
    const ball = new Ball({ u, v, r: TABLE.ballR, id: itemId });
    ball.data = { itemId, heat: 0 };
    ball.stuck = 0;
    ball.stuckTotal = 0;
    ball.stuckAt = { u, v };

    // Visual: the real ingredient model, scaled so its footprint is the ball,
    // pivoted at its centre so it can roll.
    const mesh = buildMesh(itemId);
    const s = TABLE.ballR / Math.max(mesh.userData.radius, 1e-4);
    mesh.scale.setScalar(s);
    const height = mesh.userData.height * s;
    mesh.position.y = -height / 2;
    const pivot = new THREE.Group();
    pivot.add(mesh);
    pivot.userData.lift = height / 2;
    this.table.group.add(pivot);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(TABLE.ballR * 3.2, TABLE.ballR * 3.2),
      new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.45,
        alphaMap: TEX.radialFalloff(2.1), depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    this.table.group.add(shadow);

    ball.pivot = pivot;
    ball.shadow = shadow;
    ball.spin = new THREE.Quaternion();
    this.world.addBall(ball);
    this.balls.push(ball);
    return ball;
  }

  despawn(ball) {
    this.world.removeBall(ball);
    const i = this.balls.indexOf(ball);
    if (i >= 0) this.balls.splice(i, 1);
    ball.pivot?.parent?.remove(ball.pivot);
    ball.shadow?.parent?.remove(ball.shadow);
    ball.shadow?.material.dispose();
  }

  _inLane(ball) {
    return ball.u > TABLE.laneU[0] && ball.v < TABLE.laneTop;
  }

  /**
   * The ball the plunger would launch: anything in the lane, lowest first.
   *
   * Deliberately not conditioned on the ball being still — while the plunger
   * is being drawn back the ball is falling after it, and requiring it to be
   * at rest meant a quick pull-and-release silently did nothing.
   */
  get waitingBall() {
    let best = null;
    for (const b of this.balls) {
      if (!b.alive || !this._inLane(b)) continue;
      if (!best || b.v < best.v) best = b;
    }
    return best;
  }

  // ----------------------------------------------------------- input ----
  setFlipper(side, pressed) {
    if (!this.active) return;
    for (const f of this.world.flippers) {
      if (f.side !== side) continue;
      if (pressed && !f.pressed) this.audio?.pickup();
      f.pressed = pressed;
    }
  }

  /** Begin/continue drawing the plunger back. `amount` is 0..1. */
  chargePlunger(amount) {
    if (!this.active) return;
    this.charging = true;
    this.pull = clamp(amount, 0, 1);
  }

  releasePlunger() {
    if (!this.active || !this.charging) return;
    const power = TABLE.launchMin + (TABLE.launchMax - TABLE.launchMin) * this.pull;
    const ball = this.waitingBall;
    this.charging = false;
    if (!ball) { this.pull = 0; return; }
    ball.vv = power;
    ball.vu = 0;
    this.pull = 0;
    this.audio?.produce();
    this.view.addShake(0.12 * this.pull + 0.08);
  }

  nudge(dir) {
    if (!this.active) return;
    this.world.applyNudge(dir * 0.16, 0.05);
    this.view.addShake(0.18);
    this.audio?.drop(3);
  }

  // ---------------------------------------------------------- update ----
  update(dt, t) {
    if (!this.active) return;

    // The plunger face is a real wall, so drawing it back drags the ball with it.
    const targetV = TABLE.plungerRest - this.pull * TABLE.plungerPull;
    this.plungerV = damp(this.plungerV, this.charging ? targetV : TABLE.plungerRest, 24, dt);
    const w = this.table.plungerWall;
    if (w) { w.y0 = this.plungerV; w.y1 = this.plungerV; }

    const events = this.world.step(dt);
    this._handleEvents(events);

    for (const ball of [...this.balls]) {
      if (!ball.alive) { this._onDrain(ball); continue; }
      this._syncBall(ball, dt);
      // Ball search. Real tables have one for the same reason: geometry always
      // finds a pocket you did not think of, and a stuck ball must never be
      // able to end the game. First a shake, then we concede the ball.
      if (this._inLane(ball)) {
        // Waiting at the plunger is not being stuck, it is being patient.
        ball.stuck = 0; ball.stuckTotal = 0; ball.stuckAt.u = ball.u; ball.stuckAt.v = ball.v;
      } else if (ball.speed < 0.035) {
        ball.stuck += dt; ball.stuckTotal += dt;
      } else {
        ball.stuck = 0;
        // Only a real journey clears the give-up timer — otherwise the shake
        // below would keep resetting it and the ball could jiggle for ever.
        if (Math.hypot(ball.u - ball.stuckAt.u, ball.v - ball.stuckAt.v) > 0.06) {
          ball.stuckTotal = 0;
          ball.stuckAt.u = ball.u; ball.stuckAt.v = ball.v;
        }
      }
      if (ball.stuckTotal > STUCK_GIVEUP) {
        ball.alive = false;            // conceded: never let a pocket end the game
      } else if (ball.stuck > STUCK_NUDGE) {
        this.world.applyNudge((ball.u > 0 ? -1 : 1) * 0.22, 0.16);
        this.view.addShake(0.12);
        ball.stuck = 0;                // the shake retries, the total does not reset
      }
    }

    if (this.respawn > 0) {
      this.respawn -= dt;
      if (this.respawn <= 0) this.spawnBall('veg2');
    }

    this.table.sync(this.plungerV);
  }

  _handleEvents(events) {
    for (const e of events) {
      if (e.type === 'hit' && e.impact > 0.5) {
        this.audio?.drop(1 + Math.min(3, e.impact));
        if (e.impact > 1.6) {
          this.fx.sparks(this.table.toWorld(e.u, e.v, 0.02), 0xffd9a0, 4, 0.2);
        }
      } else if (e.type === 'flipper' && e.impact > 0.4) {
        this.audio?.drop(2);
        this.view.addShake(Math.min(0.12, e.impact * 0.04));
      } else if (e.type === 'balls' && e.impact > 0.3) {
        this.audio?.pickup();
        this.fx.sparks(this.table.toWorld(e.u, e.v, 0.03), 0xffe0b0, 5, 0.25);
      }
    }
  }

  _onDrain(ball) {
    this.drains++;
    const at = this.table.toWorld(ball.u, 0.02, 0.02);
    this.fx.dust(at, 6, 0.05);
    this.audio?.deny();
    this.despawn(ball);
    if (this.balls.length === 0) this.respawn = 0.9;
  }

  _syncBall(ball, dt) {
    const lift = ball.pivot.userData.lift;
    ball.pivot.position.set(ball.u, lift, -ball.v);
    ball.shadow.position.set(ball.u, 0.0015, -ball.v);
    ball.shadow.material.opacity = 0.45;

    // Roll: spin about the axis perpendicular to travel, by distance / radius.
    const sp = ball.speed;
    if (sp > 0.005) {
      this._axis.set(-ball.vv / sp, 0, -ball.vu / sp);
      this._q.setFromAxisAngle(this._axis, (sp * dt) / ball.r);
      ball.spin.premultiply(this._q);
      ball.pivot.quaternion.copy(ball.spin);
    }
  }
}
