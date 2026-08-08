import * as THREE from 'three';
import { createWorld, groundHeight } from './world.js';
import { createFalconer, POSES } from './falconer.js';
import { createHawk } from './hawk.js';
import { createLure } from './lure.js';
import { createInput, createCircleDriver } from './input.js';
import { createHints } from './hints.js';
import { createAudio } from './audio.js';
import * as TX from './textures.js';
import {
  clamp,
  lerp,
  damp,
  approach,
  dampAngle,
  ease,
  orientAlong,
  featherGeometry,
  Timeline,
  TAU,
} from './util.js';

/*
 * The whole game is one loop of falconry, and the loop is a chain of body
 * actions rather than a chain of menus:
 *
 *   glove on -> arm level -> hawk steps to the fist -> unclip -> cast off ->
 *   the hawk climbs and circles -> the lure swings -> the hawk turns to it ->
 *   the arm goes level again -> the hawk comes home and lands on the fist.
 *
 * Nothing here scores, times, or fails. The two moments the whole thing is
 * built around are the shove of the cast and the growth of a far-off silhouette
 * into a bird standing on your hand.
 */

const FALCONER_POS = new THREE.Vector3(0.55, 0, 0.1);

export function createGame({ scene, camera, renderer, dom, hintLayer, quality }) {
  const world = createWorld(scene, { quality });
  const audio = createAudio();
  const hints = createHints(hintLayer);
  const input = createInput(dom);
  const circle = createCircleDriver();

  /* ---------- actors ---------- */

  const falconer = createFalconer();
  falconer.root.position.copy(FALCONER_POS);
  falconer.root.position.y = groundHeight(FALCONER_POS.x, FALCONER_POS.z);
  falconer.root.rotation.y = 0.34;
  scene.add(falconer.root);

  const hawk = createHawk();
  scene.add(hawk.root);

  const lure = createLure();
  scene.add(lure.group);
  scene.add(lure.cordGroup);
  lure.group.visible = false;
  lure.cordGroup.visible = false;

  // The gauntlet starts off the hand, waiting on the grass by the perch.
  const gloveRest = new THREE.Vector3(-0.5, 0, 1.05);
  gloveRest.y = groundHeight(gloveRest.x, gloveRest.z) + 0.1;
  falconer.detachGlove(scene, gloveRest);

  // A little wooden block for the glove to sit on, so it doesn't look dropped.
  {
    const block = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.22, 0.12, 16),
      new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9 }),
    );
    block.position.set(gloveRest.x, groundHeight(gloveRest.x, gloveRest.z) + 0.03, gloveRest.z);
    block.castShadow = true;
    block.receiveShadow = true;
    scene.add(block);
  }

  /* ---------- leash between hawk and fist ---------- */

  const leashMat = new THREE.MeshStandardMaterial({ color: 0x76472a, roughness: 0.8 });
  const leash = new THREE.Mesh(new THREE.BufferGeometry(), leashMat);
  leash.frustumCulled = false;
  leash.visible = false;
  scene.add(leash);

  function updateLeash(a, b) {
    const mid = a.clone().lerp(b, 0.5);
    mid.y -= 0.07;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    leash.geometry.dispose();
    leash.geometry = new THREE.TubeGeometry(curve, 8, 0.0085, 5, false);
  }

  /* ---------- drifting feathers, shed on the hard beats ---------- */

  const feathers = [];
  {
    const geo = featherGeometry(0.1, 0.03, { camber: 0.25, cup: 0.4, root: 0.45 });
    const mat = new THREE.MeshStandardMaterial({
      map: TX.featherVane(0xc9b190, 0x6a563e, 0xf2e8d5, false).map,
      roughness: 0.7,
      side: THREE.DoubleSide,
      transparent: true,
    });
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(geo, mat.clone());
      m.visible = false;
      scene.add(m);
      feathers.push({ mesh: m, life: 0, vel: new THREE.Vector3(), spin: 0 });
    }
  }

  function shedFeathers(pos, n, power = 1) {
    let spawned = 0;
    for (const f of feathers) {
      if (spawned >= n) break;
      if (f.life > 0) continue;
      f.life = 2.6 + Math.random() * 1.6;
      f.maxLife = f.life;
      f.mesh.visible = true;
      f.mesh.position.copy(pos).add(
        new THREE.Vector3((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.25),
      );
      f.vel.set(
        (Math.random() - 0.5) * 1.4 * power,
        0.4 + Math.random() * 0.7,
        (Math.random() - 0.5) * 1.4 * power,
      );
      f.spin = (Math.random() - 0.5) * 4;
      f.mesh.rotation.set(Math.random() * TAU, Math.random() * TAU, Math.random() * TAU);
      spawned++;
    }
  }

  function updateFeathers(dt) {
    for (const f of feathers) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) {
        f.mesh.visible = false;
        continue;
      }
      // Feathers do not fall, they seesaw down through the air.
      f.vel.y = damp(f.vel.y, -0.32, 1.4, dt);
      f.vel.x += Math.sin(f.life * 3.1) * dt * 0.5;
      f.vel.z += Math.cos(f.life * 2.7) * dt * 0.5;
      f.vel.multiplyScalar(1 - dt * 0.8);
      f.mesh.position.addScaledVector(f.vel, dt);
      f.mesh.rotation.z += f.spin * dt;
      f.mesh.rotation.x += f.spin * 0.6 * dt;
      const g = groundHeight(f.mesh.position.x, f.mesh.position.z);
      if (f.mesh.position.y < g + 0.02) {
        f.mesh.position.y = g + 0.02;
        f.vel.set(0, 0, 0);
      }
      f.mesh.material.opacity = clamp(f.life / 0.8, 0, 1);
    }
  }

  /* ---------- flight ---------- */

  const flight = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(0, 0, 1),
    bank: 0,
    flapPhase: 0,
    flapAmt: 0,
    spread: 0,
    cup: 0,
    tail: 0,
    legs: 0,
    orbitAngle: 0,
    orbitR: 11,
    orbitH: 9.5,
    orbitCenter: new THREE.Vector3(-1.5, 9.5, -5),
    orbitOmega: 0.42,
  };

  const _aim = new THREE.Vector3();
  const _desired = new THREE.Vector3();
  const _fwd = new THREE.Vector3(0, 0, 1);
  const _tmp = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  // The lure block runs before the state machine and would otherwise fight it
  // over the shared scratch vector.
  const _camRight = new THREE.Vector3();
  const _lureCenter = new THREE.Vector3();
  const _perch = new THREE.Vector3();

  /** Steer toward `aim` with a spring on velocity; returns the turn rate. */
  function steer(aim, maxSpeed, accel, dt) {
    _desired.copy(aim).sub(flight.pos);
    const d = _desired.length();
    if (d < 1e-4) return 0;
    _desired.multiplyScalar(maxSpeed / d);
    const before = _tmp.copy(flight.vel);
    flight.vel.lerp(_desired, approach(accel, dt));
    flight.pos.addScaledVector(flight.vel, dt);
    // Signed lateral change, used for bank.
    const turn = before.clone().normalize().cross(flight.vel.clone().normalize()).y;
    return turn / Math.max(dt, 1e-3);
  }

  /** Point the bird where it is going, banking into its turns. */
  function orientFlight(turnRate, dt, extraPitch = 0) {
    _fwd.copy(flight.vel);
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, 1);
    _fwd.normalize();
    const wantBank = clamp(-turnRate * 0.55, -1.15, 1.15);
    flight.bank = damp(flight.bank, wantBank, 5, dt);
    orientAlong(hawk.root, _fwd, _up, flight.bank);
    if (extraPitch) hawk.root.rotateX(extraPitch);
  }

  /** Wing cycle. `effort` 0..1 sets beat rate and depth; 0 means pure glide. */
  function beatWings(dt, effort, rate = 3.4) {
    flight.flapAmt = damp(flight.flapAmt, effort, 4, dt);
    flight.flapPhase += dt * rate * lerp(0.55, 1.25, effort);
    const raw = Math.sin(flight.flapPhase);
    // Real wingbeats are not sinusoidal: the downstroke is quick and deep, the
    // recovery slower and shallower.
    const shaped = raw > 0 ? Math.pow(raw, 0.7) * 0.75 : -Math.pow(-raw, 1.5);
    return shaped * flight.flapAmt;
  }

  /* ---------- camera ---------- */

  /*
   * Two camera modes.
   *
   * Framed shots put the camera at whatever distance fits `fitH` of world
   * height (and at least `minW` of width) around `look` — right for anything
   * happening on or near the fist.
   *
   * Anchored shots pin the camera to a spot and simply aim it. That is the only
   * thing that works for a bird circling on an eleven-metre radius: try to fit
   * the hawk and the falconer into one frame and the shot swings across half
   * the field and ends up pointing at empty grass. Standing still and turning
   * your head is what a person watching a hawk actually does.
   */
  const shot = {
    look: new THREE.Vector3(0, 1.3, 0),
    anchor: new THREE.Vector3(0, 2, 6),
    yaw: 0.3,
    pitch: 0.14,
    fitH: 1.2,
    minW: 1.05,
    anchored: 0,
    fov: 0,
  };
  const shotTarget = {
    look: new THREE.Vector3(0, 1.3, 0),
    anchor: new THREE.Vector3(0, 2, 6),
    yaw: 0.3,
    pitch: 0.14,
    fitH: 1.2,
    minW: 1.05,
    anchored: 0,
    fov: 0,
  };
  let camRate = 2.2;
  let shakeAmt = 0;
  const _camPos = new THREE.Vector3();

  function setShot(o, rate = 2.2) {
    if (o.look) shotTarget.look.copy(o.look);
    if (o.anchor) shotTarget.anchor.copy(o.anchor);
    shotTarget.anchored = o.anchor ? 1 : 0;
    for (const k of ['yaw', 'pitch', 'fitH', 'minW']) {
      if (o[k] !== undefined) shotTarget[k] = o[k];
    }
    shotTarget.fov = o.fov || 0;
    camRate = rate;
  }

  function updateCamera(dt) {
    // Inspection hook for the playtest harness: pin the camera anywhere.
    if (window.__freeCam) {
      const f = window.__freeCam;
      camera.position.set(f.pos[0], f.pos[1], f.pos[2]);
      camera.lookAt(f.look[0], f.look[1], f.look[2]);
      camera.fov = f.fov || 40;
      camera.updateProjectionMatrix();
      return;
    }
    shot.look.lerp(shotTarget.look, approach(camRate, dt));
    shot.anchor.lerp(shotTarget.anchor, approach(camRate, dt));
    shot.yaw = damp(shot.yaw, shotTarget.yaw, camRate, dt);
    shot.pitch = damp(shot.pitch, shotTarget.pitch, camRate, dt);
    shot.fitH = damp(shot.fitH, shotTarget.fitH, camRate, dt);
    shot.minW = damp(shot.minW, shotTarget.minW, camRate, dt);
    shot.anchored = damp(shot.anchored, shotTarget.anchored, camRate, dt);
    shot.fov = damp(shot.fov, shotTarget.fov, camRate, dt);

    const aspect = camera.aspect;
    // Narrow screens get a wider lens so the diorama does not shrink away.
    const wideFov = lerp(47, 39, clamp((aspect - 0.5) / 1.3, 0, 1));
    // A shot may ask for a longer lens; blend in as the shot itself blends.
    camera.fov = shot.fov > 1 ? lerp(wideFov, shot.fov, clamp(shot.anchored, 0, 1)) : wideFov;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    // Fit the vertical extent always, and guarantee a minimum width — in
    // portrait the sides crop rather than pushing the camera into the next county.
    const dist = Math.max(shot.fitH / tan, shot.minW / (tan * aspect));

    _camPos.set(
      Math.sin(shot.yaw) * Math.cos(shot.pitch),
      Math.sin(shot.pitch),
      Math.cos(shot.yaw) * Math.cos(shot.pitch),
    );
    _camPos.multiplyScalar(dist).add(shot.look);
    // Cross-fade to the anchored position so switching modes is a move, not a cut.
    if (shot.anchored > 0.001) _camPos.lerp(shot.anchor, shot.anchored);
    // Never let the lens dip below the turf.
    _camPos.y = Math.max(_camPos.y, groundHeight(_camPos.x, _camPos.z) + 0.55);
    camera.position.copy(_camPos);
    camera.lookAt(shot.look);

    if (shakeAmt > 0.001) {
      const s = shakeAmt;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.rotateZ((Math.random() - 0.5) * s * 0.1);
      shakeAmt *= Math.exp(-dt * 5.5);
    }
    camera.updateProjectionMatrix();
  }

  /* ---------- helpers ---------- */

  const _proj = new THREE.Vector3();
  function toScreen(v) {
    _proj.copy(v).project(camera);
    return {
      x: (_proj.x * 0.5 + 0.5) * dom.clientWidth,
      y: (-_proj.y * 0.5 + 0.5) * dom.clientHeight,
    };
  }

  const fistPos = new THREE.Vector3();
  const fistQuat = new THREE.Quaternion();
  const lurePos = new THREE.Vector3();
  const lurePrev = new THREE.Vector3();
  const lureVel = new THREE.Vector3();
  const handPos = new THREE.Vector3();

  /* ---------- state machine ---------- */

  let state = 'glove';
  let stateT = 0;
  let tl = null;
  let idle = 0; // seconds since the player last did anything
  let lurePasses = 0;
  let recallArmed = false;
  let armDip = 0; // the fist giving under the hawk's weight
  let armDipVel = 0;
  const headLook = new THREE.Vector3();

  function go(next) {
    state = next;
    stateT = 0;
    tl = null;
    hints.hide();
    idle = 0;
  }

  /* ---- 1. put the glove on ---- */

  function beginDon() {
    audio.resume();
    audio.click();
    go('donning');
    const t = new Timeline();
    falconer.setPose(POSES.takeGlove, 4.5);
    t.at(0.75, () => {
      falconer.gloveToHand(falconer.armR.bare);
      audio.click();
    });
    t.at(0.85, () => falconer.setPose(POSES.donGlove, 4.2));
    t.at(1.85, () => {
      falconer.wearGlove();
      audio.click();
    });
    // Two firm tugs to seat the cuff — the bit of business that says "leather".
    t.at(2.0, () => (falconer.setPose(POSES.donGlove, 9), audio.click()));
    t.at(2.6, () => falconer.setPose(POSES.offer, 3.0));
    t.at(3.9, () => beginStepUp());
    t.hold(4.0);
    tl = t;
  }

  /* ---- 2. arm goes level, the hawk steps across to the fist ---- */

  function beginStepUp() {
    go('stepUp');
    falconer.setPose(POSES.offer, 3.0);
    flight.pos.copy(world.perchPoint);
    flight.vel.set(0, 0, 0.2);
    const t = new Timeline();
    t.at(0.55, () => {
      audio.bell(2);
      audio.flap(0.7);
    });
    t.at(1.9, () => {
      audio.flap(0.5);
      audio.bell(3);
      leash.visible = true;
      go('tethered');
    });
    t.hold(2.0);
    tl = t;
  }

  /* ---- 3. unclip the leash ---- */

  function beginUnclip() {
    audio.resume();
    go('unclipping');
    const t = new Timeline();
    falconer.setPose(POSES.unclip, 5);
    t.at(0.72, () => {
      audio.click();
      leash.visible = false;
      audio.bell(2);
    });
    t.at(1.25, () => falconer.setPose(POSES.offer, 4));
    t.at(1.9, () => go('ready'));
    t.hold(2.0);
    tl = t;
  }

  /* ---- 4. the cast ---- */

  function beginCast() {
    audio.resume();
    go('casting');
    const t = new Timeline();
    falconer.setPose(POSES.castLoad, 9);
    t.at(0.34, () => falconer.setPose(POSES.cast, 16));
    t.at(0.46, () => {
      // The bird leaves the fist. This is the first of the two payoff moments,
      // so everything fires at once: hard beat, downdraft through the grass,
      // shed feathers, a camera kick.
      falconer.fistPoint(flight.pos);
      flight.pos.y += 0.04;
      flight.vel.set(0, 2.4, 0);
      const away = new THREE.Vector3(-0.55, 0, 0.55).normalize();
      flight.vel.addScaledVector(away, 4.2);
      flight.spread = 1;
      flight.flapAmt = 1;
      flight.flapPhase = Math.PI * 0.5;
      flight.legs = 0.35;
      audio.cast();
      shakeAmt = 0.16;
      shedFeathers(flight.pos, 5, 1.4);
      world.gust(flight.pos, 0.85);
      go('launch');
    });
    t.hold(0.62);
    tl = t;
  }

  /* ---- 5/6. climb out and circle ---- */

  function beginSoar() {
    go('soar');
    falconer.setPose(POSES.watch, 2.2);
    flight.orbitCenter.set(-2.0, 0, -6.0);
    flight.orbitR = 9.0;
    flight.orbitH = 7.6;
    flight.orbitOmega = 0.46;
    // Start the orbit phase from where the bird actually is, so it slots into
    // the circle instead of snapping across the sky.
    flight.orbitAngle = Math.atan2(
      flight.pos.z - flight.orbitCenter.z,
      flight.pos.x - flight.orbitCenter.x,
    );
  }

  function beginLure() {
    go('lure');
    lurePasses = 0;
    recallArmed = false;
    falconer.setPose(POSES.lure, 2.4);
    lure.group.visible = true;
    lure.cordGroup.visible = true;
    audio.call();
  }

  /* ---- 7. the hawk comes home ---- */

  const homePath = { p0: new THREE.Vector3(), p1: new THREE.Vector3(), p2: new THREE.Vector3(), p3: new THREE.Vector3() };
  const _bez = new THREE.Vector3();
  function bezier(t, out) {
    const u = 1 - t;
    out.set(0, 0, 0);
    out.addScaledVector(homePath.p0, u * u * u);
    out.addScaledVector(homePath.p1, 3 * u * u * t);
    out.addScaledVector(homePath.p2, 3 * u * t * t);
    out.addScaledVector(homePath.p3, t * t * t);
    return out;
  }

  function beginRecall() {
    go('recall');
    recallArmed = false;
    falconer.setPose(POSES.offer, 2.6);
    lure.group.visible = false;
    lure.cordGroup.visible = false;
    audio.call();

    // The approach is laid out along the camera's own sight line so the hawk
    // starts as a speck and grows all the way in. That growth is the reward.
    falconer.fistPoint(fistPos);
    const away = _tmp.copy(fistPos).sub(camera.position);
    away.y = 0;
    away.normalize();
    // Swing the far end a little off-axis so the run in is a curve, not a ruler.
    const side = new THREE.Vector3(-away.z, 0, away.x);

    homePath.p3.copy(fistPos);
    homePath.p2.copy(fistPos).addScaledVector(away, 5.5).addScaledVector(side, 1.2);
    homePath.p2.y += 1.5;
    homePath.p1.copy(fistPos).addScaledVector(away, 20).addScaledVector(side, 7.5);
    homePath.p1.y += 6.0;
    homePath.p0.copy(fistPos).addScaledVector(away, 30).addScaledVector(side, 2.0);
    homePath.p0.y = Math.max(fistPos.y + 8.5, 9.0);

    const t = new Timeline();
    t.at(0.0, () => {});
    tl = t;
    // Phase 1 is a free-flight turn onto the start of that path.
    recall.phase = 'turn';
    recall.t = 0;
    recall.u = 0;
  }

  const recall = { phase: 'turn', t: 0, u: 0 };

  /* ---------- input wiring ---------- */

  /*
   * In both tap states there is exactly one thing in the world to touch, so a
   * tap anywhere does it. The pulsing ring still teaches *where* the gauntlet
   * and the clasp are, and the falconer's hand still goes to the right place —
   * but a four-year-old never has to hit a target to keep the game moving.
   */
  function primaryAction() {
    if (state === 'glove') beginDon();
    else if (state === 'tethered') beginUnclip();
  }

  input.on('tap', () => {
    audio.resume();
    idle = 0;
    if (state === 'glove' || state === 'tethered') {
      primaryAction();
    } else if (state === 'lure' && recallArmed) {
      beginRecall();
    } else if (state === 'ready' && stateT > 1.2) {
      // A tap when they cannot manage a swipe still sends the hawk up.
      beginCast();
    }
  });

  input.on('dragShort', () => {
    audio.resume();
    idle = 0;
    primaryAction();
  });

  input.on('swipeUp', () => {
    audio.resume();
    idle = 0;
    if (state === 'ready') beginCast();
  });

  input.on('swipeIn', (info) => {
    idle = 0;
    if (state !== 'lure' || !recallArmed) return;
    // Toward the middle of the screen — a gesture that says "come to me".
    const cx = dom.clientWidth * 0.5;
    const cy = dom.clientHeight * 0.55;
    const toCenter = Math.hypot(info.ex - cx, info.ey - cy);
    const fromCenter = Math.hypot(info.x - cx, info.y - cy);
    if (toCenter < fromCenter - 24 || info.dist > 120) beginRecall();
  });

  /* ---------- per-state update ---------- */

  function updateHawkPerched(dt, anchor, anchorQuat) {
    // Standing on something: upright, weight settling, head alive. The anchor
    // is the surface the feet meet, so the body rides a leg's length above it.
    _perch.copy(anchor);
    _perch.y += hawk.standOffset;
    flight.pos.lerp(_perch, approach(22, dt));
    hawk.root.position.copy(flight.pos);
    const yaw = new THREE.Euler().setFromQuaternion(anchorQuat, 'YXZ').y;
    hawk.root.rotation.set(0, dampAngle(hawk.root.rotation.y, yaw + 0.1, 6, dt), 0);
    hawk.pose.spread = damp(hawk.pose.spread, 0, 6, dt);
    hawk.pose.cup = damp(hawk.pose.cup, 0, 6, dt);
    hawk.pose.tail = damp(hawk.pose.tail, 0, 6, dt);
    hawk.pose.legs = damp(hawk.pose.legs, 1, 8, dt);
    hawk.pose.bodyPitch = damp(hawk.pose.bodyPitch, 0, 6, dt);
    hawk.pose.bodyRoll = damp(hawk.pose.bodyRoll, 0, 6, dt);
  }

  /** A hawk's head barely moves while its body does — so it tracks separately. */
  function updateHead(dt, target) {
    headLook.lerp(target, approach(6, dt));
    hawk.root.updateMatrixWorld();
    const local = hawk.body.worldToLocal(_tmp.copy(headLook));
    const yaw = Math.atan2(local.x, local.z);
    const pitch = -Math.atan2(local.y, Math.hypot(local.x, local.z));
    hawk.pose.headYaw = damp(hawk.pose.headYaw, clamp(yaw, -1.5, 1.5), 7, dt);
    hawk.pose.headPitch = damp(hawk.pose.headPitch, clamp(pitch, -0.8, 0.8), 7, dt);
  }

  let lastLureSwish = 0;

  function update(dt, elapsed) {
    // Inspection hook: freeze the state machine so a harness can drive poses
    // and the camera directly while the world keeps animating.
    if (window.__poseHold) {
      falconer.update(dt);
      hawk.apply();
      world.update(dt);
      updateCamera(dt);
      return;
    }

    input.tick(dt);
    if (!input.isDown) idle += dt;

    stateT += dt;
    if (tl) tl.update(dt);

    const c = circle.update(dt, input);

    /*
     * Pose the falconer before anything reads their transform. The order
     * matters: `falconer.update` writes every joint from the blended pose, so
     * the procedural overrides below — the lure-swinging arm and the fist
     * giving under the hawk's weight — have to be applied *after* it, and the
     * world matrices refreshed before the fist's position is taken.
     */
    falconer.update(dt);

    // The fist dips when the bird lands, and the whole arm carries it.
    falconer.joints.lWrist.rotation.x += armDip;
    falconer.joints.lElbow.rotation.z += armDip * 0.5;

    if (lure.group.visible) {
      // The swinging arm is driven straight off the lure angle: the falconer's
      // body follows the circle the child's finger is drawing.
      const sh = falconer.joints.rShoulder;
      sh.rotation.x = -1.15 + Math.sin(c.phase) * 0.5;
      sh.rotation.z = -0.45 + Math.cos(c.phase) * 0.4;
      falconer.joints.rElbow.rotation.x = -0.35 - Math.sin(c.phase + 0.6) * 0.28;
      falconer.spine.rotation.y += Math.cos(c.phase) * 0.1;
    }

    falconer.root.updateMatrixWorld(true);
    falconer.fistPoint(fistPos);
    falconer.fistQuaternion(fistQuat);
    falconer.armR.wrist.getWorldPosition(handPos);

    /* ---- the lure, live whenever the falconer is holding it ---- */
    if (lure.group.visible) {
      // A vertical circle beside the falconer, in the plane facing the camera —
      // the same plane the finger is drawing in.
      const camRight = _camRight.set(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize();
      const R = 0.95;
      const center = _lureCenter.copy(handPos).addScaledVector(camRight, -0.15);
      center.y -= 0.55;
      lurePrev.copy(lurePos);
      lurePos
        .copy(center)
        .addScaledVector(camRight, Math.cos(c.phase) * R)
        .addScaledVector(_up, Math.sin(c.phase) * R);
      lure.group.position.copy(lurePos);
      lureVel.copy(lurePos).sub(lurePrev).divideScalar(Math.max(dt, 1e-3));
      lure.orient(lureVel, dt, c.speed);
      lure.updateCord(handPos, lurePos, 0.06 / (1 + c.speed));

      if (c.speed > 1.4 && elapsed - lastLureSwish > 1.1 / c.speed) {
        lastLureSwish = elapsed;
        audio.swish(clamp(c.speed / 4, 0, 1));
      }
    }

    /* ---- states ---- */
    switch (state) {
      case 'glove': {
        updateHawkPerched(dt, world.perchPoint, new THREE.Quaternion());
        updateHead(dt, _tmp.copy(falconer.root.position).setY(1.4));
        setShot({
          look: _tmp.set(-0.28, 0.95, 0.6),
          yaw: 0.2,
          pitch: 0.17,
          fitH: 1.5,
          minW: 1.25,
        });
        // Nudge: the falconer glances at the glove, then a ring appears on it.
        if (idle > 2.2) hints.show('ring', toScreen(gloveRest).x, toScreen(gloveRest).y);
        if (idle > 20) primaryAction();
        break;
      }

      case 'donning': {
        updateHawkPerched(dt, world.perchPoint, new THREE.Quaternion());
        updateHead(dt, fistPos);
        setShot({ look: _tmp.set(-0.05, 1.15, 0.45), yaw: 0.2, pitch: 0.15, fitH: 1.05, minW: 0.72 }, 1.6);
        break;
      }

      case 'stepUp': {
        // Hop across from the bow perch to the offered fist.
        const t = clamp(stateT / 1.9, 0, 1);
        const k = ease.inOut(t);
        _aim.copy(world.perchPoint).lerp(fistPos, k);
        _aim.y += hawk.standOffset + Math.sin(t * Math.PI) * 0.42; // an arc, not a slide
        flight.pos.copy(_aim);
        hawk.root.position.copy(flight.pos);
        const yaw = Math.atan2(fistPos.x - world.perchPoint.x, fistPos.z - world.perchPoint.z);
        hawk.root.rotation.set(0, dampAngle(hawk.root.rotation.y, t < 0.85 ? yaw : 0.44, 5, dt), 0);
        hawk.pose.spread = Math.sin(clamp(t * 1.15, 0, 1) * Math.PI) * 0.95;
        hawk.pose.legs = t > 0.72 ? 1 : 0.55;
        hawk.pose.tail = Math.sin(t * Math.PI) * 0.55;
        hawk.pose.flap = Math.sin(stateT * 17) * Math.sin(t * Math.PI) * 0.8;
        updateHead(dt, fistPos);
        setShot({ look: _tmp.copy(fistPos).setY(fistPos.y - 0.12), yaw: 0.2, pitch: 0.12, fitH: 0.95, minW: 0.66 }, 2.6);
        break;
      }

      case 'tethered':
      case 'unclipping':
      case 'ready': {
        updateHawkPerched(dt, fistPos, fistQuat);
        hawk.pose.flap = damp(hawk.pose.flap, 0, 5, dt);
        // Look at whatever is interesting: the free hand while it works, the
        // sky once the leash is off.
        if (state === 'ready') {
          updateHead(dt, _tmp.set(fistPos.x - 3, fistPos.y + 3.4, fistPos.z - 3));
          hawk.pose.ruffle = 0.35 + Math.sin(elapsed * 2.2) * 0.12;
        } else {
          falconer.armR.wrist.getWorldPosition(_tmp);
          updateHead(dt, _tmp);
          hawk.pose.ruffle = damp(hawk.pose.ruffle, 0.1, 3, dt);
        }
        hawk.pose.jess = elapsed * 2.4;

        if (state === 'tethered' || state === 'unclipping') {
          falconer.gauntlet.clasp.getWorldPosition(_tmp);
          hawk.legs[0].shank.getWorldPosition(_aim);
          updateLeash(_aim, _tmp);
        }

        setShot({
          look: _tmp.copy(fistPos).lerp(falconer.root.position, 0.42).setY(fistPos.y + 0.1),
          yaw: 0.26,
          pitch: 0.1,
          fitH: state === 'ready' ? 1.18 : 1.12,
          minW: 0.62,
        }, 2.0);

        if (state === 'tethered' && idle > 2.2) {
          falconer.gauntlet.clasp.getWorldPosition(_tmp);
          const s = toScreen(_tmp);
          hints.show('ring', s.x, s.y);
        }
        if (state === 'ready' && idle > 2.0) {
          const s = toScreen(fistPos);
          hints.show('rise', s.x, s.y - 90);
        }
        if (idle > 20) {
          if (state === 'tethered') primaryAction();
          else if (state === 'ready') beginCast();
        }
        break;
      }

      case 'casting': {
        updateHawkPerched(dt, fistPos, fistQuat);
        hawk.pose.ruffle = 0.5;
        setShot({ look: _tmp.copy(fistPos), yaw: 0.26, pitch: 0.1, fitH: 0.9, minW: 0.56 }, 3.0);
        break;
      }

      case 'launch': {
        // Hard climbing beats away from the fist.
        _aim.copy(flight.pos);
        _aim.y += 6;
        _aim.x -= 5;
        _aim.z += 3.5;
        const turn = steer(_aim, lerp(7.5, 9.5, clamp(stateT, 0, 1)), 2.6, dt);
        hawk.pose.flap = beatWings(dt, 1, 5.2);
        flight.spread = damp(flight.spread, 1, 9, dt);
        flight.legs = damp(flight.legs, 0, 3, dt);
        hawk.pose.spread = flight.spread;
        hawk.pose.legs = flight.legs;
        hawk.pose.tail = damp(hawk.pose.tail, 0.5, 4, dt);
        hawk.pose.cup = damp(hawk.pose.cup, 0, 6, dt);
        hawk.root.position.copy(flight.pos);
        orientFlight(turn, dt);
        updateHead(dt, _tmp.copy(flight.pos).addScaledVector(flight.vel, 1.4));
        // Camera stays low and lets the bird tear out of frame — the shove
        // reads better than a polite follow.
        setShot({
          look: _tmp.copy(fistPos).lerp(flight.pos, clamp(stateT * 0.6, 0, 0.75)),
          yaw: 0.26,
          pitch: lerp(0.1, 0.3, clamp(stateT * 0.5, 0, 1)),
          fitH: lerp(0.95, 4.0, clamp(stateT * 0.45, 0, 1)),
          minW: lerp(0.56, 2.2, clamp(stateT * 0.45, 0, 1)),
        }, 2.0);
        if (stateT > 0.4 && stateT < 0.45) audio.flap(0.9);
        if (stateT > 2.1) beginSoar();
        break;
      }

      case 'soar': {
        orbitStep(dt, 0.55);
        setSkyShot(dt);
        if (stateT > 2.7) beginLure();
        break;
      }

      case 'lure': {
        // The circle the hawk flies tightens toward the lure as the child keeps
        // the lure moving: their circle pulls the bird's circle in.
        const engage = clamp(c.energy, 0, 1);
        flight.orbitR = damp(flight.orbitR, lerp(9.0, 5.0, engage), 0.55, dt);
        flight.orbitH = damp(flight.orbitH, lerp(7.6, 3.6, engage), 0.5, dt);
        flight.orbitCenter.x = damp(flight.orbitCenter.x, lerp(-2.0, fistPos.x, engage), 0.5, dt);
        flight.orbitCenter.z = damp(flight.orbitCenter.z, lerp(-6.0, fistPos.z - 1.0, engage), 0.5, dt);
        // Faster finger, faster bird.
        const omega = lerp(0.44, 0.44 + clamp(c.speed, 0, 4) * 0.16, engage);
        const before = flight.orbitAngle;
        orbitStep(dt, 0.55, omega);
        // Count a pass each time it sweeps past the near side of the circle.
        const near = -Math.PI / 2;
        if (crossedAngle(before, flight.orbitAngle, near)) {
          lurePasses++;
          audio.call();
          if (lurePasses >= 2 && engage > 0.3) recallArmed = true;
        }
        setLureShot(dt, engage);

        if (!recallArmed) {
          if (idle > 1.6 || c.energy < 0.12) {
            const s = toScreen(lurePos);
            hints.show('circle', s.x, s.y, 66);
          }
        } else if (idle > 2.4) {
          const s = toScreen(fistPos);
          hints.show('inward', s.x + 120, s.y);
          // The falconer starts offering the arm on their own, slowly.
          falconer.setPose(POSES.offer, 1.1);
        }
        // Safety net: a child who never touches the screen still gets to see
        // the hawk come home rather than watching it circle forever.
        if (stateT > 30) recallArmed = true;
        if (recallArmed && (stateT > 42 || (stateT > 20 && idle > 18))) beginRecall();
        break;
      }

      case 'recall':
        updateRecall(dt);
        break;

      case 'landed': {
        updateHawkPerched(dt, fistPos, fistQuat);
        // The arm gives under the weight, then springs back — this is what
        // makes the hawk feel like it has mass.
        armDipVel += (-armDip * 42 - armDipVel * 9) * dt;
        armDip += armDipVel * dt;
        hawk.pose.spread = damp(hawk.pose.spread, 0, 2.6, dt);
        hawk.pose.cup = damp(hawk.pose.cup, 0, 3.2, dt);
        hawk.pose.tail = damp(hawk.pose.tail, 0, 2.4, dt);
        hawk.pose.ruffle = damp(hawk.pose.ruffle, 0.15, 1.6, dt);
        hawk.pose.jess = elapsed * 2.4;
        // A settling half-beat, then it looks around and mantles down.
        if (stateT < 0.9) hawk.pose.flap = Math.sin(stateT * 11) * (1 - stateT / 0.9) * 0.45;
        else hawk.pose.flap = damp(hawk.pose.flap, 0, 4, dt);
        if (stateT < 1.6) updateHead(dt, _tmp.copy(camera.position));
        else updateHead(dt, _tmp.copy(falconer.root.position).setY(1.45));

        setShot({
          look: _tmp.copy(fistPos).lerp(falconer.root.position, 0.36).setY(fistPos.y + 0.08),
          yaw: 0.26,
          pitch: 0.09,
          fitH: lerp(0.86, 1.18, clamp((stateT - 0.6) / 2.2, 0, 1)),
          minW: lerp(0.5, 0.62, clamp((stateT - 0.6) / 2.2, 0, 1)),
        }, 1.6);

        if (stateT > 2.6) {
          go('ready');
        }
        break;
      }
      default:
    }

    hawk.apply();
    world.update(dt);
    updateFeathers(dt);
    updateCamera(dt);
  }

  /* ---- shared orbit motion ---- */

  function crossedAngle(a, b, target) {
    const norm = (x) => ((x % TAU) + TAU) % TAU;
    const na = norm(a - target);
    const nb = norm(b - target);
    return nb < na; // wrapped past the target this frame
  }

  function orbitStep(dt, effort, omega) {
    const w = omega === undefined ? flight.orbitOmega : omega;
    flight.orbitAngle += w * dt;
    // Aim ahead on the circle so the bird flies a curve rather than chasing a
    // point it has already reached.
    const lead = 0.55;
    _aim.set(
      flight.orbitCenter.x + Math.cos(flight.orbitAngle + lead) * flight.orbitR,
      flight.orbitH + Math.sin(flight.orbitAngle * 2) * 0.55,
      flight.orbitCenter.z + Math.sin(flight.orbitAngle + lead) * flight.orbitR,
    );
    const speed = clamp(w * flight.orbitR * 1.25, 5, 15);
    const turn = steer(_aim, speed, 2.4, dt);
    orientFlight(turn, dt);
    hawk.root.position.copy(flight.pos);

    // Soaring birds glide most of the time and beat in short bursts.
    const beatBurst = (Math.sin(flight.orbitAngle * 1.7) + 1) * 0.5;
    const e = clamp(effort * beatBurst * 1.4, 0, 1);
    hawk.pose.flap = beatWings(dt, e, 3.0);
    hawk.pose.spread = damp(hawk.pose.spread, 1, 5, dt);
    hawk.pose.legs = damp(hawk.pose.legs, 0, 3, dt);
    hawk.pose.tail = damp(hawk.pose.tail, 0.42, 3, dt);
    hawk.pose.cup = damp(hawk.pose.cup, 0, 4, dt);
    hawk.pose.ruffle = damp(hawk.pose.ruffle, 0, 3, dt);
    // Looking down and in at the falconer as it circles — a bird on the wing
    // keeps its eye on the lure.
    updateHead(dt, lure.group.visible ? lurePos : _tmp.copy(fistPos));
  }

  const _anchor = new THREE.Vector3();
  function setSkyShot(dt) {
    /*
     * Stand still and follow the bird.
     *
     * A portrait phone is about twenty-two degrees wide. A hawk circling on a
     * nine-metre radius swings through seventy or more, so there is no framing
     * that holds the bird and the falconer together up here — every attempt
     * ends up aimed at the grass between them. So this shot commits to the
     * hawk, briefly, the way you would actually watch one. The pairing the
     * game is about is carried by the shots on either side: the cast just
     * before, and the lure phase just after, which is framed on the falconer
     * and which the hawk's own circle tightens into.
     *
     * Aimed well below the bird, which puts it in the upper third and keeps
     * the treeline along the bottom edge — without the horizon in shot there is
     * nothing to measure the height against and the frame is just blue.
     */
    _anchor.copy(falconer.root.position).add(_tmp.set(1.7, 1.5, 5.0));
    const aim = _tmp.copy(flight.pos);
    aim.y -= 3.6;
    setShot({ anchor: _anchor, look: aim }, 2.4);
  }

  /**
   * The lure phase is the falconer's shot, not the hawk's: the child needs to
   * see the arm swinging the lure round. Framed on the falconer with sky above,
   * tightening as they get into it — and the hawk's own circle is shrinking
   * toward the lure at the same time, so it drops into frame on every pass.
   */
  function setLureShot(dt, engage) {
    // Centred on the falconer with room above for the hawk to drop into, and
    // wide enough that the whole swept circle of the lure stays in frame.
    const look = _tmp.copy(falconer.root.position);
    look.y += lerp(1.55, 1.35, engage);
    setShot(
      {
        look,
        yaw: 0.26,
        pitch: 0.1,
        fitH: lerp(2.9, 2.25, engage),
        minW: lerp(1.5, 1.2, engage),
      },
      1.9,
    );
  }

  /* ---- the return: the moment the whole game is for ---- */

  function updateRecall(dt) {
    const R = recall;
    R.t += dt;

    if (R.phase === 'turn') {
      // Break off the circle and line up on the far end of the approach.
      const turn = steer(homePath.p0, 12, 1.9, dt);
      hawk.pose.flap = beatWings(dt, 0.75, 3.6);
      hawk.pose.spread = damp(hawk.pose.spread, 1, 5, dt);
      hawk.pose.tail = damp(hawk.pose.tail, 0.4, 4, dt);
      hawk.pose.legs = damp(hawk.pose.legs, 0, 4, dt);
      hawk.root.position.copy(flight.pos);
      orientFlight(turn, dt);
      updateHead(dt, fistPos);
      setSkyShot(dt);
      if (flight.pos.distanceTo(homePath.p0) < 5.5 || R.t > 3.4) {
        R.phase = 'glide';
        R.t = 0;
        R.u = 0;
        audio.call();
      }
      return;
    }

    if (R.phase === 'glide') {
      // The long run in. Constant-ish ground speed along the curve, wings
      // mostly locked out, a couple of deep beats early on. The bird grows in
      // the frame the entire time.
      const DUR = 3.5;
      R.u = clamp(R.u + dt / DUR, 0, 1);
      const u = ease.inOut(R.u) * 0.92;
      bezier(u, _bez);
      const prev = _tmp.copy(flight.pos);
      flight.pos.copy(_bez);
      flight.vel.copy(flight.pos).sub(prev).divideScalar(Math.max(dt, 1e-3));
      hawk.root.position.copy(flight.pos);

      const bankTarget = Math.sin(R.u * Math.PI) * 0.5 * (1 - R.u);
      flight.bank = damp(flight.bank, bankTarget, 3, dt);
      _fwd.copy(flight.vel).normalize();
      orientAlong(hawk.root, _fwd, _up, flight.bank);

      // Two hard beats to get moving, then a long committed glide.
      const effort = R.u < 0.22 ? 0.9 : R.u < 0.4 ? 0.35 : 0.0;
      hawk.pose.flap = beatWings(dt, effort, 3.2);
      hawk.pose.spread = damp(hawk.pose.spread, 1, 6, dt);
      hawk.pose.tail = damp(hawk.pose.tail, lerp(0.3, 0.62, R.u), 3, dt);
      hawk.pose.legs = damp(hawk.pose.legs, R.u > 0.72 ? 0.55 : 0, 3, dt);
      hawk.pose.cup = damp(hawk.pose.cup, clamp((R.u - 0.68) * 1.4, 0, 0.35), 3, dt);
      hawk.pose.bodyPitch = damp(hawk.pose.bodyPitch, -0.06, 3, dt);
      updateHead(dt, fistPos);

      if (R.u > 0.2 && R.u < 0.22) audio.flap(1.0);

      // Camera: hold the fist low in frame and ease in, so the approaching bird
      // fills more and more of the screen without any cut.
      setShot(
        {
          look: _tmp
            .copy(fistPos)
            .lerp(falconer.root.position, 0.3)
            .setY(fistPos.y + lerp(0.6, 0.14, ease.inOut(R.u))),
          yaw: 0.26,
          pitch: lerp(0.2, 0.08, ease.inOut(R.u)),
          fitH: lerp(1.6, 1.08, ease.inOutCubic(R.u)),
          minW: lerp(0.75, 0.6, ease.inOutCubic(R.u)),
        },
        1.5,
      );

      if (R.u >= 1) {
        R.phase = 'flare';
        R.t = 0;
        R.start = flight.pos.clone();
        R.startVel = flight.vel.clone();
        audio.flap(1.2);
      }
      return;
    }

    if (R.phase === 'flare') {
      // Braking: wings thrown wide and cupped forward, tail fanned down, body
      // pitched up, feet reaching. Speed bleeds to nothing right at the fist.
      const DUR = 1.05;
      const t = clamp(R.t / DUR, 0, 1);
      const k = ease.outQuint(t);
      falconer.fistPoint(fistPos);
      const above = _tmp.copy(fistPos).setY(fistPos.y + hawk.standOffset);
      flight.pos.lerpVectors(R.start, above, k);
      // A slight rise into the stall — birds pop up as they brake.
      flight.pos.y += Math.sin(t * Math.PI) * 0.34;
      hawk.root.position.copy(flight.pos);

      const dir = _aim.copy(above).sub(R.start).setY(0).normalize();
      orientAlong(hawk.root, dir, _up, lerp(flight.bank, 0, k));
      hawk.pose.bodyPitch = lerp(-0.06, 0.72, ease.out(t));
      hawk.pose.spread = 1;
      hawk.pose.cup = ease.out(clamp(t * 1.5, 0, 1));
      hawk.pose.tail = lerp(0.6, 1, ease.out(t));
      hawk.pose.tailPitch = lerp(0, 0.75, ease.out(t));
      hawk.pose.legs = ease.out(clamp((t - 0.15) * 2.2, 0, 1));
      hawk.pose.flap = Math.sin(R.t * 13) * (1 - t) * 0.5;
      hawk.pose.ruffle = t * 0.4;
      updateHead(dt, _tmp.copy(fistPos).add(new THREE.Vector3(0, -0.1, 0)));
      if (t > 0.35 && t < 0.4) {
        world.gust(fistPos, 0.35);
        audio.flap(0.8);
      }

      setShot(
        {
          look: _tmp.copy(fistPos).setY(fistPos.y + 0.16),
          yaw: 0.26,
          pitch: 0.07,
          fitH: 1.0,
          minW: 0.58,
        },
        2.2,
      );

      if (t >= 1) {
        R.phase = 'done';
        armDip = 0.16;
        armDipVel = 0;
        shakeAmt = 0.045;
        audio.thump();
        audio.bell(4);
        audio.settle();
        shedFeathers(fistPos, 2, 0.4);
        hawk.pose.tailPitch = 0;
        go('landed');
      }
    }
  }

  /* ---------- boot ---------- */

  falconer.snapPose(POSES.rest);
  flight.pos.copy(world.perchPoint);
  hawk.root.position.copy(flight.pos);
  hawk.pose.legs = 1;
  hawk.apply();
  headLook.copy(falconer.root.position).setY(1.4);

  return {
    update,
    world,
    falconer,
    hawk,
    lure,
    input,
    audio,
    camera,
    get state() {
      return state;
    },
    // Test hooks: let a harness drive the chain without synthesising gestures.
    _force: {
      don: () => state === 'glove' && beginDon(),
      unclip: () => state === 'tethered' && beginUnclip(),
      cast: () => state === 'ready' && beginCast(),
      recall: () => state === 'lure' && beginRecall(),
      armRecall: () => (recallArmed = true),
      info: () => ({
        state,
        render: {
          calls: renderer.info.render.calls,
          tris: renderer.info.render.triangles,
          textures: renderer.info.memory.textures,
          geometries: renderer.info.memory.geometries,
        },
        lurePasses,
        recallArmed,
        hawk: flight.pos.toArray().map((n) => +n.toFixed(2)),
        recall: { phase: recall.phase, u: +recall.u.toFixed(3) },
        shot: {
          look: shot.look.toArray().map((n) => +n.toFixed(2)),
          yaw: +shot.yaw.toFixed(3),
          pitch: +shot.pitch.toFixed(3),
          fitH: +shot.fitH.toFixed(3),
          minW: +shot.minW.toFixed(3),
        },
      }),
    },
  };
}
