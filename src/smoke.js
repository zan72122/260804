/* =========================================================================
   smoke.js — ビルボード粒子（煙・蜜のしぶき・きらめき）
   Points ではなく InstancedBufferGeometry の板を使い，iOS でも切れずに描く。
   ========================================================================= */
(function (global) {
  'use strict';

  var FX = {};

  var quadVert = [
    'attribute vec3 iPos;',
    'attribute vec4 iAttr;',   // x:size y:alpha z:rot w:stretch
    'attribute vec3 iVel;',
    'uniform float uStretch;',
    'varying vec2 vUv; varying float vA;',
    '#include <fog_pars_vertex>',
    'void main(){',
    '  vUv = uv; vA = iAttr.y;',
    '  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);',
    '  float c = cos(iAttr.z), s = sin(iAttr.z);',
    '  vec2 q = vec2(position.x*c - position.y*s, position.x*s + position.y*c) * iAttr.x;',
    '  if (uStretch > 0.5) {',
    '    vec3 vv = (modelViewMatrix * vec4(iVel,0.0)).xyz;',
    '    vec2 d = vv.xy;',
    '    float L = length(d);',
    '    if (L > 1e-5) {',
    '      d /= L;',
    '      vec2 n2 = vec2(-d.y, d.x);',
    '      float k = 1.0 + min(L*iAttr.w, 5.0);',
    '      q = d * (position.y * iAttr.x * k) + n2 * (position.x * iAttr.x);',
    '    }',
    '  }',
    '  mv.xy += q;',
    '  vec4 mvPosition = mv;',
    '  #include <fog_vertex>',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var quadFrag = [
    'uniform sampler2D uMap; uniform vec3 uColor; uniform float uEmissive;',
    'varying vec2 vUv; varying float vA;',
    '#include <fog_pars_fragment>',
    'void main(){',
    '  vec4 t = texture2D(uMap, vUv);',
    '  gl_FragColor = vec4(uColor * (1.0 + uEmissive) * t.rgb, t.a * vA);',
    '  if (gl_FragColor.a < 0.004) discard;',
    '  #include <tonemapping_fragment>',
    '  #include <encodings_fragment>',
    '  #include <fog_fragment>',
    '}'
  ].join('\n');

  /* -----------------------------------------------------------------------
     Quads — CPU 更新のビルボード粒子プール
  ----------------------------------------------------------------------- */
  FX.Quads = function (max, map, opt) {
    opt = opt || {};
    this.max = max;
    var base = new THREE.PlaneGeometry(1, 1);
    var g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.attributes.position = base.attributes.position;
    g.attributes.uv = base.attributes.uv;
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aAttr = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.aVel = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aPos.setUsage(THREE.DynamicDrawUsage);
    this.aAttr.setUsage(THREE.DynamicDrawUsage);
    this.aVel.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos);
    g.setAttribute('iAttr', this.aAttr);
    g.setAttribute('iVel', this.aVel);
    g.instanceCount = 0;
    this.geo = g;

    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uMap: { value: null },
          uColor: { value: new THREE.Color(opt.color || 0xffffff) },
          uEmissive: { value: opt.emissive || 0 },
          uStretch: { value: opt.stretch ? 1 : 0 }
        }
      ]),
      vertexShader: quadVert,
      fragmentShader: quadFrag,
      transparent: true,
      depthWrite: false,
      depthTest: opt.depthTest !== false,
      blending: opt.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      fog: opt.fog !== false
    });
    this.mat.uniforms.uMap.value = map;

    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = opt.renderOrder == null ? 10 : opt.renderOrder;

    this.list = [];
    this.free = [];
    for (var i = 0; i < max; i++) {
      this.list.push({
        alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        life: 0, max: 1, s0: 1, s1: 1, a0: 1, rot: 0, rotV: 0,
        grav: 0, drag: 0, stretch: 0, fade: 1
      });
      this.free.push(i);
    }
  };

  FX.Quads.prototype.spawn = function (o) {
    if (!this.free.length) return null;
    var i = this.free.pop();
    var p = this.list[i];
    p.alive = true; p.idx = i;
    p.x = o.x; p.y = o.y; p.z = o.z;
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.max = o.life || 1; p.life = p.max;
    p.s0 = o.s0 || 0.05; p.s1 = o.s1 == null ? p.s0 : o.s1;
    p.a0 = o.alpha == null ? 1 : o.alpha;
    p.rot = o.rot == null ? Math.random() * 6.28 : o.rot;
    p.rotV = o.rotV || 0;
    p.grav = o.grav || 0;
    p.drag = o.drag == null ? 0.6 : o.drag;
    p.stretch = o.stretch || 0;
    p.turb = o.turb || 0;
    p.onDeath = o.onDeath || null;
    p.hitY = o.hitY;
    p.hitR = o.hitR;
    p.onHit = o.onHit || null;
    return p;
  };

  FX.Quads.prototype.update = function (dt, time) {
    var n = 0, L = this.list, max = this.max;
    var pa = this.aPos.array, aa = this.aAttr.array, va = this.aVel.array;
    for (var i = 0; i < max; i++) {
      var p = L[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false; this.free.push(i);
        if (p.onDeath) p.onDeath(p);
        continue;
      }
      var t = 1 - p.life / p.max;
      p.vy += p.grav * dt;
      if (p.turb) {
        p.vx += Math.sin(time * 2.3 + p.rot * 4.0) * p.turb * dt;
        p.vz += Math.cos(time * 1.9 + p.rot * 5.3) * p.turb * dt;
        p.vy += Math.sin(time * 1.4 + p.rot * 3.1) * p.turb * 0.5 * dt;
      }
      var k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= k; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;

      if (p.onHit) { if (p.onHit(p, dt)) { p.alive = false; this.free.push(i); continue; } }

      var s = U.lerp(p.s0, p.s1, t);
      var a = p.a0 * Math.min(1, t * 8) * (1 - t * t);
      p.rot += p.rotV * dt;

      pa[n * 3] = p.x; pa[n * 3 + 1] = p.y; pa[n * 3 + 2] = p.z;
      aa[n * 4] = s; aa[n * 4 + 1] = a; aa[n * 4 + 2] = p.rot; aa[n * 4 + 3] = p.stretch;
      va[n * 3] = p.vx; va[n * 3 + 1] = p.vy; va[n * 3 + 2] = p.vz;
      n++;
    }
    this.geo.instanceCount = n;
    if (n > 0) {
      this.aPos.needsUpdate = true;
      this.aAttr.needsUpdate = true;
      this.aVel.needsUpdate = true;
    }
    this.count = n;
  };

  FX.Quads.prototype.clear = function () {
    for (var i = 0; i < this.max; i++) if (this.list[i].alive) { this.list[i].alive = false; this.free.push(i); }
    this.geo.instanceCount = 0;
  };

  /* -----------------------------------------------------------------------
     Smoke — 燻煙器の白い煙
  ----------------------------------------------------------------------- */
  FX.Smoke = function () {
    this.q = new FX.Quads(340, TEX.smoke(), {
      color: MAT.C(0xf2f4f2), emissive: 0.0, renderOrder: 9
    });
    this.mesh = this.q.mesh;
    this.wind = new THREE.Vector3(0, 0, 0);
  };
  FX.Smoke.prototype.puff = function (origin, dir, strength) {
    strength = strength || 1;
    var n = Math.floor(16 + 12 * strength);
    for (var i = 0; i < n; i++) {
      var spread = 0.30;
      var vx = dir.x * (0.55 + Math.random() * 0.5) * strength + U.rand(-spread, spread) * 0.35;
      var vy = dir.y * (0.55 + Math.random() * 0.5) * strength + U.rand(-spread, spread) * 0.35 + 0.05;
      var vz = dir.z * (0.55 + Math.random() * 0.5) * strength + U.rand(-spread, spread) * 0.35;
      this.q.spawn({
        x: origin.x + U.rand(-.008, .008),
        y: origin.y + U.rand(-.008, .008),
        z: origin.z + U.rand(-.008, .008),
        vx: vx, vy: vy, vz: vz,
        life: U.rand(1.9, 3.4),
        s0: U.rand(0.018, 0.038), s1: U.rand(0.20, 0.36),
        alpha: U.rand(0.17, 0.30),
        rotV: U.rand(-0.5, 0.5),
        drag: 1.30, grav: 0.022, turb: 0.26
      });
    }
  };
  FX.Smoke.prototype.wisp = function (origin, rate, dt) {
    this._acc = (this._acc || 0) + rate * dt;
    while (this._acc > 1) {
      this._acc -= 1;
      this.q.spawn({
        x: origin.x + U.rand(-.006, .006), y: origin.y, z: origin.z + U.rand(-.006, .006),
        vx: U.rand(-.02, .02), vy: U.rand(0.05, 0.12), vz: U.rand(-.02, .02),
        life: U.rand(2.2, 3.6), s0: 0.016, s1: U.rand(0.16, 0.30),
        alpha: U.rand(0.10, 0.20), rotV: U.rand(-.4, .4),
        drag: 0.9, grav: 0.04, turb: 0.18
      });
    }
  };
  FX.Smoke.prototype.update = function (dt, time) { this.q.update(dt, time); };

  /* -----------------------------------------------------------------------
     Sparkle — 成功時のきらめき
  ----------------------------------------------------------------------- */
  FX.Sparkle = function () {
    this.q = new FX.Quads(220, TEX.spark(), { additive: true, color: MAT.C(0xffffff), renderOrder: 20, fog: false });
    this.mesh = this.q.mesh;
  };
  FX.Sparkle.prototype.burst = function (p, n, spread, size) {
    n = n || 16; spread = spread || 0.5; size = size || 0.05;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2;
      var sp = U.rand(0.2, 1.0) * spread;
      this.q.spawn({
        x: p.x, y: p.y, z: p.z,
        vx: Math.cos(a) * Math.cos(e) * sp,
        vy: Math.abs(Math.sin(e)) * sp + 0.25,
        vz: Math.sin(a) * Math.cos(e) * sp,
        life: U.rand(0.5, 1.15),
        s0: size * U.rand(.7, 1.5), s1: 0.001,
        alpha: 1, drag: 2.4, grav: -0.35, rotV: U.rand(-3, 3)
      });
    }
  };
  FX.Sparkle.prototype.update = function (dt, time) { this.q.update(dt, time); };

  global.FX = FX;
})(window);
