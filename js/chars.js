/* ============================================================
   ぬいぬい！ フェルトタウン — chars.js
   フェルト人形の住民（うさぎ・くま・ねこ）
   ============================================================ */
'use strict';

// 住民の見た目定義
const CHAR_DEFS = [
  { kind: 'bunny', body: '#fff4f8', inner: '#ffb7d2', cheek: '#ffa8c8' },
  { kind: 'bear',  body: '#f5d9ac', inner: '#e8b877', cheek: '#f0a878' },
  { kind: 'cat',   body: '#dcd0f5', inner: '#b39ce0', cheek: '#d8a8e8' }
];

class Resident {
  constructor(def, x, y, seed) {
    this.def = def;
    this.x = x; this.y = y;
    this.tx = x; this.ty = y;
    this.seed = seed;
    this.rnd = U.mulberry32(seed);
    this.phase = this.rnd() * 100;
    this.state = 'idle';       // idle | walk | cheer
    this.stateT = 0;
    this.speed = 55 + this.rnd() * 25;
    this.flip = 1;
    this.waitT = 1 + this.rnd() * 3;
    this.home = null;          // お気に入りスポットID
  }

  goto(x, y) {
    this.tx = x; this.ty = y;
    this.state = 'walk';
    this.flip = x < this.x ? -1 : 1;
  }

  cheerNow(dur) {
    this.state = 'cheer';
    this.stateT = dur || 2.2;
  }

  update(dt) {
    this.phase += dt;
    if (this.state === 'walk') {
      const d = U.dist(this.x, this.y, this.tx, this.ty);
      if (d < 4) { this.state = 'idle'; this.waitT = 1.5 + this.rnd() * 3.5; }
      else {
        const v = Math.min(this.speed * dt, d);
        this.x += (this.tx - this.x) / d * v;
        this.y += (this.ty - this.y) / d * v;
      }
    } else if (this.state === 'cheer') {
      this.stateT -= dt;
      if (this.stateT <= 0) this.state = 'idle';
    } else {
      this.waitT -= dt;
    }
  }

  // size: 基準身長（ピクセル）
  draw(ctx, size) {
    const s = size / 100;
    const t = this.phase;
    let hop = 0, squash = 1, rot = 0;
    if (this.state === 'walk') {
      hop = Math.abs(Math.sin(t * 9)) * 8;
      rot = Math.sin(t * 9) * 0.08;
    } else if (this.state === 'cheer') {
      hop = Math.abs(Math.sin(t * 11)) * 16;
      squash = 1 + Math.sin(t * 11) * 0.06;
      rot = Math.sin(t * 5.5) * 0.15;
    } else {
      squash = 1 + Math.sin(t * 2.2) * 0.02; // 呼吸
    }
    ctx.save();
    ctx.translate(this.x, this.y);
    // 足元の影
    ctx.beginPath();
    ctx.ellipse(0, 2, 26 * s, 8 * s, 0, 0, U.TAU);
    ctx.fillStyle = 'rgba(120,70,110,0.18)';
    ctx.fill();
    ctx.translate(0, -hop * s);
    ctx.rotate(rot);
    ctx.scale(this.flip * s / squash, s * squash);
    this.drawBody(ctx);
    ctx.restore();
  }

