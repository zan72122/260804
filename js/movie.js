// ------------------------------------------------------------------
// movie.js — paints the animated "film" onto a canvas used as the
// screen texture. Three themes: ocean / meadow / space.
// tap(u, v) makes the characters react.
// ------------------------------------------------------------------
export const THEMES = ['ocean', 'meadow', 'space'];

export class MoviePainter {
  constructor(w = 1024, h = 576) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.theme = 'meadow';
    this.t = 0;
    this.jump = 0;          // character reaction timer
    this.bursts = [];       // tap star bursts {x,y,t}
    this.paintWhite();
  }

  setTheme(name) { this.theme = name; }

  paintWhite() {
    const { ctx, canvas } = this;
    const g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 60,
      canvas.width / 2, canvas.height / 2, canvas.width * 0.7);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#e8e6e0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  tap(u, v) {
    this.jump = 1;
    this.bursts.push({ x: u * this.canvas.width, y: v * this.canvas.height, t: 0 });
    if (this.bursts.length > 6) this.bursts.shift();
  }

  update(dt) {
    this.t += dt;
    this.jump = Math.max(0, this.jump - dt * 1.2);
    for (const b of this.bursts) b.t += dt;
    this.bursts = this.bursts.filter(b => b.t < 1);
    const { ctx } = this;
    ctx.save();
    if (this.theme === 'ocean') this._ocean();
    else if (this.theme === 'space') this._space();
    else this._meadow();
    this._drawBursts();
    ctx.restore();
  }

  _drawBursts() {
    const { ctx } = this;
    for (const b of this.bursts) {
      const n = 7, r = 20 + b.t * 130, a = 1 - b.t;
      ctx.save();
      ctx.globalAlpha = a;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + b.t * 2;
        const x = b.x + Math.cos(ang) * r, y = b.y + Math.sin(ang) * r;
        this._star(x, y, 9 * (1 - b.t * 0.5), '#fff27d');
      }
      ctx.restore();
    }
  }

  _star(x, y, r, color) {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }

  _face(x, y, r, look = 0) { // simple happy face
    const { ctx } = this;
    ctx.fillStyle = '#2b2b33';
    ctx.beginPath(); ctx.arc(x - r * 0.5 + look, y - r * 0.15, r * 0.16, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.5 + look, y - r * 0.15, r * 0.16, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = r * 0.11; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x + look, y + r * 0.22, r * 0.34, 0.25, Math.PI - 0.25); ctx.stroke();
  }

  // ================= OCEAN =================
  _ocean() {
    const { ctx, canvas: c } = this, t = this.t, W = c.width, H = c.height;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#5ed4f7'); g.addColorStop(0.45, '#1e8fd8'); g.addColorStop(1, '#0b4f96');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // sun rays through water
    ctx.save();
    ctx.globalAlpha = 0.16; ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      const x = W * (0.15 + i * 0.24) + Math.sin(t * 0.5 + i) * 30;
      ctx.beginPath();
      ctx.moveTo(x - 18, 0); ctx.lineTo(x + 18, 0);
      ctx.lineTo(x + 90, H); ctx.lineTo(x - 90, H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // sea floor
    ctx.fillStyle = '#e8c37a';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H - 46 - Math.sin(x * 0.02 + 1) * 14);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();

    // seaweed
    for (let i = 0; i < 5; i++) {
      const bx = W * (0.08 + i * 0.21), sway = Math.sin(t * 1.4 + i * 1.7) * 16;
      ctx.strokeStyle = i % 2 ? '#2fae6b' : '#37c97e'; ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx, H - 40);
      ctx.quadraticCurveTo(bx + sway * 0.4, H - 105, bx + sway, H - 170 - (i % 3) * 22);
      ctx.stroke();
    }

    // whale (slow pass, right to left)
    const wx = W * 1.3 - ((t * 36) % (W * 1.9)), wy = H * 0.3 + Math.sin(t * 0.9) * 16;
    ctx.fillStyle = '#7f9fe8';
    ctx.beginPath(); ctx.ellipse(wx, wy, 105, 58, 0, 0, 7); ctx.fill();
    ctx.beginPath(); // tail
    ctx.moveTo(wx + 92, wy);
    ctx.quadraticCurveTo(wx + 150, wy - 52 + Math.sin(t * 5) * 9, wx + 168, wy - 34);
    ctx.quadraticCurveTo(wx + 148, wy, wx + 168, wy + 34);
    ctx.quadraticCurveTo(wx + 150, wy + 30, wx + 92, wy + 8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#cfe0ff';
    ctx.beginPath(); ctx.ellipse(wx - 8, wy + 30, 78, 24, 0, 0, 7); ctx.fill();
    this._face(wx - 46, wy - 8, 26);

    // fish trio, bobbing sine paths; they leap when tapped
    const cols = ['#ffb339', '#ff6b81', '#ffd94d'];
    for (let i = 0; i < 3; i++) {
      const fx = ((t * (70 + i * 22) + i * 340) % (W + 220)) - 110;
      const fy = H * (0.52 + i * 0.13) + Math.sin(t * 2 + i * 2) * 22 - this.jump * 90 * Math.sin(this.jump * Math.PI);
      ctx.save(); ctx.translate(fx, fy);
      ctx.fillStyle = cols[i];
      ctx.beginPath(); ctx.ellipse(0, 0, 40, 24, 0, 0, 7); ctx.fill();
      const flap = Math.sin(t * 9 + i) * 10;
      ctx.beginPath();
      ctx.moveTo(-34, 0); ctx.lineTo(-62, -18 + flap); ctx.lineTo(-62, 18 + flap);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2b2b33';
      ctx.beginPath(); ctx.arc(20, -6, 4.6, 0, 7); ctx.fill();
      ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(22, 4, 7, 0.4, Math.PI - 0.9); ctx.stroke();
      ctx.restore();
    }

    // bubbles
    for (let i = 0; i < 9; i++) {
      const by = H - ((t * (34 + i * 9) + i * 140) % (H + 60));
      const bx = W * ((i * 0.117 + 0.06) % 1) + Math.sin(t * 2 + i) * 12;
      ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(bx, by, 5 + (i % 3) * 4, 0, 7); ctx.stroke();
    }
  }

  // ================= MEADOW =================
  _meadow() {
    const { ctx, canvas: c } = this, t = this.t, W = c.width, H = c.height;
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    g.addColorStop(0, '#7ec9ff'); g.addColorStop(1, '#cdeeff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // sun with slowly rotating rays
    const sx = W * 0.82, sy = H * 0.18;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.2);
    ctx.strokeStyle = '#ffd94d'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(88, 0); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#ffdf5e';
    ctx.beginPath(); ctx.arc(sx, sy, 52, 0, 7); ctx.fill();
    this._face(sx, sy, 26);

    // clouds
    for (let i = 0; i < 3; i++) {
      const cx = ((t * (14 + i * 6) + i * 400) % (W + 300)) - 150;
      const cy = H * (0.12 + i * 0.09);
      ctx.fillStyle = 'rgba(255,255,255,.94)';
      for (const [dx, dy, r] of [[-45, 8, 26], [0, 0, 38], [45, 10, 26]]) {
        ctx.beginPath(); ctx.arc(cx + dx, cy + dy, r, 0, 7); ctx.fill();
      }
    }

    // hills (three depths)
    const hills = [['#8fd977', 0.72, 0.9], ['#63c257', 0.8, 1.3], ['#3fa348', 0.9, 1.8]];
    hills.forEach(([col, base, fr], hi) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 24)
        ctx.lineTo(x, H * base - Math.sin(x * 0.004 * fr + hi * 2) * H * 0.1);
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    });

    // flowers swaying
    for (let i = 0; i < 8; i++) {
      const fx = W * (0.05 + i * 0.125), fy = H * 0.9 + (i % 2) * 20;
      const sw = Math.sin(t * 2 + i * 1.4) * 7;
      ctx.strokeStyle = '#2f7d33'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(fx, fy + 34); ctx.quadraticCurveTo(fx, fy + 10, fx + sw, fy); ctx.stroke();
      const cols = ['#ff8fb3', '#ffd94d', '#c39bff', '#ff9e5e'];
      ctx.fillStyle = cols[i % 4];
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2 + i;
        ctx.beginPath(); ctx.arc(fx + sw + Math.cos(a) * 13, fy + Math.sin(a) * 13, 9, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#fff1b8';
      ctx.beginPath(); ctx.arc(fx + sw, fy, 8, 0, 7); ctx.fill();
    }

    // bunny hops across; big jump when tapped
    const span = W + 260;
    const bx = ((t * 95) % span) - 130;
    const hop = Math.abs(Math.sin(t * 5.2)) * 46 + this.jump * 130 * Math.sin(this.jump * Math.PI);
    const by = H * 0.82 - hop;
    ctx.save(); ctx.translate(bx, by);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(0, 0, 44, 36, 0, 0, 7); ctx.fill();       // body
    ctx.beginPath(); ctx.arc(34, -26, 27, 0, 7); ctx.fill();               // head
    const earFlop = Math.sin(t * 5.2) * 0.2;
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(34 + s * 10, -46); ctx.rotate(s * 0.25 + earFlop);
      ctx.beginPath(); ctx.ellipse(0, -20, 8.5, 24, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffc9d6';
      ctx.beginPath(); ctx.ellipse(0, -18, 4, 15, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.restore();
    }
    ctx.beginPath(); ctx.arc(-38, 6, 13, 0, 7); ctx.fill();                // tail
    this._face(34, -24, 15, 2);
    ctx.restore();

    // butterflies
    for (let i = 0; i < 3; i++) {
      const px = W * (0.2 + i * 0.3) + Math.sin(t * 0.9 + i * 2.4) * 90;
      const py = H * 0.45 + Math.cos(t * 1.3 + i) * 46;
      const wing = Math.abs(Math.sin(t * 11 + i)) * 14 + 4;
      ctx.fillStyle = ['#ff8fb3', '#8fc7ff', '#ffd94d'][i];
      ctx.beginPath(); ctx.ellipse(px - wing * 0.6, py, wing, 11, -0.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(px + wing * 0.6, py, wing, 11, 0.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#463a4a';
      ctx.beginPath(); ctx.ellipse(px, py, 3.5, 9, 0, 0, 7); ctx.fill();
    }
  }

  // ================= SPACE =================
  _space() {
    const { ctx, canvas: c } = this, t = this.t, W = c.width, H = c.height;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#120a33'); g.addColorStop(0.6, '#2a1660'); g.addColorStop(1, '#471d78');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // twinkling stars (deterministic positions)
    for (let i = 0; i < 60; i++) {
      const x = (i * 137.5) % W, y = (i * 89.3) % (H * 0.9);
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i * 1.7));
      ctx.globalAlpha = tw;
      ctx.fillStyle = i % 5 === 0 ? '#ffe9a8' : '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, i % 4 === 0 ? 3 : 1.8, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // smiling moon
    const mx = W * 0.15, my = H * 0.2;
    ctx.fillStyle = '#fff3c2';
    ctx.beginPath(); ctx.arc(mx, my, 55, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8d99a';
    for (const [dx, dy, r] of [[-16, -12, 10], [18, 8, 8], [-4, 24, 6]]) {
      ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, 7); ctx.fill();
    }
    this._face(mx, my, 24);

    // ringed planet
    const px = W * 0.78, py = H * 0.62 + Math.sin(t * 0.5) * 12;
    ctx.save(); ctx.translate(px, py); ctx.rotate(-0.35);
    ctx.fillStyle = '#ff9e5e';
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffc39b';
    ctx.beginPath(); ctx.ellipse(-12, -10, 18, 12, 0.4, 0, 7); ctx.fill();
    ctx.strokeStyle = '#c9f0ff'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.ellipse(0, 0, 78, 24, 0, 0, 7); ctx.stroke();
    ctx.restore();

    // rocket on a wavy path; loops when tapped
    const span = W + 320;
    const rx = ((t * 120) % span) - 160;
    const wob = Math.sin(t * 2.4) * 40;
    const loop = this.jump * Math.PI * 2;
    const ry = H * 0.4 + wob - Math.sin(loop) * 60;
    const ang = Math.sin(t * 2.4) * 0.18 + (this.jump > 0 ? -Math.sin(loop) * 0.8 : 0);
    ctx.save(); ctx.translate(rx, ry); ctx.rotate(ang + Math.PI / 2 * 0); ctx.rotate(0.0);
    // flame
    const fl = 30 + Math.abs(Math.sin(t * 18)) * 22;
    ctx.fillStyle = '#ffb339';
    ctx.beginPath(); ctx.moveTo(-46, -12); ctx.lineTo(-46 - fl, 0); ctx.lineTo(-46, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe084';
    ctx.beginPath(); ctx.moveTo(-46, -6); ctx.lineTo(-46 - fl * 0.55, 0); ctx.lineTo(-46, 6); ctx.closePath(); ctx.fill();
    // body
    ctx.fillStyle = '#ececf4';
    ctx.beginPath();
    ctx.moveTo(52, 0);
    ctx.quadraticCurveTo(30, -26, -20, -22);
    ctx.lineTo(-46, -14); ctx.lineTo(-46, 14); ctx.lineTo(-20, 22);
    ctx.quadraticCurveTo(30, 26, 52, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff6b81'; // nose + fins
    ctx.beginPath(); ctx.moveTo(52, 0); ctx.quadraticCurveTo(40, -12, 26, -17); ctx.lineTo(26, 17); ctx.quadraticCurveTo(40, 12, 52, 0); ctx.closePath(); ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(-28, s * 18); ctx.lineTo(-52, s * 34); ctx.lineTo(-42, s * 12); ctx.closePath(); ctx.fill();
    }
    // porthole with face
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath(); ctx.arc(6, 0, 15, 0, 7); ctx.fill();
    ctx.strokeStyle = '#5b6b8c'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(6, 0, 15, 0, 7); ctx.stroke();
    this._face(6, 0, 8);
    ctx.restore();

    // shooting star
    const ss = (t * 0.31) % 1;
    if (ss < 0.22) {
      const p = ss / 0.22;
      const sx = W * (0.9 - p * 0.75), sy = H * (0.08 + p * 0.4);
      ctx.strokeStyle = `rgba(255,240,180,${1 - p})`; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 70, sy - 34); ctx.stroke();
      this._star(sx, sy, 10, '#fff2b0');
    }
  }
}
