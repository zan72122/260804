// Pinball mode: lifecycle, the balls on the table, the plunger, and what
// happens when two ingredients meet.
//
// Up to six ingredients are loose on the playfield at once, fed in one at a
// time through the shooter lane. Everything they can become, they become by
// hitting each other — see recipes.js for the rules; this file is where the
// collision turns into a new ball, a mess on the table and a noise.

import * as THREE from 'three';
import * as TEX from '../engine/textures.js';
import * as M from '../engine/materials.js';
import { PinballWorld, Ball } from './physics.js';
import { Table, TABLE } from './table.js';
import { buildMesh, ITEMS } from '../game/items.js';
import { resolve, pairable, LOADABLE, GENTLE, HARD } from './recipes.js';
import { clamp, damp, easeOutBack } from '../engine/util.js';

const STUCK_NUDGE = 2.5;    // seconds before the table shakes itself
const STUCK_GIVEUP = 9.0;   // …and before the ball is written off
const MAX_BALLS = 5;
const COOL = 0.22;          // grace after a transform, so results do not chain instantly

/**
 * A shift is three balls, as on any real table — three *losses*, not three
 * loads. Feeding the lane stays free, because the chain needs pairs: a pizza
 * takes two tomatoes crushed to sauce and two loaves rolled flat, so a limit
 * of three loads would put every headline dish out of reach. Counting drains
 * instead makes the flippers the thing that buys you the next dish.
 */
const SHIFT_BALLS = 3;

// Score → wages. A counter order pays about 26 coins and 6 XP, so a working
// shift on the table is worth a handful of orders, not a windfall.
const COIN_PER = 120;
const XP_PER = 600;

const HEAT_DECAY = 0.045;   // per second — a ball off the fire cools slowly
const HEAT = { bumper: 0.20, pot: 0.55, bank: 0.35, spinner: 0.05 };
const SCORE = { bumper: 120, sling: 40, target: 350, bank: 2500, spinner: 90, pot: 800, dish: 5000 };
const POT_COOK = 1.1;       // seconds the stew pot holds a ball

// A nudge has to be worth something — it is the only answer to the outlane —
// so it moves the ball a real distance. Which means it also has to cost
// something, or the outlanes stop mattering again: lean on the table three
// times in quick succession and it tilts, killing the flippers until the ball
// is gone. The count bleeds off, so spacing your nudges out is the skill.
const NUDGE = 0.30;
const TILT_LIMIT = 3;
const TILT_DECAY = 0.55;    // warnings per second

