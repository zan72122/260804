/* ------------------------------------------------------------------
   fx.js — 炎・熾火・粉・煙・熱のゆらぎ
------------------------------------------------------------------ */
(function () {
  'use strict';
  const PZ = window.PZ;
  const U = PZ.util;
  const T = PZ.tex;
  const TAU = U.TAU;
  const F = (PZ.fx = {});

  /* ================================================================
     炎（加算合成のビルボード＋点光源）
  ================================================================ */
  function Fire(scene, pos) {
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    scene.add(this.group);

    const tex = new THREE.CanvasTexture(T.flameSprite());
    tex.encoding = THREE.sRGBEncoding;
    this.tongues = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.SpriteMaterial({
        map: tex, blending: THREE.AdditiveBlending,
        depthWrite: false, transparent: true,
        color: new THREE.Color().setHSL(0.055 + Math.random() * 0.02, 1, 0.6)
      });
      const s = new THREE.Sprite(m);
      s.center.set(0.5, 0.02);
      this.group.add(s);
      this.tongues.push({
        s: s, ph: Math.random() * TAU, sp: 0.8 + Math.random() * 0.9,
        ox: (Math.random() - 0.5) * 0.26, oz: (Math.random() - 0.5) * 0.16,
        h: 0.26 + Math.random() * 0.30
      });
    }

    // 熾火（薪の上の赤熱）
    const coalTex = new THREE.CanvasTexture(T.softDisc('255,120,30', 1.6));
    this.coals = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coalTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
    }));
    this.coals.scale.set(0.7, 0.32, 1);
    this.coals.position.y = 0.02;
    this.group.add(this.coals);

    // 光源
    this.light = new THREE.PointLight(0xff7418, 1.5, 3.0, 2);
    this.light.position.set(0, 0.24, 0);
    this.group.add(this.light);
    this.spill = new THREE.PointLight(0xff8c38, 0.6, 2.2, 2);
    this.spill.position.set(0, 0.1, 1.1);
    this.group.add(this.spill);

    this.level = 1;
    this.t = 0;
  }
  F.Fire = Fire;

  Fire.prototype.update = function (dt, level) {
    this.t += dt;
    this.level = U.approach(this.level, level, 3, dt);
    const L = this.level;
    const flick = 0.82 + 0.18 * (U.fbm1(this.t * 6.5) * 2 - 0.5) + 0.08 * Math.sin(this.t * 23);
    for (let i = 0; i < this.tongues.length; i++) {
      const f = this.tongues[i];
      const w = 0.5 + 0.5 * Math.sin(this.t * f.sp * 3.1 + f.ph);
      const h = f.h * L * (0.55 + w * 0.65) * flick;
      f.s.scale.set(h * 0.58, h, 1);
      f.s.position.set(
        f.ox + Math.sin(this.t * f.sp * 1.7 + f.ph) * 0.05,
        0.01,
        f.oz + Math.cos(this.t * f.sp * 1.3 + f.ph) * 0.03
      );
      f.s.material.opacity = U.clamp(L * (0.34 + w * 0.4), 0, 1);
    }
    const cg = 0.7 + 0.3 * Math.sin(this.t * 2.3);
    this.coals.material.opacity = 0.5 * L * cg;
    this.light.intensity = (1.2 + 0.9 * flick) * L;
    this.light.position.y = 0.2 + 0.05 * flick;
    this.spill.intensity = 0.8 * L * flick;
  };

  /* ================================================================
     粒子（粉・煙・火の粉）
  ================================================================ */
  function Particles(scene, opt) {
    const max = opt.max || 400;
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max);
    this.size = new Float32Array(max);
    this.alive = new Uint8Array(max);
    this.n = 0;
    this.opt = opt;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(max), 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(max), 1));
    this.geo = geo;

    const tex = new THREE.CanvasTexture(T.softDisc(opt.rgb || '255,255,255', opt.power || 2));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: tex },
        color: { value: new THREE.Color(opt.color === undefined ? 0xffffff : opt.color) },
        scale: { value: 600 }
      },
      vertexShader: [
        'attribute float size; attribute float alpha; varying float vA;',
        'uniform float scale;',
        'void main(){ vA = alpha;',
        ' vec4 mv = modelViewMatrix * vec4(position,1.0);',
        ' gl_PointSize = size * scale / max(0.001, -mv.z);',
        ' gl_Position = projectionMatrix * mv; }'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D map; uniform vec3 color; varying float vA;',
        'void main(){ vec4 t = texture2D(map, gl_PointCoord);',
        ' gl_FragColor = vec4(color, 1.0) * t * vA; }'
      ].join('\n'),
      transparent: true,
      depthWrite: false,
      blending: opt.additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    geo.setDrawRange(0, 0);
  }
  F.Particles = Particles;

  Particles.prototype.spawn = function (x, y, z, vx, vy, vz, life, size) {
    let i = -1;
    for (let k = 0; k < this.max; k++) {
      const j = (this.cursor = ((this.cursor || 0) + 1) % this.max);
      if (!this.alive[j]) { i = j; break; }
    }
    if (i < 0) return;
    this.alive[i] = 1;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.age[i] = 0; this.size[i] = size;
    if (i + 1 > this.n) this.n = i + 1;
  };

  Particles.prototype.update = function (dt) {
    const o = this.opt;
    const sa = this.geo.attributes.size.array;
    const aa = this.geo.attributes.alpha.array;
    let maxI = 0;
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i]) { aa[i] = 0; sa[i] = 0; continue; }
      this.age[i] += dt;
      const k = this.age[i] / this.life[i];
      if (k >= 1) { this.alive[i] = 0; aa[i] = 0; sa[i] = 0; continue; }
      const i3 = i * 3;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const drag = Math.exp(-(o.drag || 1.6) * dt);
      this.vel[i3] *= drag;
      this.vel[i3 + 1] = this.vel[i3 + 1] * drag + (o.gravity || 0) * dt;
      this.vel[i3 + 2] *= drag;
      if (o.swirl) {
        this.vel[i3] += Math.sin(this.age[i] * 7 + i) * o.swirl * dt;
        this.vel[i3 + 2] += Math.cos(this.age[i] * 6 + i * 1.7) * o.swirl * dt;
      }
      sa[i] = this.size[i] * (1 + k * (o.grow || 0));
      aa[i] = Math.sin(Math.min(1, k * (o.fadeIn || 1.6)) * Math.PI * 0.5) * (1 - k) * (o.alpha || 1);
      maxI = i + 1;
    }
    this.n = maxI;
    this.geo.setDrawRange(0, this.n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
  };

  /* 便利メソッド */
  Particles.prototype.burst = function (x, y, z, n, spread, speed, life, size) {
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, TAU), e = U.rand(-0.4, 1.0);
      const s = U.rand(0.35, 1) * speed;
      this.spawn(
        x + U.rand(-spread, spread), y + U.rand(-spread * 0.3, spread * 0.3), z + U.rand(-spread, spread),
        Math.cos(a) * s, e * s, Math.sin(a) * s,
        U.rand(life * 0.6, life * 1.3), U.rand(size * 0.6, size * 1.35)
      );
    }
  };

  /* ================================================================
     熱のゆらぎ＋ブルームの後処理
  ================================================================ */
  F.makePost = function (renderer, w, h) {
    const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType };
    const rtScene = new THREE.WebGLRenderTarget(w, h, opts);
    const qw = Math.max(2, Math.floor(w / 4)), qh = Math.max(2, Math.floor(h / 4));
    const rtA = new THREE.WebGLRenderTarget(qw, qh, opts);
    const rtB = new THREE.WebGLRenderTarget(qw, qh, opts);

    const quad = new THREE.BufferGeometry();
    quad.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    quad.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));

    const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.0,1.0); }';

    const bright = new THREE.RawShaderMaterial({
      uniforms: { tex: { value: null }, thresh: { value: 1.15 } },
      vertexShader: 'precision highp float; attribute vec3 position; attribute vec2 uv; varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: [
        'precision highp float; varying vec2 vUv; uniform sampler2D tex; uniform float thresh;',
        'void main(){ vec3 c = texture2D(tex, vUv).rgb;',
        ' float l = dot(c, vec3(0.2126,0.7152,0.0722));',
        ' float k = max(0.0, l - thresh) / max(0.001, l);',
        ' gl_FragColor = vec4(c * k, 1.0); }'
      ].join('\n')
    });

    const blur = new THREE.RawShaderMaterial({
      uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2(1, 0) }, res: { value: new THREE.Vector2(qw, qh) } },
      vertexShader: 'precision highp float; attribute vec3 position; attribute vec2 uv; varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: [
        'precision highp float; varying vec2 vUv; uniform sampler2D tex; uniform vec2 dir; uniform vec2 res;',
        'void main(){ vec2 o = dir / res;',
        ' vec3 c = texture2D(tex, vUv).rgb * 0.227;',
        ' c += (texture2D(tex, vUv + o*1.38).rgb + texture2D(tex, vUv - o*1.38).rgb) * 0.316;',
        ' c += (texture2D(tex, vUv + o*3.23).rgb + texture2D(tex, vUv - o*3.23).rgb) * 0.070;',
        ' gl_FragColor = vec4(c, 1.0); }'
      ].join('\n')
    });

    const composite = new THREE.RawShaderMaterial({
      uniforms: {
        tex: { value: null }, bloom: { value: null },
        time: { value: 0 }, heat: { value: new THREE.Vector4(0.5, 0.5, 0.2, 0) },
        aspect: { value: 1 }, bloomAmt: { value: 0.42 }, vig: { value: 0.40 }, exposure: { value: 0.72 }
      },
      vertexShader: 'precision highp float; attribute vec3 position; attribute vec2 uv; varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: [
        'precision highp float; varying vec2 vUv;',
        'uniform sampler2D tex; uniform sampler2D bloom;',
        'uniform float time; uniform vec4 heat; uniform float aspect;',
        'uniform float bloomAmt; uniform float vig; uniform float exposure;',
        'void main(){',
        ' vec2 uv = vUv;',
        // 熱でゆらぐ空気：窯口のまわりだけ、上に行くほど強く
        ' vec2 d = (uv - heat.xy) * vec2(aspect, 1.0);',
        ' float m = 1.0 - smoothstep(heat.z * 0.35, heat.z, length(d));',
        ' m *= heat.w * smoothstep(-0.06, 0.16, uv.y - heat.y);',
        ' float w = sin(uv.y * 118.0 + time * 5.2) * 0.6 + sin(uv.y * 47.0 - time * 3.3) * 0.4;',
        ' float w2 = sin(uv.x * 63.0 + time * 2.1);',
        ' uv.x += w * m * 0.0034;',
        ' uv.y += w2 * m * 0.0016;',
        ' vec3 c = texture2D(tex, uv).rgb;',
        ' c += texture2D(bloom, uv).rgb * bloomAmt;',
        // まわりを少し落として被写体を引き立てる
        ' float r = length((vUv - 0.5) * vec2(aspect, 1.0));',
        ' c *= 1.0 - vig * smoothstep(0.42, 1.05, r);',
        // トーンマッピング（ACES 近似）と sRGB へ
        ' c *= exposure;',
        ' c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);',
        ' c = clamp(c, 0.0, 1.0);',
        ' c = mix(c * 12.92, 1.055 * pow(c, vec3(0.41666)) - 0.055, step(0.0031308, c));',
        ' gl_FragColor = vec4(c, 1.0); }'
      ].join('\n')
    });

    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const meshBright = new THREE.Mesh(quad, bright);
    const meshBlur = new THREE.Mesh(quad, blur);
    const meshComp = new THREE.Mesh(quad, composite);
    const sBright = new THREE.Scene(); sBright.add(meshBright);
    const sBlur = new THREE.Scene(); sBlur.add(meshBlur);
    const sComp = new THREE.Scene(); sComp.add(meshComp);

    return {
      rtScene: rtScene, rtA: rtA, rtB: rtB,
      composite: composite, bright: bright, blur: blur,
      cam: cam, sBright: sBright, sBlur: sBlur, sComp: sComp,
      setSize: function (w2, h2) {
        rtScene.setSize(w2, h2);
        const a = Math.max(2, Math.floor(w2 / 4)), b = Math.max(2, Math.floor(h2 / 4));
        rtA.setSize(a, b); rtB.setSize(a, b);
        blur.uniforms.res.value.set(a, b);
      },
      render: function (renderer, scene, camera, dt, heatVec, aspect) {
        composite.uniforms.time.value += dt;
        composite.uniforms.heat.value.copy(heatVec);
        composite.uniforms.aspect.value = aspect;

        renderer.setRenderTarget(rtScene);
        renderer.clear();
        renderer.render(scene, camera);

        bright.uniforms.tex.value = rtScene.texture;
        renderer.setRenderTarget(rtA);
        renderer.render(sBright, cam);

        blur.uniforms.tex.value = rtA.texture;
        blur.uniforms.dir.value.set(1, 0);
        renderer.setRenderTarget(rtB);
        renderer.render(sBlur, cam);

        blur.uniforms.tex.value = rtB.texture;
        blur.uniforms.dir.value.set(0, 1);
        renderer.setRenderTarget(rtA);
        renderer.render(sBlur, cam);

        composite.uniforms.tex.value = rtScene.texture;
        composite.uniforms.bloom.value = rtA.texture;
        renderer.setRenderTarget(null);
        renderer.render(sComp, cam);
      }
    };
  };

})();
