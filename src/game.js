// ---------------------------------------------------------------------------
//  The butchering sequence.
//
//   arrive -> collar cut -> the head and collar come away -> roll the fish
//   -> two long passes down the backbone -> LIFT THE LOIN (the whole point)
//   -> carry it to the board -> three cross cuts -> saku, lined up -> play
//
//  No timer, no score, no failure state. The only thing that can happen is
//  the next good thing.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { clamp, lerp, damp, easeInOut, easeOutCubic, fitDistance, noise1 } from './util.js';
import { createTuna, buildSakuGeometry, bodyPoint, X_OF, SAKU_U } from './tuna.js';
import { createKnife, placeKnife } from './knife.js';
import { createCraftsman } from './craftsman.js';
import { createEnvironment, TABLE } from './env.js';
import { createGuide, createSparkles, createKerf } from './guide.js';
import { createStroke } from './input.js';
import { collarPath, rollPath, spinePath, liftPath, sakuPath } from './paths.js';
import { handTexture, fleshTexture } from './textures.js';

// A tuna at a butchering demonstration is not stood on its side; it is
// chocked over just far enough that the backbone line presents itself and the
// median plane faces the crowd. ~31 degrees does both.
const ROLL_ANGLE = -0.55;
const FISH_Z = -0.22;                      // within the craftsman's reach
const BOARD_X = -0.95;
const BOARD_Z = 0.15;
const BOARD_TOP = TABLE.h + 0.0755;

const S = {
  INTRO: 'intro', COLLAR: 'collar', COLLAR_OUT: 'collarOut',
  ROLL: 'roll', ROLL_SET: 'rollSet',
  SPINE1: 'spine1', SPINE2: 'spine2',
  LIFT: 'lift', CARRY: 'carry',
  SAKU0: 'saku0', SAKU1: 'saku1', SAKU2: 'saku2',
  TIDY: 'tidy', PLAY: 'play',
};

/** Lowest point of the body when rolled by `ang`, so it truly sits on wood. */
function lowestY(ang) {
  const p = new THREE.Vector3();
  const c = Math.cos(ang), s = Math.sin(ang);
  let m = Infinity;
  for (let u = 0.02; u <= 0.99; u += 0.035) {
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      bodyPoint(u, a, p);
      const y = p.y * c - p.z * s;
      if (y < m) m = y;
    }
  }
  return m;
}
const REST_BELLY = TABLE.h - lowestY(0) + 0.004;
const REST_SIDE = TABLE.h - lowestY(ROLL_ANGLE) + 0.004;

