// ---------------------------------------------------------------------------
//  The craftsman. 1.76 m tall — he is the ruler the player measures the fish
//  against, so his proportions are held to real dimensions.
//
//  Everything the player's finger does is routed through him: the finger only
//  ever indicates the line, and this rig is what actually holds the steel.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { clamp, lerp, damp, solveIK, aimBone, noise1 } from './util.js';
import { clothTexture } from './textures.js';

const HEIGHT = 1.76;
const HIP_Y = 0.935;
const SHOULDER_Y = 1.415;
const SHOULDER_W = 0.192;
const UPPER_ARM = 0.300;
const FOREARM = 0.288;
const THIGH = 0.445;
const SHIN = 0.430;
const STANCE = 0.30;

function capsule(r, len, mat, seg = 12) {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, seg);
  const m = new THREE.Mesh(g, mat);
  m.userData.boneLen = len + 2 * r;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function createCraftsman() {
  const matCoat = new THREE.MeshStandardMaterial({
    color: '#f4f2ec', map: clothTexture('#f6f5f0', 3), roughness: 0.83, envMapIntensity: 0.55,
  });
  const matApron = new THREE.MeshStandardMaterial({
    color: '#26374a', map: clothTexture('#dfe4ea', 11), roughness: 0.78, envMapIntensity: 0.5,
  });
  const matTrouser = new THREE.MeshStandardMaterial({ color: '#2c3a4a', roughness: 0.85, envMapIntensity: 0.45 });
  const matBoot = new THREE.MeshStandardMaterial({ color: '#20242a', roughness: 0.42, envMapIntensity: 0.7 });
  const matSkin = new THREE.MeshStandardMaterial({ color: '#d9a884', roughness: 0.62, envMapIntensity: 0.6 });
  const matDark = new THREE.MeshStandardMaterial({ color: '#2a2723', roughness: 0.7 });
  const matGlove = new THREE.MeshStandardMaterial({ color: '#eef0ee', roughness: 0.7, envMapIntensity: 0.5 });

  const root = new THREE.Group();
  root.name = 'craftsman';

  /* ---------------- torso hierarchy ---------------- */
  const pelvis = new THREE.Group();
  pelvis.position.y = HIP_Y;
  root.add(pelvis);

  const hips = capsule(0.135, 0.10, matTrouser, 16);
  hips.scale.set(1.18, 1, 0.80);
  pelvis.add(hips);

  const chest = new THREE.Group();
  chest.position.y = 0.10;
  pelvis.add(chest);

  const torso = capsule(0.152, 0.30, matCoat, 18);
  torso.position.y = 0.19;
  torso.scale.set(1.24, 1, 0.74);
  chest.add(torso);

  // apron: a curved panel, not a flat plane — it catches the key light
  const apron = new THREE.Mesh(
    new THREE.CylinderGeometry(0.205, 0.255, 0.62, 20, 1, true, -0.95, 1.9),
    matApron,
  );
  apron.position.set(0, -0.215, 0.014);
  apron.scale.set(1.0, 1, 0.74);
  apron.material.side = THREE.DoubleSide;
  apron.castShadow = true;
  chest.add(apron);
  const bib = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.30, 0.014), matApron);
  bib.position.set(0, 0.155, 0.118);
  bib.castShadow = true;
  chest.add(bib);
  for (const s of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.22, 0.010), matApron);
    strap.position.set(s * 0.105, 0.325, 0.078);
    strap.rotation.x = -0.30; strap.rotation.z = s * 0.20;
    chest.add(strap);
  }
  // waist tie
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.016, 6, 20), matApron);
  tie.position.set(0, -0.055, 0);
  tie.rotation.x = Math.PI / 2;
  tie.scale.set(1.12, 1, 0.8);
  chest.add(tie);

  const neck = capsule(0.048, 0.07, matSkin, 10);
  neck.position.y = SHOULDER_Y - HIP_Y - 0.10 + 0.035;
  chest.add(neck);

  const headPivot = new THREE.Group();
  headPivot.position.y = SHOULDER_Y - HIP_Y - 0.10 + 0.105;
  chest.add(headPivot);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.107, 22, 18), matSkin);
  head.scale.set(0.94, 1.06, 0.97);
  head.castShadow = true;
  headPivot.add(head);

  // white market cap
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.116, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), matCoat);
  cap.position.y = 0.016;
  cap.scale.set(1.0, 0.92, 1.0);
  cap.castShadow = true;
  headPivot.add(cap);
  const capBand = new THREE.Mesh(new THREE.CylinderGeometry(0.1155, 0.1155, 0.036, 22), matCoat);
  capBand.position.y = 0.038;
  headPivot.add(capBand);

  // face: two calm eyes and brows, enough to read as a friendly person
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 10, 8), matDark);
    eye.position.set(s * 0.040, 0.008, 0.094);
    headPivot.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.010, 0.008), matDark);
    brow.position.set(s * 0.043, 0.040, 0.092);
    brow.rotation.z = -s * 0.16;
    headPivot.add(brow);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), matSkin);
    ear.position.set(s * 0.098, -0.004, 0.006);
    ear.scale.set(0.45, 1, 0.7);
    headPivot.add(ear);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8), matSkin);
  nose.position.set(0, -0.014, 0.100);
  nose.scale.set(0.8, 1.1, 1.0);
  headPivot.add(nose);

  /* ---------------- limbs (root-local, solved each frame) ---------------- */
  const arms = [];
  for (let i = 0; i < 2; i++) {
    const up = capsule(0.060, UPPER_ARM - 0.12, matCoat, 12);
    const fo = capsule(0.050, FOREARM - 0.10, matCoat, 12);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.052, 0.055, 12), matApron);
    cuff.userData.boneLen = 1;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), matGlove);
    hand.scale.set(1.0, 0.78, 1.25);
    hand.castShadow = true;
    const shoulderPad = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12), matCoat);
    shoulderPad.castShadow = true;
    root.add(up, fo, hand, cuff, shoulderPad);
    arms.push({ up, fo, hand, cuff, shoulderPad, elbow: new THREE.Vector3(), shoulder: new THREE.Vector3() });
  }

  const legs = [];
  for (let i = 0; i < 2; i++) {
    const th = capsule(0.085, THIGH - 0.17, matTrouser, 12);
    const sh = capsule(0.072, SHIN - 0.14, matBoot, 12);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.075, 0.255), matBoot);
    boot.castShadow = true; boot.receiveShadow = true;
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.076, 12, 10), matTrouser);
    root.add(th, sh, boot, knee);
    legs.push({
      th, sh, boot, knee,
      foot: new THREE.Vector3(),          // world
      footTarget: new THREE.Vector3(),
      stepT: 1, stepFrom: new THREE.Vector3(), stepTo: new THREE.Vector3(),
    });
  }

  /* ---------------- state ---------------- */
  const st = {
    crouch: 0, pitch: 0, yaw: 0, twist: 0, breathe: 0,
    initialised: false, time: 0,
  };

  const _wa = new THREE.Vector3(), _wb = new THREE.Vector3();
  const _la = new THREE.Vector3(), _lb = new THREE.Vector3();
  const _sh = new THREE.Vector3(), _pole = new THREE.Vector3();
  const _tmp = new THREE.Vector3(), _tmp2 = new THREE.Vector3();
  const _look = new THREE.Vector3();

  /**
   * @param dt      seconds
   * @param o.handA world position for one hand (usually the handle)
   * @param o.handB world position for the other hand
   * @param o.look  world position to face
   * @param o.effort 0..1 — how much he braces into the work
   */
  function update(dt, o) {
    st.time += dt;
    const handA = o.handA, handB = o.handB;
    root.updateMatrixWorld(true);

    // ----- feet: he walks the length of the fish rather than over-reaching --
    for (let i = 0; i < 2; i++) {
      const L = legs[i];
      const side = i === 0 ? -1 : 1;
      L.footTarget.set(side * STANCE * 0.5, 0, side === -1 ? -0.05 : 0.05)
        .applyMatrix4(root.matrixWorld);
      L.footTarget.y = 0;
      if (!st.initialised) { L.foot.copy(L.footTarget); L.stepT = 1; }
      if (L.stepT >= 1 && L.foot.distanceTo(L.footTarget) > 0.24) {
        L.stepFrom.copy(L.foot);
        L.stepTo.copy(L.footTarget);
        L.stepT = 0;
      }
      if (L.stepT < 1) {
        L.stepT = Math.min(1, L.stepT + dt * 2.6);
        const t = L.stepT;
        L.foot.lerpVectors(L.stepFrom, L.stepTo, t * t * (3 - 2 * t));
        L.foot.y = Math.sin(t * Math.PI) * 0.055;
      } else {
        L.foot.y = 0;
      }
    }
    st.initialised = true;

    // ----- torso: crouch, lean and turn toward the work -----
    root.worldToLocal(_la.copy(handA));
    root.worldToLocal(_lb.copy(handB));
    const midY = (_la.y + _lb.y) * 0.5;
    const midZ = (_la.z + _lb.z) * 0.5;
    const midX = (_la.x + _lb.x) * 0.5;

    const effort = o.effort ?? 0.4;
    const crouchT = clamp((1.16 - midY) * 0.52, 0, 0.235) + effort * 0.03;
    const pitchT = clamp((midZ - 0.16) * 0.62 + effort * 0.16, -0.05, 0.62);
    const yawT = Math.atan2(midX, Math.max(0.55, midZ + 0.72)) * 0.72;
    const twistT = clamp((_la.x - _lb.x) * 0.16, -0.28, 0.28);

    st.crouch = damp(st.crouch, crouchT, 7, dt);
    st.pitch = damp(st.pitch, pitchT, 7, dt);
    st.yaw = damp(st.yaw, yawT, 7, dt);
    st.twist = damp(st.twist, twistT, 6, dt);
    st.breathe = Math.sin(st.time * 1.5) * 0.008 + noise1(st.time * 0.35, 4) * 0.006;

    pelvis.position.set(midX * 0.10, HIP_Y - st.crouch + st.breathe, -st.pitch * 0.055);
    pelvis.rotation.set(0, st.yaw * 0.55, 0);
    chest.rotation.set(st.pitch, st.yaw * 0.45 + st.twist, -st.twist * 0.35);

    // head tracks the blade, not the player
    _look.copy(o.look || handB);
    root.worldToLocal(_look);
    headPivot.rotation.set(
      clamp(Math.atan2(-(_look.y - 1.5), Math.max(0.3, _look.z + 0.5)) * 0.55, -0.55, 0.35) - st.pitch * 0.55,
      clamp(Math.atan2(_look.x - midX * 0.1, Math.max(0.4, _look.z + 0.6)) * 0.6 - st.yaw * 0.6, -0.7, 0.7),
      0,
    );

    // ----- arms -----
    root.updateMatrixWorld(true);
    // hand with the smaller local x goes to his right arm (he faces +Z)
    const rightIsA = _la.x < _lb.x;
    const targets = [rightIsA ? _la : _lb, rightIsA ? _lb : _la];
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;            // -1 right, +1 left (local X)
      const A = arms[i];
      _sh.set(side * SHOULDER_W, SHOULDER_Y - HIP_Y - 0.10, 0);
      chest.localToWorld(_sh);
      root.worldToLocal(_sh);
      A.shoulder.copy(_sh);

      const target = targets[i];
      _pole.set(side * 1.0, -0.75, -0.30).normalize();
      solveIK(A.shoulder, target, UPPER_ARM, FOREARM, _pole, A.elbow);

      aimBone(A.up, A.shoulder, A.elbow);
      aimBone(A.fo, A.elbow, target);
      A.shoulderPad.position.copy(A.shoulder);
      A.cuff.position.copy(A.elbow).lerp(target, 0.78);
      A.cuff.quaternion.copy(A.fo.quaternion);
      A.hand.position.copy(target);
      _tmp.copy(target).sub(A.elbow).normalize();
      A.hand.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _tmp);
    }

    // ----- legs -----
    for (let i = 0; i < 2; i++) {
      const L = legs[i];
      const side = i === 0 ? -1 : 1;
      _tmp.set(side * 0.098, 0, 0);
      pelvis.localToWorld(_tmp);
      root.worldToLocal(_tmp);
      _tmp2.copy(L.foot);
      root.worldToLocal(_tmp2);
      _tmp2.y += 0.085;
      _pole.set(side * 0.28, 0, 1).normalize();
      const knee = new THREE.Vector3();
      solveIK(_tmp, _tmp2, THIGH, SHIN, _pole, knee);
      aimBone(L.th, _tmp, knee);
      aimBone(L.sh, knee, _tmp2);
      L.knee.position.copy(knee);
      L.boot.position.copy(_tmp2).add(new THREE.Vector3(0, -0.048, 0.045));
      L.boot.rotation.set(0, root.rotation.y * 0 + side * 0.10, 0);
    }
  }

  function placeFeetNow() { st.initialised = false; }

  return { root, update, placeFeetNow, height: HEIGHT, headPivot, chest, arms, legs };
}
