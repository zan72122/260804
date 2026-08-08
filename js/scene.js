// The workshop. Everything here is real geometry in a perspective space:
// a far wall with daylight coming through a side window, mid-ground vats and
// hanging cloths, and the frame with the kain in the near ground.

import { M4, V3, clamp, damp } from './math.js';
import { DepthTarget, RenderTarget } from './gl.js';
import * as G from './geo.js';
import {
  SCENE_VS, SCENE_FS, DEPTH_VS, DEPTH_FS, CLOTH_VS, CLOTH_FS,
  LIQUID_VS, LIQUID_FS, PARTICLE_VS, PARTICLE_FS,
  SKY_FS, POST_FS, BRIGHT_FS, BLUR_FS, FSQUAD_VS,
} from './shaders.js';

export const WORLD = {
  clothSize: 1.2,
  clothRestCentre: [0, 1.95, 0],
  clothTopY: 2.55,
  barY: 2.68,
  vatRadius: 0.86,
  vatHeight: 0.88,
  liquidY: 0.74,
  vatSlots: { left: -1.62, right: 1.62, centre: 0, away: 3.9 },
  lorodY: 1.06,
};

const SUN_DIR = (() => {
  const d = V3.create(-0.66, 0.60, 0.45);
  return V3.norm(d, d);
})();

export class Camera {
  constructor() {
    this.pos = V3.create(0, 1.9, 4.2);
    this.target = V3.create(0, 1.9, 0);
    this.fov = 40 * Math.PI / 180;
    this.near = 0.1;
    this.far = 40;
    this.view = M4.create();
    this.proj = M4.create();
    this.vp = M4.create();
    this.invVP = M4.create();
    this.aspect = 1;
  }

  update(aspect) {
    this.aspect = aspect;
    M4.lookAt(this.view, this.pos, this.target, [0, 1, 0]);
    M4.perspective(this.proj, this.fov, aspect, this.near, this.far);
    M4.multiply(this.vp, this.proj, this.view);
    M4.invert(this.invVP, this.vp);
  }

  // Screen point in [-1,1] NDC -> world ray.
  ray(ndcX, ndcY) {
    const a = V3.create(), b = V3.create();
    const p0 = new Float32Array([ndcX, ndcY, -1]);
    const p1 = new Float32Array([ndcX, ndcY, 1]);
    M4.transformPoint(a, this.invVP, p0);
    M4.transformPoint(b, this.invVP, p1);
    const dir = V3.norm(V3.create(), V3.sub(V3.create(), b, a));
    return { origin: a, dir };
  }

  // Distance needed so a box of the given size fits on screen.
  fitDistance(w, h) {
    const vy = h / 2 / Math.tan(this.fov / 2);
    const vx = w / 2 / (Math.tan(this.fov / 2) * this.aspect);
    return Math.max(vx, vy);
  }
}

class Prop {
  constructor(mesh) {
    this.mesh = mesh;
    this.model = M4.identity(M4.create());
    // Must start as identity: a prop that never gets a transform (the static
    // world mesh) would otherwise hand the shader an all-zero normal matrix.
    this.normalMat = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    this.visible = true;
    this.castShadow = true;
    this.dirty = true;
  }
  setTRS(t, r, s) {
    M4.fromTRS(this.model, t, r, typeof s === 'number' ? [s, s, s] : s);
    M4.normalFromMat4(this.normalMat, this.model);
  }
  place(m) {
    M4.copy(this.model, m);
    M4.normalFromMat4(this.normalMat, this.model);
  }
}

function segmentMatrix(out, a, b, radius, extra = 0) {
  const dir = V3.sub(V3.create(), b, a);
  const len = V3.len(dir) || 1e-5;
  V3.scale(dir, dir, 1 / len);
  const ref = Math.abs(dir[1]) > 0.95 ? V3.create(1, 0, 0) : V3.create(0, 1, 0);
  const x = V3.norm(V3.create(), V3.cross(V3.create(), ref, dir));
  const z = V3.norm(V3.create(), V3.cross(V3.create(), dir, x));
  const mid = V3.scale(V3.create(), V3.add(V3.create(), a, b), 0.5);
  out[0] = x[0] * radius; out[1] = x[1] * radius; out[2] = x[2] * radius; out[3] = 0;
  out[4] = dir[0] * (len + extra); out[5] = dir[1] * (len + extra); out[6] = dir[2] * (len + extra); out[7] = 0;
  out[8] = z[0] * radius; out[9] = z[1] * radius; out[10] = z[2] * radius; out[11] = 0;
  out[12] = mid[0]; out[13] = mid[1]; out[14] = mid[2]; out[15] = 1;
  return out;
}

// ---------------------------------------------------------------------------

export class Scene {
  constructor(renderer) {
    this.r = renderer;
    const gl = renderer.gl;
    this.gl = gl;
    this.time = 0;

    this.pScene = renderer.program('scene', SCENE_VS, SCENE_FS);
    this.pDepth = renderer.program('depth', DEPTH_VS, DEPTH_FS);
    this.pCloth = renderer.program('cloth', CLOTH_VS, CLOTH_FS);
    this.pLiquid = renderer.program('liquid', LIQUID_VS, LIQUID_FS);
    this.pParticle = renderer.program('particle', PARTICLE_VS, PARTICLE_FS);
    this.pSky = renderer.program('sky', FSQUAD_VS, SKY_FS);
    this.pPost = renderer.program('post', FSQUAD_VS, POST_FS);
    this.pBright = renderer.program('bright', FSQUAD_VS, BRIGHT_FS);
    this.pBlur = renderer.program('blur', FSQUAD_VS, BLUR_FS);

    this.shadow = new DepthTarget(gl, 1024);
    this.lightVP = M4.create();

    this.sceneRT = null;
    this.bloomA = null;
    this.bloomB = null;

    this.props = [];
    this.buildStatic();
    this.buildVessels();
    this.robot = new Robot(renderer);
    this.particles = new Particles(renderer, 900);

    this.ripples = new Float32Array(24);   // 6 x vec4
    this.rippleSlot = 0;

    this.revealGlow = 0;
    this.fogDensity = 0.046;
  }