export function createGame(ctx) {
  const { scene, camera, renderer, audio } = ctx;

  /* ------------------------------------------------------------ build --- */
  const env = createEnvironment(scene, renderer);
  const tuna = createTuna();
  scene.add(tuna.root);
  const knife = createKnife();
  scene.add(knife.root);
  const craft = createCraftsman();
  scene.add(craft.root);

  const guide = createGuide(scene);
  guide.setHandTexture(handTexture());
  const kerf = createKerf(scene);
  const sparks = createSparkles(scene, 90);
  const stroke = createStroke();

  // wooden chocks: something for a 250 kg fish to actually rest against
  const chockMat = env.matWood;
  const chocks = [];
  for (const cx of [-0.62, 0.52]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.085, 0.42), chockMat);
    c.position.set(cx, TABLE.h + 0.042, FISH_Z);
    c.castShadow = true; c.receiveShadow = true;
    c.visible = false;
    scene.add(c);
    chocks.push(c);
  }

  // the reveal light: it blooms as the loin comes free
  const revealLight = new THREE.PointLight('#ffd2b4', 0, 4.0, 2.0);
  revealLight.position.set(-0.1, 1.9, 0.3);
  scene.add(revealLight);

  /* -------- saku blocks, built now and revealed at the tidy-up ---------- */
  const fleshTex = fleshTexture();
  const matSaku = new THREE.MeshPhysicalMaterial({
    vertexColors: true, map: fleshTex, roughness: 0.50, specularIntensity: 0.42,
    clearcoat: 0.12, clearcoatRoughness: 0.35, sheen: 0.14,
    sheenColor: new THREE.Color('#ffc0b0'), envMapIntensity: 0.30,
  });
  const GRADES = [[0.00, 0.18], [0.26, 0.50], [0.58, 0.82], [0.84, 1.00]];
  const sakus = [];
  for (let i = 0; i < 4; i++) {
    const { shell, caps } = buildSakuGeometry(0.40, 0.078, 0.098, GRADES[i][0], GRADES[i][1]);
    const g = new THREE.Group();
    for (const geo of [shell, ...caps]) {
      const m = new THREE.Mesh(geo, matSaku);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    }
    g.position.set(BOARD_X + (i - 1.5) * 0.50, BOARD_TOP + 0.078, BOARD_Z);
    g.scale.setScalar(0.001);
    g.visible = false;
    g.userData = { home: g.position.clone(), pop: 0, idx: i, hover: 0 };
    scene.add(g);
    sakus.push(g);
  }

  /* ----------------------------------------------------- initial state -- */
  const snapshots = [];
  function snapshot(obj) {
    snapshots.push({
      obj, parent: obj.parent,
      p: obj.position.clone(), q: obj.quaternion.clone(), s: obj.scale.clone(),
      vis: obj.visible,
    });
  }

  const st = {
    stage: S.INTRO, t: 0, sub: 0,
    fishX: 0, headSlide: 0, loinGap: 0, cutDepth: [0, 0],
    lift: 0, carry: 0, tidy: 0, sakuSep: [0, 0, 0, 0], sepBase: [0, 0, 0, 0],
    knifeMode: 'rest', pull: 0,
    rollT: 0, revealBoost: 0, tapped: -1, playT: 0,
    handA: new THREE.Vector3(1.2, 0.95, -0.55),
    handB: new THREE.Vector3(1.05, 0.95, -0.45),
    look: new THREE.Vector3(0.6, 1.2, 0),
    craftPos: new THREE.Vector3(1.55, 0, -1.05),
    craftYaw: 0,
    camTarget: new THREE.Vector3(0.3, 1.2, 0),
    camDist: 7, camDir: new THREE.Vector3(0, 0.4, 1).normalize(),
    camRoll: 0, started: false,
  };

  let paths = {};

  function buildPaths() {
    paths.collar = collarPath(tuna);
    paths.spine = spinePath(tuna);
  }

  /* --------------------------------------------------------- reset ------ */
  function captureSnapshots() {
    snapshots.length = 0;
    snapshot(tuna.root); snapshot(tuna.head); snapshot(tuna.upper); snapshot(tuna.lower);
    for (const s of tuna.segments) snapshot(s);
    for (const s of sakus) snapshot(s);
    snapshot(knife.root);
  }

  function restart() {
    for (const s of snapshots) {
      if (s.obj.parent !== s.parent) { s.obj.removeFromParent(); s.parent.add(s.obj); }
      s.obj.position.copy(s.p); s.obj.quaternion.copy(s.q); s.obj.scale.copy(s.s);
      s.obj.visible = s.vis;
    }
    st.stage = S.INTRO; st.t = 0; st.sub = 0;
    st.headSlide = 0; st.loinGap = 0; st.cutDepth = [0, 0];
    st.lift = 0; st.carry = 0; st.tidy = 0;
    st.sakuSep = [0, 0, 0, 0]; st.sepBase = [0, 0, 0, 0];
    st.rollT = 0; st.revealBoost = 0; st.tapped = -1; st.playT = 0;
    for (const s of sakus) s.userData.popped = false;
    for (let i = 0; i < tuna.segments.length; i++) {
      const g2 = tuna.segments[i];
      g2.visible = true; g2.scale.setScalar(1); g2.position.x = 0;
      g2.userData.capRear.visible = false;
      g2.userData.capFront.visible = i === tuna.segments.length - 1;
    }
    st.craftPos.set(1.55, 0, -1.05); st.craftYaw = 0;
    craft.root.position.copy(st.craftPos);
    craft.root.rotation.y = 0;
    craft.placeFeetNow();
    for (const c of chocks) c.visible = false;
    for (const s of sakus) { s.visible = false; s.scale.setScalar(0.001); s.userData.pop = 0; }
    env.board.visible = false;
    kerf.hide(); guide.hide();
    revealLight.intensity = 0;
    tuna.root.position.set(3.6, REST_BELLY, FISH_Z);
    buildPaths();
  }

  captureSnapshots();
  tuna.root.position.set(3.6, REST_BELLY, FISH_Z);
  craft.root.position.copy(st.craftPos);
  buildPaths();

  /* =================================================================== *
   *  Camera framing — recomputed from the actual world every frame, so a
   *  device rotation is just a different fit of the same live state.
   * =================================================================== */
  const _pts = [];
  for (let i = 0; i < 48; i++) _pts.push(new THREE.Vector3());
  const _box = new THREE.Box3();
  const _tmpV = new THREE.Vector3();

  function boxInto(obj, out, n) {
    _box.makeEmpty();
    // NOT precise: the precise form walks every vertex of every child, which
    // for the fish alone is tens of thousands of them, every frame.
    _box.setFromObject(obj);
    const mn = _box.min, mx = _box.max;
    if (!isFinite(mn.x)) return n;
    for (let i = 0; i < 8; i++) {
      out[n + i].set(i & 1 ? mx.x : mn.x, i & 2 ? mx.y : mn.y, i & 4 ? mx.z : mn.z);
    }
    return n + 8;
  }

  /** The craftsman must never leave frame — he is the ruler. */
  function craftInto(out, n) {
    const c = craft.root.position;
    out[n++].set(c.x, 1.80, c.z);
    out[n++].set(c.x, 0.55, c.z);
    return n;
  }
  function tableInto(out, n) {
    for (const sx of [-1, 1]) {
      out[n++].set(sx * (TABLE.w / 2 - 0.15), TABLE.h, 0.35);
      out[n++].set(sx * (TABLE.w / 2 - 0.15), TABLE.h + 0.55, -0.35);
    }
    return n;
  }

  function framing(portrait) {
    let n = 0;
    let az, el, mx, my, shift;
    const s = st.stage;
    if (s === S.INTRO) {
      // a fixed stage the fish slides into, rather than a camera that chases
      n = tableInto(_pts, n);
      n = craftInto(_pts, n);
      if (st.sub > 2.0) n = boxInto(tuna.root, _pts, n);
      az = portrait ? -0.72 : -0.30; el = portrait ? 0.34 : 0.26;
    } else if (s === S.COLLAR || s === S.COLLAR_OUT) {
      n = boxInto(tuna.root, _pts, n);
      if (s === S.COLLAR_OUT) n = boxInto(tuna.head, _pts, n);
      az = portrait ? -0.80 : -0.36; el = portrait ? 0.40 : 0.34;
    } else if (s === S.ROLL || s === S.ROLL_SET) {
      n = boxInto(tuna.root, _pts, n);
      az = portrait ? -0.78 : -0.30; el = portrait ? 0.44 : 0.36;
    } else if (s === S.SPINE1 || s === S.SPINE2) {
      n = boxInto(tuna.root, _pts, n);
      az = portrait ? -0.82 : -0.28; el = portrait ? 0.50 : 0.42;
    } else if (s === S.LIFT) {
      n = boxInto(tuna.root, _pts, n);
      n = boxInto(tuna.upper, _pts, n);
      az = portrait ? -0.76 : -0.26; el = portrait ? 0.50 : 0.40;
    } else if (s === S.CARRY) {
      n = boxInto(tuna.upper, _pts, n);
      n = boxInto(tuna.lower, _pts, n);
      az = portrait ? -0.70 : -0.24; el = portrait ? 0.44 : 0.36;
    } else if (s === S.TIDY || s === S.PLAY) {
      _pts[n++].set(BOARD_X - 1.0, BOARD_TOP, BOARD_Z - 0.5);
      _pts[n++].set(BOARD_X + 1.0, BOARD_TOP + 0.45, BOARD_Z + 0.5);
      n = boxInto(tuna.lower, _pts, n);
      az = portrait ? -0.62 + Math.sin(st.playT * 0.11) * 0.22 : -0.20 + Math.sin(st.playT * 0.11) * 0.20;
      el = portrait ? 0.52 : 0.46;
    } else {
      n = boxInto(tuna.upper, _pts, n);
      _pts[n++].set(BOARD_X - 0.95, BOARD_TOP, BOARD_Z - 0.45);
      _pts[n++].set(BOARD_X + 0.95, BOARD_TOP + 0.4, BOARD_Z + 0.45);
      az = portrait ? -0.66 : -0.22; el = portrait ? 0.50 : 0.44;
    }
    if (s !== S.INTRO) n = craftInto(_pts, n);
    mx = portrait ? 0.88 : 0.86;
    my = portrait ? 0.82 : 0.78;
    shift = portrait ? 0.060 : 0.040;
    return { n, az, el, mx, my, shift, roll: portrait ? 0.10 : 0.0 };
  }

  function updateCamera(dt, portrait, first) {
    const f = framing(portrait);
    if (f.n === 0) return;
    const pts = _pts.slice(0, f.n);
    const target = new THREE.Vector3();
    for (const p of pts) target.add(p);
    target.divideScalar(f.n);

    const dir = new THREE.Vector3(
      Math.sin(f.az) * Math.cos(f.el), Math.sin(f.el), Math.cos(f.az) * Math.cos(f.el),
    );
    camera.up.set(Math.sin(f.roll), Math.cos(f.roll), 0);
    const dist = fitDistance(pts, camera, dir, target, f.mx, f.my);

    const k = first ? 1 : 1 - Math.exp(-2.4 * dt);
    st.camTarget.lerp(target, k);
    st.camDir.lerp(dir, k).normalize();
    st.camDist = lerp(st.camDist, dist, k);
    st.camRoll = lerp(st.camRoll, f.roll, k);

    const viewH = 2 * st.camDist * Math.tan((camera.fov * Math.PI) / 360);
    const look = _tmpV.copy(st.camTarget).addScaledVector(camera.up, -f.shift * viewH);

    camera.up.set(Math.sin(st.camRoll), Math.cos(st.camRoll), 0);
    camera.position.copy(look).addScaledVector(st.camDir, st.camDist);
    // a whisper of handheld life, well under the threshold of distraction
    const w = st.t * 0.6;
    camera.position.x += noise1(w, 1) * 0.012 * st.camDist * 0.2;
    camera.position.y += noise1(w + 30, 2) * 0.010 * st.camDist * 0.2;
    camera.lookAt(look);
  }

  /* =================================================================== *
   *  Craftsman posing helpers
   * =================================================================== */
  const _hA = new THREE.Vector3(), _hB = new THREE.Vector3();

  function handsFromKnife(front) {
    knife.root.updateMatrixWorld(true);
    _hA.copy(knife.gripRear).applyMatrix4(knife.root.matrixWorld);
    _hB.copy(front === 'spine' ? knife.gripFrontSpine : knife.gripFrontHandle).applyMatrix4(knife.root.matrixWorld);
    st.handA.copy(_hA); st.handB.copy(_hB);
  }

  function standBehind(dt, dirX, dirZ, dist) {
    const mid = _tmpV.copy(st.handA).add(st.handB).multiplyScalar(0.5);
    const tx = clamp(mid.x + dirX * dist, -2.5, 2.7);
    const tz = clamp(mid.z + dirZ * dist, -1.75, -0.84);
    st.craftPos.x = damp(st.craftPos.x, tx, 3.2, dt);
    st.craftPos.z = damp(st.craftPos.z, tz, 3.2, dt);
    const fx = -dirX, fz = -dirZ;
    const yaw = Math.atan2(fx, fz);
    let d = yaw - st.craftYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    st.craftYaw += d * (1 - Math.exp(-3.2 * dt));
    craft.root.position.copy(st.craftPos);
    craft.root.rotation.y = st.craftYaw;
  }

  function knifeReady() {
    const b = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1),
    );
    knife.root.quaternion.setFromRotationMatrix(b);
    knife.root.position.set(st.craftPos.x - 0.30, 0.82, st.craftPos.z + 0.46);
  }

  function knifeOnTable() {
    const b = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1),
    );
    knife.root.quaternion.setFromRotationMatrix(b);
    knife.root.position.set(1.42, TABLE.h + 0.012, -0.56);
  }

  function idleHands(dt) {
    // relaxed, hands lightly clasped in front — a craftsman waiting
    const f = new THREE.Vector3(Math.sin(craft.root.rotation.y), 0, Math.cos(craft.root.rotation.y));
    const r = new THREE.Vector3(f.z, 0, -f.x);
    const base = _tmpV.copy(st.craftPos).addScaledVector(f, 0.28).setY(1.02 + Math.sin(st.t * 1.4) * 0.012);
    st.handA.lerp(_hA.copy(base).addScaledVector(r, -0.13), 1 - Math.exp(-5 * dt));
    st.handB.lerp(_hB.copy(base).addScaledVector(r, 0.13), 1 - Math.exp(-5 * dt));
  }

  /* =================================================================== *
   *  Stage transitions
   * =================================================================== */
  function go(stage) {
    st.stage = stage;
    st.sub = 0;
    switch (stage) {
      case S.COLLAR:
        paths.collar.updateWorld();
        guide.setPath(paths.collar);
        kerf.setPath(paths.collar, '#5e1a1c', 0.030);
        stroke.begin(paths.collar);
        break;
      case S.COLLAR_OUT:
        guide.hide();
        // Capture the head's pose here, not on the first frame of the stage:
        // a slow frame can push dt past any "just started" time window.
        tuna.head.updateWorldMatrix(true, false);
        scene.attach(tuna.head);
        st.headFrom = tuna.head.position.clone();
        st.headQ = tuna.head.quaternion.clone();
        audio.thud(0.4); audio.swish(0.35, 0.7);
        sparks.burst(_tmpV.copy(tuna.root.position).add(new THREE.Vector3(0.62, 0.42, 0.12)), 12, 0.32, 0.075, 0.5);
        break;
      case S.ROLL: {
        const c = new THREE.Vector3(tuna.root.position.x, tuna.root.position.y, tuna.root.position.z);
        paths.roll = rollPath(c);
        guide.setPath(paths.roll);
        kerf.hide();
        stroke.begin(paths.roll);
        break;
      }
      case S.ROLL_SET:
        guide.hide();
        audio.thud(0.32);
        break;
      case S.SPINE1:
        paths.spine.updateWorld();
        guide.setPath(paths.spine);
        kerf.setPath(paths.spine, '#5e1a1c', 0.026);
        stroke.begin(paths.spine);
        break;
      case S.SPINE2:
        paths.spine.updateWorld();
        guide.setPath(paths.spine);
        kerf.setPath(paths.spine, '#7c2226', 0.040);
        stroke.begin(paths.spine);
        audio.tone(330, 0.5, 'sine', 0.10, 0, 1.4);
        break;
      case S.LIFT: {
        tuna.segments[0].userData.capRear.visible = true;
        scene.attach(tuna.upper);
        st.liftBaseP = tuna.upper.position.clone();
        st.liftBaseQ = tuna.upper.quaternion.clone();
        // A full half-turn as it comes up: the loin rises AND rolls over, so
        // at the top of the stroke there are two crimson faces on screen at
        // once — the frame's, newly uncovered, and the loin's own, turned to
        // the crowd. That is the moment the whole game is built around.
        st.liftTiltQ = new THREE.Quaternion()
          .setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI).multiply(st.liftBaseQ);
        const c = new THREE.Vector3(
          tuna.root.position.x - 0.05,
          tuna.root.position.y + 0.24,
          tuna.root.position.z + 0.06,
        );
        paths.lift = liftPath(c);
        guide.setPath(paths.lift);
        kerf.hide();
        stroke.begin(paths.lift);
        knifeOnTable();
        break;
      }
      case S.CARRY:
        guide.hide();
        audio.chime(587.33);
        env.board.visible = true;
        st.carryFromP = tuna.upper.position.clone();
        st.carryFromQ = tuna.upper.quaternion.clone();
        st.carryToP = new THREE.Vector3(-0.902, BOARD_TOP + 0.212, BOARD_Z + 0.0195);
        // +90 deg, not -90: the loin's cut face is its local -Z, and it has to
        // finish crimson-side up on the board.
        st.carryToQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        break;
      case S.SAKU0: case S.SAKU1: case S.SAKU2: {
        const i = stage === S.SAKU0 ? 0 : stage === S.SAKU1 ? 1 : 2;
        tuna.segments[i].userData.capFront.visible = true;
        tuna.segments[i + 1].userData.capRear.visible = true;
        const wx = -0.902 + X_OF(SAKU_U[i + 1]);
        paths.saku = sakuPath(wx, BOARD_TOP + 0.238, BOARD_Z - 0.42, BOARD_Z + 0.46);
        guide.setPath(paths.saku);
        kerf.setPath(paths.saku, '#6d1f22', 0.024);
        stroke.begin(paths.saku);
        break;
      }
      case S.TIDY:
        guide.hide(); kerf.hide();
        audio.chime(659.25);
        for (const s of sakus) s.visible = true;
        break;
      case S.PLAY:
        guide.hide();
        audio.chime(783.99);
        for (let i = 0; i < 4; i++) {
          sparks.burst(sakus[i].position.clone().add(new THREE.Vector3(0, 0.10, 0)), 8, 0.16, 0.055, 0.5);
        }
        break;
      default: break;
    }
  }

  /* =================================================================== *
   *  Per-frame
   * =================================================================== */
  const _c = new THREE.Vector3(), _e = new THREE.Vector3(), _al = new THREE.Vector3();
  const _q = new THREE.Quaternion();

  function poseKnifeOnPath(path, p) {
    path.pointAt(p, _c);
    path.edgeAt(p, _e);
    _al.copy(path.bladeWorld);
    const roll = Math.sin(p * Math.PI * 1.7 + 0.4) * path.rollAmp;
    placeKnife(knife, _c, _al, _e, p, path.contact, roll);
  }

  function update(dt, input, w, h, portrait, first) {
    st.t += dt;
    st.sub += dt;
    env.update(dt, camera);

    const p = input.p;
    let strokeActive = false;

    switch (st.stage) {
      /* ------------------------------------------------------ INTRO ---- */
      case S.INTRO: {
        const T = st.sub;
        const slide = easeOutCubic(clamp(T / 2.4, 0, 1));
        tuna.root.position.x = lerp(3.6, 0, slide);
        tuna.root.position.y = REST_BELLY + Math.max(0, Math.sin(clamp((T - 2.1) * 6, 0, Math.PI))) * 0.022;
        if (T > 2.2) { for (const c of chocks) c.visible = true; }
        if (T > 1.0 && T < 1.1) audio.swish(0.25, 0.9);
        if (T > 2.35 && T < 2.45) audio.thud(0.42);

        // he walks up and takes the knife
        st.craftPos.x = damp(st.craftPos.x, T < 2.4 ? 1.75 : 0.95, 1.6, dt);
        st.craftPos.z = damp(st.craftPos.z, T < 2.4 ? -1.35 : -1.02, 1.6, dt);
        st.craftYaw = damp(st.craftYaw, T < 2.4 ? -0.35 : 0.12, 2.2, dt);
        craft.root.position.copy(st.craftPos);
        craft.root.rotation.y = st.craftYaw;

        if (T < 2.6) { knifeOnTable(); idleHands(dt); } else {
          knifeReady();
          handsFromKnife('handle');
        }
        st.look.set(tuna.root.position.x + 0.5, 1.25, 0.05);
        if (T > 4.6) go(S.COLLAR);
        break;
      }

      /* ----------------------------------------------------- COLLAR ---- */
      case S.COLLAR: {
        strokeActive = stroke.update(dt, p, camera, w, h);
        const pr = stroke.s.progress;
        guide.setProgress(pr);
        kerf.setProgress(pr);
        if (strokeActive) guide.stopDemo();
        poseKnifeOnPath(paths.collar, pr);
        handsFromKnife('handle');
        standBehind(dt, -0.45, -0.89, 0.56);
        paths.collar.pointAt(pr, st.look);
        // the collar creeps open as the cut goes home
        tuna.head.position.x = 0.004 + pr * 0.014;
        audio.draw(clamp(stroke.s.velocity / 0.7, 0, 1));
        if (stroke.s.justFinished) go(S.COLLAR_OUT);
        break;
      }

      case S.COLLAR_OUT: {
        const k = easeInOut(clamp(st.sub / 1.9, 0, 1));
        const to = new THREE.Vector3(tuna.root.position.x + 1.14, TABLE.h + 0.30, 0.30);
        tuna.head.position.lerpVectors(st.headFrom, to, k);
        tuna.head.position.y += Math.sin(k * Math.PI) * 0.16;
        _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 1.18 * k);
        tuna.head.quaternion.copy(_q).multiply(st.headQ);
        // his hands carry it across
        st.handA.copy(tuna.head.position).add(new THREE.Vector3(-0.16, 0.02, -0.30));
        st.handB.copy(tuna.head.position).add(new THREE.Vector3(0.20, 0.02, -0.26));
        st.look.copy(tuna.head.position);
        standBehind(dt, -0.2, -1.0, 0.62);
        knifeOnTable();
        audio.draw(0);
        if (st.sub > 2.1) go(S.ROLL);
        break;
      }

      /* ------------------------------------------------------- ROLL ---- */
      case S.ROLL: {
        strokeActive = stroke.update(dt, p, camera, w, h);
        const pr = stroke.s.progress;
        guide.setProgress(pr);
        if (strokeActive) guide.stopDemo();
        st.rollT = damp(st.rollT, pr, 12, dt);
        tuna.root.rotation.x = ROLL_ANGLE * st.rollT;
        tuna.root.position.y = lerp(REST_BELLY, REST_SIDE, st.rollT) + Math.sin(st.rollT * Math.PI) * 0.05;
        for (const c of chocks) c.visible = true;
        // both hands on the far flank, pushing it over
        const ang = tuna.root.rotation.x;
        const cs = Math.cos(ang), sn = Math.sin(ang);
        const ly = 0.255, lz = -0.13;
        const wy = tuna.root.position.y + (ly * cs - lz * sn);
        const wz = tuna.root.position.z + (ly * sn + lz * cs);
        st.handA.set(tuna.root.position.x - 0.44, wy, wz);
        st.handB.set(tuna.root.position.x + 0.40, wy, wz);
        st.look.set(tuna.root.position.x, wy + 0.1, wz);
        standBehind(dt, 0, -1, 0.60);
        knifeOnTable();
        if (strokeActive) audio.draw(clamp(stroke.s.velocity / 1.2, 0, 0.5));
        else audio.draw(0);
        if (stroke.s.justFinished) go(S.ROLL_SET);
        break;
      }

      case S.ROLL_SET: {
        st.rollT = damp(st.rollT, 1, 10, dt);
        tuna.root.rotation.x = ROLL_ANGLE * st.rollT;
        tuna.root.position.y = damp(tuna.root.position.y, REST_SIDE, 9, dt);
        idleHands(dt);
        standBehind(dt, 0, -1, 0.60);
        st.look.set(tuna.root.position.x, tuna.root.position.y + 0.3, tuna.root.position.z);
        knifeOnTable();
        if (st.sub > 0.85) {
          paths.spine.updateWorld();
          go(S.SPINE1);
        }
        break;
      }

      /* ------------------------------------------------------ SPINE ---- */
      case S.SPINE1: case S.SPINE2: {
        strokeActive = stroke.update(dt, p, camera, w, h);
        const pr = stroke.s.progress;
        guide.setProgress(pr);
        kerf.setProgress(pr);
        if (strokeActive) guide.stopDemo();
        poseKnifeOnPath(paths.spine, pr);
        handsFromKnife('spine');
        standBehind(dt, 0, -1, 0.62);
        paths.spine.pointAt(pr, st.look);
        const pass = st.stage === S.SPINE1 ? 0 : 1;
        st.cutDepth[pass] = Math.max(st.cutDepth[pass], pr);
        // on the second pass the loin visibly begins to come away
        if (pass === 1) {
          st.loinGap = pr * 0.020;
          tuna.upper.position.z = -0.0012 + st.loinGap;
        }
        audio.draw(clamp(stroke.s.velocity / 0.8, 0, 1));
        if (stroke.s.justFinished) {
          if (pass === 0) go(S.SPINE2);
          else { audio.swish(0.3, 0.8); go(S.LIFT); }
        }
        break;
      }

      /* ------------------------------------------------------- LIFT ---- */
      case S.LIFT: {
        strokeActive = stroke.update(dt, p, camera, w, h);
        const pr = stroke.s.progress;
        guide.setProgress(pr);
        if (strokeActive) guide.stopDemo();
        st.lift = damp(st.lift, pr, 9, dt);
        const e = easeOutCubic(st.lift);
        // it separates along the cut plane's normal — up and toward the crowd
        tuna.upper.position.copy(st.liftBaseP)
          .add(new THREE.Vector3(0.02 * e, 0.60 * e, 0.08 * e));
        tuna.upper.quaternion.copy(st.liftBaseQ).slerp(st.liftTiltQ, e);

        // hands grip the cut edge of the loin, one at each end
        tuna.upper.updateMatrixWorld(true);
        st.handA.set(X_OF(0.28), 0.125, 0.095).applyMatrix4(tuna.upper.matrixWorld);
        st.handB.set(X_OF(0.54), 0.125, 0.095).applyMatrix4(tuna.upper.matrixWorld);
        st.look.set(X_OF(0.45), 0.10, 0.05).applyMatrix4(tuna.upper.matrixWorld);
        standBehind(dt, -0.62, -0.79, 0.74);

        revealLight.intensity = e * 1.6;
        revealLight.position.set(tuna.root.position.x, tuna.root.position.y + 0.85, 0.45);
        if (st.lift > 0.14 && st.revealBoost < 0.5) {
          st.revealBoost = 1;
          audio.swish(0.42, 1.15);
          audio.tone(392, 0.9, 'sine', 0.12, 0.1, 1.6);
          sparks.burst(
            new THREE.Vector3(tuna.root.position.x, tuna.root.position.y + 0.25, tuna.root.position.z - 0.1),
            18, 0.85, 0.085, 0.35,
          );
        }
        audio.draw(clamp(stroke.s.velocity / 1.1, 0, 0.7) * (1 - e));
        if (stroke.s.justFinished) go(S.CARRY);
        break;
      }

      case S.CARRY: {
        const k = easeInOut(clamp(st.sub / 2.3, 0, 1));
        tuna.upper.position.lerpVectors(st.carryFromP, st.carryToP, k);
        tuna.upper.position.y += Math.sin(k * Math.PI) * 0.14;
        tuna.upper.quaternion.copy(st.carryFromQ).slerp(st.carryToQ, easeInOut(clamp((st.sub - 0.25) / 1.85, 0, 1)));
        tuna.upper.updateMatrixWorld(true);
        st.handA.set(X_OF(0.28), 0.125, 0.095).applyMatrix4(tuna.upper.matrixWorld);
        st.handB.set(X_OF(0.54), 0.125, 0.095).applyMatrix4(tuna.upper.matrixWorld);
        st.look.copy(tuna.upper.position).add(new THREE.Vector3(0, 0.1, 0));
        standBehind(dt, 0, -1, 0.60);
        revealLight.intensity = damp(revealLight.intensity, 1.1, 1.5, dt);
        if (st.sub > 2.55) { audio.thud(0.24); go(S.SAKU0); }
        break;
      }

      /* ------------------------------------------------------- SAKU ---- */
      case S.SAKU0: case S.SAKU1: case S.SAKU2: {
        const i = st.stage === S.SAKU0 ? 0 : st.stage === S.SAKU1 ? 1 : 2;
        strokeActive = stroke.update(dt, p, camera, w, h);
        const pr = stroke.s.progress;
        guide.setProgress(pr);
        kerf.setProgress(pr);
        if (strokeActive) guide.stopDemo();
        poseKnifeOnPath(paths.saku, pr);
        handsFromKnife('handle');
        standBehind(dt, 0, -1, 0.60);
        paths.saku.pointAt(pr, st.look);
        // the pieces either side of the fresh cut ease apart as it goes through
        for (let j = 0; j < 4; j++) {
          const target = st.sepBase[j] + (j <= i ? -1 : 1) * 0.026 * pr;
          st.sakuSep[j] = damp(st.sakuSep[j], target, 10, dt);
          tuna.segments[j].position.x = st.sakuSep[j];
        }
        audio.draw(clamp(stroke.s.velocity / 0.55, 0, 1));
        if (stroke.s.justFinished) {
          for (let j = 0; j < 4; j++) st.sepBase[j] += (j <= i ? -1 : 1) * 0.026;
          audio.thud(0.18);
          sparks.burst(_tmpV.copy(st.look).add(new THREE.Vector3(0, 0.1, 0)), 7, 0.2, 0.055, 0.5);
          go(i === 0 ? S.SAKU1 : i === 1 ? S.SAKU2 : S.TIDY);
        }
        break;
      }

      /* ------------------------------------------------------- TIDY ---- */
      case S.TIDY: {
        const k = clamp(st.sub / 1.5, 0, 1);
        const shrink = clamp((k - 0.1) / 0.45, 0, 1);
        for (let j = 0; j < 4; j++) {
          const s2 = Math.max(0.0001, 1 - easeInOut(shrink));
          tuna.segments[j].scale.setScalar(s2);
          tuna.segments[j].visible = s2 > 0.02;
        }
        const grow = clamp((k - 0.42) / 0.5, 0, 1);
        for (let j = 0; j < 4; j++) {
          const g = easeOutCubic(clamp(grow - j * 0.06, 0, 1));
          sakus[j].scale.setScalar(Math.max(0.001, g));
          sakus[j].position.y = BOARD_TOP + 0.078 + (1 - g) * 0.22;
          if (g > 0.02 && !sakus[j].userData.popped) {
            sakus[j].userData.popped = true;
            audio.blip(j);
            sparks.burst(sakus[j].userData.home.clone().add(new THREE.Vector3(0, 0.06, 0)), 8, 0.16, 0.055, 0.6);
          }
        }
        idleHands(dt);
        standBehind(dt, 0, -1, 0.66);
        st.look.set(BOARD_X, BOARD_TOP + 0.2, BOARD_Z);
        knifeOnTable();
        revealLight.intensity = damp(revealLight.intensity, 0.8, 2, dt);
        if (st.sub > 2.0) go(S.PLAY);
        break;
      }

      /* ------------------------------------------------------- PLAY ---- */
      case S.PLAY: {
        st.playT += dt;
        if (p.tap) {
          // pick the nearest block on screen
          let best = 1e9, bi = -1;
          for (let i = 0; i < 4; i++) {
            _tmpV.copy(sakus[i].userData.home).add(new THREE.Vector3(0, 0.06, 0)).project(camera);
            const sx = (_tmpV.x * 0.5 + 0.5) * w, sy = (-_tmpV.y * 0.5 + 0.5) * h;
            const d = Math.hypot(sx - p.x, sy - p.y);
            if (d < best) { best = d; bi = i; }
          }
          if (bi >= 0 && best < Math.min(w, h) * 0.42) {
            sakus[bi].userData.pop = 1;
            audio.blip(bi);
            sparks.burst(sakus[bi].userData.home.clone().add(new THREE.Vector3(0, 0.12, 0)), 12, 0.14, 0.06, 0.8);
          }
        }
        for (let i = 0; i < 4; i++) {
          const u = sakus[i].userData;
          u.pop = damp(u.pop, 0, 2.2, dt);
          const bob = Math.sin(st.playT * 1.6 + i * 1.3) * 0.006;
          sakus[i].position.copy(u.home);
          sakus[i].position.y += bob + u.pop * 0.16;
          sakus[i].rotation.y = u.pop * 2.4 + Math.sin(st.playT * 0.5 + i) * 0.03;
          sakus[i].rotation.z = u.pop * 0.16;
          sakus[i].scale.setScalar(1 + u.pop * 0.08);
        }
        idleHands(dt);
        standBehind(dt, 0, -1, 0.72);
        st.look.set(BOARD_X, BOARD_TOP + 0.25, BOARD_Z + 0.2);
        knifeOnTable();
        break;
      }
      default: break;
    }

    craft.update(dt, { handA: st.handA, handB: st.handB, look: st.look, effort: strokeActive ? 0.9 : 0.35 });
    guide.update(dt, camera);
    kerf.update(dt);
    sparks.update(dt);
    updateCamera(dt, portrait, first);

    return strokeActive;
  }

  return {
    update, restart, env, tuna, knife, craft, guide, sakus, state: st,
    get stage() { return st.stage; },
    /** Active stroke path, for the automated play-through. */
    activePath: () => (guide.state.visible ? stroke.s.path : null),
    strokeProgress: () => stroke.s.progress,
    /** Screen position of a point on the live path — the finger's aim point. */
    pathScreen(t, w, h) {
      const path = stroke.s.path;
      if (!path) return null;
      path.project(camera, w, h);
      const s2 = path._seg(clamp(t, 0, 1));
      return [lerp(path.sx[s2.i], path.sx[s2.j], s2.f), lerp(path.sy[s2.i], path.sy[s2.j], s2.f)];
    },
    sakuScreen(i, w, h) {
      _tmpV.copy(sakus[i].position).add(new THREE.Vector3(0, 0.06, 0)).project(camera);
      return [(_tmpV.x * 0.5 + 0.5) * w, (-_tmpV.y * 0.5 + 0.5) * h];
    },
  };
}