  drawBody(ctx) {
    const d = this.def;
    const dark = U.shade(d.body, -0.35);
    ctx.lineCap = 'round';
    // 胴体（まんまるフェルト）
    const bodyGrad = ctx.createRadialGradient(-8, -46, 6, 0, -36, 44);
    bodyGrad.addColorStop(0, U.shade(d.body, 0.25));
    bodyGrad.addColorStop(1, d.body);
    ctx.beginPath();
    ctx.ellipse(0, -30, 26, 30, 0, 0, U.TAU);
    ctx.fillStyle = bodyGrad; ctx.fill();
    ctx.strokeStyle = U.rgba(dark, 0.5);
    ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
    // おなか
    ctx.beginPath();
    ctx.ellipse(0, -24, 14, 16, 0, 0, U.TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
    // 頭
    ctx.beginPath();
    ctx.arc(0, -66, 24, 0, U.TAU);
    ctx.fillStyle = bodyGrad; ctx.fill();
    ctx.strokeStyle = U.rgba(dark, 0.5);
    ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
    // 耳
    if (d.kind === 'bunny') {
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(dir * 10, -96, 7, 18, dir * 0.18, 0, U.TAU);
        ctx.fillStyle = d.body; ctx.fill();
        ctx.strokeStyle = U.rgba(dark, 0.5); ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(dir * 10, -94, 3.5, 12, dir * 0.18, 0, U.TAU);
        ctx.fillStyle = d.inner; ctx.fill();
      }
    } else if (d.kind === 'bear') {
      for (const dir of [-1, 1]) {
        ctx.beginPath(); ctx.arc(dir * 16, -84, 9, 0, U.TAU);
        ctx.fillStyle = d.body; ctx.fill();
        ctx.strokeStyle = U.rgba(dark, 0.5); ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(dir * 16, -84, 4.5, 0, U.TAU);
        ctx.fillStyle = d.inner; ctx.fill();
      }
    } else { // cat
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(dir * 6, -84);
        ctx.lineTo(dir * 20, -96);
        ctx.lineTo(dir * 20, -78);
        ctx.closePath();
        ctx.fillStyle = d.body; ctx.fill();
        ctx.strokeStyle = U.rgba(dark, 0.5); ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(dir * 10, -84);
        ctx.lineTo(dir * 17, -90);
        ctx.lineTo(dir * 17, -81);
        ctx.closePath();
        ctx.fillStyle = d.inner; ctx.fill();
      }
    }
    // 目（刺繍のようなつぶらな目）
    const blink = Math.sin(this.phase * 0.7) > 0.985;
    for (const dir of [-1, 1]) {
      if (blink) {
        ctx.strokeStyle = '#5a3b52'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(dir * 9, -68, 3.5, 0.2, Math.PI - 0.2);
        ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(dir * 9, -68, 3.2, 0, U.TAU);
        ctx.fillStyle = '#5a3b52'; ctx.fill();
        ctx.beginPath(); ctx.arc(dir * 9 - 1, -69, 1.1, 0, U.TAU);
        ctx.fillStyle = '#fff'; ctx.fill();
      }
    }
    // ほっぺ
    for (const dir of [-1, 1]) {
      ctx.beginPath(); ctx.arc(dir * 15, -61, 4.5, 0, U.TAU);
      ctx.fillStyle = U.rgba(d.cheek, 0.55); ctx.fill();
    }
    // 口（にっこりステッチ）
    ctx.strokeStyle = '#5a3b52'; ctx.lineWidth = 2;
    ctx.beginPath();
    if (this.state === 'cheer') {
      ctx.arc(0, -60, 5, 0.15, Math.PI - 0.15);
    } else {
      ctx.arc(0, -62, 3.5, 0.3, Math.PI - 0.3);
    }
    ctx.stroke();
    // 手（ちいさなまる）
    const wave = this.state === 'cheer' ? Math.sin(this.phase * 11) * 14 : 0;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(dir * 24, -34 - (dir === 1 ? wave : -wave * 0.4), 7, 0, U.TAU);
      ctx.fillStyle = d.body; ctx.fill();
      ctx.strokeStyle = U.rgba(dark, 0.5); ctx.lineWidth = 2; ctx.stroke();
    }
    // 足
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(dir * 11, -3, 9, 6, 0, 0, U.TAU);
      ctx.fillStyle = U.shade(d.body, -0.06); ctx.fill();
      ctx.strokeStyle = U.rgba(dark, 0.5); ctx.lineWidth = 2; ctx.stroke();
    }
  }
}