  addProp(mesh) {
    const p = new Prop(mesh);
    this.props.push(p);
    return p;
  }

  // ---- static world --------------------------------------------------------

  buildStatic() {
    // Two meshes: the shell (room, walls, distant props) never casts shadows —
    // otherwise the near wall swallows the whole room in the shadow pass — and
    // the stage (frame, mat, stool) does, so the working area stays grounded.
    const shell = new G.GeoBuilder();
    const b = new G.GeoBuilder();
    const WOOD = [0.36, 0.22, 0.13];
    const DARKWOOD = [0.22, 0.14, 0.09];
    const BAMBOO = [0.62, 0.55, 0.30];
    const PLASTER = [0.235, 0.205, 0.170];

    // Floor: packed earth with a bamboo mat under the working area.
    shell.add(G.plane(24, 24, 1, 1), { matrix: G.xform([0, 0, 0]), color: [0.20, 0.155, 0.115], mat: 2 });
    b.add(G.box(5.2, 0.03, 3.4), { matrix: G.xform([0, 0.016, 0.6]), color: [0.36, 0.29, 0.18], mat: 10 });

    // Back wall with a doorway of light, and a left wall with the window.
    shell.add(G.box(13, 5.2, 0.24), { matrix: G.xform([0, 2.6, -3.6]), color: PLASTER, mat: 4 });
    // Left wall built around a tall window opening (x = -3.5).
    const wx = -3.5;
    shell.add(G.box(0.22, 5.2, 3.0), { matrix: G.xform([wx, 2.6, -2.1]), color: PLASTER, mat: 4 });
    shell.add(G.box(0.22, 5.2, 3.2), { matrix: G.xform([wx, 2.6, 2.3]), color: PLASTER, mat: 4 });
    shell.add(G.box(0.22, 1.5, 1.6), { matrix: G.xform([wx, 4.45, 0.0]), color: PLASTER, mat: 4 });
    shell.add(G.box(0.22, 1.1, 1.6), { matrix: G.xform([wx, 0.55, 0.0]), color: PLASTER, mat: 4 });
    // Daylight plane behind the opening.
    shell.add(G.plane(1.6, 2.3, 1, 1, 'xy'), {
      matrix: M4.multiply(M4.create(), G.xform([wx - 0.16, 2.25, 0]), G.xform([0, 0, 0], [0, Math.PI / 2, 0])),
      color: [2.9, 2.75, 2.3], mat: 12,
    });
    // Window bars.
    for (let i = 0; i < 3; i++) {
      shell.add(G.box(0.05, 2.3, 0.05), { matrix: G.xform([wx - 0.05, 2.25, -0.5 + i * 0.5]), color: DARKWOOD, mat: 1 });
    }
    // Foliage silhouettes just outside, to give the window some depth.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * 6.2;
      shell.add(G.sphere(0.34 + (i % 3) * 0.09, 10, 7), {
        matrix: G.xform([wx - 0.9 - (i % 2) * 0.4, 1.5 + Math.sin(a) * 0.9 + i * 0.15, -0.6 + Math.cos(a) * 0.9]),
        color: [0.20, 0.30, 0.16], mat: 6,
      });
    }

    // Ceiling beams overhead. They sit behind the frame so their shadows fall
    // on the far wall rather than banding across the kain.
    for (let i = 0; i < 4; i++) {
      shell.add(G.box(9.0, 0.17, 0.17), { matrix: G.xform([0, 4.35, -0.95 - i * 1.15]), color: DARKWOOD, mat: 1 });
    }

    // The gawangan: the frame the kain hangs on.
    for (const sx of [-1, 1]) {
      b.add(G.cylinder(0.062, 0.052, 3.1, 12), { matrix: G.xform([sx * 0.86, 1.55, -0.15]), color: BAMBOO, mat: 5 });
      b.add(G.box(0.42, 0.09, 0.52), { matrix: G.xform([sx * 0.86, 0.05, -0.15]), color: WOOD, mat: 1 });
      b.add(G.cylinder(0.055, 0.055, 0.5, 10), {
        matrix: M4.multiply(M4.create(), G.xform([sx * 0.86, 1.1, 0.02]), G.xform([0, 0, 0], [Math.PI / 2.4, 0, 0])),
        color: BAMBOO, mat: 5,
      });
    }
    b.add(G.cylinder(0.05, 0.05, 2.0, 12), {
      matrix: M4.multiply(M4.create(), G.xform([0, WORLD.barY, -0.15]), G.xform([0, 0, 0], [0, 0, Math.PI / 2])),
      color: BAMBOO, mat: 5,
    });
    for (const sx of [-1, 1]) {
      b.add(G.torus(0.07, 0.016, 12, 7), {
        matrix: M4.multiply(M4.create(), G.xform([sx * 0.95, WORLD.barY, -0.15]), G.xform([0, 0, 0], [0, 0, Math.PI / 2])),
        color: [0.55, 0.35, 0.16], mat: 3,
      });
    }
    // Little cords holding the cloth's top edge up to the bar.
    for (let i = -3; i <= 3; i++) {
      b.add(G.cylinder(0.008, 0.008, 0.20, 6), {
        matrix: M4.multiply(M4.create(), G.xform([i * 0.19, WORLD.barY - 0.05, -0.10]),
          G.xform([0, 0, 0], [-0.5, 0, 0])),
        color: [0.42, 0.36, 0.24], mat: 5,
      });
    }

