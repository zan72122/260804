/**
 * The lab, built as a small diorama out of primitives.
 *
 * Everything the game animates is returned as a named handle so the stage
 * machine never has to go hunting through the scene graph.
 *
 * Deliberate choices:
 *  - no shadow maps (mobile); fake contact-shadow discs instead
 *  - the microtome housing is a translucent panel so the block's advance
 *    toward the blade is visible — the "god's cross-section" the brief asks for
 *  - the technician is an adult lab robot, and it is the one that owns the blade
 */
import * as THREE from 'three';
import { metal, plastic, makeParaffinMaterial, makeGlassMaterial, registerLit, LIGHT_GLSL } from '../gfx/materials';
import { Water } from '../gfx/water';
import type { Specimen } from '../spec/specimen';
import { TAU } from '../core/util';

export const STATION = {
  microtome: new THREE.Vector3(-2.75, 0, 0),
  bath: new THREE.Vector3(0, 0, 0),
  stain: new THREE.Vector3(2.35, 0, 0),
  scope: new THREE.Vector3(4.75, 0, 0),
};

export const BATH_SIZE = 1.0;
export const BATH_SURFACE_Y = 0.34;

// ---------------------------------------------------------------------------

const box = (w: number, h: number, d: number, m: THREE.Material) =>
  new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (rt: number, rb: number, h: number, m: THREE.Material, seg = 24) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const sph = (r: number, m: THREE.Material, seg = 18) =>
  new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg >> 1)), m);