/** Splash colour per ingredient, for the mess left on the playfield. */
const SPLAT = {
  veg2: 0xa8281c, bread2: 0xe8d6ae, sea2: 0xbcd0d8, drink1: 0xe9c62f,
  x_sauce: 0x8c1f16, x_flat: 0xe8d6ae, x_mince: 0xe8c3b4, x_juice: 0xf2c62e,
};

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
    this.drains = 0;          // balls lost this session
    this.made = [];           // ids produced on the table this session
    this.delivered = [];      // dishes sent up the chute
    this.score = 0;
    this.bankResetIn = 0;
    this.tiltWarn = 0;
    this.tilted = false;
    this.ballsLeft = SHIFT_BALLS;
    this.shiftOver = true;
    // 0 = flat counter, 1 = fully raised table. Driven every frame, including
    // after exit(), so the table folds back down instead of blinking away.
    this.fold = 0;
    this.foldWant = 0;
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
    this.foldWant = 1;

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
    this.made.length = 0;
    this.delivered.length = 0;
    this.score = 0;
    this.bankResetIn = 0;
    this.ballsLeft = SHIFT_BALLS;
    this.shiftOver = false;
    this.tiltWarn = 0;
    this.tilted = false;
    this.table.clearStains();
    this.table.resetTargets();
    this.loadBall(LOADABLE[0]);
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    for (const b of [...this.balls]) this.despawn(b);
    this.world.reset();
    this.root.visible = false;
    // The table is left visible and folds back down under updateFold(); the
    // counter's own dressing comes straight back so the board is usable now.
    this.foldWant = 0;
    if (this.savedView) {
      this.view.want.az = this.savedView.az;
      this.view.want.el = this.savedView.el;
      this.view.want.dist = this.savedView.dist;
      this.view.wantTarget.copy(this.savedView.target);
    }
  }

  /**
   * The counter folding up into a table, and back down again.
   *
   * Runs every frame whether or not the mode is active — on the way out the
   * mode goes inactive immediately (the board has to be usable at once) while
   * the table is still standing, and this is what lays it down.
   */
  updateFold(dt) {
    const to = this.foldWant;
    this.fold = damp(this.fold, to, 10, dt);
    if (to > 0.5 && this.fold > 0.999) this.fold = 1;
    if (to < 0.5 && this.fold < 0.002) {
      this.fold = 0;
      this.table.setVisible(false);
    }
    this.table.setRaise(this.fold);
    this.stall.setCounterFold(this.fold);
  }

  /**
   * Wages for the shift just finished. Fires onShiftEnd exactly once, and
   * `reason` is what separates running out of balls from walking away — the
   * caller settles up either way, but only one of them earns a results screen.
   */
  _endShift(reason) {
    if (this.shiftOver) return null;
    this.shiftOver = true;
    const summary = {
      reason,
      score: this.score,
      coins: Math.round(this.score / COIN_PER),
      xp: Math.round(this.score / XP_PER),
      delivered: this.delivered.map((d) => ({ ...d })),
      made: [...this.made],
      drains: this.drains,
    };
    if (reason === 'drained') this.audio?.levelup();
    this.onShiftEnd?.(summary);
    return summary;
  }

  /** End early — the player walked away from the table mid-shift. */
  endShiftNow() { return this._endShift('left'); }

  // ------------------------------------------------------------ balls ----
  spawnBall(itemId, u = TABLE.laneCentre, v = TABLE.plungerRest + TABLE.ballR + 0.004) {
    const ball = new Ball({ u, v, r: TABLE.ballR, id: itemId });
    ball.data = { itemId, heat: 0 };
    ball.stuck = 0;
    ball.stuckTotal = 0;
    ball.stuckAt = { u, v };
    ball.cool = 0;

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

    // Every ball carries a halo: it shows heat as the ball takes it on, and a
    // finished dish keeps a standing glow so it is obvious on a busy table
    // which ball is the one you have been working towards.
    const isDish = ITEMS[itemId]?.kind === 'dish';
    // The library material is shared, so each ball gets its own copy: opacity
    // and scale here track that one ball's heat.
    const halo = new THREE.Sprite(M.halo(isDish ? 0xffd9a0 : 0xff9a3c, 0.8).clone());
    halo.scale.setScalar(0.12);
    halo.material.opacity = isDish ? 0.5 : 0;
    this.table.group.add(halo);
    ball.halo = halo;
    ball.haloBase = isDish ? 0.5 : 0;
    ball.heat = 0;

    ball.pivot = pivot;
    ball.shadow = shadow;
    ball.spin = new THREE.Quaternion();
    ball.popIn = 0;
    ball.inSpinner = false;
    ball.chuteCool = 0;
    ball.potCook = 0;
    ball.potCool = 0;
    ball.steamIn = 0;
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
    ball.halo?.parent?.remove(ball.halo);
    ball.halo?.material?.dispose?.();
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

  /**
   * Feed an ingredient into the launch lane. Refused if the lane is still
   * occupied or the table is already busy — the lane holds one ball, like a
   * real shooter lane.
   */
  loadBall(itemId) {
    if (!this.active) return 'inactive';
    if (!ITEMS[itemId]) return 'unknown';
    if (this.shiftOver || this.ballsLeft <= 0) return 'over';
    if (this.balls.length >= MAX_BALLS) return 'full';
    if (this.waitingBall) return 'occupied';
    this.spawnBall(itemId);
    this.audio?.pickup();
    return 'ok';
  }

  // ----------------------------------------------------------- input ----
  setFlipper(side, pressed) {
    if (!this.active || this.tilted) return;
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
    if (!this.active || this.tilted) return;
    this.world.applyNudge(dir * NUDGE, 0.08);
    this.view.addShake(0.18);
    this.audio?.drop(3);
    this.tiltWarn += 1;
    if (this.tiltWarn >= TILT_LIMIT) {
      this.tilted = true;
      for (const f of this.world.flippers) f.pressed = false;
      this.audio?.deny();
      this.view.addShake(0.5);
      this.onTilt?.(true);
    } else {
      this.onTilt?.(false);
    }
  }

  // ---------------------------------------------------------- update ----
  update(dt, t) {
    if (!this.active) return;

    // The plunger face is a real wall, so drawing it back drags the ball with it.
    const targetV = TABLE.plungerRest - this.pull * TABLE.plungerPull;
    this.plungerV = damp(this.plungerV, this.charging ? targetV : TABLE.plungerRest, 24, dt);
    const w = this.table.plungerWall;
    if (w) { w.y0 = this.plungerV; w.y1 = this.plungerV; }

    if (this.tiltWarn > 0) this.tiltWarn = Math.max(0, this.tiltWarn - TILT_DECAY * dt);

    const events = this.world.step(dt);
    this._handleEvents(events);

    for (const ball of [...this.balls]) {
      if (!ball.alive) { this._onDrain(ball); continue; }
      if (ball.cool > 0) ball.cool -= dt;
      if (ball.chuteCool > 0) ball.chuteCool -= dt;
      if (ball.potCool > 0) ball.potCool -= dt;
      // Leaving the spinner region re-arms it.
      if (ball.inSpinner) {
        const sp = this.table.spinnerAt;
        if (!sp || Math.hypot(ball.u - sp.u, ball.v - sp.v) > sp.r * 1.25) ball.inSpinner = false;
      }
      if (ball.potCook > 0) {
        ball.potCook -= dt;
        if (ball.potCook <= 0) {
          // Out of the pot, hot, and heading back down the table.
          ball.held = false;
          ball.potCool = 0.9;
          ball.heat = Math.min(1, ball.heat + HEAT.pot);
          ball.vu = -0.9; ball.vv = -0.6;
          this.audio?.splat();
          this.fx.steam(this.table.toWorld(ball.u, ball.v, 0.07));
        }
      }
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

    // The shift is over once the last ball is spent and the table has cleared
    // — by draining or by going up the chute, which is why this is checked
    // here rather than inside _onDrain.
    if (!this.shiftOver && this.ballsLeft <= 0 && this.balls.length === 0) this._endShift('drained');

    if (this.bankResetIn > 0) {
      this.bankResetIn -= dt;
      if (this.bankResetIn <= 0) this.table.resetTargets();
    }

    this.table.sync(this.plungerV);
    this.table.update(dt);
  }

  _handleEvents(events) {
    for (const e of events) {
      if (e.type === 'hit' && (e.tag === 'bumper' || e.tag === 'sling' || e.tag === 'target')) {
        this._onFurniture(e);
      } else if (e.type === 'sensor') {
        this._onSensor(e);
      } else if (e.type === 'hit' && e.impact > 0.5) {
        this.audio?.drop(1 + Math.min(3, e.impact));
        if (e.impact > 1.6) {
          this.fx.sparks(this.table.toWorld(e.u, e.v, 0.02), 0xffd9a0, 4, 0.2);
        }
      } else if (e.type === 'flipper' && e.impact > 0.4) {
        this.audio?.drop(2);
        this.view.addShake(Math.min(0.12, e.impact * 0.04));
      } else if (e.type === 'balls') {
        this._onBallHit(e);
      }
    }
  }

  /** Bumpers, slingshots and the jar bank. */
  _onFurniture(e) {
    const at = this.table.toWorld(e.u, e.v, 0.04);
    if (e.tag === 'bumper') {
      this.table.hitBumper(e.target);
      e.ball.heat = Math.min(1, e.ball.heat + HEAT.bumper);
      this.score += SCORE.bumper;
      this.fx.sparks(at, 0xffb04a, 7, 0.35);
      this.view.addShake(0.07);
      this.audio?.drop(1);
    } else if (e.tag === 'sling') {
      if (e.impact < 0.25) return;
      this.score += SCORE.sling;
      this.fx.sparks(at, 0xffd9a0, 4, 0.25);
      this.audio?.pickup();
    } else if (e.tag === 'target') {
      if (!e.target.enabled) return;
      const cleared = this.table.dropTarget(e.target);
      this.score += SCORE.target;
      this.fx.sparks(at, 0xdfe8dd, 9, 0.4);
      this.audio?.drop(2);
      if (cleared) this._onBankCleared();
    }
  }

  /** The jar bank is down: the oven roars and everything on the table heats. */
  _onBankCleared() {
    this.score += SCORE.bank;
    this.bankResetIn = 2.2;
    for (const b of this.balls) b.heat = Math.min(1, b.heat + HEAT.bank);
    this.view.addShake(0.4);
    this.audio?.levelup();
    this.onEvent?.({ kind: 'bank', score: SCORE.bank });
  }

  /** Spinner, stew pot and the delivery chute. */
  _onSensor(e) {
    const ball = e.ball;
    if (e.tag === 'spinner') {
      if (ball.inSpinner || ball.speed < 0.35) return;
      ball.inSpinner = true;
      ball.heat = Math.min(1, ball.heat + HEAT.spinner);
      this.score += Math.round(SCORE.spinner * Math.min(2, ball.speed));
      this.table.spinWhisk(ball.speed * 6);
      this.audio?.pickup();
    } else if (e.tag === 'pot') {
      // potCool is what stops the pot swallowing the ball again on the very
      // frame it spits it out — the ball leaves through the same mouth it
      // came in by, and the sensor is still around it for a moment.
      if (ball.held || ball.potCook > 0 || ball.potCool > 0) return;
      // Swallowed: the pot holds it, cooks it, and spits it back down-table.
      ball.held = true;
      ball.potCook = POT_COOK;
      ball.u = e.u; ball.v = e.v; ball.vu = 0; ball.vv = 0;
      this.score += SCORE.pot;
      this.audio?.produce();
      this.fx.steam(this.table.toWorld(e.u, e.v, 0.06));
    } else if (e.tag === 'chute') {
      if (ball.chuteCool > 0) return;
      this._onChute(ball, e);
    }
  }

  /** A ball reached the delivery chute at the top of the table. */
  _onChute(ball, e) {
    const def = ITEMS[ball.id];
    const at = this.table.toWorld(e.u, e.v, 0.05);
    if (def?.kind !== 'dish') {
      // Not a finished dish: the chute rejects it back down the table.
      ball.chuteCool = 1.0;
      ball.vv = -1.2;
      ball.vu = (Math.random() - 0.5) * 0.6;
      this.audio?.deny();
      this.fx.dust(at, 4, 0.04);
      return;
    }
    const quality = 1 + ball.heat;          // hot out of the oven is worth more
    const score = Math.round(SCORE.dish * quality);
    this.score += score;
    this.delivered.push({ id: ball.id, heat: ball.heat, score });
    this.fx.flash(at, 0xffe0a0, 0.34);
    this.fx.sparks(at, 0xffd070, 26, 0.8);
    this.fx.steam(at);
    this.view.addShake(0.35);
    this.audio?.coin(5);
    this.audio?.merge(5);
    this.despawn(ball);
    this.onDeliver?.({ id: ball.id, def, heat: ball.heat, quality, score });
  }

  /**
   * Two ingredients met. How hard decides what comes out — a gentle kiss
   * merges them up a tier, a real collision bursts them into something
   * processed, and a processed pair meeting at any sane speed is a dish.
   */
  _onBallHit(e) {
    const { a, b, impact } = e;
    if (!a.alive || !b.alive || a.cool > 0 || b.cool > 0) return;
    const { kind, result } = resolve(a.id, b.id, impact);

    if (kind === 'bounce') {
      // Tell the player when a pair *could* work but the speed was wrong:
      // a small spark is a hint, not a reward.
      if (pairable(a.id, b.id) && impact > 0.2) {
        this.fx.sparks(this.table.toWorld(e.u, e.v, 0.03), 0xbfa87a, 3, 0.16);
        this.audio?.pickup();
      }
      return;
    }

    const at = this.table.toWorld(e.u, e.v, 0.03);
    // Perfectly inelastic: the pair's momentum carries into what they became.
    const vu = (a.vu + b.vu) / 2, vv = (a.vv + b.vv) / 2;
    const u = (a.u + b.u) / 2, v = (a.v + b.v) / 2;
    const wasId = a.id;
    this.despawn(a);
    this.despawn(b);

    const nb = this.spawnBall(result, u, v);
    nb.vu = vu; nb.vv = vv;
    nb.cool = COOL;
    nb.pivot.scale.setScalar(0.01);
    nb.popIn = 0.28;
    this.made.push(result);

    const def = ITEMS[result];
    if (kind === 'crush') {
      // Violent: mess on the table, a shove outward, and a real thump.
      const col = SPLAT[wasId] ?? 0xb08050;
      this.table.addStain(u, v, col, 0.06 + Math.min(0.05, impact * 0.02));
      this.fx.sparks(at, col, 16, 0.5);
      this.fx.dust(at, 5, 0.05);
      this.view.addShake(0.22);
      this.audio?.splat();
      nb.vu += (Math.random() - 0.5) * 0.5;
      nb.vv += 0.2;
    } else if (kind === 'dish') {
      this.fx.flash(at, 0xffe0a0, 0.22);
      this.fx.sparks(at, 0xffd070, 20, 0.6);
      this.fx.steam(at);
      this.view.addShake(0.26);
      this.audio?.merge(5);
      this.audio?.coin(3);
    } else {
      this.fx.flash(at, 0xffd9a0, 0.14);
      this.fx.sparks(at, 0xffc46a, 8 + (def?.tier ?? 2) * 3, 0.35);
      this.view.addShake(0.1);
      this.audio?.merge(def?.tier ?? 2);
    }
    this.onMake?.({ kind, result, def, impact });
  }

  _onDrain(ball) {
    this.drains++;
    this.ballsLeft = Math.max(0, this.ballsLeft - 1);
    const at = this.table.toWorld(ball.u, 0.02, 0.02);
    this.fx.dust(at, 6, 0.05);
    this.audio?.deny();
    this.despawn(ball);
    // A tilt is served on the ball that earned it: once the table is clear the
    // flippers come back.
    if (this.tilted && this.balls.length === 0) {
      this.tilted = false;
      this.tiltWarn = 0;
      this.onTilt?.(false);
    }
    this.onBallLost?.(this.ballsLeft);
  }

  _syncBall(ball, dt) {
    // Freshly made things pop into existence rather than appearing.
    if (ball.popIn > 0) {
      ball.popIn -= dt;
      const k = clamp(1 - ball.popIn / 0.28, 0, 1);
      ball.pivot.scale.setScalar(0.2 + easeOutBack(k) * 0.8);
    }
    const lift = ball.pivot.userData.lift;
    ball.pivot.position.set(ball.u, lift, -ball.v);
    ball.shadow.position.set(ball.u, 0.0015, -ball.v);
    ball.shadow.material.opacity = 0.45;

    // Heat bleeds away slowly, and shows as a glow that grows with it.
    ball.heat = Math.max(0, ball.heat - HEAT_DECAY * dt);
    if (ball.halo) {
      ball.halo.position.set(ball.u, lift, -ball.v);
      ball.halo.material.opacity = Math.max(ball.haloBase, ball.heat * 0.85);
      ball.halo.scale.setScalar(0.12 + ball.heat * 0.09);
    }
    // Something properly hot steams as it goes.
    if (ball.heat > 0.55) {
      ball.steamIn = (ball.steamIn ?? 0) - dt;
      if (ball.steamIn <= 0) {
        ball.steamIn = 0.65;
        this.fx.steam(this.table.toWorld(ball.u, ball.v, lift + 0.02));
      }
    }

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