    // Finished cloths drying in the background — mid ground, out of focus.
    const hangColors = [[0.13, 0.17, 0.29], [0.28, 0.17, 0.08], [0.20, 0.14, 0.20]];
    shell.add(G.cylinder(0.05, 0.05, 4.2, 10), {
      matrix: M4.multiply(M4.create(), G.xform([2.6, 3.0, -3.2]), G.xform([0, 0, 0], [0, 0, Math.PI / 2])),
      color: BAMBOO, mat: 5,
    });
    for (let i = 0; i < 3; i++) {
      const geo = G.plane(0.86, 1.9, 8, 12, 'xy');
      // Give the hanging cloths a lazy curve so they are not flat cards.
      for (let k = 0; k < geo.position.length; k += 3) {
        const yy = geo.position[k + 1], xx = geo.position[k];
        geo.position[k + 2] = Math.sin(xx * 3.4 + i) * 0.06 + Math.sin(yy * 1.6) * 0.04;
      }
      shell.add(geo, {
        matrix: G.xform([1.65 + i * 1.05, 1.98, -3.16 + (i % 2) * 0.16]),
        color: hangColors[i], mat: 8,
      });
    }

    // Stool, baskets, a jar of cloth — mid ground clutter with real footprints.
    b.add(G.cylinder(0.26, 0.30, 0.42, 14), { matrix: G.xform([-2.15, 0.21, 1.1]), color: WOOD, mat: 1 });
    shell.add(G.lathe([[0, 0], [0.30, 0.02], [0.36, 0.16], [0.30, 0.34], [0.24, 0.40], [0.26, 0.44], [0, 0.45]], 18),
      { matrix: G.xform([2.3, 0.0, 1.25]), color: [0.55, 0.44, 0.28], mat: 10 });
    shell.add(G.lathe([[0, 0], [0.22, 0.03], [0.30, 0.26], [0.22, 0.52], [0.16, 0.6], [0.18, 0.64], [0, 0.65]], 18),
      { matrix: G.xform([2.85, 0.0, 0.35]), color: [0.42, 0.26, 0.18], mat: 2 });

    this.shellProp = this.addProp(this.r.mesh(shell.build()));
    this.shellProp.castShadow = false;
    this.staticProp = this.addProp(this.r.mesh(b.build()));

