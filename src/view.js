/**
 * All rendering for ころころ橋渡しクレーン.
 *
 * The visual budget is spent, in order, on: the prize box, the claw, the two
 * support bars and the place where the box touches them. The cabinet around
 * them is deliberately simple — it is context, not the subject.
 *
 * Every moving mesh is slaved to a rigid body; nothing here animates on its own
 * except the reticle, the lights and the win-time confetti.
 */

import * as THREE from '../vendor/three/three.module.min.js';
import { RoundedBoxGeometry } from '../vendor/three/RoundedBoxGeometry.js';
import { BAR, FIELD } from './config.js';
import { prongParts } from './physics.js';
import { makePrizeMaterials, makeBackdrop, makeSidePanelArt } from './prizeArt.js';

const tmpV = new THREE.Vector3();

export class View {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    // A lost context on mobile must not leave a dead black canvas.
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.renderer.resetState();
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0a0c14');
    this.scene.fog = new THREE.Fog('#0a0c14', 1.6, 3.4);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 12);
    this.camTarget = new THREE.Vector3(0, 0.455, -0.01);
    this.camDist = 1.4;
    this.camPush = 0;
    this.portrait = true;

    this._buildEnvironment();
    this._buildLights();
    this._buildCabinet();
    this._buildBars(BAR.spacing);
    this._buildCrane();
    this._buildAim();
    this._buildConfetti();

    this.prize = null;
    this.time = 0;
    this.flash = 0;
    this.excite = 0;
  }

  // ------------------------------------------------------------------- env

  _buildEnvironment() {
    // A tiny emissive room, pre-filtered once, gives every metal surface
    // something believable to reflect without loading an HDR file.
    const room = new THREE.Scene();
    const box = new THREE.BoxGeometry(1, 1, 1);
    const add = (color, intensity, sx, sy, sz, x, y, z) => {
      const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color }));
      m.material.color.multiplyScalar(intensity);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      room.add(m);
    };
    add('#20242e', 1.0, 12, 12, 12, 0, 0, 0);           // shell
    add('#ffffff', 2.6, 5, 0.4, 5, 0, 4.6, 0);          // ceiling bank
    add('#ffc8dd', 1.05, 0.4, 3, 5, -4.4, 1.6, 0);      // warm side
    add('#bfe9ff', 1.0, 0.4, 3, 5, 4.4, 1.6, 0);        // cool side
    add('#fff0cf', 0.85, 5, 3, 0.4, 0, 1.2, -4.4);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    this.env = pmrem.fromScene(room, 0.04).texture;
    pmrem.dispose();
    room.traverse((o) => { if (o.isMesh) o.material.dispose(); });
    box.dispose();
    this.scene.environment = this.env;
  }

  _buildLights() {
    this.scene.add(new THREE.HemisphereLight('#a8c8ff', '#241c26', 0.38));

    const key = new THREE.SpotLight('#fff4e2', 13, 3.4, 0.70, 0.55, 1.5);
    key.position.set(0.28, 1.72, 0.62);
    key.target.position.set(0, 0.42, -0.02);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.6;
    key.shadow.camera.far = 3.0;
    key.shadow.bias = -0.0012;
    key.shadow.normalBias = 0.012;
    key.shadow.radius = 2.2;
    this.scene.add(key, key.target);
    this.keyLight = key;

    const fill = new THREE.SpotLight('#bcd8ff', 4.2, 3.2, 0.85, 0.7, 1.4);
    fill.position.set(-0.7, 1.3, 0.9);
    fill.target.position.set(0, 0.4, -0.05);
    this.scene.add(fill, fill.target);

    // interior LED accents — these react to how close the prize is to falling
    this.accent = [];
    for (const [x, col] of [[-0.26, '#ff5fa2'], [0.26, '#4fd8ff']]) {
      const p = new THREE.PointLight(col, 0.34, 1.15, 2);
      p.position.set(x, 0.98, 0.08);
      this.scene.add(p);
      this.accent.push(p);
    }
    this.winLight = new THREE.PointLight('#fff0c0', 0, 1.6, 2);
    this.winLight.position.set(0, 0.32, 0.06);
    this.scene.add(this.winLight);
  }

  // --------------------------------------------------------------- cabinet

  _buildCabinet() {
    const g = new THREE.Group();
    this.scene.add(g);
    this.cabinet = g;

    const W = FIELD.wallX;
    const zB = FIELD.backZ;
    const zF = FIELD.frontZ;
    const depth = zF - zB;
    const midZ = (zF + zB) / 2;
    const H = FIELD.ceilY;

    const panel = new THREE.MeshStandardMaterial({
      color: '#2b3145', roughness: 0.68, metalness: 0.3, envMapIntensity: 0.6,
    });
    const chrome = new THREE.MeshStandardMaterial({
      color: '#cfd6e2', roughness: 0.22, metalness: 1.0, envMapIntensity: 1.0,
    });
    const bodyPaint = new THREE.MeshStandardMaterial({
      color: '#b62b52', roughness: 0.42, metalness: 0.12, envMapIntensity: 0.5,
    });
    this.mats = { panel, chrome, bodyPaint };

    const boxMesh = (w, h, d, x, y, z, mat, shadow = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.receiveShadow = shadow;
      g.add(m);
      return m;
    };

    // prize tray: soft mat at the bottom of the machine
    const tray = new THREE.Mesh(
      new THREE.BoxGeometry(W * 2, 0.04, depth),
      new THREE.MeshStandardMaterial({ color: '#191323', roughness: 0.95, metalness: 0.0 }),
    );
    tray.position.set(0, -0.02, midZ);
    tray.receiveShadow = true;
    g.add(tray);

    const felt = new THREE.Mesh(
      new THREE.BoxGeometry(W * 1.9, 0.012, depth * 0.94),
      new THREE.MeshStandardMaterial({ color: '#4d1f38', roughness: 1.0, metalness: 0.0 }),
    );
    felt.position.set(0, 0.004, midZ);
    felt.receiveShadow = true;
    g.add(felt);

    // walls (printed on the inside so the wide landscape framing stays alive)
    const sideArt = makeSidePanelArt();
    sideArt.wrapS = sideArt.wrapT = THREE.RepeatWrapping;
    sideArt.repeat.set(1.3, 1);
    const sideMat = new THREE.MeshStandardMaterial({
      map: sideArt, color: '#c9d2e6', roughness: 0.7, metalness: 0.2, envMapIntensity: 0.5,
    });
    for (const sx of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(depth, H), sideMat);
      wall.position.set(sx * W, H / 2, midZ);
      wall.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
      wall.receiveShadow = true;
      g.add(wall);
    }
    boxMesh(0.03, H, depth, -(W + 0.015), H / 2, midZ, panel);
    boxMesh(0.03, H, depth, W + 0.015, H / 2, midZ, panel);
    boxMesh(W * 2 + 0.06, 0.04, depth, 0, H + 0.02, midZ, panel, false);

    // LED strips along the inside of the side walls: arcade sparkle, and they
    // stop the wide landscape framing from filling up with dead panel.
    this.leds = [];
    for (const sx of [-1, 1]) {
      const mat = new THREE.MeshStandardMaterial({
        color: '#ffd9ef', emissive: sx < 0 ? '#ff4f9d' : '#4fd8ff', emissiveIntensity: 1.5,
        roughness: 0.4, metalness: 0.0,
      });
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.012, H * 0.82, 0.014), mat);
      strip.position.set(sx * (W - 0.012), H * 0.5, zF - 0.05);
      g.add(strip);
      const strip2 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.014, depth * 0.9), mat);
      strip2.position.set(sx * (W - 0.012), H - 0.05, midZ);
      g.add(strip2);
      this.leds.push(mat);
    }

    // printed backdrop
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 2, H),
      new THREE.MeshStandardMaterial({
        map: makeBackdrop(), roughness: 0.88, metalness: 0.0, envMapIntensity: 0.3,
      }),
    );
    back.position.set(0, H / 2, zB);
    back.receiveShadow = true;
    g.add(back);

    // corner posts + front rim (the cabinet frame we look through)
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, H + 0.14, 16), chrome);
      post.position.set(sx * (W + 0.035), (H + 0.14) / 2 - 0.04, zF + 0.02);
      post.castShadow = true;
      g.add(post);
      const postB = post.clone();
      postB.position.z = zB - 0.02;
      g.add(postB);
    }
    const rim = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.14, 0.055, 0.05), bodyPaint);
    rim.position.set(0, 0.03, zF + 0.02);
    g.add(rim);
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.14, 0.05, 0.05), bodyPaint);
    topRail.position.set(0, H + 0.06, zF + 0.02);
    g.add(topRail);

    // marquee: the lit sign above the glass
    const marqueeMat = new THREE.MeshStandardMaterial({
      color: '#d94a80', emissive: '#ff2f7a', emissiveIntensity: 0.45,
      roughness: 0.45, metalness: 0.1,
    });
    const marquee = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.10, 0.16, 0.035), marqueeMat);
    marquee.position.set(0, H + 0.155, zF + 0.005);
    marquee.rotation.x = -0.18;
    g.add(marquee);
    this.marqueeMat = marqueeMat;

    this.bulbs = [];
    for (let i = 0; i < 11; i++) {
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 12, 8),
        new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffd98a', emissiveIntensity: 1.6 }),
      );
      bulb.position.set(-W - 0.04 + (i * (W * 2 + 0.08)) / 10, H + 0.245, zF + 0.02);
      g.add(bulb);
      this.bulbs.push(bulb);
    }

    // prize chute mouth at the front-left, so the tray reads as an exit
    const chute = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.13, 0.02),
      new THREE.MeshStandardMaterial({ color: '#0b0d14', roughness: 0.95 }),
    );
    chute.position.set(-W + 0.13, 0.085, zF + 0.028);
    g.add(chute);
    const chuteLip = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.022, 0.03), chrome);
    chuteLip.position.set(-W + 0.13, 0.163, zF + 0.03);
    g.add(chuteLip);
  }

  // ------------------------------------------------------------------ bars

  _buildBars(spacing) {
    if (this.barGroup) this.scene.remove(this.barGroup);
    const g = new THREE.Group();
    this.scene.add(g);
    this.barGroup = g;

    const len = BAR.zFront - BAR.zBack;
    const midZ = (BAR.zFront + BAR.zBack) / 2;
    const cy = BAR.topY - BAR.radius;

    const steel = new THREE.MeshStandardMaterial({
      color: '#d8dde6', roughness: 0.16, metalness: 1.0, envMapIntensity: 1.15,
    });
    const bracket = new THREE.MeshStandardMaterial({
      color: '#2c3244', roughness: 0.5, metalness: 0.7,
    });

    for (const s of [-1, 1]) {
      const x = (s * spacing) / 2;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(BAR.radius, BAR.radius, len, 24, 1), steel);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(x, cy, midZ);
      bar.castShadow = true;
      bar.receiveShadow = true;
      g.add(bar);

      for (const z of [BAR.zBack, BAR.zFront]) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(BAR.radius * 1.04, 16, 12), steel);
        cap.position.set(x, cy, z);
        cap.castShadow = true;
        g.add(cap);
        const br = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.055, 0.03), bracket);
        br.position.set(x, cy - 0.012, z + Math.sign(z) * 0.028);
        br.castShadow = true;
        g.add(br);
      }
    }
    this.barSpacing = spacing;
  }

  // ----------------------------------------------------------------- crane

  _buildCrane() {
    const chrome = new THREE.MeshStandardMaterial({
      color: '#c9d1de', roughness: 0.19, metalness: 1.0, envMapIntensity: 1.1,
    });
    const darkMetal = new THREE.MeshStandardMaterial({
      color: '#39404f', roughness: 0.42, metalness: 0.85, envMapIntensity: 0.8,
    });
    const claw = new THREE.MeshStandardMaterial({
      color: '#dfe6f0', roughness: 0.14, metalness: 1.0, envMapIntensity: 1.25,
    });
    const clawTip = new THREE.MeshStandardMaterial({
      color: '#ffcf5c', roughness: 0.28, metalness: 0.9, envMapIntensity: 1.0,
    });

    const railY = FIELD.ceilY - 0.035;
    const g = new THREE.Group();
    this.scene.add(g);
    this.craneGroup = g;

    // two fixed rails running front-to-back, and the bridge that slides on them
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.022, FIELD.frontZ - FIELD.backZ), darkMetal,
      );
      rail.position.set(s * (FIELD.wallX - 0.02), railY, (FIELD.frontZ + FIELD.backZ) / 2);
      g.add(rail);
    }

    this.bridge = new THREE.Group();
    g.add(this.bridge);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(FIELD.wallX * 2 - 0.01, 0.028, 0.045), darkMetal);
    beam.position.y = railY - 0.008;
    beam.castShadow = true;
    this.bridge.add(beam);
    for (const s of [-1, 1]) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.038, 0.062), chrome);
      shoe.position.set(s * (FIELD.wallX - 0.02), railY, 0);
      this.bridge.add(shoe);
    }

    this.trolley = new THREE.Group();
    this.bridge.add(this.trolley);
    const car = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.05, 0.075), chrome);
    car.position.y = railY - 0.045;
    car.castShadow = true;
    this.trolley.add(car);
    const carTop = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.022, 0.05), darkMetal);
    carTop.position.y = railY - 0.012;
    this.trolley.add(carTop);

    // telescoping shaft: scaled each frame between the trolley and the claw
    this.shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 1, 14), chrome);
    this.shaft.castShadow = true;
    g.add(this.shaft);
    this.shaftOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.06, 14), darkMetal);
    g.add(this.shaftOuter);

    // claw head
    this.head = new THREE.Group();
    g.add(this.head);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.024, 0.042, 20), claw);
    hub.position.y = 0.026;
    hub.castShadow = true;
    this.head.add(hub);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.0335, 0.0335, 0.010, 20), clawTip);
    collar.position.y = 0.048;
    this.head.add(collar);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.024, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), claw);
    dome.position.y = 0.047;
    this.head.add(dome);

    this.prongMeshes = [];
    for (const side of [-1, 1]) {
      const parts = prongParts(side);
      const p = new THREE.Group();
      g.add(p);

      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 12), clawTip);
      bolt.rotation.x = Math.PI / 2;
      p.add(bolt);

      const arm = new THREE.Mesh(
        new RoundedBoxGeometry(parts.arm.half.x * 2, parts.arm.half.y * 2, parts.arm.half.z * 2, 2, 0.005),
        claw,
      );
      arm.position.set(parts.arm.pos.x, parts.arm.pos.y, 0);
      arm.rotation.z = parts.arm.ang;
      arm.castShadow = true;
      p.add(arm);

      const hook = new THREE.Mesh(
        new RoundedBoxGeometry(parts.hook.half.x * 2, parts.hook.half.y * 2, parts.hook.half.z * 2, 2, 0.004),
        claw,
      );
      hook.position.set(parts.hook.pos.x, parts.hook.pos.y, 0);
      hook.rotation.z = parts.hook.ang;
      hook.castShadow = true;
      p.add(hook);

      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0085, 0.022, 12), clawTip);
      tip.position.set(parts.tip.x, parts.tip.y + 0.006, 0);
      tip.rotation.z = parts.hook.ang + Math.PI;
      tip.castShadow = true;
      p.add(tip);

      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.011, 14, 10), claw);
      knuckle.position.set(parts.arm.pos.x * 2, parts.arm.pos.y * 2, 0);
      p.add(knuckle);

      this.prongMeshes.push(p);
    }
  }

  // ------------------------------------------------------------------- aim

  _buildAim() {
    const g = new THREE.Group();
    this.scene.add(g);
    this.aimGroup = g;

    const ringMat = new THREE.MeshBasicMaterial({
      color: '#8ef0ff', transparent: true, opacity: 0.85, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.aimRing = new THREE.Mesh(new THREE.RingGeometry(0.036, 0.050, 40), ringMat);
    this.aimRing.rotation.x = -Math.PI / 2;
    g.add(this.aimRing);

    this.aimRing2 = new THREE.Mesh(new THREE.RingGeometry(0.056, 0.062, 40), ringMat.clone());
    this.aimRing2.rotation.x = -Math.PI / 2;
    this.aimRing2.material.opacity = 0.45;
    g.add(this.aimRing2);

    const dotMat = new THREE.MeshBasicMaterial({
      color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.aimDot = new THREE.Mesh(new THREE.CircleGeometry(0.012, 20), dotMat);
    this.aimDot.rotation.x = -Math.PI / 2;
    g.add(this.aimDot);

    // soft blob shadow so the claw feels connected to the play surface
    const shadowTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d');
      const grd = x.createRadialGradient(64, 64, 2, 64, 64, 62);
      grd.addColorStop(0, 'rgba(0,0,0,0.55)');
      grd.addColorStop(0.55, 'rgba(0,0,0,0.22)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = grd;
      x.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c);
      return t;
    })();
    this.aimBlob = new THREE.Mesh(
      new THREE.PlaneGeometry(0.13, 0.13),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 }),
    );
    this.aimBlob.rotation.x = -Math.PI / 2;
    g.add(this.aimBlob);

    // vertical guide beam from the claw down to the play surface
    const beamMat = new THREE.MeshBasicMaterial({
      color: '#7fe6ff', transparent: true, opacity: 0.08, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.aimBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.032, 1, 18, 1, true), beamMat);
    this.scene.add(this.aimBeam);
  }

  // -------------------------------------------------------------- confetti

  _buildConfetti() {
    const N = 46;
    const geo = new THREE.PlaneGeometry(0.014, 0.020);
    const colors = ['#ffd24a', '#ff5f9e', '#5fe1ff', '#9dff7a', '#ffffff'];
    this.confetti = new THREE.Group();
    this.confetti.visible = false;
    this.scene.add(this.confetti);
    this.confettiBits = [];
    for (let i = 0; i < N; i++) {
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: colors[i % colors.length], side: THREE.DoubleSide, transparent: true,
        }),
      );
      this.confetti.add(m);
      this.confettiBits.push({ mesh: m, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0 });
    }
  }

  burstConfetti(x, y, z) {
    this.confetti.visible = true;
    for (const b of this.confettiBits) {
      b.mesh.position.set(x + (Math.random() - 0.5) * 0.08, y + Math.random() * 0.05, z + (Math.random() - 0.5) * 0.08);
      const a = Math.random() * Math.PI * 2;
      const s = 0.35 + Math.random() * 0.7;
      b.vel.set(Math.cos(a) * s * 0.5, 0.9 + Math.random() * 0.9, Math.sin(a) * s * 0.5);
      b.spin.set(Math.random() * 12 - 6, Math.random() * 12 - 6, Math.random() * 12 - 6);
      b.life = 1.6 + Math.random() * 0.7;
      b.mesh.material.opacity = 1;
      b.mesh.visible = true;
    }
  }

  _updateConfetti(dt) {
    if (!this.confetti.visible) return;
    let alive = false;
    for (const b of this.confettiBits) {
      if (b.life <= 0) { b.mesh.visible = false; continue; }
      alive = true;
      b.life -= dt;
      b.vel.y -= 2.6 * dt;
      b.vel.multiplyScalar(1 - 1.1 * dt);
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.rotation.x += b.spin.x * dt;
      b.mesh.rotation.y += b.spin.y * dt;
      b.mesh.rotation.z += b.spin.z * dt;
      b.mesh.material.opacity = Math.min(1, b.life * 1.4);
    }
    if (!alive) this.confetti.visible = false;
  }

  // ------------------------------------------------------------------ prize

  setPrize(round) {
    if (this.prize) {
      this.scene.remove(this.prize);
      this.prize.geometry.dispose();
      for (const m of this.prize.material) {
        m.map?.dispose();
        m.roughnessMap?.dispose();
        m.dispose();
      }
      this.prize = null;
    }
    if (Math.abs(round.barSpacing - this.barSpacing) > 1e-6) this._buildBars(round.barSpacing);

    const { w, h, d } = round.box;
    const geo = new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * 0.07);
    const mats = makePrizeMaterials(round.pkg, this.env);
    const mesh = new THREE.Mesh(geo, mats);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.prize = mesh;
  }

  // ------------------------------------------------------------------ sync

  /** Copies every rigid-body transform onto its mesh. */
  syncFromPhysics(p) {
    if (this.prize && p.prize) {
      const t = p.prize.translation();
      const r = p.prize.rotation();
      this.prize.position.set(t.x, t.y, t.z);
      this.prize.quaternion.set(r.x, r.y, r.z, r.w);
    }

    const head = p.head.translation();
    const headRot = p.head.rotation();
    this.head.position.set(head.x, head.y, head.z);
    this.head.quaternion.set(headRot.x, headRot.y, headRot.z, headRot.w);

    for (let i = 0; i < 2; i++) {
      const b = p.prongs[i].body;
      const t = b.translation();
      const r = b.rotation();
      this.prongMeshes[i].position.set(t.x, t.y, t.z);
      this.prongMeshes[i].quaternion.set(r.x, r.y, r.z, r.w);
    }

    const tr = p.trolley.translation();
    this.bridge.position.z = tr.z;
    this.trolley.position.x = tr.x;

    // shaft stretches from the trolley car down to the claw head
    const topY = FIELD.ceilY - 0.06;
    const botY = head.y + 0.055;
    const len = Math.max(0.02, topY - botY);
    this.shaft.scale.y = len;
    this.shaft.position.set(tr.x, botY + len / 2, tr.z);
    this.shaftOuter.position.set(tr.x, topY - 0.03, tr.z);
  }

  /** Positions the aiming aids under the claw. */
  updateAim(p, active, overPrize) {
    const head = p.head.translation();
    const y = BAR.topY + 0.004;
    this.aimGroup.position.set(head.x, y, head.z);
    const pulse = 1 + Math.sin(this.time * 4.2) * 0.055;
    this.aimRing.scale.setScalar(pulse);
    this.aimRing2.scale.setScalar(2 - pulse * 0.9);
    const col = overPrize ? 0x9dff8a : 0x8ef0ff;
    this.aimRing.material.color.setHex(col);
    this.aimRing2.material.color.setHex(col);
    const vis = active ? 1 : 0.35;
    this.aimRing.material.opacity = 0.85 * vis;
    this.aimRing2.material.opacity = 0.42 * vis;
    this.aimDot.material.opacity = 0.55 * vis;
    this.aimBlob.material.opacity = 0.75;
    this.aimBlob.position.set(head.x, y - 0.002, head.z);

    const top = head.y - 0.02;
    const len = Math.max(0.01, top - y);
    this.aimBeam.scale.y = len;
    this.aimBeam.position.set(head.x, y + len / 2, head.z);
    this.aimBeam.material.opacity = 0.075 * vis;
    this.aimBeam.material.color.setHex(col);
  }

  // ----------------------------------------------------------------- camera

  setViewport(width, height, dpr) {
    this.portrait = height >= width;
    const aspect = width / height;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = aspect;
    this.camera.fov = this.portrait ? 42 : 38;

    // Frame the whole play volume for the current aspect instead of stretching.
    const halfW = this.portrait ? 0.228 : 0.30;
    const halfH = this.portrait ? 0.34 : 0.26;
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const hHalf = Math.atan(Math.tan(vHalf) * aspect);
    this.camDist = Math.max(halfH / Math.tan(vHalf), halfW / Math.tan(hHalf)) + 0.26;
    this.camBias = this.portrait ? 0.025 : 0.01;
    this.baseFocus = this.portrait ? 0.47 : 0.46;
    // Landscape puts the Grab button bottom-right, so nudge the machine left.
    this.camTarget.x = this.portrait ? 0 : 0.045;
    if (this.camFocus === undefined) this.camFocus = this.baseFocus;
    this.camera.updateProjectionMatrix();
    this._placeCamera();
  }

  _placeCamera() {
    const az = THREE.MathUtils.degToRad(this.portrait ? 9 : 12);
    const el = THREE.MathUtils.degToRad(this.portrait ? 23 : 21);
    const d = this.camDist * (1 - this.camPush);
    const t = this.camTarget;
    t.y = this.camFocus ?? this.baseFocus ?? 0.45;
    this.camera.position.set(
      t.x + Math.sin(az) * Math.cos(el) * d,
      t.y + Math.sin(el) * d,
      t.z + Math.cos(az) * Math.cos(el) * d,
    );
    tmpV.set(t.x, t.y - (this.camBias ?? 0.05), t.z);
    this.camera.lookAt(tmpV);
  }

  // ------------------------------------------------------------------- tick

  update(dt, state) {
    this.time += dt;
    this._updateConfetti(dt);

    // camera push-in while the claw works, a touch more at the moment of truth
    const want = (state.pushIn ?? 0) * 0.08 + (state.instability ?? 0) * 0.03;
    this.camPush += (want - this.camPush) * Math.min(1, dt * 3.2);
    // Follow the prize down so the landing is never off-screen, then drift back.
    const focusWant = state.focusY ?? this.baseFocus;
    this.camFocus += (focusWant - this.camFocus) * Math.min(1, dt * 2.4);
    this._placeCamera();

    // cabinet lighting warms up as the prize gets closer to falling
    const inst = state.instability ?? 0;
    const beat = 0.5 + 0.5 * Math.sin(this.time * (2.4 + inst * 7));
    this.accent[0].intensity = 0.30 + inst * 0.85 * beat + this.flash * 1.6;
    this.accent[1].intensity = 0.30 + inst * 0.85 * (1 - beat) + this.flash * 1.6;
    this.marqueeMat.emissiveIntensity = 0.40 + 0.22 * beat + this.flash * 0.9;
    for (let i = 0; i < this.bulbs.length; i++) {
      const on = ((Math.floor(this.time * 5) + i) % 3 === 0) || this.flash > 0.2;
      this.bulbs[i].material.emissiveIntensity = on ? 2.1 : 0.35;
    }
    for (const m of this.leds) m.emissiveIntensity = 1.1 + inst * 1.3 * beat + this.flash * 2;
    this.winLight.intensity = this.flash * 9;
    this.flash = Math.max(0, this.flash - dt * 1.35);
  }

  render() {
    if (this.contextLost) return;
    this.renderer.render(this.scene, this.camera);
  }

  celebrate(x, y, z) {
    this.flash = 1;
    this.burstConfetti(x, y, z);
  }
}
