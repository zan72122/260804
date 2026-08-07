import * as THREE from 'three';
import {
  CABLES,
  DECORS,
  ROUTE_LENGTH,
  ROUTES,
  ROVS,
  type Selection,
} from '../core/content';
import { buildRouteCurve } from '../core/content';
import { buildSeabed, TrenchRibbon, type SeabedField } from '../world/seabed';
import { buildShip, type ShipBuild } from '../world/ship';
import { buildCableTip, TubeStrand } from '../world/cable';
import { buildPlough, buildRov, contactShadow, type PloughBuild, type RovBuild } from '../world/rov';
import { Bubbles, fogDensityAt, GodRays, MarineSnow, Ocean, SandPlume, waterColorAt } from '../world/ocean';
import { Sky } from '../world/sky';
import { textures } from '../core/textures';
import { SeaLife } from '../world/life';
import {
  clamp,
  clamp01,
  damp,
  disposeObject,
  dampVec,
  easeInOutCubic,
  lerp,
  resamplePolyline,
  smoothstep,
} from '../core/util';
import { sound } from '../core/audio';
import type { Input } from '../core/input';

export type SeaPhase = 'prep' | 'payout' | 'descent' | 'rov' | 'done';
type PrepState = 'idle' | 'drag' | 'thread' | 'ready';

const RINGS = 320;
const RIG_RINGS = 96;
const OVER_RINGS = 82;
const CABLE_RADIUS = 0.155;

const LAYBACK = 46; // metres the touchdown lags behind the ship
const SHIP_PER_PAID = 0.85; // ship advance per metre of cable paid out (slack)
const PAYOUT_TARGET_S = 0.62; // route fraction laid before we dive
const TRENCH_SINK = 1.38;

/**
 * Finger travel maps straight onto cable travel: one screen-height of drag
 * along the cable pays out this many metres. Displacement-coupled rather than
 * rate-coupled, so moving fast really is faster and stopping really does stop.
 */
const PAY_PER_SCREEN = 62;
const LEVER_RATE = 15.5;
/** Same idea for the seabed trace: one screen-height traced = this much route. */
const TRACE_PER_SCREEN = 0.125;

export interface SeaEvents {
  onPhase: (p: SeaPhase) => void;
  onFirstWater: () => void;
  onLightsOn: () => void;
}

export class SeaStage {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  phase: SeaPhase = 'prep';
  prepState: PrepState = 'idle';
  events: SeaEvents;

  // world
  private sky: Sky;
  private ocean: Ocean;
  private snow: MarineSnow;
  private bubbles: Bubbles;
  private sand: SandPlume;
  private godRays: GodRays;
  private life!: SeaLife;
  private wake: THREE.Mesh;

  private seabedGroup: THREE.Group | null = null;
  private field!: SeabedField;
  private trench!: TrenchRibbon;
  private guidePath!: THREE.Mesh;
  private guideUni!: Record<string, THREE.IUniform>;
  private curve!: THREE.CatmullRomCurve3;

  private ship!: ShipBuild;
  private strand!: TubeStrand;
  private tip!: { group: THREE.Group; nose: THREE.Mesh; halo: THREE.Sprite };
  private rov!: RovBuild;
  private plough!: PloughBuild;
  private rovShadow: THREE.Mesh;
  private entryFoam: THREE.Sprite;
  private ploughShadow: THREE.Mesh;

  // lights (created once, intensities animated - never added/removed mid-game)
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private ambient: THREE.AmbientLight;
  private diveLight: THREE.PointLight;

  // state
  time = 0;
  private paid = 0;
  private payRate = 0;
  private shipDist = 0;
  layS = 0;
  buryS = 0;
  private threadT = 0;
  private tipFree = new THREE.Vector3();
  private tipTarget = new THREE.Vector3();
  private lightsOn = 0;
  private lightsRequested = false;
  /** counts regardless of input, so the lamps are never gated behind a gesture */
  private lightsTimer = 0;
  private descentT = 0;
  private descentIdx = RINGS - RIG_RINGS;
  private idleTimer = 0;
  private enteredWater = false;
  private clunkStations: { idx: number; done: boolean }[] = [];
  private buryVel = 0;
  private doneT = 0;

  // scratch / caches
  private spine: THREE.Vector3[] = [];
  private raw: THREE.Vector3[] = [];
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();
  private shipFrame = new THREE.Matrix4();
  private shipPos = new THREE.Vector3();
  private shipTan = new THREE.Vector3(1, 0, 0);
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private camFov = 52;
  private targetPos = new THREE.Vector3();
  private targetLook = new THREE.Vector3();
  private targetFov = 52;
  private fogColor = new THREE.Color(0xbcdcea);
  private airFog = new THREE.Color(0xbcdcea);
  private ray = new THREE.Raycaster();
  private dragPlane = new THREE.Plane();
  // reusable scratch so the per-frame path rebuild never allocates
  private UP = new THREE.Vector3(0, 1, 0);
  private qA = new THREE.Quaternion();
  private qB = new THREE.Quaternion();
  private eA = new THREE.Euler();
  private mA = new THREE.Matrix4();
  private vA = new THREE.Vector3();
  private vB = new THREE.Vector3();
  private vC = new THREE.Vector3();
  private vD = new THREE.Vector3();
  private ONE = new THREE.Vector3(1, 1, 1);
  private shotA = new THREE.Vector3();
  private rigBuf: THREE.Vector3[] = [];
  private rigOut: THREE.Vector3[] = [];
  private overBuf: THREE.Vector3[] = [];
  private overRaw: THREE.Vector3[] = [];
  private overOut: THREE.Vector3[] = [];
  private prepCurve = new THREE.CatmullRomCurve3(
    [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
    false,
    'centripetal',
    0.5,
  );
  private bez = new THREE.CubicBezierCurve3(
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  );

  /** screen-space direction the cable currently runs, used for swipe matching */
  payDir = { x: 0, y: 1 };
  traceDir = { x: 0, y: -1 };
  /** screen position hints for the tutorial hand */
  hintPoint = new THREE.Vector3();
  hintActive = false;

  constructor(events: SeaEvents) {
    this.events = events;
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.35, 4000);
    this.scene.fog = new THREE.FogExp2(0xbcdcea, 0.0018);

    this.sky = new Sky(2400);
    this.scene.add(this.sky.mesh);
    this.ocean = new Ocean(620);
    this.scene.add(this.ocean.mesh);

    this.hemi = new THREE.HemisphereLight(0xdff0ff, 0x27424b, 1.35);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.5);
    this.sun.position.set(140, 220, -180);
    this.scene.add(this.sun);
    this.ambient = new THREE.AmbientLight(0x21506b, 0.4);
    this.scene.add(this.ambient);
    // Travels with the camera on the dive. Without it the middle of the
    // descent is a black screen: there is no sunlight left and the ROV lamps
    // are not on yet, and the cable - the whole point of the shot - vanishes.
    this.diveLight = new THREE.PointLight(0xcfeaff, 0, 46, 1.5);
    this.scene.add(this.diveLight);

