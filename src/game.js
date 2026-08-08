// ---------------------------------------------------------------------------
// Game: state machine, camera, touch input, the cleaning simulation and FX.
//
// The whole play loop is wordless. Every step is signalled by a pulsing 3-D
// target, an animated hand icon and sound; nothing can be failed and nothing
// can be fallen from.
// ---------------------------------------------------------------------------

import * as THREE from '../vendor/three/three.module.js';
import { World, FLOOR, GLASS_W, GLASS_H, GLASS_Z, ROOF_Y, ANCHOR_X, HERO_BAY, paneX, paneY } from './world.js';
import { Rig } from './rig.js';
import { Audio } from './audio.js';
import { drawGrime } from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const smoothstep = (t) => t * t * (3 - 2 * t);

const WORKER_Z = 0.30;   // rope line stand-off from the glass
const STOP_FLOORS = [42, 41, 40, 39, 38];
const GRIME_RES = 256;
const GLASS_FRONT = GLASS_Z + 0.013;

// ---------------------------------------------------------------------------
// Particles: one additive Points system with per-particle life, size and tint.
// ---------------------------------------------------------------------------

function dotTexture(star) {
  const S = 64;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  if (star) {
    x.globalCompositeOperation = 'lighter';
    x.strokeStyle = 'rgba(255,255,255,0.95)';
    x.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 4;
      const len = i % 2 ? S * 0.24 : S * 0.46;
      x.lineWidth = i % 2 ? 1.6 : 3.2;
      x.beginPath();
      x.moveTo(S / 2 - Math.cos(a) * len, S / 2 - Math.sin(a) * len);
      x.lineTo(S / 2 + Math.cos(a) * len, S / 2 + Math.sin(a) * len);
      x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Particles {
  constructor(scene, max, star) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.aSize = new Float32Array(max);
    this.aAlpha = new Float32Array(max);
    this.col = new Float32Array(max * 3);

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.aSize, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.aAlpha, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setDrawRange(0, 0);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.geom = g;

    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: dotTexture(star) }, uScale: { value: 600 } },
      vertexShader: `
        attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
        varying float vA; varying vec3 vC;
        uniform float uScale;
        void main(){
          vA = aAlpha; vC = aColor;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = aSize * uScale / max(0.001, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uMap; varying float vA; varying vec3 vC;
        void main(){
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vC * t.rgb, 1.0) * t.a * vA;
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Points(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    scene.add(this.mesh);
  }

  emit(p, v, life, size, color, grav = 0) {
    const i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.grav[i] = grav;
    this.col[i * 3] = color[0]; this.col[i * 3 + 1] = color[1]; this.col[i * 3 + 2] = color[2];
  }

  update(dt) {
    let alive = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.aAlpha[i] = 0; continue; }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      this.aAlpha[i] = k * k * (3 - 2 * k);
      this.aSize[i] = this.size[i] * (0.55 + k * 0.65);
      alive++;
    }
    this.geom.setDrawRange(0, this.n);
    this.geom.attributes.position.needsUpdate = true;
    this.geom.attributes.aSize.needsUpdate = true;
    this.geom.attributes.aAlpha.needsUpdate = true;
    this.geom.attributes.aColor.needsUpdate = true;
    if (alive === 0) this.n = 0;
  }
}

// ---------------------------------------------------------------------------

export class Game {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.hud = hud;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.12, 6000);
    this.camera.position.set(4, ROOF_Y + 2, 8);

    this.world = new World(this.renderer, this.scene);
    this.rig = new Rig(this.scene, this.world);
    this.audio = new Audio();

    this.mist = new Particles(this.scene, 420, false);
    this.stars = new Particles(this.scene, 420, true);

    this._buildHero();
    this._buildMarkers();

    this.state = 'title';
    this.t = 0;
    this.stateT = 0;
    this.cleanFrac = 0;
    this.stopIndex = 0;
    this.workerY = ROOF_Y + 0.95;
    this.workerX = ANCHOR_X;
    this.workerZ = -1.35;
    this.vel = 0;
    this.edgeT = 0;
    this.springV = 0; this.springY = 0;
    this.camPos = this.camera.position.clone();
    this.camLook = V(0, ROOF_Y, 0);
    this.camFov = 50;
    this.stillTime = 0;
    this.locked = false;
    this.revealT = 0;
    this.finaleT = 0;
    this.wind = 0.4;

    this._bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
  }

  // --- hero pane -----------------------------------------------------------

  _buildHero() {
    const mk = (res) => {
      const c = document.createElement('canvas');
      c.width = c.height = res;
      return c;
    };
    this.grimeCanvas = mk(GRIME_RES);
    this.grimeCtx = this.grimeCanvas.getContext('2d', { willReadFrequently: true });
    this.grimeTex = new THREE.CanvasTexture(this.grimeCanvas);
    this.grimeTex.colorSpace = THREE.SRGBColorSpace;
    this.grimeTex.anisotropy = 4;

    this.wetCanvas = mk(GRIME_RES);
    this.wetCtx = this.wetCanvas.getContext('2d');
    this.wetTex = new THREE.CanvasTexture(this.wetCanvas);
    this.wetTex.colorSpace = THREE.SRGBColorSpace;

    const heroGroup = new THREE.Group();
    this.scene.add(heroGroup);
    this.heroGroup = heroGroup;

    // Clean pane underneath: the same half-mirror coating as the rest of the
    // curtain wall, so a finished pane is indistinguishable from its neighbours.
    this.heroGlass = new THREE.Mesh(new THREE.BoxGeometry(GLASS_W, GLASS_H, 0.026), this.world.matGlass);
    heroGroup.add(this.heroGlass);

    this.grimeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(GLASS_W, GLASS_H),
      new THREE.MeshStandardMaterial({
        map: this.grimeTex, transparent: true, roughness: 0.92, metalness: 0,
        envMapIntensity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      })
    );
    this.grimeMesh.position.z = 0.0155;
    heroGroup.add(this.grimeMesh);

    this.wetMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(GLASS_W, GLASS_H),
      new THREE.MeshPhysicalMaterial({
        map: this.wetTex, transparent: true, roughness: 0.04, metalness: 0,
        envMapIntensity: 1.5, clearcoat: 1, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -3,
      })
    );
    this.wetMesh.position.z = 0.0175;
    heroGroup.add(this.wetMesh);

    // Glint sweep played when a pane comes clean.
    this.shineMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: -1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `
        varying vec2 vUv; uniform float uT;
        void main(){
          float d = vUv.x*0.55 + vUv.y*0.45;
          float w = 1.0 - smoothstep(0.0, 0.10, abs(d - uT));
          float edge = smoothstep(0.0,0.06,vUv.x)*smoothstep(0.0,0.06,1.0-vUv.x)
                     * smoothstep(0.0,0.06,vUv.y)*smoothstep(0.0,0.06,1.0-vUv.y);
          gl_FragColor = vec4(vec3(1.0,0.96,0.88) * w * edge, w*edge);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.shine = new THREE.Mesh(new THREE.PlaneGeometry(GLASS_W, GLASS_H), this.shineMat);
    this.shine.position.z = 0.02;
    this.shine.visible = false;
    heroGroup.add(this.shine);

    this.hitPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(GLASS_W + 0.14, GLASS_H + 0.14),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.hitPlane.position.z = 0.03;
    heroGroup.add(this.hitPlane);

    // A pulsing outline traced on the pane itself — clearer than a blob and
    // it does not hide the dirt the player is meant to see.
    this.paneMarkMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color(0xfff0a8) }, uA: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `
        varying vec2 vUv; uniform float uT; uniform vec3 uCol; uniform float uA;
        void main(){
          vec2 p = abs(vUv - 0.5) * 2.0;
          float d = max(p.x, p.y);
          float pulse = 0.5 + 0.5 * sin(uT * 3.4);
          float band = smoothstep(0.86, 0.93, d) * smoothstep(1.0, 0.96, d);
          float run = smoothstep(0.03, 0.0, abs(fract(vUv.x * 0.5 + vUv.y * 0.5 - uT * 0.22) - 0.5));
          gl_FragColor = vec4(uCol, (band * (0.45 + pulse * 0.55) + band * run * 0.5) * uA);
        }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    this.paneMark = new THREE.Mesh(new THREE.PlaneGeometry(GLASS_W + 0.12, GLASS_H + 0.12), this.paneMarkMat);
    this.paneMark.position.z = 0.05;
    this.paneMark.renderOrder = 21;
    this.paneMark.visible = false;
    heroGroup.add(this.paneMark);

    const G = 20;
    this.gridN = G;
    this.dirt = new Float32Array(G * G);
    this.wet = new Float32Array(G * G);
  }

  _buildMarkers() {
    // Pulsing ring used for every "touch here" prompt.
    const ringMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color(0xfff0a8) } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `
        varying vec2 vUv; uniform float uT; uniform vec3 uCol;
        void main(){
          float r = length(vUv-0.5)*2.0;
          float p = fract(uT);
          float ring = smoothstep(0.05,0.0,abs(r - (0.35+p*0.6))) * (1.0-p) * 0.75;
          float core = smoothstep(0.40,0.30,r)*0.10;
          float a = ring + core;
          gl_FragColor = vec4(uCol, a);
        }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    this.markerMat = ringMat;
    this.marker = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat);
    this.marker.renderOrder = 20;
    this.marker.visible = false;
    this.scene.add(this.marker);

    // Chevrons that fall down the facade to say "go down".
    const chevMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `
        varying vec2 vUv; uniform float uT;
        float chev(vec2 p){ float d = abs(p.x)*1.05 + p.y; return smoothstep(0.10,0.0,abs(d))*step(abs(p.x),0.5); }
        void main(){
          float a = 0.0;
          for(int i=0;i<3;i++){
            float f = fract(uT + float(i)*0.333);
            a += chev(vec2(vUv.x-0.5, (vUv.y-0.15) - (1.0-f)*0.62)) * (1.0-abs(f*2.0-1.0));
          }
          gl_FragColor = vec4(vec3(1.0,0.93,0.72), a*0.85);
        }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    this.chevMat = chevMat;
    this.chev = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.6), chevMat);
    this.chev.renderOrder = 20;
    this.chev.visible = false;
    this.scene.add(this.chev);

    // Finale rainbow.
    const rbMat = new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `
        varying vec2 vUv; uniform float uA;
        vec3 spec(float t){ return 0.55 + 0.45*cos(6.2831*(t*0.85 + vec3(0.0,0.33,0.67))); }
        void main(){
          vec2 p = vec2((vUv.x-0.5)*2.0, vUv.y);
          float r = length(vec2(p.x, p.y*0.98));
          float band = smoothstep(0.72,0.78,r)*smoothstep(1.0,0.94,r);
          float fade = smoothstep(0.0,0.25,vUv.y);
          vec3 c = spec((r-0.78)/0.16);
          gl_FragColor = vec4(c, band*fade*uA*0.55);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.rainbowMat = rbMat;
    this.rainbow = new THREE.Mesh(new THREE.PlaneGeometry(900, 460), rbMat);
    this.rainbow.position.set(-40, 30, -700);
    this.rainbow.visible = false;
    this.scene.add(this.rainbow);
  }

  // --- lifecycle -----------------------------------------------------------

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.aspect = w / h;
    this.portrait = this.aspect < 1.0;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  start() {
    this.audio.unlock();
    this.audio.startMusic();
    this.setState('harness');
  }

  reset() {
    this.stopIndex = 0;
    this._stopReady = -1;
    this._connected = false;
    this.workerY = ROOF_Y + 0.95;
    this.workerX = ANCHOR_X;
    this.workerZ = -1.35;
    this.vel = 0; this.edgeT = 0; this.locked = false;
    this.springY = 0; this.springV = 0;
    this.rig.hang = 0; this.rig.lean = 0;
    this.rig.buckles = [0, 0, 0];
    this.rig.descenderAttached = 0;
    this.rig.tool = 'none'; this.rig.toolPoint = null;
    this.world.cleanY.value = ROOF_Y + 400;
    this.world.setHiddenPane(-1, -1);
    this.rainbow.visible = false;
    this.rainbowMat.uniforms.uA.value = 0;
    this.paneMark.visible = false;
    this.audio.rope(0); this.audio.squeegee(0, false);
    this.hud.setStars(0);
    this.hud.setProgress(0);
    this.setState('harness');
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
    this._hold = 0;
    this.hud.setHint(
      s === 'harness' ? 'tap' :
      s === 'connect' ? 'drag' :
      s === 'edge' ? 'swipe' :
      s === 'descend' ? 'swipe' :
      s === 'spray' ? 'spray' :
      s === 'wipe' ? 'wipe' :
      s === 'finale' ? 'replay' : 'none'
    );
    if (s === 'spray') { this.rig.tool = 'spray'; }
    else if (s === 'wipe') { this.rig.tool = 'squeegee'; }
    else if (s !== 'reveal') { this.rig.tool = 'none'; this.rig.toolPoint = null; }
    if (s === 'descend' || s === 'spray') this._prepareStop();
    if (s === 'finale') this._startFinale();
  }

  _prepareStop() {
    if (this._stopReady === this.stopIndex) return;
    this._stopReady = this.stopIndex;
    const floor = STOP_FLOORS[this.stopIndex];
    const px = paneX(HERO_BAY), py = paneY(floor);
    this.heroGroup.position.set(px, py, GLASS_Z);
    this.world.setHiddenPane(HERO_BAY, floor);

    drawGrime(this.grimeCtx, GRIME_RES, 11 + this.stopIndex * 7);
    this.grimeTex.needsUpdate = true;
    this.wetCtx.clearRect(0, 0, GRIME_RES, GRIME_RES);
    this.wetTex.needsUpdate = true;
    this.dirt.fill(1); this.wet.fill(0);
    this.grimeMesh.material.opacity = 1;
    this.wetMesh.material.opacity = 1;
    this.grimeMesh.visible = true;
    this.wetMesh.visible = true;
    this.shine.visible = false;
    this.cleanFrac = 0; this.wetFrac = 0;
    this.targetY = py + 0.15;
  }

  _startFinale() {
    this.finaleT = 0;
    this.grimeMesh.visible = false;
    this.wetMesh.visible = false;
    this.shine.visible = false;
    this.rainbow.visible = true;
    this.world.cleanY.value = 0;
    this.audio.fanfare();
    this.hud.setStars(5);
  }

  // --- input ---------------------------------------------------------------

  _bindInput() {
    const c = this.canvas;
    this.ptr = { down: false, x: 0, y: 0, px: 0, py: 0, dx: 0, dy: 0, moved: 0, t: 0 };
    const pos = (e) => {
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX, y: t.clientY };
    };
    const down = (e) => {
      e.preventDefault();
      if (!this.audio.ready) { this.audio.unlock(); this.audio.startMusic(); }
      const p = pos(e);
      this.ptr.down = true; this.ptr.x = this.ptr.px = p.x; this.ptr.y = this.ptr.py = p.y;
      this.ptr.dx = this.ptr.dy = 0; this.ptr.moved = 0;
      this.onDown(p.x, p.y);
    };
    const move = (e) => {
      e.preventDefault();
      const p = pos(e);
      if (!this.ptr.down) { this.ptr.x = p.x; this.ptr.y = p.y; return; }
      const mx = p.x - this.ptr.x, my = p.y - this.ptr.y;
      this.ptr.dx += mx; this.ptr.dy += my;
      this.ptr.moved += Math.hypot(mx, my);
      this.ptr.x = p.x; this.ptr.y = p.y;
      this.onMove(p.x, p.y);
    };
    const up = (e) => {
      e.preventDefault();
      if (this.ptr.down) this.onUp();
      this.ptr.down = false;
      this.ptr.dx = this.ptr.dy = 0;
    };
    c.addEventListener('pointerdown', down, { passive: false });
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up, { passive: false });
    window.addEventListener('pointercancel', up, { passive: false });
    c.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _ndc(x, y) {
    return new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  }

  /** Screen distance to a world point, in CSS pixels. */
  _screenDist(world, x, y) {
    const p = world.clone().project(this.camera);
    const sx = (p.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-p.y * 0.5 + 0.5) * window.innerHeight;
    return Math.hypot(sx - x, sy - y);
  }

  onDown(x, y) {
    if (this.state === 'harness') {
      this._tapBuckle(x, y);
    } else if (this.state === 'connect') {
      this.dragging = true;
    } else if (this.state === 'spray' || this.state === 'wipe') {
      this._paint(x, y, true);
    } else if (this.state === 'descend') {
      this.stillTime = 0;
    } else if (this.state === 'finale') {
      if (this.stateT > 4.0) this.reset();
    }
  }

  onMove(x, y) {
    if (this.state === 'connect') {
      this.rig.descenderAttached = clamp(this.rig.descenderAttached + Math.max(0, this.ptr.moved) * 0.0, 0, 1);
    } else if (this.state === 'spray' || this.state === 'wipe') {
      this._paint(x, y, false);
    }
  }

  onUp() {
    this.lastPaint = null;
    if (this.state === 'wipe') this.audio.squeegee(0, false);
    // A plain tap still pays out a little rope, so a player who only taps
    // never gets stuck.
    if (this.state === 'descend' && this.ptr.moved < 14) {
      this.vel = Math.max(this.vel, 0.85);
      this.stillTime = 0;
      this.audio.rope(0.85);
    }
  }

  _tapBuckle(x, y) {
    let best = -1, bestD = 110;
    for (let i = 0; i < 3; i++) {
      if (this.rig.buckles[i] > 0.5) continue;
      const w = this.rig.buckleMeshes[i].getWorldPosition(new THREE.Vector3());
      const d = this._screenDist(w, x, y);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0) {
      this.rig.buckles[best] = 1;
      this.audio.click(1.15, 1.0);
      this.audio.chime(best + 2, 0.28, 0.7);
      const w = this.rig.buckleMeshes[best].getWorldPosition(new THREE.Vector3());
      for (let i = 0; i < 16; i++) {
        this.stars.emit(w, V((Math.random() - 0.5) * 0.5, Math.random() * 0.4, (Math.random() - 0.5) * 0.5),
          0.5 + Math.random() * 0.4, 0.035, [1.0, 0.92, 0.6], 0.4);
      }
    }
  }

  // --- cleaning ------------------------------------------------------------

  _paneHit(x, y) {
    const rc = new THREE.Raycaster();
    rc.setFromCamera(this._ndc(x, y), this.camera);
    const hit = rc.intersectObject(this.hitPlane, false)[0];
    return hit || null;
  }

  _paint(x, y, isDown) {
    const hit = this._paneHit(x, y);
    if (!hit) { this.lastPaint = null; return; }
    const u = clamp(hit.uv.x, 0, 1), v = clamp(hit.uv.y, 0, 1);
    const cx = u * GRIME_RES, cy = (1 - v) * GRIME_RES;
    this.rig.toolPoint = hit.point.clone();
    this.rig.lean = clamp((hit.point.x - paneX(HERO_BAY)) * 0.9, -0.75, 0.75);

    if (this.state === 'spray') this._spray(cx, cy, hit.point, isDown);
    else this._wipe(cx, cy, hit.point, isDown);
    this.lastPaint = { cx, cy, p: hit.point.clone() };
  }

  _gridAdd(arr, cx, cy, radPx, amount, cap) {
    const G = this.gridN, cell = GRIME_RES / G;
    const r = radPx / cell;
    const gx = cx / cell, gy = cy / cell;
    const i0 = Math.max(0, Math.floor(gx - r)), i1 = Math.min(G - 1, Math.ceil(gx + r));
    const j0 = Math.max(0, Math.floor(gy - r)), j1 = Math.min(G - 1, Math.ceil(gy + r));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(i + 0.5 - gx, j + 0.5 - gy) / Math.max(0.001, r);
        if (d > 1) continue;
        const w = 1 - d * d * 0.6;
        const k = j * G + i;
        arr[k] = cap > 0 ? Math.min(cap, arr[k] + amount * w) : Math.max(0, arr[k] + amount * w);
      }
    }
  }

  /**
   * Mean of a grid, optionally ignoring the outermost ring. The border of the
   * pane sits under the gasket, so missing it must never block completion.
   */
  _coverage(arr, skipBorder) {
    const G = this.gridN;
    const a = skipBorder ? 1 : 0;
    let s = 0, n = 0;
    for (let j = a; j < G - a; j++) {
      for (let i = a; i < G - a; i++) { s += arr[j * G + i]; n++; }
    }
    return n ? s / n : 0;
  }

  _gridSample(arr, cx, cy) {
    const G = this.gridN, cell = GRIME_RES / G;
    const i = clamp(Math.floor(cx / cell), 0, G - 1);
    const j = clamp(Math.floor(cy / cell), 0, G - 1);
    return arr[j * G + i];
  }

  _spray(cx, cy, world, isDown) {
    const now = performance.now();
    if (isDown || now - (this._lastHiss || 0) > 230) { this.audio.spray(); this._lastHiss = now; }

    const ctx = this.wetCtx;
    const R = 30;
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, 'rgba(214,238,250,0.42)');
    g.addColorStop(0.55, 'rgba(200,230,248,0.24)');
    g.addColorStop(1, 'rgba(190,225,245,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    // a few discrete droplets so the film is not a uniform blob
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * 7, d = Math.random() * R * 1.15;
      const dx = cx + Math.cos(a) * d, dy = cy + Math.sin(a) * d;
      ctx.fillStyle = 'rgba(226,246,255,0.5)';
      ctx.beginPath(); ctx.arc(dx, dy, 1.4 + Math.random() * 2.6, 0, 7); ctx.fill();
    }
    this.wetTex.needsUpdate = true;

    this._gridAdd(this.wet, cx, cy, R * 1.25, 0.55, 1);
    // Softening the grime while wet reads as the dirt loosening.
    this._gridAdd(this.dirt, cx, cy, R, -0.02, 0);

    this.wetFrac = this._coverage(this.wet, false);

    // Mist particles from the nozzle toward the glass.
    const nz = this.rig.sprayNozzleWorld;
    for (let i = 0; i < 3; i++) {
      const from = nz ? nz.clone() : world.clone().add(V(0, 0.3, 0.35));
      const dir = world.clone().sub(from).normalize();
      this.mist.emit(
        from.add(V((Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.03, 0)),
        dir.multiplyScalar(1.6 + Math.random()).add(V((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.4, 0)),
        0.35 + Math.random() * 0.25, 0.055, [0.72, 0.88, 1.0], 1.4
      );
    }

    // Hold in the spray step for a few seconds even if the pane wets fast —
    // spraying is half the fun.
    if (this.wetFrac > 0.55 && this.stateT > 3.5) {
      this.audio.click(1.4, 0.6);
      this._floodWet();
      this.setState('wipe');
    }
  }

  /**
   * The water she has thrown at the pane runs together into one film. Without
   * this, a patch the player never sprayed could never be squeegeed clean.
   */
  _floodWet() {
    const ctx = this.wetCtx;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(206,234,250,0.22)';
    ctx.fillRect(0, 0, GRIME_RES, GRIME_RES);
    this.wetTex.needsUpdate = true;
    for (let i = 0; i < this.wet.length; i++) this.wet[i] = Math.max(this.wet[i], 0.5);
  }

  _wipe(cx, cy, world, isDown) {
    const last = this.lastPaint;
    let dx = 0, dy = 0, dist = 0;
    if (last && !isDown) { dx = cx - last.cx; dy = cy - last.cy; dist = Math.hypot(dx, dy); }
    const wetHere = this._gridSample(this.wet, cx, cy);
    this.audio.squeegee(clamp(dist / 12, 0, 1.4), wetHere > 0.25);

    // Blade stays perpendicular to the stroke, like a real pull.
    if (dist > 2) this.rig.bladeRoll = Math.atan2(dy, dx);

    if (dist < 0.6 && !isDown) return;
    if (wetHere < 0.22) {
      // dry glass: it only smears, which is the lesson
      if (dist > 2 && Math.random() < 0.3) this.audio.pop();
      return;
    }

    const ctx = this.grimeCtx;
    const BLADE = 62;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const a = last ? last.cx : cx, b = last ? last.cy : cy;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = BLADE * 1.28;
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(cx, cy); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = BLADE;
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(cx, cy); ctx.stroke();
    ctx.restore();
    this.grimeTex.needsUpdate = true;

    // The water goes with it, leaving a dry edge behind the blade.
    const wctx = this.wetCtx;
    wctx.save();
    wctx.globalCompositeOperation = 'destination-out';
    wctx.lineCap = 'round';
    wctx.strokeStyle = 'rgba(0,0,0,0.95)';
    wctx.lineWidth = BLADE;
    wctx.beginPath(); wctx.moveTo(a, b); wctx.lineTo(cx, cy); wctx.stroke();
    wctx.restore();
    this.wetTex.needsUpdate = true;

    this._gridAdd(this.dirt, cx, cy, BLADE * 0.68, -0.85, 0);
    this._gridAdd(this.wet, cx, cy, BLADE * 0.68, -0.9, 0);

    const frac = 1 - this._coverage(this.dirt, true);
    if (frac > this.cleanFrac + 0.05) {
      this.audio.chime(Math.min(9, Math.floor(frac * 9)), 0.16, 0.6);
    }
    this.cleanFrac = Math.max(this.cleanFrac, frac);
    this.hud.setProgress(this.cleanFrac);

    // Dirty water runs off the blade.
    if (dist > 3) {
      for (let i = 0; i < 2; i++) {
        this.mist.emit(
          world.clone().add(V((Math.random() - 0.5) * 0.3, -0.02, 0.02)),
          V((Math.random() - 0.5) * 0.3, -0.2 - Math.random() * 0.4, 0.05 + Math.random() * 0.1),
          0.6 + Math.random() * 0.4, 0.03, [0.55, 0.8, 0.95], 3.2
        );
      }
    }

    if (this.cleanFrac > 0.84) this._finishPane();
  }

  _finishPane() {
    this.setState('reveal');
    this.revealT = 0;
    this.audio.squeegee(0, false);
    this.audio.sparkleRun(7, 2);
    this.audio.lock();
    this.shine.visible = true;
    this.shineMat.uniforms.uT.value = -0.2;
    const c = this.heroGroup.position;
    for (let i = 0; i < 90; i++) {
      const p = V(c.x + (Math.random() - 0.5) * GLASS_W, c.y + (Math.random() - 0.5) * GLASS_H, c.z + 0.05);
      this.stars.emit(p, V((Math.random() - 0.5) * 0.7, 0.15 + Math.random() * 0.9, 0.2 + Math.random() * 0.5),
        0.9 + Math.random() * 0.8, 0.05 + Math.random() * 0.04, [1.0, 0.95, 0.75], 0.25);
    }
    this.hud.setStars(this.stopIndex + 1);
    this.hud.setProgress(0);
  }

  // --- per-frame -----------------------------------------------------------

  update(dt) {
    this.t += dt;
    this.stateT += dt;
    const s = this.state;

    if (s === 'harness') this._updHarness(dt);
    else if (s === 'connect') this._updConnect(dt);
    else if (s === 'edge') this._updEdge(dt);
    else if (s === 'descend') this._updDescend(dt);
    else if (s === 'spray' || s === 'wipe') this._updClean(dt);
    else if (s === 'reveal') this._updReveal(dt);
    else if (s === 'finale') this._updFinale(dt);

    // Rope stretch after a lock-off.
    this.springV += -this.springY * 90 * dt;
    this.springV *= Math.exp(-4.5 * dt);
    this.springY += this.springV * dt;

    const anchor = this.world.anchorPoint;
    const lip = this.world.ropeLipPoint;
    this.rig.wallZ = GLASS_FRONT;
    this.rig.update(dt, {
      pos: V(this.workerX, this.workerY + this.springY, this.workerZ),
      anchor, lip, speed: Math.abs(this.vel), wind: this.wind,
    });

    this.world.update(dt, this.camera, this.workerY);
    this.mist.update(dt);
    this.stars.update(dt);
    this.markerMat.uniforms.uT.value = this.t * 1.25;
    this.chevMat.uniforms.uT.value = this.t * 0.8;
    this._updCamera(dt);
  }

  _updHarness(dt) {
    const done = this.rig.buckles.every((b) => b > 0.5);
    // Point at the next buckle to close.
    const idx = this.rig.buckles.findIndex((b) => b < 0.5);
    if (idx >= 0) {
      const w = this.rig.buckleMeshes[idx].getWorldPosition(new THREE.Vector3());
      this.marker.visible = true;
      this.marker.position.copy(w).add(V(0, 0, 0.16));
      this.marker.scale.setScalar(0.44);
      this.marker.quaternion.copy(this.camera.quaternion);
    } else {
      this.marker.visible = false;
    }
    if (done && this.stateT > 0.5) this.setState('connect');
  }

  _updConnect(dt) {
    const ringW = new THREE.Vector3(0, -0.012, -0.045);
    this.rig.group.localToWorld(ringW);
    this.marker.visible = true;
    this.marker.position.copy(ringW).add(V(0, 0, 0.14));
    this.marker.scale.setScalar(0.40);
    this.marker.quaternion.copy(this.camera.quaternion);

    if (this.ptr.down) {
      // Any drag hauls the connector down onto the ring; holding still works too.
      const gain = Math.abs(this.ptr.dy) * 0.005 + Math.abs(this.ptr.dx) * 0.004 + dt * 0.35;
      this.rig.descenderAttached = clamp(this.rig.descenderAttached + gain, 0, 1);
      this.ptr.dy = 0; this.ptr.dx = 0;
    }
    if (this.rig.descenderAttached >= 1 && !this._connected) {
      this._connected = true;
      this._hold = 0.75;
      this.audio.click(0.7, 1.0);
      this.audio.sparkleRun(4, 4);
      const w = ringW.clone();
      for (let i = 0; i < 24; i++) {
        this.stars.emit(w, V((Math.random() - 0.5) * 0.6, Math.random() * 0.5, (Math.random() - 0.5) * 0.6),
          0.6, 0.04, [1, 0.9, 0.65], 0.5);
      }
    }
    if (this._connected && this._hold > 0) {
      this._hold -= dt;
      if (this._hold <= 0) this.setState('edge');
    }
  }

  _updEdge(dt) {
    this.marker.visible = false;
    // Chevrons hanging just past the coping: this is where you are going.
    this.chev.visible = true;
    this.chev.position.set(ANCHOR_X, ROOF_Y + 0.45, 0.62);
    this.chev.scale.set(0.72, 1.05, 1);
    this.chev.quaternion.copy(this.camera.quaternion);

    if (this.ptr.down && this.ptr.dy > 0) {
      this.edgeT = clamp(this.edgeT + this.ptr.dy / window.innerHeight * 1.5, 0, 1);
      this.ptr.dy = 0;
    }
    this.edgeT = clamp(this.edgeT + dt * (this.edgeT > 0.02 ? 0.22 : 0), 0, 1);

    const k = smoothstep(this.edgeT);
    // Roof stance -> over the coping -> hanging free on the face.
    const p0 = V(ANCHOR_X, ROOF_Y + 0.95, -1.35);
    const p1 = V(ANCHOR_X, ROOF_Y + 1.02, 0.28);
    const p2 = V(ANCHOR_X, ROOF_Y - 0.55, 0.52);
    const p3 = V(ANCHOR_X, ROOF_Y - 1.9, WORKER_Z);
    const c = new THREE.CatmullRomCurve3([p0, p1, p2, p3]).getPoint(k);
    this.workerX = c.x; this.workerY = c.y; this.workerZ = c.z;
    this.rig.hang = smoothstep(clamp((this.edgeT - 0.18) / 0.6, 0, 1));
    this.rig.lean = 0;
    if (this.edgeT > 0.05) this.audio.rope(clamp(this.edgeT * 2, 0, 1) * 0.8);
    if (this.edgeT >= 1) {
      this.audio.rope(0);
      this.audio.lock();
      this.chev.visible = false;
      this.springY = 0.05; this.springV = 0;
      this.setState('descend');
    }
  }

  _updDescend(dt) {
    this.rig.hang = 1;
    this.rig.lean *= Math.exp(-3 * dt);
    this.marker.visible = false;

    const target = this.targetY;
    // Falling chevrons over the next pane to clean.
    this.chev.visible = true;
    this.chev.position.set(paneX(HERO_BAY) + 0.1, paneY(STOP_FLOORS[this.stopIndex]) + 1.1, GLASS_FRONT + 0.25);
    this.chev.scale.set(1.0, 1.5, 1);
    this.chev.lookAt(this.camera.position.x, this.chev.position.y, this.camera.position.z);

    let input = 0;
    if (this.ptr.down) {
      if (this.ptr.dy > 0) { input = this.ptr.dy / window.innerHeight; this.stillTime = 0; }
      else this.stillTime += dt;
      this.ptr.dy = 0;
    } else {
      this.stillTime += dt;
    }

    const targetV = clamp(input / Math.max(dt, 0.008) * 2.2, 0, 2.1);
    if (targetV > this.vel) this.vel = lerp(this.vel, targetV, 1 - Math.exp(-14 * dt));
    else this.vel = lerp(this.vel, this.stillTime > 0.10 ? 0 : targetV, 1 - Math.exp(-11 * dt));

    // Ease off as the pane comes into reach so nobody overshoots.
    const remain = this.workerY - target;
    const brake = clamp(remain / 1.2, 0.12, 1);
    const v = this.vel * brake;
    this.workerY -= v * dt;
    this.audio.rope(v);

    if (v > 0.25) {
      // wind streaks rushing up past the worker
      if (Math.random() < v * 0.5) {
        this.mist.emit(
          V(this.workerX + (Math.random() - 0.5) * 3.2, this.workerY - 2 - Math.random() * 2, 0.6 + Math.random() * 1.6),
          V(0, 2.5 + Math.random() * 3, 0), 0.5, 0.02, [0.8, 0.9, 1.0], 0
        );
      }
    }

    if (this.workerY <= target + 0.02) {
      this.workerY = target;
      if (!this.locked) {
        this.locked = true;
        this.vel = 0;
        this._hold = 0.45;
        this.audio.rope(0);
        this.audio.lock();
        this.springY = -0.075; this.springV = 0.6;
        this.chev.visible = false;
      }
    }
    if (this.locked && this._hold > 0) {
      this._hold -= dt;
      if (this._hold <= 0) this.setState('spray');
    }
  }

  _updClean(dt) {
    this.rig.hang = 1;
    this.locked = false;
    this.chev.visible = false;
    this.marker.visible = false;
    this.paneMark.visible = true;
    this.paneMarkMat.uniforms.uT.value = this.t;
    this.paneMarkMat.uniforms.uA.value = 1;
    this.paneMarkMat.uniforms.uCol.value.setHex(this.state === 'spray' ? 0x9fe4ff : 0xfff0a8);
    const hp = this.heroGroup.position;

    // The worker rides up and down with her own hands, like the real job.
    if (this.rig.toolPoint) {
      const want = clamp(this.rig.toolPoint.y - 0.20, hp.y - 0.62, hp.y + 0.62);
      this.workerY = lerp(this.workerY, want, 1 - Math.exp(-3.4 * dt));
    }
    this.workerX = lerp(this.workerX, ANCHOR_X + this.rig.lean * 0.22, 1 - Math.exp(-3 * dt));
    this.workerZ = lerp(this.workerZ, WORKER_Z, 1 - Math.exp(-3 * dt));
    if (!this.ptr.down) this.audio.squeegee(0, false);
  }

  _updReveal(dt) {
    this.revealT += dt;
    const k = this.revealT;
    const fade = clamp(1 - k / 0.55, 0, 1);
    this.grimeMesh.material.opacity = fade;
    this.wetMesh.material.opacity = fade;
    if (fade <= 0) { this.grimeMesh.visible = false; this.wetMesh.visible = false; }
    this.shineMat.uniforms.uT.value = -0.2 + k * 1.1;
    if (k > 1.5) this.shine.visible = false;
    this.marker.visible = false;
    this.chev.visible = false;
    this.paneMarkMat.uniforms.uA.value = clamp(1 - k * 2.5, 0, 1);
    if (k > 0.4) this.paneMark.visible = false;

    // The clean line sweeps down past the pane just finished.
    const targetClean = paneY(STOP_FLOORS[this.stopIndex]) - 1.5;
    this.world.cleanY.value = lerp(this.world.cleanY.value, targetClean, 1 - Math.exp(-2.2 * dt));

    this.rig.toolPoint = null;
    this.rig.lean *= Math.exp(-2 * dt);
    this.workerX = lerp(this.workerX, ANCHOR_X, 1 - Math.exp(-2 * dt));

    if (k > 2.6) {
      this.stopIndex++;
      if (this.stopIndex >= STOP_FLOORS.length) this.setState('finale');
      else { this._prepareStop(); this.locked = false; this.setState('descend'); }
    }
  }

  _updFinale(dt) {
    this.finaleT += dt;
    this.rig.hang = 1;
    this.rainbowMat.uniforms.uA.value = clamp(this.finaleT / 2.2, 0, 1);
    this.rainbow.position.set(this.camera.position.x - 120, 40, this.camera.position.z - 780);
    this.rainbow.lookAt(this.camera.position.x, 40, this.camera.position.z);
    this.marker.visible = false;
    this.chev.visible = false;
    this.paneMark.visible = false;
    // Confetti of light rising up the newly clean facade.
    if (Math.random() < 0.7) {
      this.stars.emit(
        V(paneX(HERO_BAY) + (Math.random() - 0.5) * 20, this.workerY - 10 + Math.random() * 16, 0.4 + Math.random() * 2),
        V((Math.random() - 0.5) * 0.4, 1.2 + Math.random() * 1.8, 0.1),
        2.2, 0.06, [1.0, 0.93, 0.72], -0.05
      );
    }
    if (this.finaleT > 4.0) this.hud.setHint('replay');
  }

  // --- camera --------------------------------------------------------------

  _camPose() {
    const wx = this.workerX, wy = this.workerY, wz = this.workerZ;
    const P = this.portrait;
    const wide = P ? 1.30 : 1.0;
    switch (this.state) {
      case 'title': {
        // Slow establishing orbit: roof kit, the anchor, and the drop beyond.
        const a = this.t * 0.075;
        return {
          pos: V(wx + Math.sin(a) * 5.0 + 1.4, ROOF_Y + 3.2, Math.cos(a) * 4.0 + 7.5),
          look: V(wx - 0.6, ROOF_Y + 0.5, -2.0),
          fov: P ? 60 : 50,
        };
      }
      // She rigs up facing away from the edge — the way it is really done —
      // so the camera works from in front of her to keep the buckles in view.
      case 'harness':
        return { pos: V(wx + 0.74 * wide, wy + 0.34, wz - 1.52 * wide), look: V(wx, wy - 0.16, wz), fov: P ? 46 : 40 };
      case 'connect':
        return { pos: V(wx + 0.56 * wide, wy + 0.22, wz - 1.28 * wide), look: V(wx, wy - 0.10, wz), fov: P ? 44 : 38 };
      case 'edge': {
        // Swing around her right side as she goes over, opening onto the drop.
        const k = smoothstep(this.edgeT);
        const a = lerp(2.30, 0.52, k);
        const R = lerp(2.5, 7.2, k) * wide;
        return {
          pos: V(wx + Math.sin(a) * R, wy + lerp(0.75, 2.6, k), wz + Math.cos(a) * R),
          look: V(wx, wy - lerp(0.15, 1.5, k), wz * (1 - k)),
          fov: P ? 62 : 52,
        };
      }
      case 'descend':
        // Around 50 degrees off the face: the suspended posture reads in near
        // profile while the drop below stays in frame.
        return { pos: V(wx + 3.0 * wide, wy + 1.5, 3.0 * wide + 0.5), look: V(wx - 0.35, wy - 1.6, 0), fov: P ? 62 : 52 };
      case 'spray':
      case 'wipe': {
        const hp = this.heroGroup.position;
        return { pos: V(hp.x + 1.72 * wide, hp.y + 0.40, 2.25 * wide + 0.40), look: V(hp.x - 0.05, hp.y - 0.10, 0), fov: P ? 56 : 47 };
      }
      case 'reveal': {
        const hp = this.heroGroup.position;
        const k = smoothstep(clamp(this.revealT / 2.4, 0, 1));
        return {
          pos: V(hp.x + lerp(1.72, 2.6, k) * wide, hp.y + lerp(0.40, 1.1, k), lerp(2.25, 4.4, k) * wide + 0.40),
          look: V(hp.x, hp.y + 0.1, 0), fov: P ? 56 : 47,
        };
      }
      case 'finale': {
        const k = smoothstep(clamp(this.finaleT / 7.0, 0, 1));
        return {
          pos: V(wx + lerp(2.4, 24.0, k) * wide, lerp(this.workerY + 1.0, this.workerY + 15.0, k), lerp(3.4, 46.0, k) * wide),
          look: V(lerp(wx, 0.5, k), lerp(this.workerY - 0.8, this.workerY + 4.0, k), 0),
          fov: P ? 62 : 52,
        };
      }
      default:
        return { pos: V(wx + 3.0, wy + 1.2, 6.5), look: V(wx, wy - 1, 0), fov: 50 };
    }
  }

  _updCamera(dt) {
    if (this.camLock) {
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      return;
    }
    const t = this._camPose();
    const k = 1 - Math.exp(-3.2 * dt);
    this.camPos.lerp(t.pos, k);
    this.camLook.lerp(t.look, k);
    this.camFov = lerp(this.camFov, t.fov, k);
    // A gentle handheld drift keeps the height alive without wobbling the aim.
    const bx = Math.sin(this.t * 0.43) * 0.035 + Math.sin(this.t * 0.91) * 0.018;
    const by = Math.sin(this.t * 0.37 + 1.1) * 0.028;
    this.camera.position.set(this.camPos.x + bx, this.camPos.y + by, this.camPos.z);
    this.camera.lookAt(this.camLook);
    if (Math.abs(this.camera.fov - this.camFov) > 0.01) {
      this.camera.fov = this.camFov;
      this.camera.updateProjectionMatrix();
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /** Development helper: drop straight into a phase with the camera snapped. */
  debugJump(state, stopIndex = 0, wet = 0) {
    this.stopIndex = clamp(stopIndex, 0, STOP_FLOORS.length - 1);
    this._stopReady = -1;
    this.rig.buckles = [1, 1, 1];
    this.rig.descenderAttached = 1;
    this._connected = true;
    if (state === 'harness') { this.rig.buckles = [0, 0, 0]; this.rig.descenderAttached = 0; this._connected = false; }
    if (state === 'connect') { this.rig.descenderAttached = 0; this._connected = false; }
    const onRope = !['harness', 'connect', 'title'].includes(state);
    this.rig.hang = onRope ? 1 : 0;
    this.edgeT = onRope ? 1 : 0;
    if (onRope) {
      this._prepareStop();
      this.workerX = ANCHOR_X;
      this.workerZ = WORKER_Z;
      this.workerY = state === 'descend' ? this.targetY + 3.4 : this.targetY;
      this.world.cleanY.value = this.stopIndex > 0 ? paneY(STOP_FLOORS[this.stopIndex - 1]) - 1.5 : ROOF_Y + 400;
    } else {
      this.workerX = ANCHOR_X; this.workerY = ROOF_Y + 0.95; this.workerZ = -1.35;
    }
    if (wet > 0) {
      this.wetCtx.fillStyle = 'rgba(208,236,250,0.34)';
      this.wetCtx.fillRect(0, 0, GRIME_RES, GRIME_RES);
      this.wetTex.needsUpdate = true;
      this.wet.fill(wet);
    }
    this.setState(state);
    const p = this._camPose();
    this.camPos.copy(p.pos); this.camLook.copy(p.look); this.camFov = p.fov;
    this.camera.fov = p.fov; this.camera.updateProjectionMatrix();
    this.camera.position.copy(p.pos); this.camera.lookAt(p.look);
    this.world.update(0.016, this.camera, this.workerY);
  }
}
