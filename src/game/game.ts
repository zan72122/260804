import {
  AdditiveBlending,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  Object3D,
  SpotLight,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { Stage } from '../core/stage';
import { Gestures, Stroke } from '../core/input';
import {
  clamp,
  clamp01,
  damp,
  easeInOutSine,
  easeOutCubic,
  lerp,
  makeRng,
  randRange,
} from '../core/util';
import { softDisc, shadowMaterial, Water } from '../world/water';
import { Sky } from '../world/sky';
import { Environment, softSpriteTexture } from '../world/environment';
import { Boat } from '../world/boat';
import { Fire } from '../world/fire';
import { Figure, makeNakanori, makeUsho } from '../world/usho';
import { Cormorant } from '../world/cormorant';
import { FISH_KINDS, FishShoal, makeFish } from '../world/fish';
import { Rope, RopeMesh } from '../sim/rope';
import { makeBubbles, makeSplash, makeSpray, ParticlePool } from '../fx/particles';
import { Hints } from '../ui/hints';

type Phase = 'depart' | 'kindle' | 'fishing' | 'finale' | 'done';

const BIRDS = 5;
const ROPE_POINTS = 22;
/** Dive stations: different sides, different distances, so the fan reads. */
/**
 * Where each bird works. They are fanned around the bow at different bearings
 * *and* different ranges, so the ropes leave the usho's fist as a spread of
 * lines across the frame rather than a bundle pointing one way.
 */
const STATIONS: [number, number][] = [
  [3.5, -2.0],
  [2.2, -4.7],
  [0.2, -6.6],
  [-2.0, -5.3],
  [-3.6, -3.0],
];
const FISH_FOR_FINALE = 8;
const FISH_AUTO_FINALE = 12;
const IDLE_HINT = 3.4;

interface FlyingFish {
  mesh: Object3D;
  from: Vector3;
  to: Vector3;
  t: number;
  dur: number;
}

/**
 * The whole evening: cast off at dusk, fan the kagaribi until the river lights
 * up, work the birds, then drift on down with the fire burning.
 *
 * There is no score, no clock and no way to lose. Every gesture is read
 * generously: what the finger *meant* matters, not where it landed.
 */
export class Game {
  private stage: Stage;
  private hints: Hints;
  private replayBtn: HTMLButtonElement;

  private water = new Water();
  private sky = new Sky();
  private env = new Environment();
  private boat = new Boat();
  private fire: Fire;
  private usho: Figure = makeUsho();
  private nakanori: Figure = makeNakanori();
  private shoal = new FishShoal();

  private birds: Cormorant[] = [];
  private ropes: Rope[] = [];
  private ropeMeshes: RopeMesh[] = [];
  private ropeAnchors: Vector3[] = [];
  /** One pale patch per bird, seen through the skin of the river. */
  private ghosts: Sprite[] = [];

  private splash: ParticlePool = makeSplash();
  private bubbles: ParticlePool = makeBubbles();
  private spray: ParticlePool = makeSpray();

  private fireSpot: SpotLight;
  private moonLight: DirectionalLight;
  private fill: DirectionalLight;
  private hemi: HemisphereLight;
  private boatShadow: Mesh;

  private phase: Phase = 'depart';
  private phaseT = 0;
  private t = 0;
  private night = 0;
  private flow = 0;
  private flowSpeed = 0.35;
  private idle = 0;
  private fishCount = 0;
  private flying: FlyingFish[] = [];
  private rng = makeRng(2468);

  private tmp = new Vector3();
  private tmpB = new Vector3();
  private tmpFire = new Vector3();
  private handWorld = new Vector3();
  private fireWorld = new Vector3();
  private screen = { x: 0, y: 0 };
  private contacts: Vector3[] = [];
  private shiverClock = 0;
  private wakeClock = 0;
  /** Tiny hand-held wobble on the big moments. Never enough to disorient. */
  private shake = 0;
  private shakeSeed = 0;
  private nudgeClock = 0;

  /** Which thing the current finger stroke grabbed. */
  private grab: { kind: 'fire' | 'bird' | 'rope' | 'river'; bird?: Cormorant } | null = null;
  private advanceAccum = 0;

  constructor(stage: Stage, hints: Hints, replayBtn: HTMLButtonElement) {
    this.stage = stage;
    this.hints = hints;
    this.replayBtn = replayBtn;

    const scene = stage.scene;
    const ghostTex = softSpriteTexture('rgba(210,232,255,0.95)', 'rgba(120,170,220,0)');
    this.fire = new Fire(this.boat.firePoleFoot);

    scene.add(this.sky.dome, this.sky.stars, this.sky.moon);
    scene.add(this.env.group);
    scene.add(this.water.mesh);
    scene.add(this.boat.group);
    scene.add(this.shoal.group);
    this.boat.group.add(this.fire.group);

    // Both crew face the bow (-Z), turned a few degrees so the fire catches a
    // cheek instead of only a back.
    this.usho.group.position.copy(this.boat.ushoAnchor);
    this.usho.group.rotation.y = 0.34;
    this.usho.group.scale.setScalar(1.08);
    this.boat.group.add(this.usho.group);

    // The nakanori works amidships, off to port so he frames the usho rather
    // than blocking him. The stern is behind the camera in both layouts.
    this.nakanori.group.position.set(-0.34, 0, -1.05);
    this.nakanori.group.rotation.y = -0.22;
    this.nakanori.group.scale.setScalar(0.94);
    this.boat.group.add(this.nakanori.group);

    // ---- lighting ---------------------------------------------------------
    this.hemi = new HemisphereLight(0x2c3c60, 0x03050a, 0.5);
    scene.add(this.hemi);

    this.moonLight = new DirectionalLight(0x93b0ff, 0.4);
    this.moonLight.position.set(-30, 34, -52);
    scene.add(this.moonLight);

    // A whisper of warm fill from the viewer's side. Physically it is the
    // firelight bouncing off the river; practically it is what stops the boat
    // and the crew from collapsing into flat black cut-outs.
    this.fill = new DirectionalLight(0xffb478, 0);
    this.fill.position.set(7, 4.5, 9);
    scene.add(this.fill);

    // One shadow-casting light, sitting in the fire, so every contact shadow
    // in the boat points away from the flame.
    this.fireSpot = new SpotLight(0xffa254, 0, 15, 1.02, 0.85, 1.5);
    this.fireSpot.castShadow = true;
    this.fireSpot.shadow.mapSize.set(1024, 1024);
    this.fireSpot.shadow.camera.near = 0.4;
    this.fireSpot.shadow.camera.far = 16;
    this.fireSpot.shadow.bias = -0.0022;
    this.fireSpot.shadow.normalBias = 0.02;
    scene.add(this.fireSpot);
    scene.add(this.fireSpot.target);

    // Soft dark under the hull so it sits *in* the water, not on it.
    this.boatShadow = new Mesh(softDisc(2.9, 34), shadowMaterial(0x01030a, 0.5));
    this.boatShadow.scale.set(0.62, 1, 1.55);
    this.boatShadow.position.y = 0.008;
    this.boatShadow.renderOrder = 9;
    scene.add(this.boatShadow);

    scene.add(this.splash.points, this.bubbles.points, this.spray.points);

    // ---- birds and their ropes -------------------------------------------
    const ropeGroup = new Group();
    scene.add(ropeGroup);
    for (let i = 0; i < BIRDS; i++) {
      const bird = new Cormorant(i);
      this.birds.push(bird);
      scene.add(bird.group);

      const rope = new Rope(ROPE_POINTS, 2.0, 0.8, 11.5);
      this.ropes.push(rope);
      const rm = new RopeMesh(ROPE_POINTS, 0.032, 6);
      rm.setTaper(0.034, 0.023);
      this.ropeMeshes.push(rm);
      ropeGroup.add(rm.mesh);
      this.ropeAnchors.push(new Vector3());

      // A diving cormorant has to stay *findable*. This is the pale smear of
      // trapped air and disturbed water that marks where it is working — drawn
      // over the surface, because a shape under near-opaque black water reads
      // as nothing at all.
      const ghost = new Sprite(
        new SpriteMaterial({
          map: ghostTex,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          blending: AdditiveBlending,
          color: new Color(0x74909f),
          opacity: 0,
          fog: false,
        }),
      );
      ghost.renderOrder = 8;
      ghost.scale.setScalar(1.1);
      this.ghosts.push(ghost);
      scene.add(ghost);
    }
    for (let i = 0; i < 6; i++) this.contacts.push(new Vector3());

    new Gestures(stage.renderer.domElement, {
      onDown: (x, y) => this.onDown(x, y),
      onChunk: (s) => this.onChunk(s),
      onTap: (x, y) => this.onTap(x, y),
      onUp: () => {
        this.grab = null;
        this.advanceAccum = 0;
      },
    });

    replayBtn.addEventListener('click', () => this.restart());
    this.layoutForOrientation();
  }

  // =========================================================================
  // input
  // =========================================================================

  private shortSide(): number {
    return Math.min(this.stage.width, this.stage.height);
  }

  /**
   * Screen distance to a world point, measured against the point *clamped into
   * the frame*. If a bird has drifted a little past the edge, a touch at the
   * edge should still reach it: the child is pointing at the right thing.
   */
  private screenDist(world: Vector3, x: number, y: number): number {
    if (!this.stage.project(world, this.screen)) return Infinity;
    const px = clamp(this.screen.x, 0, this.stage.width);
    const py = clamp(this.screen.y, 0, this.stage.height);
    return Math.hypot(px - x, py - y);
  }

  /** Distance from a screen point to the nearest part of a rope. */
  private ropeDist(rope: Rope, x: number, y: number): number {
    let best = Infinity;
    for (let i = 2; i < rope.n; i += 3) {
      const d = this.screenDist(rope.pts[i], x, y);
      if (d < best) best = d;
    }
    return best;
  }

  private onDown(x: number, y: number): void {
    this.idle = 0;
    const s = this.shortSide();
    this.grab = { kind: 'river' };

    if (this.phase === 'depart' || this.phase === 'finale' || this.phase === 'done') return;

    // 1. The fire wins if the finger is anywhere near it.
    this.boat.toWorld(this.tmp.copy(this.fire.group.position).add(this.fire.heart), this.fireWorld);
    if (this.phase === 'kindle' || !this.fire.lit) {
      if (this.screenDist(this.fireWorld, x, y) < s * 0.34) {
        this.grab = { kind: 'fire' };
        return;
      }
    } else if (this.screenDist(this.fireWorld, x, y) < s * 0.15) {
      this.grab = { kind: 'fire' };
      return;
    }

    if (!this.fire.lit) return;

    // 2. A perched bird under the finger means "send this one".
    let bestBird: Cormorant | null = null;
    let bestD = s * 0.17;
    for (const b of this.birds) {
      if (b.state !== 'perch') continue;
      const d = this.screenDist(b.pos, x, y);
      if (d < bestD) {
        bestD = d;
        bestBird = b;
      }
    }
    if (bestBird) {
      this.grab = { kind: 'bird', bird: bestBird };
      return;
    }

    // 3. Otherwise: the nearest working rope. Ropes with a bird that has
    //    already found something get a generous head start.
    let bestRope: Cormorant | null = null;
    let bestRD = s * 0.24;
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      if (b.state !== 'under' && b.state !== 'rising') continue;
      let d = this.ropeDist(this.ropes[i], x, y);
      if (b.waitingToHaul) d *= 0.55;
      if (d < bestRD) {
        bestRD = d;
        bestRope = b;
      }
    }
    if (bestRope) this.grab = { kind: 'rope', bird: bestRope };
  }

  private onTap(x: number, y: number): void {
    // Taps are never wrong — they just do a gentler version of the swipe.
    if (this.phase === 'done') return;
    if (!this.grab) this.onDown(x, y);
    const g = this.grab;
    if (!g) return;
    if (g.kind === 'fire') this.doFan(0.2);
    else if (g.kind === 'bird' && g.bird) this.doRelease(g.bird);
    else if (g.kind === 'rope' && g.bird) this.doHaul(g.bird, 0.14);
    else this.hintNudge();
    this.grab = null;
  }

  private onChunk(s: Stroke): void {
    this.idle = 0;
    if (this.phase === 'done') return;
    if (this.phase === 'depart') {
      // Impatient fingers just skip the sunset.
      this.phaseT = Math.max(this.phaseT, 5.6);
      return;
    }
    const g = this.grab;
    if (!g) return;
    const short = this.shortSide();

    switch (g.kind) {
      case 'fire':
        this.doFan(0.3 * clamp(s.len / (short * 0.1), 0.55, 1.6));
        break;
      case 'bird':
        if (g.bird) {
          this.doRelease(g.bird);
          this.grab = { kind: 'river' };
        }
        break;
      case 'rope':
        if (g.bird) this.doHaul(g.bird, 0.2 * clamp(s.len / (short * 0.09), 0.6, 1.5));
        break;
      case 'river': {
        // Downstream is up the screen: a long push sends the boat on.
        if (this.phase !== 'fishing') break;
        if (s.dy < -short * 0.02) {
          this.advanceAccum += -s.dy;
          if (this.advanceAccum > short * 0.16) {
            this.advanceAccum = 0;
            this.advance();
          }
        } else if (s.dy > short * 0.03) {
          // A downward flick out on open water still hauls whoever is waiting.
          const waiting = this.birds.find((b) => b.waitingToHaul);
          if (waiting) this.doHaul(waiting, 0.2);
        }
        break;
      }
    }
  }

  // =========================================================================
  // actions
  // =========================================================================

  private doFan(amount: number): void {
    this.fire.fan(amount);
    this.usho.pulseFan();
    this.spray.emit(this.fireWorld, 5, 0.7, 0.7, 1.6, 0.045, 0.7, 0.12);
    if (this.phase === 'kindle' && this.fire.lit) {
      // The moment the river lights up is the first thing worth coming back
      // for, so it gets a proper whump rather than a state change.
      this.phase = 'fishing';
      this.phaseT = 0;
      this.shake = 0.13;
      this.spray.emit(this.fireWorld, 40, 1.5, 0.9, 3.2, 0.05, 1.3, 0.18);
      for (let i = 0; i < 4; i++) {
        this.water.ripple(randRange(this.rng, -2, 2), randRange(this.rng, -6, -3), 0.4, 3.4);
      }
    }
  }

  private doRelease(bird: Cormorant): void {
    if (bird.state !== 'perch') return;
    const idx = bird.index;
    const [sx, sz] = STATIONS[idx % STATIONS.length];
    const jitter = randRange(this.rng, -0.45, 0.45);
    // Fanning wider on wide screens is good; fanning a bird off the edge is not.
    const x = clamp(sx * this.stage.spread, -4.3, 4.3) + jitter;
    this.tmp.set(x, 0, sz + jitter * 0.8);
    bird.launch(bird.pos, this.tmp);
    this.usho.lookAt(this.tmp.x);
  }

  private doHaul(bird: Cormorant, amount: number): void {
    if (bird.state !== 'under' && bird.state !== 'rising') return;
    // Nobody comes up empty-handed: if it hasn't found a fish yet, it just did.
    if (!bird.waitingToHaul) bird.hurryFind();
    bird.haul(amount);
    this.usho.pulseHaul();
    this.usho.lookAt(bird.pos.x);
    const rope = this.ropes[bird.index];
    rope.shiver(0.35);
    const n = rope.waterContacts(this.contacts);
    for (let i = 0; i < n; i++) {
      this.water.ripple(this.contacts[i].x, this.contacts[i].z, 0.3, 2.4);
      this.spray.emit(this.contacts[i], 2, 0.5, 0.8, 0.7, 0.03, 0.5, 0.05);
    }
  }

  /** A long downstream push: the boat moves on to fresh water. */
  private advance(): void {
    this.flowSpeed = Math.min(3.4, this.flowSpeed + 1.5);
    for (let i = 0; i < 5; i++) {
      this.water.ripple(randRange(this.rng, -1.1, 1.1), randRange(this.rng, 2.4, 4.2), 0.5, 3.0);
    }
    this.spray.emit(this.tmp.set(0, 0.05, 3.6), 12, 0.9, 1.0, 0.9, 0.05, 0.8, 0.5);
    this.maybeFinishFromAdvance();
  }

  private hintNudge(): void {
    // A stray tap on open water still gives something to look at.
    this.water.ripple(randRange(this.rng, -3, 3), randRange(this.rng, -8, -2), 0.35, 3.0);
  }

  // =========================================================================
  // lifecycle
  // =========================================================================

  restart(): void {
    this.phase = 'depart';
    this.phaseT = 0;
    this.night = 0;
    this.flow = 0;
    this.flowSpeed = 0.35;
    this.fishCount = 0;
    this.idle = 0;
    this.fire.setStrength(0.07);
    this.fire.strength = 0.07;
    this.env.group.position.z = 0;
    this.shoal.group.position.z = 0;

    for (const f of this.flying) f.mesh.removeFromParent();
    this.flying.length = 0;
    for (const c of [...this.boat.basket.children]) c.removeFromParent();
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      b.takeFish()?.removeFromParent();
      b.reset();
      this.boat.toWorld(this.boat.perchSlots[i], this.tmp);
      b.pos.copy(this.tmp);
      this.ropes[i].reset(this.handWorld, this.tmp);
      this.ropes[i].setLength(1.4);
    }
    this.stage.camOffset.set(0, 0, 0);
    this.stage.lookOffset.set(0, 0, 0);
    this.replayBtn.classList.remove('is-shown');
    window.setTimeout(() => {
      this.replayBtn.hidden = true;
    }, 400);
  }

  layoutForOrientation(): void {
    // Portrait keeps the working water closer so small thumbs can reach it.
    // Nothing to swap per orientation right now; the two camera layouts do
    // the work. Kept as the single place that would.
  }

  // =========================================================================
  // frame
  // =========================================================================

  update(dt: number): void {
    this.t += dt;
    this.phaseT += dt;
    this.idle += dt;

    // Camera offsets are rebuilt from scratch every frame; the phase owns the
    // composition and the shake is layered on afterwards.
    this.stage.camOffset.set(0, 0, 0);
    this.stage.lookOffset.set(0, 0, 0);
    this.updatePhase(dt);

    // ---- water & world ----------------------------------------------------
    this.flowSpeed = damp(this.flowSpeed, this.phase === 'finale' ? 2.6 : 0.35, 0.7, dt);
    this.flow += this.flowSpeed * dt;
    this.env.group.position.z += this.flowSpeed * dt * 0.75;
    this.shoal.group.position.z += this.flowSpeed * dt * 0.75;
    this.water.update(dt, this.stage.camera.position, this.flow);
    this.water.setNight(this.night);
    this.sky.setNight(this.night);
    this.sky.update(this.t, this.stage.dpr / 2 + 0.5);
    this.env.update(this.t, this.night);
    this.shoal.update(this.t);

    // ---- boat: rides the swell -------------------------------------------
    const surfAt = (x: number, z: number): number => this.water.heightAt(x, z, this.flow);
    const hFore = surfAt(0, -2.6);
    const hAft = surfAt(0, 2.6);
    const hPort = surfAt(-0.7, 0);
    const hStbd = surfAt(0.7, 0);
    this.boat.group.position.y = (hFore + hAft) * 0.5 - 0.02;
    this.boat.group.rotation.x = Math.atan2(hAft - hFore, 5.2) * 0.85;
    this.boat.group.rotation.z = Math.atan2(hPort - hStbd, 1.4) * 0.7;
    this.boat.group.updateMatrixWorld(true);
    this.boatShadow.position.set(0, 0.01, 0);

    // ---- fire -------------------------------------------------------------
    this.fire.update(dt, this.t, this.stage.dpr / 2 + 0.5);
    this.boat.toWorld(this.tmp.copy(this.fire.group.position).add(this.fire.heart), this.fireWorld);
    this.water.setFire(clamp01(this.fire.strength * 1.05), this.fireWorld);
    this.water.setBoat(this.boat.group.position.x, this.boat.group.position.z);

    this.fireSpot.position.copy(this.fireWorld);
    this.fireSpot.target.position.set(
      this.boat.group.position.x,
      -0.2,
      this.boat.group.position.z + 1.2,
    );
    this.fireSpot.intensity = this.fire.strength * this.fire.strength * 4.2;
    this.hemi.intensity = 0.11 + (1 - this.night) * 0.55 + this.fire.strength * 0.08;
    // Warm bounce off the lit river fills the undersides of everything aboard.
    this.hemi.groundColor.setRGB(
      0.012 + this.fire.strength * 0.075,
      0.02 + this.fire.strength * 0.032,
      0.04 + this.fire.strength * 0.008,
    );
    this.moonLight.intensity = 0.1 + this.night * 0.26;
    this.fill.intensity = 0.05 + this.fire.strength * 0.22;
    this.stage.renderer.toneMappingExposure = 0.82 + this.fire.strength * 0.1;

    // ---- crew -------------------------------------------------------------
    this.updateCrew(dt);

    // ---- birds & ropes ----------------------------------------------------
    this.updateBirds(dt, surfAt);
    this.updateRopes(dt, surfAt);

    // ---- fish in flight ---------------------------------------------------
    this.updateFlyingFish(dt);

    // ---- particles --------------------------------------------------------
    const ds = this.stage.dpr / 2 + 0.5;
    this.splash.update(dt, ds);
    this.bubbles.update(dt, ds);
    this.spray.update(dt, ds);

    // ---- coaching ---------------------------------------------------------
    this.updateHints(dt);

    // A hand-held wobble that decays fast. Small on purpose.
    this.shake = damp(this.shake, 0, 4.5, dt);
    this.shakeSeed += dt * 21;
    if (this.shake > 0.001) {
      this.stage.camOffset.x += Math.sin(this.shakeSeed) * this.shake;
      this.stage.camOffset.y += Math.sin(this.shakeSeed * 1.7 + 1.1) * this.shake * 0.7;
    }

    this.stage.update(dt);
  }

  private updateCrew(dt: number): void {
    // The usho braces against wherever the loaded ropes are pulling.
    this.tmpB.set(0, 0, 0);
    let pulls = 0;
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      if (b.state === 'perch' || b.state === 'settle') continue;
      this.tmpB.add(this.tmp.subVectors(b.pos, this.handWorld).normalize());
      pulls++;
    }
    if (pulls > 0) this.tmpB.divideScalar(pulls);

    const hauling = this.birds.some((b) => b.state === 'rising');
    // Where the kagaribi sits from where he is standing, so the reach is real.
    this.tmpFire.copy(this.fireWorld);
    this.usho.group.worldToLocal(this.tmpFire);
    this.usho.update(dt, this.t, {
      ropeDir: pulls > 0 ? this.tmpB : null,
      firePos: this.tmpFire,
      hauling,
    });
    this.nakanori.update(dt, this.t, { ropeDir: null, firePos: null, hauling: false });
    this.handWorld.copy(this.usho.handWorld);
  }

  private updateBirds(dt: number, surfAt: (x: number, z: number) => number): void {
    this.shiverClock += dt;
    const shiverNow = this.shiverClock > 1.15;
    if (shiverNow) this.shiverClock = 0;

    for (let i = 0; i < this.birds.length; i++) {
      const bird = this.birds[i];
      const slot = this.boat.perchSlots[i % this.boat.perchSlots.length];
      this.boat.toWorld(slot, this.tmp);
      const side = Math.sign(slot.x) || 1;

      bird.update(dt, this.t, {
        perch: this.tmp,
        perchOutward: -side * (Math.PI / 2 - 0.6),
        hand: this.handWorld,
        surfaceAt: surfAt,
        onSplash: (p, power) => {
          this.splash.emit(
            p,
            Math.round(10 + power * 16),
            1.5 * power,
            1.0,
            2.2 * power,
            0.05,
            0.75,
            0.12,
          );
          this.spray.emit(
            p,
            Math.round(4 + power * 8),
            1.1 * power,
            1.0,
            1.7 * power,
            0.04,
            0.6,
            0.1,
          );
        },
        onBubbles: (p, n) => this.bubbles.emit(p, n, 0.28, 0.9, 0.5, 0.035, 1.5, 0.09),
        onRipple: (x, z, s) => this.water.ripple(x, z, s, s > 0.8 ? 5.0 : 3.0),
        onFound: (b) => this.onBirdFound(b),
        onSurfaced: (b) => this.onBirdSurfaced(b),
        onBoard: (b) => this.onBirdBoard(b),
      });

      // Pale patch on the water above a working bird.
      const ghost = this.ghosts[i];
      const depth = Math.max(0, -bird.pos.y);
      const showing = bird.submerged || bird.state === 'rising' || bird.state === 'dive';
      const want = showing ? 0.27 * clamp01(1.35 - depth * 0.7) : 0;
      const mat = ghost.material as SpriteMaterial;
      mat.opacity = damp(mat.opacity, want, 5, dt);
      ghost.position.set(bird.pos.x, 0.02, bird.pos.z);
      ghost.scale.setScalar(0.85 + depth * 0.75 + Math.sin(this.t * 2.2 + i) * 0.06);

      // A loaded rope never stops talking to you.
      if (shiverNow && bird.waitingToHaul) {
        this.ropes[i].shiver(0.75);
        this.water.ripple(bird.pos.x, bird.pos.z, 0.3, 2.6);
        this.bubbles.emit(bird.pos, 3, 0.3, 0.9, 0.5, 0.035, 1.4, 0.1);
      }
    }
  }

  private onBirdFound(bird: Cormorant): void {
    const kind = FISH_KINDS[Math.floor(this.rng() * FISH_KINDS.length)];
    bird.giveFish(kind, makeFish(kind, bird.index * 7 + this.fishCount));
    this.ropes[bird.index].shiver(1.2);
    this.usho.lookAt(bird.pos.x);
  }

  private onBirdSurfaced(bird: Cormorant): void {
    this.shake = Math.max(this.shake, 0.05);
    this.spray.emit(bird.pos, 22, 1.7, 1.1, 2.6, 0.05, 0.85, 0.16);
    this.splash.emit(bird.pos, 24, 1.9, 1.1, 2.8, 0.055, 0.8, 0.16);
    this.water.ripple(bird.pos.x, bird.pos.z, 1.5, 5.2);
  }

  private onBirdBoard(bird: Cormorant): void {
    const fish = bird.takeFish();
    if (!fish) return;
    this.boat.toWorld(this.boat.basketMouth, this.tmp);
    this.stage.scene.add(fish);
    fish.position.copy(bird.beakWorld);
    fish.scale.setScalar(0.9);
    this.flying.push({
      mesh: fish,
      from: bird.beakWorld.clone(),
      to: this.tmp.clone(),
      t: 0,
      dur: 0.62,
    });
  }

  private updateFlyingFish(dt: number): void {
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.t += dt;
      const k = clamp01(f.t / f.dur);
      // Re-aim at the basket every frame; the boat is moving under it.
      this.boat.toWorld(this.boat.basketMouth, f.to);
      f.mesh.position.lerpVectors(f.from, f.to, easeInOutSine(k));
      f.mesh.position.y += Math.sin(k * Math.PI) * 0.55;
      f.mesh.rotation.x += dt * 6.5;
      f.mesh.rotation.y += dt * 3.1;
      if (k >= 1) {
        this.flying.splice(i, 1);
        f.mesh.removeFromParent();
        f.mesh.rotation.set(0, 0, 0);
        f.mesh.scale.setScalar(0.85);
        this.boat.addToBasket(f.mesh, this.fishCount);
        this.fishCount++;
        this.boat.toWorld(this.boat.basketMouth, this.tmp);
        this.spray.emit(this.tmp, 8, 0.5, 0.9, 0.8, 0.028, 0.55, 0.14);
        // A little celebration in the water, not on a scoreboard.
        this.water.ripple(this.boat.group.position.x, this.boat.group.position.z + 1.5, 0.35, 2.4);
      }
    }
  }

  private updateRopes(dt: number, surfAt: (x: number, z: number) => number): void {
    this.wakeClock += dt;
    const wake = this.wakeClock > 0.5;
    if (wake) this.wakeClock = 0;

    for (let i = 0; i < this.birds.length; i++) {
      const bird = this.birds[i];
      const rope = this.ropes[i];
      const anchor = this.ropeAnchors[i];

      // Every rope leaves the same fist, fanned slightly so they read apart.
      const fan = (i - (BIRDS - 1) / 2) * 0.055;
      anchor.copy(this.handWorld);
      anchor.x += fan;
      anchor.y += Math.abs(fan) * 0.35;

      rope.start.copy(anchor);
      rope.end.copy(bird.ringWorld);

      const dist = anchor.distanceTo(bird.ringWorld);
      let slack: number;
      switch (bird.state) {
        case 'perch':
        case 'settle':
          slack = 0.22;
          break;
        case 'launch':
          slack = 0.22;
          break;
        case 'swim':
          slack = 0.24;
          break;
        case 'dive':
          slack = 0.26;
          break;
        case 'under':
          slack = 0.26;
          break;
        case 'rising':
          slack = lerp(0.26, 0.012, clamp01(bird.haulProgress * 1.5));
          break;
        default:
          slack = 0.18;
      }
      rope.setLength(clamp(dist * (1 + slack), rope.minLength, rope.maxLength));
      rope.step(dt, surfAt);
      this.ropeMeshes[i].update(rope.pts, bird.waitingToHaul ? 0.35 : 0);

      // Rope dipping in and out of the river throws off small rings.
      if (wake && (bird.state === 'under' || bird.state === 'swim' || bird.state === 'rising')) {
        const n = rope.waterContacts(this.contacts);
        for (let c = 0; c < n; c++) {
          this.water.ripple(this.contacts[c].x, this.contacts[c].z, 0.18, 2.2);
        }
      }
    }
  }

  // =========================================================================
  // phases
  // =========================================================================

  private updatePhase(dt: number): void {
    switch (this.phase) {
      case 'depart': {
        // Dusk burns down while the boat slips out onto the river.
        this.night = damp(this.night, 0.86, 0.34, dt);
        const k = clamp01(this.phaseT / 6.4);
        this.stage.camOffset.set(0, lerp(0.9, 0, easeOutCubic(k)), lerp(3.2, 0, easeOutCubic(k)));
        this.stage.lookOffset.set(0, lerp(0.5, 0, easeOutCubic(k)), lerp(1.6, 0, easeOutCubic(k)));
        this.flowSpeed = lerp(1.5, 0.4, easeOutCubic(k));
        if (this.phaseT > 6.4) {
          this.phase = 'kindle';
          this.phaseT = 0;
          this.idle = IDLE_HINT - 0.9;
        }
        break;
      }

      case 'kindle': {
        this.night = damp(this.night, 0.94, 0.5, dt);
        // Embers breathe on their own so there's always something to poke at.
        if (!this.fire.lit && Math.random() < dt * 0.7) {
          this.spray.emit(this.fireWorld, 2, 0.5, 0.7, 1.2, 0.03, 0.6, 0.1);
        }
        break;
      }

      case 'fishing': {
        this.night = damp(this.night, 1, 0.4, dt);
        const allHome = this.birds.every((b) => b.state === 'perch' || b.state === 'settle');
        if (this.fishCount >= FISH_AUTO_FINALE && allHome) this.startFinale();
        break;
      }

      case 'finale': {
        const k = clamp01(this.phaseT / 15);
        // Drift on, and let the camera fall back to take in the whole picture.
        this.stage.camOffset.set(
          Math.sin(this.phaseT * 0.18) * 0.9 * k,
          lerp(0, 1.5, easeInOutSine(k)),
          lerp(0, 3.4, easeInOutSine(k)),
        );
        this.stage.lookOffset.set(0, lerp(0, 0.5, k), lerp(0, -1.6, easeInOutSine(k)));
        this.fire.setStrength(1);
        if (this.phaseT > 12.5 && this.replayBtn.hidden) {
          this.replayBtn.hidden = false;
          window.setTimeout(() => this.replayBtn.classList.add('is-shown'), 30);
        }
        if (this.phaseT > 15) this.phase = 'done';
        break;
      }

      case 'done':
        this.stage.camOffset.x = Math.sin(this.t * 0.16) * 1.0;
        break;
    }
  }

  private startFinale(): void {
    this.phase = 'finale';
    this.phaseT = 0;
    this.hints.hide();
    this.usho.lookAt(0);
  }

  // =========================================================================
  // wordless coaching
  // =========================================================================

  private updateHints(dt: number): void {
    if (
      this.idle < IDLE_HINT ||
      this.phase === 'depart' ||
      this.phase === 'finale' ||
      this.phase === 'done'
    ) {
      if (this.idle < IDLE_HINT) this.hints.hide();
      this.nudgeClock = 0;
      return;
    }

    // Beyond the dotted trail, the world itself gestures: the embers flare, the
    // usho's hands move, the loaded rope shivers harder, the rings get bigger.
    this.nudgeClock += dt;
    const nudge = this.nudgeClock > 2.2;
    if (nudge) this.nudgeClock = 0;

    if (this.phase === 'kindle') {
      this.hints.show({ anchor: this.fireWorld, dx: 0, dy: -1, hue: 'ember' });
      if (nudge) {
        this.fire.flare();
        this.usho.pulseFan();
      }
      return;
    }

    // 1. Somebody has a fish and is waiting to be pulled in.
    const waiting = this.birds.find((b) => b.waitingToHaul);
    if (waiting) {
      const rope = this.ropes[waiting.index];
      const mid = rope.pts[Math.floor(rope.n * 0.45)];
      this.hints.show({ anchor: mid, dx: 0, dy: 1, hue: 'water' });
      if (nudge) {
        rope.shiver(1.3);
        this.usho.pulseHaul();
        this.usho.lookAt(waiting.pos.x);
        this.water.ripple(waiting.pos.x, waiting.pos.z, 0.75, 3.4);
        this.bubbles.emit(waiting.pos, 8, 0.32, 0.9, 0.55, 0.04, 1.5, 0.12);
      }
      return;
    }

    // 2. Birds still on the rail want to go in.
    const perched = this.birds.find((b) => b.state === 'perch');
    if (perched) {
      const outward = Math.sign(perched.pos.x - this.boat.group.position.x) || -1;
      this.hints.show({ anchor: perched.pos, dx: outward * 0.5, dy: -1, hue: 'pale' });
      if (nudge) {
        this.ropes[perched.index].shiver(0.5);
        this.usho.lookAt(perched.pos.x);
        this.fire.flare();
      }
      return;
    }

    // 3. Enough fish, everyone aboard: push on downstream.
    const allHome = this.birds.every((b) => b.state === 'perch' || b.state === 'settle');
    if (this.fishCount >= FISH_FOR_FINALE && allHome) {
      this.boat.toWorld(this.tmp.set(0, 0.5, 1.2), this.tmpB);
      this.hints.show({
        anchor: this.tmpB,
        dx: 0,
        dy: -1,
        len: this.shortSide() * 0.3,
        hue: 'ember',
      });
      if (nudge) {
        this.fire.flare();
        for (let i = 0; i < 3; i++) {
          this.water.ripple(
            randRange(this.rng, -1.2, 1.2),
            randRange(this.rng, 2.0, 3.6),
            0.4,
            2.8,
          );
        }
      }
      return;
    }

    this.hints.hide();
  }

  /** Long downstream push while everything is home ends the evening. */
  maybeFinishFromAdvance(): void {
    const allHome = this.birds.every((b) => b.state === 'perch' || b.state === 'settle');
    if (this.phase === 'fishing' && this.fishCount >= FISH_FOR_FINALE && allHome)
      this.startFinale();
  }
}
