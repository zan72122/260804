// Game flow, camera, lighting and the update loop.

import * as THREE from '../vendor/three.module.js';
import { buildMaterials, materials } from './materials.js';
import { buildApartment, CEIL } from './apartment.js';
import * as F from './furniture.js';
import * as P from './props.js';
import { buildRoute, FINDS } from './route.js';
import { buildFirefighter, poseFirefighter } from './firefighter.js';
import { smokeUniforms, applySmoke, visibilityAt } from './smoke.js';
import { chamferBox, lathe, mesh, group, applyBoxUV, tube } from './build.js';
import { softSprite } from './textures.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { mulberry32 } from './noise.js';

const clamp = THREE.MathUtils.clamp;
const damp = (a, b, lambda, dt) => THREE.MathUtils.damp(a, b, lambda, dt);

/* =======================================================================
 * Sparkle bursts — used when something is found and when everyone is out.
 * ===================================================================== */
class Sparkles {
  constructor(scene, max = 420) {
    const geo = new THREE.BufferGeometry();
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uPix: { value: 1 } },
      vertexShader: `
        attribute vec3 aColor; attribute float aLife; attribute float aSize;
        uniform float uPix; varying vec3 vC; varying float vL;
        void main() {
          vC = aColor; vL = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPix / max(-mv.z, 0.3) * (0.35 + aLife * 0.65);
        }`,
      fragmentShader: `
        varying vec3 vC; varying float vL;
        void main() {
          if (vL <= 0.0) discard;
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          float a = smoothstep(0.5, 0.02, r);
          gl_FragColor = vec4(vC * (0.6 + vL), a * vL);
        }`,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.cursor = 0;
    this.rnd = mulberry32(404);
  }
  burst(p, n, color, spread = 1.6, up = 1.9, size = 90) {
    for (let i = 0; i < n; i++) {
      const k = this.cursor = (this.cursor + 1) % this.max;
      this.pos[k * 3] = p.x; this.pos[k * 3 + 1] = p.y; this.pos[k * 3 + 2] = p.z;
      const a = this.rnd() * Math.PI * 2, e = this.rnd();
      this.vel[k * 3] = Math.cos(a) * spread * e;
      this.vel[k * 3 + 1] = up * (0.35 + this.rnd());
      this.vel[k * 3 + 2] = Math.sin(a) * spread * e;
      this.life[k] = 1;
      const c = new THREE.Color(color).offsetHSL((this.rnd() - 0.5) * 0.08, 0, (this.rnd() - 0.5) * 0.2);
      this.col[k * 3] = c.r; this.col[k * 3 + 1] = c.g; this.col[k * 3 + 2] = c.b;
      this.size[k] = size * (0.6 + this.rnd() * 0.8);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt * 0.62;
      this.vel[i * 3 + 1] -= 2.6 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02) { this.pos[i * 3 + 1] = 0.02; this.vel[i * 3 + 1] *= -0.28; this.vel[i * 3] *= 0.6; this.vel[i * 3 + 2] *= 0.6; }
    }
    if (any) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aLife.needsUpdate = true;
    }
  }
}

/* =======================================================================
 * The street outside the front door: where the crew gets ready.
 * ===================================================================== */
function buildStreet(scene) {
  const M = materials();
  const g = group('street');
  const asphalt = applySmoke(new THREE.MeshStandardMaterial({ color: 0x161514, roughness: 0.92 }));
  const road = new THREE.PlaneGeometry(46, 34, 8, 8);
  road.rotateX(-Math.PI / 2);
  applyBoxUV(road, 0.5);
  g.add(mesh(road, asphalt, { pos: [0, -0.005, 16], shadow: false, receive: true }));
  // Kerb and a paved landing at the entrance
  g.add(mesh(chamferBox(24, 0.13, 0.32, 0.012, 0.008), M.joineryDark, { pos: [0, 0.065, 9.4], receive: true }));
  const landing = chamferBox(4.2, 0.10, 1.5, 0.02, 0.012);
  applyBoxUV(landing, 1.2);
  g.add(mesh(landing, M.joinery, { pos: [0, 0.05, 3.65], receive: true }));
  // Building face around the door, so the entrance reads as a building
  const facade = applySmoke(new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.95 }));
  const wallL = chamferBox(9.5, 9, 0.4, 0.02, 0.014); applyBoxUV(wallL, 0.6);
  g.add(mesh(wallL, facade, { pos: [-5.7, 4.5, 3.1] }));
  const wallR = chamferBox(9.5, 9, 0.4, 0.02, 0.014); applyBoxUV(wallR, 0.6);
  g.add(mesh(wallR, facade, { pos: [5.7, 4.5, 3.1] }));
  const lintel = chamferBox(2.5, 6.6, 0.4, 0.02, 0.014); applyBoxUV(lintel, 0.6);
  g.add(mesh(lintel, facade, { pos: [0, 5.7, 3.1] }));
  // Entrance surround and canopy
  g.add(mesh(chamferBox(1.65, 2.5, 0.14, 0.01, 0.008), M.joinery, { pos: [0, 1.25, 3.02] }));
  g.add(mesh(chamferBox(2.4, 0.10, 0.9, 0.014, 0.01), M.joineryDark, { pos: [0, 2.62, 3.35] }));
  // Entry lamp still burning
  const lamp = mesh(lathe([[0.001, 0], [0.09, 0.02], [0.10, 0.10], [0.06, 0.16], [0, 0.17]], 18), M.exitWhite, { pos: [0, 2.42, 3.35] });
  g.add(lamp);
  const lampLight = new THREE.PointLight(0xffd9a0, 34, 11, 2);
  lampLight.position.set(0, 2.42, 3.9);
  g.add(lampLight);

  const truck = P.buildAppliance();
  truck.position.set(-5.0, 0, 8.0);
  truck.rotation.y = Math.PI * 0.5;
  g.add(truck);
  g.userData.truck = truck;

  // Beacon light spilling onto the building
  const red = new THREE.PointLight(0xff2a12, 0, 22, 2);
  red.position.set(-2.1, 2.7, 8.3);
  const blue = new THREE.PointLight(0x3a7bff, 0, 22, 2);
  blue.position.set(-2.4, 2.7, 7.6);
  g.add(red); g.add(blue);
  g.userData.beacons = { red, blue };

  // Scene lighting on the pavement: the appliance's telescopic mast floods the
  // entrance, with a cooler fill from the far side of the street.
  const work = new THREE.SpotLight(0xfff2d8, 210, 26, 0.72, 0.6, 1.5);
  work.position.set(-3.2, 4.7, 8.4);
  work.target.position.set(0.3, 0.5, 5.2);
  g.add(work); g.add(work.target);

  // Everything on the street dims right down once we are inside the flat, so
  // the interior is lit only by the torch and the emergency luminaires.
  g.userData.street = [work, lampLight];
  for (const l of g.userData.street) l.userData.base = l.intensity;

  scene.add(g);
  return g;
}

