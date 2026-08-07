/* =========================================================================
   materials.js — 独自シェーダと共有マテリアル
   中核は「巣脾（コム）シェーダ」：六角形の巣房が実際に立体として陰影を持ち，
   蜜蓋が帯状に剥がれ，蜜が抜けていく様子をピクセル単位で表現する。
   ========================================================================= */
(function (global) {
  'use strict';

  var MAT = { env: null };

  // sRGB で書いた色を線形空間へ（テクスチャと同じ扱いにそろえる）
  MAT.C = function (hex) { return new THREE.Color(hex).convertSRGBToLinear(); };

  /* ---------- 環境マップ（金属とガラスの映り込み用） ---------- */
  MAT.buildEnv = function (renderer) {
    function face(draw) {
      var c = document.createElement('canvas'); c.width = c.height = 128;
      var g = c.getContext('2d'); draw(g, 128); return c;
    }
    var sky = function (g, S) {
      var lg = g.createLinearGradient(0, 0, 0, S);
      lg.addColorStop(0, '#5fa8dd'); lg.addColorStop(1, '#cfe6f3');
      g.fillStyle = lg; g.fillRect(0, 0, S, S);
    };
    var horizon = function (g, S) {
      var lg = g.createLinearGradient(0, 0, 0, S);
      lg.addColorStop(0, '#7ab7e2'); lg.addColorStop(.48, '#dceaf2');
      lg.addColorStop(.52, '#8fa860'); lg.addColorStop(1, '#5c7a3a');
      g.fillStyle = lg; g.fillRect(0, 0, S, S);
    };
    var faces = [
      face(horizon), face(horizon),
      face(function (g, S) {                   // 上：太陽
        g.fillStyle = '#8ec6e8'; g.fillRect(0, 0, S, S);
        var rg = g.createRadialGradient(S * .34, S * .3, 2, S * .34, S * .3, S * .5);
        rg.addColorStop(0, '#fffdf0'); rg.addColorStop(.25, '#ffeeb8'); rg.addColorStop(1, 'rgba(255,240,200,0)');
        g.fillStyle = rg; g.fillRect(0, 0, S, S);
      }),
      face(function (g, S) { g.fillStyle = '#5a7738'; g.fillRect(0, 0, S, S); }),
      face(horizon), face(horizon)
    ];
    var cube = new THREE.CubeTexture(faces);
    cube.needsUpdate = true;
    cube.encoding = THREE.sRGBEncoding;
    var pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileCubemapShader();
    MAT.env = pmrem.fromCubemap(cube).texture;
    pmrem.dispose();
    return MAT.env;
  };

  /* ---------- 汎用 ---------- */
  MAT.wood = function (opt) {
    opt = opt || {};
    return new THREE.MeshStandardMaterial({
      map: TEX.wood(opt),
      color: opt.tint || 0xffffff,
      roughness: opt.rough == null ? 0.82 : opt.rough,
      metalness: 0.0,
      envMap: MAT.env, envMapIntensity: 0.25
    });
  };
  MAT.painted = function (col, seed, tint) {
    return new THREE.MeshStandardMaterial({
      map: TEX.paintedWood(col, seed),
      color: tint || 0xffffff,
      roughness: 0.66, metalness: 0.0,
      envMap: MAT.env, envMapIntensity: 0.35
    });
  };
  MAT.metal = function (opt) {
    opt = opt || {};
    return new THREE.MeshStandardMaterial({
      map: TEX.metal(opt),
      color: opt.tint || 0xffffff,
      roughness: opt.rough == null ? 0.34 : opt.rough,
      metalness: opt.metal == null ? 0.92 : opt.metal,
      envMap: MAT.env, envMapIntensity: opt.envI == null ? 1.0 : opt.envI
    });
  };

  /* ---------- 巣脾（コム）シェーダ ---------- */
  var combVert = [
    'varying vec2 vUv;',
    'varying vec3 vT; varying vec3 vB; varying vec3 vN;',
    'varying vec3 vView;',
    '#include <fog_pars_vertex>',
    'void main(){',
    '  vUv = uv;',
    '  vT = normalize(normalMatrix * vec3(1.0,0.0,0.0));',
    '  vB = normalize(normalMatrix * vec3(0.0,1.0,0.0));',
    '  vN = normalize(normalMatrix * vec3(0.0,0.0,1.0));',
    '  vec4 mvPosition = modelViewMatrix * vec4(position,1.0);',
    '  vView = -mvPosition.xyz;',
    '  #include <fog_vertex>',
    '  gl_Position = projectionMatrix * mvPosition;',
    '}'
  ].join('\n');

  var combFrag = [
    'uniform sampler2D uMask;',
    'uniform float uCells;',
    'uniform float uAspect;',   // 高さ/幅
    'uniform float uDrain;',    // 0..1 遠心分離で抜けた量
    'uniform vec2  uDrainDir;', // 抜けやすい向き（回転外周側）
    'uniform vec3  uSunDir;',
    'uniform vec3  uSunCol;',
    'uniform vec3  uAmbCol;',
    'uniform float uTime;',
    'uniform float uWet;',      // 蜜のつや
    'uniform float uPollen;',   // 花粉の巣房の割合
    'varying vec2 vUv;',
    'varying vec3 vT; varying vec3 vB; varying vec3 vN;',
    'varying vec3 vView;',
    '#include <fog_pars_fragment>',

    'float hexDist(vec2 p){ p=abs(p); float c=dot(p, normalize(vec2(1.0,1.7320508))); return max(c,p.x); }',
    'vec4 hexCoords(vec2 p){',
    '  vec2 r=vec2(1.0,1.7320508); vec2 h=r*0.5;',
    '  vec2 a=mod(p,r)-h; vec2 b=mod(p-h,r)-h;',
    '  vec2 gv = dot(a,a)<dot(b,b)?a:b;',
    '  return vec4(gv, p-gv);',
    '}',
    'float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }',

    'void main(){',
    '  vec2 sc = vec2(uCells, uCells*uAspect);',
    '  vec2 p  = vUv * sc;',
    '  vec4 hc = hexCoords(p);',
    '  vec2 gv = hc.xy;',
    '  vec2 cellUV = hc.zw / sc;',
    '  float d  = 0.5 - hexDist(gv);',              // 0=壁の稜線, 0.5=巣房中心
    '  float rnd = hash21(hc.zw + 3.7);',

    // --- 巣房の状態 ---
    '  float uncap = texture2D(uMask, clamp(cellUV,0.002,0.998)).r;',
    '  uncap = smoothstep(0.35, 0.62, uncap);',
    '  float capped = 1.0 - uncap;',
    // 縁の巣房は元から蜜が薄い（実物どおり）
    '  float edgeFall = smoothstep(0.0,0.16,vUv.x)*smoothstep(1.0,0.84,vUv.x)',
    '                 * smoothstep(0.0,0.13,vUv.y)*smoothstep(1.0,0.87,vUv.y);',
    '  float bias = dot(vUv-0.5, uDrainDir)*0.55;',
    '  float honey = clamp((1.0-uDrain)*1.45 - 0.42 + (rnd-0.5)*0.30 + bias, 0.0, 1.0);',
    '  honey *= mix(0.25, 1.0, edgeFall);',
    '  honey = mix(honey, min(honey+0.35,1.0), capped);',   // 蓋のある房は蜜が残る
    '  float pollen = step(1.0-uPollen, rnd) * (1.0-smoothstep(0.0,0.35,vUv.y)) * capped;',

    // --- 法線の起伏 ---
    '  vec2 dir = length(gv)>1e-4 ? normalize(gv) : vec2(0.0);',
    '  float ridge = 1.0 - smoothstep(0.0, 0.135, d);',            // 蝋の壁の稜線
    '  float dome  = capped * sin(min(d/0.5,1.0)*3.14159);',       // 蜜蓋のふくらみ
    '  float pit   = uncap*(1.0-honey) * (1.0 - smoothstep(0.04,0.32,d));',
    '  vec2 bump = dir * (ridge*0.85 - dome*0.26 + pit*0.62);',
    '  bump += vec2(sin(p.x*19.0+rnd*9.0), cos(p.y*17.0+rnd*7.0)) * 0.035 * capped;',
    '  vec3 nrmBase = gl_FrontFacing ? vN : -vN;',
    '  vec3 n = normalize(nrmBase + vT*bump.x + vB*bump.y);',

    // --- 色 ---
    '  vec3 waxWall  = mix(vec3(0.88,0.74,0.46), vec3(0.96,0.86,0.62), rnd);',
    '  vec3 capCol   = mix(vec3(0.95,0.91,0.80), vec3(1.00,0.98,0.92), rnd);',
    '  vec3 honeyCol = mix(vec3(0.40,0.20,0.035), vec3(0.97,0.60,0.07), honey);',
    '  vec3 pollenC  = mix(vec3(0.94,0.50,0.10), vec3(0.98,0.80,0.16), hash21(hc.zw+11.0));',
    '  vec3 cellCol  = mix(honeyCol, capCol, capped);',
    '  cellCol = mix(cellCol, pollenC, pollen*0.85);',
    // 開いた空房は奥が暗い
    '  cellCol *= mix(1.0, 0.38 + 1.30*d, uncap*(1.0-honey));',
    // 蜜がたまった房は縁が暗く中央が明るい（液面の見え方）
    '  cellCol *= mix(1.0, 0.68 + 0.72*smoothstep(0.0,0.26,d), uncap*honey);',
    '  vec3 col = mix(waxWall, cellCol, smoothstep(0.0,0.105,d));',

    // --- ライティング ---
    '  vec3 L = normalize(uSunDir);',
    '  float ndl  = max(dot(n, L), 0.0);',
    '  float wrapd = dot(n, L)*0.5+0.5;',
    '  vec3 lit = col * (uAmbCol*0.62 + uSunCol*(ndl*0.62 + wrapd*0.16));',
    '  vec3 V = normalize(vView);',
    '  vec3 H = normalize(L + V);',
    '  float gloss = honey*uncap*uWet;',
    '  float sh = mix(26.0, 150.0, gloss);',
    '  float spec = pow(max(dot(n,H),0.0), sh) * mix(0.07, 0.95, gloss);',
    '  lit += uSunCol * spec;',
    '  float fres = pow(1.0 - max(dot(n, V),0.0), 3.0);',
    '  lit += vec3(1.0,0.84,0.48) * fres * gloss * 0.22;',
    '  gl_FragColor = vec4(lit, 1.0);',
    '  #include <tonemapping_fragment>',
    '  #include <encodings_fragment>',
    '  #include <fog_fragment>',
    '}'
  ].join('\n');

  MAT.combMaterial = function (maskTex, cells, aspect) {
    var m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uMask: { value: null },
          uCells: { value: cells || 20 },
          uAspect: { value: aspect || 0.45 },
          uDrain: { value: 0 },
          uDrainDir: { value: new THREE.Vector2(1, 0) },
          uSunDir: { value: new THREE.Vector3(0.45, 0.72, 0.52).normalize() },
          uSunCol: { value: new THREE.Color(1.0, 0.93, 0.78) },
          uAmbCol: { value: new THREE.Color(0.52, 0.55, 0.58) },
          uTime: { value: 0 },
          uWet: { value: 1.0 },
          uPollen: { value: 0.05 }
        }
      ]),
      vertexShader: combVert,
      fragmentShader: combFrag,
      side: THREE.DoubleSide,
      fog: true
    });
    m.uniforms.uMask.value = maskTex;
    return m;
  };

  /* ---------- 蜜蓋マスク（Canvas に塗って剥がす） ---------- */
  MAT.CapMask = function (w, h) {
    this.w = w || 160; this.h = h || 80;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.wrapS = this.tex.wrapT = THREE.ClampToEdgeWrapping;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this._dirty = true;
    this.reset(0);
  };
  MAT.CapMask.prototype.reset = function (v) {
    var g = this.ctx;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = v ? '#ffffff' : '#000000';
    g.fillRect(0, 0, this.w, this.h);
    this._dirty = true;
  };
  // uv 座標(0..1)に楕円ブラシを置く（道具の刃幅に合わせて横長）
  MAT.CapMask.prototype.paint = function (u, v, ru, rv) {
    var g = this.ctx;
    var x = u * this.w, y = (1 - v) * this.h;
    var rx = ru * this.w, ry = rv * this.h;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.translate(x, y);
    g.scale(1, ry / rx);
    var rg = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.78, 'rgba(255,255,255,0.96)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.beginPath(); g.arc(0, 0, rx, 0, 7); g.fill();
    g.restore();
    this._dirty = true;
  };
  MAT.CapMask.prototype.stroke = function (u0, v0, u1, v1, ru, rv) {
    var step = Math.min(ru * this.w, rv * this.h) * 0.42;
    var n = Math.max(1, Math.ceil(Math.hypot((u1 - u0) * this.w, (v1 - v0) * this.h) / Math.max(step, 1)));
    n = Math.min(n, 40);
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      this.paint(u0 + (u1 - u0) * t, v0 + (v1 - v0) * t, ru, rv);
    }
  };
  // 覆われている割合（粗いサンプリング）
  MAT.CapMask.prototype.coverage = function () {
    var d = this.ctx.getImageData(0, 0, this.w, this.h).data;
    var hit = 0, tot = 0;
    for (var y = 2; y < this.h - 2; y += 3) {
      for (var x = 2; x < this.w - 2; x += 3) {
        tot++;
        if (d[(y * this.w + x) * 4] > 120) hit++;
      }
    }
    return tot ? hit / tot : 0;
  };
  MAT.CapMask.prototype.flush = function () {
    if (this._dirty) { this.tex.needsUpdate = true; this._dirty = false; }
  };

  /* ---------- とろりとした蜂蜜（面用） ---------- */
  MAT.honeyMat = function (opt) {
    opt = opt || {};
    var m = new THREE.MeshStandardMaterial({
      color: MAT.C(opt.color != null ? opt.color : 0xc9800c),
      roughness: opt.rough == null ? 0.09 : opt.rough,
      metalness: 0.0,
      transparent: opt.transparent !== false,
      opacity: opt.opacity == null ? 0.93 : opt.opacity,
      envMap: MAT.env, envMapIntensity: 1.15,
      emissive: MAT.C(0x1c0d00),
      emissiveIntensity: 0.35
    });
    return m;
  };

  /* ---------- ガラス（背景を歪ませて屈折させる） ---------- */
  MAT.glassMaterial = function (bgTex, opt) {
    opt = opt || {};
    return new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uBg: { value: null },
          uTint: { value: MAT.C(opt.tint || 0xdfeef2) },
          uStrength: { value: opt.strength == null ? 0.045 : opt.strength },
          uOpacity: { value: opt.opacity == null ? 1.0 : opt.opacity },
          uSunDir: { value: new THREE.Vector3(0.45, 0.72, 0.52).normalize() },
          uRes: { value: new THREE.Vector2(1, 1) },
          uFres: { value: opt.fres == null ? 1.0 : opt.fres }
        }
      ]),
      vertexShader: [
        'varying vec3 vN; varying vec3 vView; varying vec4 vSp;',
        '#include <fog_pars_vertex>',
        'void main(){',
        '  vN = normalize(normalMatrix * normal);',
        '  vec4 mvPosition = modelViewMatrix * vec4(position,1.0);',
        '  vView = -mvPosition.xyz;',
        '  #include <fog_vertex>',
        '  gl_Position = projectionMatrix * mvPosition;',
        '  vSp = gl_Position;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D uBg; uniform vec3 uTint; uniform float uStrength;',
        'uniform float uOpacity; uniform vec3 uSunDir; uniform float uFres;',
        'varying vec3 vN; varying vec3 vView; varying vec4 vSp;',
        '#include <fog_pars_fragment>',
        'void main(){',
        '  vec3 n = normalize(vN); vec3 V = normalize(vView);',
        '  vec2 uv = (vSp.xy/vSp.w)*0.5+0.5;',
        '  vec2 off = n.xy * uStrength;',
        '  vec3 bg;',
        '  bg.r = texture2D(uBg, clamp(uv+off*1.03,0.001,0.999)).r;',
        '  bg.g = texture2D(uBg, clamp(uv+off,     0.001,0.999)).g;',
        '  bg.b = texture2D(uBg, clamp(uv+off*0.97,0.001,0.999)).b;',
        '  float fres = pow(1.0-max(dot(n,V),0.0), 2.6)*uFres;',
        '  vec3 H = normalize(uSunDir+V);',
        '  float spec = pow(max(dot(n,H),0.0), 90.0);',
        '  vec3 col = bg*uTint + vec3(fres)*0.42 + vec3(1.0,0.98,0.92)*spec*0.9;',
        '  gl_FragColor = vec4(col, uOpacity);',
        '  #include <tonemapping_fragment>',
        '  #include <encodings_fragment>',
        '  #include <fog_fragment>',
        '}'
      ].join('\n'),
      toneMapped: false,
      transparent: opt.opacity != null && opt.opacity < 1,
      fog: true,
      side: opt.side || THREE.FrontSide
    });
  };

  global.MAT = MAT;
})(window);
