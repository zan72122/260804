// The cloth's memory. Two textures hold everything that has happened to it:
//   colour  : rgb = the dye the fibre currently holds, a = how wet it is
//   wax     : r = coverage, g = relief height, b = which waxing round, a = heat
//
// The whole trick of batik lives here. A dye pass darkens every texel *except*
// the ones the wax is sealing, so the colour that was on the cloth at the
// moment the wax went down is preserved underneath it. Removing the wax does
// not paint anything — it simply stops hiding what was saved.

import { PingPong, RenderTarget } from './gl.js';
import {
  FSQUAD_VS, WAX_FS, WAX_COOL_FS, DYE_FS, DRY_FS, LOROD_FS, GUIDE_FS,
} from './shaders.js';

export const CLOTH_BASE = [0.945, 0.902, 0.812];   // undyed mori cotton

export const DYES = {
  indigo: {
    id: 'indigo',
    name: 'あい いろ',
    sub: 'indigo / nila',
    absorb: [2.45, 1.55, 0.42],
    liquid: [0.10, 0.22, 0.46],
    swatch: '#2f4d7d',
  },
  soga: {
    id: 'soga',
    name: 'ちゃ いろ',
    sub: 'soga brown',
    absorb: [0.50, 1.50, 2.70],
    liquid: [0.34, 0.19, 0.07],
    swatch: '#8a5423',
  },
};

export class Fabric {
  constructor(renderer, size = 1024) {
    this.r = renderer;
    const gl = renderer.gl;
    this.size = size;
    this.color = new PingPong(gl, size, size, {});
    this.wax = new PingPong(gl, size, size, {});
    this.guide = new RenderTarget(gl, 512, 512, {});
    this.pWax = renderer.program('fwax', FSQUAD_VS, WAX_FS);
    this.pCool = renderer.program('fcool', FSQUAD_VS, WAX_COOL_FS);
    this.pDye = renderer.program('fdye', FSQUAD_VS, DYE_FS);
    this.pDry = renderer.program('fdry', FSQUAD_VS, DRY_FS);
    this.pLorod = renderer.program('florod', FSQUAD_VS, LOROD_FS);
    this.pGuide = renderer.program('fguide', FSQUAD_VS, GUIDE_FS);
    this.journal = [];
    this.coolAccum = 0;
    this.dryAccum = 0;
    this.dyeAccum = 0;
    this.reset();
  }

  get colorTex() { return this.color.read.tex; }
  get waxTex() { return this.wax.read.tex; }
  get guideTex() { return this.guide.tex; }

  reset() {
    const gl = this.r.gl;
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    this.color.clear(CLOTH_BASE[0], CLOTH_BASE[1], CLOTH_BASE[2], 0);
    this.wax.clear(0, 0, 0, 0);
    this.guide.clear(0, 0, 0, 1);
    this.journal.length = 0;
  }

  clearGuide() {
    this.guide.clear(0, 0, 0, 1);
  }

  // ---- wax -----------------------------------------------------------------

  // A stroke segment. Drawn in place with a MAX blend so wax only accumulates.
  waxStroke(ax, ay, bx, by, radius, flow, drop, layer, seed, record = true) {
    const gl = this.r.gl;
    const t = this.wax.read;
    t.bind();
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);

    // Only rasterise the box the segment can possibly touch.
    const pad = (radius * 2.2 + 0.01);
    const x0 = Math.max(0, Math.min(ax, bx) - pad);
    const x1 = Math.min(1, Math.max(ax, bx) + pad);
    const y0 = Math.max(0, Math.min(ay, by) - pad);
    const y1 = Math.min(1, Math.max(ay, by) + pad);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(
      Math.floor(x0 * t.width), Math.floor(y0 * t.height),
      Math.ceil((x1 - x0) * t.width) + 1, Math.ceil((y1 - y0) * t.height) + 1,
    );

    this.pWax.use()
      .v2('uA', ax, ay).v2('uB', bx, by)
      .f('uRadius', radius).f('uFlow', flow).f('uAspect', 1)
      .f('uDrop', drop).f('uSeed', seed).f('uLayer', layer);
    this.r.drawQuad();

