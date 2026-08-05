// Every prop in the workshop, modelled in code: scissors, the little sewing
// machine, the tailor's chalk, the hanger and the decorations.

import * as THREE from 'three';
import { roundedRectShape, makeSoftSprite } from './world.js';

const METAL = () => new THREE.MeshStandardMaterial({ color: 0xdfe6ec, metalness: 0.85, roughness: 0.28 });
const GOLD = () => new THREE.MeshStandardMaterial({ color: 0xf3c96b, metalness: 0.8, roughness: 0.3 });

function mat(color, rough = 0.55, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

/** Soft-edged box built from a bevelled rounded rectangle. */
export function roundedBox(w, h, d, r, material) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, Math.min(r, Math.min(w, h) / 2 - 0.001)), {
    depth: Math.max(0.001, d - 0.04), bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02,
    bevelSegments: 3, curveSegments: 8,
  });
  geo.translate(0, 0, -(d - 0.04) / 2);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  return m;
}

function shadowed(mesh) {
  mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return mesh;
}

// ------------------------------------------------------------------ scissors

function bladeShape(len, wid) {
  const s = new THREE.Shape();
  s.moveTo(-0.06, -wid * 0.55);
  s.lineTo(len * 0.72, -wid * 0.5);
  s.quadraticCurveTo(len, -wid * 0.22, len, 0);
  s.quadraticCurveTo(len * 0.9, wid * 0.42, len * 0.4, wid * 0.55);
  s.lineTo(-0.06, wid * 0.6);
  s.quadraticCurveTo(-0.16, 0, -0.06, -wid * 0.55);
  return s;
}

function makeBlade(colour, flip) {
  const g = new THREE.Group();
  const geo = new THREE.ExtrudeGeometry(bladeShape(0.86, 0.15), {
    depth: 0.03, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 10,
  });
  geo.translate(0, 0, -0.015);
  const blade = new THREE.Mesh(geo, METAL());
  g.add(blade);

  // shank running back from the pivot
  const shank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.032, 0.46, 10),
    mat(colour, 0.42)
  );
  shank.rotation.z = Math.PI / 2;
  shank.position.set(-0.28, flip ? 0.05 : -0.05, 0);
  g.add(shank);

  // finger ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.042, 10, 24), mat(colour, 0.4));
  ring.position.set(-0.62, flip ? 0.14 : -0.14, 0);
  g.add(ring);

  return shadowed(g);
}

export function makeScissors(colour = '#ff8fa8') {
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.x = -Math.PI / 2 + 0.34;
  root.add(tilt);

  const a = makeBlade(colour, false);
  const b = makeBlade('#ffd27f', true);
  tilt.add(a, b);

  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.09, 12), GOLD());
  screw.rotation.x = Math.PI / 2;
  tilt.add(screw);

  root.userData = { a, b, tilt };
  root.setOpen = (t) => {                 // t: 0 closed .. 1 wide open
    a.rotation.z = t * 0.30;
    b.rotation.z = -t * 0.30;
  };
  root.setOpen(0.5);
  return root;
}

// ------------------------------------------------------------- sewing machine

export function makeSewingMachine(colour = '#8fd8c8', accent = '#ffb3c6') {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const shell = mat(colour, 0.42);
  const trim = mat(accent, 0.45);
  const cream = mat(0xfff4e6, 0.6);

  // The body sits behind the needle so the table itself acts as the bed and
  // the free arm reaches out over the seam.
  const base = roundedBox(0.68, 0.4, 0.16, 0.07, cream);
  base.rotation.x = -Math.PI / 2;
  base.position.set(0.16, 0.08, 0);
  body.add(base);

  const plate = roundedBox(0.62, 0.34, 0.04, 0.05, METAL());
  plate.rotation.x = -Math.PI / 2;
  plate.position.set(0.16, 0.17, 0);
  body.add(plate);

  const column = roundedBox(0.26, 0.56, 0.34, 0.08, shell);
  column.position.set(0.34, 0.45, 0);
  body.add(column);

  const arm = roundedBox(0.86, 0.19, 0.28, 0.07, shell);
  arm.position.set(0.02, 0.66, 0);
  body.add(arm);

  const head = roundedBox(0.2, 0.34, 0.28, 0.07, shell);
  head.position.set(-0.34, 0.55, 0);
  body.add(head);

  const stripe = roundedBox(0.8, 0.05, 0.3, 0.02, trim);
  stripe.position.set(0.02, 0.58, 0);
  body.add(stripe);

  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 22), GOLD());
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(0.34, 0.5, 0.2);
  body.add(wheel);
  const wheelCap = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), trim);
  wheelCap.position.set(0.34, 0.5, 0.235);
  body.add(wheelCap);

  // thread spool on top
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 8), METAL());
  spindle.position.set(0.12, 0.83, 0);
  body.add(spindle);
  const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.13, 18), mat(accent, 0.75));
  spool.position.set(0.12, 0.82, 0);
  body.add(spool);
  const flangeA = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.015, 18), cream);
  flangeA.position.set(0.12, 0.885, 0);
  body.add(flangeA);
  const flangeB = flangeA.clone();
  flangeB.position.y = 0.755;
  body.add(flangeB);

  // needle assembly — this is the part that goes カタカタ
  const needleBar = new THREE.Group();
  needleBar.position.set(-0.34, 0.2, 0);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.26, 10), METAL());
  bar.position.y = 0.16;
  needleBar.add(bar);
  const needle = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.15, 8), METAL());
  needle.position.y = 0.0;
  needle.rotation.x = Math.PI;
  needleBar.add(needle);
  body.add(needleBar);

  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.028, 0.12), METAL());
  foot.position.set(-0.34, 0.03, 0);
  body.add(foot);
  const footBar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.36, 8), METAL());
  footBar.position.set(-0.27, 0.2, 0);
  body.add(footBar);

  shadowed(root);
  root.userData = { needleBar, wheel, baseY: needleBar.position.y };
  root.setStitch = (phase) => {
    const s = Math.abs(Math.sin(phase));
    needleBar.position.y = root.userData.baseY - s * 0.12;
    wheel.rotation.x = -phase;
  };
  return root;
}

