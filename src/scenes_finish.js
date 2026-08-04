// Finishing scenes: couch & lift the wet sheet, press, dry & flip (ひらり),
// return the page to the book, and the picture menu.
import { G, newGame } from './state.js';
import { sfx, setWater } from './audio.js';
import { roomBg, hint, hintGesture, glowRing, drawCloth, drawFelt, drawMesh } from './ui.js';
import { clamp, lerp, dist, ease, easeOut, TAU, rr, fitRect, inRect } from './util.js';
import { tankLay } from './scenes_tank.js';

// ---------------------------------------------------------------- couch
export const sceneCouch = {
  grabCloth: false, liftGrab: null, wobT: 0,
  enter() {
    this.grabCloth = false; this.liftGrab = null; this.wobT = 0;
    if (!G.flags.clothPos) G.flags.clothPos = null;
    setWater(0.1);
  },
  clothHome(L) {
    const la = tankLay(L, false);
    if (L.portrait) return { x: L.W * 0.22, y: la.zone.y + la.zone.h * 0.45 };
    return { x: la.zone.x + la.zone.w * 0.5, y: L.H * 0.22 };
  },
  clothAt(L) {
    if (G.flags.clothPos) return { x: G.flags.clothPos.fx * L.W, y: G.flags.clothPos.fy * L.H };
    return this.clothHome(L);
  },
  down(p) {
    const L = G.L, la = tankLay(L, false);
    if (!G.flags.clothOn) {
      const c = this.clothAt(L);
      if (dist(p.x, p.y, c.x, c.y) < 80) { this.grabCloth = true; sfx.tap(); return; }
      if (inRect(p.x, p.y, la.paperR, 30)) {
        // trying to lift bare wet paper — gentle wobble, no failure
        if (this.wobT <= 0) { this.wobT = 0.8; sfx.wob(); }
      }
      return;
    }
    if (inRect(p.x, p.y, la.paperR, 60)) this.liftGrab = { y: p.y };
  },
  move(p) {
    const L = G.L, la = tankLay(L, false);
    if (this.grabCloth) {
      G.flags.clothPos = { fx: p.x / L.W, fy: p.y / L.H };
      const cx = la.paperR.x + la.paperR.w / 2, cy = la.paperR.y + la.paperR.h / 2;
      if (dist(p.x, p.y, cx, cy) < la.paperR.w * 0.35) {
        G.flags.clothOn = true;
        this.grabCloth = false;
        sfx.chime();
      }
      return;
    }
    if (this.liftGrab) {
      G.flags.lift = clamp(G.flags.lift + (this.liftGrab.y - p.y) / (L.H * 0.26), 0, 1);
      this.liftGrab.y = p.y;
      if (G.flags.lift >= 0.95 && !G.flags.lifted) {
        G.flags.lifted = true;
        sfx.chime();
      }
    }
  },
  up() { this.grabCloth = false; this.liftGrab = null; },
  update(dt) {
    if (this.wobT > 0) this.wobT -= dt;
    if (!this.liftGrab && !G.flags.lifted) G.flags.lift = Math.max(0, G.flags.lift - dt * 0.8);
    if (G.flags.lifted) {
      G.flags.lift = Math.min(1.2, G.flags.lift + dt * 0.6);
      if (G.flags.lift >= 1.15) G.go('press');
    }
  },
  render(ctx, L) {
    roomBg(ctx, L, '');
    const la = tankLay(L, false);
    // drained tank
    rr(ctx, la.tank.x - 8, la.tank.y - 8, la.tank.w + 16, la.tank.h + 16, 18);
    ctx.fillStyle = '#8b6d49'; ctx.fill();
    ctx.strokeStyle = '#5d472c'; ctx.lineWidth = 3;
    rr(ctx, la.tank.x - 8, la.tank.y - 8, la.tank.w + 16, la.tank.h + 16, 18);
    ctx.stroke();
    rr(ctx, la.inner.x - 4, la.inner.y - 4, la.inner.w + 8, la.inner.h + 8, 12);
    ctx.fillStyle = '#c7d4d2'; ctx.fill();
    ctx.save();
    rr(ctx, la.inner.x, la.inner.y, la.inner.w, la.inner.h, 10);
    ctx.clip();
    drawMesh(ctx, la.inner.x, la.inner.y, la.inner.w, la.inner.h);
    ctx.restore();

    // wet sheet (+cloth) possibly lifted
    const lift = ease(clamp(G.flags.lift, 0, 1));
    const ly = -lift * L.H * 0.2;
    const wob = this.wobT > 0 ? Math.sin(G.time * 25) * 3 * this.wobT : 0;
    ctx.save();
    ctx.translate(la.paperR.x + la.paperR.w / 2 + wob, la.paperR.y + la.paperR.h / 2 + ly);
    ctx.rotate(lift * -0.05 + (this.wobT > 0 ? Math.sin(G.time * 20) * 0.01 : 0));
    ctx.scale(1, 1 - lift * 0.08);
    if (lift > 0.05) {
      ctx.shadowColor = 'rgba(40,25,10,0.4)';
      ctx.shadowBlur = 8 + lift * 20;
    }
    ctx.drawImage(G.paper.pageImg(0.95), -la.paperR.w / 2, -la.paperR.h / 2, la.paperR.w, la.paperR.h);
    if (G.flags.clothOn) {
      drawCloth(ctx, -la.paperR.w * 0.55, -la.paperR.h * 0.55, la.paperR.w * 1.1, la.paperR.h * 1.1, '#f2dfe4', 0.5);
    }
    ctx.restore();
    // drips while lifting
    if (lift > 0.15) {
      ctx.fillStyle = 'rgba(130,180,195,0.8)';
      for (let i = 0; i < 4; i++) {
        const p = (G.time * (1 + i * 0.2) + i * 0.37) % 1;
        const x = la.paperR.x + (0.15 + 0.7 * ((i * 0.29) % 1)) * la.paperR.w;
        const y = la.paperR.y + la.paperR.h + ly + p * 60;
        ctx.beginPath(); ctx.ellipse(x, y, 2, 3.4, 0, 0, TAU); ctx.fill();
      }
    }
    // support cloth roll (before pickup)
    if (!G.flags.clothOn) {
      const c = this.clothAt(L);
      glowRing(ctx, c.x, c.y, 56, G.time, '242,205,215');
      ctx.save();
      ctx.translate(c.x, c.y);
      drawCloth(ctx, -55, -34, 110, 68, '#f2dfe4', 0.95, 30);
      ctx.strokeStyle = 'rgba(160,120,130,0.5)';
      ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(-55 + 20, 0, 12 + i * 7, Math.PI * 0.5, Math.PI * 1.5);
        ctx.stroke();
      }
      ctx.restore();
    }
    // hints
    if (hint.idle > 4 && !G.flags.lifted) {
      const cx = la.paperR.x + la.paperR.w / 2, cy = la.paperR.y + la.paperR.h / 2;
      if (!G.flags.clothOn) {
        const c = this.clothAt(L);
        hintGesture(ctx, 'drag', c.x, c.y, cx, cy, G.time);
      } else {
        hintGesture(ctx, 'swipe', cx, cy + 40, cx, cy - L.H * 0.22, G.time);
      }
    }
  },
  qa(L) {
    const la = tankLay(L, false);
    return {
      cloth: this.clothAt(L),
      sheet: { x: la.paperR.x + la.paperR.w / 2, y: la.paperR.y + la.paperR.h / 2 },
      clothOn: G.flags.clothOn, lift: G.flags.lift,
    };
  },
};