    this.snow = new MarineSnow(620);
    this.scene.add(this.snow.points);
    this.bubbles = new Bubbles(340, 0xdff6ff, true);
    this.scene.add(this.bubbles.points);
    this.sand = new SandPlume(420);
    this.scene.add(this.sand.points);
    this.godRays = new GodRays();
    this.scene.add(this.godRays.group);

    // Foam patch that marks where the cable is entering the sea. Without it
    // the cable simply stops at an opaque surface and the eye loses the thread.
    this.entryFoam = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures().soft,
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.entryFoam.scale.setScalar(5);
    this.entryFoam.renderOrder = 4;
    this.scene.add(this.entryFoam);

    this.rovShadow = contactShadow(3.2);
    this.ploughShadow = contactShadow(5.0);
    this.scene.add(this.rovShadow, this.ploughShadow);

    // ship wake
    {
      const g = new THREE.PlaneGeometry(20, 130, 1, 40);
      g.rotateX(-Math.PI / 2);
      g.translate(0, 0, -75);
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `
          uniform float uTime, uOpacity; varying vec2 vUv;
          float h(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1)))*43758.5); }
          void main(){
            float along = vUv.y;
            float across = abs(vUv.x - 0.5) * 2.0;
            float spread = 0.16 + along * 0.9;
            float band = 1.0 - smoothstep(spread * 0.55, spread, across);
            float churn = h(floor(vec2(vUv.x*40.0, vUv.y*90.0 - uTime*6.0)));
            float a = band * (1.0 - along) * (0.35 + churn * 0.65) * uOpacity;
            if (a < 0.01) discard;
            gl_FragColor = vec4(1.0, 1.0, 1.0, a * 0.30);
          }`,
        transparent: true,
        depthWrite: false,
      });
      this.wake = new THREE.Mesh(g, m);
      this.wake.renderOrder = 3;
      this.scene.add(this.wake);
    }

    for (let i = 0; i < RINGS; i++) this.spine.push(new THREE.Vector3());
  }

  // -------------------------------------------------------------------------
  // build / rebuild for a selection
  // -------------------------------------------------------------------------
  build(sel: Selection) {
    const def = ROUTES[sel.routeIndex];
    const cableDef = CABLES[sel.cableIndex];
    const decor = DECORS[sel.decorIndex];
    const rovDef = ROVS[sel.rovIndex];

    // tear the previous playthrough down properly - replay must not leak GPU
    // memory. Textures are shared/cached, and material.dispose() leaves them
    // alone, so only geometry + materials go here.
    const drop = (o: THREE.Object3D | null | undefined) => {
      if (!o) return;
      this.scene.remove(o);
      disposeObject(o);
    };
    drop(this.seabedGroup);
    this.seabedGroup = null;
    if (this.trench) {
      this.scene.remove(this.trench.mesh);
      this.trench.dispose();
    }
    drop(this.guidePath);
    drop(this.ship?.group);
    if (this.strand) {
      this.scene.remove(this.strand.mesh);
      this.strand.dispose();
    }
    drop(this.tip?.group);
    drop(this.rov?.group);
    drop(this.plough?.group);
    drop(this.life?.group);

    this.curve = buildRouteCurve(def);
    const built = buildSeabed(def, this.curve);
    this.field = built.field;
    this.seabedGroup = built.group;
    this.scene.add(built.group);

    this.trench = new TrenchRibbon(this.routeOnSeabed(), this.field);
    this.scene.add(this.trench.mesh);
    this.buildGuidePath();

    this.ship = buildShip(decor, cableDef);
    this.scene.add(this.ship.group);

    this.strand = new TubeStrand(RINGS, 8, CABLE_RADIUS, cableDef);
    this.scene.add(this.strand.mesh);

    this.tip = buildCableTip(cableDef, decor.accent);
    this.scene.add(this.tip.group);

    this.rov = buildRov(rovDef, decor);
    this.scene.add(this.rov.group);
    this.plough = buildPlough(decor);
    this.scene.add(this.plough.group);

    this.life = new SeaLife((x, z) => this.field.heightAt(x, z), 0, ROUTE_LENGTH, cableDef.glow);
    this.scene.add(this.life.group);

    this.reset();
  }

  /** The route, projected down onto the seabed - shared by trench and plough. */
  private routeOnSeabed() {
    const pts: THREE.Vector3[] = [];
    const p = new THREE.Vector3();
    for (let i = 0; i <= 60; i++) {
      this.curve.getPointAt(i / 60, p);
      pts.push(new THREE.Vector3(p.x, this.field.corridorHeight(p.x, p.z), p.z));
    }
    return new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  }

  private buildGuidePath() {
    const c = this.routeOnSeabed();
    const N = 220;
    const M = 2;
    const verts: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    const acr = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      c.getPointAt(u, p);
      c.getTangentAt(u, t).normalize();
      acr.copy(up).cross(t).normalize();
      for (let j = 0; j < M; j++) {
        const v = j === 0 ? -1 : 1;
        verts.push(p.x + acr.x * v * 1.7, p.y + 0.24, p.z + acr.z * v * 1.7);
        uvs.push(u, j);
      }
    }
    for (let i = 0; i < N - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    this.guideUni = { uHead: { value: 0 }, uTime: { value: 0 }, uOpacity: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.guideUni,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
      fragmentShader: /* glsl */ `
        uniform float uHead, uTime, uOpacity;
        varying vec2 vUv;
        void main(){
          float ahead = smoothstep(-0.004, 0.02, vUv.x - uHead);
          float near  = 1.0 - smoothstep(0.06, 0.30, vUv.x - uHead);
          // chevrons flowing forwards, telling the finger where to go
          float f = fract(vUv.x * 46.0 - uTime * 0.65);
          float chev = smoothstep(0.55, 0.9, f) * (1.0 - smoothstep(0.9, 1.0, f));
          float edge = 1.0 - smoothstep(0.55, 1.0, abs(vUv.y - 0.5) * 2.0);
          float a = ahead * near * uOpacity * (0.30 + chev * 0.85) * edge;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vec3(0.55, 1.0, 0.85), a);
          #include <colorspace_fragment>
        }`,
    });
    this.guidePath = new THREE.Mesh(g, mat);
    this.guidePath.frustumCulled = false;
    this.guidePath.renderOrder = 2;
    this.scene.add(this.guidePath);
  }

  reset() {
    this.phase = 'prep';
    this.prepState = 'idle';
    this.paid = 0;
    this.payRate = 0;
    this.shipDist = 0;
    this.layS = 0;
    this.buryS = 0.012;
    this.threadT = 0;
    this.lightsOn = 0;
    this.lightsRequested = false;
    this.lightsTimer = 0;
    this.descentT = 0;
    this.descentIdx = RINGS - RIG_RINGS;
    this.idleTimer = 0;
    this.enteredWater = false;
    this.doneT = 0;
    this.buryVel = 0;
    this.time = 0;
    this.clunkStations = [
      { idx: this.ship.rig.idxGuide, done: false },
      { idx: this.ship.rig.idxDrum, done: false },
      { idx: this.ship.rig.idxTensioner, done: false },
      { idx: 2, done: false },
    ];
    this.trench.set(0, 0, 0);
    this.ship.coils.uniforms.uConsumed.value = 0;
    this.strand.uniforms.uPulse.value = 0;
    this.life.setVisible(false);
    this.rov.setLights(0, 0);

    this.updateShipTransform(0);
    // park the cable head on the working deck, outboard of the tank coaming
    this.tipFree.set(4.5, 4.7, 5.4).applyMatrix4(this.shipFrame);
    this.tipTarget.copy(this.tipFree);

    this.buildSpine();
    this.strand.update(this.spine);

    // start the camera already framed so the first frame is not a fly-in
    this.frameShot(true, 1);
    this.snapCamera();
  }

  // -------------------------------------------------------------------------
  // ship placement
  // -------------------------------------------------------------------------
  private updateShipTransform(dt: number) {
    const s = clamp01(this.shipDist / ROUTE_LENGTH);
    this.curve.getPointAt(s, this.shipPos);
    this.curve.getTangentAt(s, this.shipTan).normalize();
    const wy = this.ocean.heightAt(this.shipPos.x, this.shipPos.z, this.time);
    this.shipPos.y = wy * 0.55;
    const yaw = Math.atan2(-this.shipTan.z, this.shipTan.x);
    const roll = Math.sin(this.time * 0.62) * 0.026 + Math.sin(this.time * 1.31) * 0.012;
    const pitch = Math.sin(this.time * 0.83 + 1.1) * 0.018;
    this.eA.set(pitch, yaw, roll, 'YXZ');
    this.qA.setFromEuler(this.eA);
    this.ship.group.position.copy(this.shipPos);
    this.ship.group.quaternion.copy(this.qA);
    this.ship.group.updateMatrixWorld(true);
    // a heading-only frame (no roll/pitch) for stable camera anchoring
    this.eA.set(0, yaw, 0, 'YXZ');
    this.qB.setFromEuler(this.eA);
    this.shipFrame.compose(this.shipPos, this.qB, this.ONE);
    void dt;
  }

  // -------------------------------------------------------------------------
  // the cable spine - the heart of the whole thing
  // -------------------------------------------------------------------------
  private rigWorld(i: number, out: THREE.Vector3) {
    return out.copy(this.ship.rig.path[i]).applyMatrix4(this.ship.group.matrixWorld);
  }

  private sheaveExit(out: THREE.Vector3) {
    return this.rigWorld(0, out);
  }

  private seabedPointAt(s: number, out: THREE.Vector3) {
    this.curve.getPointAt(clamp01(s), out);
    out.y = this.field.corridorHeight(out.x, out.z) + CABLE_RADIUS * 1.35;
    return out;
  }

  private buildSpine() {
    const rig = this.ship.rig;
    const n = rig.path.length;

    while (this.rigBuf.length < n) this.rigBuf.push(new THREE.Vector3());

    if (this.phase === 'prep') {
      this.raw.length = 0;
      if (this.prepState === 'thread' || this.prepState === 'ready') {
        const tipIdx = Math.round(lerp(rig.idxGuide, 0, easeInOutCubic(this.threadT)));
        for (let i = tipIdx; i < n; i++) this.raw.push(this.rigWorld(i, this.rigBuf[i]));
      } else {
        // free end: a relaxed curve from the finger back to the bellmouth
        const pts = this.prepCurve.points;
        pts[0].copy(this.tipFree);
        this.rigWorld(n - 4, pts[2]);
        this.rigWorld(n - 2, pts[3]);
        this.rigWorld(n - 1, pts[4]);
        pts[1].copy(this.tipFree).lerp(pts[2], 0.5);
        pts[1].y -= 1.4;
        this.prepCurve.updateArcLengths();
        while (this.rigBuf.length < 49) this.rigBuf.push(new THREE.Vector3());
        for (let i = 0; i <= 48; i++) this.raw.push(this.prepCurve.getPoint(i / 48, this.rigBuf[i]));
      }
      resamplePolyline(this.raw, RINGS, this.spine);
      return;
    }

    // --- laid section ------------------------------------------------------
    const anchored = this.shipDist > LAYBACK * 0.999;
    const laidCount = anchored ? RINGS - RIG_RINGS - OVER_RINGS : 0;
    const overCount = RINGS - RIG_RINGS - laidCount;

    let k = 0;
    if (laidCount > 0) {
      const sinkFront = this.buryS - 0.02;
      for (let i = 0; i < laidCount; i++) {
        const t = laidCount === 1 ? 0 : i / (laidCount - 1);
        const s = t * this.layS;
        const p = this.spine[k++];
        this.seabedPointAt(s, p);
        if (this.phase === 'rov' || this.phase === 'done') {
          const sink = smoothstep(0.0, 0.02, sinkFront - s);
          p.y -= sink * TRENCH_SINK;
        }
      }
    }

    // --- overboard catenary --------------------------------------------------
    const exit = this.sheaveExit(this.tmpA);
    const exitDir = this.tmpB.copy(exit).sub(this.rigWorld(1, this.tmpC)).normalize();
    const end = this.vA;
    if (anchored) {
      this.seabedPointAt(this.layS, end);
    } else {
      // free end still on its way down
      const frac = clamp01(this.shipDist / LAYBACK);
      this.seabedPointAt(0, this.tmpC);
      end.copy(exit).lerp(this.tmpC, easeInOutCubic(frac));
      end.y = lerp(exit.y, this.tmpC.y, Math.pow(frac, 0.72));
    }
    {
      const d = exit.distanceTo(end);
      const p1 = this.vB.copy(exit).addScaledVector(exitDir, d * 0.28);
      const p2 = this.vC.copy(end);
      if (anchored) {
        this.curve.getTangentAt(clamp01(this.layS), this.vD).normalize();
        p2.addScaledVector(this.vD, -d * 0.36);
        p2.y += d * 0.06;
      } else {
        p2.y += d * 0.3;
      }
      this.bez.v0.copy(end);
      this.bez.v1.copy(p2);
      this.bez.v2.copy(p1);
      this.bez.v3.copy(exit);
      // A cubic's parameter is not its arc length: sampled directly, most of
      // the points bunch near the sheave and the dive crawls at the top then
      // teleports to the seabed. Sample dense, then resample evenly.
      const dense = overCount * 2;
      this.overRaw.length = 0;
      while (this.overBuf.length < dense) this.overBuf.push(new THREE.Vector3());
      for (let i = 0; i < dense; i++) {
        this.bez.getPoint(i / (dense - 1), this.overBuf[i]);
        this.overRaw.push(this.overBuf[i]);
      }
      resamplePolyline(this.overRaw, overCount, this.overOut);
      for (let i = 0; i < overCount; i++) this.spine[k++].copy(this.overOut[i]);
    }

    // --- ship-board run ------------------------------------------------------
    this.raw.length = 0;
    for (let i = 0; i < n; i++) this.raw.push(this.rigWorld(i, this.rigBuf[i]));
    resamplePolyline(this.raw, RIG_RINGS, this.rigOut);
    for (let i = 0; i < RIG_RINGS; i++) this.spine[k++].copy(this.rigOut[i]);
  }

  // -------------------------------------------------------------------------
  // camera shots
  // -------------------------------------------------------------------------
  private localShot(local: THREE.Vector3, out: THREE.Vector3) {
    return out.copy(local).applyMatrix4(this.shipFrame);
  }

  private frameShot(portrait: boolean, dt: number) {
    const P = portrait;
    switch (this.phase) {
      case 'prep': {
        const focus = this.prepState === 'idle' || this.prepState === 'drag' ? this.tipFree : null;
        // wide enough to hold the tank, the loose cable head and the guide
        // roller at once, so the drag target and its destination are both on
        // screen from the first frame
        // Portrait looks forward along the deck from astern, so the ship's
        // length runs up the tall screen; landscape stands abeam. Both hold the
        // tank, the loose cable head and the guide roller in one frame.
        this.localShot(P ? this.shotA.set(-31, 22, 8) : this.shotA.set(-3, 22, 25), this.targetPos);
        this.localShot(P ? this.shotA.set(-1, 5.0, 0) : this.shotA.set(-2, 4.5, 1.5), this.targetLook);
        if (focus && this.prepState === 'drag') this.targetLook.lerp(focus, 0.35);
        if (this.prepState === 'thread' || this.prepState === 'ready') {
          // track the tip aft as it threads the machinery
          const rig = this.ship.rig;
          const tipIdx = Math.round(lerp(rig.idxGuide, 0, easeInOutCubic(this.threadT)));
          const tp = this.rigWorld(tipIdx, this.tmpA);
          this.targetLook.lerp(tp, 0.72);
          this.localShot(P ? this.shotA.set(-30, 18, 13) : this.shotA.set(-14, 19, 29), this.targetPos);
          this.targetPos.x = lerp(this.targetPos.x, tp.x, 0.3);
          this.targetPos.z = lerp(this.targetPos.z, tp.z + (P ? 16 : 21), 0.25);
        }
        this.targetFov = P ? 58 : 50;
        break;
      }
      case 'payout': {
        // abeam the stern gear: sheave at the top, cable running into the sea
        // below it. Portrait sits lower and looks further down so the drop
        // reads as depth; landscape backs off to show the working deck too.
        // Portrait sits astern on the quarter and looks forward at the stern
        // gear, so the ship's fore-and-aft axis maps to the tall screen axis:
        // sheave at the top, the free span of cable running down the frame,
        // the sea taking the bottom. Landscape can afford to stand abeam.
        this.localShot(P ? this.shotA.set(-50, 8.5, 7) : this.shotA.set(-62, 13, 26), this.targetPos);
        this.localShot(P ? this.shotA.set(-39, 3.5, 0) : this.shotA.set(-36, 1.5, 0), this.targetLook);
        this.targetFov = P ? 58 : 52;
        break;
      }
      case 'descent': {
        const i = clamp(Math.round(this.descentIdx), 1, RINGS - 2);
        const p = this.spine[i];
        const ahead = this.spine[Math.max(0, i - 10)];
        const dir = this.tmpA.subVectors(ahead, p);
        if (dir.lengthSq() < 1e-6) dir.set(0, -1, 0);
        dir.normalize();
        // Standoff uses the ship's heading, not the cable tangent: where the
        // cable hangs vertically the tangent is parallel to up and any frame
        // built from it collapses (which used to park the camera inside the
        // stern gantry).
        const side = this.tmpB.crossVectors(this.shipTan, this.UP).normalize();
        const t = clamp01(this.descentT / 17.5);
        const close = smoothstep(0.03, 0.34, t);
        // The cable is only ~26 cm across: from 30 m away it is a hairline and
        // the shot says nothing. Ride it close instead.
        const dist = lerp(19, P ? 6.5 : 8.2, close);
        this.targetPos
          .copy(p)
          .addScaledVector(side, dist * 0.82)
          .addScaledVector(this.shipTan, -dist * 0.5);
        this.targetPos.y = p.y + lerp(8, P ? 1.6 : 2.0, close);
        // never let the shot sink into the seabed on the run-in to the plough
        this.targetPos.y = Math.max(
          this.targetPos.y,
          this.field.heightAt(this.targetPos.x, this.targetPos.z) + 3.4,
        );
        this.targetLook.copy(p).addScaledVector(dir, lerp(3, 6, close));
        this.targetFov = P ? 66 : 58;
        break;
      }
      case 'rov':
      case 'done': {
        // Three-quarter view from astern and outboard. Looking straight down
        // the trench hides its cross-section; from the quarter you can read
        // the open groove, the cable dropping into it and the spoil closing
        // back over, all in one frame.
        const pp = this.plough.group.position;
        const t = this.tmpA.copy(this.ploughTangent).normalize();
        const back = P ? 11.5 : 14.0;
        const up = P ? 9.0 : 9.0;
        const side = this.tmpB.crossVectors(t, this.UP).normalize();
        this.targetPos.copy(pp).addScaledVector(t, -back).addScaledVector(side, P ? 6.0 : 8.5);
        this.targetPos.y = Math.max(
          pp.y + up,
          this.field.heightAt(this.targetPos.x, this.targetPos.z) + 4.5,
        );
        this.targetLook.copy(pp).addScaledVector(t, P ? 4.0 : 5.5).addScaledVector(side, P ? 0.8 : 1.2);
        this.targetLook.y = pp.y + (P ? 1.2 : 0.9);
        this.targetFov = P ? 66 : 57;
        break;
      }
    }
    void dt;
  }

  private ploughTangent = new THREE.Vector3(1, 0, 0);

  // -------------------------------------------------------------------------
  // input handling
  // -------------------------------------------------------------------------
  private projectToScreen(w: THREE.Vector3, out: { x: number; y: number }) {
    this.tmpC.copy(w).project(this.camera);
    out.x = this.tmpC.x;
    out.y = -this.tmpC.y;
  }

  /** Screen direction the cable is currently running (used to match swipes). */
  private updatePayDir() {
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 0 };
    this.projectToScreen(this.spine[RINGS - RIG_RINGS], a); // sheave exit
    this.projectToScreen(this.spine[Math.max(0, RINGS - RIG_RINGS - 26)], b); // down the catenary
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    this.payDir.x = dx / l;
    this.payDir.y = dy / l;
  }

  private updateTraceDir() {
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 0 };
    this.seabedPointAt(this.buryS, this.tmpA);
    this.seabedPointAt(clamp01(this.buryS + 0.05), this.tmpB);
    this.projectToScreen(this.tmpA, a);
    this.projectToScreen(this.tmpB, b);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    this.traceDir.x = dx / l;
    this.traceDir.y = dy / l;
  }

  /** Drag the cable head around the deck; snaps when it nears the guide roller. */
  private lastDt = 1 / 60;

  private handlePrepDrag(input: Input) {
    const rig = this.ship.rig;
    const guideWorld = this.tmpA.copy(rig.guide).applyMatrix4(this.ship.group.matrixWorld);
    if (input.active) {
      // plane through the guide, facing the camera, so dragging always tracks
      const n = this.camera.getWorldDirection(this.tmpB).negate();
      this.dragPlane.setFromNormalAndCoplanarPoint(n, this.tipFree);
      this.ray.setFromCamera(input.ndc as THREE.Vector2, this.camera);
      const hit = this.vA;
      if (this.ray.ray.intersectPlane(this.dragPlane, hit)) {
        if (this.prepState === 'idle') {
          // only grab if the touch started near the head (or anywhere after a while)
          const s = { x: 0, y: 0 };
          this.projectToScreen(this.tipFree, s);
          const d = Math.hypot(input.ndc.x - s.x, -input.ndc.y - s.y);
          if (d < 0.55 || this.idleTimer > 5) {
            this.prepState = 'drag';
            sound.blip(520, 0.12, 'sine', 0.1);
          }
        }
        if (this.prepState === 'drag') this.tipTarget.copy(hit);
      }
    } else if (this.prepState === 'drag') {
      this.prepState = 'idle';
    }
    dampVec(this.tipFree, this.tipTarget, 14, this.lastDt);
    // magnetic snap
    if (this.prepState === 'drag' && this.tipFree.distanceTo(guideWorld) < 7.0) {
      this.prepState = 'thread';
      this.threadT = 0;
      sound.clunk();
    }
  }

  // -------------------------------------------------------------------------
  // main update
  // -------------------------------------------------------------------------
  update(dt: number, input: Input, portrait: boolean, leverHeld: boolean) {
    this.time += dt;
    this.lastDt = dt;
    this.hintActive = false;
    this.updateShipTransform(dt);

    switch (this.phase) {
      case 'prep':
        this.updatePrep(dt, input);
        break;
      case 'payout':
        this.updatePayout(dt, input, leverHeld);
        break;
      case 'descent':
        this.updateDescent(dt, input);
        break;
      case 'rov':
        this.updateRov(dt, input);
        break;
      case 'done':
        this.doneT += dt;
        // run the dig/bury fronts off the end so the last metres close up too
        this.buryS = Math.min(1.14, this.buryS + dt * 0.05);
        this.layS = 1;
        this.updateRovVisuals(dt);
        break;
    }

    this.buildSpine();
    this.strand.update(this.spine);
    this.updateTip();
    this.updateMachinery(dt);
    this.updateEnvironment(dt, portrait);
    this.frameShot(portrait, dt);
    if (this.snapNext) {
      this.snapNext = false;
      this.snapCamera();
    }

    dampVec(this.camPos, this.targetPos, this.phase === 'descent' ? 4.5 : 2.6, dt);
    dampVec(this.camLook, this.targetLook, this.phase === 'descent' ? 5.5 : 3.2, dt);
    this.camFov = damp(this.camFov, this.targetFov, 3.4, dt);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.camera.fov = this.camFov;
    this.camera.updateProjectionMatrix();

    this.updatePayDir();
    if (this.phase === 'rov') this.updateTraceDir();
  }

  /** Drop the camera straight onto its target shot, skipping the glide. */
  snapCamera() {
    this.camPos.copy(this.targetPos);
    this.camLook.copy(this.targetLook);
    this.camFov = this.targetFov;
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.camera.fov = this.camFov;
    this.camera.updateProjectionMatrix();
  }

  private snapNext = false;

  private setPhase(p: SeaPhase) {
    if (this.phase === p) return;
    // Prep looks forward along the deck; payout looks at the stern from
    // astern. Gliding between them flies the lens straight through the
    // A-frame, so this one is a cut. Every other transition is continuous and
    // stays a glide.
    if (p === 'payout') this.snapNext = true;
    this.phase = p;
    this.idleTimer = 0;
    this.events.onPhase(p);
  }

  // ---- prep ---------------------------------------------------------------
  private updatePrep(dt: number, input: Input) {
    this.idleTimer += dt;

    if (this.prepState === 'idle' || this.prepState === 'drag') {
      this.handlePrepDrag(input);
      this.hintPoint.copy(this.tipFree);
      this.hintActive = true;
      // a stuck player is never stuck for long
      if (this.idleTimer > 11) {
        this.prepState = 'thread';
        this.threadT = 0;
        sound.clunk();
      }
    } else if (this.prepState === 'thread') {
      this.hintActive = false;
      this.threadT = Math.min(1, this.threadT + dt / 4.2);
      const rig = this.ship.rig;
      const tipIdx = lerp(rig.idxGuide, 0, easeInOutCubic(this.threadT));
      for (const st of this.clunkStations) {
        if (!st.done && tipIdx <= st.idx) {
          st.done = true;
          sound.clunk();
        }
      }
      sound.setMachinery(0.5);
      if (this.threadT >= 1) {
        this.prepState = 'ready';
        this.idleTimer = 0;
        sound.blip(880, 0.35, 'triangle', 0.16);
        this.setPhase('payout');
      }
    }
  }

  // ---- payout -------------------------------------------------------------
  private updatePayout(dt: number, input: Input, leverHeld: boolean) {
    this.idleTimer += dt;
    let delta = 0;
    if (leverHeld) {
      delta += LEVER_RATE * dt;
      this.idleTimer = 0;
    }
    if (input.active || input.moved) {
      // the finger drags the cable: displacement in, displacement out
      const forward = Math.max(0, input.along(this.payDir.x, this.payDir.y));
      const any = input.frameTravel();
      delta += forward * PAY_PER_SCREEN + any * PAY_PER_SCREEN * 0.3;
      this.idleTimer = 0;
    }
    // after a long pause the ship keeps working on its own - never a dead end
    if (this.idleTimer > 8) delta += 8 * dt;

    delta = clamp(delta, 0, 3.2); // one frame can never yank a huge bight out
    this.paid += delta;
    this.payRate = damp(this.payRate, delta / Math.max(dt, 1e-3), 9, dt);
    if (this.payRate < 0.02) this.payRate = 0;
    this.shipDist = this.paid * SHIP_PER_PAID;
    this.layS = clamp01((this.shipDist - LAYBACK) / ROUTE_LENGTH);
    this.ship.coils.uniforms.uConsumed.value = (this.paid / 500) * this.ship.coils.count * 0.92;

    sound.setPayout(clamp01(this.payRate / 20));

    if (!this.enteredWater && this.paid > 1.5) {
      this.enteredWater = true;
      sound.splash();
      this.events.onFirstWater();
    }
    // bubbles + foam where the cable pierces the surface
    const entry = this.waterEntryPoint(this.tmpA);
    if (entry) {
      this.entryFoam.position.copy(entry).setY(entry.y + 0.15);
      const fm = this.entryFoam.material as THREE.SpriteMaterial;
      fm.opacity = damp(fm.opacity, 0.30 + clamp01(this.payRate / 18) * 0.4, 3, dt);
      this.entryFoam.scale.setScalar(4.2 + Math.sin(this.time * 5) * 0.5 + clamp01(this.payRate / 18) * 2.2);
      if (this.payRate > 0.5) {
        for (let i = 0; i < 2; i++)
          this.bubbles.emit(
            entry.x + (Math.random() - 0.5) * 1.2,
            entry.y - 0.3 - Math.random(),
            entry.z + (Math.random() - 0.5) * 1.2,
            2 + Math.random() * 3,
            1.4,
            0.5,
            2.2,
          );
      }
    }

    if (this.layS >= PAYOUT_TARGET_S) {
      this.setPhase('descent');
      this.descentIdx = RINGS - RIG_RINGS - 8;
      this.descentT = 0;
      sound.setPayout(0);
      sound.ping();
    }
  }

  private waterEntryPoint(out: THREE.Vector3): THREE.Vector3 | null {
    for (let i = RINGS - RIG_RINGS - 1; i > 1; i--) {
      const a = this.spine[i];
      const b = this.spine[i - 1];
      if ((a.y >= 0 && b.y <= 0) || (a.y <= 0 && b.y >= 0)) {
        const t = Math.abs(a.y) / (Math.abs(a.y) + Math.abs(b.y) || 1);
        return out.lerpVectors(a, b, t);
      }
    }
    return null;
  }

  // ---- descent ------------------------------------------------------------
  private updateDescent(dt: number, input: Input) {
    this.descentT += dt;
    // keep laying while we swim down, so the picture stays alive
    this.paid += 6.5 * dt;
    this.shipDist = this.paid * SHIP_PER_PAID;
    this.layS = clamp01((this.shipDist - LAYBACK) / ROUTE_LENGTH);
    sound.setPayout(0.25);

    const boost = input.active ? 1 + clamp(input.speedNorm() * 0.5, 0, 1.1) : 1;
    const total = 17.5;
    const t = clamp01(this.descentT / total);
    // Two legs, so the water column gets most of the time: first ride the
    // cable down through the blue to where it touches the bottom, then run
    // along it to where the plough is waiting.
    const SPLIT = 0.66;
    const touchdown = RINGS - RIG_RINGS - OVER_RINGS;
    // Mostly linear, lightly eased at each end. A full ease-in-out sprints
    // through the middle of the water column, which is the part worth seeing.
    const soft = (u: number) => u + (easeInOutCubic(u) - u) * 0.35;
    const target =
      t < SPLIT
        ? lerp(RINGS - RIG_RINGS - 8, touchdown, soft(t / SPLIT))
        : lerp(touchdown, 4, soft((t - SPLIT) / (1 - SPLIT)));
    this.descentIdx = damp(this.descentIdx, target, 4 * boost, dt);

    if (this.descentT > 3 && this.descentT < 3 + dt) sound.whale();
    if (this.descentT > 9 && this.descentT < 9 + dt) sound.ping();

    if (t >= 1) {
      this.setPhase('rov');
      this.buryS = 0.012;
      // place the ROV and plough on the seabed ready to work
      this.seabedPointAt(this.buryS, this.tmpA);
      this.plough.group.position.copy(this.tmpA);
      this.rov.group.position.copy(this.tmpA).add(this.vA.set(4, 5, 0));
    }
  }

  // ---- rov + plough --------------------------------------------------------
  private updateRov(dt: number, input: Input) {
    this.idleTimer += dt;

    // ship keeps laying ahead of us
    const wantLay = Math.min(1, this.buryS + 0.2);
    if (this.layS < wantLay) {
      this.layS = wantLay;
      this.shipDist = this.layS * ROUTE_LENGTH + LAYBACK;
      this.paid = this.shipDist / SHIP_PER_PAID;
    }

    this.lightsTimer += dt;
    if (!this.lightsRequested) {
      // Step one: switch the ROV's lamps on. The hint points at the ROV, but
      // ANY touch counts - a four-year-old who swipes instead of tapping, or
      // taps a little wide, must not be left in the dark. The safety timer
      // runs on its own clock too: tracing attempts reset the idle timer, so
      // hanging the fallback off that would leave the lights off forever.
      this.hintPoint.copy(this.rov.group.position);
      this.hintActive = true;
      if (input.active || input.consumeTap() || input.moved || this.lightsTimer > 6) {
        this.lightsRequested = true;
        sound.lightsOn();
        this.events.onLightsOn();
        this.idleTimer = 0;
      }
    } else {
      this.hintPoint.copy(this.plough.group.position);
      this.hintActive = this.lightsOn > 0.6;
      // step two: trace the path
      let advance = 0;
      // gated on the request, not the lamp ramp - the first stroke has to work
      if ((input.active || input.moved) && this.lightsRequested) {
        const forward = input.along(this.traceDir.x, this.traceDir.y);
        const any = input.frameTravel();
        advance = Math.max(forward, 0) * TRACE_PER_SCREEN + any * TRACE_PER_SCREEN * 0.22;
        if (input.holdTime > 0.8 && any < 0.002) advance = Math.max(advance, dt * 0.018);
        this.idleTimer = 0;
      }
      if (this.idleTimer > 9) advance = Math.max(advance, dt * 0.012);
      this.buryVel = damp(this.buryVel, advance / Math.max(dt, 1e-3), 7, dt);
      this.buryS = clamp01(this.buryS + this.buryVel * dt);
      sound.setDigging(clamp01(this.buryVel * 26));
      if (this.buryS >= 0.999) {
        this.setPhase('done');
        sound.setDigging(0);
        sound.setPayout(0);
      }
    }
    this.updateRovVisuals(dt);
  }

  private updateRovVisuals(dt: number) {
    this.lightsOn = damp(this.lightsOn, this.lightsRequested ? 1 : 0, 1.6, dt);
    this.rov.setLights(this.lightsOn, this.time);

    // plough follows the route, gently damped - never twitchy
    this.seabedPointAt(this.buryS, this.tmpA);
    this.curve.getTangentAt(clamp01(this.buryS), this.ploughTangent).normalize();
    const target = this.vA.copy(this.tmpA);
    target.y = this.field.corridorHeight(target.x, target.z) + 0.18;
    dampVec(this.plough.group.position, target, 6, dt);
    const yaw = Math.atan2(-this.ploughTangent.z, this.ploughTangent.x);
    // plough forward is -Z, so line it up with the route tangent
    this.eA.set(0, yaw + Math.PI / 2, 0, 'YXZ');
    this.qA.setFromEuler(this.eA);
    this.plough.group.quaternion.slerp(this.qA, 1 - Math.exp(-5 * dt));

    // ROV flies alongside, a little above and outboard
    const side = this.tmpB.crossVectors(this.ploughTangent, this.UP).normalize();
    // Station-keeping astern and above the plough, lamps pointed forward over
    // the share: this is both what a real inspection ROV does and the only
    // arrangement where its lights show the child the digging.
    // Between the camera and the plough, high enough to stay clear of it: the
    // child has to be able to see the ROV in order to tap its lights on, and
    // from here the lamps rake forward across the trench.
    const rovTarget = this.tmpC
      .copy(this.plough.group.position)
      .addScaledVector(this.ploughTangent, -3.0)
      .addScaledVector(side, 2.6);
    rovTarget.y = this.plough.group.position.y + 6.0 + Math.sin(this.time * 0.8) * 0.3;
    dampVec(this.rov.group.position, rovTarget, 2.4, dt);
    const look = this.vB.copy(this.plough.group.position).addScaledVector(this.ploughTangent, 1.5);
    this.mA.lookAt(this.rov.group.position, look, this.UP);
    this.qB.setFromRotationMatrix(this.mA);
    this.rov.group.quaternion.slerp(this.qB, 1 - Math.exp(-3 * dt));
    for (const t of this.rov.thrusters) t.rotation.z += dt * (3 + this.buryVel * 90);

    // trench states: dig at the share, cable in just behind, sand back over
    // the three states, all on screen at once behind the plough:
    //   at the share      -> the groove is open
    //   ~8 m behind       -> the cable is down in it
    //   ~32 m behind      -> the spoil has fallen back over the top
    this.trench.set(this.buryS, this.buryS - 0.02, this.buryS - 0.11);
    this.guideUni.uHead.value = this.buryS;
    this.guideUni.uTime.value = this.time;
    this.guideUni.uOpacity.value = damp(
      this.guideUni.uOpacity.value as number,
      this.phase === 'rov' && this.lightsOn > 0.5 && this.buryS < 0.995 ? 1 : 0,
      2.5,
      dt,
    );

    // spoil thrown by the share + sand falling back in over the cable
    const rate = clamp01(this.buryVel * 30);
    if (rate > 0.02) {
      const tip = this.plough.group.localToWorld(this.plough.shareTip.clone());
      const n = Math.random() < rate * 1.6 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const sgn = Math.random() > 0.5 ? 1 : -1;
        this.sand.emit(
          tip.x + side.x * sgn * 1.4,
          tip.y + 0.5,
          tip.z + side.z * sgn * 1.4,
          side.x * sgn * 1.1,
          side.z * sgn * 1.1,
          0.65 + rate * 0.6,
        );
      }
      const back = clamp01(this.buryS - 0.11);
      this.seabedPointAt(back, this.tmpA);
      if (Math.random() < rate * 0.55) {
        const sgn = Math.random() > 0.5 ? 1 : -1;
        this.sand.emit(
          this.tmpA.x + side.x * sgn * 1.5,
          this.tmpA.y + 0.3,
          this.tmpA.z + side.z * sgn * 1.5,
          -side.x * sgn * 0.8,
          -side.z * sgn * 0.8,
          0.34,
        );
      }
      if (Math.random() < rate * 0.25) sound.puff(0.06 + rate * 0.06);
    }
    // thruster wash
    if (this.lightsOn > 0.4 && Math.random() < 0.25) {
      const p = this.rov.group.localToWorld(
        this.rov.thrusterPorts[Math.floor(Math.random() * this.rov.thrusterPorts.length)].clone(),
      );
      this.bubbles.emit(p.x, p.y, p.z, 1.1 + Math.random(), 0.5, 0.5, 1.6);
    }

    // contact shadows keep both vehicles planted
    const pgp = this.plough.group.position;
    this.ploughShadow.position.set(pgp.x, this.field.corridorHeight(pgp.x, pgp.z) + 0.1, pgp.z);
    (this.ploughShadow.material as THREE.ShaderMaterial).uniforms.uOpacity.value = 0.42 * this.lightsOn;
    const rgp = this.rov.group.position;
    const rh = this.field.corridorHeight(rgp.x, rgp.z);
    this.rovShadow.position.set(rgp.x, rh + 0.1, rgp.z);
    const alt = clamp01(1 - (rgp.y - rh) / 12);
    (this.rovShadow.material as THREE.ShaderMaterial).uniforms.uOpacity.value = 0.4 * alt * this.lightsOn;
  }

  // ---- shared visuals -----------------------------------------------------
  private updateTip() {
    const visible = this.phase === 'prep';
    this.tip.group.visible = visible;
    if (!visible) return;
    const head = this.spine[0];
    const next = this.spine[3];
    this.tip.group.position.copy(head);
    const d = this.tmpA.subVectors(head, next);
    if (d.lengthSq() > 1e-6) {
      this.vB.set(0, 0, 0);
      this.mA.lookAt(this.vB, d.normalize(), this.UP);
      this.qA.setFromRotationMatrix(this.mA);
      // model points along +X, lookAt gives -Z, so add a quarter turn
      this.eA.set(0, -Math.PI / 2, 0, 'YXZ');
      this.qA.multiply(this.qB.setFromEuler(this.eA));
      this.tip.group.quaternion.copy(this.qA);
    }
    const s = 1 + Math.sin(this.time * 4) * 0.06;
    this.tip.nose.scale.setScalar(s);
    const grab = this.prepState === 'drag' ? 1 : 0;
    this.tip.halo.scale.setScalar(3.2 + Math.sin(this.time * 3) * 0.5 + grab * 1.0);
    (this.tip.halo.material as THREE.SpriteMaterial).opacity = 0.32 + Math.sin(this.time * 3) * 0.14;
  }

  private updateMachinery(dt: number) {
    // linear speed of the cable through the rig, in m/s
    let v = 0;
    if (this.phase === 'payout') v = this.payRate;
    else if (this.phase === 'descent') v = 6.5;
    else if (this.phase === 'prep' && this.prepState === 'thread') v = 6;
    else if (this.phase === 'rov') v = this.buryVel * ROUTE_LENGTH;
    for (const s of this.ship.spinners) {
      if (s.radius <= 0) {
        s.mesh.rotation.y += dt * 0.9; // radar sweep
      } else {
        s.mesh.rotation[s.axis] += (v / s.radius) * dt;
      }
    }
    for (const b of this.ship.tensionerBelts) {
      for (const pad of b.children) {
        pad.position.x -= v * dt;
        if (pad.position.x < -3.0) pad.position.x += 6.0;
      }
    }
  }

  private updateEnvironment(dt: number, portrait: boolean) {
    void portrait;
    const camY = this.camera.position.y;
    const sub = smoothstep(0.8, -1.4, camY);
    const depth = Math.max(0, -camY);
    const water = waterColorAt(depth, this.tmpColor);
    this.fogColor.copy(this.airFog).lerp(water, sub);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(this.fogColor);
    fog.density = lerp(0.0018, fogDensityAt(depth), sub);
    this.ocean.update(this.time, this.camera, this.fogColor, fog.density);
    this.sky.update(this.time, this.camera);
    this.sky.mesh.visible = sub < 0.85;

    // light falls off with depth; the ROV takes over below
    const daylight = (1 - sub) + (1 - clamp01(depth / 46)) * sub * 0.55;
    this.sun.intensity = 2.5 * daylight;
    this.hemi.intensity = lerp(0.17, 1.35, daylight);
    this.ambient.intensity = lerp(0.13, 0.4, daylight);
    this.ambient.color.copy(water).lerp(this.ambientTint, 0.35);

    // One roaming utility lamp does two jobs that never overlap in time: it
    // lights the inside of the cable tank during prep, then rides with the
    // camera on the dive.
    let wantDive: number;
    if (this.phase === 'prep') {
      this.diveLight.position.copy(this.ship.rig.bellmouth).applyMatrix4(this.ship.group.matrixWorld);
      this.diveLight.position.y -= 3.5;
      wantDive = 200;
    } else {
      this.diveLight.position.copy(this.camera.position);
      this.diveLight.position.y += 2.0;
      wantDive = (this.phase === 'descent' ? 210 : this.phase === 'rov' || this.phase === 'done' ? 38 : 0) * sub;
    }
    this.diveLight.intensity = damp(this.diveLight.intensity, wantDive, 1.5, dt);

    this.snow.update(this.time, dt, this.camera, sub * 0.85);
    this.bubbles.update(this.time, dt);
    this.sand.update(this.time, dt);
    this.godRays.update(this.time, this.camera, sub * (1 - clamp01(depth / 42)) * 0.9);
    this.life.setVisible(sub > 0.4);
    this.life.update(this.time, this.camera.position);

    // wake follows the ship whenever it is making way
    const making = this.phase === 'payout' || this.phase === 'descent' || this.phase === 'rov';
    this.wake.position.copy(this.shipPos).setY(0.12);
    this.wake.rotation.y = Math.atan2(-this.shipTan.z, this.shipTan.x) - Math.PI / 2;
    const wm = this.wake.material as THREE.ShaderMaterial;
    wm.uniforms.uTime.value = this.time;
    wm.uniforms.uOpacity.value = damp(
      wm.uniforms.uOpacity.value as number,
      making && sub < 0.6 ? clamp01(this.payRate / 10 + 0.28) : 0,
      2,
      dt,
    );

    if (this.phase !== 'payout') {
      const fm = this.entryFoam.material as THREE.SpriteMaterial;
      fm.opacity = damp(fm.opacity, 0, 2.5, dt);
    }
    this.entryFoam.visible = (this.entryFoam.material as THREE.SpriteMaterial).opacity > 0.01;

    sound.setSubmersion(sub);
    this.strand.uniforms.uPulse.value = damp(
      this.strand.uniforms.uPulse.value,
      this.phase === 'done' ? 1 : 0,
      1.2,
      dt,
    );
    this.strand.uniforms.uPulseHead.value = (this.time * 0.12) % 1;
    this.strand.material.emissiveIntensity = this.strand.uniforms.uPulse.value * 0.9;
  }
  private tmpColor = new THREE.Color();
  private ambientTint = new THREE.Color(0x9fd0e8);

  // -------------------------------------------------------------------------
  // queries used by the HUD
  // -------------------------------------------------------------------------
  get progress() {
    switch (this.phase) {
      case 'prep':
        return 0;
      case 'payout':
        return (this.layS / PAYOUT_TARGET_S) * 0.42;
      case 'descent':
        return 0.42 + clamp01(this.descentT / 17.5) * 0.13;
      default:
        return 0.55 + this.buryS * 0.45;
    }
  }

  get payoutAmount() {
    return clamp01(this.payRate / 22);
  }

  hintScreenPoint(w: number, h: number): { x: number; y: number } | null {
    if (!this.hintActive) return null;
    const v = this.hintPoint.clone().project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
  }

  setPixelRatio(r: number) {
    this.snow.setPixelRatio(r);
    this.bubbles.setPixelRatio(r);
    this.sand.setPixelRatio(r);
  }

  /** Where the finished cable meets the seabed, for the outro shot. */
  get finished() {
    return this.phase === 'done';
  }
  get doneTime() {
    return this.doneT;
  }
}