// -------------------------------------------------------------------- chalk

export function makeChalk(colour = '#fffdf5') {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 0.36, 14), mat(colour, 0.95));
  body.position.y = 0.2;
  root.add(body);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 14), mat(colour, 0.95));
  tip.position.y = 0.0;
  tip.rotation.x = Math.PI;
  root.add(tip);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.07, 14), mat(0xffc0d0, 0.5));
  band.position.y = 0.19;
  root.add(band);
  root.rotation.z = 0.34;
  root.rotation.x = -0.2;

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeSoftSprite('#ffffff'), color: 0xffffff, transparent: true,
    opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glow.scale.setScalar(0.34);
  root.add(glow);

  shadowed(root);
  return root;
}

// ------------------------------------------------------------------- hanger

export function makeHanger(withClips) {
  const root = new THREE.Group();
  const wood = mat(0xe8bf92, 0.68);
  const wire = new THREE.MeshStandardMaterial({ color: 0xe6ecf2, metalness: 0.8, roughness: 0.3 });

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.72, -0.02, 0),
    new THREE.Vector3(-0.38, 0.12, 0),
    new THREE.Vector3(0, 0.2, 0),
    new THREE.Vector3(0.38, 0.12, 0),
    new THREE.Vector3(0.72, -0.02, 0),
  ]);
  const bar = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.035, 10, false), wood);
  root.add(bar);

  const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1.44, 10), wood);
  cross.rotation.z = Math.PI / 2;
  cross.position.y = -0.13;
  root.add(cross);

  const hookCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.2, 0),
    new THREE.Vector3(0, 0.42, 0),
    new THREE.Vector3(0.055, 0.55, 0),
    new THREE.Vector3(0.15, 0.52, 0),
    new THREE.Vector3(0.16, 0.42, 0),
  ]);
  const hook = new THREE.Mesh(new THREE.TubeGeometry(hookCurve, 30, 0.022, 8, false), wire);
  root.add(hook);

  if (withClips) {
    for (const x of [-0.44, 0.44]) {
      const clip = new THREE.Group();
      const jaw = roundedBox(0.13, 0.2, 0.1, 0.03, mat(0xffd6e0, 0.5));
      jaw.position.set(x, -0.22, 0);
      clip.add(jaw);
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8), wire);
      pin.rotation.x = Math.PI / 2;
      pin.position.set(x, -0.15, 0);
      clip.add(pin);
      root.add(clip);
    }
  }
  shadowed(root);
  return root;
}

// -------------------------------------------------------------- decorations

function heartShape2D() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.42);
  s.bezierCurveTo(0.52, 0.06, 0.34, 0.55, 0, 0.26);
  s.bezierCurveTo(-0.34, 0.55, -0.52, 0.06, 0, -0.42);
  return s;
}

function starShape2D(r = 0.45, ir = 0.2, pts = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < pts * 2; i++) {
    const a = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : ir;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function extruded(shape, depth, material) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 3, curveSegments: 14,
  });
  geo.center();
  return new THREE.Mesh(geo, material);
}