    // Wax stove: a small brazier with a copper pan of molten wax.
    const s = new G.GeoBuilder();
    s.add(G.lathe([[0, 0], [0.28, 0.0], [0.30, 0.16], [0.24, 0.34], [0.26, 0.38], [0.20, 0.40], [0, 0.40]], 18),
      { color: [0.34, 0.20, 0.14], mat: 2 });
    s.add(G.disc(0.19, 18, 3), { matrix: G.xform([0, 0.30, 0]), color: [1, 1, 1], mat: 11 });
    s.add(G.lathe([[0, 0.42], [0.20, 0.44], [0.26, 0.56], [0.27, 0.60], [0.24, 0.60], [0.19, 0.50], [0, 0.47]], 20),
      { color: [0.72, 0.42, 0.18], mat: 3 });
    s.add(G.disc(0.20, 20, 3), { matrix: G.xform([0, 0.545, 0]), color: [0.80, 0.52, 0.16], mat: 12 });
    s.add(G.box(0.5, 0.06, 0.5), { matrix: G.xform([0, 0.03, 0]), color: [0.30, 0.22, 0.16], mat: 1 });
    // A little stand so the wax pan sits at working height, right next to the
    // frame: filling the canting has to be visible, it is the first link.
    s.add(G.cylinder(0.13, 0.17, 1.05, 12), { matrix: G.xform([0, -0.53, 0]), color: [0.30, 0.20, 0.13], mat: 1 });
    s.add(G.lathe([[0, 0], [0.30, 0.0], [0.32, 0.05], [0, 0.05]], 16),
      { matrix: G.xform([0, -1.03, 0]), color: [0.26, 0.18, 0.12], mat: 1 });
    this.stove = this.addProp(this.r.mesh(s.build()));
    this.stove.setTRS([-1.28, 1.06, 0.60], [0, 0.4, 0], 1);
    this.stovePos = V3.create(-1.28, 1.62, 0.60);
  }

  // ---- vats and pans -------------------------------------------------------

  buildVessels() {
    const R = WORLD.vatRadius, H = WORLD.vatHeight;
    // A straight-sided dyeing tub with a rolled rim, not a balloon.
    const profile = [
      [0, 0], [R * 0.58, 0], [R * 0.86, H * 0.05], [R * 0.96, H * 0.24],
      [R, H * 0.62], [R * 0.99, H * 0.93], [R * 1.05, H], [R * 0.95, H],
      [R * 0.90, H * 0.92], [R * 0.90, H * 0.30], [R * 0.78, H * 0.09],
      [R * 0.5, H * 0.06], [0, H * 0.06],
    ];
    const mk = (color) => {
      const b = new G.GeoBuilder();
      b.add(G.lathe(profile, 30), { color, mat: 2 });
      b.add(G.torus(R * 0.99, 0.035, 30, 8), { matrix: G.xform([0, H, 0]), color: [0.30, 0.20, 0.14], mat: 1 });
      return this.addProp(this.r.mesh(b.build()));
    };
    this.vatIndigo = mk([0.185, 0.105, 0.070]);
    this.vatSoga = mk([0.205, 0.115, 0.065]);

    const liquidMesh = this.r.mesh(G.toMeshData(G.disc(R * 0.90, 44, 10)));
    this.liquidIndigo = this.addProp(liquidMesh);
    this.liquidSoga = this.addProp(liquidMesh);
    this.liquidIndigo.castShadow = false;
    this.liquidSoga.castShadow = false;

    // The nglorod pan: wide, shallow, copper, over its own brazier.
    const p = new G.GeoBuilder();
    p.add(G.lathe([[0, 0], [0.58, 0.02], [0.68, 0.24], [0.71, 0.38], [0.75, 0.42],
      [0.70, 0.42], [0.65, 0.28], [0.56, 0.07], [0, 0.05]], 30),
      { color: [0.52, 0.30, 0.13], mat: 3 });
    p.add(G.lathe([[0, 0], [0.66, 0], [0.70, 0.09], [0.60, 0.14], [0, 0.14]], 22),
      { matrix: G.xform([0, -0.14, 0]), color: [0.22, 0.15, 0.11], mat: 2 });
    p.add(G.disc(0.55, 22, 3), { matrix: G.xform([0, -0.04, 0]), color: [1, 1, 1], mat: 11 });
    this.lorodPan = this.addProp(this.r.mesh(p.build()));
    this.lorodLiquid = this.addProp(this.r.mesh(G.toMeshData(G.disc(0.63, 40, 8))));
    this.lorodLiquid.castShadow = false;

    this.vatIndigo.setTRS([WORLD.vatSlots.left, 0, 0.15], [0, 0, 0], 1);
    this.vatSoga.setTRS([WORLD.vatSlots.right, 0, 0.15], [0, 0, 0], 1);
    this.lorodPan.setTRS([WORLD.vatSlots.away, 0.30, 0.35], [0, 0, 0], 1);
    this.lorodPan.visible = false;
    this.lorodLiquid.visible = false;
  }

  vatX(which) { return which === 'indigo' ? this._vatXi : this._vatXs; }

  layoutVessels(state, dt) {
    const S = WORLD.vatSlots;
    let xi = S.left, xs = S.right, xp = S.away;
    const py = 0.30;
    if (state.activeVat === 'indigo') { xi = S.centre; xs = S.right + 0.5; }
    if (state.activeVat === 'soga') { xs = S.centre; xi = S.left - 0.5; }
    if (state.lorodOut) { xp = 0; xi = S.left - 1.4; xs = S.right + 1.4; }
    this._vatXi = damp(this._vatXi === undefined ? xi : this._vatXi, xi, 3.0, dt);
    this._vatXs = damp(this._vatXs === undefined ? xs : this._vatXs, xs, 3.0, dt);
    this._panX = damp(this._panX === undefined ? xp : this._panX, xp, 3.0, dt);

    this.vatIndigo.setTRS([this._vatXi, 0, 0.15], [0, 0.3, 0], 1);
    this.vatSoga.setTRS([this._vatXs, 0, 0.15], [0, -0.2, 0], 1);
    this.liquidIndigo.setTRS([this._vatXi, WORLD.liquidY, 0.15], [0, 0, 0], 1);
    this.liquidSoga.setTRS([this._vatXs, WORLD.liquidY, 0.15], [0, 0, 0], 1);
    this.lorodPan.setTRS([this._panX, py, 0.35], [0, 0, 0], 1);
    this.lorodLiquid.setTRS([this._panX, py + 0.36, 0.35], [0, 0, 0], 1);
    this.lorodPan.visible = this.lorodLiquid.visible = Math.abs(this._panX) < 2.6;
  }

  addRipple(x, z, strength) {
    const i = (this.rippleSlot++ % 6) * 4;
    this.ripples[i] = x; this.ripples[i + 1] = strength;
    this.ripples[i + 2] = z; this.ripples[i + 3] = this.time;
  }

  // ---- render targets ------------------------------------------------------

  ensureTargets() {
    const gl = this.gl;
    const w = this.r.width, h = this.r.height;
    if (this.sceneRT && this.sceneRT.width === w && this.sceneRT.height === h) return;
    this.sceneRT = new RenderTarget(gl, w, h, { depth: true, float: this.r.colorBufferFloat });
    const bw = Math.max(2, w >> 2), bh = Math.max(2, h >> 2);
    this.bloomA = new RenderTarget(gl, bw, bh, {});
    this.bloomB = new RenderTarget(gl, bw, bh, {});
  }

  applyLighting(p) {
    const warm = 1.0;
    p.v3('uSunDir', SUN_DIR)
      .v3('uSunColor', 1.28 * warm, 1.04 * warm, 0.72 * warm)
      .v3('uSkyColor', 0.130, 0.132, 0.152)
      .v3('uGroundColor', 0.098, 0.070, 0.048)
      .v3('uFillDir', 0.62, 0.30, -0.72)
      .v3('uFillColor', 0.115, 0.115, 0.150)
      .v3('uFogColor', 0.105, 0.085, 0.072)
      .f('uFogDensity', this.fogDensity)
      .f('uTime', this.time);
    return p;
  }

  buildLightVP() {
    const centre = V3.create(0, 1.7, 0.1);
    const eye = V3.add(V3.create(), centre, V3.scale(V3.create(), SUN_DIR, 8));
    const view = M4.lookAt(M4.create(), eye, centre, [0, 1, 0]);
    const proj = M4.ortho(M4.create(), -3.4, 3.4, -3.4, 3.4, 1.0, 15);
    M4.multiply(this.lightVP, proj, view);
  }

  renderShadow(cloth, clothMesh) {
    const gl = this.gl;
    this.buildLightVP();
    this.shadow.bind();
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);
    const p = this.pDepth.use();
    const mvp = M4.create();
    for (const prop of this.props) {
      if (!prop.visible || !prop.castShadow) continue;
      M4.multiply(mvp, this.lightVP, prop.model);
      p.m4('uMVP', mvp);
      prop.mesh.draw();
    }
    for (const prop of this.robot.props) {
      if (!prop.visible || !prop.castShadow) continue;
      M4.multiply(mvp, this.lightVP, prop.model);
      p.m4('uMVP', mvp);
      prop.mesh.draw();
    }
    if (clothMesh) {
      gl.disable(gl.CULL_FACE);
      p.m4('uMVP', this.lightVP);
      clothMesh.draw();
      gl.enable(gl.CULL_FACE);
    }
    gl.cullFace(gl.BACK);
  }

  beginFrame(camera) {
    const gl = this.gl;
    this.ensureTargets();
    this.sceneRT.bind();
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    this.pSky.use()
      .v3('uTop', 0.10, 0.10, 0.13)
      .v3('uBottom', 0.30, 0.24, 0.20)
      .f('uTime', this.time);
    this.r.drawQuad();
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.disable(gl.BLEND);
  }

  renderProps(camera) {
    const p = this.pScene.use();
    this.applyLighting(p);
    p.v3('uCamPos', camera.pos)
      .m4('uLightVP', this.lightVP)
      .f('uShadowTexel', 1 / this.shadow.width)
      .tex('uShadowMap', this.shadow.tex);
    const mvp = M4.create();
    const all = this.props.concat(this.robot.props);
    for (const prop of all) {
      if (!prop.visible) continue;
      if (prop === this.liquidIndigo || prop === this.liquidSoga || prop === this.lorodLiquid) continue;
      M4.multiply(mvp, camera.vp, prop.model);
      p.m4('uMVP', mvp).m4('uModel', prop.model).m3('uNormalMat', prop.normalMat);
      prop.mesh.draw();
    }
  }

  renderCloth(camera, clothMesh, fabric, opts) {
    const gl = this.gl;
    gl.disable(gl.CULL_FACE);
    const p = this.pCloth.use();
    this.applyLighting(p);
    p.v3('uCamPos', camera.pos)
      .m4('uMVP', camera.vp)
      .m4('uLightVP', this.lightVP)
      .f('uShadowTexel', 1 / this.shadow.width)
      .tex('uShadowMap', this.shadow.tex)
      .tex('uColorTex', fabric.colorTex)
      .tex('uWaxTex', fabric.waxTex)
      .tex('uGuideTex', fabric.guideTex)
      .f('uTexel', 1 / fabric.size)
      .f('uLiquidY', opts.liquidY)
      .v3('uLiquidColor', opts.liquidColor)
      .f('uLiquidDensity', opts.liquidDensity)
      .f('uGuideVisible', opts.guideVisible)
      .f('uRevealGlow', this.revealGlow)
      .f('uLorodFront', opts.lorodFront === undefined ? -1 : opts.lorodFront)
      .f('uLorodWidth', opts.lorodWidth === undefined ? 0.22 : opts.lorodWidth);
    clothMesh.draw();
    gl.enable(gl.CULL_FACE);
  }

  renderLiquids(camera, state) {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    const p = this.pLiquid.use();
    this.applyLighting(p);
    p.v3('uCamPos', camera.pos).f('uTime', this.time);
    const mvp = M4.create();
    const draw = (prop, color, opacity) => {
      if (!prop.visible) return;
      M4.multiply(mvp, camera.vp, prop.model);
      p.m4('uMVP', mvp).m4('uModel', prop.model)
        .v3('uDyeColor', color).f('uOpacity', opacity);
      const loc = p.loc('uRipples');
      if (loc) gl.uniform4fv(loc, this.ripples);
      prop.mesh.draw();
    };
    draw(this.liquidIndigo, [0.13, 0.26, 0.52], 0.56);
    draw(this.liquidSoga, [0.40, 0.22, 0.08], 0.58);
    draw(this.lorodLiquid, [0.30, 0.27, 0.23], 0.66);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
  }

  renderParticles(camera) {
    this.particles.render(camera, this.pParticle, this.r);
  }

  present(state) {
    const gl = this.gl;
    // Bright pass + two-tap blur for the glow around the reveal and the window.
    this.bloomA.bind();
    gl.disable(gl.DEPTH_TEST);
    this.pBright.use().tex('uTex', this.sceneRT.tex).f('uThreshold', 0.92);
    this.r.drawQuad();
    for (let i = 0; i < 2; i++) {
      this.bloomB.bind();
      this.pBlur.use().tex('uTex', this.bloomA.tex).v2('uDir', 1.4 / this.bloomA.width, 0);
      this.r.drawQuad();
      this.bloomA.bind();
      this.pBlur.use().tex('uTex', this.bloomB.tex).v2('uDir', 0, 1.4 / this.bloomA.height);
      this.r.drawQuad();
    }
    this.r.bindDefault();
    this.pPost.use()
      .tex('uScene', this.sceneRT.tex)
      .tex('uBloom', this.bloomA.tex)
      .f('uTime', this.time)
      .f('uVignette', 0.78)
      .f('uBloomAmt', 0.38 + this.revealGlow * 1.1)
      .f('uWarm', 0.8);
    this.r.drawQuad();
  }
}

