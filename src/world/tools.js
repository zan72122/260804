// 丸みのある玩具風の道具たち。すべて実ジオメトリで作る。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeTapeTexture, makeSoftCircleTexture, makePatternTexture } from '../core/materials.js';
import { clamp, lerp } from '../core/util.js';

const metal = (color = '#d7dde4', rough = 0.28) =>
  new THREE.MeshStandardMaterial({ color, metalness: 0.92, roughness: rough, envMapIntensity: 1.1 });
const plastic = (color, rough = 0.45) =>
  new THREE.MeshStandardMaterial({ color, metalness: 0.02, roughness: rough, envMapIntensity: 0.9 });
const rubber = (color, rough = 0.85) =>
  new THREE.MeshStandardMaterial({ color, metalness: 0.0, roughness: rough });

function rbox(w, h, d, r = 0.01, mat) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, Math.min(w, h, d) * 0.48)), mat);
  m.castShadow = true;
  return m;
}
function cyl(rt, rb, h, seg, mat, cap = true) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !cap), mat);
  m.castShadow = true;
  return m;
}

/* ------------------------- 巻き尺 ------------------------- */
export function makeTapeMeasure() {
  const g = new THREE.Group();
  const body = rbox(0.085, 0.075, 0.045, 0.018, plastic('#ffd23f', 0.4));
  g.add(body);
  const face = rbox(0.055, 0.05, 0.048, 0.014, plastic('#ff8a3d', 0.35));
  face.position.z = 0.001;
  g.add(face);
  const clip = rbox(0.02, 0.05, 0.012, 0.005, metal('#c8ced6'));
  clip.position.set(0.045, 0.0, 0.028);
  g.add(clip);
  const lip = rbox(0.03, 0.012, 0.05, 0.005, plastic('#e8e8e8'));
  lip.position.set(-0.05, -0.02, 0);
  g.add(lip);

  // テープ本体（アンカーからケースへ伸びる帯）
  const tex = makeTapeTexture();
  const tapeMat = new THREE.MeshStandardMaterial({
    map: tex, color: '#ffffff', roughness: 0.55, metalness: 0.0, side: THREE.DoubleSide,
  });
  const seg = 24;
  const tape = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.05, seg, 1), tapeMat);
  tape.castShadow = false;
  const tapeGroup = new THREE.Group();
  tapeGroup.add(tape);

  // フック（板の端に引っ掛ける金具）
  const hook = new THREE.Group();
  const hookPlate = rbox(0.006, 0.03, 0.05, 0.002, metal('#e6ebf0', 0.22));
  hook.add(hookPlate);
  const hookLip = rbox(0.016, 0.006, 0.05, 0.002, metal('#e6ebf0', 0.22));
  hookLip.position.set(0.006, -0.012, 0);
  hook.add(hookLip);

  const grip = new THREE.Object3D();
  grip.position.set(0.02, -0.03, 0.04);
  g.add(grip);

  return { group: g, body: g, tape, tapeGroup, tapeMat, hook, grip, texture: tex };
}

/** テープをアンカー(a)からケース(b)まで張る */
export function layTape(tapeMesh, a, b, width = 0.05) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 0.0005) { tapeMesh.visible = false; return; }
  tapeMesh.visible = true;
  const pos = tapeMesh.geometry.attributes.position;
  const seg = tapeMesh.geometry.parameters.widthSegments;
  // わずかに反った帯（金属テープらしいたわみ）
  for (let i = 0; i <= seg; i++) {
    for (let j = 0; j < 2; j++) {
      const idx = j * (seg + 1) + i;
      const t = i / seg;
      pos.setX(idx, (t - 0.5) * len);
      pos.setY(idx, (j === 0 ? 0.5 : -0.5) * width);
      pos.setZ(idx, -Math.sin(t * Math.PI) * 0.008 - 0.004);
    }
  }
  pos.needsUpdate = true;
  tapeMesh.geometry.computeVertexNormals();
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  tapeMesh.parent.position.copy(mid);
  const angle = Math.atan2(dir.z, dir.x);
  tapeMesh.parent.rotation.set(-Math.PI / 2, 0, -angle, 'XYZ');
  tapeMesh.material.map.repeat.set(Math.max(0.5, len * 4.2), 1);
  tapeMesh.material.map.offset.set(0, 0);
}