    gl.disable(gl.SCISSOR_TEST);
    gl.blendEquation(gl.FUNC_ADD);
    gl.disable(gl.BLEND);
    if (record) this.journal.push(['w', ax, ay, bx, by, radius, flow, drop, layer, seed]);
  }

  coolWax(dt) {
    this.coolAccum += dt;
    if (this.coolAccum < 1 / 15) return;
    const step = this.coolAccum;
    this.coolAccum = 0;
    const gl = this.r.gl;
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    this.wax.write.bind();
    this.pCool.use().tex('uPrev', this.wax.read.tex).f('uDT', step);
    this.r.drawQuad();
    this.wax.swap();
  }

  // ---- dye -----------------------------------------------------------------

  // One increment of soaking. front is in cloth v (0 = bottom edge).
  // Batched to ~24 Hz: the pass is a full-screen noise shader and running it
  // every frame is wasted work on a phone.
  dyeStepBatched(dye, rate, front, soft, dt) {
    this.dyeAccum += rate;
    if (dt !== undefined && this.dyeAccum > 0) {
      this._dyeWait = (this._dyeWait || 0) + dt;
      if (this._dyeWait < 1 / 24) return 0;
      this._dyeWait = 0;
    }
    const amount = this.dyeAccum;
    this.dyeAccum = 0;
    if (amount <= 0) return 0;
    this.dyeStep(dye, amount, front, soft);
    return amount;
  }

  dyeStep(dye, rate, front, soft = 0.05, record = true) {
    if (rate <= 0) return;
    const gl = this.r.gl;
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    this.color.write.bind();
    this.pDye.use()
      .tex('uColor', this.color.read.tex)
      .tex('uWax', this.wax.read.tex)
      .v3('uAbsorb', dye.absorb)
      .f('uRate', rate)
      .f('uWetFront', front)
      .f('uFrontSoft', soft);
    this.r.drawQuad();
    this.color.swap();
    if (record) this.journal.push(['d', dye.id, rate, front, soft]);
  }

  dry(dt) {
    this.dryAccum += dt;
    if (this.dryAccum < 1 / 8) return;
    dt = this.dryAccum;
    this.dryAccum = 0;
    const gl = this.r.gl;
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    this.color.write.bind();
    this.pDry.use().tex('uColor', this.color.read.tex).f('uDT', dt);
    this.r.drawQuad();
    this.color.swap();
  }

  // ---- nglorod -------------------------------------------------------------

  lorodStep(front, width, dt, record = true) {
    const gl = this.r.gl;
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    this.wax.write.bind();
    this.pLorod.use()
      .tex('uWax', this.wax.read.tex)
      .f('uFront', front).f('uWidth', width).f('uDT', dt);
    this.r.drawQuad();
    this.wax.swap();
    if (record) this.journal.push(['l', front, width, dt]);
  }

  // ---- guide ---------------------------------------------------------------

  drawGuide(polylines) {
    const gl = this.r.gl;
    this.guide.clear(0, 0, 0, 1);
    this.guide.bind();
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    const p = this.pGuide.use();
    for (const line of polylines) {
      for (let i = 0; i < line.length - 1; i++) {
        p.v2('uA', line[i][0], line[i][1])
          .v2('uB', line[i + 1][0], line[i + 1][1])
          .f('uRadius', 0.016);
        this.r.drawQuad();
      }
    }
    gl.blendEquation(gl.FUNC_ADD);
    gl.disable(gl.BLEND);
  }

  // ---- context-loss recovery ----------------------------------------------

  // Replays everything that has happened to the cloth. Used if the browser
  // drops the GL context (which a tab switch on iOS can do) so a child never
  // loses the batik they were part way through.
  replay(journal) {
    this.reset();
    for (const op of journal) {
      if (op[0] === 'w') {
        this.waxStroke(op[1], op[2], op[3], op[4], op[5], op[6], op[7], op[8], op[9], false);
      } else if (op[0] === 'd') {
        const dye = DYES[op[1]];
        if (dye) this.dyeStep(dye, op[2], op[3], op[4], false);
      } else if (op[0] === 'l') {
        this.lorodStep(op[1], op[2], op[3], false);
      }
    }
    this.journal = journal.slice();
  }
}