// ---------------------------------------------------------------------------
// The craft robot who holds the canting. A four year old guides its hand; it
// is the one that touches anything hot.
// ---------------------------------------------------------------------------

class Robot {
  constructor(renderer) {
    this.r = renderer;
    this.props = [];
    const SHELL = [0.78, 0.52, 0.30];
    const TRIM = [0.30, 0.42, 0.44];
    const DARK = [0.16, 0.15, 0.16];

    const mk = (build) => {
      const b = new G.GeoBuilder();
      build(b);
      const prop = new Prop(renderer.mesh(b.build()));
      this.props.push(prop);
      return prop;
    };

    this.base = mk((b) => {
      b.add(G.lathe([[0, 0], [0.34, 0.0], [0.36, 0.10], [0.30, 0.18], [0.22, 0.22], [0, 0.23]], 20),
        { color: [0.34, 0.30, 0.28], mat: 9 });
      b.add(G.torus(0.30, 0.05, 20, 8), { matrix: G.xform([0, 0.06, 0]), color: DARK, mat: 9 });
      b.add(G.cylinder(0.10, 0.12, 0.62, 14), { matrix: G.xform([0, 0.52, 0]), color: TRIM, mat: 9 });
    });

    this.body = mk((b) => {
      b.add(G.capsule(0.27, 0.30, 20, 8), { matrix: G.xform([0, 0, 0]), color: SHELL, mat: 3 });
      // A little batik apron, tied on: the workshop's own cloth.
      b.add(G.plane(0.44, 0.42, 6, 6, 'xy'), { matrix: G.xform([0, -0.06, 0.245]), color: [0.62, 0.48, 0.66], mat: 8 });
      b.add(G.torus(0.27, 0.028, 20, 7), { matrix: G.xform([0, 0.12, 0], [Math.PI / 2, 0, 0]), color: TRIM, mat: 9 });
    });

    this.head = mk((b) => {
      b.add(G.sphere(0.215, 20, 14), { matrix: G.xform([0, 0, 0], [0, 0, 0], [1, 0.9, 0.95]), color: SHELL, mat: 3 });
      b.add(G.sphere(0.175, 18, 12), { matrix: G.xform([0, 0.01, 0.09], [0, 0, 0], [1, 0.72, 0.6]), color: DARK, mat: 9 });
      b.add(G.sphere(0.042, 12, 9), { matrix: G.xform([-0.075, 0.02, 0.185]), color: [1.15, 1.55, 1.75], mat: 12 });
      b.add(G.sphere(0.042, 12, 9), { matrix: G.xform([0.075, 0.02, 0.185]), color: [1.15, 1.55, 1.75], mat: 12 });
      b.add(G.lathe([[0, 0.20], [0.15, 0.17], [0.20, 0.06], [0.21, 0.0], [0, 0.0]], 18),
        { matrix: G.xform([0, 0.06, 0]), color: [0.24, 0.30, 0.36], mat: 9 });
      b.add(G.cylinder(0.02, 0.02, 0.16, 8), { matrix: G.xform([0.13, 0.24, -0.02], [0, 0, -0.5]), color: TRIM, mat: 9 });
      b.add(G.sphere(0.035, 10, 8), { matrix: G.xform([0.17, 0.31, -0.04]), color: [1.6, 0.85, 0.35], mat: 12 });
    });

    const limb = (rad, color) => (b) => {
      b.add(G.cylinder(rad, rad * 0.88, 1.0, 12), { color, mat: 9 });
    };
    this.upperArm = mk(limb(0.062, TRIM));
    this.foreArm = mk(limb(0.052, TRIM));
    this.upperArmL = mk(limb(0.058, TRIM));
    this.foreArmL = mk(limb(0.048, TRIM));
    this.shoulderJ = mk((b) => b.add(G.sphere(0.082, 14, 10), { color: SHELL, mat: 3 }));
    this.elbowJ = mk((b) => b.add(G.sphere(0.068, 14, 10), { color: SHELL, mat: 3 }));
    this.shoulderJL = mk((b) => b.add(G.sphere(0.078, 14, 10), { color: SHELL, mat: 3 }));
    this.elbowJL = mk((b) => b.add(G.sphere(0.064, 14, 10), { color: SHELL, mat: 3 }));
    this.hand = mk((b) => {
      b.add(G.sphere(0.062, 14, 10), { matrix: G.xform([0, 0, 0], [0, 0, 0], [1, 0.85, 1]), color: SHELL, mat: 3 });
      b.add(G.box(0.075, 0.032, 0.055), { matrix: G.xform([0, 0.045, 0.02], [0.4, 0, 0]), color: DARK, mat: 9 });
      b.add(G.box(0.075, 0.032, 0.055), { matrix: G.xform([0, -0.045, 0.02], [-0.4, 0, 0]), color: DARK, mat: 9 });
    });
    this.handL = mk((b) => b.add(G.sphere(0.058, 12, 9), { color: SHELL, mat: 3 }));

    // The canting itself: bamboo grip, copper reservoir, fine spout.
    this.canting = mk((b) => {
      b.add(G.cylinder(0.019, 0.021, 0.30, 10), { matrix: G.xform([0, -0.15, 0]), color: [0.72, 0.62, 0.36], mat: 5 });
      b.add(G.torus(0.021, 0.006, 10, 6), { matrix: G.xform([0, -0.02, 0]), color: [0.55, 0.35, 0.16], mat: 3 });
      b.add(G.lathe([[0, 0.0], [0.038, 0.012], [0.052, 0.05], [0.048, 0.086], [0.030, 0.104], [0, 0.108]], 16),
        { matrix: G.xform([0, 0.0, 0]), color: [0.80, 0.48, 0.20], mat: 3 });
      const path = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        path.push([0.012 + t * 0.028, 0.098 + t * 0.10, 0.004 + t * 0.030]);
      }
      b.add(G.tube(path, (t) => 0.010 - t * 0.005, 8), { color: [0.85, 0.55, 0.22], mat: 3 });
    });
    this.spoutLocal = V3.create(0.040, 0.198, 0.034);

