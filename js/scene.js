/* =========================================================
   scene.js — プラネタリウム・ドームの 3D 描画（生WebGL）
   カメラはドームの中心（原点）にいる。
   ========================================================= */
(function (global) {
  'use strict';

  var R_DOME = 200.0;
  var R_STAR = 162.0;
  var R_LINE = 164.0;
  var R_PLANET = 152.0;
  var R_SHOOT = 168.0;
  var DOME_POLAR = 100.0;                        // 度
  var FLOOR_Y = R_DOME * Math.cos(U.rad(DOME_POLAR));   // ≒ -34.7
  var FLOOR_R = R_DOME * Math.sin(U.rad(DOME_POLAR));   // ≒ 197

  /* ============================================================
     シェーダ・ソース
     ============================================================ */

  var NOISE_GLSL = [
    'float hash31(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453123); }',
    'float vnoise(vec3 p){',
    '  vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);',
    '  float a=mix(mix(mix(hash31(i+vec3(0.,0.,0.)),hash31(i+vec3(1.,0.,0.)),f.x),',
    '                  mix(hash31(i+vec3(0.,1.,0.)),hash31(i+vec3(1.,1.,0.)),f.x),f.y),',
    '              mix(mix(hash31(i+vec3(0.,0.,1.)),hash31(i+vec3(1.,0.,1.)),f.x),',
    '                  mix(hash31(i+vec3(0.,1.,1.)),hash31(i+vec3(1.,1.,1.)),f.x),f.y),f.z);',
    '  return a;',
    '}',
    'float fbm(vec3 p){',
    '  float s=0.0, a=0.5;',
    '  for(int i=0;i<3;i++){ s+=a*vnoise(p); p*=2.17; a*=0.5; }',
    '  return s*1.14;',
    '}'
  ].join('\n');

  /* ---------- ドーム ---------- */
  var DOME_VS = [
    'attribute vec3 aPos;',
    'uniform mat4 uVP;',
    'varying vec3 vDir;',
    'void main(){ vDir = aPos; gl_Position = uVP * vec4(aPos,1.0); }'
  ].join('\n');

  var DOME_FS = [
    'precision highp float;',
    'varying vec3 vDir;',
    'uniform float uDim, uTime, uMW, uNebAmt, uMwInt, uRainbow, uRoomLight, uWash;',
    'uniform vec3 uZenith, uHorizon, uNeb, uMwCol, uMwN, uMwT, uCove;',
    NOISE_GLSL,
    'vec3 hue(float h){ return 0.55 + 0.45*cos(6.28318*(h + vec3(0.0,0.33,0.67))); }',
    'void main(){',
    '  vec3 d = normalize(vDir);',
    '  float y = d.y;',
    '  vec3 room = vec3(0.0), sky = vec3(0.0);',
    /* ---- 会場モード（暗転しきったら 計算しない） ---- */
    '  if(uDim < 0.995){',
    '    room = mix(vec3(0.36,0.33,0.38), vec3(0.90,0.885,0.86), smoothstep(-0.28,0.98,y));',
    '    float cove = exp(-pow(max(y+0.04,0.0)*11.0,1.4));',
    '    room += uCove * cove * 0.30;',
    '    room += vec3(0.09,0.085,0.10) * smoothstep(0.45,1.0,y);',
    '    room *= mix(vec3(1.0), vec3(1.03,0.995,0.95), smoothstep(-0.2,0.7,y));',
    '    float lat = asin(clamp(y,-1.0,1.0));',
    '    float az  = atan(d.z, d.x);',
    '    float rg = abs(fract(lat*(2.0/3.14159265)*7.0+0.5)-0.5)*2.0;',
    '    float rl = 1.0 - smoothstep(0.0,0.07,rg);',
    '    float rd = abs(fract(az*0.15915494*24.0+0.5)-0.5)*2.0;',
    '    float rdl = (1.0 - smoothstep(0.0,0.055,rd)) * smoothstep(0.99,0.55,y);',
    '    room -= (rl*0.05 + rdl*0.055);',
    /* 天井の あかりだまり */
    '    room += vec3(1.0,0.93,0.82) * 0.07 * uRoomLight * pow(max(0.5+0.5*cos(az*8.0),0.0),9.0) * smoothstep(-0.1,0.5,y);',
    '    room *= (0.14 + 0.86*uRoomLight);',
    '  }',
    /* ---- 星空モード（明るいうちは 計算しない） ---- */
    '  if(uDim > 0.005){',
    '    sky = mix(uHorizon, uZenith, smoothstep(-0.15,0.92,y));',
    '    float n1 = fbm(d*1.5 + vec3(2.3,0.0,1.1));',
    '    float neb = pow(max(n1-0.36,0.0)*1.85, 2.0);',
    '    sky += uNeb * neb * uNebAmt * 0.40;',
    /* 天の川 */
    '    float dd = dot(d, uMwN);',
    '    float band = exp(-dd*dd*30.0);',
    '    float t = dot(d, uMwT);',
    '    float edge = mix(-1.25, 1.25, uMW);',
    '    float mask = smoothstep(edge, edge-0.40, t);',
    '    float head = exp(-pow((t-edge)/0.11,2.0)) * step(0.02,uMW) * step(uMW,0.985);',
    '    float n2 = fbm(d*5.4 + vec3(0.0, uTime*0.006, 4.0));',
    '    float cl = 0.35 + 1.10*n1;',
    '    float fil = smoothstep(0.30,0.78,n2); fil *= fil;',
    '    float mwA = band * cl * fil;',
    '    vec3 mwc = mix(uMwCol, hue(t*0.45 + uTime*0.02), uRainbow);',
    '    sky += mwc * (mwA*mask + band*head*0.7) * uMwInt * 0.26;',
    '    sky += uMwCol * band * mask * n2 * n2 * 0.10 * uMwInt;',
    '    sky *= 1.0 - 0.32*smoothstep(0.15,-0.30,y);',
    '  }',
    /* ---- 合成 ---- */
    '  vec3 col = mix(room, sky, uDim);',
    '  col += vec3(0.35,0.55,0.95) * uWash * (0.4+0.6*smoothstep(-0.2,0.9,y));',
    '  col = pow(max(col,0.0), vec3(0.94));',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ---------- 星 ---------- */
  var STAR_VS = [
    'attribute vec3 aDir;',
    'attribute vec4 aPar;',      // size, bright, order, phase
    'attribute vec3 aTint;',
    'uniform mat4 uVP;',
    'uniform float uReveal, uTime, uPx, uAlpha, uTwinkle, uRadius;',
    'varying float vA;',
    'varying vec3 vT;',
    'void main(){',
    '  float app = smoothstep(aPar.z, aPar.z+0.035, uReveal);',
    '  float flash = exp(-pow((uReveal-aPar.z)/0.028,2.0));',
    '  float tw = 1.0 + uTwinkle*0.42*sin(uTime*(1.4+aPar.w*2.2) + aPar.w*31.4);',
    '  float sc = app*(1.0 + 1.5*flash)*tw;',
    '  gl_PointSize = max(1.0, aPar.x * uPx * sc);',
    '  vA = app * aPar.y * uAlpha * (0.75 + 0.45*tw) * (1.0 + 2.0*flash);',
    '  vT = aTint;',
    '  gl_Position = uVP * vec4(aDir*uRadius, 1.0);',
    '}'
  ].join('\n');

  var STAR_FS = [
    'precision mediump float;',
    'varying float vA; varying vec3 vT;',
    'void main(){',
    '  vec2 c = gl_PointCoord*2.0-1.0;',
    '  float r2 = dot(c,c);',
    '  if(r2>1.0) discard;',
    '  float core = exp(-r2*15.0);',
    '  float halo = exp(-r2*3.2)*0.30;',
    '  float sp = pow(max(0.0,1.0-abs(c.x)*6.5),3.0)+pow(max(0.0,1.0-abs(c.y)*6.5),3.0);',
    '  sp *= exp(-r2*2.6)*0.42;',
    '  float a = (core+halo+sp)*vA;',
    '  gl_FragColor = vec4(vT*a, 0.0);',
    '}'
  ].join('\n');

  /* ---------- 光の線（星座線・流れ星） ---------- */
  var BEAM_VS = [
    'attribute vec3 aPos;',
    'attribute vec2 aST;',   // s = side(-1..1), t = 0..1
    'uniform mat4 uVP;',
    'varying vec2 vST;',
    'void main(){ vST = aST; gl_Position = uVP * vec4(aPos,1.0); }'
  ].join('\n');

  var BEAM_FS = [
    'precision mediump float;',
    'varying vec2 vST;',
    'uniform vec3 uColor;',
    'uniform float uProgress, uAlpha, uTail, uHead, uTime;',
    'void main(){',
    '  float s = vST.x, t = vST.y;',
    '  float w = 1.0-abs(s);',
    '  float line = pow(max(w,0.0),2.4)*0.34;',
    '  float core = exp(-s*s*11.0)*0.52;',
    '  float rev = smoothstep(uProgress, uProgress-0.015, t);',
    '  rev *= smoothstep(uProgress-uTail-0.20, uProgress-uTail, t);',
    '  float hd = exp(-pow((t-uProgress)/0.022,2.0))*uHead;',
    '  float a = (line+core)*rev + hd*w;',
    '  a *= uAlpha;',
    '  gl_FragColor = vec4(uColor*a, 0.0);',
    '}'
  ].join('\n');

  /* ---------- 惑星・月（板ポリの疑似球） ---------- */
  var PLANET_VS = [
    'attribute vec2 aQ;',
    'uniform mat4 uVP;',
    'uniform vec3 uC, uR, uU;',
    'uniform float uSize;',
    'varying vec2 vUV;',
    'void main(){',
    '  vUV = aQ;',
    '  vec3 p = uC + uR*(aQ.x*uSize) + uU*(aQ.y*uSize);',
    '  gl_Position = uVP * vec4(p,1.0);',
    '}'
  ].join('\n');

  var PLANET_FS = [
    'precision highp float;',
    'varying vec2 vUV;',
    'uniform vec3 uCol, uLight;',
    'uniform float uAlpha, uBand, uRing, uMoon, uTime, uSeed, uExtent;',
    NOISE_GLSL,
    'void main(){',
    '  vec2 p = vUV*uExtent;',
    '  float r = length(p);',
    '  vec3 col = vec3(0.0); float alpha = 0.0;',
    /* ---- 環 ---- */
    '  if(uRing>0.5){',
    '    vec2 rp = vec2(p.x, (p.y - p.x*0.16)/0.30);',
    '    float rr = length(rp);',
    '    float ringM = smoothstep(1.28,1.36,rr)*(1.0-smoothstep(1.82,1.94,rr));',
    '    float gap = 1.0-0.55*exp(-pow((rr-1.55)/0.05,2.0));',
    '    ringM *= gap;',
    '    float occl = (r<1.0 && p.y<0.0) ? 0.0 : 1.0;',
    '    float ringA = ringM*0.75*occl*uAlpha;',
    '    col += mix(uCol, vec3(1.0), 0.45) * ringA;',
    '    alpha = max(alpha, ringA*0.85);',
    '  }',
    /* ---- 本体 ---- */
    '  if(r < 1.0){',
    '    float z = sqrt(max(0.0,1.0-r*r));',
    '    vec3 n = vec3(p, z);',
    '    vec3 L = normalize(uLight);',
    '    float dif = max(dot(n,L),0.0);',
    '    float term = pow(dif, 0.75);',
    '    vec3 base = uCol;',
    '    float b = fbm(vec3(n.x*2.0, n.y*7.0+uSeed, n.z*2.0+uSeed));',
    '    base *= 1.0 + uBand*(b-0.5)*0.85;',
    '    if(uMoon>0.5){',
    '      float cr = fbm(vec3(n*4.5+uSeed));',
    '      float cr2 = fbm(vec3(n*11.0+uSeed*2.0));',
    '      base *= 0.74 + 0.30*smoothstep(0.32,0.78,cr) - 0.22*smoothstep(0.58,0.88,cr2);',
    '    }',
    '    float rim = pow(1.0-z, 3.0);',
    '    float key = mix(1.05, 0.72, uMoon);',
    '    vec3 c = base*(0.10 + key*term) + mix(uCol,vec3(1.0),0.6)*rim*0.30*(0.25+dif);',
    '    float edgeA = 1.0-smoothstep(0.965,1.0,r);',
    '    col = mix(col, c, edgeA);',
    '    alpha = max(alpha, edgeA*uAlpha);',
    '    col *= uAlpha;',
    '  }',
    /* ---- 光の暈 ---- */
    '  float glow = exp(-pow(max(r-0.95,0.0)*3.4,2.0))*0.5;',
    '  glow *= 1.0 - smoothstep(uExtent*0.45, uExtent*0.99, r);',
    '  col += mix(uCol,vec3(1.0),0.35)*glow*uAlpha*mix(0.75, 0.42, uMoon);',
    '  gl_FragColor = vec4(col, alpha);',
    '}'
  ].join('\n');

  /* ---------- 会場のもの（床・座席・投影機） ---------- */
  var OBJ_VS = [
    'attribute vec3 aPos; attribute vec3 aNrm; attribute vec3 aCol; attribute vec2 aPar;',
    'uniform mat4 uVP;',
    'varying vec3 vN, vC, vP; varying vec2 vPar;',
    'void main(){ vN=aNrm; vC=aCol; vP=aPos; vPar=aPar; gl_Position = uVP*vec4(aPos,1.0); }'
  ].join('\n');

  var OBJ_FS = [
    'precision mediump float;',
    'varying vec3 vN, vC, vP; varying vec2 vPar;',
    'uniform float uRoomLight, uReflect, uProjGlow, uTime;',
    'uniform vec3 uSkyTint, uWarm;',
    'void main(){',
    '  vec3 n = normalize(vN);',
    '  vec3 L = normalize(vec3(0.25,1.0,0.12));',
    '  float dif = max(dot(n,L),0.0);',
    '  float up = max(n.y,0.0);',
    '  float bounce = 0.34 + 0.30*max(-n.y,0.0) + 0.26*max(n.y,0.0);',
    '  vec3 col = vC*(bounce + 0.85*dif)*uWarm*uRoomLight;',
    /* 空からの淡い反射 */
    '  col += vC*uSkyTint*uReflect*(0.30+0.85*up)*2.1;',
    /* 床の中心グロー */
    '  float d = length(vP.xz);',
    '  if(vPar.y>0.5 && vPar.y<1.5){',
    '    float g = exp(-pow(d/70.0,2.0));',
    '    col += uSkyTint*uReflect*g*1.5;',
    '    col += uWarm*uRoomLight*g*0.16;',
    '    float ring = 0.5+0.5*sin(d*0.20);',
    '    col *= 0.88+0.12*ring;',
    '  }',
    /* 投影機：星をあける ちいさな穴が きらり */
    '  if(vPar.y > 1.5 && vPar.x > 0.01){',
    '    float la = asin(clamp(n.y,-1.0,1.0));',
    '    float aa = atan(n.z, n.x);',
    '    vec2 g = fract(vec2(aa*2.9, la*5.4)) - 0.5;',
    '    float hole = 1.0 - smoothstep(0.10, 0.24, length(g));',
    '    col += vec3(1.0,0.96,0.86) * hole * vPar.x * (0.22 + uProjGlow*1.5);',
    '    col += mix(uSkyTint*4.0, vec3(0.9,0.93,1.0), 0.5) * pow(1.0-abs(dot(n, normalize(vec3(0.0,0.4,1.0)))), 3.0) * 0.35;',
    '  }',
    /* 発光 */
    '  col += mix(uSkyTint*3.0, vec3(1.0,0.95,0.85), 0.35) * vPar.x * uProjGlow * 0.55;',
    /* 遠景の落ち込み */
    '  col *= 1.0 - 0.45*smoothstep(60.0,190.0,d)*(1.0-uReflect*0.5);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ---------- 投影ビーム ---------- */
  var CONE_VS = [
    'attribute vec3 aPos; attribute vec2 aUV;',
    'uniform mat4 uVP; varying vec2 vUV; varying vec3 vP;',
    'void main(){ vUV=aUV; vP=aPos; gl_Position = uVP*vec4(aPos,1.0); }'
  ].join('\n');
  var CONE_FS = [
    'precision mediump float;',
    'varying vec2 vUV; varying vec3 vP;',
    'uniform float uAmt, uTime; uniform vec3 uCol;',
    'void main(){',
    '  float h = clamp((vP.y+30.0)/210.0,0.0,1.0);',
    '  float a = uAmt * (1.0-h) * 0.16;',
    '  a *= 0.75 + 0.25*sin(vUV.x*40.0 + uTime*1.5);',
    '  gl_FragColor = vec4(uCol*a, 0.0);',
    '}'
  ].join('\n');

  /* ============================================================
     Scene
     ============================================================ */
  var S = {
    gl: null, canvas: null, ok: false,
    theme: null,
    t: 0,
    state: {
      dim: 0, roomLight: 1, wash: 0,
      starReveal: 0, starAlpha: 1, twinkle: 1,
      mw: 0, planetA: 0, moonA: 0,
      c0: 0, c1: 0, c2: 0, c3: 0,
      camPitch: -18, camYaw: 0, fov: 62,
      camY: -10, camZ: 95,
      projGlow: 0.12, reflect: 0, beamAmt: 0,
      skyFade: 0
    },
    planetAz: [40, 170, 285],
    shoots: []
  };

  var prog = {}, buf = {}, mesh = {};

  /* ---------------- 初期化 ---------------- */
  S.init = function (canvas) {
    S.canvas = canvas;
    var gl = GLC.create(canvas);
    if (!gl) return false;
    S.gl = gl;

    prog.dome = GLC.program(gl, DOME_VS, DOME_FS);
    prog.star = GLC.program(gl, STAR_VS, STAR_FS);
    prog.beam = GLC.program(gl, BEAM_VS, BEAM_FS);
    prog.planet = GLC.program(gl, PLANET_VS, PLANET_FS);
    prog.obj = GLC.program(gl, OBJ_VS, OBJ_FS);
    prog.cone = GLC.program(gl, CONE_VS, CONE_FS);
    if (!prog.dome || !prog.star || !prog.beam || !prog.planet || !prog.obj) return false;

    /* ドーム */
    var dg = GLC.sphere(R_DOME, 56, 32, DOME_POLAR, true);
    buf.domePos = GLC.buffer(gl, dg.pos);
    buf.domeIdx = GLC.buffer(gl, dg.idx, gl.ELEMENT_ARRAY_BUFFER);
    mesh.domeCount = dg.count;

    /* 惑星用クアッド */
    buf.quad = GLC.buffer(gl, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]));

    /* 投影ビーム（円錐） */
    var cg = GLC.cylinder(3.0, 150.0, 210.0, 28);
    var cpos = new Float32Array(cg.pos.length);
    for (var i = 0; i < cg.pos.length; i += 3) {
      cpos[i] = cg.pos[i]; cpos[i + 1] = cg.pos[i + 1] + 78.0; cpos[i + 2] = cg.pos[i + 2];
    }
    buf.conePos = GLC.buffer(gl, cpos);
    buf.coneUV = GLC.buffer(gl, cg.uv);
    buf.coneIdx = GLC.buffer(gl, cg.idx, gl.ELEMENT_ARRAY_BUFFER);
    mesh.coneCount = cg.count;

    buildRoom();

    /* 流れ星バッファ（動的） */
    buf.shootPos = gl.createBuffer();
    buf.shootST = gl.createBuffer();

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.02, 0.02, 0.05, 1);

    S.ok = true;
    return true;
  };

  /* ---------------- 会場ジオメトリ ---------------- */
  function buildRoom() {
    var gl = S.gl;
    var P = [], N = [], C = [], PR = [], I = [];
    var vo = 0;

    function push(geo, m, col, emis, kind) {
      var n = geo.pos.length / 3;
      for (var i = 0; i < n; i++) {
        var x = geo.pos[i * 3], y = geo.pos[i * 3 + 1], z = geo.pos[i * 3 + 2];
        P.push(m[0] * x + m[4] * y + m[8] * z + m[12],
               m[1] * x + m[5] * y + m[9] * z + m[13],
               m[2] * x + m[6] * y + m[10] * z + m[14]);
        var nx = geo.nrm[i * 3], ny = geo.nrm[i * 3 + 1], nz = geo.nrm[i * 3 + 2];
        var ox = m[0] * nx + m[4] * ny + m[8] * nz;
        var oy = m[1] * nx + m[5] * ny + m[9] * nz;
        var oz = m[2] * nx + m[6] * ny + m[10] * nz;
        var l = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
        N.push(ox / l, oy / l, oz / l);
        C.push(col[0], col[1], col[2]);
        PR.push(emis, kind);
      }
      for (var j = 0; j < geo.idx.length; j++) I.push(geo.idx[j] + vo);
      vo += n;
    }

    var T = U.M.translate, RY = U.M.rotateY, mul = U.M.multiply;

    /* 床 */
    push(GLC.disk(FLOOR_R, 96), T(0, FLOOR_Y + 0.2, 0), [0.26, 0.22, 0.31], 0, 1);

    /* 座席（同心円） */
    var seatBase = GLC.box(8.2, 4.6, 8.4);
    var seatBack = GLC.box(8.2, 10.5, 2.6);
    var rings = [[54, 20], [76, 27], [98, 34], [120, 41], [142, 48]];
    var seatCols = [[0.40, 0.21, 0.33], [0.35, 0.19, 0.36], [0.44, 0.24, 0.31]];
    for (var r = 0; r < rings.length; r++) {
      var rad = rings[r][0], cnt = rings[r][1];
      for (var s = 0; s < cnt; s++) {
        var a = s / cnt * Math.PI * 2 + r * 0.06;
        var mRot = RY(-a);
        var col = seatCols[(r + s) % seatCols.length];
        var lift = FLOOR_Y + r * 2.2;
        var mb = mul(T(Math.cos(a) * rad, lift + 4.0, Math.sin(a) * rad), mRot);
        push(seatBase, mb, col, 0, 0);
        var mk = mul(mul(T(Math.cos(a) * (rad + 4.0), lift + 9.6, Math.sin(a) * (rad + 4.0)), mRot),
                     U.M.rotateX(U.rad(13)));
        push(seatBack, mk, [col[0] * 1.18, col[1] * 1.18, col[2] * 1.22], 0, 0);
      }
    }

    /* 中央の投影機（ダンベル型のスターボール） */
    var mtl = [0.34, 0.36, 0.44];
    push(GLC.cylinder(9, 6.5, 9, 28), T(0, FLOOR_Y + 4.5, 0), [0.22, 0.22, 0.28], 0, 2);
    push(GLC.cylinder(3.0, 2.6, 15, 20), T(0, FLOOR_Y + 16, 0), mtl, 0.02, 2);
    push(GLC.sphere(5.4, 24, 16, 180, false), T(0, FLOOR_Y + 26, 0), [0.16, 0.17, 0.22], 0.55, 2);
    push(GLC.cylinder(1.7, 1.7, 8, 14), T(0, FLOOR_Y + 34.5, 0), mtl, 0.05, 2);
    push(GLC.sphere(5.4, 24, 16, 180, false), T(0, FLOOR_Y + 43, 0), [0.16, 0.17, 0.22], 0.55, 2);
    push(GLC.cylinder(2.3, 1.2, 4.5, 14), T(0, FLOOR_Y + 49.5, 0), mtl, 0.35, 2);

    mesh.roomBig = vo > 65000;
    buf.roomPos = GLC.buffer(gl, new Float32Array(P));
    buf.roomNrm = GLC.buffer(gl, new Float32Array(N));
    buf.roomCol = GLC.buffer(gl, new Float32Array(C));
    buf.roomPar = GLC.buffer(gl, new Float32Array(PR));
    var idxArr;
    if (vo > 65000 && gl.getExtension('OES_element_index_uint')) {
      idxArr = new Uint32Array(I); mesh.roomType = gl.UNSIGNED_INT;
    } else {
      idxArr = new Uint16Array(I); mesh.roomType = gl.UNSIGNED_SHORT;
    }
    buf.roomIdx = GLC.buffer(gl, idxArr, gl.ELEMENT_ARRAY_BUFFER);
    mesh.roomCount = I.length;
  }

  /* ---------------- テーマ適用（星・星座を作る） ---------------- */
  S.setTheme = function (theme) {
    S.theme = theme;
    buildStars(theme);
    buildFigures(theme);
    S.planetAz = [40, 170, 285];
  };

  function buildStars(theme) {
    var gl = S.gl;
    var rnd = U.rng(theme.seed);
    var n = theme.star.count;

    /* 天の川の帯にそった基底（星のかわ を つくる） */
    var mwn = U.V.norm(theme.mw.tilt);
    var mwt = U.V.norm(U.V.cross(mwn, [0, 1, 0]));
    var e1 = U.V.norm(U.V.cross(mwn, Math.abs(mwn[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
    var e2 = U.V.norm(U.V.cross(mwn, e1));
    function gauss() { return (rnd() + rnd() + rnd() + rnd() - 2) * 0.7; }

    var A = { dir: [], par: [], tint: [] };   // ふつうの星
    var B = { dir: [], par: [], tint: [] };   // 天の川の星

    function tint(into, boost) {
      var tl = theme.star.tints[Math.floor(rnd() * theme.star.tints.length)];
      var wm = 0.35 + rnd() * 0.5;
      into.tint.push(U.lerp(1, tl[0], wm) * boost,
                     U.lerp(1, tl[1], wm) * boost,
                     U.lerp(1, tl[2], wm) * boost);
    }

    /* --- ① ふつうの星（最初の 9個は ひとつずつ現れる 主役） --- */
    var heroes = 9;
    var mainN = Math.floor(n * 0.62);
    for (var i = 0; i < mainN; i++) {
      var d, alt;
      if (i < heroes) {
        alt = 34 + rnd() * 44;
        d = U.dirFromAzAlt((i / heroes) * 360 + rnd() * 22, alt);
      } else {
        var c = Math.pow(rnd(), 0.72);
        alt = 90 - Math.acos(1 - c * 1.06) * 180 / Math.PI;
        if (alt < -6) alt = -6 + rnd() * 6;
        d = U.dirFromAzAlt(rnd() * 360, alt);
      }
      A.dir.push(d[0], d[1], d[2]);

      var mag = rnd(), size, bright;
      if (i < heroes) { size = 15 + rnd() * 6; bright = 1.5; }
      else if (mag > 0.985) { size = 12 + rnd() * 5; bright = 1.2; }
      else if (mag > 0.93) { size = 7.5 + rnd() * 4; bright = 0.9; }
      else if (mag > 0.72) { size = 4.6 + rnd() * 2.2; bright = 0.66; }
      else { size = 2.3 + rnd() * 2.0; bright = 0.42 + rnd() * 0.24; }

      var zen = 1.0 - U.clamp((alt + 8) / 98, 0, 1);
      var order = (i < heroes) ? (0.004 + i * 0.0072)
                               : 0.085 + 0.915 * U.clamp(zen * 0.62 + rnd() * 0.45, 0, 1);
      A.par.push(size, bright, order, rnd());
      tint(A, 1.0);
    }

    /* --- ② 天の川の星（帯の 端から端へ 流れて 現れる） --- */
    var bandN = n - mainN;
    for (var k = 0; k < bandN; k++) {
      var ph = rnd() * Math.PI * 2;
      var wide = rnd() < 0.22;
      var off = gauss() * (wide ? 0.24 : 0.10);
      var bd = U.V.norm([
        e1[0] * Math.cos(ph) + e2[0] * Math.sin(ph) + mwn[0] * off,
        e1[1] * Math.cos(ph) + e2[1] * Math.sin(ph) + mwn[1] * off,
        e1[2] * Math.cos(ph) + e2[2] * Math.sin(ph) + mwn[2] * off
      ]);
      if (bd[1] < -0.12) { bd[1] = -bd[1]; bd = U.V.norm(bd); }
      B.dir.push(bd[0], bd[1], bd[2]);

      var m2 = rnd(), sz, br;
      if (m2 > 0.97) { sz = 5.0 + rnd() * 3.2; br = 0.66; }
      else if (m2 > 0.80) { sz = 2.6 + rnd() * 1.6; br = 0.40; }
      else { sz = 1.4 + rnd() * 1.3; br = 0.22 + rnd() * 0.20; }

      /* 掃きよせと 同じ向きに 順番をつける */
      var t = U.V.dot(bd, mwt);
      var ord = U.clamp((t + 1.25) / 2.5 + (rnd() - 0.5) * 0.06, 0, 1);
      B.par.push(sz, br, ord, rnd());
      tint(B, 1.0);
    }

    ['starDir', 'starPar', 'starTint', 'bandDir', 'bandPar', 'bandTint'].forEach(function (kk) {
      if (buf[kk]) gl.deleteBuffer(buf[kk]);
    });
    buf.starDir = GLC.buffer(gl, new Float32Array(A.dir));
    buf.starPar = GLC.buffer(gl, new Float32Array(A.par));
    buf.starTint = GLC.buffer(gl, new Float32Array(A.tint));
    mesh.starCount = A.dir.length / 3;
    buf.bandDir = GLC.buffer(gl, new Float32Array(B.dir));
    buf.bandPar = GLC.buffer(gl, new Float32Array(B.par));
    buf.bandTint = GLC.buffer(gl, new Float32Array(B.tint));
    mesh.bandCount = B.dir.length / 3;
  }

  function buildFigures(theme) {
    var gl = S.gl;
    if (mesh.figs) {
      mesh.figs.forEach(function (f) {
        gl.deleteBuffer(f.linePos); gl.deleteBuffer(f.lineST);
        gl.deleteBuffer(f.kDir); gl.deleteBuffer(f.kPar); gl.deleteBuffer(f.kTint);
      });
    }
    mesh.figs = [];

    theme.figures.forEach(function (F, fi) {
      var anchor = U.dirFromAzAlt(F.az, F.alt);
      var dirs = F.pts.map(function (p) {
        return U.tangentPoint(anchor, p[0] * F.scale, p[1] * F.scale, F.rot);
      });

      /* --- 線 --- */
      var lens = [], total = 0;
      F.edges.forEach(function (e) {
        var a = dirs[e[0]], b = dirs[e[1]];
        var L = Math.acos(U.clamp(U.V.dot(a, b), -1, 1));
        lens.push(L); total += L;
      });
      var pos = [], st = [], acc = 0;
      var HW = 2.0;
      F.edges.forEach(function (e, ei) {
        var a = U.V.scale(dirs[e[0]], R_LINE);
        var b = U.V.scale(dirs[e[1]], R_LINE);
        var t0 = acc / total; acc += lens[ei]; var t1 = acc / total;
        var dvec = U.V.norm(U.V.sub(b, a));
        var nv = U.V.norm(U.V.cross(dirs[e[0]], dvec));
        var ext = U.V.scale(dvec, HW * 0.9);
        var A = U.V.sub(a, ext), B = U.V.add(b, ext);
        var o = U.V.scale(nv, HW);
        function v(p, sgn, t) {
          pos.push(p[0] + o[0] * sgn, p[1] + o[1] * sgn, p[2] + o[2] * sgn);
          st.push(sgn, t);
        }
        v(A, -1, t0); v(A, 1, t0); v(B, 1, t1);
        v(A, -1, t0); v(B, 1, t1); v(B, -1, t1);
      });

      /* --- 頂点の星 --- */
      var kn = dirs.length;
      var kd = new Float32Array(kn * 3), kp = new Float32Array(kn * 4), kt = new Float32Array(kn * 3);
      var rnd = U.rng(theme.seed + fi * 977);
      for (var i = 0; i < kn; i++) {
        kd[i * 3] = dirs[i][0]; kd[i * 3 + 1] = dirs[i][1]; kd[i * 3 + 2] = dirs[i][2];
        kp[i * 4] = 13 + rnd() * 6;
        kp[i * 4 + 1] = 1.45;
        kp[i * 4 + 2] = i / Math.max(1, kn - 1) * 0.85;
        kp[i * 4 + 3] = rnd();
        kt[i * 3] = 1.0; kt[i * 3 + 1] = 0.98; kt[i * 3 + 2] = 0.92;
      }

      mesh.figs.push({
        name: F.name,
        linePos: GLC.buffer(gl, new Float32Array(pos)),
        lineST: GLC.buffer(gl, new Float32Array(st)),
        lineCount: pos.length / 3,
        kDir: GLC.buffer(gl, kd), kPar: GLC.buffer(gl, kp), kTint: GLC.buffer(gl, kt),
        kCount: kn,
        dirs: dirs
      });
    });
  }

  /* ---------------- 流れ星 ---------------- */
  S.shootingStar = function (fast) {
    var gl = S.gl;
    var az = Math.random() * 360;
    var alt = 22 + Math.random() * 52;
    var start = U.dirFromAzAlt(az, alt);
    var ang = Math.random() * Math.PI * 2;
    var dir2 = U.tangentPoint(start, Math.cos(ang) * 3, Math.sin(ang) * 3, 0);
    var tang = U.V.norm(U.V.sub(dir2, U.V.scale(start, U.V.dot(dir2, start))));
    var span = U.rad(26 + Math.random() * 26);

    var N = 16, pos = [], st = [];
    var pts = [];
    for (var i = 0; i <= N; i++) {
      var t = i / N;
      var a = span * t;
      var d = U.V.norm([
        start[0] * Math.cos(a) + tang[0] * Math.sin(a),
        start[1] * Math.cos(a) + tang[1] * Math.sin(a),
        start[2] * Math.cos(a) + tang[2] * Math.sin(a)
      ]);
      pts.push(d);
    }
    for (var k = 0; k < N; k++) {
      var A = U.V.scale(pts[k], R_SHOOT), B = U.V.scale(pts[k + 1], R_SHOOT);
      var t0 = k / N, t1 = (k + 1) / N;
      var dv = U.V.norm(U.V.sub(B, A));
      var nv = U.V.norm(U.V.cross(pts[k], dv));
      var w0 = 0.5 + 2.0 * Math.pow(t0, 1.6);
      var w1 = 0.5 + 2.0 * Math.pow(t1, 1.6);
      function vv(p, sgn, t, w) {
        pos.push(p[0] + nv[0] * sgn * w, p[1] + nv[1] * sgn * w, p[2] + nv[2] * sgn * w);
        st.push(sgn, t);
      }
      vv(A, -1, t0, w0); vv(A, 1, t0, w0); vv(B, 1, t1, w1);
      vv(A, -1, t0, w0); vv(B, 1, t1, w1); vv(B, -1, t1, w1);
    }

    var s = {
      pos: GLC.buffer(gl, new Float32Array(pos)),
      st: GLC.buffer(gl, new Float32Array(st)),
      count: pos.length / 3,
      p: 0, life: 0, dur: fast ? 0.75 : 1.15
    };
    S.shoots.push(s);
    if (S.shoots.length > 8) {
      var old = S.shoots.shift();
      gl.deleteBuffer(old.pos); gl.deleteBuffer(old.st);
    }
    if (global.Snd) Snd.shoot();
  };

  S.figureName = function (i) {
    return (mesh.figs && mesh.figs[i]) ? mesh.figs[i].name : '';
  };

  /* ---------------- リサイズ ---------------- */
  S.quality = 1.0;
  S.resize = function () {
    var c = S.canvas;
    var dpr = Math.min(global.devicePixelRatio || 1, 2) * S.quality;
    var w = Math.floor(global.innerWidth * dpr);
    var h = Math.floor(global.innerHeight * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w; c.height = h;
      c.style.width = global.innerWidth + 'px';
      c.style.height = global.innerHeight + 'px';
    }
  };

  /* ---------------- 描画 ---------------- */
  /* おそい端末では 解像度を すこし下げて なめらかさを まもる */
  var qAcc = 0, qN = 0, qSteps = 0;
  function watchQuality(dt) {
    qAcc += dt; qN++;
    if (qN < 70) return;
    var avg = qAcc / qN;
    qAcc = 0; qN = 0;
    if (avg > 0.036 && qSteps < 3) {
      qSteps++;
      S.quality *= 0.78;
      S.resize();
    }
  }

  S.render = function (dt) {
    if (!S.ok) return;
    var gl = S.gl, st = S.state, th = S.theme;
    S.t += dt;
    watchQuality(dt);

    var W = S.canvas.width, H = S.canvas.height;
    gl.viewport(0, 0, W, H);
    var aspect = W / H;
    var fov = U.rad(st.fov / (aspect > 1 ? 1.16 : 1.0));
    var proj = U.M.perspective(fov, aspect, 2, 460);
    var eye = [0, st.camY, st.camZ];
    var view = U.M.multiply(
      U.M.rotateX(-U.rad(st.camPitch)),
      U.M.multiply(U.M.rotateY(U.rad(st.camYaw)), U.M.translate(-eye[0], -eye[1], -eye[2]))
    );
    var VP = U.M.multiply(proj, view);

    var bg = [
      U.lerp(0.86, th.sky.zenith[0], st.dim),
      U.lerp(0.86, th.sky.zenith[1], st.dim),
      U.lerp(0.87, th.sky.zenith[2], st.dim)
    ];
    gl.clearColor(bg[0], bg[1], bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* ---- ドーム ---- */
    gl.useProgram(prog.dome.p);
    gl.depthMask(true);
    GLC.attrib(gl, prog.dome, 'aPos', buf.domePos, 3);
    gl.uniformMatrix4fv(prog.dome.u.uVP, false, VP);
    gl.uniform1f(prog.dome.u.uDim, st.dim);
    gl.uniform1f(prog.dome.u.uTime, S.t);
    gl.uniform1f(prog.dome.u.uMW, st.mw);
    gl.uniform1f(prog.dome.u.uNebAmt, th.sky.nebulaAmt);
    gl.uniform1f(prog.dome.u.uMwInt, th.mw.intensity);
    gl.uniform1f(prog.dome.u.uRainbow, th.mw.rainbow ? 1 : 0);
    gl.uniform1f(prog.dome.u.uRoomLight, st.roomLight);
    gl.uniform1f(prog.dome.u.uWash, st.wash);
    gl.uniform3fv(prog.dome.u.uZenith, th.sky.zenith);
    gl.uniform3fv(prog.dome.u.uHorizon, th.sky.horizon);
    gl.uniform3fv(prog.dome.u.uNeb, th.sky.nebula);
    gl.uniform3fv(prog.dome.u.uMwCol, th.mw.color);
    var mwn = U.V.norm(th.mw.tilt);
    var mwt = U.V.norm(U.V.cross(mwn, [0, 1, 0]));
    gl.uniform3fv(prog.dome.u.uMwN, mwn);
    gl.uniform3fv(prog.dome.u.uMwT, mwt);
    gl.uniform3fv(prog.dome.u.uCove, [1.0 * st.roomLight, 0.86 * st.roomLight, 0.62 * st.roomLight]);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.domeIdx);
    gl.drawElements(gl.TRIANGLES, mesh.domeCount, gl.UNSIGNED_SHORT, 0);
    GLC.disableAll(gl, prog.dome);

    /* ---- 会場（床・座席・投影機） ---- */
    gl.useProgram(prog.obj.p);
    GLC.attrib(gl, prog.obj, 'aPos', buf.roomPos, 3);
    GLC.attrib(gl, prog.obj, 'aNrm', buf.roomNrm, 3);
    GLC.attrib(gl, prog.obj, 'aCol', buf.roomCol, 3);
    GLC.attrib(gl, prog.obj, 'aPar', buf.roomPar, 2);
    gl.uniformMatrix4fv(prog.obj.u.uVP, false, VP);
    gl.uniform1f(prog.obj.u.uRoomLight, st.roomLight);
    gl.uniform1f(prog.obj.u.uReflect, st.reflect);
    gl.uniform1f(prog.obj.u.uProjGlow, st.projGlow);
    gl.uniform1f(prog.obj.u.uTime, S.t);
    var tint = th.mw.color;
    gl.uniform3f(prog.obj.u.uSkyTint, tint[0] * 0.10, tint[1] * 0.11, tint[2] * 0.14);
    gl.uniform3f(prog.obj.u.uWarm, 1.0, 0.93, 0.84);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.roomIdx);
    gl.drawElements(gl.TRIANGLES, mesh.roomCount, mesh.roomType, 0);
    GLC.disableAll(gl, prog.obj);

    gl.depthMask(false);

    /* ---- 投影ビーム ---- */
    if (st.beamAmt > 0.002 && prog.cone) {
      gl.useProgram(prog.cone.p);
      GLC.attrib(gl, prog.cone, 'aPos', buf.conePos, 3);
      GLC.attrib(gl, prog.cone, 'aUV', buf.coneUV, 2);
      gl.uniformMatrix4fv(prog.cone.u.uVP, false, VP);
      gl.uniform1f(prog.cone.u.uAmt, st.beamAmt);
      gl.uniform1f(prog.cone.u.uTime, S.t);
      gl.uniform3f(prog.cone.u.uCol, tint[0], tint[1], tint[2]);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.coneIdx);
      gl.drawElements(gl.TRIANGLES, mesh.coneCount, gl.UNSIGNED_SHORT, 0);
      GLC.disableAll(gl, prog.cone);
    }

    /* ---- 星 ---- */
    var px = H / 950;
    gl.useProgram(prog.star.p);
    GLC.attrib(gl, prog.star, 'aDir', buf.starDir, 3);
    GLC.attrib(gl, prog.star, 'aPar', buf.starPar, 4);
    GLC.attrib(gl, prog.star, 'aTint', buf.starTint, 3);
    gl.uniformMatrix4fv(prog.star.u.uVP, false, VP);
    gl.uniform1f(prog.star.u.uReveal, st.starReveal);
    gl.uniform1f(prog.star.u.uTime, S.t);
    gl.uniform1f(prog.star.u.uPx, px);
    gl.uniform1f(prog.star.u.uAlpha, st.starAlpha);
    gl.uniform1f(prog.star.u.uTwinkle, st.twinkle);
    gl.uniform1f(prog.star.u.uRadius, R_STAR);
    gl.drawArrays(gl.POINTS, 0, mesh.starCount);

    /* ---- 天の川の星（帯の 端から端へ 現れる） ---- */
    if (st.mw > 0.001 && mesh.bandCount) {
      GLC.attrib(gl, prog.star, 'aDir', buf.bandDir, 3);
      GLC.attrib(gl, prog.star, 'aPar', buf.bandPar, 4);
      GLC.attrib(gl, prog.star, 'aTint', buf.bandTint, 3);
      gl.uniform1f(prog.star.u.uReveal, st.mw);
      gl.uniform1f(prog.star.u.uAlpha, st.starAlpha * 1.15);
      gl.drawArrays(gl.POINTS, 0, mesh.bandCount);
    }
    GLC.disableAll(gl, prog.star);

    /* ---- 星座（線 + 頂点星） ---- */
    var cs = [st.c0, st.c1, st.c2, st.c3];
    if (mesh.figs) {
      for (var fi = 0; fi < mesh.figs.length; fi++) {
        var f = mesh.figs[fi], p = cs[fi] || 0;
        if (p <= 0.001) continue;

        gl.useProgram(prog.star.p);
        GLC.attrib(gl, prog.star, 'aDir', f.kDir, 3);
        GLC.attrib(gl, prog.star, 'aPar', f.kPar, 4);
        GLC.attrib(gl, prog.star, 'aTint', f.kTint, 3);
        gl.uniformMatrix4fv(prog.star.u.uVP, false, VP);
        gl.uniform1f(prog.star.u.uReveal, U.clamp(p * 1.25, 0, 1));
        gl.uniform1f(prog.star.u.uTime, S.t);
        gl.uniform1f(prog.star.u.uPx, px);
        gl.uniform1f(prog.star.u.uAlpha, st.starAlpha * 1.1);
        gl.uniform1f(prog.star.u.uTwinkle, st.twinkle * 0.5);
        gl.uniform1f(prog.star.u.uRadius, R_STAR);
        gl.drawArrays(gl.POINTS, 0, f.kCount);
        GLC.disableAll(gl, prog.star);

        gl.useProgram(prog.beam.p);
        GLC.attrib(gl, prog.beam, 'aPos', f.linePos, 3);
        GLC.attrib(gl, prog.beam, 'aST', f.lineST, 2);
        gl.uniformMatrix4fv(prog.beam.u.uVP, false, VP);
        gl.uniform1f(prog.beam.u.uProgress, p);
        gl.uniform1f(prog.beam.u.uAlpha, 0.92 * U.smoothstep(0, 0.12, p));
        gl.uniform1f(prog.beam.u.uTail, 3.0);
        gl.uniform1f(prog.beam.u.uHead, p < 0.995 ? 1.6 : 0.0);
        gl.uniform1f(prog.beam.u.uTime, S.t);
        var ac = th.mw.color;
        gl.uniform3f(prog.beam.u.uColor,
          U.lerp(1, ac[0], 0.62), U.lerp(1, ac[1], 0.62), U.lerp(1, ac[2], 0.62));
        gl.drawArrays(gl.TRIANGLES, 0, f.lineCount);
        GLC.disableAll(gl, prog.beam);
      }
    }

    /* ---- 惑星 ---- */
    if (st.planetA > 0.002) {
      gl.useProgram(prog.planet.p);
      GLC.attrib(gl, prog.planet, 'aQ', buf.quad, 2);
      gl.uniformMatrix4fv(prog.planet.u.uVP, false, VP);
      gl.uniform3f(prog.planet.u.uLight, -0.45, 0.35, 0.82);
      for (var pi = 0; pi < th.planets.length; pi++) {
        var pl = th.planets[pi];
        var az = S.planetAz[pi] + S.t * (2.4 + pi * 0.7) * 0.35;
        var d = U.dirFromAzAlt(az, pl.alt + Math.sin(S.t * 0.12 + pi) * 2.0);
        drawBillboard(d, pl.size * 8.2, pl.color, pl.ring ? 1 : 0, pl.band, 0, pi * 3.7,
                      st.planetA, pl.ring ? 2.0 : 1.35);
      }
      if (th.moon) {
        var md = U.dirFromAzAlt(200 + S.t * 0.55, 40);
        drawBillboard(md, 15.0, [1.0, 0.98, 0.92], 0, 0.1, 1, 4.0, st.moonA, 2.3);
      }
      GLC.disableAll(gl, prog.planet);
    }

    function drawBillboard(dir, size, col, ring, band, moon, seed, alpha, extent) {
      var c = U.V.scale(dir, R_PLANET);
      /* カメラの方を まっすぐ向く板ポリ */
      var toEye = U.V.norm(U.V.sub(eye, c));
      var up = Math.abs(toEye[1]) > 0.985 ? [0, 0, 1] : [0, 1, 0];
      var right = U.V.norm(U.V.cross(up, toEye));
      var realUp = U.V.norm(U.V.cross(toEye, right));
      gl.uniform3fv(prog.planet.u.uC, c);
      gl.uniform3fv(prog.planet.u.uR, right);
      gl.uniform3fv(prog.planet.u.uU, realUp);
      gl.uniform1f(prog.planet.u.uSize, size * extent);
      gl.uniform1f(prog.planet.u.uExtent, extent);
      gl.uniform3fv(prog.planet.u.uCol, col);
      gl.uniform1f(prog.planet.u.uAlpha, alpha);
      gl.uniform1f(prog.planet.u.uBand, band);
      gl.uniform1f(prog.planet.u.uRing, ring);
      gl.uniform1f(prog.planet.u.uMoon, moon);
      gl.uniform1f(prog.planet.u.uSeed, seed);
      gl.uniform1f(prog.planet.u.uTime, S.t);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    /* ---- 流れ星 ---- */
    if (S.shoots.length) {
      gl.useProgram(prog.beam.p);
      gl.uniformMatrix4fv(prog.beam.u.uVP, false, VP);
      gl.uniform1f(prog.beam.u.uTail, 0.34);
      gl.uniform1f(prog.beam.u.uHead, 2.2);
      gl.uniform1f(prog.beam.u.uTime, S.t);
      var sc = th.star.tints[0];
      gl.uniform3f(prog.beam.u.uColor, U.lerp(1, sc[0], 0.3), U.lerp(1, sc[1], 0.3), U.lerp(1, sc[2], 0.3));
      for (var si = S.shoots.length - 1; si >= 0; si--) {
        var sh = S.shoots[si];
        sh.life += dt;
        sh.p = sh.life / sh.dur;
        if (sh.p > 1.5) {
          gl.deleteBuffer(sh.pos); gl.deleteBuffer(sh.st);
          S.shoots.splice(si, 1);
          continue;
        }
        GLC.attrib(gl, prog.beam, 'aPos', sh.pos, 3);
        GLC.attrib(gl, prog.beam, 'aST', sh.st, 2);
        gl.uniform1f(prog.beam.u.uProgress, U.clamp(sh.p * 1.35, 0, 1.4));
        gl.uniform1f(prog.beam.u.uAlpha, 1.15 * U.clamp(1.5 - sh.p, 0, 1) * st.starAlpha);
        gl.drawArrays(gl.TRIANGLES, 0, sh.count);
      }
      GLC.disableAll(gl, prog.beam);
    }

    gl.depthMask(true);
  };

  global.Scene = S;
})(window);
