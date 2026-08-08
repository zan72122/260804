/* 空港グランドハンドリング — WebGLレンダラ（実ジオメトリ・透視投影・シャドウマップ・空気遠近） */
(function (AG) {
  'use strict';
  const M = AG.M;

  const VS_MAIN = `
attribute vec3 aPos; attribute vec3 aNorm; attribute vec2 aUv;
uniform mat4 uProj, uView, uModel; uniform mat3 uNMat; uniform mat4 uLightVP, uLightVPN;
varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec4 vLS; varying vec4 vLSN;
void main(){
  vec4 wp = uModel * vec4(aPos,1.0);
  vW = wp.xyz;
  vN = uNMat * aNorm;
  vUv = aUv;
  vLS = uLightVP * wp;
  vLSN = uLightVPN * wp;
  gl_Position = uProj * uView * wp;
}`;

  const FS_MAIN = `
precision highp float;
varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec4 vLS; varying vec4 vLSN;
uniform vec3 uColor, uEmissive, uCamPos;
uniform float uGloss, uShine, uAlpha, uMetal, uUseMap, uCutout, uCoat;
uniform vec2 uUvOff, uUvRep;
uniform sampler2D uMap;
uniform vec3 uSunDir, uSunCol, uSkyCol, uGndCol, uFogCol, uFogCol2;
uniform float uFogDens, uShadowOn, uShadowTexel, uShadowTexelN;
uniform sampler2D uShadow, uShadowN;

float unpackD(vec4 c){ return dot(c, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/16581375.0)); }

float pcf(sampler2D map, vec3 s, float texel, float bias){
  float sum = 0.0;
  for(int j=-1;j<=1;j++){
    for(int i=-1;i<=1;i++){
      float d = unpackD(texture2D(map, s.xy + vec2(float(i),float(j))*texel));
      sum += step(s.z - bias, d);
    }
  }
  return sum/9.0;
}

/* 遠景用と、注視点まわりを高密度に覆う近景用の2段カスケード。
   近景側はテクセルが細かいので接地の影がはっきり出る。 */
float shadowFactor(vec3 N){
  if(uShadowOn < 0.5) return 1.0;
  float ndl = max(dot(N,uSunDir),0.0);
  vec3 f = vLS.xyz / vLS.w * 0.5 + 0.5;
  float far = 1.0;
  if(!(f.x<0.002||f.x>0.998||f.y<0.002||f.y>0.998||f.z>0.9995))
    far = pcf(uShadow, f, uShadowTexel, 0.0016 + 0.0045*(1.0-ndl));
  vec3 n = vLSN.xyz / vLSN.w * 0.5 + 0.5;
  if(n.x<0.01||n.x>0.99||n.y<0.01||n.y>0.99||n.z>0.999||n.z<0.001) return far;
  float near = pcf(uShadowN, n, uShadowTexelN, 0.0009 + 0.0028*(1.0-ndl));
  /* 近景マップの縁で滑らかに遠景へ戻す */
  vec2 e = min(n.xy, 1.0-n.xy);
  float w = smoothstep(0.01, 0.09, min(e.x, e.y));
  return mix(far, near, w);
}

vec3 tonemap(vec3 x){
  x *= 1.05;
  vec3 a = x*(2.51*x+0.03);
  vec3 b = x*(2.43*x+0.59)+0.14;
  return clamp(a/b, 0.0, 1.0);
}

void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vW);
  if(!gl_FrontFacing) N = -N;
  vec4 texel = vec4(1.0);
  if(uUseMap > 0.5){
    texel = texture2D(uMap, vUv*uUvRep + uUvOff);
    texel.rgb = pow(texel.rgb, vec3(2.2));   /* sRGB -> linear */
  }
  if(uCutout > 0.5 && texel.a < 0.5) discard;
  vec3 base = uColor * texel.rgb;

  float sh = shadowFactor(N);
  float ndl = max(dot(N, uSunDir), 0.0);
  float hemi = 0.5 + 0.5*N.y;
  vec3 amb = mix(uGndCol, uSkyCol, hemi);
  vec3 col = base * (amb + uSunCol * ndl * sh);

  vec3 H = normalize(uSunDir + V);
  float nh = max(dot(N,H), 0.0);
  float spec = pow(nh, uShine) * uGloss * sh * step(0.001, ndl);
  col += uSunCol * spec * mix(vec3(1.0), base, uMetal);
  /* 塗装のクリアコート: 下地色に染まらない鋭いハイライトを重ねる */
  if(uCoat > 0.001){
    float c = pow(nh, 220.0) * uCoat * sh * step(0.001, ndl);
    float cf = 0.04 + 0.96 * pow(1.0 - max(dot(N,V),0.0), 5.0);
    col += uSunCol * (c + cf * uCoat * 0.18) ;
  }
  float fres = pow(1.0 - max(dot(N,V),0.0), 4.0) * uGloss * 0.5;
  col += uSkyCol * fres * (1.0 - uMetal*0.4);
  col += uEmissive;

  /* 空気遠近: 距離と高度で霞ませる。太陽方向はやや暖色 */
  float dist = length(vW - uCamPos);
  float hf = exp(-max(vW.y,0.0)*0.010);
  float fog = 1.0 - exp(-uFogDens * dist * hf);
  float sunAmt = pow(max(dot(-V, uSunDir),0.0), 3.0);
  vec3 fc = mix(uFogCol, uFogCol2, sunAmt);
  col = mix(col, fc, clamp(fog,0.0,1.0));

  col = tonemap(col);
  col = pow(col, vec3(1.0/2.2));
  gl_FragColor = vec4(col, uAlpha * texel.a);
}`;

  const VS_SHADOW = `
attribute vec3 aPos; uniform mat4 uLightVP, uModel;
void main(){ gl_Position = uLightVP * uModel * vec4(aPos,1.0); }`;
  const FS_SHADOW = `
precision highp float;
vec4 packD(float d){
  vec4 e = vec4(1.0,255.0,65025.0,16581375.0)*d;
  e = fract(e);
  e -= e.yzww * vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);
  return e;
}
void main(){ gl_FragColor = packD(gl_FragCoord.z); }`;

  const VS_SKY = `
attribute vec2 aPos; varying vec2 vP;
void main(){ vP = aPos; gl_Position = vec4(aPos,1.0,1.0); }`;
  const FS_SKY = `
precision highp float;
varying vec2 vP;
uniform mat4 uInvVP; uniform vec3 uCamPos, uSunDir, uZenith, uHorizon, uSunCol;
uniform float uTime;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for(int i=0;i<5;i++){ s += a*noise(p); p *= 2.03; a *= 0.5; }
  return s;
}
void main(){
  vec4 h = uInvVP * vec4(vP, 1.0, 1.0);
  vec3 dir = normalize(h.xyz/h.w - uCamPos);
  float y = max(dir.y, -0.08);
  float t = pow(clamp(y*1.35,0.0,1.0), 0.62);
  vec3 col = mix(uHorizon, uZenith, t);
  float sd = max(dot(dir, uSunDir), 0.0);
  col += uSunCol * (pow(sd, 900.0)*7.0 + pow(sd, 12.0)*0.30 + pow(sd,3.0)*0.09);
  /* 高層の薄雲 */
  if(dir.y > 0.005){
    vec2 uv = dir.xz/ (dir.y+0.09) * 0.42;
    float c = fbm(uv*1.15 + vec2(uTime*0.0035, uTime*0.0018));
    c = smoothstep(0.52, 0.86, c);
    float fade = smoothstep(0.0, 0.30, dir.y);
    vec3 cc = mix(vec3(0.86,0.87,0.90), vec3(1.06,1.02,0.98), pow(sd,2.0));
    col = mix(col, cc, c*fade*0.78);
  }
  vec3 a = col*(2.51*col+0.03); vec3 b = col*(2.43*col+0.59)+0.14;
  col = clamp(a/b,0.0,1.0);
  gl_FragColor = vec4(pow(col, vec3(1.0/2.2)), 1.0);
}`;

  const VS_SPR = `
attribute vec3 aCenter; attribute vec2 aOff; attribute vec2 aUv; attribute vec4 aCol;
uniform mat4 uProj, uView; varying vec2 vUv; varying vec4 vCol;
void main(){
  vec4 vp = uView * vec4(aCenter,1.0);
  vp.xy += aOff;
  vUv = aUv; vCol = aCol;
  gl_Position = uProj * vp;
}`;
  const FS_SPR = `
precision mediump float;
varying vec2 vUv; varying vec4 vCol;
void main(){
  float d = length(vUv - 0.5)*2.0;
  float a = smoothstep(1.0, 0.0, d);
  a = a*a;
  float a2 = a * vCol.a;
  gl_FragColor = vec4(vCol.rgb * a2, a2);
}`;

  const VS_DECAL = `
attribute vec3 aPos; attribute vec3 aNorm; attribute vec2 aUv;
uniform mat4 uProj, uView, uModel; varying vec2 vUv; varying vec3 vW;
void main(){ vec4 wp = uModel*vec4(aPos,1.0); vW = wp.xyz; vUv = aUv; gl_Position = uProj*uView*wp; }`;
  const FS_DECAL = `
precision mediump float;
varying vec2 vUv; varying vec3 vW;
uniform sampler2D uMap; uniform float uStrength, uFogDens;
uniform vec3 uCamPos;
void main(){
  float a = texture2D(uMap, vUv).r;              /* 1=素通し 0=最も暗い */
  float k = mix(1.0, a, uStrength);
  /* 遠くでは霞に溶けるので効きを落とす */
  float d = length(vW - uCamPos);
  k = mix(k, 1.0, clamp(1.0 - exp(-uFogDens*d*1.6), 0.0, 0.85));
  gl_FragColor = vec4(k, k, k, 1.0);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s), src);
      throw new Error('shader compile failed');
    }
    return s;
  }
  function program(gl, vs, fs, attribs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(p));
      throw new Error('link failed');
    }
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  /* ---------- シーングラフノード ---------- */
  class Obj {
    constructor(mesh, mat) {
      this.mesh = mesh || null;
      this.mat = mat || null;
      this.p = [0, 0, 0]; this.r = [0, 0, 0]; this.s = [1, 1, 1];
      this.children = [];
      this.parent = null;
      this.local = M.m4();
      this.world = M.m4();
      this.nmat = M.m3();
      this.visible = true;
      this.cast = true;
      this.name = '';
    }
    add(c) { c.parent = this; this.children.push(c); return c; }
    remove(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parent = null; } }
    setPos(x, y, z) { this.p[0] = x; this.p[1] = y; this.p[2] = z; return this; }
    setRot(x, y, z) { this.r[0] = x; this.r[1] = y; this.r[2] = z; return this; }
    setScale(x, y, z) {
      this.s[0] = x; this.s[1] = y === undefined ? x : y; this.s[2] = z === undefined ? (y === undefined ? x : y) : z; return this;
    }
    worldPos(out) {
      out = out || [0, 0, 0];
      out[0] = this.world[12]; out[1] = this.world[13]; out[2] = this.world[14];
      return out;
    }
    updateWorld(parentWorld) {
      M.compose(this.local, this.p, this.r, this.s);
      if (parentWorld) M.mul(this.world, parentWorld, this.local);
      else M.copy(this.world, this.local);
      for (let i = 0; i < this.children.length; i++) this.children[i].updateWorld(this.world);
    }
  }
  AG.Obj = Obj;

  /* ---------- レンダラ ---------- */
  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      const opts = { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false };
      let gl = canvas.getContext('webgl2', opts);
      this.isGL2 = !!gl;
      if (!gl) gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
      if (!gl) throw new Error('WebGL not supported');
      this.gl = gl;
      this.aniso = gl.getExtension('EXT_texture_filter_anisotropic') ||
        gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
      this.maxAniso = this.aniso ? gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;

      this.main = program(gl, VS_MAIN, FS_MAIN, ['aPos', 'aNorm', 'aUv']);
      this.shadow = program(gl, VS_SHADOW, FS_SHADOW, ['aPos', 'aNorm', 'aUv']);
      this.sky = program(gl, VS_SKY, FS_SKY, ['aPos']);
      this.spr = program(gl, VS_SPR, FS_SPR, ['aCenter', 'aOff', 'aUv', 'aCol']);
      this.decal = program(gl, VS_DECAL, FS_DECAL, ['aPos', 'aNorm', 'aUv']);

      this.skyBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

      this.sprMax = 512;
      this.sprData = new Float32Array(this.sprMax * 4 * 11);
      this.sprCount = 0;
      this.sprBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.sprBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.sprData.byteLength, gl.DYNAMIC_DRAW);
      this.sprIdx = gl.createBuffer();
      const si = new Uint16Array(this.sprMax * 6);
      for (let i = 0; i < this.sprMax; i++) {
        si[i * 6] = i * 4; si[i * 6 + 1] = i * 4 + 1; si[i * 6 + 2] = i * 4 + 2;
        si[i * 6 + 3] = i * 4; si[i * 6 + 4] = i * 4 + 2; si[i * 6 + 5] = i * 4 + 3;
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sprIdx);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, si, gl.STATIC_DRAW);

      /* シャドウマップ（遠景用）と、注視点まわりの近景用 */
      this.shadowSize = 2048;
      this.shadowSizeN = 1024;
      this.initShadow();

      this.proj = M.m4(); this.view = M.m4(); this.viewProj = M.m4(); this.invVP = M.m4();
      this.lightVP = M.m4();
      this.lightVPN = M.m4();
      this.shadowCenterN = [0, 0, -20];
      this.shadowRadiusN = 12;
      this.camPos = [0, 2, 6];
      this.camTarget = [0, 1, 0];
      this.fov = 52 * Math.PI / 180;
      this.near = 0.35; this.far = 1400;

      this.sunDir = M.vnorm([0, 0, 0], [-0.42, 0.44, 0.80]);
      this.sunCol = [1.62, 1.40, 1.10];
      this.skyCol = [0.34, 0.44, 0.62];
      this.gndCol = [0.20, 0.19, 0.17];
      this.fogCol = [0.66, 0.74, 0.86];
      this.fogCol2 = [0.95, 0.86, 0.72];
      this.fogDens = 0.0026;
      this.zenith = [0.16, 0.34, 0.72];
      this.horizon = [0.74, 0.82, 0.92];
      this.shadowCenter = [0, 0, -20];
      this.shadowRadius = 46;
      this.time = 0;

      this._tmp = M.m4(); this._tmp2 = M.m4();
      this.opaque = []; this.trans = []; this.casters = []; this.decals = [];
      this.stats = { draws: 0, tris: 0 };
    }

    initShadow() {
      const gl = this.gl;
      const mk = (size) => {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        const rb = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return { tex, fbo };
      };
      const a = mk(this.shadowSize); this.shTex = a.tex; this.shFbo = a.fbo;
      const b = mk(this.shadowSizeN); this.shTexN = b.tex; this.shFboN = b.fbo;
    }

    /* ジオメトリ -> GPUメッシュ */
    mesh(geo, dynamic) {
      const gl = this.gl;
      const n = geo.p.length / 3;
      const inter = new Float32Array(n * 8);
      for (let i = 0; i < n; i++) {
        inter[i * 8] = geo.p[i * 3]; inter[i * 8 + 1] = geo.p[i * 3 + 1]; inter[i * 8 + 2] = geo.p[i * 3 + 2];
        inter[i * 8 + 3] = geo.n[i * 3]; inter[i * 8 + 4] = geo.n[i * 3 + 1]; inter[i * 8 + 5] = geo.n[i * 3 + 2];
        inter[i * 8 + 6] = geo.u[i * 2]; inter[i * 8 + 7] = geo.u[i * 2 + 1];
      }
      const use32 = n > 65535;
      const idx = use32 ? new Uint32Array(geo.i) : new Uint16Array(geo.i);
      if (use32 && !this.isGL2 && !gl.getExtension('OES_element_index_uint')) {
        console.warn('32bit index unsupported');
      }
      const vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, inter, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
      const ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
      /* 原点からの最大距離（影のカリングに使う） */
      let r2 = 0;
      for (let i = 0; i < n; i++) {
        const d = geo.p[i * 3] * geo.p[i * 3] + geo.p[i * 3 + 1] * geo.p[i * 3 + 1] + geo.p[i * 3 + 2] * geo.p[i * 3 + 2];
        if (d > r2) r2 = d;
      }
      return {
        vb, ib, count: geo.i.length, type: use32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
        nverts: n, dynamic: !!dynamic, radius: Math.sqrt(r2),
      };
    }

    updateMesh(mesh, geo) {
      const gl = this.gl;
      const n = geo.p.length / 3;
      if (!mesh._scratch || mesh._scratch.length < n * 8) mesh._scratch = new Float32Array(n * 8);
      const inter = mesh._scratch;
      for (let i = 0; i < n; i++) {
        inter[i * 8] = geo.p[i * 3]; inter[i * 8 + 1] = geo.p[i * 3 + 1]; inter[i * 8 + 2] = geo.p[i * 3 + 2];
        inter[i * 8 + 3] = geo.n[i * 3]; inter[i * 8 + 4] = geo.n[i * 3 + 1]; inter[i * 8 + 5] = geo.n[i * 3 + 2];
        inter[i * 8 + 6] = geo.u[i * 2]; inter[i * 8 + 7] = geo.u[i * 2 + 1];
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vb);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, inter.subarray(0, n * 8));
      mesh.count = geo.i.length;
    }

    texture(canvas, opt) {
      const gl = this.gl;
      opt = opt || {};
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      const pot = (canvas.width & (canvas.width - 1)) === 0 && (canvas.height & (canvas.height - 1)) === 0;
      const wrap = opt.repeat && pot ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (pot) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, this.maxAniso));
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      return t;
    }

    resize() {
      const c = this.canvas;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      this.aspect = w / Math.max(h, 1);
      this.vw = w; this.vh = h;
    }

    /* 縦画面では画角を広げて被写体が収まるようにする */
    effectiveFov() {
      const a = this.aspect;
      if (a >= 1) return this.fov;
      /* 縦: 水平画角を維持するように垂直画角を拡大（上限あり） */
      const hf = 2 * Math.atan(Math.tan(this.fov / 2) * 1.0);
      return Math.min(hf / Math.max(a, 0.45), 86 * Math.PI / 180);
    }

    updateCamera() {
      M.perspective(this.proj, this.effectiveFov(), this.aspect, this.near, this.far);
      M.lookAt(this.view, this.camPos, this.camTarget, [0, 1, 0]);
      M.mul(this.viewProj, this.proj, this.view);
      M.invert(this.invVP, this.viewProj);
    }

    project(world, out) {
      out = out || [0, 0, 0];
      const v = [0, 0, 0, 0];
      const m = this.viewProj;
      const x = world[0], y = world[1], z = world[2];
      v[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
      v[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      v[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      v[3] = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (Math.abs(v[3]) < 1e-6) v[3] = 1e-6;
      out[0] = (v[0] / v[3] * 0.5 + 0.5) * this.canvas.clientWidth;
      out[1] = (1 - (v[1] / v[3] * 0.5 + 0.5)) * this.canvas.clientHeight;
      out[2] = v[3];
      return out;
    }

    /* 画面座標 -> y=planeY 平面との交点 */
    rayToPlane(sx, sy, planeY, out) {
      out = out || [0, 0, 0];
      const nx = (sx / this.canvas.clientWidth) * 2 - 1;
      const ny = 1 - (sy / this.canvas.clientHeight) * 2;
      const a = [0, 0, 0], b = [0, 0, 0];
      const p0 = [nx, ny, -1, 1], p1 = [nx, ny, 1, 1];
      const un = (p, o) => {
        const m = this.invVP;
        const x = p[0], y = p[1], z = p[2];
        const w = m[3] * x + m[7] * y + m[11] * z + m[15];
        o[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
        o[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
        o[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
      };
      un(p0, a); un(p1, b);
      const dy = b[1] - a[1];
      let t = Math.abs(dy) < 1e-6 ? 0 : (planeY - a[1]) / dy;
      t = M.clamp(t, 0, 1);
      out[0] = a[0] + (b[0] - a[0]) * t;
      out[1] = planeY;
      out[2] = a[2] + (b[2] - a[2]) * t;
      return out;
    }

    addSprite(pos, size, col, alpha) {
      if (this.sprCount >= this.sprMax) return;
      const d = this.sprData, o = this.sprCount * 44;
      const corners = [[-size, -size, 0, 0], [size, -size, 1, 0], [size, size, 1, 1], [-size, size, 0, 1]];
      for (let k = 0; k < 4; k++) {
        const b = o + k * 11;
        d[b] = pos[0]; d[b + 1] = pos[1]; d[b + 2] = pos[2];
        d[b + 3] = corners[k][0]; d[b + 4] = corners[k][1];
        d[b + 5] = corners[k][2]; d[b + 6] = corners[k][3];
        d[b + 7] = col[0]; d[b + 8] = col[1]; d[b + 9] = col[2]; d[b + 10] = alpha === undefined ? 1 : alpha;
      }
      this.sprCount++;
    }

    collect(root) {
      this.opaque.length = 0; this.trans.length = 0; this.casters.length = 0; this.decals.length = 0;
      const walk = (o) => {
        if (!o.visible) return;
        if (o.mesh && o.mat) {
          const m = o.mat;
          if (m.decal) this.decals.push(o);
          else if (m.alpha !== undefined && m.alpha < 0.999 || m.blend) this.trans.push(o);
          else this.opaque.push(o);
          if (o.cast && m.noShadow !== true && !m.decal) this.casters.push(o);
        }
        for (let i = 0; i < o.children.length; i++) walk(o.children[i]);
      };
      walk(root);
    }

    bindAttribs(prog, mesh, full) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vb);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
      if (full) {
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
      } else {
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(2);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ib);
    }

    renderShadow() {
      const gl = this.gl;
      const P = this.shadow;
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.useProgram(P.p);

      const pass = (fbo, size, center, radius, outVP) => {
        const eye = [
          center[0] + this.sunDir[0] * radius * 2.2,
          center[1] + this.sunDir[1] * radius * 2.2,
          center[2] + this.sunDir[2] * radius * 2.2,
        ];
        const lv = M.lookAt(this._tmp, eye, center, [0, 1, 0]);
        const lp = M.ortho(this._tmp2, -radius, radius, -radius, radius, 0.5, radius * 5);
        M.mul(outVP, lp, lv);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.viewport(0, 0, size, size);
        gl.clearColor(1, 1, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniformMatrix4fv(P.u.uLightVP, false, outVP);
        const lim = radius * 1.5;
        for (const o of this.casters) {
          const dx = o.world[12] - center[0], dz = o.world[14] - center[2];
          const sc = Math.max(Math.abs(o.s[0]), Math.abs(o.s[1]), Math.abs(o.s[2]));
          if (Math.hypot(dx, dz) - (o.mesh.radius || 0) * sc > lim) continue;
          gl.uniformMatrix4fv(P.u.uModel, false, o.world);
          this.bindAttribs(P, o.mesh, false);
          gl.drawElements(gl.TRIANGLES, o.mesh.count, o.mesh.type, 0);
        }
      };

      pass(this.shFbo, this.shadowSize, this.shadowCenter, this.shadowRadius, this.lightVP);
      pass(this.shFboN, this.shadowSizeN, this.shadowCenterN, this.shadowRadiusN, this.lightVPN);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    drawSky() {
      const gl = this.gl;
      const P = this.sky;
      gl.useProgram(P.p);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2); gl.disableVertexAttribArray(3);
      gl.uniformMatrix4fv(P.u.uInvVP, false, this.invVP);
      gl.uniform3fv(P.u.uCamPos, this.camPos);
      gl.uniform3fv(P.u.uSunDir, this.sunDir);
      gl.uniform3fv(P.u.uZenith, this.zenith);
      gl.uniform3fv(P.u.uHorizon, this.horizon);
      gl.uniform3fv(P.u.uSunCol, this.sunCol);
      gl.uniform1f(P.u.uTime, this.time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
    }

    setMaterial(P, m) {
      const gl = this.gl;
      gl.uniform3fv(P.u.uColor, m.color || WHITE);
      gl.uniform3fv(P.u.uEmissive, m.emissive || BLACK);
      gl.uniform1f(P.u.uGloss, m.gloss === undefined ? 0.15 : m.gloss);
      gl.uniform1f(P.u.uShine, m.shine === undefined ? 24 : m.shine);
      gl.uniform1f(P.u.uAlpha, m.alpha === undefined ? 1 : m.alpha);
      gl.uniform1f(P.u.uMetal, m.metal === undefined ? 0 : m.metal);
      gl.uniform1f(P.u.uCutout, m.cutout ? 1 : 0);
      gl.uniform1f(P.u.uCoat, m.coat === undefined ? 0 : m.coat);
      gl.uniform2f(P.u.uUvOff, m.uvOff ? m.uvOff[0] : 0, m.uvOff ? m.uvOff[1] : 0);
      gl.uniform2f(P.u.uUvRep, m.uvRep ? m.uvRep[0] : 1, m.uvRep ? m.uvRep[1] : 1);
      if (m.map) {
        gl.uniform1f(P.u.uUseMap, 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, m.map);
        gl.uniform1i(P.u.uMap, 0);
      } else gl.uniform1f(P.u.uUseMap, 0);
    }

    drawList(P, list) {
      const gl = this.gl;
      for (const o of list) {
        const m = o.mat;
        if (m.doubleSided) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
        this.setMaterial(P, m);
        M.normalMat(o.nmat, o.world);
        gl.uniformMatrix4fv(P.u.uModel, false, o.world);
        gl.uniformMatrix3fv(P.u.uNMat, false, o.nmat);
        this.bindAttribs(P, o.mesh, true);
        gl.drawElements(gl.TRIANGLES, o.mesh.count, o.mesh.type, 0);
        this.stats.draws++;
        this.stats.tris += o.mesh.count / 3;
      }
    }

    /* 接触・環境遮蔽デカール（乗算合成で地面を暗くする） */
    drawDecals() {
      if (!this.decals.length) return;
      const gl = this.gl;
      const P = this.decal;
      gl.useProgram(P.p);
      gl.uniformMatrix4fv(P.u.uProj, false, this.proj);
      gl.uniformMatrix4fv(P.u.uView, false, this.view);
      gl.uniform3fv(P.u.uCamPos, this.camPos);
      gl.uniform1f(P.u.uFogDens, this.fogDens);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.DST_COLOR, gl.ZERO);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      gl.activeTexture(gl.TEXTURE0);
      for (const o of this.decals) {
        const m = o.mat;
        gl.uniform1f(P.u.uStrength, m.strength === undefined ? 1 : m.strength);
        gl.bindTexture(gl.TEXTURE_2D, m.map);
        gl.uniform1i(P.u.uMap, 0);
        gl.uniformMatrix4fv(P.u.uModel, false, o.world);
        this.bindAttribs(P, o.mesh, true);
        gl.drawElements(gl.TRIANGLES, o.mesh.count, o.mesh.type, 0);
        this.stats.draws++;
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.CULL_FACE);
    }

    drawSprites() {
      if (!this.sprCount) return;
      const gl = this.gl;
      const P = this.spr;
      gl.useProgram(P.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.sprBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sprData.subarray(0, this.sprCount * 44));
      const st = 44;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, st, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, st, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, st, 20);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, st, 28);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sprIdx);
      gl.uniformMatrix4fv(P.u.uProj, false, this.proj);
      gl.uniformMatrix4fv(P.u.uView, false, this.view);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      gl.drawElements(gl.TRIANGLES, this.sprCount * 6, gl.UNSIGNED_SHORT, 0);
      gl.depthMask(true);
      gl.disableVertexAttribArray(3);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.BLEND);
    }

    render(root, dt) {
      const gl = this.gl;
      this.time += dt;
      this.resize();
      this.updateCamera();
      root.updateWorld(null);
      this.collect(root);
      this.stats.draws = 0; this.stats.tris = 0;

      this.renderShadow();

      gl.viewport(0, 0, this.vw, this.vh);
      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      this.drawSky();

      const P = this.main;
      gl.useProgram(P.p);
      gl.uniformMatrix4fv(P.u.uProj, false, this.proj);
      gl.uniformMatrix4fv(P.u.uView, false, this.view);
      gl.uniformMatrix4fv(P.u.uLightVP, false, this.lightVP);
      gl.uniformMatrix4fv(P.u.uLightVPN, false, this.lightVPN);
      gl.uniform3fv(P.u.uCamPos, this.camPos);
      gl.uniform3fv(P.u.uSunDir, this.sunDir);
      gl.uniform3fv(P.u.uSunCol, this.sunCol);
      gl.uniform3fv(P.u.uSkyCol, this.skyCol);
      gl.uniform3fv(P.u.uGndCol, this.gndCol);
      gl.uniform3fv(P.u.uFogCol, this.fogCol);
      gl.uniform3fv(P.u.uFogCol2, this.fogCol2);
      gl.uniform1f(P.u.uFogDens, this.fogDens);
      gl.uniform1f(P.u.uShadowOn, 1);
      gl.uniform1f(P.u.uShadowTexel, 1 / this.shadowSize);
      gl.uniform1f(P.u.uShadowTexelN, 1 / this.shadowSizeN);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.shTex);
      gl.uniform1i(P.u.uShadow, 1);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.shTexN);
      gl.uniform1i(P.u.uShadowN, 2);

      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      this.drawList(P, this.opaque);

      /* 半透明: 奥から手前へ */
      const cp = this.camPos;
      this.trans.sort((a, b) => {
        const da = (a.world[12] - cp[0]) ** 2 + (a.world[13] - cp[1]) ** 2 + (a.world[14] - cp[2]) ** 2;
        const db = (b.world[12] - cp[0]) ** 2 + (b.world[13] - cp[1]) ** 2 + (b.world[14] - cp[2]) ** 2;
        return db - da;
      });
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.useProgram(P.p);
      this.drawList(P, this.trans);
      gl.depthMask(true);
      gl.disable(gl.BLEND);

      this.drawDecals();
      this.drawSprites();
      this.sprCount = 0;
    }
  }
  const WHITE = new Float32Array([1, 1, 1]);
  const BLACK = new Float32Array([0, 0, 0]);
  AG.Renderer = Renderer;
})(window.AG);