/* =======================================================================
 * Game
 * ===================================================================== */
class Game {
  constructor() {
    this.canvas = document.getElementById('view');
    this.snd = new Sound();
    this.clock = new THREE.Clock();
    this.phase = 'boot';
    this.t = 0;
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
  }

  /* ------------------------------- setup ------------------------------ */
  init() {
    const renderer = this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true, powerPreference: 'high-performance', stencil: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070605);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 90);
    this.camLook = new THREE.Vector3();

    buildMaterials();
    this.buildEnvironment();

    // ---- world ----
    const apt = buildApartment(scene);
    this.rooms = apt.rooms;
    this.blockers = [];
    apt.root.traverse((o) => { if (o.isMesh) this.blockers.push(o); });
    this.rayc = new THREE.Raycaster();
    this.route = buildRoute();
    P.buildHose(scene, this.route);
    P.buildEgressMarkers(scene, this.route);
    this.motes = P.buildMotes(scene);
    this.sparkles = new Sparkles(scene);
    this.street = buildStreet(scene);
    this.placeFurniture();
    this.placeSigns();
    this.buildLights();

    const rig = this.rig = buildFirefighter();
    scene.add(rig.root);
    this.bodyShadow = P.contactShadow(0.85, 0, 0, 0.5, 0.006);
    scene.add(this.bodyShadow);

    // ---- findables ----
    this.teddy = P.makeTeddy();
    this.teddy.position.copy(FINDS.teddy.pos);
    this.teddy.rotation.set(-1.15, 0.7, 0.25);   // toppled on its back under the table
    scene.add(this.teddy);
    this.teddyShadow = P.contactShadow(0.20, FINDS.teddy.pos.x, FINDS.teddy.pos.z, 0.45);
    scene.add(this.teddyShadow);

    this.kitten = P.makeKitten();
    this.kitten.position.copy(FINDS.kitten.pos);
    this.kitten.rotation.y = 1.25;
    scene.add(this.kitten);
    this.kittenShadow = P.contactShadow(0.22, FINDS.kitten.pos.x, FINDS.kitten.pos.z, 0.45);
    scene.add(this.kittenShadow);

    // arc-length of each find, so hints know how close we are
    for (const key of Object.keys(FINDS)) FINDS[key].s = this.nearestS(FINDS[key].pos);

    this.gearProps();

    // ---- state ----
    this.s = 1.7;
    this.dir = 1;
    this.vel = 0;
    this.stance = 0;
    this.stanceTarget = 0;
    this.phaseAngle = 0;
    this.phaseTarget = 0;
    this.stride = 0;
    this.found = { teddy: false, kitten: false };
    this.aim = { x: 0, y: 0 };
    this.torchOn = false;
    this.fovKick = 0;
    this.breathT = 0;
    this.turning = 0;
    this.yaw = Math.PI;
    this.holding = false;
    this.autoStrokeT = 0;

    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));

    this.setPhase('title');
    document.getElementById('boot').classList.add('fade');
    setTimeout(() => document.getElementById('boot').classList.add('hidden'), 600);

    renderer.setAnimationLoop(() => this.frame());
  }

  /** Tiny procedural environment so metals have something to reflect. */
  buildEnvironment() {
    const w = 64, h = 32;
    const data = new Float32Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1);
      // Warm, dim smoke above; almost black floor below.
      const top = [0.075, 0.058, 0.040], bot = [0.012, 0.010, 0.009];
      const k = Math.pow(1 - v, 1.5);
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        data[i] = bot[0] + (top[0] - bot[0]) * k;
        data[i + 1] = bot[1] + (top[1] - bot[1]) * k;
        data[i + 2] = bot[2] + (top[2] - bot[2]) * k;
        data[i + 3] = 1;
      }
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromEquirectangular(tex).texture;
    this.scene.environmentIntensity = 0.7;
    pmrem.dispose();
    tex.dispose();
  }

  placeFurniture() {
    const scene = this.scene;
    const put = (obj, x, z, ry = 0, shadowR = 0) => {
      obj.position.set(x, 0, z);
      obj.rotation.y = ry;
      scene.add(obj);
      if (shadowR) scene.add(P.contactShadow(shadowR, x, z, 0.45));
      return obj;
    };
    // Living room
    put(F.makeSofa(), 2.02, -2.05, -Math.PI / 2, 1.15);
    put(F.makeCoffeeTable(), 0.52, -1.98, 0.06, 0.62);
    put(F.makeTvUnit(), -3.16, -1.55, Math.PI / 2, 0.78);
    put(F.makeBookshelf(), -2.30, -5.62, 0, 0.5);
    put(F.makePottedPlant(), -3.05, -0.22, 0, 0.28);
    put(F.makeFloorToys(3), -1.55, -3.30, 0.4);
    // Rug under the coffee table
    const rug = mesh(chamferBox(2.5, 0.016, 1.95, 0.02, 0.006), materials().rug,
      { pos: [0.75, 0.008, -2.15], shadow: false, receive: true });
    applyBoxUV(rug.geometry, 1.6);
    scene.add(rug);
    // Hall
    put(F.makeShoeCabinet(), 0.62, 1.80, -Math.PI / 2, 0.5);
    // Kid's room
    put(F.makeBed(), -7.08, -4.68, 0, 1.05);
    put(F.makeToyChest(), -4.10, -5.42, 0.1, 0.45);
    put(F.makeFloorToys(8), -5.30, -3.30, 1.1);
    const krug = mesh(chamferBox(1.9, 0.014, 1.5, 0.02, 0.005), materials().rug,
      { pos: [-5.45, 0.007, -3.85], shadow: false, receive: true });
    applyBoxUV(krug.geometry, 1.6);
    scene.add(krug);
    const shelf = F.makeWallShelf();
    shelf.position.set(-5.95, 1.32, -2.30);
    shelf.rotation.y = Math.PI;
    scene.add(shelf);
  }

  placeSigns() {
    const scene = this.scene;
    this.signs = [];
    const add = (x, y, z, ry) => {
      const s = P.makeExitSign();
      s.position.set(x, y, z);
      s.rotation.y = ry;
      scene.add(s);
      this.signs.push(s);
      return s;
    };
    add(0, 2.17, 2.80, Math.PI);              // over the front door, seen from the hall
    add(0, 2.24, 0.12, Math.PI);              // over the opening, seen from the living room
    add(-3.49, 2.14, -4.50, -Math.PI / 2);    // over the kid's room door

    this.emergs = [];
    const em = (x, y, z, ry) => {
      const e = P.makeEmergencyLight();
      e.position.set(x, y, z);
      e.rotation.y = ry;
      scene.add(e);
      this.emergs.push(e);
      return e;
    };
    em(2.53, 2.26, -4.9, -Math.PI / 2);
    em(-6.6, 2.24, -2.28, Math.PI);
  }

  buildLights() {
    const scene = this.scene;
    this.hemi = new THREE.HemisphereLight(0x3a3226, 0x171210, 0.62);
    scene.add(this.hemi);
    this.amb = new THREE.AmbientLight(0x453a2e, 0.30);
    scene.add(this.amb);

    // Battery emergency luminaire in the living room
    this.emLight = new THREE.SpotLight(0xe6ecff, 16, 11, 1.10, 0.8, 1.3);
    this.emLight.position.set(2.48, 2.24, -4.9);
    this.emLight.target.position.set(-1.2, 0.1, -3.4);
    scene.add(this.emLight); scene.add(this.emLight.target);

    this.emLight2 = new THREE.SpotLight(0xe6ecff, 11, 8.5, 1.15, 0.85, 1.3);
    this.emLight2.position.set(-6.6, 2.22, -2.34);
    this.emLight2.target.position.set(-6.4, 0.1, -4.6);
    scene.add(this.emLight2); scene.add(this.emLight2.target);

    // Beacon wash through the living room window
    this.winLight = new THREE.PointLight(0xff3018, 0, 12, 2);
    this.winLight.position.set(3.1, 1.5, -2.25);
    scene.add(this.winLight);
  }

  /** The kit the player puts on, floating and waiting to be grabbed. */
  gearProps() {
    const rig = this.rig;
    rig.facepiece.visible = false;
    rig.cylMount.visible = false;
    rig.harness.visible = false;

    const ringMat = new THREE.SpriteMaterial({
      map: softSprite(2.6), color: 0xffcf6a, transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    const mkRing = () => { const s = new THREE.Sprite(ringMat.clone()); s.scale.set(0.9, 0.9, 1); return s; };

    // Loose facepiece hovering at chest height
    this.propMask = group('propMask');
    const fp = rig.facepiece.clone(true);
    fp.visible = true;
    fp.traverse((o) => { o.visible = true; });
    this.propMask.add(fp);
    this.propMask.userData.ring = mkRing();
    this.propMask.add(this.propMask.userData.ring);
    this.scene.add(this.propMask);

    // Loose cylinder standing on the ground
    this.propCyl = group('propCyl');
    const cy = rig.cylinder.clone(true);
    this.propCyl.add(cy);
    this.propCyl.userData.ring = mkRing();
    this.propCyl.userData.ring.scale.set(1.2, 1.2, 1);
    this.propCyl.add(this.propCyl.userData.ring);
    this.scene.add(this.propCyl);

    this.propMask.visible = false;
    this.propCyl.visible = false;
  }

  /* ------------------------------ input ------------------------------ */
  bindInput() {
    const input = this.input = new Input(this.canvas);
    input.on('aim', (n) => { this.aim = n; });
    input.on('down', () => this.wantLow(true));
    input.on('up', () => this.wantLow(false));
    input.on('stroke', (e) => this.stroke(e));
    input.on('holdStart', () => { this.holding = true; });
    input.on('holdEnd', () => { this.holding = false; });
    input.on('tap', (n) => this.onTap(n));
    input.on('press', () => this.snd.ensure());

    document.getElementById('play').addEventListener('click', () => {
      this.snd.ensure();
      this.startGear();
    });
    document.getElementById('again').addEventListener('click', () => this.restart());
  }

  wantLow(low) {
    if (this.phase !== 'search' && this.phase !== 'return' && this.phase !== 'enter') return;
    if (low === (this.stanceTarget > 0.5)) return;
    this.stanceTarget = low ? 1 : 0;
    this.snd.whoosh(low);
    if (low) {
      this.fovKick = 1;
      const b = document.getElementById('lowbadge');
      b.classList.remove('hidden'); b.classList.remove('show');
      void b.offsetWidth; b.classList.add('show');
      clearTimeout(this._badgeT);
      this._badgeT = setTimeout(() => b.classList.add('hidden'), 1150);
    }
  }

  stroke(e) {
    if (this.phase === 'gear') return;
    if (this.phase !== 'search' && this.phase !== 'return') return;
    if (this.stance < 0.45) {
      // Standing up you can shuffle, but the smoke is in your eyes: nudge, never punish.
      if (this.t - (this._lastNudge || -9) > 1.4) {
        this._lastNudge = this.t;
        this.snd.nudge();
        this.coach('down');
      }
      this.vel = Math.max(this.vel, 0.12);
      return;
    }
    this.vel = Math.min(this.vel + 0.85, 1.35);
    this.phaseTarget += Math.PI;
    this.snd.scuff(0.7 + Math.random() * 0.4);
    this.hideCoach();
  }

  onTap(n) {
    this.snd.ensure();
    if (this.phase === 'gear') { this.gearTap(); return; }
    if (!this.torchOn && (this.phase === 'search' || this.phase === 'return')) {
      this.torchOn = true;
    }
  }

  /* ------------------------------ phases ----------------------------- */
  setPhase(p) { this.phase = p; this.phaseT = 0; }

  startGear() {
    document.getElementById('title').classList.add('fade');
    setTimeout(() => document.getElementById('title').classList.add('hidden'), 550);
    this.setPhase('gear');
    this.gearStep = 0;
    smokeUniforms.uSmokeMul.value = 0.05;
    this.snd.setAmbience(0.45);
    this.snd.setMuffle(0);

    // Stage the firefighter on the pavement, facing the camera three-quarters.
    this.rig.root.position.set(0.35, 0, 5.55);
    this.yaw = Math.PI - 0.32;
    this.rig.root.rotation.y = this.yaw;
    this.stance = 0; this.stanceTarget = 0;
    this.propMask.visible = true;
    this.propMask.position.set(0.95, 1.16, 4.75);
    this.propCyl.visible = false;
    this.propCyl.position.set(-0.55, 0.36, 4.85);
    this.propCyl.rotation.set(0, 0.4, 0);
    this.camera.position.set(1.62, 1.42, 4.05);
    this.camLook.set(0.35, 1.15, 5.4);
    this.coachWorld = this.propMask.position;
    this.coach('tap');
    document.getElementById('finds').classList.remove('hidden');
  }

  gearTap() {
    if (this.gearAnim) return;
    if (this.gearStep === 0) {
      // Mask on: it swings up to the face and seals.
      this.gearAnim = { kind: 'mask', t: 0, from: this.propMask.position.clone() };
      this.snd.click(1500, 0.14);
      this.hideCoach();
    } else if (this.gearStep === 1) {
      this.gearAnim = { kind: 'cyl', t: 0, from: this.propCyl.position.clone() };
      this.snd.thud(0.5, 78);
      this.hideCoach();
    } else if (this.gearStep === 2) {
      this.torchOn = true;
      this.snd.click(2600, 0.16);
      this.gearStep = 3;
      this.hideCoach();
      setTimeout(() => this.startEnter(), 1100);
    }
  }

  startEnter() {
    this.setPhase('enter');
    this.enterT = 0;
    this.snd.setMuffle(0.55);
    this.hideCoach();
  }

  startSearch() {
    this.setPhase('search');
    smokeUniforms.uSmokeMul.value = 1.0;
    this.s = 1.70; this.dir = 1; this.vel = 0;
    this.stance = 0; this.stanceTarget = 0;
    this.coach('down');
    document.getElementById('posture').classList.remove('hidden');
    this.snd.setAmbience(0.75);
  }

  collect(which) {
    if (this.found[which]) return;
    this.found[which] = true;
    const el = document.getElementById(which === 'teddy' ? 'find-teddy' : 'find-kitten');
    el.classList.add('got', 'pop');
    const obj = which === 'teddy' ? this.teddy : this.kitten;
    const sh = which === 'teddy' ? this.teddyShadow : this.kittenShadow;
    if (sh) sh.visible = false;
    this.sparkles.burst(obj.getWorldPosition(new THREE.Vector3()).setY(0.25), 90, 0xffd07a, 1.5, 1.6, 110);
    this.snd.chime(which === 'teddy' ? 620 : 720, 5, 0.15);
    if (which === 'kitten') this.snd.meow();
    this.setPhase('spot');
    this.spotTarget = obj;
    this.spotWhich = which;
    this.spotT = 0;
    this.vel = 0;
  }

  finishSpot() {
    const which = this.spotWhich;
    if (which === 'teddy') {
      this.teddy.scale.setScalar(0.85);
      this.rig.beltSocket.add(this.teddy);
      this.teddy.position.set(0.02, -0.03, 0);
      this.teddy.rotation.set(0.2, 0.4, -1.5);
      this.setPhase('search');
      this.coach('side');
    } else {
      this.kitten.scale.setScalar(0.95);
      this.rig.backSocket.add(this.kitten);
      this.kitten.position.set(0.15, 0.14, 0.10);
      this.kitten.rotation.set(0.10, Math.PI * 0.85, 0.12);
      this.startReturn();
    }
  }

  startReturn() {
    this.setPhase('return');
    this.dir = -1;
    this.turning = 1;
    this.vel = 0;
    this.coach('side');
    for (const s of this.signs) s.userData.pulse = true;
  }

  startRescue() {
    this.setPhase('rescue');
    this.rescueT = 0;
    this.stanceTarget = 0;
    this.snd.fanfare();
    this.snd.setMuffle(0.0);
    this.hideCoach();
    document.getElementById('posture').classList.add('hidden');
  }

  restart() {
    window.location.reload();
  }

  /* ------------------------------- HUD ------------------------------- */
  coach(kind) {
    const el = document.getElementById('coach');
    if (this._coachKind === kind && !el.classList.contains('hidden')) return;
    this._coachKind = kind;
    el.classList.remove('hidden', 'g-down', 'g-side', 'g-tap');
    el.classList.add('g-' + kind);
    const arrows = document.getElementById('coach-arrows');
    const A = {
      down: '<polygon class="arrow" points="60,104 46,84 74,84"/><rect class="arrow" x="54" y="58" width="12" height="30" rx="5"/>',
      side: '<polygon class="arrow" points="4,60 26,48 26,72"/><polygon class="arrow" points="116,60 94,48 94,72"/>',
      tap: '<circle class="ring" cx="60" cy="60" r="16"/>',
    };
    arrows.innerHTML = A[kind] || '';
    this._coachOn = true;
  }
  hideCoach() {
    document.getElementById('coach').classList.add('hidden');
    this._coachKind = null; this._coachOn = false;
    this.coachWorld = null;
  }
  placeCoach() {
    const el = document.getElementById('coach');
    if (el.classList.contains('hidden')) return;
    if (this.coachWorld) {
      this.tmp.copy(this.coachWorld).project(this.camera);
      const x = (this.tmp.x * 0.5 + 0.5) * 100, y = (-this.tmp.y * 0.5 + 0.5) * 100;
      el.style.left = clamp(x, 12, 88) + '%';
      el.style.top = clamp(y, 14, 86) + '%';
    } else {
      el.style.left = '50%';
      el.style.top = this._coachKind === 'down' ? '40%' : '76%';
    }
  }

  /* ------------------------------ helpers ---------------------------- */
  nearestS(p) {
    let best = 0, bd = 1e9;
    const N = 240;
    for (let i = 0; i <= N; i++) {
      const s = (i / N) * this.route.length;
      const q = this.route.at(s);
      const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Portrait gets a tall, natural lens; landscape widens out until the
    // horizontal field of view reaches about 80 degrees, then stops. Letting the
    // vertical angle run any wider distorts near objects badly on a phone.
    const vfov = aspect < 1
      ? 74
      : clamp(2 * Math.atan(Math.tan(40 * Math.PI / 180) / aspect) * 180 / Math.PI, 40, 74);
    this.baseFov = vfov;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.sparkles.mat.uniforms.uPix.value = this.renderer.getPixelRatio() * h / 900;
  }

  /* ------------------------------- loop ------------------------------ */
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.t += dt;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    const rig = this.rig;
    smokeUniforms.uSmokeTime.value = this.t;

    switch (this.phase) {
      case 'title': this.updateTitle(dt); break;
      case 'gear': this.updateGear(dt); break;
      case 'enter': this.updateEnter(dt); break;
      case 'search': case 'return': this.updateSearch(dt); break;
      case 'spot': this.updateSpot(dt); break;
      case 'rescue': this.updateRescue(dt); break;
    }

    this.updateCommon(dt);
    this.placeCoach();
  }

  updateTitle(dt) {
    // Slow drift past the appliance while the title is up.
    const a = this.t * 0.10;
    this.camera.position.set(3.0 + Math.sin(a) * 0.9, 1.72, 6.1 + Math.cos(a) * 0.7);
    this.camLook.set(-1.4, 1.5, 6.8);
    this.rig.root.position.set(0.35, 0, 5.55);
    this.rig.root.rotation.y = Math.PI - 0.32;
    this.rig.facepiece.visible = false;
    this.rig.cylMount.visible = false;
    this.rig.harness.visible = false;
    poseFirefighter(this.rig, 0, 0, 0, 0);
  }

  updateGear(dt) {
    const rig = this.rig;
    const bob = Math.sin(this.t * 1.7) * 0.02;

    if (this.gearStep === 0) {
      this.propMask.visible = true;
      this.propMask.position.y = 1.16 + bob;
      this.propMask.rotation.y = Math.sin(this.t * 0.7) * 0.35;
      this.propMask.userData.ring.material.opacity = 0.35 + Math.sin(this.t * 3.2) * 0.2;
      this.coachWorld = this.propMask.position;
      this.coach('tap');
    }

    if (this.gearAnim) {
      const a = this.gearAnim;
      a.t += dt / 1.15;
      const k = clamp(a.t, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      if (a.kind === 'mask') {
        const target = rig.head.getWorldPosition(new THREE.Vector3());
        target.y -= 0.005;
        // arc it up to the face
        this.propMask.position.lerpVectors(a.from, target, e);
        this.propMask.position.y += Math.sin(e * Math.PI) * 0.22;
        this.propMask.rotation.y = (1 - e) * 0.8 + this.yaw * e;
        this.propMask.userData.ring.material.opacity = (1 - e) * 0.4;
        if (k >= 1) {
          this.propMask.visible = false;
          rig.facepiece.visible = true;
          this.snd.click(1900, 0.16);
          this.snd.hiss(0.7, 0.16);
          setTimeout(() => this.snd.breath(1), 320);
          this.snd.setMuffle(0.45);
          this.gearAnim = null;
          this.gearStep = 1;
          this.propCyl.visible = true;
          this.coachWorld = this.propCyl.position;
          this.coach('tap');
          // Turn so the back — and the cylinder going onto it — faces the camera.
          this.turnTo = 0.16;
        }
      } else if (a.kind === 'cyl') {
        const target = rig.cylMount.getWorldPosition(new THREE.Vector3());
        this.propCyl.position.lerpVectors(a.from, target, e);
        this.propCyl.position.y += Math.sin(e * Math.PI) * 0.30;
        this.propCyl.rotation.x = e * -0.08;
        this.propCyl.rotation.y = THREE.MathUtils.lerp(0.4, this.yaw, e);
        this.propCyl.userData.ring.material.opacity = (1 - e) * 0.4;
        if (k >= 1) {
          this.propCyl.visible = false;
          rig.cylMount.visible = true;
          rig.harness.visible = true;
          this.snd.thud(0.55, 66);
          this.snd.click(1200, 0.13);
          setTimeout(() => { this.snd.hiss(1.2, 0.2); this.snd.click(900, 0.1); }, 260);
          setTimeout(() => this.snd.breath(1), 900);
          this.gearAnim = null;
          this.gearStep = 2;
          this.turnTo = Math.PI - 0.14;
          // Now the torch: one tap and we can see.
          setTimeout(() => {
            this.coachWorld = rig.helmet.getWorldPosition(new THREE.Vector3());
            this.coach('tap');
          }, 700);
        }
      }
    }

    if (this.turnTo != null) {
      this.yaw = damp(this.yaw, this.turnTo, 3.2, dt);
      if (Math.abs(this.yaw - this.turnTo) < 0.01) this.turnTo = null;
    }
    rig.root.rotation.y = this.yaw;
    poseFirefighter(rig, 0, this.t * 0.6, 0.06, 0);

    // Camera eases between a front three-quarter and a shot over the back.
    const wantBack = this.gearStep === 1;
    const camT = wantBack ? new THREE.Vector3(-1.35, 1.45, 4.35) : new THREE.Vector3(1.62, 1.40, 4.05);
    const lookT = wantBack ? new THREE.Vector3(0.35, 1.20, 5.45) : new THREE.Vector3(0.35, 1.15, 5.4);
    this.camera.position.lerp(camT, 1 - Math.exp(-2.0 * dt));
    this.camLook.lerp(lookT, 1 - Math.exp(-2.0 * dt));
  }

  updateEnter(dt) {
    const rig = this.rig;
    this.enterT += dt;
    const k = clamp(this.enterT / 3.0, 0, 1);
    const e = k * k * (3 - 2 * k);
    // Walk from the pavement, up the step, through the door.
    const from = new THREE.Vector3(0.35, 0, 5.55);
    const to = new THREE.Vector3(0.0, 0, 2.05);
    rig.root.position.lerpVectors(from, to, e);
    this.yaw = damp(this.yaw, Math.PI, 4, dt);
    rig.root.rotation.y = this.yaw;
    poseFirefighter(rig, 0, this.enterT * 7.2, 1, 1);
    if (this.enterT % 0.44 < dt) this.snd.thud(0.22, 120);

    const camFrom = new THREE.Vector3(1.62, 1.40, 4.05);
    const camTo = new THREE.Vector3(0.0, 1.55, 3.9);
    this.camera.position.lerpVectors(camFrom, camTo, e);
    this.camLook.lerp(new THREE.Vector3(0, 1.35, 2.0), 1 - Math.exp(-2.4 * dt));

    smokeUniforms.uSmokeMul.value = THREE.MathUtils.lerp(0.05, 1.0, clamp((this.enterT - 1.1) / 1.6, 0, 1));

    if (this.enterT > 3.2) this.startSearch();
  }

  updateSearch(dt) {
    const rig = this.rig;

    // --- posture -------------------------------------------------------
    const rate = this.stanceTarget > this.stance ? 7.0 : 5.0;
    this.stance = damp(this.stance, this.stanceTarget, rate, dt);

    // --- moving --------------------------------------------------------
    if (this.holding && this.stance > 0.45) {
      this.autoStrokeT += dt;
      if (this.autoStrokeT > 0.62) { this.autoStrokeT = 0; this.stroke({ dir: 1 }); }
    }
    this.vel = Math.max(0, this.vel - this.vel * 2.4 * dt - 0.05 * dt);
    const moveGate = clamp((this.stance - 0.35) / 0.35, 0, 1);
    const ds = this.vel * moveGate * dt * this.dir;
    this.s = clamp(this.s + ds, 0.55, this.route.length - 0.12);

    this.stride = damp(this.stride, clamp(this.vel * 1.5, 0, 1), 5, dt);
    this.phaseAngle = damp(this.phaseAngle, this.phaseTarget, 7.5, dt);

    // --- where the body is --------------------------------------------
    const p = this.route.at(this.s);
    const tan = this.route.tangentAt(this.s);
    const fwd = tan.clone().multiplyScalar(this.dir);
    rig.root.position.set(p.x, 0, p.z);
    const wantYaw = Math.atan2(fwd.x, fwd.z);
    this.yaw = this.turning > 0
      ? this.dampAngle(this.yaw, wantYaw, 3.4, dt)
      : this.dampAngle(this.yaw, wantYaw, 6.0, dt);
    rig.root.rotation.y = this.yaw;
    if (this.turning > 0 && Math.abs(this.angleDiff(this.yaw, wantYaw)) < 0.08) this.turning = 0;

    poseFirefighter(rig, this.stance, this.phaseAngle, 0.35 + this.stride * 0.65, 0);

    this.railCamera(dt);

    // --- what we're hunting for ---------------------------------------
    const bodyPos = rig.root.position;
    for (const key of ['teddy', 'kitten']) {
      if (this.found[key]) continue;
      if (key === 'kitten' && !this.found.teddy && false) continue;
      const f = FINDS[key];
      const d = Math.hypot(bodyPos.x - f.pos.x, bodyPos.z - f.pos.z);
      const obj = key === 'teddy' ? this.teddy : this.kitten;
      // A gentle glow builds as you get near, so nobody has to search blind.
      const near = clamp(1 - (d - f.radius) / 2.2, 0, 1);
      obj.scale.setScalar(1 + Math.sin(this.t * 4) * 0.012 * near);
      if (near > 0.15 && this.stance > 0.5) this.hintFind(obj, near);
      if (d < f.radius && this.stance > 0.55) this.collect(key);
    }

    // --- coaching ------------------------------------------------------
    if (this.stance < 0.4 && !this._coachOn && this.t > 1.5) this.coach('down');
    if (this.stance > 0.7 && this._coachKind === 'down') { this.hideCoach(); this.coach('side'); }

    // --- home again ----------------------------------------------------
    if (this.dir < 0 && this.s <= 0.75) this.startRescue();
  }

  /**
   * The camera rides the same rail as the player, a little way behind and to
   * one side. Staying on the route guarantees it never ends up inside a wall,
   * and the lateral offset opens a clear view past the cylinder on the back.
   */
  railCamera(dt, lookAtPoint = null) {
    const back = THREE.MathUtils.lerp(2.30, 2.62, this.stance);
    const camS = clamp(this.s - back * this.dir, 0.05, this.route.length - 0.05);
    const cp = this.route.at(camS);
    const ct = this.route.tangentAt(camS);
    const side = new THREE.Vector3(-ct.z, 0, ct.x).multiplyScalar(this.dir);
    const off = THREE.MathUtils.lerp(0.18, 0.48, this.stance);
    const camY = THREE.MathUtils.lerp(1.58, 0.80, this.stance);
    const target = new THREE.Vector3(cp.x + side.x * off, camY, cp.z + side.z * off);
    // Never let a wall, door or reveal get between the camera and the player:
    // cast back from the head and pull the camera in to just before any hit.
    const from = new THREE.Vector3(this.rig.root.position.x, camY, this.rig.root.position.z);
    const toCam = target.clone().sub(from);
    const dist = toCam.length();
    if (dist > 0.05) {
      this.rayc.set(from, toCam.multiplyScalar(1 / dist));
      this.rayc.far = dist + 0.12;
      const hit = this.rayc.intersectObjects(this.blockers, false)[0];
      if (hit && hit.distance < dist) {
        target.copy(from).addScaledVector(this.rayc.ray.direction, Math.max(0.45, hit.distance - 0.18));
      }
    }
    this.camera.position.lerp(target, 1 - Math.exp(-6.5 * dt));
    if (lookAtPoint) {
      this.camLook.lerp(lookAtPoint, 1 - Math.exp(-4.0 * dt));
      return;
    }
    const lookY = THREE.MathUtils.lerp(1.28, 0.52, this.stance);
    const la = this.route.at(clamp(this.s + 2.4 * this.dir, 0.1, this.route.length - 0.05));
    this.camLook.lerp(new THREE.Vector3(la.x + side.x * off * 0.5, lookY, la.z + side.z * off * 0.5),
      1 - Math.exp(-5.0 * dt));
  }

  hintFind(obj, k) {
    if (!this._hintSprite) {
      const m = new THREE.SpriteMaterial({
        map: softSprite(2.4), color: 0xffd58a, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      this._hintSprite = new THREE.Sprite(m);
      this.scene.add(this._hintSprite);
    }
    const sp = this._hintSprite;
    sp.visible = true;
    obj.getWorldPosition(sp.position);
    sp.position.y += 0.22;
    const pulse = 0.55 + Math.sin(this.t * 4.2) * 0.45;
    sp.material.opacity = 0.30 * k * pulse;
    const sc = 0.55 + 0.25 * pulse;
    sp.scale.set(sc, sc, 1);
    this._hintT = this.t;
  }

  updateSpot(dt) {
    this.spotT += dt;
    const rig = this.rig;
    poseFirefighter(rig, this.stance, this.phaseAngle, 0.3, 0);
    // Stay on the rail — a free-flying push-in ends up inside the firefighter
    // in tight spots — and sell the moment by looking straight at the find and
    // tightening the lens instead.
    const obj = this.spotTarget;
    const wp = obj.getWorldPosition(new THREE.Vector3());
    this.railCamera(dt, wp.clone().setY(wp.y + 0.12));
    this.spotZoom = Math.sin(clamp(this.spotT / 1.9, 0, 1) * Math.PI) * 9.0;
    if (this.spotT > 0.35 && !this._spotBurst) {
      this._spotBurst = true;
      this.sparkles.burst(wp.clone().setY(wp.y + 0.1), 60, 0xfff0c0, 1.1, 1.3, 80);
    }
    if (this.spotT > 1.9) { this._spotBurst = false; this.finishSpot(); }
  }

  updateRescue(dt) {
    this.rescueT += dt;
    const rig = this.rig;
    const OUT = new THREE.Vector3(0.45, 0, 5.85);   // out on the pavement

    if (this.rescueT < 1.1) {
      // Last couple of strides through the doorway, still in the hall.
      const p = this.route.at(0.75);
      rig.root.position.set(p.x, 0, p.z);
      this.stance = damp(this.stance, 0, 4.0, dt);
      this.yaw = this.dampAngle(this.yaw, 0, 3.0, dt);
      rig.root.rotation.y = this.yaw;
      poseFirefighter(rig, this.stance, this.phaseAngle, 0.2, 0);
      this.railCamera(dt);
      return;
    }

    // The hall is too narrow for a hero shot, so we cut on the flash — the
    // moment of stepping back out into the light — and pick up outside.
    if (!this._flashed) {
      this._flashed = true;
      const f = document.getElementById('flash');
      f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
      smokeUniforms.uSmokeMul.value = 0.05;
      this.hemi.intensity = 0.9;
      this.amb.intensity = 0.45;
      this.stance = 0;
      // Cradle the kitten in both arms for the walk out.
      if (this.kitten) {
        rig.spine.add(this.kitten);
        this.kitten.position.set(0.0, 0.06, 0.30);
        this.kitten.rotation.set(-0.25, Math.PI, 0);
        this.kitten.scale.setScalar(1.0);
      }
      this.torchOn = false;
      this.snd.setMuffle(0);
    }

    const rt = this.rescueT - 1.1;
    // Walk out of the building onto the pavement, then stop and turn to camera.
    const walk = clamp(rt / 2.8, 0, 1);
    const from = new THREE.Vector3(0.0, 0, 2.45);
    rig.root.position.lerpVectors(from, OUT, walk * walk * (3 - 2 * walk));
    this.yaw = this.dampAngle(this.yaw, walk < 0.88 ? 0 : 2.31, 2.6, dt);
    rig.root.rotation.y = this.yaw;
    const moving = walk < 0.96 ? 1 : 0.06;
    poseFirefighter(rig, 0, rt * 6.4, moving, moving);
    if (moving > 0.5 && Math.floor(rt / 0.44) !== this._step) { this._step = Math.floor(rt / 0.44); this.snd.thud(0.2, 118); }

    // Camera stands out on the street, clear of the building, and eases back so
    // the appliance and its beacons come into frame behind the crew.
    // Camera holds by the entrance so the appliance sits behind the crew.
    const camP = new THREE.Vector3(1.95, 1.52, 4.70).lerp(new THREE.Vector3(3.05, 1.90, 3.55), clamp(rt / 4.2, 0, 1));
    this.camera.position.lerp(camP, 1 - Math.exp(-2.2 * dt));
    this.camLook.lerp(rig.root.position.clone().setY(1.24), 1 - Math.exp(-2.2 * dt));

    if (rt > 1.4 && !this._confetti) {
      this._confetti = true;
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          this.sparkles.burst(new THREE.Vector3(OUT.x + (Math.random() - 0.5) * 2.0, 1.9, OUT.z + (Math.random() - 0.5) * 1.6),
            70, [0xffd166, 0x6fe3a0, 0xff8fa3, 0x8fd2ff][i % 4], 2.1, 2.6, 120);
        }, i * 420);
      }
    }
    if (this.rescueT > 6.2 && !this._endShown) {
      this._endShown = true;
      const end = document.getElementById('end');
      end.classList.remove('hidden');
      end.classList.add('fade');
      requestAnimationFrame(() => requestAnimationFrame(() => end.classList.remove('fade')));
    }
  }

  /** Development aid: park the camera on a subject under neutral studio light. */
  inspect(opts = {}) {
    const { pos = [0.9, 1.15, 2.3], look = [0, 1.05, 0], yaw = Math.PI, stance = 0,
      bright = 1, smoke = 0.05, gear = true, at = [0, 0, 0] } = opts;
    this.phase = 'inspect';
    if (!this._studio) {
      this._studio = new THREE.Group();
      const key = new THREE.DirectionalLight(0xfff2e0, 2.4); key.position.set(3, 5, 4);
      const fill = new THREE.DirectionalLight(0xbfd0ff, 0.9); fill.position.set(-4, 2.5, 2);
      const rim = new THREE.DirectionalLight(0xffd9a8, 1.6); rim.position.set(-1, 3, -5);
      this._studio.add(key, fill, rim);
      this.scene.add(this._studio);
    }
    this._studio.visible = bright > 0;
    this._studio.children.forEach((l) => { l.intensity = l.userData.base ||= l.intensity; l.intensity *= bright; });
    smokeUniforms.uSmokeMul.value = smoke;
    this.rig.root.position.set(at[0], at[1], at[2]);
    this.rig.root.rotation.y = yaw;
    this.rig.facepiece.visible = gear;
    this.rig.cylMount.visible = gear;
    this.rig.harness.visible = gear;
    this.torchOn = false;
    poseFirefighter(this.rig, stance, 0, 0, 0);
    this.stance = stance;
    this.camera.position.set(pos[0], pos[1], pos[2]);
    this.camLook.set(look[0], look[1], look[2]);
    this.propMask.visible = false;
    this.propCyl.visible = false;
  }

  angleDiff(a, b) { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }
  dampAngle(a, b, lambda, dt) { return a + this.angleDiff(a, b) * (1 - Math.exp(-lambda * dt)); }

  /** Everything that runs regardless of phase: torch, breathing, lights, camera. */
  updateCommon(dt) {
    const rig = this.rig;

    // ---- torch ----
    const wantIntensity = this.torchOn ? 15 : 0;
    rig.torch.intensity = damp(rig.torch.intensity, wantIntensity, 4, dt);
    rig.lampMat.emissiveIntensity = damp(rig.lampMat.emissiveIntensity, this.torchOn ? 7 : 0.05, 4, dt);
    // Aim: the beam follows the finger, within a comfortable cone.
    const ax = clamp(this.aim.x, -1, 1) * 1.15;
    const ay = clamp(this.aim.y, -1, 1) * 0.95;
    rig.torchTarget.position.x = damp(rig.torchTarget.position.x, ax, 6, dt);
    rig.torchTarget.position.y = damp(rig.torchTarget.position.y, -0.34 + ay, 6, dt);

    rig.torch.getWorldPosition(this.tmp);
    rig.torchTarget.getWorldPosition(this.tmp2);
    const bdir = this.tmp2.sub(this.tmp).normalize();
    smokeUniforms.uBeamOrigin.value.copy(this.tmp);
    smokeUniforms.uBeamDir.value.copy(bdir);
    smokeUniforms.uBeamStrength.value = damp(smokeUniforms.uBeamStrength.value, this.torchOn ? 1.05 : 0.0, 4, dt);
    this.motes.material.uniforms.uTime.value = this.t;
    this.motes.material.uniforms.uBeamOrigin.value.copy(this.tmp);
    this.motes.material.uniforms.uBeamDir.value.copy(bdir);
    this.motes.material.uniforms.uBeamStrength.value = this.torchOn ? 1 : 0;

    // ---- breathing on the regulator ----
    if (this.torchOn || this.phase === 'search' || this.phase === 'return') {
      this.breathT += dt;
      const period = 3.4 - this.stride * 0.6;
      if (this.breathT > period) { this.breathT = 0; this.snd.breath(0.65 + this.stride * 0.5); }
    }

    // ---- PASS device LED and the kitten's eyes ----
    if (rig.passLed) rig.passLed.material.emissiveIntensity = 2.2 + Math.sin(this.t * 5.0) * 1.8;

    // ---- the street only lights the scene while we are out on it ----
    const outside = this.phase === 'title' || this.phase === 'gear'
      || this.phase === 'enter' || this.phase === 'inspect'
      || (this.phase === 'rescue' && this.rescueT > 1.0);
    this._streetLevel = damp(this._streetLevel ?? 1, outside ? 1 : 0.06, 2.2, dt);
    for (const l of this.street.userData.street) l.intensity = l.userData.base * this._streetLevel;
    if (this.phase !== 'rescue') {
      this.hemi.intensity = THREE.MathUtils.lerp(0.62, 1.15, this._streetLevel);
      this.amb.intensity = THREE.MathUtils.lerp(0.30, 0.55, this._streetLevel);
    }

    // ---- appliance beacons sweep ----
    const truck = this.street.userData.truck;
    for (const lamp of truck.userData.lamps) {
      const f = Math.pow(Math.max(0, Math.sin(this.t * 5.2 + lamp.userData.phase * Math.PI * 2)), 6);
      lamp.material = lamp.material; // shared per colour; modulate through the light instead
      lamp.scale.setScalar(1 + f * 0.06);
    }
    const bp = this.street.userData.beacons;
    const rf = Math.pow(Math.max(0, Math.sin(this.t * 5.2)), 4);
    const bf = Math.pow(Math.max(0, Math.sin(this.t * 5.2 + 2.1)), 4);
    bp.red.intensity = 60 * rf;
    bp.blue.intensity = 54 * bf;
    this.winLight.intensity = (this.phase === 'rescue' ? 26 : 10) * (rf * 0.7 + bf * 0.3);
    this.winLight.color.setHex(rf > bf ? 0xff3018 : 0x3a7bff);

    // ---- exit signs breathe when it's time to leave ----
    for (const s of this.signs) {
      const g = s.userData.glow;
      if (!g) continue;
      const base = s.userData.pulse ? 0.55 + Math.sin(this.t * 3.4) * 0.35 : 0.35;
      g.material.opacity = base;
      g.scale.setScalar(s.userData.pulse ? 0.85 + Math.sin(this.t * 3.4) * 0.12 : 0.8);
    }

    // ---- posture meter + contact shadow ----
    const fill = document.querySelector('.post-fill');
    if (fill) fill.style.height = (this.stance * 100).toFixed(0) + '%';
    document.getElementById('posture').classList.toggle('low', this.stance > 0.6);

    const bs = this.bodyShadow;
    bs.position.set(rig.root.position.x, 0.006, rig.root.position.z);
    const sc = THREE.MathUtils.lerp(0.55, 1.25, this.stance);
    bs.scale.set(sc, 1, sc);
    bs.material.opacity = THREE.MathUtils.lerp(0.28, 0.5, this.stance);
    bs.visible = this.phase !== 'title';

    // ---- hint sprite fade-out ----
    if (this._hintSprite && this.t - (this._hintT || 0) > 0.2) this._hintSprite.visible = false;

    this.sparkles.update(dt);

    // ---- camera ----
    const kick = this.fovKick;
    if (kick > 0) this.fovKick = Math.max(0, kick - dt * 1.8);
    if (this.phase !== 'spot') this.spotZoom = damp(this.spotZoom || 0, 0, 4, dt);
    this.camera.fov = this.baseFov + Math.sin(this.fovKick * Math.PI) * 5.5 - (this.spotZoom || 0);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.camLook);
  }
}

/* ------------------------------ boot ------------------------------- */
const game = new Game();
// One frame of the loading screen before the (synchronous) texture bake.
requestAnimationFrame(() => requestAnimationFrame(() => {
  try {
    game.init();
    window.__game = game;
  } catch (err) {
    console.error(err);
    const b = document.querySelector('.bootbox p');
    if (b) b.textContent = 'エラー: ' + err.message;
  }
}));
