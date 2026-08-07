/* 水しぶき・霧・埃のパーティクル */
(function (root) {
  'use strict';
  var DD = (root.DD = root.DD || {});
  var U = DD.util;

  function Particles(max) {
    this.max = max;
    this.n = 0;
    this.x = new Float32Array(max); this.y = new Float32Array(max); this.z = new Float32Array(max);
    this.vx = new Float32Array(max); this.vy = new Float32Array(max); this.vz = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max); this.size1 = new Float32Array(max);
    this.kind = new Float32Array(max);
    this.r = new Float32Array(max); this.g = new Float32Array(max); this.b = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.floorY = new Float32Array(max);
    this.data = new Float32Array(max * 11);
    this.count = 0;
  }

  Particles.prototype.spawn = function (o) {
    var i;
    if (this.n < this.max) i = this.n++;
    else {
      // 最も寿命が短いものを再利用
      i = (Math.random() * this.max) | 0;
    }
    this.x[i] = o.x; this.y[i] = o.y; this.z[i] = o.z;
    this.vx[i] = o.vx || 0; this.vy[i] = o.vy || 0; this.vz[i] = o.vz || 0;
    this.maxLife[i] = o.life; this.life[i] = o.life;
    this.size[i] = o.size; this.size1[i] = o.size1 === undefined ? o.size : o.size1;
    this.kind[i] = o.kind || 0;
    this.r[i] = o.r === undefined ? 1.0 : o.r;
    this.g[i] = o.g === undefined ? 1.0 : o.g;
    this.b[i] = o.b === undefined ? 1.0 : o.b;
    this.drag[i] = o.drag === undefined ? 0.5 : o.drag;
    this.grav[i] = o.grav === undefined ? 9.8 : o.grav;
    this.floorY[i] = o.floorY === undefined ? -1e9 : o.floorY;
    return i;
  };

  Particles.prototype.update = function (dt) {
    var n = this.n, w = 0, d = this.data;
    for (var i = 0; i < n; i++) {
      var l = this.life[i] - dt;
      if (l <= 0) { this.life[i] = 0; continue; }
      this.life[i] = l;
      var k = Math.exp(-this.drag[i] * dt);
      this.vx[i] *= k; this.vz[i] *= k;
      this.vy[i] = (this.vy[i] - this.grav[i] * dt) * k;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.z[i] += this.vz[i] * dt;
      if (this.y[i] < this.floorY[i]) { this.life[i] = 0; continue; }
      var t = 1 - l / this.maxLife[i];
      var alpha;
      if (this.kind[i] > 0.5) alpha = Math.sin(Math.PI * Math.pow(t, 0.55)) * 0.55;
      else alpha = (1 - t * t) * 0.95;
      var sz = this.size[i] + (this.size1[i] - this.size[i]) * t;
      var o = w * 11;
      d[o] = this.x[i]; d[o + 1] = this.y[i]; d[o + 2] = this.z[i];
      d[o + 3] = sz; d[o + 4] = alpha; d[o + 5] = this.kind[i];
      d[o + 6] = 0; d[o + 7] = 0;
      d[o + 8] = this.r[i]; d[o + 9] = this.g[i]; d[o + 10] = this.b[i];
      w++;
    }
    // 生存しているものを前に詰める
    var wi = 0;
    for (var j = 0; j < n; j++) {
      if (this.life[j] <= 0) continue;
      if (wi !== j) {
        this.x[wi] = this.x[j]; this.y[wi] = this.y[j]; this.z[wi] = this.z[j];
        this.vx[wi] = this.vx[j]; this.vy[wi] = this.vy[j]; this.vz[wi] = this.vz[j];
        this.life[wi] = this.life[j]; this.maxLife[wi] = this.maxLife[j];
        this.size[wi] = this.size[j]; this.size1[wi] = this.size1[j];
        this.kind[wi] = this.kind[j];
        this.r[wi] = this.r[j]; this.g[wi] = this.g[j]; this.b[wi] = this.b[j];
        this.drag[wi] = this.drag[j]; this.grav[wi] = this.grav[j];
        this.floorY[wi] = this.floorY[j];
      }
      wi++;
    }
    this.n = wi;
    this.count = w;
  };

  DD.Particles = Particles;
})(typeof window !== 'undefined' ? window : this);