/* ------------------------- 鉛筆 ------------------------- */
export function makePencil() {
  const g = new THREE.Group();
  const body = cyl(0.008, 0.008, 0.135, 6, plastic('#ffb23f', 0.5));
  body.position.y = 0.075;
  g.add(body);
  const tipWood = cyl(0.008, 0.0035, 0.018, 6, plastic('#f0d9a8', 0.7));
  tipWood.position.y = 0.009;
  g.add(tipWood);
  const lead = cyl(0.0035, 0.0006, 0.008, 6, rubber('#3a3026'));
  lead.position.y = 0.0015;
  g.add(lead);
  const band = cyl(0.0085, 0.0085, 0.014, 6, metal('#c9ced6', 0.3));
  band.position.y = 0.145;
  g.add(band);
  const eraser = cyl(0.0082, 0.0082, 0.012, 6, rubber('#ff8fa6'));
  eraser.position.y = 0.157;
  g.add(eraser);
  const grip = new THREE.Object3D();
  grip.position.set(0, 0.085, 0.012);
  g.add(grip);
  g.userData.tipOffset = new THREE.Vector3(0, 0, 0);
  return { group: g, grip };
}

/* ------------------------- クランプ ------------------------- */
export function makeClamp() {
  const g = new THREE.Group();
  const frameMat = plastic('#3d8ef0', 0.42);
  // C 型のフレーム
  const back = rbox(0.022, 0.16, 0.05, 0.008, frameMat);
  back.position.set(-0.07, 0.02, 0);
  g.add(back);
  const bottom = rbox(0.15, 0.022, 0.05, 0.008, frameMat);
  bottom.position.set(0, -0.058, 0);
  g.add(bottom);
  const top = rbox(0.15, 0.022, 0.05, 0.008, frameMat);
  top.position.set(0, 0.09, 0);
  g.add(top);

  // 可動部（下がって板を押さえる）
  const jaw = new THREE.Group();
  const shaft = cyl(0.008, 0.008, 0.09, 12, metal('#cfd6de', 0.3));
  shaft.position.y = 0.045;
  jaw.add(shaft);
  const pad = rbox(0.05, 0.016, 0.05, 0.006, rubber('#ff7043'));
  jaw.add(pad);
  // 大きな取っ手（回す）
  const knob = new THREE.Group();
  const knobBody = cyl(0.038, 0.034, 0.022, 20, plastic('#ff5f6d', 0.35));
  knob.add(knobBody);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const grip = rbox(0.012, 0.026, 0.02, 0.006, plastic('#ff8a94', 0.4));
    grip.position.set(Math.cos(a) * 0.036, 0, Math.sin(a) * 0.036);
    grip.rotation.y = -a;
    knob.add(grip);
  }
  const cap = cyl(0.014, 0.014, 0.028, 12, plastic('#ffd166', 0.35));
  cap.position.y = 0.014;
  knob.add(cap);
  knob.position.y = 0.10;
  jaw.add(knob);
  jaw.position.y = 0.07;
  g.add(jaw);

  return { group: g, jaw, knob, knobWorldOffset: new THREE.Vector3(0, 0.17, 0) };
}

