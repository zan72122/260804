// ---------------------------------------------------------------------------
// The world: HDR sky, city below, and the tower itself.
//
// The tower is a unitised curtain wall. Near the worker it is built from real
// extruded aluminium profiles — snap-cap mullions with a reveal groove,
// transoms with a drip nose, recessed glass behind an EPDM gasket, precast
// spandrels with a shadow gap. Further away it falls back to a textured shell
// that matches the same grid, so the eye reads one continuous building.
// ---------------------------------------------------------------------------

import * as THREE from '../vendor/three/three.module.js';
import * as T from './textures.js';
import { xf, mergeGeoms, beveledBox, extrudeProfile, frameGeom, lathe, roundedRect, pbr, repeated } from './geom.js';

export const FLOOR = 3.5;          // floor-to-floor
export const BAY = 1.5;            // curtain wall module width
export const BAY_COUNT = 14;
export const FLOORS = 44;
export const ROOF_Y = FLOORS * FLOOR;          // 154 m
export const FRONT_X0 = -14.25;                // left corner
export const CORNER_X = FRONT_X0 + BAY_COUNT * BAY;  // right corner, +6.75
export const DEPTH = 24;                       // building depth (front to back)
export const GLASS_Z = -0.03;
export const GLASS_W = 1.36;
export const GLASS_H = 2.24;
export const GLASS_YC = 1.42;                  // glass centre above the floor line
// The drop is set two and a half bays in from the right-hand corner, so the
// corner and the sky beyond it stay in frame and the face reads in perspective.
export const HERO_BAY = 11;
export const HERO_X = FRONT_X0 + BAY * HERO_BAY + BAY / 2;   // 3.0
export const ANCHOR_X = HERO_X + 0.34;                       // rope line
const NEAR_FLOORS = 12;

export const paneX = (bay) => FRONT_X0 + BAY * bay + BAY / 2;
export const paneY = (floor) => floor * FLOOR + GLASS_YC;

// --- profile extrusion helpers ---------------------------------------------

/** Extrude a cross-section given as world [x, z] pairs along the Y axis. */
function alongY(profile, len) {
  const g = extrudeProfile(profile.map((p) => [p[0], -p[1]]), len);
  return xf(g, { rot: [-Math.PI / 2, 0, 0] });
}
/** Extrude a cross-section given as world [z, y] pairs along the X axis. */
function alongX(profile, len) {
  const g = extrudeProfile(profile.map((p) => [-p[0], p[1]]), len);
  return xf(g, { rot: [0, Math.PI / 2, 0] });
}

// Snap-cap mullion: proud cap face, reveal groove, pressure-plate flange,
// structural back tube. Cross-section in [x, z].
const MULLION = [
  [-0.0335, 0.032], [0.0335, 0.032], [0.0375, 0.026], [0.0375, 0.008],
  [0.0300, 0.004], [0.0300, -0.002], [0.0475, -0.008], [0.0475, -0.020],
  [0.0400, -0.028], [0.0400, -0.185], [-0.0400, -0.185], [-0.0400, -0.028],
  [-0.0475, -0.020], [-0.0475, -0.008], [-0.0300, -0.002], [-0.0300, 0.004],
  [-0.0375, 0.008], [-0.0375, 0.026],
];

// Transom with a drip nose that throws a hard shadow onto the glass below.
const TRANSOM = [
  [0.030, 0.056], [0.030, -0.046], [0.048, -0.056], [0.026, -0.066],
  [-0.150, -0.066], [-0.150, 0.066], [-0.026, 0.066], [0.030, 0.050],
];

// Sloped sill flashing that sheds water clear of the spandrel below.
const SILL = [
  [0.070, -0.004], [0.074, -0.014], [0.058, -0.022], [-0.030, -0.030], [-0.030, -0.008],
];

// ---------------------------------------------------------------------------