// ---------------------------------------------------------------- press
export const scenePress = {
  grabFelt: false, feltPos: null, pressGrab: null, squeezeT: 0, raising: false,
  enter() {
    this.grabFelt = false; this.feltPos = null; this.pressGrab = null;
    this.squeezeT = 0; this.raising = false;
    setWater(0);
  },
  lay(L) {
    const { W, H, portrait } = L;
    const stack = fitRect(W / 2, portrait ? H * 0.62 : H * 0.64, W * (portrait ? 0.6 : 0.34), H * 0.30, 440 / 580);
    const beamY = stack.y - H * (portrait ? 0.16 : 0.20);
    const felt = this.feltPos
      ? { x: this.feltPos.fx * W, y: this.feltPos.fy * H }
      : (portrait ? { x: W * 0.14, y: H * 0.30 } : { x: W * 0.14, y: H * 0.26 });
    const wheel = { x: stack.x + stack.w / 2, y: beamY - 26, r: Math.max(30, stack.w * 0.16) };
    return { stack, beamY, felt, wheel };
  },
  down(p) {
    const la = this.lay(G.L);
    if (!G.flags.feltOn) {
      if (dist(p.x, p.y, la.felt.x, la.felt.y) < 80) { this.grabFelt = true; sfx.tap(); return; }
    }
    if (G.flags.feltOn && !this.raising && G.flags.press < 1) {
      if (dist(p.x, p.y, la.wheel.x, la.wheel.y) < la.wheel.r + 60 ||
        inRect(p.x, p.y, la.stack, 60)) {
        this.pressGrab = { y: p.y };
        sfx.tap();
      }
    }
  },
  move(p) {
    const la = this.lay(G.L);
    if (this.grabFelt) {
      this.feltPos = { fx: p.x / G.L.W, fy: p.y / G.L.H };
      const cx = la.stack.x + la.stack.w / 2, cy = la.stack.y + la.stack.h / 2;
      if (dist(p.x, p.y, cx, cy) < la.stack.w * 0.4) {
        G.flags.feltOn = true;
        this.grabFelt = false;
        sfx.chime();
      }
      return;
    }
    if (this.pressGrab) {
      const d = p.y - this.pressGrab.y;
      if (d > 0) G.flags.press = clamp(G.flags.press + d / (G.L.H * 0.24), 0, 1);
      this.pressGrab.y = p.y;
      if (G.flags.press >= 1 && this.squeezeT === 0) {
        this.squeezeT = 0.001;
        sfx.press();
      }
    }
  },
  up() { this.grabFelt = false; this.pressGrab = null; },
  update(dt) {
    if (this.squeezeT > 0 && !G.flags.pressed) {
      this.squeezeT += dt;
      if (this.squeezeT > 1.2) { G.flags.pressed = true; this.raising = true; }
    }
    if (this.raising) {
      G.flags.press = Math.max(0, G.flags.press - dt * 1.1);
      if (G.flags.press <= 0.01) { G.flags.wet = 0.55; G.go('dry'); }
    }
  },
  render(ctx, L) {
    roomBg(ctx, L, '');
    const la = this.lay(L);
    const squash = 0.16 * ease(G.flags.press);
    // press frame
    ctx.fillStyle = '#6b4f2f';
    const postW = Math.max(14, la.stack.w * 0.08);
    rr(ctx, la.stack.x - postW * 1.7, la.beamY - 18, postW, la.stack.y + la.stack.h - la.beamY + 30, 6); ctx.fill();
    rr(ctx, la.stack.x + la.stack.w + postW * 0.7, la.beamY - 18, postW, la.stack.y + la.stack.h - la.beamY + 30, 6); ctx.fill();
    rr(ctx, la.stack.x - postW * 1.9, la.beamY - 30, la.stack.w + postW * 3.8, 22, 8); ctx.fill();
    // screw + wheel
    const platenY = lerp(la.beamY + 2, la.stack.y - 14 + la.stack.h * squash, ease(G.flags.press));
    ctx.fillStyle = '#4e3a22';
    ctx.fillRect(la.wheel.x - 6, la.beamY - 12, 12, platenY - la.beamY + 16);
    ctx.save();
    ctx.translate(la.wheel.x, la.wheel.y);
    ctx.rotate(G.flags.press * 6);
    ctx.strokeStyle = '#8a6438'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * la.wheel.r, Math.sin(a) * la.wheel.r * 0.35);
      ctx.lineTo(-Math.cos(a) * la.wheel.r, -Math.sin(a) * la.wheel.r * 0.35);
      ctx.stroke();
    }
    ctx.fillStyle = '#a3763f';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
    ctx.restore();
    // stack: bottom felt, cloth+sheet, top felt
    const sy = la.stack.y + la.stack.h * squash / 2;
    const sh = la.stack.h * (1 - squash);
    drawFelt(ctx, la.stack.x - 14, sy + sh - 8, la.stack.w + 28, 22, '#e9c9cf');
    ctx.save();
    ctx.translate(la.stack.x + la.stack.w / 2, sy + sh / 2);
    ctx.scale(1, 1 - squash);
    ctx.drawImage(G.paper.pageImg(0.9), -la.stack.w / 2, -la.stack.h / 2, la.stack.w, la.stack.h);
    drawCloth(ctx, -la.stack.w * 0.55, -la.stack.h * 0.55, la.stack.w * 1.1, la.stack.h * 1.1, '#f2dfe4', 0.45);
    ctx.restore();
    if (G.flags.feltOn) {
      drawFelt(ctx, la.stack.x - 14, sy - 14, la.stack.w + 28, 22, '#efd3d8');
    }
    // platen
    ctx.fillStyle = '#7a5a35';
    rr(ctx, la.stack.x - 20, platenY, la.stack.w + 40, 14, 5); ctx.fill();
    // squeezed water
    if (this.squeezeT > 0 && this.squeezeT < 1.4) {
      ctx.fillStyle = 'rgba(130,180,195,0.85)';
      for (let i = 0; i < 6; i++) {
        const t = (this.squeezeT * 1.4 + i * 0.17) % 1;
        const side = i % 2 ? 1 : -1;
        const x = la.stack.x + la.stack.w / 2 + side * (la.stack.w / 2 + 16 + t * 40);
        const y = sy + sh - 6 + t * t * 50;
        ctx.beginPath(); ctx.ellipse(x, y, 2.4, 3.6, 0, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = 'rgba(150,195,205,0.35)';
      ctx.beginPath();
      ctx.ellipse(la.stack.x + la.stack.w / 2, sy + sh + 14, la.stack.w * 0.7 * Math.min(1, this.squeezeT), 8, 0, 0, TAU);
      ctx.fill();
    }
    // felt to drag
    if (!G.flags.feltOn) {
      glowRing(ctx, la.felt.x, la.felt.y, 60, G.time, '238,205,213');
      drawFelt(ctx, la.felt.x - 60, la.felt.y - 36, 120, 72, '#efd3d8');
    }
    // hints
    if (hint.idle > 4 && !this.raising) {
      const cx = la.stack.x + la.stack.w / 2, cy = la.stack.y + la.stack.h / 2;
      if (!G.flags.feltOn) hintGesture(ctx, 'drag', la.felt.x, la.felt.y, cx, cy, G.time);
      else if (G.flags.press < 1) hintGesture(ctx, 'swipe', la.wheel.x, la.wheel.y, la.wheel.x, la.wheel.y + L.H * 0.2, G.time);
    }
  },
  qa(L) {
    const la = this.lay(L);
    return {
      felt: la.felt, wheel: la.wheel,
      stack: { x: la.stack.x + la.stack.w / 2, y: la.stack.y + la.stack.h / 2 },
      feltOn: G.flags.feltOn, press: G.flags.press, pressed: G.flags.pressed,
    };
  },
};