/* ------------------------- のこぎり ------------------------- */
function makeTeethTexture() {
  const W = 128, H = 32;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#ffffff';
  g.beginPath();
  const n = 16;
  for (let i = 0; i < n; i++) {
    const x = (i / n) * W;
    g.moveTo(x, 0);
    g.lineTo(x + W / n, 0);
    g.lineTo(x + W / n / 2, H * 0.85);
    g.closePath();
  }
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function makeSaw() {
  const g = new THREE.Group();
  const bladeLen = 0.34, bladeH = 0.075;
  const blade = rbox(bladeLen, bladeH, 0.004, 0.002, metal('#e3e9f0', 0.18));
  blade.position.set(0, 0.0, 0);
  g.add(blade);
  // 刃先（歯）
  const teeth = new THREE.Mesh(
    new THREE.PlaneGeometry(bladeLen, 0.014),
    new THREE.MeshStandardMaterial({
      map: makeTeethTexture(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide,
      metalness: 0.9, roughness: 0.2, color: '#f2f6fa',
    }),
  );
  teeth.material.map.repeat.set(9, 1);
  teeth.position.set(0, -bladeH / 2 - 0.006, 0);
  g.add(teeth);

  // 安全カバー（歯の大部分を包む半透明のガード）
  const guard = new THREE.Mesh(
    new RoundedBoxGeometry(bladeLen * 0.98, 0.03, 0.022, 3, 0.01),
    new THREE.MeshPhysicalMaterial({
      color: '#ff9f43', transparent: true, opacity: 0.55, roughness: 0.25,
      transmission: 0.35, thickness: 0.02, metalness: 0,
    }),
  );
  guard.position.set(0, -bladeH / 2 - 0.002, 0);
  g.add(guard);

  // 背の補強
  const spine = rbox(bladeLen, 0.012, 0.01, 0.005, plastic('#3d8ef0', 0.4));
  spine.position.set(0, bladeH / 2 + 0.004, 0);
  g.add(spine);

  // 握り
  const handle = new THREE.Group();
  const hMain = rbox(0.085, 0.105, 0.032, 0.026, plastic('#ff5f6d', 0.38));
  handle.add(hMain);
  const hole = new THREE.Mesh(
    new THREE.TorusGeometry(0.03, 0.014, 10, 20),
    plastic('#ff5f6d', 0.38),
  );
  hole.rotation.y = Math.PI / 2;
  hole.position.set(0.0, 0.0, 0);
  handle.add(hole);
  handle.position.set(bladeLen / 2 + 0.05, 0.012, 0);
  g.add(handle);

  const grip = new THREE.Object3D();
  grip.position.set(bladeLen / 2 + 0.05, 0.012, 0.03);
  g.add(grip);
  return { group: g, blade, teeth, guard, handle, grip, bladeLen };
}

/* ------------------------- 紙やすり ------------------------- */
function makeGritTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#8a5c3a';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2200; i++) {
    g.fillStyle = Math.random() > 0.5 ? 'rgba(60,38,22,0.6)' : 'rgba(180,140,100,0.5)';
    g.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function makeSander() {
  const g = new THREE.Group();
  const block = rbox(0.09, 0.045, 0.065, 0.014, plastic('#7ac7a5', 0.5));
  block.position.y = 0.026;
  g.add(block);
  const paper = new THREE.Mesh(
    new THREE.BoxGeometry(0.094, 0.008, 0.069),
    new THREE.MeshStandardMaterial({ map: makeGritTexture(), roughness: 1, metalness: 0 }),
  );
  paper.position.y = 0.001;
  paper.castShadow = true;
  g.add(paper);
  const knob = rbox(0.05, 0.022, 0.03, 0.011, plastic('#ffd166', 0.45));
  knob.position.y = 0.056;
  g.add(knob);
  const grip = new THREE.Object3D();
  grip.position.set(0, 0.06, 0.02);
  g.add(grip);
  return { group: g, grip, paper };
}

/* ------------------------- 金づち ------------------------- */
export function makeHammer() {
  const g = new THREE.Group();
  const handle = cyl(0.014, 0.017, 0.20, 12, plastic('#c9822f', 0.55));
  handle.position.y = -0.10;
  g.add(handle);
  const gripWrap = cyl(0.019, 0.019, 0.08, 12, rubber('#3d8ef0'));
  gripWrap.position.y = -0.15;
  g.add(gripWrap);
  const head = rbox(0.055, 0.042, 0.042, 0.012, metal('#b9c1cb', 0.3));
  g.add(head);
  const strike = cyl(0.021, 0.023, 0.022, 16, metal('#dfe5ec', 0.2));
  strike.rotation.z = Math.PI / 2;
  strike.position.x = -0.036;
  g.add(strike);
  // 釘抜き
  const claw = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 8, 14, Math.PI * 0.75), metal('#aab2bd', 0.35));
  claw.rotation.set(0, Math.PI / 2, Math.PI * 0.62);
  claw.position.set(0.042, -0.006, 0);
  g.add(claw);
  const grip = new THREE.Object3D();
  grip.position.set(0, -0.145, 0.02);
  g.add(grip);
  return { group: g, grip, head };
}