function makeBow(c1, c2) {
  const g = new THREE.Group();
  const m = mat(c1, 0.5);
  for (const side of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), m);
    loop.scale.set(1.25, 0.85, 0.42);
    loop.position.set(side * 0.19, 0.03, 0);
    loop.rotation.z = side * 0.34;
    g.add(loop);
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), m);
    tail.scale.set(0.6, 1.5, 0.35);
    tail.position.set(side * 0.14, -0.22, -0.02);
    tail.rotation.z = side * 0.4;
    g.add(tail);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 12), mat(c2, 0.45));
  knot.scale.set(1, 1.05, 0.7);
  g.add(knot);
  return g;
}

function makeFlower(c1, c2) {
  const g = new THREE.Group();
  const m = mat(c1, 0.55);
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), m);
    p.scale.set(0.78, 1.25, 0.4);
    const a = (i / 6) * Math.PI * 2;
    p.position.set(Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0);
    p.rotation.z = a - Math.PI / 2;
    g.add(p);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), mat(c2, 0.4));
  core.scale.z = 0.7;
  core.position.z = 0.04;
  g.add(core);
  return g;
}

function makeButton(c1, c2) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 26), mat(c1, 0.35));
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 8, 26), mat(c2, 0.35));
  rim.position.z = 0.028;
  g.add(rim);
  const holeMat = mat(0x8a6f60, 0.6);
  for (const [x, y] of [[-0.06, -0.06], [0.06, -0.06], [-0.06, 0.06], [0.06, 0.06]]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 10), holeMat);
    h.rotation.x = Math.PI / 2;
    h.position.set(x, y, 0.01);
    g.add(h);
  }
  return g;
}

function makeStar(c1, c2) {
  const g = new THREE.Group();
  const star = extruded(starShape2D(0.29, 0.13), 0.06, new THREE.MeshStandardMaterial({
    color: c1, roughness: 0.24, metalness: 0.45,
  }));
  g.add(star);
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), mat(c2, 0.2, 0.4));
  spark.position.set(0.0, 0.0, 0.07);
  g.add(spark);
  return g;
}

function makeHeart(c1, c2) {
  const g = new THREE.Group();
  const h = extruded(heartShape2D(), 0.08, mat(c1, 0.32));
  h.scale.setScalar(0.62);
  g.add(h);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), mat(c2, 0.15));
  shine.position.set(-0.08, 0.07, 0.08);
  g.add(shine);
  return g;
}

export const DECO_KINDS = ['bow', 'flower', 'button', 'star'];

const DECO_BUILD = {
  bow: makeBow, flower: makeFlower, button: makeButton, star: makeStar, heart: makeHeart,
};

/** Palette used for decorations, keyed off the current colourway. */
export function decoColours(colour) {
  return {
    bow: [colour.ink, '#fff6fa'],
    flower: ['#fff3c4', colour.ink],
    button: [colour.accent, '#fffdf8'],
    star: ['#ffd76a', '#fffbe8'],
    heart: [colour.ink, '#ffffff'],
  };
}

export function makeDecoration(kind, colour) {
  const pal = decoColours(colour)[kind] || ['#ffffff', '#ffffff'];
  const g = (DECO_BUILD[kind] || makeButton)(pal[0], pal[1]);
  shadowed(g);
  return g;
}

// -------------------------------------------------------------- guide hand

function handTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 132);
  g.scale(1.05, 1.05);

  g.fillStyle = 'rgba(255,255,255,0.96)';
  g.strokeStyle = 'rgba(150,110,95,0.55)';
  g.lineWidth = 8;
  g.lineJoin = 'round';

  // a simple pointing hand: palm plus an extended index finger
  g.beginPath();
  g.moveTo(-6, -86);
  g.quadraticCurveTo(14, -92, 16, -60);
  g.lineTo(16, -16);
  g.quadraticCurveTo(30, -26, 42, -18);
  g.quadraticCurveTo(56, -10, 54, 12);
  g.quadraticCurveTo(54, 62, 26, 84);
  g.quadraticCurveTo(4, 100, -22, 92);
  g.quadraticCurveTo(-50, 82, -54, 44);
  g.lineTo(-56, 6);
  g.quadraticCurveTo(-54, -14, -36, -12);
  g.quadraticCurveTo(-24, -10, -22, 4);
  g.lineTo(-22, -60);
  g.quadraticCurveTo(-24, -92, -6, -86);
  g.closePath();
  g.fill();
  g.stroke();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeGuideHand() {
  const g = new THREE.Group();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeSoftSprite('#ffffff'), color: 0xffdca8, transparent: true,
    opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  }));
  halo.scale.setScalar(0.44);
  g.add(halo);

  const hand = new THREE.Sprite(new THREE.SpriteMaterial({
    map: handTexture(), transparent: true, opacity: 0.92, depthWrite: false, depthTest: false,
  }));
  hand.scale.setScalar(0.5);
  hand.center.set(0.42, 0.86);
  g.add(hand);

  g.renderOrder = 30;
  g.userData = { halo, hand };
  return g;
}