export class World {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.cleanY = { value: ROOF_Y + 400 };   // everything below this line is grimy
    this.time = 0;
    this._bandBase = -1;
    this.hiddenPane = null;
    this._buildSky();
    this._buildMaterials();
    this._buildCity();
    this._buildTower();
    this._buildRoof();
    this._buildClouds();
  }

  // --- sky & light ---------------------------------------------------------

  _buildSky() {
    const skyTex = T.makeSkyTexture(1024, 512);
    this.skyTex = skyTex;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    this.envRT = pmrem.fromEquirectangular(skyTex);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    // Visible dome: basic material so tone mapping handles the sun's HDR value.
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(4200, 48, 32),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false, fog: false })
    );
    dome.renderOrder = -1000;
    this.scene.add(dome);
    this.dome = dome;

    const sun = T.sunDirection();
    this.sunDir = sun;
    const key = new THREE.DirectionalLight(0xffd7ac, 2.6);
    key.position.copy(sun).multiplyScalar(120);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 90;
    const s = 7.5;
    key.shadow.camera.left = -s; key.shadow.camera.right = s;
    key.shadow.camera.top = s; key.shadow.camera.bottom = -s;
    key.shadow.bias = -0.0012;
    key.shadow.normalBias = 0.022;
    this.scene.add(key, key.target);
    this.sun = key;

    // Bounce off the city below — keeps shadowed sides from going dead.
    const bounce = new THREE.HemisphereLight(0x9fc4ee, 0x6d6357, 0.55);
    this.scene.add(bounce);

    this.scene.fog = new THREE.FogExp2(0xb9c2c4, 0.00160);
  }

  // --- materials -----------------------------------------------------------

  _buildMaterials() {
    const alu = T.aluminiumMaps(512);
    this.matAlu = pbr(alu, { envMapIntensity: 1.0 });
    this.matAlu.map = repeated(alu.map, 1, 6);
    this.matAlu.normalMap = repeated(alu.normalMap, 1, 6);
    this.matAlu.roughnessMap = this.matAlu.metalnessMap = repeated(alu.rmMap, 1, 6);
    this.matAlu.normalScale.set(0.6, 0.6);

    const con = T.concreteMaps(512);
    this.matSpandrel = pbr(con, { envMapIntensity: 0.75, color: 0x8b8d8a });
    this.aluMaps = alu; this.conMaps = con;

    this.matGasket = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.86, metalness: 0.0 });
    this.matInterior = new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.9, metalness: 0.0 });

    // Glass is a half-mirror: a dark tinted coating with a strong specular
    // return, so a clean pane genuinely throws the sky back at you.
    this.matGlass = new THREE.MeshPhysicalMaterial({
      color: 0x93aabe, metalness: 0.94, roughness: 0.055,
      envMapIntensity: 1.45, clearcoat: 0.5, clearcoatRoughness: 0.05,
    });

    // Grime is its own translucent layer in front of the glass — the same
    // construction as the pane the player scrubs — and dissolves above the
    // clean line as the worker descends.
    const grime = T.makeTexSet(256, (u, v, o) => {
      const film = T.fbm(u * 5, v * 5, 4, 3);
      const dust = T.fbm(u * 22, v * 22, 4, 8);
      const run = T.clamp01((T.ridge(u * 22, v * 1.2, 3, 12) - 0.60) * 2.6) * T.clamp01(1 - v * 0.45);
      const eu = Math.min(u, 1 - u), ev = Math.min(v, 1 - v);
      const edge = T.clamp01(1 - Math.min(eu, ev) * 9);
      o.a = T.clamp01(0.30 + (film - 0.5) * 0.32 + (dust - 0.5) * 0.18 + run * 0.36 + edge * 0.30);
      const l = 0.66 + (dust - 0.5) * 0.24 - run * 0.14;
      o.r = l * 0.99; o.g = l * 0.97; o.b = l * 0.93;
      o.h = 0.5; o.rough = 0.86; o.metal = 0;
    }, { normalStrength: 0.4 });
    this.grimeMaps = grime;
    this.matGrime = new THREE.MeshStandardMaterial({
      map: grime.map, roughnessMap: grime.rmMap,
      transparent: true, depthWrite: false, roughness: 1, metalness: 0,
      envMapIntensity: 0.55, polygonOffset: true, polygonOffsetFactor: -2,
    });
    this._injectCleanLine(this.matGrime, 0xffffff, 1.0, true);

    // The distant shell repeats the same rhythm at lower cost.
    this.shellMaps = T.towerFacadeTexture(512, { cols: 8, rows: 8, tint: [0.30, 0.40, 0.50], lit: 0.05, seed: 4 });
    this.matShell = pbr(this.shellMaps, { envMapIntensity: 1.15 });
    this._injectCleanLine(this.matShell, 0x243a4e, 0.07);
  }

  /**
   * Injects a world-space clean line into a standard/physical material:
   * above `uCleanY` the surface becomes a dark low-roughness mirror, below it
   * keeps its grime map. A soft 2.5 m band keeps the transition from banding.
   */
  _injectCleanLine(mat, cleanColor, cleanRough, fadeAlpha) {
    const col = new THREE.Color(cleanColor);
    mat.userData.cleanY = this.cleanY;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uCleanY = this.cleanY;
      shader.uniforms.uCleanCol = { value: col };
      shader.uniforms.uCleanRough = { value: cleanRough };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vWY;')
        .replace('#include <begin_vertex>',
          '#include <begin_vertex>\nvec4 cwp = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\ncwp = instanceMatrix * cwp;\n#endif\nvWY = (modelMatrix * cwp).y;');
      shader.fragmentShader = shader.fragmentShader
        // color_fragment runs before roughnessmap_fragment, so cleanMix is
        // declared there and reused downstream.
        .replace('#include <color_fragment>',
          '#include <color_fragment>\nfloat cleanMix = smoothstep(uCleanY - 1.6, uCleanY + 1.1, vWY);\n'
          + (fadeAlpha ? 'diffuseColor.a *= (1.0 - cleanMix);'
                       : 'diffuseColor.rgb = mix(diffuseColor.rgb, uCleanCol, cleanMix);'))
        .replace('#include <common>', '#include <common>\nvarying float vWY;\nuniform float uCleanY;\nuniform vec3 uCleanCol;\nuniform float uCleanRough;')
        .replace('#include <roughnessmap_fragment>',
          fadeAlpha ? '#include <roughnessmap_fragment>'
                    : '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, uCleanRough, cleanMix);');
      mat.userData.shader = shader;
    };
    mat.customProgramCacheKey = () => 'cleanline';
  }

  // --- city ----------------------------------------------------------------

  _buildCity() {
    const g = new THREE.Group();

    const groundMaps = T.cityGroundMaps(512);
    const gm = pbr(groundMaps, { envMapIntensity: 0.7 });
    gm.map = repeated(groundMaps.map, 10, 10);
    gm.normalMap = repeated(groundMaps.normalMap, 10, 10);
    gm.roughnessMap = gm.metalnessMap = repeated(groundMaps.rmMap, 10, 10);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(5200, 5200), gm);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -300);
    g.add(ground);

    // Neighbouring towers: three families so the skyline is not one repeat.
    const fams = [
      { tex: T.towerFacadeTexture(256, { cols: 6, rows: 10, tint: [0.34, 0.42, 0.50], lit: 0.10, seed: 11 }), n: 76 },
      { tex: T.towerFacadeTexture(256, { cols: 5, rows: 8, tint: [0.46, 0.42, 0.38], lit: 0.14, seed: 27 }), n: 70 },
      { tex: T.towerFacadeTexture(256, { cols: 7, rows: 12, tint: [0.28, 0.34, 0.44], lit: 0.07, seed: 53 }), n: 60 },
    ];
    let seed = 1;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    for (const f of fams) {
      const mat = pbr(f.tex, { envMapIntensity: 1.0 });
      const geo = beveledBox(1, 1, 1, 0.02);
      const im = new THREE.InstancedMesh(geo, mat, f.n);
      const m = new THREE.Matrix4();
      let placed = 0, guard = 0;
      while (placed < f.n && guard++ < 4000) {
        const a = rnd() * Math.PI * 2;
        const r = 46 + Math.pow(rnd(), 0.85) * 1500;
        const x = Math.cos(a) * r, z = Math.sin(a) * r - 140;
        if (Math.abs(x + 3.75) < 22 && Math.abs(z + 12) < 24) continue; // keep our plot clear
        const h = 16 + Math.pow(rnd(), 2.1) * 128;
        const w = 14 + rnd() * 30, d = 14 + rnd() * 30;
        m.compose(
          new THREE.Vector3(x, h / 2, z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.round(rnd() * 4) * Math.PI / 2 + (rnd() - 0.5) * 0.2, 0)),
          new THREE.Vector3(w, h, d)
        );
        im.setMatrixAt(placed++, m);
      }
      im.count = placed;
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false;
      g.add(im);
    }
    this.scene.add(g);
    this.city = g;
  }

  // --- tower ---------------------------------------------------------------

  _buildTower() {
    const tower = new THREE.Group();
    this.scene.add(tower);
    this.tower = tower;

    // --- distant shell -----------------------------------------------------
    const shellFront = new THREE.Mesh(new THREE.PlaneGeometry(BAY * BAY_COUNT, ROOF_Y), this.matShell.clone());
    this._shellMat(shellFront.material, BAY_COUNT / 8 * 2, FLOORS / 8);
    shellFront.position.set(FRONT_X0 + BAY * BAY_COUNT / 2, ROOF_Y / 2, -0.21);
    shellFront.receiveShadow = true;
    tower.add(shellFront);

    const mkSide = (x, sign) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(DEPTH, ROOF_Y), this.matShell.clone());
      this._shellMat(m.material, DEPTH / BAY / 8 * 2, FLOORS / 8);
      m.position.set(x, ROOF_Y / 2, -DEPTH / 2);
      m.rotation.y = sign * Math.PI / 2;
      m.receiveShadow = true;
      tower.add(m);
      return m;
    };
    mkSide(CORNER_X, Math.PI / 2 > 0 ? 1 : 1);
    mkSide(FRONT_X0, -1);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(BAY * BAY_COUNT, ROOF_Y), this.matShell.clone());
    this._shellMat(back.material, BAY_COUNT / 8 * 2, FLOORS / 8);
    back.position.set(FRONT_X0 + BAY * BAY_COUNT / 2, ROOF_Y / 2, -DEPTH);
    back.rotation.y = Math.PI;
    tower.add(back);

    // A crisp corner post so the two faces meet in a real edge, not a seam.
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, ROOF_Y, 0.20),
      new THREE.MeshStandardMaterial({ color: 0x8d959c, roughness: 0.34, metalness: 1.0, envMapIntensity: 1.1 })
    );
    post.position.set(CORNER_X - 0.09, ROOF_Y / 2, -0.09);
    post.castShadow = true;
    tower.add(post);
    const post2 = post.clone();
    post2.position.set(FRONT_X0 + 0.1, ROOF_Y / 2, -0.1);
    tower.add(post2);

    // --- near band ---------------------------------------------------------
    const bayGeoms = this._bayGeometry();
    const total = NEAR_FLOORS * BAY_COUNT;
    this.band = {};
    const mk = (geo, mat, shadow) => {
      const im = new THREE.InstancedMesh(geo, mat, total);
      im.frustumCulled = false;
      im.castShadow = !!shadow;
      im.receiveShadow = true;
      tower.add(im);
      return im;
    };
    this.band.alu = mk(bayGeoms.alu, this.matAlu, true);
    this.band.spandrel = mk(bayGeoms.spandrel, this.matSpandrel, true);
    this.band.gasket = mk(bayGeoms.gasket, this.matGasket, false);
    this.band.interior = mk(bayGeoms.interior, this.matInterior, false);
    this.band.glass = mk(bayGeoms.glass, this.matGlass, false);
    this.band.grime = mk(bayGeoms.grime, this.matGrime, false);
    this.band.grime.renderOrder = 2;
    this.setBand(FLOORS - NEAR_FLOORS);
  }

  _shellMat(m, rx, ry) {
    m.map = repeated(this.shellMaps.map, rx, ry);
    m.normalMap = repeated(this.shellMaps.normalMap, rx, ry);
    m.roughnessMap = m.metalnessMap = repeated(this.shellMaps.rmMap, rx, ry);
    m.onBeforeCompile = this.matShell.onBeforeCompile;
    m.customProgramCacheKey = this.matShell.customProgramCacheKey;
    m.needsUpdate = true;
  }

  /** One curtain-wall module, split by material. */
  _bayGeometry() {
    const alu = [];
    // vertical mullion on the module's left edge, full storey height
    alu.push(xf(alongY(MULLION, FLOOR), { pos: [-BAY / 2, FLOOR / 2, 0] }));
    // head and sill transoms
    alu.push(xf(alongX(TRANSOM, BAY), { pos: [0, GLASS_YC + GLASS_H / 2 + 0.07, 0] }));
    alu.push(xf(alongX(TRANSOM, BAY), { pos: [0, GLASS_YC - GLASS_H / 2 - 0.07, 0] }));
    // sill flashing under the vision glass
    alu.push(xf(alongX(SILL, BAY - 0.09), { pos: [0, GLASS_YC - GLASS_H / 2 - 0.135, 0] }));
    // setting blocks visible in the reveal
    for (const sx of [-0.36, 0.36]) {
      alu.push(xf(beveledBox(0.09, 0.022, 0.05, 0.004), { pos: [sx, GLASS_YC - GLASS_H / 2 - 0.014, -0.03] }));
    }

    const gasket = [xf(frameGeom(GLASS_W + 0.075, GLASS_H + 0.075, 0.038, 0.026, 0.004), { pos: [0, GLASS_YC, GLASS_Z + 0.019] })];

    const spandrelY = GLASS_YC + GLASS_H / 2 + 0.14 + 0.40;
    const spandrel = [xf(beveledBox(BAY - 0.10, 0.80, 0.055, 0.008), { pos: [0, spandrelY, -0.055] })];
    // shadow-gap backing so the panel joint reads as a real gap
    const interior = [
      xf(new THREE.BoxGeometry(BAY, 0.90, 0.02), { pos: [0, spandrelY, -0.115] }),
      xf(new THREE.BoxGeometry(GLASS_W + 0.05, GLASS_H, 0.02), { pos: [0, GLASS_YC, -0.42] }),
      xf(new THREE.BoxGeometry(GLASS_W + 0.05, 0.26, 0.30), { pos: [0, GLASS_YC + GLASS_H / 2 - 0.13, -0.28] }),
    ];

    const glass = [xf(new THREE.BoxGeometry(GLASS_W, GLASS_H, 0.026), { pos: [0, GLASS_YC, GLASS_Z] })];
    const grime = [xf(new THREE.PlaneGeometry(GLASS_W, GLASS_H), { pos: [0, GLASS_YC, GLASS_Z + 0.0155] })];

    return {
      alu: mergeGeoms(alu),
      gasket: mergeGeoms(gasket),
      spandrel: mergeGeoms(spandrel),
      interior: mergeGeoms(interior),
      glass: mergeGeoms(glass),
      grime: mergeGeoms(grime),
    };
  }

  /** Slide the detailed band so it always surrounds the worker. */
  setBand(baseFloor) {
    baseFloor = Math.max(0, Math.min(FLOORS - NEAR_FLOORS, Math.round(baseFloor)));
    if (baseFloor === this._bandBase) return;
    this._bandBase = baseFloor;
    const m = new THREE.Matrix4();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const h = this.hiddenPane;
    let i = 0;
    for (let f = 0; f < NEAR_FLOORS; f++) {
      const floor = baseFloor + f;
      for (let b = 0; b < BAY_COUNT; b++) {
        m.makeTranslation(paneX(b), floor * FLOOR, 0);
        for (const k of ['alu', 'spandrel', 'gasket', 'interior']) this.band[k].setMatrixAt(i, m);
        // The pane being worked on is replaced by a dedicated, paintable one.
        const hidden = (h && h.bay === b && h.floor === floor) ? zero : m;
        this.band.glass.setMatrixAt(i, hidden);
        this.band.grime.setMatrixAt(i, hidden);
        i++;
      }
    }
    for (const k of ['alu', 'spandrel', 'gasket', 'interior', 'glass', 'grime']) this.band[k].instanceMatrix.needsUpdate = true;
  }

  setHiddenPane(bay, floor) {
    this.hiddenPane = { bay, floor };
    const b = this._bandBase;
    this._bandBase = -1;
    this.setBand(b < 0 ? FLOORS - NEAR_FLOORS : b);
  }

  // --- roof ----------------------------------------------------------------

  _buildRoof() {
    const g = new THREE.Group();
    g.position.y = ROOF_Y;
    this.scene.add(g);
    this.roof = g;

    const W = BAY * BAY_COUNT, CX = FRONT_X0 + W / 2;
    const roofMaps = T.concreteMaps(256);
    const matRoof = pbr(roofMaps, { color: 0xb9b5ac, envMapIntensity: 0.85 });
    matRoof.map = repeated(roofMaps.map, 4, 4);
    matRoof.normalMap = repeated(roofMaps.normalMap, 4, 4);
    matRoof.roughnessMap = matRoof.metalnessMap = repeated(roofMaps.rmMap, 4, 4);

    const paveMaps = T.pavingMaps(512);
    const matPave = pbr(paveMaps, { color: 0xc6c9c6, envMapIntensity: 0.8 });
    matPave.map = repeated(paveMaps.map, 7, 8);
    matPave.normalMap = repeated(paveMaps.normalMap, 7, 8);
    matPave.roughnessMap = matPave.metalnessMap = repeated(paveMaps.rmMap, 7, 8);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(W, 0.4, DEPTH), matPave);
    deck.position.set(CX, -0.2, -DEPTH / 2);
    deck.receiveShadow = true;
    g.add(deck);

    // Parapet: upstand + metal coping with drip edges on both sides.
    const matCoping = new THREE.MeshStandardMaterial({ color: 0x9aa1a6, roughness: 0.36, metalness: 1.0, envMapIntensity: 1.15 });
    const COPING = [
      [0.20, 0.60], [0.20, 0.545], [0.16, 0.53], [-0.16, 0.53], [-0.20, 0.545],
      [-0.20, 0.60], [-0.235, 0.60], [-0.235, 0.50], [-0.19, 0.47], [0.19, 0.47], [0.235, 0.50], [0.235, 0.60],
    ];
    const upstand = new THREE.Mesh(new THREE.BoxGeometry(W, 1.02, 0.30), matRoof);
    upstand.position.set(CX, 0.51, -0.15);
    upstand.castShadow = true; upstand.receiveShadow = true;
    g.add(upstand);
    const coping = new THREE.Mesh(alongX(COPING, W), matCoping);
    coping.position.set(CX, 0.5, -0.15);
    coping.castShadow = true; coping.receiveShadow = true;
    g.add(coping);
    this.copingTopY = ROOF_Y + 1.1;

    // Side parapets for silhouette.
    for (const [x, rotY] of [[CORNER_X - 0.15, Math.PI / 2], [FRONT_X0 + 0.15, -Math.PI / 2]]) {
      const u = new THREE.Mesh(new THREE.BoxGeometry(DEPTH, 1.02, 0.30), matRoof);
      u.position.set(x, 0.51, -DEPTH / 2); u.rotation.y = rotY;
      u.castShadow = true; u.receiveShadow = true; g.add(u);
      const c = new THREE.Mesh(alongX(COPING, DEPTH), matCoping);
      c.position.set(x, 0.5, -DEPTH / 2); c.rotation.y = rotY;
      c.castShadow = true; g.add(c);
    }
    const backU = new THREE.Mesh(new THREE.BoxGeometry(W, 1.02, 0.30), matRoof);
    backU.position.set(CX, 0.51, -DEPTH + 0.15); backU.castShadow = true; g.add(backU);

    // Rooftop plant: air handling units with real louvre blades.
    const matPaint = pbr(T.paintedMetalMaps(256, [0.40, 0.44, 0.47]), { envMapIntensity: 1.0 });
    const matPaint2 = pbr(T.paintedMetalMaps(256, [0.62, 0.60, 0.52]), { envMapIntensity: 1.0 });
    const ahu = (x, z, w, h, d, mat) => {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(beveledBox(w, h, d, 0.03), mat);
      body.castShadow = body.receiveShadow = true;
      grp.add(body);
      // louvres
      const bladeGeo = beveledBox(w * 0.68, 0.06, 0.10, 0.008);
      for (let i = 0; i < 7; i++) {
        const b = new THREE.Mesh(bladeGeo, matCoping);
        b.position.set(0, -h / 2 + 0.25 + i * 0.13, d / 2 + 0.02);
        b.rotation.x = -0.5;
        b.castShadow = true;
        grp.add(b);
      }
      // curb
      const curb = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.22, d + 0.3), matRoof);
      curb.position.y = -h / 2 - 0.1;
      curb.receiveShadow = true; curb.castShadow = true;
      grp.add(curb);
      grp.position.set(x, h / 2 + 0.22, z);
      g.add(grp);
      return grp;
    };
    ahu(-9.5, -5.5, 3.2, 1.9, 2.2, matPaint);
    ahu(-4.4, -9.0, 4.2, 2.3, 2.6, matPaint2);
    ahu(2.0, -14.0, 3.0, 1.7, 2.0, matPaint);

    // Stair bulkhead
    const bulk = new THREE.Mesh(beveledBox(4.4, 3.0, 3.6, 0.05), matRoof);
    bulk.position.set(-11.0, 1.5, -16.0);
    bulk.castShadow = bulk.receiveShadow = true;
    g.add(bulk);

    // Ducting between plant items
    const duct = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 5.6, 18), matCoping);
    duct.rotation.z = Math.PI / 2;
    duct.position.set(-7.0, 1.5, -7.2);
    duct.castShadow = true;
    g.add(duct);

    this._buildAnchor(g);
  }

  /** Rope anchor: bolted base plate, post, curved davit arm, shackle. */
  _buildAnchor(parent) {
    const grp = new THREE.Group();
    grp.position.set(ANCHOR_X - 1.35, 0, -2.85);
    parent.add(grp);
    this.anchorGroup = grp;

    const steel = new THREE.MeshStandardMaterial({ color: 0xb6bcc0, roughness: 0.28, metalness: 1.0, envMapIntensity: 1.25 });
    const paint = pbr(T.paintedMetalMaps(256, [0.85, 0.32, 0.16]), { envMapIntensity: 1.0 });

    const base = new THREE.Mesh(beveledBox(0.52, 0.05, 0.52, 0.006), steel);
    base.position.y = 0.025; base.castShadow = base.receiveShadow = true; grp.add(base);
    for (const [bx, bz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.05, 6), steel);
      bolt.position.set(bx, 0.07, bz); bolt.castShadow = true; grp.add(bolt);
      const wash = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.008, 12), steel);
      wash.position.set(bx, 0.054, bz); grp.add(wash);
    }
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 1.05, 20), paint);
    post.position.y = 0.575; post.castShadow = true; grp.add(post);
    // gussets
    for (let i = 0; i < 4; i++) {
      const gsz = new THREE.Mesh(beveledBox(0.02, 0.26, 0.16, 0.004), paint);
      gsz.position.set(Math.cos(i * Math.PI / 2) * 0.10, 0.18, Math.sin(i * Math.PI / 2) * 0.10);
      gsz.rotation.y = -i * Math.PI / 2;
      gsz.castShadow = true; grp.add(gsz);
    }
    // curved arm reaching out over the parapet
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.05, 0),
      new THREE.Vector3(0, 1.42, 0.20),
      new THREE.Vector3(0, 1.55, 0.72),
      new THREE.Vector3(0, 1.50, 1.28),
    ]);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 20, 0.052, 12), paint);
    arm.castShadow = true; grp.add(arm);
    const tip = new THREE.Mesh(lathe([[0, -0.05], [0.07, -0.04], [0.075, 0.02], [0.05, 0.05], [0, 0.055]], 18), steel);
    tip.position.set(0, 1.50, 1.30); tip.castShadow = true; grp.add(tip);
    // shackle the rope hangs from
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.017, 10, 22, Math.PI * 1.55), steel);
    shackle.position.set(0, 1.40, 1.30); shackle.rotation.z = Math.PI * 0.22; shackle.rotation.y = Math.PI / 2;
    shackle.castShadow = true; grp.add(shackle);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.17, 10), steel);
    pin.position.set(0, 1.335, 1.30); pin.rotation.x = Math.PI / 2; grp.add(pin);

    this.anchorPoint = new THREE.Vector3(ANCHOR_X - 1.35, ROOF_Y + 1.33, -1.55);

    // Rope pad / roller protector where the line crosses the coping.
    const rollerGrp = new THREE.Group();
    rollerGrp.position.set(ANCHOR_X, 1.10, -0.03);
    parent.add(rollerGrp);
    const frame = new THREE.Mesh(beveledBox(0.44, 0.05, 0.42, 0.006), steel);
    frame.castShadow = true; rollerGrp.add(frame);
    const rubber = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.75, metalness: 0 });
    for (const rz of [-0.13, 0.0, 0.13]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.40, 16), rubber);
      r.rotation.z = Math.PI / 2; r.position.set(0, 0.06, rz);
      r.castShadow = true; rollerGrp.add(r);
    }
    this.ropeLipPoint = new THREE.Vector3(ANCHOR_X, ROOF_Y + 1.17, 0.09);

    // A coiled rope bag, because the rest of the line has to live somewhere.
    const bagMat = new THREE.MeshStandardMaterial({ color: 0xd8523c, roughness: 0.82, metalness: 0 });
    const bag = new THREE.Mesh(lathe([[0, 0], [0.19, 0], [0.21, 0.06], [0.21, 0.46], [0.18, 0.52], [0, 0.53]], 20), bagMat);
    bag.position.set(ANCHOR_X - 2.1, 0, -2.5);
    bag.castShadow = bag.receiveShadow = true;
    parent.add(bag);
  }

  // --- clouds --------------------------------------------------------------

  _buildClouds() {
    const S = 256;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = x / S, v = y / S;
        let d = T.fbm(u * 4.5, v * 4.5, 5, 3);
        const r = Math.hypot(u - 0.5, (v - 0.5) * 1.7) * 2;
        d = T.clamp01((d - 0.34) * 2.2) * T.clamp01(1 - r * 1.15);
        const i = (y * S + x) * 4;
        const lit = 0.86 + T.clamp01(0.5 - v) * 0.3;
        img.data[i] = 255 * lit; img.data[i + 1] = 250 * lit; img.data[i + 2] = 244 * lit;
        img.data[i + 3] = T.clamp01(d * 1.6) * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true, opacity: 0.9 });
    this.clouds = [];
    let s = 7;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = 0; i < 14; i++) {
      const w = 90 + rnd() * 220;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * (0.42 + rnd() * 0.2)), mat);
      const a = rnd() * Math.PI * 2, r = 180 + rnd() * 900;
      m.position.set(Math.cos(a) * r, 40 + rnd() * 110, Math.sin(a) * r - 100);
      m.renderOrder = -500;
      m.userData.drift = 0.9 + rnd() * 1.6;
      this.scene.add(m);
      this.clouds.push(m);
    }
  }

  // --- per-frame -----------------------------------------------------------

  update(dt, camera, focusY) {
    this.time += dt;
    for (const c of this.clouds) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 1200) c.position.x -= 2400;
      c.lookAt(camera.position.x, c.position.y, camera.position.z);
    }
    this.dome.position.copy(camera.position);
    // Keep the shadow frustum tight around whatever the player is looking at.
    const t = this.sun.target;
    t.position.set(0.4, focusY, 0.2);
    t.updateMatrixWorld();
    this.sun.position.set(0.4 + this.sunDir.x * 40, focusY + this.sunDir.y * 40, 0.2 + this.sunDir.z * 40);
    this.setBand(Math.round(focusY / FLOOR) - 7);
  }
}