// ---------------------------------------------------------------- dry
export const sceneDry = {
  strokeGrab: null, gustT: 0, flipGrab: null, showT: 0, driedChime: false,
  enter() { this.strokeGrab = null; this.gustT = 0; this.flipGrab = null; this.showT = 0; this.driedChime = false; },
  lay(L) {
    const { W, H, portrait } = L;
    const page = fitRect(W * (portrait ? 0.5 : 0.42), portrait ? H * 0.5 : H * 0.52, W * (portrait ? 0.74 : 0.4), H * 0.5, 440 / 580);
    return { page, corner: { x: page.x + page.w - 6, y: page.y + page.h - 6 } };
  },
  down(p) {
    const la = this.lay(G.L);
    if (G.flags.dried && !G.flags.flipped) {
      if (dist(p.x, p.y, la.corner.x, la.corner.y) < 90) {
        this.flipGrab = { x: p.x };
        sfx.tap();
        return;
      }
    }
    if (!G.flags.dried && inRect(p.x, p.y, la.page, 70)) {
      this.strokeGrab = { travel: 0, x: p.x, gusted: false };
    }
  },
  move(p) {
    if (this.flipGrab) {
      const la = this.lay(G.L);
      G.flags.flip = clamp((this.flipGrab.x - p.x) / (la.page.w * 0.85), 0, 1);
      if (G.flags.flip >= 1 && !G.flags.flipped) {
        G.flags.flipped = true;
        sfx.flip();
      }
      return;
    }
    if (this.strokeGrab && !G.flags.dried) {
      this.strokeGrab.travel += Math.abs(p.x - this.strokeGrab.x);
      this.strokeGrab.x = p.x;
      if (this.strokeGrab.travel > G.L.W * 0.2 && !this.strokeGrab.gusted) {
        this.strokeGrab.gusted = true;
        G.flags.wet = Math.max(0, G.flags.wet - 0.16);
        this.gustT = 1;
        sfx.pour();
      }
      if (this.strokeGrab.gusted && this.strokeGrab.travel > G.L.W * 0.45) {
        this.strokeGrab.gusted = false;
        this.strokeGrab.travel = 0;
      }
    }
  },
  up() { this.strokeGrab = null; this.flipGrab = null; },
  update(dt) {
    if (!G.flags.dried) {
      G.flags.wet = Math.max(0, G.flags.wet - dt * 0.012);
      if (G.flags.wet <= 0.05) {
        G.flags.dried = true;
        if (!this.driedChime) { this.driedChime = true; sfx.chime(); }
      }
    }
    if (this.gustT > 0) this.gustT -= dt;
    if (!this.flipGrab && !G.flags.flipped) G.flags.flip = Math.max(0, G.flags.flip - dt * 1.5);
    if (G.flags.flipped) {
      G.flags.flip = 1;
      this.showT += dt;
      if (this.showT > 1.3) G.go('ret');
    }
  },
  render(ctx, L) {
    roomBg(ctx, L, 'window');
    const la = this.lay(L);
    // drying rack bars
    ctx.fillStyle = '#8a6f50';
    rr(ctx, la.page.x - 30, la.page.y - 16, la.page.w + 60, 10, 5); ctx.fill();
    rr(ctx, la.page.x - 30, la.page.y + la.page.h + 8, la.page.w + 60, 10, 5); ctx.fill();
    // sheet with flip transform
    const fl = ease(G.flags.flip);
    const sx = Math.cos(fl * Math.PI);
    const cx = la.page.x + la.page.w / 2, cy = la.page.y + la.page.h / 2;
    // backlight glow at mid-flip: light shines through old + new fibers
    const glow = Math.sin(fl * Math.PI);
    if (glow > 0.02) {
      const gg = ctx.createRadialGradient(cx, cy, 10, cx, cy, la.page.h * 0.7);
      gg.addColorStop(0, `rgba(255,246,214,${0.75 * glow})`);
      gg.addColorStop(1, 'rgba(255,246,214,0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(cx, cy, la.page.h * 0.75, 0, TAU); ctx.fill();
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.04, Math.abs(sx)), 1 + glow * 0.04);
    if (sx < 0) ctx.scale(-1, 1); // back face mirrored
    ctx.rotate(glow * 0.03);
    const img = G.paper.pageImg(G.flags.dried ? 0 : G.flags.wet);
    ctx.globalAlpha = sx < 0 ? 0.92 : 1;
    ctx.drawImage(img, -la.page.w / 2, -la.page.h / 2, la.page.w, la.page.h);
    if (sx < 0) {
      // back of the sheet: media shows only as faint bleed-through
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#e9dcbc';
      ctx.fillRect(-la.page.w / 2, -la.page.h / 2, la.page.w, la.page.h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.25;
      ctx.drawImage(img, -la.page.w / 2, -la.page.h / 2, la.page.w, la.page.h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    // translucency: new fiber patches glow when backlit
    if (glow > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = glow * 0.5;
      ctx.drawImage(G.paper.deposit, -la.page.w / 2, -la.page.h / 2, la.page.w, la.page.h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // wet sheen
    if (!G.flags.dried && G.flags.wet > 0.05) {
      ctx.save();
      ctx.globalAlpha = G.flags.wet * 0.5;
      const sg = ctx.createLinearGradient(la.page.x, la.page.y, la.page.x + la.page.w, la.page.y + la.page.h);
      sg.addColorStop(0, 'rgba(160,190,200,0.0)');
      sg.addColorStop(0.5 + Math.sin(G.time) * 0.1, 'rgba(190,215,225,0.5)');
      sg.addColorStop(1, 'rgba(160,190,200,0.0)');
      ctx.fillStyle = sg;
      ctx.fillRect(la.page.x, la.page.y, la.page.w, la.page.h);
      ctx.restore();
    }
    // breeze lines
    if (this.gustT > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * this.gustT})`;
      ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const y = la.page.y + la.page.h * (0.25 + i * 0.25);
        const off = (1 - this.gustT) * la.page.w;
        ctx.beginPath();
        ctx.moveTo(la.page.x - 40 + off, y);
        ctx.bezierCurveTo(la.page.x + off, y - 14, la.page.x + 40 + off, y + 10, la.page.x + 90 + off, y - 4);
        ctx.stroke();
      }
    }
    // corner tab when dry
    if (G.flags.dried && !G.flags.flipped && G.flags.flip < 0.05) {
      glowRing(ctx, la.corner.x - 14, la.corner.y - 14, 30, G.time);
      ctx.fillStyle = 'rgba(255,240,190,0.8)';
      ctx.beginPath();
      ctx.moveTo(la.corner.x, la.corner.y);
      ctx.lineTo(la.corner.x - 34, la.corner.y);
      ctx.lineTo(la.corner.x, la.corner.y - 34);
      ctx.closePath();
      ctx.fill();
    }
    // hints
    if (hint.idle > 4 && !G.flags.flipped) {
      if (!G.flags.dried) {
        hintGesture(ctx, 'stroke', la.page.x + 20, la.page.y + la.page.h * 0.4,
          la.page.x + la.page.w - 20, la.page.y + la.page.h * 0.6, G.time);
      } else {
        hintGesture(ctx, 'drag', la.corner.x - 10, la.corner.y - 10,
          la.page.x + la.page.w * 0.2, la.corner.y - 20, G.time);
      }
    }
  },
  qa(L) {
    const la = this.lay(L);
    return {
      sheet: { x: la.page.x + la.page.w / 2, y: la.page.y + la.page.h / 2 },
      page: la.page, corner: la.corner,
      wet: G.flags.wet, dried: G.flags.dried, flip: G.flags.flip,
    };
  },
};

// ---------------------------------------------------------------- return to book
export const sceneReturn = {
  phase: 'place', seq: 0, drag: false, pos: null, motes: [],
  enter() {
    this.phase = 'place'; this.seq = 0; this.drag = false; this.motes = [];
    this.pos = { fx: 0.5, fy: 0.86 };
  },
  lay(L) {
    const { W, H, portrait } = L;
    const spread = fitRect(W / 2, H * (portrait ? 0.42 : 0.48), W * 0.92, H * (portrait ? 0.5 : 0.62), 1.5);
    const rp = { x: spread.x + spread.w / 2 + 4, y: spread.y + 8, w: spread.w / 2 - 12, h: spread.h - 16 };
    const slot = { x: rp.x + rp.w * 0.08, y: rp.y + rp.h * 0.06, w: rp.w * 0.84, h: rp.h * 0.88 };
    return { spread, rp, slot };
  },
  down(p) {
    if (this.phase === 'place') {
      const L = G.L;
      const px = this.pos.fx * L.W, py = this.pos.fy * L.H;
      if (dist(p.x, p.y, px, py) < 110) { this.drag = true; sfx.tap(); }
    } else if (this.phase === 'turn') {
      this.turnStart = p.x;
    }
  },
  move(p) {
    const L = G.L;
    if (this.phase === 'place' && this.drag) {
      this.pos.fx = p.x / L.W; this.pos.fy = p.y / L.H;
      const la = this.lay(L);
      const cx = la.slot.x + la.slot.w / 2, cy = la.slot.y + la.slot.h / 2;
      if (dist(p.x, p.y, cx, cy) < la.slot.w * 0.5) {
        this.phase = 'close'; this.seq = 0; this.drag = false;
        G.flags.returned = true;
        sfx.chime();
      }
    } else if (this.phase === 'turn' && this.turnStart != null) {
      if (Math.abs(p.x - this.turnStart) > L.W * 0.13) {
        this.phase = 'turning'; this.seq = 0; this.turnStart = null;
        sfx.flip();
      }
    }
  },
  up() { this.drag = false; this.turnStart = null; },
  update(dt) {
    this.seq += dt;
    if (this.phase === 'close' && this.seq > 1.1) { this.phase = 'closed'; this.seq = 0; }
    else if (this.phase === 'closed' && this.seq > 0.7) { this.phase = 'open'; this.seq = 0; }
    else if (this.phase === 'open' && this.seq > 1.0) { this.phase = 'turn'; this.seq = 0; }
    else if (this.phase === 'turning' && this.seq > 1.2) {
      this.phase = 'done'; this.seq = 0;
      sfx.big();
      for (let i = 0; i < 16; i++) {
        this.motes.push({
          fx: 0.3 + Math.random() * 0.4, fy: 0.3 + Math.random() * 0.3,
          vx: (Math.random() - 0.5) * 0.06, vy: -0.03 - Math.random() * 0.05,
          t: 0, col: ['#f2e3c0', '#eed9a8', '#f6efd8'][i % 3],
        });
      }
    } else if (this.phase === 'done') {
      for (const m of this.motes) { m.fx += m.vx * dt; m.fy += m.vy * dt; m.t += dt; }
      if (this.seq > 1.8) G.go('menu');
    }
  },
  drawOpenBook(ctx, la, rightPageImg, litSlot) {
    // book base
    ctx.fillStyle = '#3a5440';
    rr(ctx, la.spread.x - 10, la.spread.y - 8, la.spread.w + 20, la.spread.h + 20, 12);
    ctx.fill();
    // left page
    ctx.fillStyle = '#e9dfc2';
    rr(ctx, la.spread.x + 6, la.spread.y + 6, la.spread.w / 2 - 10, la.spread.h - 12, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,95,60,0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = la.spread.y + la.spread.h * (0.2 + i * 0.11);
      ctx.beginPath();
      ctx.moveTo(la.spread.x + la.spread.w * 0.08, y);
      ctx.lineTo(la.spread.x + la.spread.w * 0.42, y + Math.sin(i * 3) * 2);
      ctx.stroke();
    }
    // right side
    ctx.fillStyle = '#e2d5b2';
    rr(ctx, la.rp.x, la.rp.y, la.rp.w, la.rp.h, 6);
    ctx.fill();
    if (litSlot) {
      ctx.fillStyle = 'rgba(90,70,45,0.25)';
      rr(ctx, la.slot.x, la.slot.y, la.slot.w, la.slot.h, 6);
      ctx.fill();
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = `rgba(255,220,140,${0.6 + 0.3 * Math.sin(G.time * 3)})`;
      ctx.lineWidth = 3;
      rr(ctx, la.slot.x, la.slot.y, la.slot.w, la.slot.h, 6);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (rightPageImg) {
      ctx.drawImage(rightPageImg, la.slot.x, la.slot.y, la.slot.w, la.slot.h);
    }
    // gutter shadow
    const gs = ctx.createLinearGradient(la.spread.x + la.spread.w / 2 - 18, 0, la.spread.x + la.spread.w / 2 + 18, 0);
    gs.addColorStop(0, 'rgba(60,40,20,0)');
    gs.addColorStop(0.5, 'rgba(60,40,20,0.35)');
    gs.addColorStop(1, 'rgba(60,40,20,0)');
    ctx.fillStyle = gs;
    ctx.fillRect(la.spread.x + la.spread.w / 2 - 18, la.spread.y, 36, la.spread.h);
  },
  render(ctx, L) {
    roomBg(ctx, L, '');
    const la = this.lay(L);
    const ph = this.phase;
    if (ph === 'place') {
      this.drawOpenBook(ctx, la, null, true);
      const px = this.pos.fx * L.W, py = this.pos.fy * L.H;
      const pw = la.slot.w * 0.8, phh = pw * (580 / 440);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(this.drag ? Math.sin(G.time * 6) * 0.02 : 0.03);
      ctx.shadowColor = 'rgba(40,25,10,0.35)';
      ctx.shadowBlur = 10;
      ctx.drawImage(G.paper.pageImg(0), -pw / 2, -phh / 2, pw, phh);
      ctx.restore();
      if (hint.idle > 4) {
        hintGesture(ctx, 'drag', px, py, la.slot.x + la.slot.w / 2, la.slot.y + la.slot.h / 2, G.time);
      }
    } else if (ph === 'close' || ph === 'closed' || ph === 'open') {
      const t = ph === 'close' ? ease(Math.min(1, this.seq / 1.0))
        : ph === 'closed' ? 1 : 1 - ease(Math.min(1, this.seq / 0.9));
      this.drawOpenBook(ctx, la, G.paper.pageImg(0), false);
      // cover sweeping over from the right
      if (t > 0.01) {
        const cw = (la.spread.w / 2 + 14) * t;
        ctx.save();
        const g = ctx.createLinearGradient(la.spread.x + la.spread.w - cw, 0, la.spread.x + la.spread.w, 0);
        g.addColorStop(0, '#4c6b4f');
        g.addColorStop(1, '#3a5440');
        ctx.fillStyle = g;
        rr(ctx, la.spread.x + la.spread.w / 2 + (la.spread.w / 2) * (1 - t) - 6, la.spread.y - 8,
          cw + 10, la.spread.h + 16, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(212,178,90,0.85)';
        ctx.lineWidth = 2.5;
        rr(ctx, la.spread.x + la.spread.w / 2 + (la.spread.w / 2) * (1 - t) + 8, la.spread.y + 6,
          Math.max(4, cw - 22), la.spread.h - 12, 8);
        ctx.stroke();
        ctx.restore();
      }
    } else if (ph === 'turn' || ph === 'turning' || ph === 'done') {
      const done = ph === 'done';
      const tt = ph === 'turning' ? ease(Math.min(1, this.seq / 1.1)) : done ? 1 : 0;
      // base: next page underneath (plain old paper — no regenerated art)
      this.drawOpenBook(ctx, la, null, false);
      if (tt < 1) {
        // restored page turning like a leaf
        const cx2 = la.spread.x + la.spread.w / 2;
        ctx.save();
        ctx.translate(cx2, la.slot.y);
        const sc = Math.cos(tt * Math.PI * 0.5);
        ctx.scale(Math.max(0.03, sc), 1);
        ctx.shadowColor = 'rgba(40,25,10,0.3)';
        ctx.shadowBlur = 8 + tt * 14;
        ctx.drawImage(G.paper.pageImg(0), 4, 0, la.slot.w, la.slot.h);
        ctx.restore();
      } else {
        // page has turned to the left side, showing its back: blank paper
        // with only a faint mirrored bleed-through of the media (consistent
        // with the dry-scene back face)
        ctx.save();
        ctx.translate(la.spread.x + la.spread.w / 2, la.slot.y);
        ctx.scale(-1, 1);
        const bw = la.slot.w * 0.94;
        ctx.fillStyle = '#e9dcbc';
        ctx.fillRect(8, 0, bw, la.slot.h);
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.25;
        ctx.drawImage(G.paper.pageImg(0), 8, 0, bw, la.slot.h);
        ctx.restore();
      }
      if (ph === 'turn' && hint.idle > 3) {
        hintGesture(ctx, 'swipe', la.slot.x + la.slot.w * 0.7, la.slot.y + la.slot.h / 2,
          la.spread.x + la.spread.w * 0.25, la.slot.y + la.slot.h / 2, G.time);
      }
      // celebration motes
      for (const m of this.motes) {
        const a = Math.max(0, 1 - m.t / 2.5);
        ctx.fillStyle = m.col;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(m.fx * L.W, m.fy * L.H, 3 + Math.sin(m.t * 6) * 1.5, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  },
  qa(L) {
    const la = this.lay(L);
    return {
      page: { x: this.pos.fx * L.W, y: this.pos.fy * L.H },
      slot: { x: la.slot.x + la.slot.w / 2, y: la.slot.y + la.slot.h / 2 },
      phase: this.phase,
    };
  },
};

// ---------------------------------------------------------------- picture menu
export const sceneMenu = {
  enter() { },
  lay(L) {
    const { W, H, portrait } = L;
    const cards = [];
    if (portrait) {
      const cw = Math.min(W * 0.74, 360), ch = Math.min(H * 0.19, 150);
      for (let i = 0; i < 3; i++) {
        cards.push({ x: (W - cw) / 2, y: H * 0.16 + i * (ch + H * 0.045), w: cw, h: ch });
      }
    } else {
      const cw = Math.min(W * 0.26, 300), ch = Math.min(H * 0.42, 260);
      for (let i = 0; i < 3; i++) {
        cards.push({ x: W * 0.5 + (i - 1.5) * (cw + W * 0.03) + W * 0.015, y: H * 0.28, w: cw, h: ch });
      }
    }
    return { cards };
  },
  down(p) {
    const la = this.lay(G.L);
    for (let i = 0; i < 3; i++) {
      if (inRect(p.x, p.y, la.cards[i], 16)) {
        sfx.chime();
        if (i === 0) { newGame('same'); G.go('book'); }
        else if (i === 1) { newGame('new'); G.go('book'); }
        else G.go('free');
        return;
      }
    }
  },
  update() { },
  render(ctx, L) {
    roomBg(ctx, L, '');
    ctx.fillStyle = 'rgba(45,35,25,0.35)';
    ctx.fillRect(0, 0, L.W, L.H);
    const la = this.lay(L);
    for (let i = 0; i < 3; i++) {
      const c = la.cards[i];
      ctx.save();
      ctx.shadowColor = 'rgba(30,20,10,0.35)';
      ctx.shadowBlur = 14;
      rr(ctx, c.x, c.y, c.w, c.h, 18);
      ctx.fillStyle = '#f8f1de';
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#b99e6d'; ctx.lineWidth = 3;
      rr(ctx, c.x, c.y, c.w, c.h, 18);
      ctx.stroke();
      const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      const s = Math.min(c.w, c.h);
      if (i === 0) {
        // same page again: thumbnail + circular arrows
        const tw = s * 0.5, th = tw * (580 / 440);
        ctx.drawImage(G.paper.pageImg(0), cx - tw / 2 - s * 0.22, cy - th / 2, tw, th);
        ctx.strokeStyle = '#4c6b4f'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        const ax = cx + s * 0.28;
        ctx.beginPath(); ctx.arc(ax, cy, s * 0.2, -0.6, 2.2); ctx.stroke();
        ctx.beginPath(); ctx.arc(ax, cy, s * 0.2, Math.PI - 0.6, Math.PI + 2.2); ctx.stroke();
        const arrow = (a) => {
          const x = ax + Math.cos(a) * s * 0.2, y = cy + Math.sin(a) * s * 0.2;
          ctx.beginPath();
          ctx.moveTo(x - 8, y - 2); ctx.lineTo(x + 4, y - 8); ctx.lineTo(x + 2, y + 8);
          ctx.closePath();
          ctx.fillStyle = '#4c6b4f';
          ctx.fill();
        };
        arrow(-0.6); arrow(Math.PI - 0.6);
      } else if (i === 1) {
        // new damage: page silhouette with different holes
        const tw = s * 0.5, th = tw * 1.3;
        ctx.fillStyle = '#e9dcbc';
        rr(ctx, cx - tw / 2, cy - th / 2, tw, th, 4);
        ctx.fill();
        ctx.strokeStyle = '#b99e6d'; ctx.lineWidth = 2;
        rr(ctx, cx - tw / 2, cy - th / 2, tw, th, 4);
        ctx.stroke();
        ctx.fillStyle = '#f8f1de';
        ctx.strokeStyle = '#8b6d49';
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(cx - tw * 0.15, cy - th * 0.2, s * 0.07, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cx + tw * 0.18, cy + th * 0.18, s * 0.09, s * 0.05, 0.5, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        // sparkle
        ctx.strokeStyle = '#d4a24a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        const sx2 = cx + tw * 0.55, sy2 = cy - th * 0.3;
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2 + Math.PI / 4;
          ctx.beginPath();
          ctx.moveTo(sx2 + Math.cos(a) * 4, sy2 + Math.sin(a) * 4);
          ctx.lineTo(sx2 + Math.cos(a) * 12, sy2 + Math.sin(a) * 12);
          ctx.stroke();
        }
      } else {
        // free play: bowl with colorful swirl
        ctx.fillStyle = '#f4efe6';
        ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.1, s * 0.3, s * 0.18, 0, 0, Math.PI); ctx.fill();
        ctx.strokeStyle = '#b9a98e'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.1, s * 0.3, s * 0.18, 0, 0, Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.1, s * 0.3, s * 0.1, 0, 0, TAU); ctx.stroke();
        const cols = ['#ef9db4', '#eecb74', '#93d3ac', '#8db9dd', '#b49ede'];
        for (let k = 0; k < 5; k++) {
          ctx.strokeStyle = cols[k]; ctx.lineWidth = 5; ctx.lineCap = 'round';
          ctx.beginPath();
          const a0 = k * 1.3 + G.time * 0.8;
          ctx.arc(cx + Math.cos(k * 2) * s * 0.08, cy + s * 0.05 + Math.sin(k) * s * 0.03,
            s * (0.05 + k * 0.02), a0, a0 + 2.2);
          ctx.stroke();
        }
      }
    }
    if (hint.idle > 5) {
      const c = la.cards[0];
      hintGesture(ctx, 'tap', c.x + c.w / 2, c.y + c.h / 2, 0, 0, G.time);
    }
  },
  qa(L) {
    const la = this.lay(L);
    return { cards: la.cards.map(c => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 })) };
  },
};
