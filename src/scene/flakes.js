// 箔くず — the scraps.
//
// Two moments in the real work throw gold into the air. 箔切り cuts the beaten
// leaf back to 109 mm and the ragged offcut falls away; and when the leaf has
// been pressed down, the overhang past the edge of the piece — the 箔足 — is
// swept off with the brush. Both are tiny, weightless and catch the light on
// the way down, so they are simulated rather than faked with a sprite sheet.

import { clamp } from '../core/math.js';

const MAX = 220;

export class Flakes {
  constructor(gl) {
    this.gl = gl;
    this.count = MAX;
    this.live = 0;
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.seed = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.next = 0;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    this.vboP = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboP);
    gl.bufferData(gl.ARRAY_BUFFER, this.pos, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    this.vboS = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboS);
    gl.bufferData(gl.ARRAY_BUFFER, this.seed, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.vao = vao;
    this.intensity = 0;
    this.color = [1.0, 0.80, 0.36];
  }

  /** Shed `n` scraps from a ring of radius `r` around (x, y, z). */
  burstRing(x, y, z, r, n = 40, speed = 0.06) {
    for (let i = 0; i < n; i++) {
      const k = this.next; this.next = (this.next + 1) % MAX;
      const a = Math.random() * Math.PI * 2;
      const rr = r * (0.86 + Math.random() * 0.30);
      this.pos[k * 3] = x + Math.cos(a) * rr;
      this.pos[k * 3 + 1] = y + Math.random() * 0.004;
      this.pos[k * 3 + 2] = z + Math.sin(a) * rr;
      this.vel[k * 3] = Math.cos(a) * speed * (0.4 + Math.random());
      this.vel[k * 3 + 1] = speed * (0.5 + Math.random() * 1.2);
      this.vel[k * 3 + 2] = Math.sin(a) * speed * (0.4 + Math.random());
      this.seed[k * 3] = Math.random();
      this.seed[k * 3 + 1] = 0.4 + Math.random() * 0.6;
      this.seed[k * 3 + 2] = Math.random();
      this.life[k] = 1;
    }
    this.intensity = 1.5;
  }

  /** Shed scraps from a point, e.g. where the brush is sweeping. */
  burstAt(x, y, z, n = 8, speed = 0.05) {
    this.burstRing(x, y, z, 0.006, n, speed);
  }

  update(dt) {
    let live = 0;
    for (let k = 0; k < MAX; k++) {
      if (this.life[k] <= 0) continue;
      live++;
      // Gold at a tenth of a micron has almost no mass and enormous drag: it
      // does not fall, it wanders down.
      const drag = Math.exp(-2.6 * dt);
      this.vel[k * 3] *= drag;
      this.vel[k * 3 + 2] *= drag;
      this.vel[k * 3 + 1] = this.vel[k * 3 + 1] * drag - 0.020 * dt;
      const flutter = 0.010 * Math.sin(this.seed[k * 3] * 30 + this.life[k] * 12);
      this.pos[k * 3] += (this.vel[k * 3] + flutter) * dt;
      this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt;
      this.pos[k * 3 + 2] += (this.vel[k * 3 + 2] - flutter * 0.6) * dt;
      this.life[k] = Math.max(0, this.life[k] - dt * 0.22);
      this.seed[k * 3 + 2] = this.life[k];      // fed to the shader as brightness
      if (this.pos[k * 3 + 1] < 0.0008) {
        this.pos[k * 3 + 1] = 0.0008;
        this.vel[k * 3 + 1] = 0;
        this.life[k] = Math.max(0, this.life[k] - dt * 0.9);
      }
    }
    this.live = live;
    this.intensity = clamp(live / 30, 0, 1.6);
    if (live > 0) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vboP);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.pos);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vboS);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.seed);
    }
  }
}