let shadowTex: THREE.Texture | null = null;
function contactShadow(size: number, opacity = 0.42) {
  if (!shadowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(0,0,0,0.85)');
    grd.addColorStop(0.55, 'rgba(0,0,0,0.35)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({
      map: shadowTex, transparent: true, opacity, depthWrite: false,
      blending: THREE.NormalBlending, color: 0x0a1018,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  m.renderOrder = 1;
  return m;
}

/** Frosted panel used for the see-through microtome housing. */
function makePanelMaterial(tint = 0x8fd6e8) {
  return registerLit(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uLight: { value: 1 }, uTime: { value: 0 },
      uTint: { value: new THREE.Color(tint) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz); vUv = uv;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${LIGHT_GLSL}
      uniform float uLight; uniform vec3 uTint;
      varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main() {
        vec3 N = normalize(vN);
        float fres = pow(1.0 - abs(dot(N, normalize(vV))), 2.4);
        vec2 d = min(vUv, 1.0 - vUv);
        float border = 1.0 - smoothstep(0.0, 0.03, min(d.x, d.y));
        vec3 col = uTint * (0.16 + fres * 0.40) + uTint * border * 0.85;
        gl_FragColor = vec4(col * uLight, (0.025 + fres * 0.07 + border * 0.42));
      }`,
  }));
}

// ---------------------------------------------------------------------------

export interface Microtome {
  group: THREE.Group;
  wheel: THREE.Group;          // rotates about Z
  carriage: THREE.Group;       // moves in Y
  blockHolder: THREE.Group;    // moves in Z (advance toward the blade)
  block: THREE.Mesh;
  blockTissue: THREE.Mesh;
  blockGhost: THREE.Group;     // "put the block here" target
  bladeEdgeWorld: THREE.Vector3;
  ribbonAnchor: THREE.Object3D;
  gauge: THREE.Mesh;           // advance indicator that slides along a track
  gaugeTrack: THREE.Object3D;
  wheelHub: THREE.Object3D;    // for projecting the wheel centre to screen
  wheelSpokes: THREE.Group;
  blade: THREE.Mesh;
}

export interface Bath {
  group: THREE.Group;
  water: Water;
  surfaceY: number;
}

export interface StainArea {
  group: THREE.Group;
  dewax: THREE.Group;
  dewaxLiquid: THREE.Mesh;
  wells: THREE.Group[];
  wellLiquids: THREE.Mesh[];
  wellColors: THREE.Color[];
  mountPad: THREE.Group;
  dropper: THREE.Group;
}

export interface Scope {
  group: THREE.Group;
  stage: THREE.Group;
  slideSlot: THREE.Object3D;
  knob: THREE.Group;
  knobHub: THREE.Object3D;
  lamp: THREE.PointLight;
  body: THREE.Group;
}

export interface Lab {
  root: THREE.Group;
  microtome: Microtome;
  bath: Bath;
  stain: StainArea;
  scope: Scope;
  robot: { group: THREE.Group; head: THREE.Object3D; armR: THREE.Object3D; armL: THREE.Object3D };
  lights: {
    hemi: THREE.HemisphereLight;
    key: THREE.DirectionalLight;
    fill: THREE.DirectionalLight;
    scopePool: THREE.PointLight;
  };
  ceiling: THREE.Mesh;
  dispose(): void;
}

// ---------------------------------------------------------------------------

export function buildLab(specimen: Specimen, quality: 'low' | 'high'): Lab {
  const root = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const seg = quality === 'high' ? 24 : 12;

  // ---- room -------------------------------------------------------------
  // A soft gradient dome instead of a flat clear colour: it gives the diorama
  // air, and it is the cheapest possible backdrop.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(38, 20, 14),
    registerLit(new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uLight: { value: 1 }, uTime: { value: 0 },
        uTop: { value: new THREE.Color(0x14324a) },
        uBottom: { value: new THREE.Color(0x0a1420) },
        uHorizon: { value: new THREE.Color(0x2a6d80) },
      },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uTop, uBottom, uHorizon; uniform float uLight;
        varying vec3 vP;
        void main() {
          float h = normalize(vP).y;
          vec3 c = mix(uBottom, uTop, smoothstep(-0.4, 0.85, h));
          c += uHorizon * exp(-abs(h - 0.02) * 9.0) * 0.5;
          gl_FragColor = vec4(c * (0.35 + 0.65 * uLight), 1.0);
        }`,
    })),
  );
  dome.renderOrder = -1;
  root.add(dome);

  const floor = box(30, 0.3, 20, plastic(0x1d2b3a, 0.9));
  floor.position.set(1, -1.05, -1);
  root.add(floor);

  // A big soft diffuser wall behind the bench. It is the reason a section a few
  // microns thick is visible at all: everything translucent in this game is
  // read against it, backlit.
  const diffuser = new THREE.Mesh(
    new THREE.PlaneGeometry(11.5, 3.2),
    registerLit(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uLight: { value: 1 }, uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uLight; varying vec2 vUv;
        void main() {
          float v = smoothstep(0.0, 0.20, vUv.y) * (1.0 - smoothstep(0.78, 1.0, vUv.y));
          float u = smoothstep(0.0, 0.10, vUv.x) * (1.0 - smoothstep(0.90, 1.0, vUv.x));
          // faint panel joins so it reads as lab hardware, not a gradient
          float joins = 0.90 + 0.10 * smoothstep(0.02, 0.06, abs(fract(vUv.x * 7.0) - 0.5));
          float a = v * u * joins;
          vec3 col = mix(vec3(0.36, 0.52, 0.62), vec3(0.92, 0.96, 1.0), a);
          gl_FragColor = vec4(col * (0.18 + 0.82 * uLight), a * 0.58 * (0.20 + 0.80 * uLight));
        }`,
    })),
  );
  diffuser.position.set(1, 1.25, -2.35);
  diffuser.renderOrder = 0;
  root.add(diffuser);

  const benchTop = box(12.6, 0.2, 2.2, plastic(0xeef4f7, 0.5));
  benchTop.position.set(1, -0.10, 0);
  root.add(benchTop);
  const benchBody = box(12.3, 0.9, 1.95, plastic(0x2c3d4f, 0.75));
  benchBody.position.set(1, -0.65, -0.06);
  root.add(benchBody);
  // a warm trim line so the bench edge reads as a silhouette
  const trim = box(12.6, 0.03, 0.035, new THREE.MeshBasicMaterial({ color: 0x3ad9c4 }));
  trim.position.set(1, -0.005, 1.1);
  root.add(trim);

  const ceiling = box(26, 0.2, 18, new THREE.MeshBasicMaterial({ color: 0x0a1018 }));
  ceiling.position.set(1, 5.4, -1);
  ceiling.visible = false;
  root.add(ceiling);

  // ---- lights -----------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xe8f6ff, 0x35485c, 2.2);
  root.add(hemi);
  const key = new THREE.DirectionalLight(0xfff4e4, 3.1);
  key.position.set(-4.5, 8.2, 5.5);
  root.add(key);
  const fill = new THREE.DirectionalLight(0x86c4f0, 1.5);
  fill.position.set(7, 3.2, -6);
  root.add(fill);
  const scopePool = new THREE.PointLight(0x9fd8ff, 0, 4.5, 2);
  scopePool.position.set(STATION.scope.x, 1.5, 0.6);
  root.add(scopePool);

  // =======================================================================
  // MICROTOME
  // =======================================================================
  const mt = new THREE.Group();
  mt.position.copy(STATION.microtome);
  root.add(mt);
  mt.add(contactShadow(2.0, 0.5));

  const bodyMat = metal(0xaec2d2, 0.32, 0.58);
  const darkMat = metal(0x33465a, 0.4, 0.72);
  const accentMat = plastic(0x18c8ab, 0.4);

  const base = box(1.62, 0.16, 1.05, bodyMat);
  base.position.set(0, 0.08, -0.05);
  mt.add(base);
  const baseSkirt = box(1.5, 0.06, 0.95, darkMat);
  baseSkirt.position.set(0, 0.015, -0.05);
  mt.add(baseSkirt);
  const column = box(0.56, 1.05, 0.5, bodyMat);
  column.position.set(-0.45, 0.63, -0.32);
  mt.add(column);
  const columnFace = box(0.5, 0.05, 0.02, accentMat);
  columnFace.position.set(-0.45, 1.10, -0.07);
  mt.add(columnFace);

  // --- carriage: rides up and down past the blade
  const carriage = new THREE.Group();
  mt.add(carriage);
  const carriageArm = box(0.34, 0.46, 0.26, darkMat);
  carriageArm.position.set(-0.42, 0, -0.12);
  carriage.add(carriageArm);
  const carriageLink = box(0.42, 0.15, 0.14, bodyMat);
  carriageLink.position.set(-0.24, 0, -0.10);
  carriage.add(carriageLink);

  // --- block holder: advances toward the blade in Z
  const blockHolder = new THREE.Group();
  carriage.add(blockHolder);
  const clampBack = box(0.34, 0.34, 0.06, darkMat);
  clampBack.position.set(-0.04, 0, -0.11);
  blockHolder.add(clampBack);
  const clampJawT = box(0.36, 0.05, 0.18, accentMat);
  clampJawT.position.set(-0.04, 0.165, -0.02);
  blockHolder.add(clampJawT);
  const clampJawB = box(0.36, 0.05, 0.18, accentMat);
  clampJawB.position.set(-0.04, -0.165, -0.02);
  blockHolder.add(clampJawB);

  // the paraffin block itself — the tissue rides inside it, so dragging the
  // block drags the specimen
  const paraffinMat = makeParaffinMaterial();
  const block = box(0.34, 0.32, 0.22, paraffinMat);
  block.position.set(-0.04, 0, 0.02);
  block.renderOrder = 4;
  blockHolder.add(block);

  // tissue island suspended in the wax: a soft solid so it reads from any
  // angle, plus the actual specimen image facing the player
  const core = sph(1, new THREE.MeshStandardMaterial({
    color: 0xc98da4, roughness: 0.75, metalness: 0,
    transparent: true, opacity: 0.55, depthWrite: false,
  }), 14);
  core.scale.set(0.075, 0.062, 0.05);
  core.renderOrder = 3;
  block.add(core);
  const blockTissue = new THREE.Mesh(
    new THREE.PlaneGeometry(0.19, 0.19),
    new THREE.MeshBasicMaterial({
      map: specimen.tissue, transparent: true, opacity: 0.75,
      depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  blockTissue.position.set(0, 0, 0.02);
  blockTissue.renderOrder = 5;
  block.add(blockTissue);

  // "drop the block here" ghost target. depthTest off: the one thing the
  // player must find can never be hidden behind the machine.
  const blockGhost = new THREE.Group();
  const ghostBox = box(0.36, 0.34, 0.24, new THREE.MeshBasicMaterial({
    color: 0x5ad0c0, transparent: true, opacity: 0.14,
    depthWrite: false, depthTest: false,
  }));
  const ghostWire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.36, 0.34, 0.24)),
    new THREE.LineBasicMaterial({
      color: 0x8affe9, transparent: true, opacity: 0.9, depthTest: false,
    }),
  );
  ghostBox.renderOrder = 800;
  ghostWire.renderOrder = 801;
  blockGhost.add(ghostBox, ghostWire);
  blockGhost.position.set(-0.04, 0, 0.02);
  blockHolder.add(blockGhost);

  // --- blade: a wedge, not a plank, so the cutting edge reads at a glance
  const bladeHolder = box(0.98, 0.22, 0.24, darkMat);
  bladeHolder.position.set(0.0, 0.60, -0.30);
  mt.add(bladeHolder);
  const steel = metal(0xeef6ff, 0.1, 1.0);
  const bladeBack = box(0.9, 0.10, 0.2, steel);
  bladeBack.position.set(0.0, 0.655, -0.14);
  mt.add(bladeBack);
  const blade = box(0.9, 0.02, 0.12, steel);
  blade.position.set(0.0, 0.655, 0.02);
  mt.add(blade);
  const bladeGlow = box(0.9, 0.009, 0.02, new THREE.MeshBasicMaterial({ color: 0xf4fdff }));
  bladeGlow.position.set(0.0, 0.6605, 0.078);
  const cutZone = box(0.34, 0.004, 0.03, new THREE.MeshBasicMaterial({ color: 0x4de2c8, transparent: true, opacity: 0.7 }));
  cutZone.position.set(-0.04, 0.6665, 0.082);
  mt.add(cutZone);
  mt.add(bladeGlow);
  // guard: the blade is covered except at the working edge — an adult's machine
  const guard = box(0.98, 0.075, 0.10, darkMat);
  guard.position.set(0.0, 0.775, -0.20);
  mt.add(guard);

  const ribbonAnchor = new THREE.Object3D();
  ribbonAnchor.position.set(-0.04, 0.674, 0.072);
  mt.add(ribbonAnchor);

  // --- see-through housing over the advance mechanism
  const panelMat = makePanelMaterial();
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.78), panelMat);
  panel.position.set(-0.45, 0.63, 0.16);
  panel.renderOrder = 7;
  mt.add(panel);

  // --- advance gauge: shows how far the block has crept toward the blade
  const gaugeTrack = new THREE.Object3D();
  gaugeTrack.position.set(-0.45, 1.20, 0.10);
  mt.add(gaugeTrack);
  const trackMesh = box(0.5, 0.026, 0.02, plastic(0x24313f, 0.7));
  trackMesh.position.copy(gaugeTrack.position);
  mt.add(trackMesh);
  for (let i = 0; i <= 5; i++) {
    const t = box(0.008, 0.05, 0.02, new THREE.MeshBasicMaterial({ color: 0x88a2b4 }));
    t.position.set(-0.45 - 0.25 + (i / 5) * 0.5, 1.20, 0.105);
    mt.add(t);
  }
  const gauge = box(0.032, 0.075, 0.03, new THREE.MeshBasicMaterial({ color: 0xffd15c }));
  gauge.position.set(-0.70, 1.20, 0.115);
  mt.add(gauge);

  // --- handwheel: the star control
  const wheel = new THREE.Group();
  wheel.position.set(0.30, 0.34, 0.48);
  mt.add(wheel);
  const wheelHub = new THREE.Object3D();
  wheel.add(wheelHub);

  const rimOuter = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.045, 10, seg * 2), metal(0x51687e, 0.28, 0.88));
  wheel.add(rimOuter);
  const rimGrip = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.052, 8, seg * 2), accentMat);
  rimGrip.scale.set(1, 1, 0.55);
  wheel.add(rimGrip);
  const hub = cyl(0.085, 0.085, 0.09, metal(0xb9c8d4, 0.3, 0.9), seg);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  const wheelSpokes = new THREE.Group();
  wheel.add(wheelSpokes);
  for (let i = 0; i < 3; i++) {
    const s = box(0.045, 0.56, 0.036, metal(0x7d90a0, 0.4, 0.8));
    s.rotation.z = (i / 3) * Math.PI;
    wheelSpokes.add(s);
  }
  // the finger knob — a big obvious "grab here"
  const knobArm = new THREE.Group();
  knobArm.position.set(0, 0, 0);
  wheel.add(knobArm);
  const knobPost = cyl(0.05, 0.055, 0.14, plastic(0xffd76a, 0.35), 14);
  knobPost.rotation.x = Math.PI / 2;
  knobPost.position.set(0.235, 0, 0.09);
  knobArm.add(knobPost);
  wheelSpokes.add(knobArm);

  const wheelBoss = cyl(0.15, 0.15, 0.24, bodyMat, seg);
  wheelBoss.rotation.x = Math.PI / 2;
  wheelBoss.position.copy(wheel.position).setZ(wheel.position.z - 0.16);
  mt.add(wheelBoss);

  const microtome: Microtome = {
    group: mt, wheel, carriage, blockHolder, block, blockTissue, blockGhost,
    bladeEdgeWorld: new THREE.Vector3(), ribbonAnchor, gauge, gaugeTrack,
    wheelHub, wheelSpokes, blade,
  };

  // =======================================================================
  // ROBOT TECHNICIAN
  // =======================================================================
  const robot = new THREE.Group();
  robot.position.set(STATION.microtome.x - 1.55, -0.05, -0.45);
  robot.rotation.y = 0.85;
  root.add(robot);
  const shellMat = plastic(0xf2f7fa, 0.45);
  const suitMat = plastic(0x2fb9a6, 0.5);
  const torso = cyl(0.24, 0.30, 0.62, suitMat, seg);
  torso.position.y = 0.72;
  robot.add(torso);
  const shoulders = cyl(0.27, 0.27, 0.12, shellMat, seg);
  shoulders.position.y = 1.03;
  robot.add(shoulders);
  const head = sph(0.21, shellMat, seg);
  head.position.y = 1.26;
  robot.add(head);
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.215, seg, seg >> 1, 0, TAU, 0.6, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x16303f, roughness: 0.15, metalness: 0.4 }),
  );
  visor.position.y = 1.26;
  visor.rotation.y = -0.2;
  robot.add(visor);
  for (const s of [-1, 1]) {
    const eye = sph(0.036, new THREE.MeshBasicMaterial({ color: 0x8ff2ff }), 10);
    eye.position.set(0.055 * s + 0.02, 1.28, 0.198);
    robot.add(eye);
  }
  const armR = new THREE.Group();
  armR.position.set(0.28, 1.0, 0.02);
  robot.add(armR);
  const upperR = cyl(0.065, 0.06, 0.5, suitMat, 12);
  upperR.position.y = -0.24;
  armR.add(upperR);
  const handR = sph(0.085, shellMat, 12);
  handR.position.y = -0.5;
  armR.add(handR);
  const armL = new THREE.Group();
  armL.position.set(-0.28, 1.0, 0.02);
  robot.add(armL);
  const upperL = cyl(0.065, 0.06, 0.5, suitMat, 12);
  upperL.position.y = -0.24;
  armL.add(upperL);
  const handL = sph(0.085, shellMat, 12);
  handL.position.y = -0.5;
  armL.add(handL);
  robot.add(contactShadow(0.9, 0.35));

  // =======================================================================
  // WATER BATH
  // =======================================================================
  const bathG = new THREE.Group();
  bathG.position.copy(STATION.bath);
  root.add(bathG);
  bathG.add(contactShadow(1.7, 0.45));

  // Glass tank: the whole point of this scene is seeing the surface, the thing
  // floating on it and the slide underneath at the same time.
  const tankGlass = makeGlassMaterial({ tint: 0xd6eefa, edge: 1.25, opacity: 0.95 });
  const tankRail = metal(0xc6d4de, 0.3, 0.7);
  const inner = BATH_SIZE;
  const wallH = 0.46;
  const t = 0.03;
  for (const [dx, dz, w, d] of [
    [0, (inner + t) / 2, inner + t * 2, t],
    [0, -(inner + t) / 2, inner + t * 2, t],
    [(inner + t) / 2, 0, t, inner + t * 2],
    [-(inner + t) / 2, 0, t, inner + t * 2],
  ] as [number, number, number, number][]) {
    const w1 = box(w, wallH, d, tankGlass);
    w1.position.set(dx, wallH / 2, dz);
    w1.renderOrder = 7;
    bathG.add(w1);
    // a slim metal rail along the top edge keeps the tank readable as an object
    const rail = box(w + 0.02, 0.03, d + 0.02, tankRail);
    rail.position.set(dx, wallH + 0.01, dz);
    bathG.add(rail);
  }
  const bathFloor = box(inner, 0.03, inner, plastic(0xffffff, 0.25));
  bathFloor.position.set(0, 0.03, 0);
  bathG.add(bathFloor);
  const heater = box(0.34, 0.1, 0.16, plastic(0x2b3a49, 0.6));
  heater.position.set(0, 0.06, -0.72);
  bathG.add(heater);
  const heaterLed = sph(0.028, new THREE.MeshBasicMaterial({ color: 0xff8a5c }), 10);
  heaterLed.position.set(0, 0.13, -0.66);
  bathG.add(heaterLed);

  const water = new Water(inner, quality);
  water.mesh.position.y = BATH_SURFACE_Y;
  bathG.add(water.mesh);
  disposables.push(water);

  const bath: Bath = { group: bathG, water, surfaceY: BATH_SURFACE_Y };

  // =======================================================================
  // STAINING AREA
  // =======================================================================
  const st = new THREE.Group();
  st.position.copy(STATION.stain);
  root.add(st);
  st.add(contactShadow(2.0, 0.45));

  const rack = box(0.98, 0.05, 0.98, metal(0xb7c4ce, 0.35, 0.8));
  rack.position.set(0, 0.025, -0.02);
  st.add(rack);

  // Upright staining jars in a 2x2 block — how slides are really dipped, and
  // the only layout that fits four of them into a phone held upright.
  const JAR_W = 0.30, JAR_D = 0.33, JAR_H = 0.62;
  const makeWell = (x: number, z: number, color: number, clear: boolean) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    st.add(g);
    const glassMat = makeGlassMaterial({ tint: 0xdcf0fa, edge: 1.3, opacity: 0.5 });
    const t2 = 0.016;
    for (const [dx, dz, w, d] of [
      [0, JAR_D / 2, JAR_W, t2], [0, -JAR_D / 2, JAR_W, t2],
      [JAR_W / 2, 0, t2, JAR_D], [-JAR_W / 2, 0, t2, JAR_D],
    ] as [number, number, number, number][]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, JAR_H, d), glassMat);
      wall.position.set(dx, 0.05 + JAR_H / 2, dz);
      wall.renderOrder = 7;
      g.add(wall);
    }
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(JAR_W, 0.03, JAR_D), glassMat);
    bottom.position.y = 0.055;
    g.add(bottom);
    const liq = new THREE.Mesh(
      new THREE.BoxGeometry(JAR_W - 0.04, 0.44, JAR_D - 0.04),
      new THREE.MeshStandardMaterial({
        color, transparent: true, opacity: clear ? 0.22 : 0.55,
        roughness: 0.08, metalness: 0,
        emissive: new THREE.Color(color).multiplyScalar(clear ? 0.08 : 0.34),
      }),
    );
    liq.position.y = 0.29;
    g.add(liq);
    const top = new THREE.Mesh(
      new THREE.PlaneGeometry(JAR_W - 0.04, JAR_D - 0.04),
      new THREE.MeshStandardMaterial({
        color, transparent: true, opacity: 0.7, roughness: 0.04,
        emissive: new THREE.Color(color).multiplyScalar(0.42), side: THREE.DoubleSide,
      }),
    );
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.512;
    g.add(top);
    // a bright collar so the mouth of the jar is an obvious target
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.014, 6, 4),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.85,
      }),
    );
    collar.rotation.x = -Math.PI / 2;
    collar.rotation.z = Math.PI / 4;
    collar.position.y = 0.672;
    g.add(collar);
    return { group: g, liquid: liq };
  };

  const dewaxW = makeWell(-0.21, -0.21, 0xe4f6ff, true);
  const w1 = makeWell(0.21, -0.21, 0x3d7bff, false);
  const w2 = makeWell(-0.21, 0.21, 0x2fe08a, false);
  const w3 = makeWell(0.21, 0.21, 0xff4fb5, false);

  // mounting pad
  const mountPad = new THREE.Group();
  mountPad.position.set(0, 0, 0.82);
  st.add(mountPad);
  const pad = box(0.62, 0.05, 0.40, plastic(0x223140, 0.55));
  pad.position.y = 0.025;
  mountPad.add(pad);
  const padGlow = box(0.58, 0.004, 0.36, new THREE.MeshBasicMaterial({
    color: 0x1d4b57, transparent: true, opacity: 0.8,
  }));
  padGlow.position.y = 0.053;
  mountPad.add(padGlow);

  const dropper = new THREE.Group();
  dropper.position.set(-0.26, 0.0, 0.86);
  st.add(dropper);
  const dBody = cyl(0.05, 0.06, 0.22, plastic(0x3f5566, 0.4), 14);
  dBody.position.y = 0.17;
  dropper.add(dBody);
  const dRing = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.012, 6, 18), plastic(0x18c8ab, 0.35));
  dRing.rotation.x = Math.PI / 2;
  dRing.position.y = 0.27;
  dropper.add(dRing);
  const dBulb = sph(0.085, plastic(0xff9f6e, 0.45), 14);
  dBulb.position.y = 0.36;
  dropper.add(dBulb);
  const dTip = cyl(0.009, 0.026, 0.12, plastic(0xdfe9f0, 0.3), 10);
  dTip.position.y = 0.04;
  dropper.add(dTip);
  const dDrop = sph(0.022, makeGlassMaterial({ tint: 0xbfe8ff, edge: 0.3 }), 10);
  dDrop.position.y = -0.005;
  dropper.add(dDrop);

  const stain: StainArea = {
    group: st,
    dewax: dewaxW.group, dewaxLiquid: dewaxW.liquid,
    wells: [w1.group, w2.group, w3.group],
    wellLiquids: [w1.liquid, w2.liquid, w3.liquid],
    wellColors: [new THREE.Color(0x4d86ff), new THREE.Color(0x2fe08a), new THREE.Color(0xff5cbe)],
    mountPad, dropper,
  };

  // =======================================================================
  // MICROSCOPE
  // =======================================================================
  const sc = new THREE.Group();
  sc.position.copy(STATION.scope);
  root.add(sc);
  sc.add(contactShadow(1.9, 0.5));
  const scopeBody = new THREE.Group();
  sc.add(scopeBody);

  const scMat = metal(0x35485c, 0.4, 0.7);
  const scLight = metal(0xb6c6d2, 0.35, 0.75);

  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 1.0), scMat);
  foot.position.set(0, 0.06, -0.1);
  scopeBody.add(foot);
  const armCol = box(0.24, 1.25, 0.3, scMat);
  armCol.position.set(0.0, 0.72, -0.42);
  scopeBody.add(armCol);
  const armCurve = box(0.24, 0.26, 0.62, scMat);
  armCurve.position.set(0, 1.28, -0.2);
  scopeBody.add(armCurve);

  // stage
  const stage = new THREE.Group();
  stage.position.set(0, 0.62, 0.02);
  scopeBody.add(stage);
  const stagePlate = box(0.86, 0.05, 0.62, scLight);
  stage.add(stagePlate);
  const stageHole = new THREE.Mesh(
    new THREE.CircleGeometry(0.09, seg),
    new THREE.MeshBasicMaterial({ color: 0x0c1219 }),
  );
  stageHole.rotation.x = -Math.PI / 2;
  stageHole.position.y = 0.026;
  stage.add(stageHole);
  const clipL = box(0.05, 0.03, 0.22, accentMat);
  clipL.position.set(-0.24, 0.04, 0.1);
  stage.add(clipL);
  const clipR = box(0.05, 0.03, 0.22, accentMat);
  clipR.position.set(0.24, 0.04, 0.1);
  stage.add(clipR);
  const slideSlot = new THREE.Object3D();
  slideSlot.position.set(0, 0.045, 0.02);
  stage.add(slideSlot);

  // condenser + transmitted lamp under the stage
  const cond = cyl(0.11, 0.07, 0.16, scLight, seg);
  cond.position.set(0, 0.5, 0.02);
  scopeBody.add(cond);
  const lamp = new THREE.PointLight(0x9fd8ff, 0, 1.2, 2);
  lamp.position.set(0, 0.45, 0.02);
  scopeBody.add(lamp);

  // objective turret
  const turret = cyl(0.19, 0.19, 0.1, scMat, seg);
  turret.position.set(0, 0.92, 0.02);
  scopeBody.add(turret);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const obj = cyl(0.045, 0.035, 0.2, i === 0 ? metal(0xd8b45a, 0.3, 0.9) : scLight, 14);
    obj.position.set(Math.cos(a) * 0.11, 0.79, 0.02 + Math.sin(a) * 0.11);
    scopeBody.add(obj);
  }
  // head + eyepiece angled toward the player
  const headTube = cyl(0.15, 0.15, 0.42, scMat, seg);
  headTube.position.set(0, 1.16, 0.02);
  scopeBody.add(headTube);
  const eyeTube = cyl(0.09, 0.11, 0.34, scLight, seg);
  eyeTube.position.set(0, 1.42, 0.26);
  eyeTube.rotation.x = 0.95;
  scopeBody.add(eyeTube);
  const eyeCup = cyl(0.105, 0.09, 0.06, plastic(0x1d2732, 0.7), seg);
  eyeCup.position.set(0, 1.55, 0.44);
  eyeCup.rotation.x = 0.95;
  scopeBody.add(eyeCup);
  const eyeGlass = new THREE.Mesh(
    new THREE.CircleGeometry(0.082, seg),
    new THREE.MeshBasicMaterial({ color: 0x0a141c }),
  );
  eyeGlass.position.set(0, 1.567, 0.462);
  eyeGlass.rotation.x = 0.95 - Math.PI / 2;
  scopeBody.add(eyeGlass);

  // the big focus knob, facing the player
  const knob = new THREE.Group();
  knob.position.set(0.46, 0.52, 0.16);
  knob.rotation.y = -0.38;
  scopeBody.add(knob);
  const knobHub = new THREE.Object3D();
  knob.add(knobHub);
  const knobDisc = cyl(0.26, 0.26, 0.09, metal(0x2a3846, 0.4, 0.8), seg);
  knobDisc.rotation.x = Math.PI / 2;
  knob.add(knobDisc);
  const knobRing = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.035, 8, seg * 2), plastic(0xffce5c, 0.35));
  knob.add(knobRing);
  const knurl = new THREE.Group();
  knob.add(knurl);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const k = box(0.03, 0.07, 0.075, metal(0x8fa3b3, 0.4, 0.7));
    k.position.set(Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0.0);
    k.rotation.z = a;
    knurl.add(k);
  }
  const knobFace = cyl(0.1, 0.1, 0.1, metal(0xc8d6e0, 0.3, 0.85), seg);
  knobFace.rotation.x = Math.PI / 2;
  knob.add(knobFace);
  const knobMark = box(0.02, 0.16, 0.1, new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  knobMark.position.set(0, 0.16, 0.03);
  knurl.add(knobMark);

  const scope: Scope = { group: sc, stage, slideSlot, knob, knobHub, lamp, body: scopeBody };

  // small props so the bench is not empty, kept dim and low-contrast
  const propMat = plastic(0x50697e, 0.7);
  for (const [x, z, w, h, d] of [
    [-4.3, -0.5, 0.3, 0.5, 0.3], [-4.0, 0.3, 0.22, 0.3, 0.22],
    [1.35, -0.6, 0.26, 0.42, 0.26], [3.6, -0.55, 0.34, 0.24, 0.34],
    [6.0, -0.2, 0.5, 0.7, 0.4],
  ] as [number, number, number, number, number][]) {
    const p = box(w, h, d, propMat);
    p.position.set(x, h / 2, z);
    root.add(p);
  }

  return {
    root, microtome, bath, stain, scope,
    robot: { group: robot, head, armR, armL },
    lights: { hemi, key, fill, scopePool },
    ceiling,
    dispose() {
      for (const d of disposables) d.dispose();
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
    },
  };
}