    // Grip blocks that clamp the top corners of the cloth while it is dipped.
    this.gripL = mk((b) => {
      b.add(G.box(0.16, 0.07, 0.09), { color: [0.36, 0.22, 0.13], mat: 1 });
      b.add(G.cylinder(0.018, 0.018, 0.20, 8), { matrix: G.xform([0, 0.11, 0]), color: [0.5, 0.5, 0.52], mat: 9 });
    });
    this.gripR = mk((b) => {
      b.add(G.box(0.16, 0.07, 0.09), { color: [0.36, 0.22, 0.13], mat: 1 });
      b.add(G.cylinder(0.018, 0.018, 0.20, 8), { matrix: G.xform([0, 0.11, 0]), color: [0.5, 0.5, 0.52], mat: 9 });
    });

    this.baseX = -1.5;
    this.bob = 0;
    this.handPos = V3.create(-0.8, 2.0, 0.35);
    this.tipPos = V3.create(-0.8, 2.1, 0.2);
    this.aimPos = V3.create(-0.8, 2.1, 0.2);
    this.leftHandPos = V3.create(-1.2, 1.5, 0.3);
    this.mode = 'idle';
    this.tmp = { a: V3.create(), b: V3.create(), c: V3.create(), m: M4.create() };
  }

  setGripVisible(v) {
    this.gripL.visible = v; this.gripR.visible = v;
  }

  // During the reveal the artisan's arm must not throw a shadow across the
  // finished cloth — that is the one image the whole game is building to.
  setShadowCasting(v) {
    for (const p of this.props) p.castShadow = v;
  }

  placeGrips(l, r) {
    this.gripL.setTRS([l[0], l[1] + 0.02, l[2]], [0, 0, 0], 1);
    this.gripR.setTRS([r[0], r[1] + 0.02, r[2]], [0, 0, 0], 1);
  }

  update(dt, t, aim, mode) {
    this.mode = mode;
    this.bob = t;
    V3.copy(this.aimPos, aim);

    // The base rolls along so the arm never has to stretch unnaturally far —
    // but it stays out to the side unless it is actually drawing, so it never
    // parks itself between the camera and the cloth.
    const drawing = mode === 'draw' || mode === 'refill' || mode === 'idle';
    const want = drawing ? clamp(aim[0] - 0.78, -1.85, -0.35) : -1.62;
    this.baseX = damp(this.baseX, want, 3.2, dt);
    const hover = Math.sin(t * 1.6) * 0.012;
    const bz = 0.62;

    this.base.setTRS([this.baseX, 0.0, bz], [0, 0.15, 0], 1);
    const bodyY = 1.15 + hover;
    const lean = clamp((aim[1] - 2.0) * 0.10, -0.12, 0.12);
    this.body.setTRS([this.baseX, bodyY, bz], [lean, 0.2, 0], 1);
    const headY = bodyY + 0.44;
    // The head watches the tip of the canting.
    const look = Math.atan2(aim[0] - this.baseX, aim[2] - bz + 0.001);
    const lookY = clamp(look * 0.55, -0.9, 0.9);
    const pitch = clamp((aim[1] - headY) * -0.32, -0.35, 0.35);
    this.head.setTRS([this.baseX, headY, bz], [pitch, lookY, 0], 1);

    // Right arm: two-bone IK onto the canting grip.
    const shoulder = V3.set(V3.create(), this.baseX + 0.30, bodyY + 0.16, bz - 0.02);
    // The hand sits back along the canting from the spout.
    const spoutOff = V3.set(V3.create(), 0.05, -0.20, 0.16);
    const wrist = V3.add(V3.create(), aim, spoutOff);
    this.solveArm(shoulder, wrist, 0.62, 0.60, [0.15, -0.5, 0.7],
      this.shoulderJ, this.upperArm, this.elbowJ, this.foreArm, this.hand);
    V3.copy(this.handPos, wrist);

    // Left arm rests, or steadies the frame.
    const shoulderL = V3.set(V3.create(), this.baseX - 0.26, bodyY + 0.14, bz - 0.02);
    const restL = V3.set(V3.create(), this.baseX - 0.42, bodyY - 0.30 + Math.sin(t * 1.2) * 0.02, bz + 0.28);
    if (mode === 'dip' || mode === 'lorod' || mode === 'present') {
      V3.copy(restL, this.leftHandPos);
    }
    this.solveArm(shoulderL, restL, 0.52, 0.50, [-0.6, -0.6, 0.5],
      this.shoulderJL, this.upperArmL, this.elbowJL, this.foreArmL, this.handL);

    // Canting: its long axis runs from the hand up to the spout tip, and the
    // spout (local +Y ~0.198) is what lands on the aim point.
    const dir = V3.norm(V3.create(), V3.sub(V3.create(), aim, wrist));
    const m = this.canting.model;
    const scale = 1.0;
    const up = dir;
    const ref = Math.abs(up[1]) > 0.95 ? V3.create(1, 0, 0) : V3.create(0, 1, 0);
    const xa = V3.norm(V3.create(), V3.cross(V3.create(), ref, up));
    const za = V3.norm(V3.create(), V3.cross(V3.create(), up, xa));
    const origin = V3.add(V3.create(), aim, V3.scale(V3.create(), dir, -0.198 * scale));
    m[0] = xa[0] * scale; m[1] = xa[1] * scale; m[2] = xa[2] * scale; m[3] = 0;
    m[4] = up[0] * scale; m[5] = up[1] * scale; m[6] = up[2] * scale; m[7] = 0;
    m[8] = za[0] * scale; m[9] = za[1] * scale; m[10] = za[2] * scale; m[11] = 0;
    m[12] = origin[0]; m[13] = origin[1]; m[14] = origin[2]; m[15] = 1;
    M4.normalFromMat4(this.canting.normalMat, m);
    V3.copy(this.tipPos, aim);
  }

  solveArm(shoulder, target, l1, l2, bendRef, jointA, boneA, jointB, boneB, handProp) {
    const axis = V3.sub(V3.create(), target, shoulder);
    let d = V3.len(axis);
    const maxD = (l1 + l2) * 0.995;
    const minD = Math.abs(l1 - l2) + 0.02;
    if (d > maxD) { V3.scale(axis, axis, maxD / d); d = maxD; }
    if (d < minD) { V3.scale(axis, axis, minD / (d || 1e-5)); d = minD; }
    const end = V3.add(V3.create(), shoulder, axis);
    const u = V3.norm(V3.create(), axis);
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const ref = V3.create(bendRef[0], bendRef[1], bendRef[2]);
    const proj = V3.scale(V3.create(), u, V3.dot(ref, u));
    const perp = V3.norm(V3.create(), V3.sub(V3.create(), ref, proj));
    const elbow = V3.add(V3.create(),
      V3.add(V3.create(), shoulder, V3.scale(V3.create(), u, a)),
      V3.scale(V3.create(), perp, h));

    jointA.setTRS(shoulder, [0, 0, 0], 1);
    jointB.setTRS(elbow, [0, 0, 0], 1);
    boneA.place(segmentMatrix(M4.create(), shoulder, elbow, 1));
    M4.normalFromMat4(boneA.normalMat, boneA.model);
    boneB.place(segmentMatrix(M4.create(), elbow, end, 1));
    M4.normalFromMat4(boneB.normalMat, boneB.model);
    if (handProp) handProp.setTRS(end, [0, 0, 0], 1);
  }
}