/* ------------------------- 刷毛 ------------------------- */
export function makeBrush(color = '#ffb3d1') {
  const g = new THREE.Group();
  const handle = rbox(0.026, 0.11, 0.014, 0.01, plastic('#f0a04b', 0.5));
  handle.position.y = 0.095;
  g.add(handle);
  const ferrule = rbox(0.05, 0.03, 0.018, 0.005, metal('#cfd6de', 0.3));
  ferrule.position.y = 0.032;
  g.add(ferrule);
  const bristles = rbox(0.052, 0.045, 0.018, 0.006, new THREE.MeshStandardMaterial({ color: '#f3e2c7', roughness: 0.9 }));
  bristles.position.y = 0.0;
  g.add(bristles);
  const tip = rbox(0.052, 0.012, 0.019, 0.005, new THREE.MeshStandardMaterial({ color, roughness: 0.55 }));
  tip.position.y = -0.019;
  g.add(tip);
  const grip = new THREE.Object3D();
  grip.position.set(0, 0.1, 0.02);
  g.add(grip);
  return { group: g, grip, tip, bristles };
}

/* ------------------------- 釘 ------------------------- */
export function makeNail() {
  const g = new THREE.Group();
  const shaft = cyl(0.0035, 0.0035, 0.055, 10, metal('#c8ced6', 0.25));
  shaft.position.y = 0.0275;
  g.add(shaft);
  const point = cyl(0.0035, 0.0, 0.01, 10, metal('#c8ced6', 0.25));
  point.position.y = -0.005;
  g.add(point);
  const head = cyl(0.0085, 0.0085, 0.005, 12, metal('#dfe5ec', 0.2));
  head.position.y = 0.057;
  g.add(head);
  return { group: g, height: 0.06 };
}

/* ------------------------- 塗料の缶 ------------------------- */
export function makePaintCan(color) {
  const g = new THREE.Group();
  const can = cyl(0.045, 0.045, 0.075, 22, metal('#e8edf2', 0.35));
  can.position.y = 0.037;
  g.add(can);
  const label = cyl(0.0455, 0.0455, 0.045, 22, new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
  label.position.y = 0.034;
  g.add(label);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.005, 8, 22), metal('#d7dde4', 0.3));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.075;
  g.add(rim);
  const paint = cyl(0.041, 0.041, 0.006, 22, new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, clearcoat: 1, metalness: 0 }));
  paint.position.y = 0.073;
  g.add(paint);
  return { group: g, paint, label };
}

/* ------------------------- 道具箱 ------------------------- */
export function makeToolbox(apron) {
  const g = new THREE.Group();
  const tex = makePatternTexture(apron.pattern, apron.bg, apron.fg);
  tex.repeat.set(2, 1);
  const body = rbox(0.30, 0.13, 0.15, 0.02, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
  body.position.y = 0.065;
  g.add(body);
  const lipL = rbox(0.30, 0.02, 0.16, 0.008, plastic('#ffd166', 0.45));
  lipL.position.y = 0.135;
  g.add(lipL);
  const post = (x) => {
    const p = rbox(0.016, 0.09, 0.016, 0.006, plastic('#f2f5f8', 0.4));
    p.position.set(x, 0.18, 0);
    g.add(p);
  };
  post(-0.09); post(0.09);
  const bar = cyl(0.011, 0.011, 0.19, 12, plastic('#ff5f6d', 0.4));
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 0.222;
  g.add(bar);
  return { group: g };
}