// ---------------------------------------------------------------------------

class Particles {
  constructor(renderer, max) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.data = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.kind = new Float32Array(max);
    this.size = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.n = 0;
    this.mesh = renderer.mesh({
      position: { data: this.pos, size: 3, dynamic: true },
      normal: { data: this.data, size: 3, dynamic: true },
      count: 0,
      mode: renderer.gl.POINTS,
    });
    this.tint = [1, 1, 1];
  }

  spawn(x, y, z, vx, vy, vz, kind, size, life, grav = -2.0, drag = 0.6) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.kind[i] = kind; this.size[i] = size;
    this.life[i] = life; this.maxLife[i] = life;
    this.gravity[i] = grav; this.drag[i] = drag;
  }

  update(dt) {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --this.n;
        if (j !== i) {
          for (let c = 0; c < 3; c++) {
            this.pos[i * 3 + c] = this.pos[j * 3 + c];
            this.vel[i * 3 + c] = this.vel[j * 3 + c];
          }
          this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j];
          this.kind[i] = this.kind[j]; this.size[i] = this.size[j];
          this.gravity[i] = this.gravity[j]; this.drag[i] = this.drag[j];
        }
        i--; continue;
      }
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d + this.gravity[i] * dt;
      this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.data[i * 3] = this.size[i] * (this.kind[i] === 2 ? (1.6 - t * 0.6) : 1);
      this.data[i * 3 + 1] = this.kind[i];
      this.data[i * 3 + 2] = Math.min(1, t * 2.2) * (this.kind[i] === 2 ? 0.7 : 1);
    }
  }

  render(camera, prog, renderer) {
    if (this.n === 0) return;
    const gl = renderer.gl;
    this.mesh.update('position', this.pos.subarray(0, this.n * 3));
    this.mesh.update('normal', this.data.subarray(0, this.n * 3));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    prog.use().m4('uMVP', camera.vp)
      .v2('uViewport', renderer.width, renderer.height)
      .v3('uTint', this.tint);
    this.mesh.drawRange(this.n);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}

export { Robot, Particles, segmentMatrix, SUN_DIR };
